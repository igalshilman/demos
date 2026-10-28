import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLevel } from '../src/level.js';

const PLAYER_WIDTH = 0.7;
const PLAYER_HEIGHT = 1.6;
const SPEED = 5;
const GRAVITY = 20;
const JUMP = 8;

function build() {
  const scene = new THREE.Scene();
  const level = createLevel(scene);
  return { scene, level };
}

function gap(a, b) {
  const gx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const gz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(gx, gz);
}

test('returns exactly the expected shape', () => {
  const { level } = build();
  assert.deepEqual(Object.keys(level).sort(), ['colliders', 'goal', 'respawnY', 'spawn']);
  assert.ok(level.spawn instanceof THREE.Vector3);
  assert.ok(level.goal instanceof THREE.Box3);
  assert.ok(Number.isFinite(level.respawnY));
});

test('colliders are finite, non-empty boxes', () => {
  const { level } = build();
  assert.ok(level.colliders.length >= 5);
  for (const box of level.colliders) {
    assert.ok(box instanceof THREE.Box3);
    assert.ok(!box.isEmpty());
    for (const v of [...box.min.toArray(), ...box.max.toArray()]) assert.ok(Number.isFinite(v));
  }
});

test('level meshes are added to the scene and match colliders', () => {
  const { scene, level } = build();
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh && o.name.startsWith('platform-')) meshes.push(o);
  });
  assert.equal(meshes.length, level.colliders.length);
  meshes.forEach((mesh, i) => {
    const box = new THREE.Box3().setFromObject(mesh);
    for (const [a, b] of [
      [box.min, level.colliders[i].min],
      [box.max, level.colliders[i].max],
    ]) {
      assert.ok(a.distanceTo(b) < 1e-6);
    }
  });
});

test('spawn is just above a supporting start surface with room for the player', () => {
  const { level } = build();
  const { spawn, colliders } = level;
  const start = colliders.find(
    (b) =>
      spawn.x - PLAYER_WIDTH / 2 >= b.min.x &&
      spawn.x + PLAYER_WIDTH / 2 <= b.max.x &&
      spawn.z - PLAYER_WIDTH / 2 >= b.min.z &&
      spawn.z + PLAYER_WIDTH / 2 <= b.max.z,
  );
  assert.ok(start, 'player footprint fully on a platform');
  const clearance = spawn.y - start.max.y;
  assert.ok(clearance >= 0 && clearance <= 0.2, `clearance ${clearance}`);
  const playerBox = new THREE.Box3(
    new THREE.Vector3(spawn.x - PLAYER_WIDTH / 2, spawn.y, spawn.z - PLAYER_WIDTH / 2),
    new THREE.Vector3(spawn.x + PLAYER_WIDTH / 2, spawn.y + PLAYER_HEIGHT, spawn.z + PLAYER_WIDTH / 2),
  );
  for (const b of colliders) assert.ok(!b.intersectsBox(playerBox), 'spawn is not inside a solid');
  assert.ok(start.max.x - start.min.x >= 3 && start.max.z - start.min.z >= 3);
});

test('course is a reachable sequence heading toward negative Z', () => {
  const { level } = build();
  const { colliders, spawn } = level;
  const maxJumpHeight = (JUMP * JUMP) / (2 * GRAVITY);
  assert.ok(maxJumpHeight >= 1.5);

  for (const b of colliders) {
    assert.ok(b.max.x - b.min.x >= 3, 'landing surface at least 3 wide');
    assert.ok(b.max.z - b.min.z >= 3, 'landing surface at least 3 deep');
  }

  for (let i = 1; i < colliders.length; i++) {
    const prev = colliders[i - 1];
    const next = colliders[i];
    const edgeGap = gap(prev, next);
    assert.ok(edgeGap > 0, `platforms ${i - 1}/${i} do not touch`);
    assert.ok(edgeGap <= 1.5, `gap ${edgeGap} between ${i - 1} and ${i}`);
    const rise = next.max.y - prev.max.y;
    assert.ok(rise <= 0.75, `rise ${rise} between ${i - 1} and ${i}`);
    assert.ok(next.min.z < prev.min.z, 'progress toward negative Z');

    // Jump travel at the same height: flight time * speed must clear the gap with margin.
    const clearedRise = Math.max(0, rise);
    const disc = JUMP * JUMP - 2 * GRAVITY * clearedRise;
    assert.ok(disc > 0);
    const airTimeAtHeight = (JUMP + Math.sqrt(disc)) / GRAVITY;
    assert.ok(airTimeAtHeight * SPEED >= edgeGap + PLAYER_WIDTH, 'jump range clears gap');
  }

  const last = colliders[colliders.length - 1];
  assert.ok(last.min.z < spawn.z - 20, 'course extends well into negative Z');
  const size = last.getSize(new THREE.Vector3());
  assert.ok(size.x >= 8 && size.z >= 8, 'final platform is large');
});

test('platforms do not overlap each other', () => {
  const { level } = build();
  const { colliders } = level;
  for (let i = 0; i < colliders.length; i++) {
    for (let j = i + 1; j < colliders.length; j++) {
      assert.ok(!colliders[i].intersectsBox(colliders[j]), `${i} overlaps ${j}`);
    }
  }
});

test('goal is a trigger above the final platform that a standing player overlaps', () => {
  const { level } = build();
  const { colliders, goal } = level;
  const last = colliders[colliders.length - 1];
  assert.ok(!goal.isEmpty());
  assert.ok(goal.min.x >= last.min.x && goal.max.x <= last.max.x);
  assert.ok(goal.min.z >= last.min.z && goal.max.z <= last.max.z);
  assert.ok(goal.min.y >= last.max.y - 1e-9, 'goal starts at the surface or above');

  const centre = goal.getCenter(new THREE.Vector3());
  const player = new THREE.Box3(
    new THREE.Vector3(centre.x - PLAYER_WIDTH / 2, last.max.y, centre.z - PLAYER_WIDTH / 2),
    new THREE.Vector3(centre.x + PLAYER_WIDTH / 2, last.max.y + PLAYER_HEIGHT, centre.z + PLAYER_WIDTH / 2),
  );
  assert.ok(goal.intersectsBox(player));

  const spawnPlayer = new THREE.Box3(
    new THREE.Vector3(level.spawn.x - 0.35, level.spawn.y, level.spawn.z - 0.35),
    new THREE.Vector3(level.spawn.x + 0.35, level.spawn.y + PLAYER_HEIGHT, level.spawn.z + 0.35),
  );
  assert.ok(!goal.intersectsBox(spawnPlayer), 'goal not triggered at spawn');
  for (const b of colliders) assert.ok(!b.containsBox(goal));
});

test('goal has a visible marker inside it', () => {
  const { scene, level } = build();
  scene.updateMatrixWorld(true);
  const ring = scene.getObjectByName('goal-ring');
  assert.ok(ring);
  const centre = new THREE.Box3().setFromObject(ring).getCenter(new THREE.Vector3());
  assert.ok(level.goal.containsPoint(centre));
});

test('respawn threshold is below every platform', () => {
  const { level } = build();
  assert.ok(level.respawnY < Math.min(...level.colliders.map((b) => b.min.y)) - 2);
  assert.ok(level.respawnY < level.spawn.y);
});
