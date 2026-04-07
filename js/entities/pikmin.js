// ── Pikmin ────────────────────────────────────────────────────────────────────
// Core entity. Each Pikmin has a full state machine driven by behavior rules.

// State machine states
const PIKMIN_STATE = {
  IDLE:      'idle',
  WANDER:    'wander',
  FOLLOWING: 'following',
  ATTACKING: 'attacking',
  CARRYING:  'carrying',
  FLEEING:   'fleeing',
  DEAD:      'dead',
};

// Pikmin type definitions
const PIKMIN_TYPES = {
  red: {
    label: 'Red',
    color: '#ff4a4a',
    stemColor: '#cc2200',
    flowerColor: '#ff8080',
    radius: 7,
    baseSpeed: 70,
    attackDamage: 10,
    attackRange: 12,
    attackCooldown: 0.8,
    carryStrength: 1,
    immunity: ['fire'],
    bonuses: { aggression: 20 },
    description: 'High attack power. Fire immune.',
  },
  blue: {
    label: 'Blue',
    color: '#4a8aff',
    stemColor: '#2255cc',
    flowerColor: '#88aaff',
    radius: 7,
    baseSpeed: 85,
    attackDamage: 6,
    attackRange: 10,
    attackCooldown: 0.7,
    carryStrength: 1,
    immunity: ['water'],
    bonuses: { speed: 15 },
    description: 'Fastest carrier. Water immune.',
  },
  yellow: {
    label: 'Yellow',
    color: '#ffdd4a',
    stemColor: '#ccaa00',
    flowerColor: '#fff099',
    radius: 7,
    baseSpeed: 65,
    attackDamage: 5,
    attackRange: 10,
    attackCooldown: 0.9,
    carryStrength: 2,   // counts as 2 for carrying
    immunity: ['electric'],
    bonuses: { carry: 30 },
    description: 'Double carry strength. Electric immune.',
  },
};

class Pikmin extends Entity {
  constructor(x, y, typeKey = 'red', rules = null) {
    super(x, y);
    const t = PIKMIN_TYPES[typeKey] || PIKMIN_TYPES.red;
    this.typeKey       = typeKey;
    this.typeLabel     = t.label;
    this.color         = t.color;
    this.stemColor     = t.stemColor;
    this.flowerColor   = t.flowerColor;
    this.radius        = t.radius;
    this.baseSpeed     = t.baseSpeed;
    this.attackDamage  = t.attackDamage;
    this.attackRange   = t.attackRange;
    this.attackCooldown = t.attackCooldown;
    this.attackTimer   = 0;
    this.carryStrength = t.carryStrength;
    this.immunity      = t.immunity;
    this.typeBonuses   = t.bonuses;

    this.hp      = 10;
    this.maxHp   = 10;
    this.state   = PIKMIN_STATE.WANDER;
    this.target  = null;     // enemy or treasure
    this.carrying = null;    // treasure being carried
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
    this.animPhase = Math.random() * Math.PI * 2;
    this.flashTimer = 0;
    this.nearbyPikmin = [];

    // Behavior rules (set externally)
    this.rules = rules || {
      priorities: ['attack', 'carry', 'follow', 'retreat'],
      aggression: 50,
      fear: 30,
      teamwork: 60,
      detectionRange: 80,
      typeBonus: {},
    };

    this._speed = this.baseSpeed;
    this._updateSpeedFromRules();
  }

  get speed() { return this._speed; }

  _updateSpeedFromRules() {
    let s = this.baseSpeed;
    if (this.typeKey === 'blue' && this.rules.typeBonus?.blue?.speed) {
      s *= 1 + this.rules.typeBonus.blue.speed / 100;
    }
    this._speed = s;
  }

  get effectiveAggression() {
    let a = this.rules.aggression;
    if (this.typeKey === 'red' && this.rules.typeBonus?.red?.aggression) {
      a = clamp(a + this.rules.typeBonus.red.aggression, 0, 100);
    }
    return a;
  }

  get isAlone() {
    return this.nearbyPikmin.filter(p => p.alive).length < 2;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashTimer = 0.12;
    if (this.hp <= 0) this._die();
  }

