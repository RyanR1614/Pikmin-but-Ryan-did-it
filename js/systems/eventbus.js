// ── EventBus ──────────────────────────────────────────────────────────────────
// Simple publish/subscribe system for decoupled module communication.

class EventBus {
  constructor() { this._listeners = {}; }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn); // returns unsubscribe fn
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(fn => fn(data));
  }

  clear() { this._listeners = {}; }
}

// Global singleton
const Bus = new EventBus();

// Event name constants
const EVT = {
  PIKMIN_DIED:    'pikmin:died',
  PIKMIN_BORN:    'pikmin:born',
  ENEMY_DIED:     'enemy:died',
  TREASURE_COLLECTED: 'treasure:collected',
  SIM_START:      'sim:start',
  SIM_PAUSE:      'sim:pause',
  SIM_RESET:      'sim:reset',
  SIM_END:        'sim:end',
  LOG:            'log',
};
