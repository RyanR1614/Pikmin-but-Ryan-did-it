// ── Scenarios ─────────────────────────────────────────────────────────────────
// Pre-built map configurations. Coordinates are normalized (0–1).

const SCENARIOS = {
  sandbox: {
    name: 'Free Sandbox',
    base: { x: 0.12, y: 0.5 },
    pikmin: { red: 6, blue: 6, yellow: 3 },
    enemies: [
      { x: 0.5,  y: 0.5,  type: 'sheargrub' },
      { x: 0.65, y: 0.3,  type: 'wollywog' },
    ],
    treasures: [
      { x: 0.45, y: 0.25, typeIndex: 0 },
      { x: 0.7,  y: 0.6,  typeIndex: 1 },
      { x: 0.55, y: 0.75, typeIndex: 2 },
      { x: 0.85, y: 0.4,  typeIndex: 0 },
    ],
  },

  'enemy-heavy': {
    name: 'Enemy Horde',
    base: { x: 0.1, y: 0.5 },
    pikmin: { red: 15, blue: 5, yellow: 5 },
    enemies: [
      { x: 0.4,  y: 0.2,  type: 'bulborb' },
      { x: 0.55, y: 0.5,  type: 'bulborb' },
      { x: 0.4,  y: 0.8,  type: 'bulborb' },
      { x: 0.7,  y: 0.3,  type: 'wollywog' },
      { x: 0.75, y: 0.7,  type: 'wollywog' },
      { x: 0.85, y: 0.5,  type: 'bulborb' },
      { x: 0.6,  y: 0.35, type: 'sheargrub' },
      { x: 0.6,  y: 0.65, type: 'sheargrub' },
    ],
    treasures: [
      { x: 0.9,  y: 0.5,  typeIndex: 3 },
      { x: 0.5,  y: 0.5,  typeIndex: 1 },
    ],
  },

  'treasure-rush': {
    name: 'Treasure Rush',
    base: { x: 0.5, y: 0.5 },
    pikmin: { red: 5, blue: 10, yellow: 10 },
    enemies: [
      { x: 0.15, y: 0.15, type: 'sheargrub' },
      { x: 0.85, y: 0.15, type: 'sheargrub' },
      { x: 0.15, y: 0.85, type: 'sheargrub' },
      { x: 0.85, y: 0.85, type: 'sheargrub' },
    ],
    treasures: [
      { x: 0.1,  y: 0.1,  typeIndex: 3 },
      { x: 0.9,  y: 0.1,  typeIndex: 3 },
      { x: 0.1,  y: 0.9,  typeIndex: 3 },
      { x: 0.9,  y: 0.9,  typeIndex: 3 },
      { x: 0.5,  y: 0.15, typeIndex: 2 },
      { x: 0.5,  y: 0.85, typeIndex: 2 },
      { x: 0.15, y: 0.5,  typeIndex: 2 },
      { x: 0.85, y: 0.5,  typeIndex: 2 },
      { x: 0.25, y: 0.25, typeIndex: 1 },
      { x: 0.75, y: 0.25, typeIndex: 1 },
      { x: 0.25, y: 0.75, typeIndex: 1 },
      { x: 0.75, y: 0.75, typeIndex: 1 },
    ],
  },

  limited: {
    name: 'Limited Squad',
    base: { x: 0.1, y: 0.5 },
    pikmin: { red: 2, blue: 2, yellow: 1 },
    enemies: [
      { x: 0.45, y: 0.4,  type: 'bulborb' },
      { x: 0.45, y: 0.6,  type: 'bulborb' },
      { x: 0.7,  y: 0.5,  type: 'wollywog' },
    ],
    treasures: [
      { x: 0.6,  y: 0.25, typeIndex: 2 },
      { x: 0.6,  y: 0.75, typeIndex: 2 },
      { x: 0.85, y: 0.5,  typeIndex: 3 },
    ],
  },
};
