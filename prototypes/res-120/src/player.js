import * as THREE from 'three';

const HALF_WIDTH = 0.35;
const HEIGHT = 1.2;
const MOVE_SPEED = 5;
const JUMP_SPEED = 8;
const GRAVITY = 20;
const MAX_FRAME_DT = 0.05;
const MAX_SUBSTEP = 1 / 120;
const TURN_SPEED = 18;
const EPS = 1e-6;

function toVec3(value) {
  if (Array.isArray(value)) return new THREE.Vector3(value[0] ?? 0, value[1] ?? 0, value[2] ?? 0);
  return new THREE.Vector3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
}

// Colliders are axis-aligned boxes: { min: {x,y,z}, max: {x,y,z} } (a THREE.Box3 works),
// or { center, size }.
function boundsOf(collider) {
  if (collider.min && collider.max) {
    return {
      minX: collider.min.x, minY: collider.min.y, minZ: collider.min.z,
      maxX: collider.max.x, maxY: collider.max.y, maxZ: collider.max.z,
    };
  }
  const c = collider.center;
  const s = collider.size;
  return {
    minX: c.x - s.x / 2, minY: c.y - s.y / 2, minZ: c.z - s.z / 2,
    maxX: c.x + s.x / 2, maxY: c.y + s.y / 2, maxZ: c.z + s.z / 2,
  };
}

function overlaps(aMin, aMax, bMin, bMax) {
  return aMax - bMin > EPS && bMax - aMin > EPS;
}

function shortestAngleDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function buildVisual() {
  const group = new THREE.Group();
  group.name = 'player';
  const disposables = [];
  const mat = (color) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05 });
    disposables.push(m);
    return m;
  };
  const geo = (g) => {
    disposables.push(g);
    return g;
  };
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };

  const bodyMat = mat(0xf2994a);
  const accentMat = mat(0x2d9cdb);
  const darkMat = mat(0x22303c);
  const lightMat = mat(0xffffff);

  add(geo(new THREE.CylinderGeometry(0.3, 0.33, 0.5, 8)), bodyMat, 0, 0.55, 0);
  add(geo(new THREE.BoxGeometry(0.5, 0.12, 0.42)), accentMat, 0, 0.38, 0);
  add(geo(new THREE.IcosahedronGeometry(0.28, 1)), bodyMat, 0, 0.95, 0);
  add(geo(new THREE.ConeGeometry(0.09, 0.22, 6)), accentMat, 0, 1.2 - 0.1, 0);
  add(geo(new THREE.SphereGeometry(0.055, 8, 6)), lightMat, -0.1, 0.99, 0.23);
  add(geo(new THREE.SphereGeometry(0.055, 8, 6)), lightMat, 0.1, 0.99, 0.23);
  add(geo(new THREE.SphereGeometry(0.028, 6, 4)), darkMat, -0.1, 0.99, 0.275);
  add(geo(new THREE.SphereGeometry(0.028, 6, 4)), darkMat, 0.1, 0.99, 0.275);
  add(geo(new THREE.BoxGeometry(0.16, 0.2, 0.2)), darkMat, -0.16, 0.1, 0.02);
  add(geo(new THREE.BoxGeometry(0.16, 0.2, 0.2)), darkMat, 0.16, 0.1, 0.02);

  return { group, disposables };
}

