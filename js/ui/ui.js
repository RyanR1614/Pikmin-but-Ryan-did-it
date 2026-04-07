// ── UI Controller ─────────────────────────────────────────────────────────────
// Wires up all DOM elements to the simulation World.

class UI {
  constructor(world) {
    this.world = world;
    this.currentScenario = 'sandbox';
    this._statsInterval = null;
    this._timerInterval = null;
    this._bind();
    this._setupEventBus();
    this._setupDragPriority();
    this._setupCanvasInteraction();
  }

  _bind() {
    // Sim controls
    this._el('btn-play').addEventListener('click',  () => this._play());
    this._el('btn-pause').addEventListener('click', () => this._pause());
    this._el('btn-step').addEventListener('click',  () => this._step());
    this._el('btn-reset').addEventListener('click', () => this._reset());

    // Speed
    const spSlider = this._el('sl-speed');
    spSlider.addEventListener('input', () => {
      this.world.simSpeed = parseFloat(spSlider.value);
      this._el('val-speed').textContent = `${spSlider.value}×`;
    });

    // Sliders → live update rules
    const sliders = [
      ['sl-aggression',  'val-aggression',  v => ({ aggression: +v })],
      ['sl-fear',        'val-fear',        v => ({ fear: +v })],
      ['sl-teamwork',    'val-teamwork',    v => ({ teamwork: +v })],
      ['sl-detection',   'val-detection',   v => ({ detectionRange: +v })],
    ];
    for (const [id, valId, ruleFn] of sliders) {
      this._el(id).addEventListener('input', e => {
        this._el(valId).textContent = e.target.value;
        this.world.applyUIRules({ ...this.world.rules, ...ruleFn(e.target.value) });
      });
    }

    // Type-specific sliders
    this._el('sl-red-agg').addEventListener('input', e => {
      this._el('val-red-agg').textContent = (e.target.value >= 0 ? '+' : '') + e.target.value + '%';
      this.world.rules.typeBonus.red = { aggression: +e.target.value };
    });
    this._el('sl-blue-spd').addEventListener('input', e => {
      this._el('val-blue-spd').textContent = (e.target.value >= 0 ? '+' : '') + e.target.value + '%';
      this.world.rules.typeBonus.blue = { speed: +e.target.value };
    });
    this._el('sl-yellow-rng').addEventListener('input', e => {
      this._el('val-yellow-rng').textContent = (e.target.value >= 0 ? '+' : '') + e.target.value + '%';
      this.world.rules.typeBonus.yellow = { carry: +e.target.value };
    });

    // Pikmin count sliders
    ['red', 'blue', 'yellow'].forEach(type => {
      this._el(`sl-${type}-count`).addEventListener('change', e => {
        this._el(`val-${type}-count`).textContent = e.target.value;
        // Only apply immediately if simulation not running
        if (!this.world.running) {
          const counts = this._getPikminCounts();
          this.world.spawnFromUI(counts);
        }
      });
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
    this._el('btn-share').addEventListener('click',  () => this._showShareModal());
    this._el('btn-help').addEventListener('click',   () => this._showHelpModal());

    // Modal close
    this._el('modal-close').addEventListener('click', () => this._closeModal());
    this._el('modal-overlay').addEventListener('click', e => {
      if (e.target === this._el('modal-overlay')) this._closeModal();
    });

    // Initial load
    this._loadScenario(this.currentScenario);
  }

  _setupEventBus() {
    Bus.on(EVT.LOG, ({ msg, type }) => this._log(msg, type));
    Bus.on(EVT.SIM_START, () => {
      this._el('btn-play').disabled  = true;
      this._el('btn-pause').disabled = false;
      this._el('btn-step').disabled  = true;
      this._startStatsTick();
    });
    Bus.on(EVT.SIM_PAUSE, () => {
      this._el('btn-play').disabled  = false;
      this._el('btn-pause').disabled = true;
      this._el('btn-step').disabled  = false;
    });
    Bus.on(EVT.SIM_RESET, () => {
      this._el('btn-play').disabled  = false;
      this._el('btn-pause').disabled = true;
      this._el('btn-step').disabled  = true;
      this._stopStatsTick();
      this._el('timer-display').textContent = '00:00';
      this._clearStats();
      this._el('results-panel').style.display = 'none';
    });
    Bus.on(EVT.SIM_END, ({ reason, stats, elapsed }) => {
      this._showResults(reason, stats, elapsed);
    });
  }

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
        if (after) list.insertBefore(dragged, over.nextSibling);
        else        list.insertBefore(dragged, over);
      }
    });
    list.addEventListener('dragleave', e => {
      const over = e.target.closest('.priority-item');
      if (over) over.classList.remove('drag-over');
    });
    list.addEventListener('drop', e => {
      e.preventDefault();
      document.querySelectorAll('.priority-item').forEach(el => el.classList.remove('drag-over'));
    });
  }

  _updatePriorityRules() {
    const items = document.querySelectorAll('.priority-item');
    const prios = Array.from(items).map(el => el.dataset.priority);
    this.world.applyUIRules({ ...this.world.rules, priorities: prios });
  }

  _setupCanvasInteraction() {
    const canvas = this._el('game-canvas');
    canvas.addEventListener('click', e => {
      if (!this.world.running) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.world.setLeaderPos(x, y);
    });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (this.world.leader) this.world.leader.active = false;
    });
  }

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

  _reset() {
    this._loadScenario(this.currentScenario);
  }

  _loadScenario(key) {
    const scenario = SCENARIOS[key];
    if (!scenario) return;
    this.world.reset();
    this.world.loadScenario(scenario);

    // Sync UI sliders to scenario pikmin counts
    const counts = scenario.pikmin || {};
    if (counts.red    !== undefined) { this._el('sl-red-count').value    = counts.red;    this._el('val-red-count').textContent    = counts.red; }
    if (counts.blue   !== undefined) { this._el('sl-blue-count').value   = counts.blue;   this._el('val-blue-count').textContent   = counts.blue; }
    if (counts.yellow !== undefined) { this._el('sl-yellow-count').value = counts.yellow; this._el('val-yellow-count').textContent = counts.yellow; }

    this.world.applyUIRules(this.world.rules);
    this.world.step(); // render one frame
    this._log(`Loaded: ${scenario.name}`, 'info');
  }

  _getPikminCounts() {
    return {
      red:    parseInt(this._el('sl-red-count').value),
      blue:   parseInt(this._el('sl-blue-count').value),
      yellow: parseInt(this._el('sl-yellow-count').value),
    };
  }

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
    this._el('stat-pikmin-lost').textContent  = s.pikminLost;
    this._el('stat-treasure').textContent     = s.treasureCollected;
    this._el('stat-enemies').textContent      = s.enemiesLeft;
    this._el('stat-value').textContent        = s.treasureValue;
    const eff = this.world.computeEfficiency(s.elapsed);
    this._el('stat-efficiency').textContent   = eff;
  }

  _updateTimer() {
    const s = this.world.elapsed;
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    this._el('timer-display').textContent = `${mm}:${ss}`;
  }

  _clearStats() {
    ['stat-pikmin-alive','stat-pikmin-lost','stat-treasure','stat-enemies'].forEach(id => {
      this._el(id).textContent = '0';
    });
    this._el('stat-efficiency').textContent = '—';
    this._el('stat-value').textContent = '0';
  }

  _log(msg, type = 'info') {
    const log = this._el('event-log');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    const now = new Date();
    entry.textContent = `[${String(now.getSeconds()).padStart(2,'0')}] ${msg}`;
    log.prepend(entry);
    // Trim old entries
    while (log.children.length > 30) log.removeChild(log.lastChild);
  }

  _showResults(reason, stats, elapsed) {
    this._stopStatsTick();
    this._updateTimer();

    const panel = this._el('results-panel');
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(Math.floor(elapsed % 60)).padStart(2, '0');
    const eff = this.world.computeEfficiency(elapsed);

    const title = reason === 'complete' ? '🏆 MISSION COMPLETE' : '💀 SQUAD WIPED';
    const titleColor = reason === 'complete' ? '#4aff6a' : '#ff4a4a';

    panel.style.display = 'block';
    panel.querySelector('.panel-title').textContent = title;
    panel.querySelector('.panel-title').style.color = titleColor;

    this._el('results-content').innerHTML = `
      <div class="result-score" style="color:${titleColor}">${eff}</div>
      <div style="text-align:center;color:#6a8a6a;font-size:10px;margin-bottom:8px">EFFICIENCY SCORE</div>
      <div class="result-row"><span>Time</span><span>${mm}:${ss}</span></div>
      <div class="result-row"><span>Treasure Collected</span><span style="color:#ffaa22">${stats.treasureCollected}</span></div>
      <div class="result-row"><span>Treasure Value</span><span style="color:#ffaa22">${stats.treasureValue}</span></div>
      <div class="result-row"><span>Enemies Defeated</span><span style="color:#4aff6a">${stats.enemiesKilled}</span></div>
      <div class="result-row"><span>Pikmin Lost</span><span style="color:#ff4a4a">${stats.pikminLost}</span></div>
      <br/>
      <button class="btn btn-primary" onclick="document.querySelector('#btn-reset').click()" style="width:100%">↺ Try Again</button>
    `;
  }

  _showPresetModal() {
    this._el('modal-content').innerHTML = `
      <h2>📋 SCENARIO PRESETS</h2>
      <p>Choose a scenario to load it instantly:</p>
      ${Object.entries(SCENARIOS).map(([key, sc]) => `
        <div style="margin-bottom:8px">
          <button class="btn btn-secondary" style="width:100%;text-align:left;padding:10px" 
            onclick="document.querySelector('[data-scenario=${key}]').click(); document.getElementById('modal-overlay').classList.add('hidden')">
            <strong>${sc.name}</strong><br/>
            <small style="opacity:0.6">${Object.values(sc.pikmin).reduce((a,b)=>a+b,0)} Pikmin · ${sc.enemies.length} Enemies · ${sc.treasures.length} Treasures</small>
          </button>
        </div>
      `).join('')}
    `;
    this._el('modal-overlay').classList.remove('hidden');
  }

  _showShareModal() {
    const rules = this.world.rules;
    const payload = {
      scenario: this.currentScenario,
      aggression: rules.aggression,
      fear: rules.fear,
      teamwork: rules.teamwork,
      detection: rules.detectionRange,
      priorities: rules.priorities,
    };
    const encoded = btoa(JSON.stringify(payload));
    const url = `${location.href.split('?')[0]}?build=${encoded}`;

    this._el('modal-content').innerHTML = `
      <h2>🔗 SHARE YOUR BUILD</h2>
      <p>Copy this link to share your current AI configuration:</p>
      <div class="share-box" onclick="this.select()">${url}</div>
      <br/>
      <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${url}').then(()=>this.textContent='Copied!').catch(()=>{})">
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
        <li><strong>⏸ Pause / ⏭ Step</strong> — Frame-by-frame control</li>
        <li><strong>↺ Reset</strong> — Reload current scenario</li>
        <li><strong>Click canvas</strong> — Move the leader (Pikmin in Follow mode track it)</li>
        <li><strong>Right-click canvas</strong> — Dismiss leader</li>
        <li><strong>Drag priorities</strong> — Reorder what Pikmin do first</li>
        <li><strong>Sliders</strong> — Adjust behavior live during simulation</li>
      </ul>
      <br/>
      <p><strong>Pikmin Types:</strong></p>
      <ul>
        <li>🔴 <strong>Red</strong> — High attack, fire immune</li>
        <li>🔵 <strong>Blue</strong> — Fastest carrier, water immune</li>
        <li>🟡 <strong>Yellow</strong> — Double carry strength, electric immune</li>
      </ul>
      <br/>
      <p><strong>Enemy States</strong> shown as colored dots above enemies:</p>
      <ul>
        <li>🔵 Patrolling &nbsp; 🟠 Chasing &nbsp; 🔴 Attacking &nbsp; ⬜ Retreating</li>
      </ul>
    `;
    this._el('modal-overlay').classList.remove('hidden');
  }

  _closeModal() {
    this._el('modal-overlay').classList.add('hidden');
  }

  _el(id) { return document.getElementById(id); }
}

// Parse share link on load
function parseShareLink() {
  const params = new URLSearchParams(location.search);
  const build = params.get('build');
  if (!build) return null;
  try { return JSON.parse(atob(build)); } catch { return null; }
}