  _die() {
    this.state = PIKMIN_STATE.DEAD;
    this.alive = false;
    if (this.carrying) {
      this.carrying.removeCarrier(this);
      this.carrying = null;
    }
    Bus.emit(EVT.PIKMIN_DIED, { pikmin: this });
    Bus.emit(EVT.LOG, { msg: `${this.typeLabel} Pikmin was lost!`, type: 'death' });
  }

  update(dt, enemies, treasures, base, leader) {
    if (!this.alive) return;
    this.animPhase  += dt * 4;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.flashTimer  = Math.max(0, this.flashTimer - dt);
    this._updateSpeedFromRules();

    // ── FSM driven by priority rules ────────────────────────────────────────
    const prios = this.rules.priorities;
    const detRange = this.rules.detectionRange;
    const fear = this.rules.fear;

    // If carrying, continue carrying
    if (this.state === PIKMIN_STATE.CARRYING) {
      if (!this.carrying || !this.carrying.alive) {
        this.carrying = null;
        this.state = PIKMIN_STATE.WANDER;
      }
      // Movement handled by treasure
      Entity.prototype.update.call(this, dt);
      return;
    }

    // Check fear / retreat
    const nearEnemy = this._nearest(enemies, e => e.alive && this.pos.dist(e.pos) < detRange * 0.8);
    if (nearEnemy && this.isAlone) {
      const retreatPriIdx = prios.indexOf('retreat');
      const attackPriIdx  = prios.indexOf('attack');
      const fearFactor = fear / 100;
      if (retreatPriIdx < attackPriIdx || fearFactor > 0.7 || this.hp / this.maxHp < fearFactor) {
        this.state = PIKMIN_STATE.FLEEING;
        this.target = nearEnemy;
        this._doFlee(dt, nearEnemy, enemies);
        return;
      }
    }

    // Priority loop
    let acted = false;
    for (const prio of prios) {
      if (acted) break;
      switch (prio) {
        case 'attack': acted = this._tryAttack(dt, enemies, detRange); break;
        case 'carry':  acted = this._tryCarry(dt, treasures, detRange); break;
        case 'follow': acted = this._tryFollow(dt, leader);             break;
        case 'retreat': /* handled above */                             break;
      }
    }

    if (!acted) {
      this.state = PIKMIN_STATE.WANDER;
      this._doWander(dt);
    }

    this.bounceWalls(this.rules.worldW || 800, this.rules.worldH || 600);
  }

  _tryAttack(dt, enemies, detRange) {
    const aggroMult = this.effectiveAggression / 50; // 1 = normal
    const range = detRange * aggroMult;

    const enemy = this._nearest(enemies, e => e.alive && this.pos.dist(e.pos) < range);
    if (!enemy) return false;

    this.state = PIKMIN_STATE.ATTACKING;
    this.target = enemy;

    // Move toward enemy
    if (this.pos.dist(enemy.pos) > this.attackRange + enemy.radius) {
      const sep = Steering.separation(this.pos, this.nearbyPikmin, 14, 60);
      const seek = Steering.seek(this.pos, this.vel, enemy.pos, this.speed, 150);
      this.applyForce(seek);
      this.applyForce(sep);
      this.vel = this.vel.limit(this.speed);
      Entity.prototype.update.call(this, dt);
    } else {
      // In range — attack!
      this.vel.scaleMut(0.85);
      Entity.prototype.update.call(this, dt);
      if (this.attackTimer <= 0) {
        this.attackTimer = this.attackCooldown;
        enemy.takeDamage(this.attackDamage);
      }
    }
    return true;
  }

  _tryCarry(dt, treasures, detRange) {
    // Find uncollected treasure that needs carriers
    const treas = this._nearest(
      treasures,
      t => t.alive && !t.collected && !t.isFull && this.pos.dist(t.pos) < detRange * 1.5
    );
    if (!treas) return false;

    this.state = PIKMIN_STATE.CARRYING;

    if (this.pos.dist(treas.pos) > treas.radius + this.radius + 4) {
      const seek = Steering.arrive(this.pos, this.vel, treas.pos, this.speed, 150, 30);
      const sep  = Steering.separation(this.pos, this.nearbyPikmin, 14, 40);
      this.applyForce(seek);
      this.applyForce(sep);
      this.vel = this.vel.limit(this.speed);
      Entity.prototype.update.call(this, dt);
    } else {
      // Reached treasure
      treas.addCarrier(this);
      this.carrying = treas;
    }
    return true;
  }

