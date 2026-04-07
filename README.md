# 🌿 Pikmin AI Sandbox

A browser-based Pikmin-inspired AI simulation sandbox where you can experiment with emergent behavior, enemy encounters, and treasure collection — all without touching any copyrighted assets.

---

## 🚀 Quick Start (VS Code)

### Option 1: Live Server (Recommended)

1. Open the `pikmin-sandbox` folder in VS Code
2. Install the **Live Server** extension (if not already installed):  
   → Search `ritwickdey.LiveServer` in Extensions
3. Right-click `index.html` → **"Open with Live Server"**
4. Your browser opens at `http://localhost:5500`

### Option 2: Python HTTP Server

```bash
cd pikmin-sandbox
python3 -m http.server 8080
# Then open http://localhost:8080
```

### Option 3: Node.js

```bash
cd pikmin-sandbox
npx serve .
# Then open the URL shown
```

> **Note:** The project has no build step — it's pure HTML/CSS/JS. Just serve the folder.

---

## 🎮 Controls

| Action | Control |
|---|---|
| Start / Pause | `Space` or buttons |
| Reset | `R` or button |
| Step (frame-by-frame) | `.` (period) while paused |
| Speed up / down | `+` / `-` |
| Move leader | `Click` on canvas |
| Dismiss leader | `Right-click` on canvas |

---

## 🧠 Features

- **3 Pikmin types** — Red (high attack), Blue (fast carry), Yellow (double carry strength)
- **3 Enemy types** — Bulborb (eats Pikmin), Wollywog (fast), Sheargrub (swarm)
- **Priority drag-and-drop** — Reorder what Pikmin do first
- **Live sliders** — Adjust aggression, fear, teamwork, detection range mid-simulation
- **4 Scenario presets** — Free Sandbox, Enemy Horde, Treasure Rush, Limited Squad
- **Shareable builds** — Click 🔗 Share to generate a URL with your AI config
- **Run metrics** — Efficiency score, treasure value, loss count
- **Event log** — Live feed of simulation events

---

## 📁 Project Structure

```
pikmin-sandbox/
├── index.html              # Entry point
├── css/
│   └── style.css           # All styles
├── js/
│   ├── main.js             # Bootstrap
│   ├── systems/
│   │   ├── vector.js       # Vec2 math
│   │   ├── pathfinding.js  # Steering behaviors
│   │   ├── eventbus.js     # Pub/sub
│   │   ├── world.js        # Simulation engine
│   │   └── renderer.js     # Canvas drawing
│   ├── entities/
│   │   ├── base.js         # Entity base class + Base + Leader
│   │   ├── pikmin.js       # Pikmin AI + state machine
│   │   ├── enemy.js        # Enemy AI + state machine
│   │   └── treasure.js     # Treasure carry system
│   ├── scenarios/
│   │   └── scenarios.js    # Preset map configs
│   └── ui/
│       └── ui.js           # DOM ↔ World wiring
└── .vscode/
    ├── launch.json
    └── settings.json
```

---

## ➕ Adding New Pikmin Types

In `js/entities/pikmin.js`, add an entry to `PIKMIN_TYPES`:

```js
purple: {
  label: 'Purple',
  color: '#aa44ff',
  stemColor: '#7722cc',
  flowerColor: '#cc88ff',
  radius: 9,
  baseSpeed: 50,
  attackDamage: 20,
  attackRange: 14,
  attackCooldown: 1.2,
  carryStrength: 10,
  immunity: [],
  bonuses: {},
  description: 'Slow but incredibly strong.',
},
```

Then add a count slider in `index.html` and wire it up in `ui.js`.

---

## 🌐 Deploying to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pikmin-sandbox.git
git push -u origin main
```

Then on GitHub:  
**Settings → Pages → Source: Deploy from branch `main` / `/ (root)`**

Your sandbox will be live at:  
`https://YOUR_USERNAME.github.io/pikmin-sandbox/`

---

## 📜 License

All graphics are original (colored shapes). No Nintendo/Pikmin assets are used.  
This is a fan-made educational project.
