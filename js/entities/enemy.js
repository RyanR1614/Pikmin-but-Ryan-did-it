// ── Enemy ─────────────────────────────────────────────────────────────────────
// Enemy types: Bulborb, Wollywog, Sheargrub, Breadbug, Bulbmin

const ENEMY_TYPES = {
  bulborb: {
    name: 'Bulborb',
    color: '#cc3300',
    spotColor: '#ffffaa',
    radius: 18,
    hp: 60, maxHp: 60,
    speed: 55,
    attackDamage: 8,
    attackRange: 22,
    attackCooldown: 1.2,
    detectionRange: 100,
    value: 15,
    eats: true,
    stealsItems: false,
  },
  wollywog: {
    name: 'Wollywog',
    color: '#5588aa',
    spotColor: '#88ccff',
    radius: 16,
    hp: 40, maxHp: 40,
    speed: 70,
    attackDamage: 6,
    attackRange: 18,
    attackCooldown: 0.9,
    detectionRange: 120,
    value: 10,
    eats: false,
    stealsItems: false,
  },
  sheargrub: {
    name: 'Sheargrub',
    color: '#886644',
    spotColor: '#ccaa77',
    radius: 10,
    hp: 20, maxHp: 20,
    speed: 80,
    attackDamage: 4,
    attackRange: 12,
    attackCooldown: 0.6,
    detectionRange: 90,
    value: 5,
    eats: false,
    stealsItems: false,
  },
  breadbug: {
    name: 'Breadbug',
    color: '#cc6600',
    spotColor: '#ffaa44',
    radius: 10,
    hp: 25, maxHp: 25,
    speed: 95,
    attackDamage: 2,
    attackRange: 14,
    attackCooldown: 0.5,
    detectionRange: 110,
    value: 8,
    eats: false,
    stealsItems: true,
  },
  bulbmin: {
    name: 'Bulbmin',
    color: '#3355cc',
    spotColor: '#88aaff',
    radius: 22,
    hp: 90, maxHp: 90,
    speed: 42,
    attackDamage: 14,
    attackRange: 26,
    attackCooldown: 1.6,
    detectionRange: 130,
    value: 22,
    eats: true,
    stealsItems: false,
  },
};

const ENEMY_STATE = {
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  STEAL: 'steal',
  RETREAT: 'retreat',
  DEAD: 'dead',
};

class Enemy extends Entity {
  constructor(x, y, typeKey = 'bulborb') {
    super(x, y);
    const t = ENEMY_TYPES[typeKey] || ENEMY_TYPES.bulborb;
    this.typeKey = typeKey;
    this.typeName = t.name;
    this.color = t.color;
    this.spotColor = t.spotColor;
    this.radius = t.radius;
    this.hp = t.hp;
    this.maxHp = t.maxHp;
    this.baseSpeed = t.speed;
    this.speed = t.speed;
    this.attackDamage = t.attackDamage;
    this.attackRange = t.attackRange;
    this.attackCooldown = t.attackCooldown;
    this.attackTimer = 0;
    this.detectionRange = t.detectionRange;
    this.dropValue = t.value;
    this.eats = t.eats;
    this.stealsItems = t.stealsItems;

    this.state = ENEMY_STATE.PATROL;
    this.target = null;
    this.patrolTarget = new Vec2(x, y);
    this.patrolTimer = 0;
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

  // Live-edit stats from UI sliders
  applyCustomStats(stats) {
    if (stats.speed !== undefined) { this.speed = stats.speed; this.baseSpeed = stats.speed; }
    if (stats.hp !== undefined) { const pct = this.hp / this.maxHp; this.maxHp = stats.hp; this.hp = Math.round(pct * stats.hp); }
    if (stats.damage !== undefined) { this.attackDamage = stats.damage; }
  }

  update(dt, pikminList, treasures, worldW, worldH) {
    if (this.isDead) return;
    this.animPhase += dt * 3;
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);

    if (this.stealsItems) {
      this._updateBreadbug(dt, pikminList, treasures, worldW, worldH);
    } else {
      switch (this.state) {
        case ENEMY_STATE.PATROL: this._patrol(dt, pikminList, worldW, worldH); break;
        case ENEMY_STATE.CHASE: this._chase(dt, pikminList, worldW, worldH); break;
        case ENEMY_STATE.ATTACK: this._attack(dt, pikminList); break;
        case ENEMY_STATE.RETREAT: this._retreat(dt, worldW, worldH); break;
      }
    }
    this.bounceWalls(worldW, worldH);
  }

