import * as THREE from 'three';
import { createPlayerModel, createPlayerAnimator } from './player-model.js';
import {
  COYOTE_TIME,
  JUMP_BUFFER_TIME,
  accelerateHorizontal,
  applyFriction,
  applyGravity,
  applyJump,
  cameraRelativeDirection,
} from './movement.js';

const TURN_SPEED = 14;

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPlayer(scene, spawn) {
  const radius = 0.45;
  const height = 1.8;

  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const group = new THREE.Group();
  group.name = 'Player';

  const model = createPlayerModel();
  const animator = createPlayerAnimator(model);
  group.add(model.root);
  if (scene) scene.add(group);

  let grounded = false;
  let coyoteTimer = 0;
  let jumpBufferTimer = 0;
  let jumpWasHeld = false;
  let facing = 0;

  function syncGroup() {
    group.position.copy(position);
    model.root.rotation.y = facing;
  }

  function reset(newSpawn) {
    if (newSpawn) position.set(newSpawn.x, newSpawn.y, newSpawn.z);
    else if (spawn) position.set(spawn.x, spawn.y, spawn.z);
    velocity.set(0, 0, 0);
    grounded = false;
    coyoteTimer = 0;
    jumpBufferTimer = 0;
    jumpWasHeld = false;
    facing = 0;
    animator.reset();
    syncGroup();
  }

  function update(dt, inputState, cameraYaw, world) {
    if (!(dt > 0)) return;
    const input = inputState || {};

    // Buffer a jump on the press edge (or an explicit jumpPressed flag).
    const jumpHeld = !!(input.jump || input.jumpHeld);
    if (input.jumpPressed || (jumpHeld && !jumpWasHeld)) jumpBufferTimer = JUMP_BUFFER_TIME;
    jumpWasHeld = jumpHeld;

    const direction = cameraRelativeDirection(input, cameraYaw);
    const hasInput = direction.x !== 0 || direction.z !== 0;
    const horizontal = hasInput
      ? accelerateHorizontal({ x: velocity.x, z: velocity.z }, direction, dt)
      : applyFriction({ x: velocity.x, z: velocity.z }, dt);
    velocity.x = horizontal.x;
    velocity.z = horizontal.z;

    if (jumpBufferTimer > 0 && coyoteTimer > 0) {
      velocity.y = applyJump(velocity.y);
      jumpBufferTimer = 0;
      coyoteTimer = 0;
      grounded = false;
    }

    velocity.y = applyGravity(velocity.y, dt);

    grounded = !!world.movePlayer(position, velocity, dt, radius, height);

    if (grounded) coyoteTimer = COYOTE_TIME;
    else coyoteTimer = Math.max(0, coyoteTimer - dt);
    jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);

    const planarSpeed = Math.hypot(velocity.x, velocity.z);
    if (planarSpeed > 0.5) {
      const target = Math.atan2(-velocity.x, -velocity.z);
      facing += shortestAngle(facing, target) * Math.min(1, TURN_SPEED * dt);
    }

    animator.update(dt, planarSpeed, grounded, velocity.y);
    syncGroup();
  }

  reset(spawn);

  return {
    group,
    position,
    velocity,
    radius,
    height,
    get grounded() {
      return grounded;
    },
    update,
    reset,
  };
}
