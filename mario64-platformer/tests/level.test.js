import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLevel } from '../src/level.js';

const PLAYER = { halfWidth: 0.35, height: 1.6 };
const MAX_RISE = 1.3;
const MAX_GAP = 2.5;
const EPS = 1e-6;

const isVec = (v) =>
  ['x', 'y', 'z'].every((k) => typeof v[k] === 'number' && Number.isFinite(v[k]));

function supportOf(solids, p) {
  return solids.find(
    (s) =>
      p.x >= s.min.x && p.x <= s.max.x &&
      p.z >= s.min.z && p.z <= s.max.z &&
      Math.abs(s.max.y - p.y) < 1e-3,
  );
}

function platformUnder(solids, p) {
  return solids.find(
    (s) =>
      p.x >= s.min.x && p.x <= s.max.x &&
      p.z >= s.min.z && p.z <= s.max.z &&
      s.max.y <= p.y + EPS &&
      p.y - s.max.y <= 2,
  );
}

function horizontalGap(a, b) {
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0);
  return Math.hypot(dx, dz);
}

test('returns the documented interface', () => {
  const level = createLevel();
  assert.ok(level.group instanceof THREE.Group);
  assert.ok(Array.isArray(level.solids));
  assert.ok(Array.isArray(level.collectibles));
  assert.ok(isVec(level.spawn));
  assert.ok(isVec(level.goal.position));
  assert.ok(level.goal.radius > 0);
  assert.equal(typeof level.fallY, 'number');
});

test('has exactly five collectibles with unique ids', () => {
  const { collectibles } = createLevel();
  assert.equal(collectibles.length, 5);
  const ids = collectibles.map((c) => c.id);
  assert.equal(new Set(ids).size, 5);
  for (const id of ids) assert.equal(typeof id, 'string');
});

test('positions and radii are finite', () => {
  const level = createLevel();
  assert.ok(isVec(level.spawn));
  assert.ok(isVec(level.goal.position));
  assert.ok(Number.isFinite(level.fallY));
  for (const c of level.collectibles) {
    assert.ok(isVec(c.position), c.id);
    assert.ok(Number.isFinite(c.radius) && c.radius > 0, c.id);
  }
});

test('collision bounds are finite and well formed', () => {
  const { solids } = createLevel();
  assert.ok(solids.length > 0);
  for (const s of solids) {
    assert.ok(isVec(s.min) && isVec(s.max));
    for (const k of ['x', 'y', 'z']) assert.ok(s.min[k] < s.max[k], k);
  }
});

test('collision boxes match the visible box meshes', () => {
  const { group, solids } = createLevel();
  group.updateMatrixWorld(true);
  const boxes = [];
  group.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'BoxGeometry') {
      boxes.push(new THREE.Box3().setFromObject(o));
    }
  });
  assert.equal(boxes.length, solids.length);
  for (const s of solids) {
    const match = boxes.some(
      (b) =>
        Math.abs(b.min.x - s.min.x) < 1e-4 && Math.abs(b.max.x - s.max.x) < 1e-4 &&
        Math.abs(b.min.y - s.min.y) < 1e-4 && Math.abs(b.max.y - s.max.y) < 1e-4 &&
        Math.abs(b.min.z - s.min.z) < 1e-4 && Math.abs(b.max.z - s.max.z) < 1e-4,
    );
    assert.ok(match, JSON.stringify(s));
  }
});

test('spawn stands on a platform with room for the player', () => {
  const { spawn, solids } = createLevel();
  const support = supportOf(solids, spawn);
  assert.ok(support, 'spawn has no supporting top surface');
  assert.ok(spawn.x - PLAYER.halfWidth >= support.min.x);
  assert.ok(spawn.x + PLAYER.halfWidth <= support.max.x);
  assert.ok(spawn.z - PLAYER.halfWidth >= support.min.z);
  assert.ok(spawn.z + PLAYER.halfWidth <= support.max.z);
  for (const s of solids) {
    const overlaps =
      spawn.x + PLAYER.halfWidth > s.min.x && spawn.x - PLAYER.halfWidth < s.max.x &&
      spawn.z + PLAYER.halfWidth > s.min.z && spawn.z - PLAYER.halfWidth < s.max.z &&
      spawn.y + PLAYER.height > s.min.y && spawn.y + EPS < s.max.y;
    assert.ok(!overlaps, 'spawn is inside a solid');
  }
});