export function createPlayer({ colliders = [], spawn = { x: 0, y: 0, z: 0 } } = {}) {
  const { group, disposables } = buildVisual();
  const spawnPoint = toVec3(spawn);
  const position = spawnPoint.clone();
  let velocityY = 0;
  let isGrounded = false;
  let jumpWasPressed = false;
  let facing = 0;

  group.position.copy(position);

  // Sweeps the player box along one axis by `delta`, stopping at the nearest static box.
  // Returns true if it was blocked.
  function moveAxis(axis, delta) {
    if (delta === 0) return false;
    const half = axis === 'y' ? 0 : HALF_WIDTH;
    const size = axis === 'y' ? HEIGHT : HALF_WIDTH * 2;
    const start = axis === 'y' ? position.y : position[axis] - half;
    const end = start + size;
    let travel = delta;
    let blocked = false;

    const px = position.x;
    const py = position.y;
    const pz = position.z;

    for (const collider of colliders) {
      const b = boundsOf(collider);
      if (axis !== 'x' && !overlaps(px - HALF_WIDTH, px + HALF_WIDTH, b.minX, b.maxX)) continue;
      if (axis !== 'y' && !overlaps(py, py + HEIGHT, b.minY, b.maxY)) continue;
      if (axis !== 'z' && !overlaps(pz - HALF_WIDTH, pz + HALF_WIDTH, b.minZ, b.maxZ)) continue;

      const lo = axis === 'x' ? b.minX : axis === 'y' ? b.minY : b.minZ;
      const hi = axis === 'x' ? b.maxX : axis === 'y' ? b.maxY : b.maxZ;

      if (delta > 0 && lo >= end - EPS) {
        const gap = lo - end;
        if (gap < travel) {
          travel = Math.max(gap, 0);
          blocked = true;
        }
      } else if (delta < 0 && hi <= start + EPS) {
        const gap = hi - start;
        if (gap > travel) {
          travel = Math.min(gap, 0);
          blocked = true;
        }
      }
    }

    if (axis === 'y') {
      position.y += travel;
    } else {
      position[axis] += travel;
    }
    return blocked;
  }

  function snapToBlocker(axis, delta) {
    // Re-align exactly onto the blocking face so contact is stable (no float drift).
    const half = axis === 'y' ? 0 : HALF_WIDTH;
    const size = axis === 'y' ? HEIGHT : HALF_WIDTH * 2;
    const current = axis === 'y' ? position.y : position[axis] - half;
    const end = current + size;
    for (const collider of colliders) {
      const b = boundsOf(collider);
      const lo = axis === 'x' ? b.minX : axis === 'y' ? b.minY : b.minZ;
      const hi = axis === 'x' ? b.maxX : axis === 'y' ? b.maxY : b.maxZ;
      if (delta > 0 && Math.abs(lo - end) <= EPS) {
        const target = lo - size + half;
        if (axis === 'y') position.y = target;
        else position[axis] = target;
        return;
      }
      if (delta < 0 && Math.abs(hi - current) <= EPS) {
        const target = hi + half;
        if (axis === 'y') position.y = target;
        else position[axis] = target;
        return;
      }
    }
  }

  function step(h, vx, vz) {
    if (moveAxis('x', vx * h)) snapToBlocker('x', vx);
    if (moveAxis('z', vz * h)) snapToBlocker('z', vz);

    velocityY -= GRAVITY * h;
    const dy = velocityY * h;
    if (moveAxis('y', dy)) {
      snapToBlocker('y', dy);
      if (dy < 0) isGrounded = true;
      velocityY = 0;
    } else {
      isGrounded = false;
    }
  }

  function update(dt, input = {}) {
    const { moveX = 0, moveZ = 0, jumpPressed = false } = input;
    const jumpEdge = Boolean(jumpPressed) && !jumpWasPressed;
    jumpWasPressed = Boolean(jumpPressed);

    if (!(dt > 0) || !Number.isFinite(dt)) return;
    const frameDt = Math.min(dt, MAX_FRAME_DT);

    let ix = Number.isFinite(moveX) ? moveX : 0;
    let iz = Number.isFinite(moveZ) ? moveZ : 0;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const vx = ix * MOVE_SPEED;
    const vz = iz * MOVE_SPEED;

    if (jumpEdge && isGrounded) {
      velocityY = JUMP_SPEED;
      isGrounded = false;
    }

    const steps = Math.max(1, Math.ceil(frameDt / MAX_SUBSTEP - 1e-9));
    const h = frameDt / steps;
    for (let i = 0; i < steps; i++) step(h, vx, vz);

    if (len > 1e-4) {
      const target = Math.atan2(ix, iz);
      const maxTurn = TURN_SPEED * frameDt;
      const delta = shortestAngleDelta(facing, target);
      facing += Math.abs(delta) <= maxTurn ? delta : Math.sign(delta) * maxTurn;
    }

    group.position.copy(position);
    group.rotation.y = facing;
  }

  function reset() {
    position.copy(spawnPoint);
    velocityY = 0;
    isGrounded = false;
    jumpWasPressed = false;
    facing = 0;
    group.position.copy(position);
    group.rotation.y = 0;
  }

  function dispose() {
    group.removeFromParent();
    for (const item of disposables) item.dispose();
    disposables.length = 0;
  }

  return {
    group,
    position,
    get grounded() {
      return isGrounded;
    },
    update,
    reset,
    dispose,
  };
}
