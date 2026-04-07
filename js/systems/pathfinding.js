// ── Pathfinding / Steering ────────────────────────────────────────────────────
// Uses steering behaviors (seek, flee, separation) instead of grid pathfinding
// for smooth, natural-looking emergent movement.

class Steering {
  // Seek: steer toward a target position
  static seek(pos, vel, target, maxSpeed, maxForce) {
    const desired = target.sub(pos).normalize().scale(maxSpeed);
    return desired.sub(vel).limit(maxForce);
  }

  // Flee: steer away from a target position
  static flee(pos, vel, target, maxSpeed, maxForce) {
    const desired = pos.sub(target).normalize().scale(maxSpeed);
    return desired.sub(vel).limit(maxForce);
  }

  // Arrival: seek but slow down near target
  static arrive(pos, vel, target, maxSpeed, maxForce, slowRadius = 40) {
    const diff = target.sub(pos);
    const d = diff.length();
    if (d < 2) return vel.scale(-1).limit(maxForce); // brake
    const speed = d < slowRadius ? maxSpeed * (d / slowRadius) : maxSpeed;
    const desired = diff.normalize().scale(speed);
    return desired.sub(vel).limit(maxForce);
  }

  // Separation: avoid crowding neighbors
  static separation(pos, neighbors, desiredDist, maxForce) {
    let steer = Vec2.zero();
    let count = 0;
    for (const n of neighbors) {
      const d = pos.dist(n.pos);
      if (d > 0 && d < desiredDist) {
        const diff = pos.sub(n.pos).normalize().scale(1 / d);
        steer.addMut(diff);
        count++;
      }
    }
    if (count > 0) steer.scaleMut(1 / count);
    if (steer.length() > 0) steer = steer.normalize().scale(maxForce);
    return steer.limit(maxForce);
  }

  // Wander: smooth random wandering
  static wander(pos, vel, angle, maxSpeed, maxForce) {
    const circleRadius = 25;
    const circleDistance = 40;
    const angleChange = 0.4;
    // random angle delta
    const newAngle = angle + (Math.random() - 0.5) * angleChange * 2;
    const circleCenter = vel.length() > 0.01
      ? vel.normalize().scale(circleDistance)
      : Vec2.fromAngle(Math.random() * Math.PI * 2, circleDistance);
    const displacement = Vec2.fromAngle(newAngle, circleRadius);
    const target = pos.add(circleCenter).add(displacement);
    return { force: Steering.seek(pos, vel, target, maxSpeed, maxForce), angle: newAngle };
  }

  // Cohesion: move toward average position of neighbors
  static cohesion(pos, vel, neighbors, maxSpeed, maxForce) {
    if (!neighbors.length) return Vec2.zero();
    let avg = Vec2.zero();
    for (const n of neighbors) avg.addMut(n.pos);
    avg.scaleMut(1 / neighbors.length);
    return Steering.seek(pos, vel, avg, maxSpeed, maxForce);
  }
}

// Utility: clamp value
function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Utility: random range
function randRange(min, max) { return min + Math.random() * (max - min); }

// Utility: random int
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
