// ── Renderer ──────────────────────────────────────────────────────────────────
// Handles all canvas rendering. Stateless — takes world snapshot each frame.

const Renderer = {
  _bgPattern: null,
  _tick: 0,

  render(ctx, w, h, world) {
    this._tick++;
    ctx.clearRect(0, 0, w, h);

    // Background
    this._drawBackground(ctx, w, h);

    // Base zone
    if (world.base) this._drawBaseZone(ctx, world.base);

    // Treasures (below entities)
    for (const t of world.treasures) t.draw(ctx, this._tick);

    // Enemies
    for (const e of world.enemies) e.draw(ctx);

    // Pikmin
    for (const p of world.pikmin) p.draw(ctx);

    // Base (on top of zone, below UI)
    if (world.base) world.base.draw(ctx);

    // Leader
    if (world.leader) world.leader.draw(ctx);

    // HUD overlay
    this._drawHUD(ctx, w, h, world);
  },

  _drawBackground(ctx, w, h) {
    // Deep forest floor gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0e1a0e');
    grad.addColorStop(1, '#0a100a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle grid (terrain lines)
    ctx.strokeStyle = 'rgba(74,255,106,0.04)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Random flora dots (static, drawn once based on tick=0 conceptually)
    // We'll skip truly static elements for simplicity — canvas redraws every frame
  },

  _drawBaseZone(ctx, base) {
    const pulse = 0.8 + 0.2 * Math.sin(this._tick * 0.03);
    const r = base.radius * 3.5 * pulse;

    const grd = ctx.createRadialGradient(base.pos.x, base.pos.y, 0, base.pos.x, base.pos.y, r);
    grd.addColorStop(0, 'rgba(74,255,106,0.08)');
    grd.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(base.pos.x, base.pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // Dashed ring
    ctx.beginPath();
    ctx.arc(base.pos.x, base.pos.y, base.radius + 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(74,255,106,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  _drawHUD(ctx, w, h, world) {
    // Pikmin state mini-legend (top left)
    const states = {};
    for (const p of world.pikmin) {
      states[p.state] = (states[p.state] || 0) + 1;
    }

    const stateColors = {
      wander:    '#aaaaaa',
      attacking: '#ff4a4a',
      carrying:  '#ffdd4a',
      fleeing:   '#8888ff',
      following: '#4a8aff',
    };

    let sy = 12;
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    for (const [state, count] of Object.entries(states)) {
      ctx.fillStyle = stateColors[state] || '#fff';
      ctx.fillRect(10, sy, 8, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${state}: ${count}`, 22, sy + 7);
      sy += 14;
    }

    // Elapsed time (top right corner — mirrored in header)
    // Additional contextual info
    if (world.pikmin.length === 0 && world.elapsed > 1) {
      ctx.font = 'bold 28px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,74,74,0.9)';
      ctx.fillText('ALL PIKMIN LOST', w / 2, h / 2);
    }

    if (world.treasures.length === 0 && world.enemies.length === 0 && world.elapsed > 1) {
      ctx.font = 'bold 28px "Orbitron", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(74,255,106,0.9)';
      ctx.fillText('MISSION COMPLETE!', w / 2, h / 2);
    }
  },
};
