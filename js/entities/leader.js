// ── Base ──────────────────────────────────────────────────────────────────────
// The onion/base where Pikmin return treasures.

class Base extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 24;
    this.pulsePhase = 0;
  }

  update(dt) {
    this.pulsePhase += dt * 1.5;
  }

  draw(ctx) {
    const x = this.pos.x, y = this.pos.y;
    const pulse = 0.9 + 0.1 * Math.sin(this.pulsePhase);

    // Outer glow rings
    for (let i = 3; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(x, y, this.radius * (1 + i * 0.3) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74,255,106,${0.05 * i})`;
      ctx.fill();
    }

    // Main body (onion shape)
    ctx.beginPath();
    ctx.arc(x, y, this.radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, this.radius);
    grad.addColorStop(0, '#a0ff80');
    grad.addColorStop(1, '#2a8a2a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#4aff6a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#003300';
    ctx.fillText('BASE', x, y);
  }
}

// ── Leader ────────────────────────────────────────────────────────────────────
// An invisible leader entity that can be positioned by the user (click to move).
// Pikmin in "follow" mode track the leader.

class Leader extends Entity {
  constructor(x, y) {
    super(x, y);
    this.radius = 12;
    this.active = false;
    this.pulsePhase = 0;
  }

  update(dt) {
    this.pulsePhase += dt * 3;
  }

  draw(ctx) {
    if (!this.active) return;
    const x = this.pos.x, y = this.pos.y;
    const p = 0.7 + 0.3 * Math.sin(this.pulsePhase);

    ctx.beginPath();
    ctx.arc(x, y, this.radius * p, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,221,74,${0.6 + 0.4 * p})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👤', x, y);
  }
}
