// ── Vector2 ───────────────────────────────────────────────────────────────────
// Lightweight 2D vector math used throughout the simulation.

class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }

  clone()              { return new Vec2(this.x, this.y); }
  add(v)               { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v)               { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s)             { return new Vec2(this.x * s, this.y * s); }
  dot(v)               { return this.x * v.x + this.y * v.y; }
  lengthSq()           { return this.x * this.x + this.y * this.y; }
  length()             { return Math.sqrt(this.lengthSq()); }
  distSq(v)            { return this.sub(v).lengthSq(); }
  dist(v)              { return Math.sqrt(this.distSq(v)); }
  normalize() {
    const l = this.length();
    return l > 0 ? this.scale(1 / l) : new Vec2(0, 0);
  }
  limit(max) {
    const l = this.length();
    return l > max ? this.scale(max / l) : this.clone();
  }
  addMut(v)  { this.x += v.x; this.y += v.y; return this; }
  subMut(v)  { this.x -= v.x; this.y -= v.y; return this; }
  scaleMut(s){ this.x *= s;   this.y *= s;   return this; }
  setMut(v)  { this.x = v.x; this.y = v.y;  return this; }

  static random(mag = 1) {
    const a = Math.random() * Math.PI * 2;
    return new Vec2(Math.cos(a) * mag, Math.sin(a) * mag);
  }
  static fromAngle(a, mag = 1) { return new Vec2(Math.cos(a) * mag, Math.sin(a) * mag); }
  static lerp(a, b, t)         { return a.add(b.sub(a).scale(t)); }
  static zero()                { return new Vec2(0, 0); }
}
