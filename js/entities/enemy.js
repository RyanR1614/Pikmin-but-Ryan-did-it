// ── Enemy ─────────────────────────────────────────────────────────────────────
// Enemy types with unique behaviors. Each enemy has state machine:
// patrol → chase → attack → retreat (low HP)

const ENEMY_TYPES = {
  bulborb: {
    name: 'Bulborb',
    color: '#cc3300',
    spotColor: '#ffffaa',
    radius: 18,
    hp: 60,
    maxHp: 60,
    speed: 55,
    attackDamage: 8,
    attackRange: 22,
    attackCooldown: 1.2,
    detectionRange: 100,
    value: 15,
    eats: true, // can eat/kill Pikmin instantly
  },
  wollywog: {
    name: 'Wollywog',
    color: '#5588aa',
    spotColor: '#88ccff',
    radius: 16,
    hp: 40,
    maxHp: 40,
    speed: 70,
    attackDamage: 6,
    attackRange: 18,
    attackCooldown: 0.9,
    detectionRange: 120,
    value: 10,
    eats: false,
  },
  sheargrub: {
    name: 'Sheargrub',
    color: '#886644',
    spotColor: '#ccaa77',
    radius: 10,
    hp: 20,
    maxHp: 20,
    speed: 80,
    attackDamage: 4,
    attackRange: 12,
    attackCooldown: 0.6,
    detectionRange: 90,
    value: 5,
    eats: false,
  },
};

const ENEMY_STATE = { PATROL: 'patrol', CHASE: 'chase', ATTACK: 'attack', RETREAT: 'retreat', DEAD: 'dead' };

class Enemy extends Entity {
  constructor(x, y, typeKey = 'bulborb') {
    super(x, y);
    const t = ENEMY_TYPES[typeKey] || ENEMY_TYPES.bulborb;
    this.typeKey      = typeKey;
    this.typeName     = t.name;
    this.color        = t.color;
    this.spotColor    = t.spotColor;
    this.radius       = t.radius;
    this.hp           = t.hp;
    this.maxHp        = t.maxHp;
    this.baseSpeed    = t.speed;
    this.speed        = t.speed;
    this.attackDamage = t.attackDamage;
    this.attackRange  = t.attackRange;
    this.attackCooldown = t.attackCooldown;
    this.attackTimer  = 0;
    this.detectionRange = t.detectionRange;
    this.dropValue    = t.value;
    this.eats         = t.eats;

    this.state        = ENEMY_STATE.PATROL;
    this.target       = null;
    this.patrolTarget = new Vec2(x, y);
    this.wanderAngle  = Math.random() * Math.PI * 2;
    this.patrolTimer  = 0;

    this.spawnX = x;
    this.spawnY = y;
    this.flashTimer = 0;
    this.animPhase = Math.random() * Math.PI * 2;
  }

