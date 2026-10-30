import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/world/world.js';

// Contracts agreed with the other modules (PR #45 player, PR #43 orbs/goal, PR #42 loop).
const PLAYER = { radius: 0.45, height: 1.8, moveSpeed: 8, acceleration: 45, gravity: -30, maxFall: -45, jumpSpeed: 12 };
const ORB = { hover: 0.9, pickupRadius: 1.2, pickupHeight: 2 };
const GOAL = { ringY: 1.8, reachRadius: 1.8, reachHeight: 2.5 };
const DT = 1 / 60;

const contains = (b, x, z, margin = 0) =>
  x >= b.min.x - margin && x <= b.max.x + margin && z >= b.min.z - margin && z <= b.max.z + margin;

function surfaceAt(world, position) {
  return world.boxes.findIndex(
    (b) => Math.abs(b.max.y - position.y) < 1e-6 && contains(b, position.x, position.z),
  );
}

// One player-controller frame: same order as the game loop (world.update, then the player move).
function step(world, position, velocity, direction, jump) {
  world.update(DT);
  const target = { x: direction.x * PLAYER.moveSpeed, z: direction.z * PLAYER.moveSpeed };
  const dx = target.x - velocity.x;
  const dz = target.z - velocity.z;
  const dist = Math.hypot(dx, dz);
  const maxDelta = PLAYER.acceleration * DT;
  if (dist <= maxDelta) {
    velocity.x = target.x;
    velocity.z = target.z;
  } else {
    velocity.x += (dx / dist) * maxDelta;
    velocity.z += (dz / dist) * maxDelta;
  }
  if (jump) velocity.y = Math.max(velocity.y, PLAYER.jumpSpeed);
  velocity.y = Math.max(velocity.y + PLAYER.gravity * DT, PLAYER.maxFall);
  return world.movePlayer(position, velocity, DT, PLAYER.radius, PLAYER.height);
}

function advance(world, seconds) {
  for (let t = 0; t < seconds - 1e-9; t += DT) world.update(DT);
}

// Runs from a standing start on `fromIndex` until the player lands on a different surface.
function trial(world, fromIndex, point, angle, jump, phase) {
  world.reset();
  advance(world, phase);
  const from = world.boxes[fromIndex];
  const position = new THREE.Vector3(point.x, from.max.y, point.z);
  if (from === world.movingPlatform.box) {
    position.x += (from.min.x + from.max.x) / 2;
  }
  const direction = { x: Math.cos(angle), z: Math.sin(angle) };
  const velocity = new THREE.Vector3(direction.x * PLAYER.moveSpeed, 0, direction.z * PLAYER.moveSpeed);
  let airborne = false;
  for (let i = 0; i < 150; i += 1) {
    const grounded = step(world, position, velocity, direction, jump && i === 0);
    if (!grounded) airborne = true;
    else if (airborne) return surfaceAt(world, position);
    if (position.y < -2) return -1;
  }
  return -1;
}

function samplePoints(box, isMoving, isGround) {
  const points = [];
  if (isGround) {
    for (let x = -10; x <= 10; x += 2) for (let z = -48; z <= 4; z += 2) points.push({ x, z });
    return points;
  }
  const minX = isMoving ? -2 : box.min.x;
  const maxX = isMoving ? 2 : box.max.x;
  for (let i = 0; i <= 4; i += 1) {
    for (let j = 0; j <= 4; j += 1) {
      points.push({
        x: minX + ((maxX - minX) * i) / 4,
        z: box.min.z + ((box.max.z - box.min.z) * j) / 4,
      });
    }
  }
  return points;
}

function reachableSurfaces() {
  const world = createWorld(new THREE.Scene());
  const groundIndex = world.boxes.findIndex((b) => b.max.y === 0 && b.min.x === -25);
  const movingIndex = world.boxes.indexOf(world.movingPlatform.box);
  const reached = new Set([groundIndex]);
  const queue = [groundIndex];
  const angles = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16);
  const phases = [0, 2, 4, 6];
  while (queue.length) {
    const from = queue.shift();
    const points = samplePoints(world.boxes[from], from === movingIndex, from === groundIndex);
    for (const point of points) {
      for (const angle of angles) {
        for (const phase of phases) {
          for (const jump of from === groundIndex ? [true] : [true, false]) {
            const landed = trial(world, from, point, angle, jump, phase);
            if (landed >= 0 && !reached.has(landed)) {
              reached.add(landed);
              queue.push(landed);
            }
          }
        }
      }
    }
  }
  return { world, reached, movingIndex };
}

const traversal = reachableSurfaces();

