// ── World ─────────────────────────────────────────────────────────────────────
// Manages all entities, runs the simulation loop, and tracks game state.

class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.width  = canvas.width;
    this.height = canvas.height;

    this.running  = false;
    this.simSpeed = 1;
    this.elapsed  = 0;
    this.lastTime = 0;
    this.frameReq = null;

    // Entity lists
    this.pikmin    = [];
    this.enemies   = [];
    this.treasures = [];
    this.base      = null;
    this.leader    = null;

    // Stats
    this.stats = {
      pikminLost: 0,
      treasureCollected: 0,
      treasureValue: 0,
      enemiesKilled: 0,
      startTime: 0,
    };

    // Behavior rules (shared across Pikmin — updated live)
    this.rules = {
      priorities: ['attack', 'carry', 'follow', 'retreat'],
      aggression: 50,
      fear: 30,
      teamwork: 60,
      detectionRange: 80,
      worldW: 800,
      worldH: 600,
      typeBonus: {
        red:    { aggression: 20 },
        blue:   { speed: 15 },
        yellow: { carry: 30 },
      },
    };

    this._setupEvents();
  }

  resize(w, h) {
    this.width  = w;
    this.height = h;
    this.rules.worldW = w;
    this.rules.worldH = h;
  }

  _setupEvents() {
    Bus.on(EVT.PIKMIN_DIED,  () => { this.stats.pikminLost++; });
    Bus.on(EVT.ENEMY_DIED,   () => { this.stats.enemiesKilled++; });
    Bus.on(EVT.TREASURE_COLLECTED, ({ treasure }) => {
      this.stats.treasureCollected++;
      this.stats.treasureValue += treasure.value;
    });
  }

  loadScenario(scenario) {
    this.reset();
    this.base   = new Base(scenario.base.x * this.width, scenario.base.y * this.height);
    this.leader = new Leader(this.width / 2, this.height / 2);

    // Spawn Pikmin
    for (const [type, count] of Object.entries(scenario.pikmin)) {
      for (let i = 0; i < count; i++) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = randRange(20, 50);
        const x = clamp(this.base.pos.x + Math.cos(angle) * radius, 20, this.width  - 20);
        const y = clamp(this.base.pos.y + Math.sin(angle) * radius, 20, this.height - 20);
        this.pikmin.push(new Pikmin(x, y, type, this.rules));
      }
    }

    // Spawn Enemies
    for (const ep of scenario.enemies) {
      const x = ep.x * this.width;
      const y = ep.y * this.height;
      this.enemies.push(new Enemy(x, y, ep.type || 'bulborb'));
    }

    // Spawn Treasures
    for (const tp of scenario.treasures) {
      const x = tp.x * this.width;
      const y = tp.y * this.height;
      this.treasures.push(new Treasure(x, y, tp.typeIndex !== undefined ? tp.typeIndex : null));
    }

    Bus.emit(EVT.LOG, { msg: `Scenario loaded: ${scenario.name}`, type: 'info' });
  }

  applyUIRules(uiRules) {
    // Merge in live rules
    Object.assign(this.rules, uiRules);
    this.rules.typeBonus = uiRules.typeBonus || this.rules.typeBonus;
    // Push to all Pikmin
    for (const p of this.pikmin) {
      p.rules = this.rules;
    }
  }

  spawnFromUI(counts) {
    const existing = { red: 0, blue: 0, yellow: 0 };
    for (const p of this.pikmin) if (p.alive) existing[p.typeKey]++;

    for (const [type, desired] of Object.entries(counts)) {
      const diff = desired - (existing[type] || 0);
      if (diff > 0) {
        for (let i = 0; i < diff; i++) this._spawnPikmin(type);
      } else if (diff < 0) {
        let removed = 0;
        for (const p of this.pikmin) {
          if (p.alive && p.typeKey === type && removed < -diff) {
            p.alive = false; removed++;
          }
        }
      }
    }
    this.pikmin = this.pikmin.filter(p => p.alive || p.typeKey); // keep dead briefly for stats
  }

  _spawnPikmin(type) {
    const bx = this.base ? this.base.pos.x : this.width / 2;
    const by = this.base ? this.base.pos.y : this.height / 2;
    const a  = Math.random() * Math.PI * 2;
    const r  = randRange(25, 55);
    const x  = clamp(bx + Math.cos(a) * r, 20, this.width - 20);
    const y  = clamp(by + Math.sin(a) * r, 20, this.height - 20);
    this.pikmin.push(new Pikmin(x, y, type, this.rules));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.stats.startTime = performance.now() - this.elapsed * 1000;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
    Bus.emit(EVT.SIM_START);
  }

  pause() {
    this.running = false;
    if (this.frameReq) cancelAnimationFrame(this.frameReq);
    Bus.emit(EVT.SIM_PAUSE);
  }

  step() {
    this._tick(1 / 60);
    this._render();
  }

  reset() {
    this.pause();
    this.pikmin    = [];
    this.enemies   = [];
    this.treasures = [];
    this.base      = null;
    this.leader    = null;
    this.elapsed   = 0;
    this.stats     = { pikminLost: 0, treasureCollected: 0, treasureValue: 0, enemiesKilled: 0, startTime: 0 };
    Bus.emit(EVT.SIM_RESET);
  }

  _loop(timestamp) {
    if (!this.running) return;
    const raw = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.min(raw * this.simSpeed, 0.1); // cap delta
    this.elapsed += raw;

    this._tick(dt);
    this._render();

    this._checkEndCondition();

    this.frameReq = requestAnimationFrame(ts => this._loop(ts));
  }

  _tick(dt) {
    if (this.base)   this.base.update(dt);
    if (this.leader) this.leader.update(dt);

    // Build spatial proximity for Pikmin separation
    for (const p of this.pikmin) {
      if (!p.alive) continue;
      p.nearbyPikmin = this.pikmin.filter(o => o !== p && o.alive && p.pos.distSq(o.pos) < 900);
    }

    // Update Pikmin
    for (const p of this.pikmin) {
      if (!p.alive) continue;
      p.update(dt, this.enemies, this.treasures, this.base, this.leader?.active ? this.leader : null);
    }

    // Update Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.pikmin, this.width, this.height);
    }

    // Update Treasures
    for (const t of this.treasures) {
      if (!t.alive) continue;
      t.update(dt, this.base);
    }

    // Cleanup dead entities
    this.pikmin    = this.pikmin.filter(p => p.alive);
    this.enemies   = this.enemies.filter(e => e.alive);
    this.treasures = this.treasures.filter(t => t.alive);
  }

  _render() {
    Renderer.render(this.ctx, this.width, this.height, {
      base: this.base,
      leader: this.leader,
      pikmin: this.pikmin,
      enemies: this.enemies,
      treasures: this.treasures,
      elapsed: this.elapsed,
      stats: this.stats,
    });
  }

  _checkEndCondition() {
    const allTreasuresGone = this.treasures.length === 0;
    const allPikminGone    = this.pikmin.length === 0;
    const allEnemiesGone   = this.enemies.length === 0;

    if (allTreasuresGone && allEnemiesGone) {
      this.pause();
      Bus.emit(EVT.SIM_END, { reason: 'complete', stats: this.stats, elapsed: this.elapsed });
    } else if (allPikminGone && this.pikmin.length === 0 && this.elapsed > 2) {
      this.pause();
      Bus.emit(EVT.SIM_END, { reason: 'wipe', stats: this.stats, elapsed: this.elapsed });
    }
  }

  getLiveStats() {
    return {
      pikminAlive: this.pikmin.filter(p => p.alive).length,
      pikminLost:  this.stats.pikminLost,
      treasureLeft: this.treasures.filter(t => t.alive).length,
      treasureCollected: this.stats.treasureCollected,
      treasureValue: this.stats.treasureValue,
      enemiesLeft:  this.enemies.filter(e => e.alive).length,
      enemiesKilled: this.stats.enemiesKilled,
      elapsed: this.elapsed,
    };
  }

  setLeaderPos(x, y) {
    if (this.leader) {
      this.leader.pos.x = x;
      this.leader.pos.y = y;
      this.leader.active = true;
    }
  }

  computeEfficiency(elapsed) {
    const treasurePts = this.stats.treasureValue * 10;
    const survivorPts = this.pikmin.filter(p => p.alive).length * 5;
    const timePenalty = Math.floor(elapsed / 10);
    const lossPenalty = this.stats.pikminLost * 3;
    return Math.max(0, treasurePts + survivorPts - timePenalty - lossPenalty);
  }
}
