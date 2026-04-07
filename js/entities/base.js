// ── Entity (Base Class) ───────────────────────────────────────────────────────
// All simulation objects extend this.

let _entityId = 0;

class Entity {
  constructor(x, y) {
    this.id   = ++_entityId;
    this.pos  = new Vec2(x, y);
    this.vel  = Vec2.zero();
    this.acc  = Vec2.zero();
    this.alive = true;
    this.radius = 8;
  }

  applyForce(force) { this.acc.addMut(force); }

  update(dt) {
    this.vel.addMut(this.acc.scale(dt));
    this.pos.addMut(this.vel.scale(dt));
    this.acc.scaleMut(0); // reset acceleration
  }

  // Bounce off canvas bounds
  bounceWalls(w, h) {
    const r = this.radius;
    if (this.pos.x < r)     { this.pos.x = r;     this.vel.x *= -0.5; }
    if (this.pos.x > w - r) { this.pos.x = w - r; this.vel.x *= -0.5; }
    if (this.pos.y < r)     { this.pos.y = r;     this.vel.y *= -0.5; }
    if (this.pos.y > h - r) { this.pos.y = h - r; this.vel.y *= -0.5; }
  }

  distanceTo(other) { return this.pos.dist(other.pos); }
  overlaps(other)   { return this.distanceTo(other) < this.radius + other.radius; }
}
