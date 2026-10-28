import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

export const PLAYER_WIDTH = 0.7;
export const PLAYER_HEIGHT = 1.6;
export const MOVE_SPEED = 5;
export const GRAVITY = 20;
export const JUMP_SPEED = 8;
export const MAX_FALL_SPEED = 50;
export const MAX_SUBSTEP = 1 / 120;

const HALF_WIDTH = PLAYER_WIDTH / 2;
const MAX_FRAME = 0.25;
const OVERLAP_EPSILON = 1e-5;
const SUPPORT_PROBE = 1e-3;
const TURN_RATE = 14;
const UP = new Vector3(0, 1, 0);

function buildCharacter() {
  const group = new Group();
  group.name = 'player';

  const teal = new MeshLambertMaterial({ color: 0x1fb5a8 });
  const orange = new MeshLambertMaterial({ color: 0xf2863a });
  const cream = new MeshLambertMaterial({ color: 0xf6e7c8 });
  const dark = new MeshLambertMaterial({ color: 0x2b2d42 });

  const add = (geometry, material, x, y, z) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  add(new BoxGeometry(0.28, 0.4, 0.3), dark, -0.16, 0.2, 0);
  add(new BoxGeometry(0.28, 0.4, 0.3), dark, 0.16, 0.2, 0);
  add(new CylinderGeometry(0.3, 0.34, 0.6, 12), teal, 0, 0.7, 0);
  add(new SphereGeometry(0.12, 10, 8), orange, -0.38, 0.85, 0);
  add(new SphereGeometry(0.12, 10, 8), orange, 0.38, 0.85, 0);
  add(new SphereGeometry(0.28, 14, 12), cream, 0, 1.22, 0);
  add(new ConeGeometry(0.26, 0.24, 12), orange, 0, 1.48, 0);
  add(new SphereGeometry(0.05, 8, 6), dark, -0.1, 1.26, 0.25);
  add(new SphereGeometry(0.05, 8, 6), dark, 0.1, 1.26, 0.25);

  return group;
}

function axisValue(...values) {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

// Input: { x, y, jump } with x right-positive and y forward-positive, or the
// boolean keys { left, right, forward, back }. Aliases moveX / moveY also work.
function readMove(input) {
  if (!input) return { right: 0, forward: 0 };
  const right =
    axisValue(input.x, input.moveX) + (input.right === true ? 1 : 0) - (input.left === true ? 1 : 0);
  const forward =
    axisValue(input.y, input.moveY) + (input.forward === true ? 1 : 0) - (input.back === true ? 1 : 0);
  return { right, forward };
}

export function createPlayer({ scene, spawn, colliders = [] }) {
  const solids = Array.from(colliders);
  const spawnPoint = spawn.clone();

  const group = buildCharacter();
  const position = group.position;
  position.copy(spawnPoint);
  if (scene) scene.add(group);

  const velocity = new Vector3();
  const heading = new Vector3();
  const move = new Vector3();
  let grounded = false;
  let jumpHeld = false;
  let yaw = 0;

  function overlaps(box) {
    const e = OVERLAP_EPSILON;
    return (
      position.x + HALF_WIDTH > box.min.x + e &&
      position.x - HALF_WIDTH < box.max.x - e &&
      position.y + PLAYER_HEIGHT > box.min.y + e &&
      position.y < box.max.y - e &&
      position.z + HALF_WIDTH > box.min.z + e &&
      position.z - HALF_WIDTH < box.max.z - e
    );
  }

  function hasSupport() {
    const e = OVERLAP_EPSILON;
    for (const box of solids) {
      if (
        position.x + HALF_WIDTH > box.min.x + e &&
        position.x - HALF_WIDTH < box.max.x - e &&
        position.z + HALF_WIDTH > box.min.z + e &&
        position.z - HALF_WIDTH < box.max.z - e &&
        box.max.y <= position.y + e &&
        box.max.y >= position.y - SUPPORT_PROBE
      ) {
        return true;
      }
    }
    return false;
  }

  grounded = hasSupport();

  function moveAxis(axis, delta) {
    if (delta === 0) return false;
    position[axis] += delta;
    let hit = false;
    for (const box of solids) {
      if (!overlaps(box)) continue;
      hit = true;
      if (axis === 'y') {
        position.y = delta > 0 ? box.min.y - PLAYER_HEIGHT : box.max.y;
      } else {
        const half = HALF_WIDTH;
        position[axis] = delta > 0 ? box.min[axis] - half : box.max[axis] + half;
      }
    }
    return hit;
  }

  function step(h) {
    velocity.y = Math.max(velocity.y - GRAVITY * h, -MAX_FALL_SPEED);

    if (moveAxis('x', velocity.x * h)) velocity.x = 0;
    if (moveAxis('z', velocity.z * h)) velocity.z = 0;

    const dy = velocity.y * h;
    const hitY = moveAxis('y', dy);
    grounded = hitY && dy < 0;
    if (hitY) velocity.y = 0;
  }

  function update(dt, input, cameraForward) {
    if (!(dt > 0)) return;
    const frame = Math.min(dt, MAX_FRAME);

    heading.set(cameraForward ? cameraForward.x : 0, 0, cameraForward ? cameraForward.z : -1);
    if (heading.lengthSq() < 1e-8) heading.set(0, 0, -1);
    heading.normalize();

    const { right, forward } = readMove(input);
    move.set(0, 0, 0)
      .addScaledVector(heading, forward)
      .addScaledVector(heading.clone().cross(UP), right);
    if (move.lengthSq() > 1) move.normalize();
    velocity.x = move.x * MOVE_SPEED;
    velocity.z = move.z * MOVE_SPEED;

    const jumpPressed = !!(input && input.jump);
    if (jumpPressed && !jumpHeld && grounded) {
      velocity.y = JUMP_SPEED;
      grounded = false;
    }
    jumpHeld = jumpPressed;

    const steps = Math.max(1, Math.ceil(frame / MAX_SUBSTEP - 1e-9));
    const h = frame / steps;
    for (let i = 0; i < steps; i++) step(h);

    if (move.lengthSq() > 1e-6) {
      const target = Math.atan2(move.x, move.z);
      let diff = target - yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      yaw += diff * (1 - Math.exp(-TURN_RATE * frame));
      group.rotation.y = yaw;
    }
  }

  function reset() {
    position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    grounded = hasSupport();
    jumpHeld = false;
    yaw = 0;
    group.rotation.y = 0;
  }

  function getBounds() {
    return new Box3(
      new Vector3(position.x - HALF_WIDTH, position.y, position.z - HALF_WIDTH),
      new Vector3(position.x + HALF_WIDTH, position.y + PLAYER_HEIGHT, position.z + HALF_WIDTH),
    );
  }

  return { position, update, reset, getBounds };
}
