export const MOVE_SPEED = 8;
export const ACCELERATION = 45;
export const FRICTION = 12;
export const GRAVITY = -30;
export const MAX_FALL_SPEED = -45;
export const JUMP_SPEED = 12;
export const JUMP_BUFFER_TIME = 0.15;
export const COYOTE_TIME = 0.12;

const STOP_EPSILON = 0.01;

export function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

/**
 * Turns directional input into a unit-length world-space direction {x, z}.
 * Yaw 0 looks down -z; forward input moves along the camera's facing.
 * Diagonals are normalized so they are not faster than straight lines.
 */
export function cameraRelativeDirection(inputState, cameraYaw = 0) {
  const input = inputState || {};
  const forward = input.forward || input.up ? 1 : 0;
  const back = input.backward || input.back || input.down ? 1 : 0;
  const left = input.left ? 1 : 0;
  const right = input.right ? 1 : 0;

  const f = forward - back;
  const r = right - left;
  if (f === 0 && r === 0) return { x: 0, z: 0 };

  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  let x = -sin * f + cos * r;
  let z = -cos * f - sin * r;
  const length = Math.hypot(x, z);
  x /= length;
  z /= length;
  return { x, z };
}

export function applyGravity(velocityY, dt, gravity = GRAVITY, maxFallSpeed = MAX_FALL_SPEED) {
  return Math.max(velocityY + gravity * dt, maxFallSpeed);
}

export function applyJump(velocityY, jumpSpeed = JUMP_SPEED) {
  return Math.max(velocityY, jumpSpeed);
}

/**
 * Accelerates a horizontal velocity {x, z} toward direction * speed.
 * Returns a new {x, z}.
 */
export function accelerateHorizontal(
  velocity,
  direction,
  dt,
  speed = MOVE_SPEED,
  acceleration = ACCELERATION,
) {
  const targetX = direction.x * speed;
  const targetZ = direction.z * speed;
  const dx = targetX - velocity.x;
  const dz = targetZ - velocity.z;
  const distance = Math.hypot(dx, dz);
  const maxDelta = acceleration * dt;
  if (distance <= maxDelta || distance === 0) return { x: targetX, z: targetZ };
  const scale = maxDelta / distance;
  return { x: velocity.x + dx * scale, z: velocity.z + dz * scale };
}

/**
 * Exponentially damps a horizontal velocity {x, z}. Returns a new {x, z}.
 */
export function applyFriction(velocity, dt, friction = FRICTION) {
  const factor = Math.exp(-friction * dt);
  const x = velocity.x * factor;
  const z = velocity.z * factor;
  if (Math.hypot(x, z) < STOP_EPSILON) return { x: 0, z: 0 };
  return { x, z };
}
