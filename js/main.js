// ── main.js ───────────────────────────────────────────────────────────────────
// Entry point. Initializes the canvas, world, and UI.

(function () {
  const canvas = document.getElementById('game-canvas');
  const wrap   = document.getElementById('canvas-wrap');

  // Resize canvas to fill its container
  function resizeCanvas() {
    const toolbar  = document.getElementById('canvas-toolbar');
    const legend   = document.getElementById('canvas-legend');
    const tbH = toolbar?.offsetHeight || 0;
    const lgH = legend?.offsetHeight  || 0;
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight - tbH - lgH;
    if (window._world) window._world.resize(canvas.width, canvas.height);
  }

  // Create the world
  const world = new World(canvas);
  window._world = world; // expose for debugging

  // Create the UI and wire everything
  const ui = new UI(world);
  window._ui = ui;

  // Apply share link if present
  const sharedBuild = parseShareLink();
  if (sharedBuild) {
    // Apply shared rules
    if (sharedBuild.priorities) world.rules.priorities = sharedBuild.priorities;
    if (sharedBuild.aggression !== undefined) {
      world.rules.aggression = sharedBuild.aggression;
      document.getElementById('sl-aggression').value = sharedBuild.aggression;
      document.getElementById('val-aggression').textContent = sharedBuild.aggression;
    }
    if (sharedBuild.scenario) {
      const btn = document.querySelector(`[data-scenario="${sharedBuild.scenario}"]`);
      if (btn) btn.click();
    }
    Bus.emit(EVT.LOG, { msg: 'Shared build loaded!', type: 'info' });
  }

  // Initial resize
  resizeCanvas();
  world.step(); // draw initial frame

  // Resize observer
  const ro = new ResizeObserver(resizeCanvas);
  ro.observe(wrap);

  // Also handle window resize
  window.addEventListener('resize', resizeCanvas);

  // Keyboard shortcuts
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        world.running ? world.pause() : world.start();
        break;
      case 'r':
      case 'R':
        document.getElementById('btn-reset').click();
        break;
      case '.':
        if (!world.running) world.step();
        break;
      case '+':
      case '=': {
        const sp = document.getElementById('sl-speed');
        sp.value = Math.min(4, parseFloat(sp.value) + 0.25);
        sp.dispatchEvent(new Event('input'));
        break;
      }
      case '-': {
        const sp = document.getElementById('sl-speed');
        sp.value = Math.max(0.25, parseFloat(sp.value) - 0.25);
        sp.dispatchEvent(new Event('input'));
        break;
      }
    }
  });

  console.log(
    '%c🌿 PIKMIN AI SANDBOX%c loaded\n' +
    'Shortcuts: Space=Play/Pause | R=Reset | .=Step | +/-=Speed',
    'color:#4aff6a;font-weight:bold;font-size:14px',
    'color:#aaa'
  );
})();