  _updateBreadbug(dt, pikminList, treasures, worldW, worldH) {
    const carriedTreasure = treasures.find(t => t.alive && !t.collected && t.carriers.length > 0);
    if (carriedTreasure) {
      this.state = ENEMY_STATE.STEAL;
      const dist = this.pos.dist(carriedTreasure.pos);
      if (dist > this.attackRange + carriedTreasure.radius) {
        const steer = Steering.seek(this.pos, this.vel, carriedTreasure.pos, this.speed, 150);
        this.applyForce(steer);
        this.vel = this.vel.limit(this.speed);
        Entity.prototype.update.call(this, dt);
      } else {
        if (this.attackTimer <= 0) {
          this.attackTimer = this.attackCooldown;
          carriedTreasure.carriers.forEach(p => {
            p.carrying = null;
            p.state = PIKMIN_STATE.WANDER;
          });
          carriedTreasure.carriers = [];
          Bus.emit(EVT.LOG, { msg: 'Breadbug snatched a treasure!', type: 'death' });
        }
        this.vel.scaleMut(0.8);
        Entity.prototype.update.call(this, dt);
      }
    } else {
      this.state = ENEMY_STATE.PATROL;
      this._patrol(dt, pikminList, worldW, worldH);
    }
  }

  _patrol(dt, pikminList, w, h) {
    const nearest = this._nearestPikmin(pikminList);
    if (nearest && this.pos.dist(nearest.pos) < this.detectionRange) {
      this.target = nearest;
      this.state = ENEMY_STATE.CHASE;
      return;
    }
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
    if (!this.target || !this.target.alive) { this.state = ENEMY_STATE.CHASE; return; }
    if (this.pos.dist(this.target.pos) > this.attackRange + this.target.radius + 5) {
      this.state = ENEMY_STATE.CHASE; return;
    }
    this.vel.scaleMut(0.8);
    Entity.prototype.update.call(this, dt);
    if (this.attackTimer <= 0) {
      this.attackTimer = this.attackCooldown;
      if (this.eats) {
        this.target.takeDamage(999);
        Bus.emit(EVT.LOG, { msg: `${this.typeName} ate a Pikmin!`, type: 'death' });
      } else {
        this.target.takeDamage(this.attackDamage);
      }
    }
  }

  _retreat(dt, w, h) {
    const away = this.pos.sub(new Vec2(this.spawnX, this.spawnY)).normalize().scale(this.speed * 1.2);
    this.applyForce(away.sub(this.vel).limit(100));
    this.vel = this.vel.limit(this.speed * 1.2);
    Entity.prototype.update.call(this, dt);
    if (this.hp / this.maxHp > 0.4) this.state = ENEMY_STATE.PATROL;
  }

  _nearestPikmin(list) {
    let best = null, bestD = Infinity;
    for (const p of list) {
      if (!p.alive) continue;
      const d = this.pos.distSq(p.pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  draw(ctx) {
    if (!this.alive) return;
    const bob = Math.sin(this.animPhase) * 2;
    const x = this.pos.x, y = this.pos.y + bob, r = this.radius;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(x, y + r + 2, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : this.color;
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Breadbug texture lines
    if (this.typeKey === 'breadbug') {
      ctx.strokeStyle = 'rgba(255,180,80,0.5)';
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, Math.PI * 0.2 * i, Math.PI * (0.2 * i + 0.5));
        ctx.stroke();
      }
    }

    // Bulbmin extra ring
    if (this.typeKey === 'bulbmin') {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,150,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Eyes
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

    // State dot
    const dotColor = {
      [ENEMY_STATE.PATROL]: '#4a8aff',
      [ENEMY_STATE.CHASE]: '#ffaa00',
      [ENEMY_STATE.ATTACK]: '#ff4444',
      [ENEMY_STATE.STEAL]: '#ffee00',
      [ENEMY_STATE.RETREAT]: '#aaaaaa',
    };
    ctx.beginPath();
    ctx.arc(x, y - r - 5, 3, 0, Math.PI * 2);
    ctx.fillStyle = dotColor[this.state] || '#fff';
    ctx.fill();

    // HP bar
    const bw = r * 2.5, bx = x - bw / 2, by = y - r - 14;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, 4);
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = pct > 0.5 ? '#4aff6a' : pct > 0.25 ? '#ffdd4a' : '#ff4a4a';
    ctx.fillRect(bx, by, bw * pct, 4);

    // Name tag for new types
    if (this.typeKey === 'breadbug' || this.typeKey === 'bulbmin') {
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(this.typeName, x, y - r - 19);
    }
  }
}