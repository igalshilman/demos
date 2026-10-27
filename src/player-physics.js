// Deterministic, render-free platforming physics.
// +Y is up. The player is an upright box (radius = half-width) whose origin is
// the centre of its feet. Movement is swept one axis at a time against static
// AABBs, so a body can never skip through a platform however fast it moves.

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.4;
export const RUN_SPEED = 6;
export const JUMP_VELOCITY = 8;
export const GRAVITY = 22;
export const TERMINAL_VELOCITY = 50;
export const GROUND_ACCEL = 90;
export const AIR_ACCEL = 55;
export const MAX_SUBSTEP = 1 / 120;
export const MAX_FRAME_DT = 0.1;

// Contact tolerance: boxes that merely touch (or overlap by float noise) do not collide.
const EPS = 1e-6;
const GROUND_PROBE = 1e-4;

function num(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return v;
}

function compilePlatforms(platforms) {
  if (!Array.isArray(platforms) && !(platforms && typeof platforms[Symbol.iterator] === 'function')) {
    return [];
  }
  const out = [];
  for (const p of platforms) {
    const box = Object.freeze({
      id: p.id,
      minX: num(p.min.x, 'platform.min.x'),
      minY: num(p.min.y, 'platform.min.y'),
      minZ: num(p.min.z, 'platform.min.z'),
      maxX: num(p.max.x, 'platform.max.x'),
      maxY: num(p.max.y, 'platform.max.y'),
      maxZ: num(p.max.z, 'platform.max.z'),
    });
    if (box.minX > box.maxX || box.minY > box.maxY || box.minZ > box.maxZ) {
      throw new RangeError(`platform ${String(p.id)} has min greater than max`);
    }
    out.push(box);
  }
  return Object.freeze(out);
}

function readPoint(p, name) {
  return { x: num(p.x, `${name}.x`), y: num(p.y, `${name}.y`), z: num(p.z, `${name}.z`) };
}

function approach(current, target, maxDelta) {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

/**
 * @param {{platforms: Array, spawn: {x:number,y:number,z:number}, position?: {x:number,y:number,z:number}}} options
 *   `position` optionally supplies the object that is mutated in place as the
 *   foot position (e.g. a THREE.Vector3), so its identity stays stable.
 */
export function createPlayerPhysics({ platforms = [], spawn, position } = {}) {
  const boxes = compilePlatforms(platforms);
  const start = readPoint(spawn ?? { x: 0, y: 0, z: 0 }, 'spawn');
  const pos = position ?? { x: 0, y: 0, z: 0 };
  const vel = { x: 0, y: 0, z: 0 };
  const r = PLAYER_RADIUS;
  const h = PLAYER_HEIGHT;

  const state = {
    position: pos,
    velocity: vel,
    grounded: false,
    step,
    reset,
  };

  function overlapsXZ(b, x, z) {
    return x - r < b.maxX - EPS && x + r > b.minX + EPS && z - r < b.maxZ - EPS && z + r > b.minZ + EPS;
  }

  function overlapsY(b, y) {
    return y < b.maxY - EPS && y + h > b.minY + EPS;
  }

  function probeGround() {
    for (const b of boxes) {
      if (!overlapsXZ(b, pos.x, pos.z)) continue;
      if (Math.abs(pos.y - b.maxY) <= GROUND_PROBE) return true;
    }
    return false;
  }

  function moveX(dx) {
    if (dx === 0) return;
    let allowed = Math.abs(dx);
    let hit = null;
    for (const b of boxes) {
      if (!overlapsY(b, pos.y)) continue;
      if (pos.z - r >= b.maxZ - EPS || pos.z + r <= b.minZ + EPS) continue;
      let gap;
      if (dx > 0) {
        if (pos.x + r > b.minX + EPS) continue;
        gap = b.minX - (pos.x + r);
      } else {
        if (pos.x - r < b.maxX - EPS) continue;
        gap = pos.x - r - b.maxX;
      }
      if (gap < 0) gap = 0;
      if (gap < allowed) {
        allowed = gap;
        hit = b;
      }
    }
    if (hit) {
      pos.x = dx > 0 ? hit.minX - r : hit.maxX + r;
      vel.x = 0;
    } else {
      pos.x += dx;
    }
  }

  function moveZ(dz) {
    if (dz === 0) return;
    let allowed = Math.abs(dz);
    let hit = null;
    for (const b of boxes) {
      if (!overlapsY(b, pos.y)) continue;
      if (pos.x - r >= b.maxX - EPS || pos.x + r <= b.minX + EPS) continue;
      let gap;
      if (dz > 0) {
        if (pos.z + r > b.minZ + EPS) continue;
        gap = b.minZ - (pos.z + r);
      } else {
        if (pos.z - r < b.maxZ - EPS) continue;
        gap = pos.z - r - b.maxZ;
      }
      if (gap < 0) gap = 0;
      if (gap < allowed) {
        allowed = gap;
        hit = b;
      }
    }
    if (hit) {
      pos.z = dz > 0 ? hit.minZ - r : hit.maxZ + r;
      vel.z = 0;
    } else {
      pos.z += dz;
    }
  }

  // Returns true when the body landed on a top surface.
  function moveY(dy) {
    if (dy === 0) return false;
    let allowed = Math.abs(dy);
    let hit = null;
    for (const b of boxes) {
      if (!overlapsXZ(b, pos.x, pos.z)) continue;
      let gap;
      if (dy < 0) {
        if (pos.y < b.maxY - EPS) continue;
        gap = pos.y - b.maxY;
      } else {
        if (pos.y + h > b.minY + EPS) continue;
        gap = b.minY - (pos.y + h);
      }
      if (gap < 0) gap = 0;
      if (gap < allowed) {
        allowed = gap;
        hit = b;
      }
    }
    if (hit) {
      if (dy < 0) {
        pos.y = hit.maxY;
        vel.y = 0;
        return true;
      }
      pos.y = hit.minY - h;
      vel.y = 0;
      return false;
    }
    pos.y += dy;
    return false;
  }

  function substep(dt, moveXIn, moveZIn, jump) {
    // Horizontal: responsive acceleration toward the target velocity.
    const accel = (state.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt;
    vel.x = approach(vel.x, moveXIn * RUN_SPEED, accel);
    vel.z = approach(vel.z, moveZIn * RUN_SPEED, accel);

    if (jump && state.grounded) {
      vel.y = JUMP_VELOCITY;
      state.grounded = false;
    }
    vel.y = Math.max(vel.y - GRAVITY * dt, -TERMINAL_VELOCITY);

    moveX(vel.x * dt);
    moveZ(vel.z * dt);
    state.grounded = moveY(vel.y * dt);
  }

  function step(dt, input) {
    if (typeof dt !== 'number' || !(dt > 0)) return state;
    dt = Math.min(dt, MAX_FRAME_DT);

    let mx = Number(input?.moveX) || 0;
    let mz = Number(input?.moveZ) || 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    let jump = Boolean(input?.jumpPressed);

    const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP - 1e-9));
    const sub = dt / n;
    for (let i = 0; i < n; i += 1) {
      substep(sub, mx, mz, jump);
      jump = false;
    }
    return state;
  }

  function reset(p) {
    const target = p ? readPoint(p, 'position') : start;
    pos.x = target.x;
    pos.y = target.y;
    pos.z = target.z;
    vel.x = 0;
    vel.y = 0;
    vel.z = 0;
    state.grounded = probeGround();
    return state;
  }

  reset(start);
  return state;
}
