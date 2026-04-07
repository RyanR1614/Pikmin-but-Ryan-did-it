// ── Treasure ──────────────────────────────────────────────────────────────────
// Collectible items Pikmin carry back to base.

const TREASURE_TYPES = [
  { name: 'Crystal',    color: '#88eeff', weight: 1, value: 10, symbol: '💎', radius: 10 },
  { name: 'Gold Chunk', color: '#ffaa22', weight: 2, value: 20, symbol: '🪙', radius: 12 },
  { name: 'Artifact',   color: '#ff88cc', weight: 3, value: 35, symbol: '⚗️', radius: 14 },
  { name: 'Relic',      color: '#cc88ff', weight: 4, value: 50, symbol: '🏺', radius: 16 },
];

class Treasure extends Entity {
  constructor(x, y, typeIndex = null) {
    super(x, y);
    const t = TREASURE_TYPES[typeIndex !== null ? typeIndex : randInt(0, TREASURE_TYPES.length - 1)];
    this.name    = t.name;
    this.color   = t.color;
    this.weight  = t.weight;   // how many Pikmin needed to carry
    this.value   = t.value;
    this.symbol  = t.symbol;
    this.radius  = t.radius;
    this.carriers = [];        // Pikmin currently carrying this
    this.collected = false;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  get isFull() { return this.carriers.length >= this.weight; }

  addCarrier(pikmin) {
    if (!this.isFull && !this.carriers.includes(pikmin)) {
      this.carriers.push(pikmin);
    }
  }

  removeCarrier(pikmin) {
    this.carriers = this.carriers.filter(c => c !== pikmin);
  }

  update(dt, base) {
    this.pulsePhase += dt * 2;
    if (this.carriers.length === 0 || this.collected) return;

    // Move toward base proportional to carriers
    const speed = (this.carriers.length / this.weight) * 40;
    const dir = base.pos.sub(this.pos).normalize();
    this.pos.addMut(dir.scale(speed * dt));

    // Update carrier positions around treasure
    this.carriers.forEach((p, i) => {
      const angle = (i / this.carriers.length) * Math.PI * 2;
      const offset = Vec2.fromAngle(angle, this.radius + 6);
      p.pos.setMut(this.pos.add(offset));
      p.vel.scaleMut(0);
    });

    // Check if reached base
    if (this.pos.dist(base.pos) < base.radius + this.radius) {
      this.collected = true;
      this.alive = false;
      Bus.emit(EVT.TREASURE_COLLECTED, { treasure: this });
    }
  }

  draw(ctx, t) {
    if (!this.alive) return;
    const pulse = 0.8 + 0.2 * Math.sin(this.pulsePhase);

    // Glow ring
    const grd = ctx.createRadialGradient(this.pos.x, this.pos.y, 0, this.pos.x, this.pos.y, this.radius * 2 * pulse);
    grd.addColorStop(0, this.color + '55');
    grd.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius * 2 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = '#fff8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Carrier bar
    if (this.carriers.length > 0 && !this.collected) {
      const bw = this.radius * 2.5;
      const bh = 4;
      const bx = this.pos.x - bw / 2;
      const by = this.pos.y - this.radius - 10;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#4aff6a';
      ctx.fillRect(bx, by, bw * (this.carriers.length / this.weight), bh);
    }

    // Symbol / label
    ctx.font = `${this.radius}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol, this.pos.x, this.pos.y);
  }
}