const isWall = (b) => b.min.y === 0 && b.max.y === 3;
const isGround = (b) => b.max.y === 0;
const platformIndices = (world) =>
  world.boxes.map((b, i) => i).filter((i) => !isWall(world.boxes[i]) && !isGround(world.boxes[i]));

// Same checks as the orb module (PR #43) and goal module: horizontal radius, vertical window.
function orbPickedUp(player, coin) {
  const dx = player.x - coin.x;
  const dz = player.z - coin.z;
  const dy = player.y - (coin.y + ORB.hover);
  return dx * dx + dz * dz <= ORB.pickupRadius ** 2 && Math.abs(dy) <= ORB.pickupHeight;
}

function goalReached(player, goal) {
  const dx = player.x - goal.x;
  const dz = player.z - goal.z;
  const dy = player.y - (goal.y + GOAL.ringY);
  return dx * dx + dz * dz <= GOAL.reachRadius ** 2 && Math.abs(dy) <= GOAL.reachHeight;
}

test('interface: spawn, orb and goal positions follow the shared contracts', () => {
  const { world } = traversal;
  assert.deepEqual(world.spawn.toArray(), [0, 0.1, 0]);
  assert.equal(world.coinPositions.length, 10);
  for (const coin of world.coinPositions) assert.ok(coin instanceof THREE.Vector3);
  assert.ok(world.goalPosition instanceof THREE.Vector3);
  for (const name of ['update', 'reset', 'movePlayer']) assert.equal(typeof world[name], 'function');
  assert.ok(Array.isArray(world.boxes));
  assert.ok(world.group instanceof THREE.Group);
});

test('spawn drops onto the ground and stays grounded with the player controller step', () => {
  const world = createWorld(new THREE.Scene());
  const position = world.spawn.clone();
  const velocity = new THREE.Vector3();
  let grounded = false;
  for (let i = 0; i < 10; i += 1) grounded = step(world, position, velocity, { x: 0, z: 0 }, false);
  assert.equal(grounded, true);
  assert.equal(position.y, 0);
});

test('the player can reach every platform, including the moving and final platforms', () => {
  const { world, reached, movingIndex } = traversal;
  const platforms = platformIndices(world);
  assert.equal(platforms.length, 10);
  for (const i of platforms) {
    const b = world.boxes[i];
    assert.ok(reached.has(i), `platform top ${b.max.y} at z ${b.min.z}..${b.max.z} is reachable`);
  }
  assert.ok(reached.has(movingIndex));
});

test('every orb sits on a reachable surface and is picked up by a player standing at it', () => {
  const { world, reached, movingIndex } = traversal;
  for (const coin of world.coinPositions) {
    const index = world.boxes.findIndex((b, i) => {
      if (b.max.y !== coin.y || isWall(b)) return false;
      if (i === movingIndex) return Math.abs(coin.x) <= 6 && coin.z >= b.min.z && coin.z <= b.max.z;
      return contains(b, coin.x, coin.z);
    });
    assert.ok(index >= 0, `orb at ${coin.toArray()} rests on a surface top`);
    assert.ok(reached.has(index), `orb at ${coin.toArray()} is on a reachable surface`);

    const w = createWorld(new THREE.Scene());
    if (index === movingIndex) advance(w, 2); // the platform is directly under the orb at t = 2 s
    const surface = w.boxes[index];
    const standing = { x: coin.x, y: surface.max.y, z: coin.z };
    if (index === movingIndex) {
      assert.ok(contains(surface, coin.x, coin.z), 'platform passes under its orb');
    }
    assert.ok(orbPickedUp(standing, coin), `orb at ${coin.toArray()} can be picked up`);
  }
});

test('the goal is on the reachable final platform and within reach of a standing player', () => {
  const { world, reached } = traversal;
  const goal = world.goalPosition;
  const index = world.boxes.findIndex((b) => b.max.y === goal.y && !isWall(b) && contains(b, goal.x, goal.z));
  assert.ok(index >= 0, 'goal stands on a platform top');
  assert.ok(reached.has(index), 'goal platform is reachable');
  assert.ok(goalReached({ x: goal.x, y: goal.y, z: goal.z }, goal));
});

test('the course is a real chain: the final platform is not reachable from the ground in one jump', () => {
  const { world } = traversal;
  const groundIndex = world.boxes.findIndex(isGround);
  const finalIndex = world.boxes.findIndex((b) => b.min.z === -44.5);
  const angles = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16);
  for (let z = -36; z <= -30; z += 1) {
    for (const angle of angles) {
      assert.notEqual(trial(world, groundIndex, { x: 0, z }, angle, true, 0), finalIndex);
    }
  }
});