test('goal sits above a different platform than spawn', () => {
  const { spawn, goal, solids } = createLevel();
  const goalSupport = platformUnder(solids, goal.position);
  assert.ok(goalSupport, 'goal has no platform beneath it');
  assert.ok(goal.position.y - goalSupport.max.y <= 2);
  assert.notEqual(goalSupport, supportOf(solids, spawn));
  assert.ok(goalSupport.max.y > spawn.y);
  const dist = Math.hypot(
    goal.position.x - spawn.x,
    goal.position.y - spawn.y,
    goal.position.z - spawn.z,
  );
  assert.ok(dist > goal.radius * 2);
});

test('collectibles float above platforms and are spread apart', () => {
  const { collectibles, solids } = createLevel();
  for (const c of collectibles) {
    assert.ok(platformUnder(solids, c.position), `${c.id} has no platform beneath`);
  }
  for (let i = 0; i < collectibles.length; i++) {
    for (let j = i + 1; j < collectibles.length; j++) {
      const a = collectibles[i].position;
      const b = collectibles[j].position;
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      assert.ok(d > collectibles[i].radius + collectibles[j].radius);
    }
  }
});

test('collectible and goal meshes belong to the group at their positions', () => {
  const { group, collectibles, goal } = createLevel();
  for (const item of [...collectibles, goal]) {
    assert.ok(item.mesh instanceof THREE.Object3D);
    let inGroup = false;
    item.mesh.traverseAncestors((a) => {
      if (a === group) inGroup = true;
    });
    assert.ok(inGroup, 'mesh is not in the level group');
    assert.ok(item.mesh.position.distanceTo(new THREE.Vector3(
      item.position.x, item.position.y, item.position.z)) < 1e-6);
  }
  const meshes = collectibles.map((c) => c.mesh);
  assert.equal(new Set([...meshes, goal.mesh]).size, 6);
});

test('fall plane is below the whole level', () => {
  const { solids, fallY, collectibles, goal, spawn } = createLevel();
  for (const s of solids) assert.ok(fallY < s.min.y);
  assert.ok(fallY < spawn.y);
  assert.ok(fallY < goal.position.y);
  for (const c of collectibles) assert.ok(fallY < c.position.y);
});

test('goal and every collectible are reachable with the player jump', () => {
  const { spawn, solids, collectibles, goal } = createLevel();
  // Conservative limits: jump 9, gravity 24 peaks at 1.69; speed 6 covers far more than 2.5.
  const reachable = new Set([supportOf(solids, spawn)]);
  const queue = [...reachable];
  while (queue.length) {
    const from = queue.shift();
    for (const to of solids) {
      if (reachable.has(to)) continue;
      if (to.max.y - from.max.y <= MAX_RISE && horizontalGap(from, to) <= MAX_GAP) {
        reachable.add(to);
        queue.push(to);
      }
    }
  }
  assert.ok(reachable.has(platformUnder(solids, goal.position)), 'goal unreachable');
  for (const c of collectibles) {
    assert.ok(reachable.has(platformUnder(solids, c.position)), `${c.id} unreachable`);
  }
});

test('each call builds an independent level', () => {
  const a = createLevel();
  const b = createLevel();
  assert.notEqual(a.group, b.group);
  assert.notEqual(a.collectibles[0].mesh, b.collectibles[0].mesh);
  a.solids[0].min.x = 999;
  assert.notEqual(b.solids[0].min.x, 999);
});