  _tryFollow(dt, leader) {
    if (!leader) return false;
    this.state = PIKMIN_STATE.FOLLOWING;
    const offset = Vec2.random(20); // loose formation
    const target = leader.pos.add(offset);
    if (this.pos.dist(target) < 20) { this.vel.scaleMut(0.9); return true; }
    const seek = Steering.arrive(this.pos, this.vel, target, this.speed, 100, 40);
    const sep  = Steering.separation(this.pos, this.nearbyPikmin, 14, 60);
    this.applyForce(seek);
    this.applyForce(sep);
    this.vel = this.vel.limit(this.speed);
    Entity.prototype.update.call(this, dt);
    return true;
  }

  _doFlee(dt, enemy, allEnemies) {
    let fleeDir = Vec2.zero();
    for (const e of allEnemies) {
      if (!e.alive) continue;
      const d = this.pos.dist(e.pos);
      if (d < this.rules.detectionRange) {
        fleeDir.addMut(this.pos.sub(e.pos).normalize().scale(1 / Math.max(d, 1)));
      }
    }
    if (fleeDir.length() > 0) {
      const f = Steering.flee(this.pos, this.vel, this.pos.sub(fleeDir.normalize().scale(50)), this.speed * 1.3, 180);
      this.applyForce(f);
    }
    const sep = Steering.separation(this.pos, this.nearbyPikmin, 14, 40);
    this.applyForce(sep);
    this.vel = this.vel.limit(this.speed * 1.3);
    Entity.prototype.update.call(this, dt);
  }

  _doWander(dt) {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = randRange(0.5, 2);
      this.wanderAngle += (Math.random() - 0.5) * 1.5;
    }
    const desired = Vec2.fromAngle(this.wanderAngle, this.speed * 0.4);
    const steer = desired.sub(this.vel).limit(50);
    const sep   = Steering.separation(this.pos, this.nearbyPikmin, 14, 40);
    this.applyForce(steer);
    this.applyForce(sep);
    this.vel = this.vel.limit(this.speed * 0.5);
    Entity.prototype.update.call(this, dt);
  }

  _nearest(list, predicate) {
    let best = null, bestD = Infinity;
    for (const item of list) {
      if (predicate && !predicate(item)) continue;
      const d = this.pos.distSq(item.pos);
      if (d < bestD) { bestD = d; best = item; }
    }
    return best;
  }

  draw(ctx) {
    if (!this.alive) return;
    const x = this.pos.x;
    const y = this.pos.y;
    const r = this.radius;
    const bob = Math.sin(this.animPhase) * (this.state === PIKMIN_STATE.WANDER ? 1.5 : 2.5);

    // Stem
    ctx.beginPath();
    ctx.moveTo(x, y - r + bob);
    ctx.lineTo(x, y - r - 7 + bob);
    ctx.strokeStyle = this.stemColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Flower / bud on stem
    ctx.beginPath();
    ctx.arc(x, y - r - 8 + bob, 3, 0, Math.PI * 2);
    ctx.fillStyle = this.flowerColor;
    ctx.fill();

    // Shadow
    ctx.beginPath();
    ctx.ellipse(x, y + r - 1, r * 0.75, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // Body
    const flash = this.flashTimer > 0;
    ctx.beginPath();
    ctx.arc(x, y + bob * 0.3, r, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Eyes
    const eyeY = y + bob * 0.3 - r * 0.15;
    ctx.beginPath();
    ctx.arc(x - 2, eyeY, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 2, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();

    // State-based aura
    const stateAura = {
      [PIKMIN_STATE.ATTACKING]: 'rgba(255,74,74,0.15)',
      [PIKMIN_STATE.FLEEING]:   'rgba(150,150,255,0.15)',
      [PIKMIN_STATE.CARRYING]:  'rgba(255,221,74,0.1)',
    };
    if (stateAura[this.state]) {
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = stateAura[this.state];
      ctx.fill();
    }
  }
}
