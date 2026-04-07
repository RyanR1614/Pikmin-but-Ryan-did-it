// ── UI Controller ─────────────────────────────────────────────────────────────
// Wires all DOM elements to the simulation World.

class UI {
  constructor(world) {
    this.world = world;
    this.currentScenario = 'sandbox';
    this._statsInterval = null;
    this._timerInterval = null;
    this._dragging = null;   // entity being dragged in edit mode
    this._bind();
    this._setupEventBus();
    this._setupDragPriority();
    this._setupCanvasInteraction();
  }

  // ── Bind all DOM elements ──────────────────────────────────────────────────
  _bind() {
    // Sim controls
    this._el('btn-play').addEventListener('click', () => this._play());
    this._el('btn-pause').addEventListener('click', () => this._pause());
    this._el('btn-step').addEventListener('click', () => this._step());
    this._el('btn-reset').addEventListener('click', () => this._reset());

    // Speed slider
    const spSlider = this._el('sl-speed');
    spSlider.addEventListener('input', () => {
      this.world.simSpeed = parseFloat(spSlider.value);
      this._el('val-speed').textContent = `${spSlider.value}×`;
    });

    // Global behavior sliders
    this._bindSlider('sl-aggression', 'val-aggression', v => ({ aggression: +v }));
    this._bindSlider('sl-fear', 'val-fear', v => ({ fear: +v }));
    this._bindSlider('sl-teamwork', 'val-teamwork', v => ({ teamwork: +v }));
    this._bindSlider('sl-detection', 'val-detection', v => ({ detectionRange: +v }));

    // Pikmin type bonuses
    this._el('sl-red-agg').addEventListener('input', e => {
      this._el('val-red-agg').textContent = this._signed(e.target.value) + '%';
      this.world.rules.typeBonus.red = { aggression: +e.target.value };
    });
    this._el('sl-blue-spd').addEventListener('input', e => {
      this._el('val-blue-spd').textContent = this._signed(e.target.value) + '%';
      this.world.rules.typeBonus.blue = { speed: +e.target.value };
    });
    this._el('sl-yellow-rng').addEventListener('input', e => {
      this._el('val-yellow-rng').textContent = this._signed(e.target.value) + '%';
      this.world.rules.typeBonus.yellow = { carry: +e.target.value };
    });
    this._el('sl-rock-atk').addEventListener('input', e => {
      this._el('val-rock-atk').textContent = this._signed(e.target.value) + '%';
      this.world.rules.typeBonus.rock = { attack: +e.target.value };
    });

    // Pikmin count sliders — only update counts when not running
    ['red', 'blue', 'yellow', 'rock'].forEach(type => {
      this._el(`sl-${type}-count`).addEventListener('change', e => {
        this._el(`val-${type}-count`).textContent = e.target.value;
        if (!this.world.running) this.world.spawnFromUI(this._getPikminCounts());
      });
    });

    // ── Enemy panel: Breadbug ────────────────────────────────────────────────
    this._el('sl-breadbug-count').addEventListener('change', e => {
      this._el('val-breadbug-count').textContent = e.target.value;
      if (!this.world.running) this.world.spawnEnemiesFromUI(this._getEnemyCounts());
    });
    this._el('sl-breadbug-speed').addEventListener('input', e => {
      this._el('val-breadbug-speed').textContent = e.target.value;
      this.world.updateEnemyCustomStats('breadbug', { speed: +e.target.value });
    });
    this._el('sl-breadbug-hp').addEventListener('input', e => {
      this._el('val-breadbug-hp').textContent = e.target.value;
      this.world.updateEnemyCustomStats('breadbug', { hp: +e.target.value });
    });

    // ── Enemy panel: Bulbmin ─────────────────────────────────────────────────
    this._el('sl-bulbmin-count').addEventListener('change', e => {
      this._el('val-bulbmin-count').textContent = e.target.value;
      if (!this.world.running) this.world.spawnEnemiesFromUI(this._getEnemyCounts());
    });
    this._el('sl-bulbmin-speed').addEventListener('input', e => {
      this._el('val-bulbmin-speed').textContent = e.target.value;
      this.world.updateEnemyCustomStats('bulbmin', { speed: +e.target.value });
    });
    this._el('sl-bulbmin-hp').addEventListener('input', e => {
      this._el('val-bulbmin-hp').textContent = e.target.value;
      this.world.updateEnemyCustomStats('bulbmin', { hp: +e.target.value });
    });

    // Scenario buttons
    document.querySelectorAll('.scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentScenario = btn.dataset.scenario;
        this._reset();
      });
    });

    // Header buttons
    this._el('btn-preset').addEventListener('click', () => this._showPresetModal());
    this._el('btn-share').addEventListener('click', () => this._showShareModal());
    this._el('btn-help').addEventListener('click', () => this._showHelpModal());

    // Modal close
    this._el('modal-close').addEventListener('click', () => this._closeModal());
    this._el('modal-overlay').addEventListener('click', e => {
      if (e.target === this._el('modal-overlay')) this._closeModal();
    });

    this._loadScenario(this.currentScenario);
  }

  _bindSlider(sliderId, valId, ruleFn) {
    this._el(sliderId).addEventListener('input', e => {
      this._el(valId).textContent = e.target.value;
      this.world.applyUIRules({ ...this.world.rules, ...ruleFn(e.target.value) });
    });
  }

  // ── EventBus listeners ─────────────────────────────────────────────────────
  _setupEventBus() {
    Bus.on(EVT.LOG, ({ msg, type }) => this._log(msg, type));
    Bus.on(EVT.SIM_START, () => {
      this._el('btn-play').disabled = true;
      this._el('btn-pause').disabled = false;
      this._el('btn-step').disabled = true;
      this._el('edit-hint').style.display = 'none';
      this._startStatsTick();
    });
    Bus.on(EVT.SIM_PAUSE, () => {
      this._el('btn-play').disabled = false;
      this._el('btn-pause').disabled = true;
      this._el('btn-step').disabled = false;
      if (this.currentScenario === 'sandbox') {
        this._el('edit-hint').style.display = 'block';
      }
    });
    Bus.on(EVT.SIM_RESET, () => {
      this._el('btn-play').disabled = false;
      this._el('btn-pause').disabled = true;
      this._el('btn-step').disabled = true;
      this._stopStatsTick();
      this._el('timer-display').textContent = '00:00';
      this._clearStats();
      this._el('results-panel').style.display = 'none';
      if (this.currentScenario === 'sandbox') {
        this._el('edit-hint').style.display = 'block';
      }
    });
    Bus.on(EVT.SIM_END, ({ reason, stats, elapsed }) => {
      this._showResults(reason, stats, elapsed);
    });
  }

  // ── Drag-to-reorder priority list ─────────────────────────────────────────
  _setupDragPriority() {
    const list = this._el('priority-list');
    let dragged = null;

    list.addEventListener('dragstart', e => {
      dragged = e.target;
      setTimeout(() => e.target.classList.add('dragging'), 0);
    });
    list.addEventListener('dragend', e => {
      e.target.classList.remove('dragging');
      dragged = null;
      this._updatePriorityRules();
    });
    list.addEventListener('dragover', e => {
      e.preventDefault();
      const over = e.target.closest('.priority-item');
      if (over && over !== dragged) {
        over.classList.add('drag-over');
        const rect = over.getBoundingClientRect();
        const after = e.clientY > rect.top + rect.height / 2;
        list.insertBefore(dragged, after ? over.nextSibling : over);
      }
    });
    list.addEventListener('dragleave', e => {
      e.target.closest?.('.priority-item')?.classList.remove('drag-over');
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      document.querySelectorAll('.priority-item').forEach(el => el.classList.remove('drag-over'));
    });
  }

  _updatePriorityRules() {
    const prios = Array.from(document.querySelectorAll('.priority-item')).map(el => el.dataset.priority);
    this.world.applyUIRules({ ...this.world.rules, priorities: prios });
  }

  // ── Canvas interaction: drag entities (edit mode) + leader (run mode) ──────
  _setupCanvasInteraction() {
    const canvas = this._el('game-canvas');

    canvas.addEventListener('mousedown', e => {
      const { x, y } = this._canvasXY(e);

      if (this.world.running) {
        // Running: click sets leader
        this.world.setLeaderPos(x, y);
        return;
      }

      // Paused: try to grab an entity to drag
      const hit = this.world.getEntityAt(x, y);
      if (hit) {
        this._dragging = hit;
        canvas.style.cursor = 'grabbing';
      }
    });

    canvas.addEventListener('mousemove', e => {
      const { x, y } = this._canvasXY(e);

      if (this.world.running) {
        // If mouse held during run, move leader continuously
        if (e.buttons === 1) this.world.setLeaderPos(x, y);
        return;
      }

      if (this._dragging) {
        // Move the dragged entity
        this._dragging.entity.pos.x = x;
        this._dragging.entity.pos.y = y;
        if (this._dragging.kind === 'enemy') {
          this._dragging.entity.spawnX = x;
          this._dragging.entity.spawnY = y;
          this._dragging.entity.patrolTarget = new Vec2(x, y);
        }
        this.world.step(); // redraw
        return;
      }

      // Hover cursor hint
      const hit = this.world.getEntityAt(x, y);
      canvas.style.cursor = hit ? 'grab' : 'crosshair';
    });

    canvas.addEventListener('mouseup', () => {
      this._dragging = null;
      canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('mouseleave', () => {
      this._dragging = null;
    });

    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.world.leader) this.world.leader.active = false;
    });
  }

  _canvasXY(e) {
    const rect = this._el('game-canvas').getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  // ── Simulation actions ─────────────────────────────────────────────────────
  _play() {
    if (!this.world.base) this._loadScenario(this.currentScenario);
    this.world.start();
  }

  _pause() { this.world.pause(); }
  _step() {
    if (!this.world.base) this._loadScenario(this.currentScenario);
    this.world.step();
    this._updateStats();
  }

  _reset() { this._loadScenario(this.currentScenario); }

  _loadScenario(key) {
    const scenario = SCENARIOS[key];
    if (!scenario) return;

    this.world.reset();
    this.world.loadScenario(scenario);

    // Sync pikmin count sliders
    const counts = scenario.pikmin || {};
    ['red', 'blue', 'yellow', 'rock'].forEach(t => {
      const v = counts[t] !== undefined ? counts[t] : 0;
      const sl = this._el(`sl-${t}-count`);
      const vl = this._el(`val-${t}-count`);
      if (sl) sl.value = v;
      if (vl) vl.textContent = v;
    });

    // Sync enemy count sliders from scenario
    const breadbugCount = (scenario.enemies || []).filter(e => e.type === 'breadbug').length;
    const bulbminCount = (scenario.enemies || []).filter(e => e.type === 'bulbmin').length;
    this._el('sl-breadbug-count').value = breadbugCount;
    this._el('val-breadbug-count').textContent = breadbugCount;
    this._el('sl-bulbmin-count').value = bulbminCount;
    this._el('val-bulbmin-count').textContent = bulbminCount;

    this.world.applyUIRules(this.world.rules);
    this.world.step();
    this._log(`Loaded: ${scenario.name}`, 'info');
  }

  // ── Data helpers ───────────────────────────────────────────────────────────
  _getPikminCounts() {
    return {
      red: parseInt(this._el('sl-red-count').value) || 0,
      blue: parseInt(this._el('sl-blue-count').value) || 0,
      yellow: parseInt(this._el('sl-yellow-count').value) || 0,
      rock: parseInt(this._el('sl-rock-count').value) || 0,
    };
  }

  _getEnemyCounts() {
    return {
      breadbug: parseInt(this._el('sl-breadbug-count').value) || 0,
      bulbmin: parseInt(this._el('sl-bulbmin-count').value) || 0,
    };
  }

  // ── Stats ticker ───────────────────────────────────────────────────────────
  _startStatsTick() {
    this._stopStatsTick();
    this._statsInterval = setInterval(() => this._updateStats(), 200);
    this._timerInterval = setInterval(() => this._updateTimer(), 500);
  }

  _stopStatsTick() {
    clearInterval(this._statsInterval);
    clearInterval(this._timerInterval);
  }

  _updateStats() {
    const s = this.world.getLiveStats();
    this._el('stat-pikmin-alive').textContent = s.pikminAlive;
    this._el('stat-pikmin-lost').textContent = s.pikminLost;
    this._el('stat-treasure').textContent = s.treasureCollected;
    this._el('stat-enemies').textContent = s.enemiesLeft;
    this._el('stat-value').textContent = s.treasureValue;
    this._el('stat-efficiency').textContent = this.world.computeEfficiency(s.elapsed);
  }

  _updateTimer() {
    const s = this.world.elapsed;
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    this._el('timer-display').textContent = `${mm}:${ss}`;
  }

  _clearStats() {
    ['stat-pikmin-alive', 'stat-pikmin-lost', 'stat-treasure', 'stat-enemies'].forEach(id => {
      this._el(id).textContent = '0';
    });
    this._el('stat-efficiency').textContent = '—';
    this._el('stat-value').textContent = '0';
  }

  // ── Event log ─────────────────────────────────────────────────────────────
  _log(msg, type = 'info') {
    const log = this._el('event-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const now = new Date();
    entry.textContent = `[${String(now.getSeconds()).padStart(2, '0')}] ${msg}`;
    log.prepend(entry);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  // ── Results panel ──────────────────────────────────────────────────────────
  _showResults(reason, stats, elapsed) {
    this._stopStatsTick();
    this._updateTimer();
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
    const eff = this.world.computeEfficiency(elapsed);
    const ok = reason === 'complete';
    const panel = this._el('results-panel');
    panel.style.display = 'block';
    panel.querySelector('.panel-title').textContent = ok ? '🏆 MISSION COMPLETE' : '💀 SQUAD WIPED';
    panel.querySelector('.panel-title').style.color = ok ? '#4aff6a' : '#ff4a4a';
    this._el('results-content').innerHTML = `
      <div class="result-score" style="color:${ok ? '#4aff6a' : '#ff4a4a'}">${eff}</div>
      <div style="text-align:center;color:#6a8a6a;font-size:10px;margin-bottom:8px">EFFICIENCY SCORE</div>
      <div class="result-row"><span>Time</span><span>${mm}:${ss}</span></div>
      <div class="result-row"><span>Treasure Collected</span><span style="color:#ffaa22">${stats.treasureCollected}</span></div>
      <div class="result-row"><span>Treasure Value</span><span style="color:#ffaa22">${stats.treasureValue}</span></div>
      <div class="result-row"><span>Enemies Defeated</span><span style="color:#4aff6a">${stats.enemiesKilled}</span></div>
      <div class="result-row"><span>Pikmin Lost</span><span style="color:#ff4a4a">${stats.pikminLost}</span></div>
      <br/>
      <button class="btn btn-primary" onclick="document.getElementById('btn-reset').click()" style="width:100%">↺ Try Again</button>
    `;
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  _showPresetModal() {
    this._el('modal-content').innerHTML = `
      <h2>📋 SCENARIO PRESETS</h2>
      <p>Choose a scenario to load it instantly:</p>
      ${Object.entries(SCENARIOS).map(([key, sc]) => `
        <div style="margin-bottom:8px">
          <button class="btn btn-secondary" style="width:100%;text-align:left;padding:10px"
            onclick="document.querySelector('[data-scenario=${key}]').click();document.getElementById('modal-overlay').classList.add('hidden')">
            <strong>${sc.name}</strong><br/>
            <small style="opacity:0.6">${Object.values(sc.pikmin).reduce((a, b) => a + b, 0)} Pikmin · ${sc.enemies.length} Enemies · ${sc.treasures.length} Treasures</small>
          </button>
        </div>
      `).join('')}
    `;
    this._el('modal-overlay').classList.remove('hidden');
  }

  _showShareModal() {
    const r = this.world.rules;
    const payload = {
      scenario: this.currentScenario,
      aggression: r.aggression,
      fear: r.fear,
      teamwork: r.teamwork,
      detection: r.detectionRange,
      priorities: r.priorities,
    };
    const url = `${location.href.split('?')[0]}?build=${btoa(JSON.stringify(payload))}`;
    this._el('modal-content').innerHTML = `
      <h2>🔗 SHARE YOUR BUILD</h2>
      <p>Copy this link to share your current AI configuration:</p>
      <div class="share-box">${url}</div>
      <br/>
      <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${url}').then(()=>this.textContent='Copied! ✓')">
        📋 Copy to Clipboard
      </button>
    `;
    this._el('modal-overlay').classList.remove('hidden');
  }

  _showHelpModal() {
    this._el('modal-content').innerHTML = `
      <h2>❓ HOW TO USE</h2>
      <ul>
        <li><strong>▶ Start</strong> — Run the simulation</li>
        <li><strong>⏸ / ⏭</strong> — Pause or step frame-by-frame</li>
        <li><strong>↺ Reset</strong> — Reload current scenario</li>
        <li><strong>Click canvas (running)</strong> — Move leader</li>
        <li><strong>Drag entities (paused)</strong> — Reposition base, enemies, treasure</li>
        <li><strong>Right-click canvas</strong> — Dismiss leader</li>
        <li><strong>Drag priorities</strong> — Reorder Pikmin behavior</li>
      </ul>
      <br/>
      <p><strong>Pikmin Types:</strong></p>
      <ul>
        <li>🔴 Red — High attack, fire immune</li>
        <li>🔵 Blue — Fastest carrier, water immune</li>
        <li>🟡 Yellow — Double carry strength, electric immune</li>
        <li>🪨 Rock — Crushing damage, immune to crush</li>
      </ul>
      <br/>
      <p><strong>Enemy Types:</strong></p>
      <ul>
        <li>🔴 Bulborb — Eats Pikmin instantly</li>
        <li>🔵 Wollywog — Fast chaser</li>
        <li>🟤 Sheargrub — Swarm attacker</li>
        <li>🟠 Breadbug — Steals carried treasure</li>
        <li>💙 Bulbmin — Huge, tanky, eats Pikmin</li>
      </ul>
      <br/>
      <p>Keyboard: <strong>Space</strong>=Play/Pause · <strong>R</strong>=Reset · <strong>.</strong>=Step · <strong>+/-</strong>=Speed</p>
    `;
    this._el('modal-overlay').classList.remove('hidden');
  }

  _closeModal() { this._el('modal-overlay').classList.add('hidden'); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  _el(id) { return document.getElementById(id); }
  _signed(v) { return v >= 0 ? `+${v}` : `${v}`; }
}

function parseShareLink() {
  const params = new URLSearchParams(location.search);
  const build = params.get('build');
  if (!build) return null;
  try { return JSON.parse(atob(build)); } catch { return null; }
}