  get isDead() { return this.hp <= 0; }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flashTimer = 0.15;
    if (this.hp <= 0) {
      this.state = ENEMY_STATE.DEAD;
      this.alive = false;
      Bus.emit(EVT.ENEMY_DIED, { enemy: this });
      Bus.emit(EVT.LOG, { msg: `${this.typeName} defeated!`, type: 'score' });
    }
  }

  update(dt, pikminList, worldW, worldH) {
    if (this.isDead) return;
    this.animPhase += dt * 3;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.flashTimer  = Math.max(0, this.flashTimer - dt);

    // FSM
    switch (this.state) {
      case ENEMY_STATE.PATROL: this._patrol(dt, pikminList, worldW, worldH); break;
      case ENEMY_STATE.CHASE:  this._chase(dt, pikminList, worldW, worldH);  break;
      case ENEMY_STATE.ATTACK: this._attack(dt, pikminList);                  break;
      case ENEMY_STATE.RETREAT: this._retreat(dt, worldW, worldH);            break;
    }

    this.bounceWalls(worldW, worldH);
  }

  _patrol(dt, pikminList, w, h) {
    // Find nearest Pikmin
    const nearest = this._nearestPikmin(pikminList);
    if (nearest && this.pos.dist(nearest.pos) < this.detectionRange) {
      this.target = nearest;
      this.state = ENEMY_STATE.CHASE;
      return;
    }

    // Wander to patrol point
    this.patrolTimer -= dt;
    if (this.patrolTimer <= 0) {
      this.patrolTarget = new Vec2(
        randRange(this.radius, w - this.radius),
        randRange(this.radius, h - this.radius)
      );
      this.patrolTimer = randRange(2, 5);
    }

    const steer = Steering.arrive(this.pos, this.vel, this.patrolTarget, this.speed, 80, 30);
    this.applyForce(steer);
    this.vel = this.vel.limit(this.speed);
    Entity.prototype.update.call(this, dt);
  }

  _chase(dt, pikminList, w, h) {
    const nearest = this._nearestPikmin(pikminList);
    if (!nearest || this.pos.dist(nearest.pos) > this.detectionRange * 1.5) {
      this.target = null;
      this.state = ENEMY_STATE.PATROL;
      return;
    }
    this.target = nearest;

    if (this.pos.dist(nearest.pos) <= this.attackRange + nearest.radius) {
      this.state = ENEMY_STATE.ATTACK;
      return;
    }

    if (this.hp / this.maxHp < 0.25) {
      this.state = ENEMY_STATE.RETREAT;
      return;
    }

    const steer = Steering.seek(this.pos, this.vel, nearest.pos, this.speed, 120);
    this.applyForce(steer);
    this.vel = this.vel.limit(this.speed);
    Entity.prototype.update.call(this, dt);
  }

  _attack(dt, pikminList) {
    if (!this.target || !this.target.alive) {
      this.state = ENEMY_STATE.CHASE;
      return;
    }
    if (this.pos.dist(this.target.pos) > this.attackRange + this.target.radius + 5) {
      this.state = ENEMY_STATE.CHASE;
      return;
    }
    // Stop moving
    this.vel.scaleMut(0.8);
    Entity.prototype.update.call(this, dt);

    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      if (this.eats) {
        // Instantly kill one nearby Pikmin
        if (this.target.alive) {
          this.target.takeDamage(999);
          Bus.emit(EVT.LOG, { msg: `${this.typeName} ate a Pikmin!`, type: 'death' });
        }
      } else {
        this.target.takeDamage(this.attackDamage);
      }
    }
  }

  _retreat(dt, w, h) {
    // Move away from spawn toward edge
    const away = this.pos.sub(new Vec2(this.spawnX, this.spawnY)).normalize().scale(this.speed * 1.2);
    this.applyForce(away.sub(this.vel).limit(100));
    this.vel = this.vel.limit(this.speed * 1.2);
    Entity.prototype.update.call(this, dt);

    if (this.hp / this.maxHp > 0.4) this.state = ENEMY_STATE.PATROL;
  }

  _nearestPikmin(pikminList) {
    let best = null, bestD = Infinity;
    for (const p of pikminList) {
      if (!p.alive) continue;
      const d = this.pos.distSq(p.pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  draw(ctx) {
    if (!this.alive) return;
    const bob = Math.sin(this.animPhase) * 2;
    const x = this.pos.x, y = this.pos.y + bob;
    const r = this.radius;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(x, y + r + 2, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Body
    const flash = this.flashTimer > 0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = flash ? '#ffffff' : this.color;
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Eyes (spot pattern for bulborb-style)
    const eyeOff = r * 0.35;
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.arc(x + s * eyeOff, y - r * 0.2, r * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = this.spotColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + s * eyeOff, y - r * 0.2, r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = '#222';
      ctx.fill();
    }

    // State indicator
    const stateColors = {
      [ENEMY_STATE.PATROL]:  '#4a8aff',
      [ENEMY_STATE.CHASE]:   '#ffaa00',
      [ENEMY_STATE.ATTACK]:  '#ff4444',
      [ENEMY_STATE.RETREAT]: '#aaaaaa',
    };
    ctx.beginPath();
    ctx.arc(x, y - r - 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = stateColors[this.state] || '#fff';
    ctx.fill();

    // HP bar
    const bw = r * 2.5;
    const bx = x - bw / 2;
    const by = y - r - 14;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, 4);
    const hpPct = this.hp / this.maxHp;
    ctx.fillStyle = hpPct > 0.5 ? '#4aff6a' : hpPct > 0.25 ? '#ffdd4a' : '#ff4a4a';
    ctx.fillRect(bx, by, bw * hpPct, 4);
  }
}
