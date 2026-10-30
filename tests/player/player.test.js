import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer } from '../../src/player/player.js';

const DT = 1 / 60;

// Flat floor at y = 0, optionally only up to x = edgeX.
function makeWorld({ edgeX = Infinity } = {}) {
  return {
    calls: [],
    movePlayer(position, velocity, dt, radius, height) {
      this.calls.push({ radius, height });
      position.addScaledVector(velocity, dt);
      if (position.y <= 0 && position.x < edgeX && velocity.y <= 0) {
        position.y = 0;
        velocity.y = 0;
        return true;
      }
      return false;
    },
  };
}

function settle(player, world) {
  for (let i = 0; i < 5; i++) player.update(DT, {}, 0, world);
}

test('createPlayer exposes the agreed shape', () => {
  const scene = new THREE.Scene();
  const player = createPlayer(scene, new THREE.Vector3(1, 2, 3));
  assert.ok(player.group instanceof THREE.Group);
  assert.ok(scene.children.includes(player.group));
  assert.deepEqual(player.position.toArray(), [1, 2, 3]);
  assert.ok(player.velocity instanceof THREE.Vector3);
  assert.equal(player.radius, 0.45);
  assert.equal(player.height, 1.8);
  assert.equal(player.grounded, false);
});

test('falls, lands and reports grounded; passes radius/height to world', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 3, 0));
  for (let i = 0; i < 120; i++) player.update(DT, {}, 0, world);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
  assert.deepEqual(world.calls[0], { radius: 0.45, height: 1.8 });
});

test('moves forward (-z) and reaches speed 8', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  for (let i = 0; i < 60; i++) player.update(DT, { forward: true }, 0, world);
  assert.ok(player.position.z < -5);
  assert.ok(Math.abs(player.velocity.x) < 1e-6);
  assert.ok(Math.abs(Math.hypot(player.velocity.x, player.velocity.z) - 8) < 1e-6);
});

test('stops with friction when input releases', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  for (let i = 0; i < 30; i++) player.update(DT, { right: true }, 0, world);
  for (let i = 0; i < 120; i++) player.update(DT, {}, 0, world);
  assert.equal(player.velocity.x, 0);
});

test('jump from ground launches at jump speed', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  player.update(DT, { jump: true }, 0, world);
  assert.equal(player.grounded, false);
  assert.ok(player.velocity.y > 11 && player.velocity.y <= 12);
  assert.ok(player.position.y > 0);
});

test('holding jump does not re-jump after landing', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  let landedAgain = false;
  let airborne = false;
  for (let i = 0; i < 180; i++) {
    player.update(DT, { jump: true }, 0, world);
    if (!player.grounded) airborne = true;
    else if (airborne) landedAgain = true;
  }
  assert.ok(landedAgain);
  assert.equal(player.grounded, true);
});

test('jump buffer: press shortly before landing jumps on landing', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0.4, 0));
  player.update(DT, {}, 0, world);
  player.update(DT, { jump: true }, 0, world);
  player.update(DT, {}, 0, world);
  let jumped = false;
  for (let i = 0; i < 20 && !jumped; i++) {
    player.update(DT, {}, 0, world);
    if (player.velocity.y > 5) jumped = true;
  }
  assert.ok(jumped);
});

test('jump buffer expires after 0.15s', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 6, 0));
  player.update(DT, { jump: true }, 0, world);
  let jumped = false;
  for (let i = 0; i < 200; i++) {
    player.update(DT, {}, 0, world);
    if (player.velocity.y > 5) jumped = true;
  }
  assert.equal(jumped, false);
  assert.equal(player.grounded, true);
});

test('coyote time: can jump shortly after walking off a ledge', () => {
  const world = makeWorld({ edgeX: 1 });
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  while (player.position.x < 1) player.update(DT, { right: true }, 0, world);
  player.update(DT, { right: true }, 0, world);
  assert.equal(player.grounded, false);
  player.update(DT, { right: true, jump: true }, 0, world);
  assert.ok(player.velocity.y > 5);
});

test('coyote time expires after 0.12s', () => {
  const world = makeWorld({ edgeX: 1 });
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  while (player.position.x < 1) player.update(DT, { right: true }, 0, world);
  for (let i = 0; i < 12; i++) player.update(DT, { right: true }, 0, world);
  player.update(DT, { right: true, jump: true }, 0, world);
  assert.ok(player.velocity.y < 0);
});

test('fall speed is capped', () => {
  const world = makeWorld({ edgeX: -Infinity });
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 1000, 0));
  for (let i = 0; i < 300; i++) player.update(DT, {}, 0, world);
  assert.equal(player.velocity.y, -45);
});

test('reset moves to new spawn and clears velocity', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  for (let i = 0; i < 30; i++) player.update(DT, { forward: true }, 0, world);
  player.reset(new THREE.Vector3(5, 1, 5));
  assert.deepEqual(player.position.toArray(), [5, 1, 5]);
  assert.deepEqual(player.velocity.toArray(), [0, 0, 0]);
  assert.equal(player.grounded, false);
  assert.deepEqual(player.group.position.toArray(), [5, 1, 5]);
});

test('group follows position and faces direction of travel', () => {
  const world = makeWorld();
  const player = createPlayer(new THREE.Scene(), new THREE.Vector3(0, 0, 0));
  settle(player, world);
  for (let i = 0; i < 60; i++) player.update(DT, { left: true }, 0, world);
  assert.ok(player.group.position.distanceTo(player.position) < 1e-9);
  const dir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.group.children[0].rotation.y);
  assert.ok(dir.x < -0.9);
});
