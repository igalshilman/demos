import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from '../src/world.js';

const PLAYER = { radius: 0.35, height: 1.2, speed: 5, jump: 8, gravity: 20 };
const MAX_RISE = (PLAYER.jump ** 2) / (2 * PLAYER.gravity); // 1.6
const AIRTIME = (2 * PLAYER.jump) / PLAYER.gravity; // 0.8s
const MAX_REACH = PLAYER.speed * AIRTIME; // 4
// Stay well inside the theoretical limits so a human can make every jump.
const SAFE_RISE = MAX_RISE * 0.6;
const SAFE_GAP = MAX_REACH * 0.65;
const EPS = 1e-6;

const world = createWorld();
const { colliders } = world;

const playerBox = (feet) =>
  new THREE.Box3(
    new THREE.Vector3(feet.x - PLAYER.radius, feet.y, feet.z - PLAYER.radius),
    new THREE.Vector3(feet.x + PLAYER.radius, feet.y + PLAYER.height, feet.z + PLAYER.radius),
  );

const size = (box) => box.getSize(new THREE.Vector3());
const isPlatform = (box) => {
  const s = size(box);
  return Math.min(s.x, s.z) >= 2.5;
};
const platforms = colliders.filter(isPlatform);

// Horizontal distance between the top faces' footprints (0 if they overlap).
function footprintGap(a, b) {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}

function canJump(from, to) {
  return to.max.y - from.max.y <= SAFE_RISE && footprintGap(from, to) <= SAFE_GAP;
}

function supportOf(point, feetTolerance = 0.05) {
  return platforms.find(
    (b) =>
      Math.abs(b.max.y - point.y) <= feetTolerance &&
      point.x >= b.min.x && point.x <= b.max.x &&
      point.z >= b.min.z && point.z <= b.max.z,
  );
}

function reachableFrom(start) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of platforms) {
      if (!seen.has(next) && canJump(cur, next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

test('returns the agreed shape', () => {
  assert.ok(world.group instanceof THREE.Group);
  assert.ok(Array.isArray(world.colliders));
  assert.ok(world.spawn instanceof THREE.Vector3);
  assert.ok(Array.isArray(world.collectibles));
  assert.equal(typeof world.respawnY, 'number');
  assert.equal(typeof world.dispose, 'function');
  assert.ok(world.goal.position instanceof THREE.Vector3);
  assert.ok(world.goal.radius > 0);
  assert.ok(world.goal.mesh instanceof THREE.Object3D);
});

test('colliders are valid, non-empty world-space boxes', () => {
  assert.ok(colliders.length > 0);
  for (const box of colliders) {
    assert.ok(box instanceof THREE.Box3);
    assert.equal(box.isEmpty(), false);
    const s = size(box);
    for (const v of [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z]) {
      assert.ok(Number.isFinite(v));
    }
    assert.ok(s.x > 0 && s.y > 0 && s.z > 0);
  }
});

test('spawn is supported, clear of obstacles and above the respawn height', () => {
  const { spawn } = world;
  assert.ok(supportOf(spawn), 'spawn stands on a platform');
  const box = playerBox(spawn);
  // Nudge up a hair so the floor it stands on is not counted as overlap.
  box.min.y += 0.01;
  for (const c of colliders) assert.equal(box.intersectsBox(c), false);
  assert.ok(spawn.y > world.respawnY);
  // Whole body footprint sits on the platform, not just the centre.
  const floor = supportOf(spawn);
  assert.ok(spawn.x - PLAYER.radius >= floor.min.x && spawn.x + PLAYER.radius <= floor.max.x);
  assert.ok(spawn.z - PLAYER.radius >= floor.min.z && spawn.z + PLAYER.radius <= floor.max.z);
});

test('respawn height is below every collider', () => {
  for (const c of colliders) assert.ok(world.respawnY < c.min.y);
});

test('landing areas are broad', () => {
  assert.ok(platforms.length >= 5);
  for (const p of platforms) {
    const s = size(p);
    assert.ok(s.x >= 2.5 && s.z >= 2.5);
  }
});

test('obstacles that are not landing areas are hoppable', () => {
  for (const c of colliders.filter((b) => !isPlatform(b))) {
    const floor = platforms.find((p) => Math.abs(p.max.y - c.min.y) < EPS);
    assert.ok(floor, 'obstacle rests on a platform');
    assert.ok(c.max.y - c.min.y <= SAFE_RISE);
  }
});

test('collectibles: about six, unique ids, consistent data', () => {
  const { collectibles } = world;
  assert.ok(collectibles.length >= 5 && collectibles.length <= 8);
  const ids = collectibles.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of collectibles) {
    assert.equal(typeof c.id, 'string');
    assert.ok(c.id.length > 0);
    assert.ok(c.position instanceof THREE.Vector3);
    assert.ok(c.radius > 0);
    assert.ok(c.mesh instanceof THREE.Object3D);
    assert.ok(c.mesh.position.distanceTo(c.position) < EPS);
    assert.equal(world.group.getObjectById(c.mesh.id), c.mesh);
    for (const other of colliders) {
      assert.equal(other.distanceToPoint(c.position) > c.radius * 0.5, true, `${c.id} clear of collider`);
    }
  }
});

test('goal data is consistent and clear of colliders', () => {
  const { goal } = world;
  assert.ok(goal.mesh.position.distanceTo(goal.position) < EPS);
  assert.equal(world.group.getObjectById(goal.mesh.id), goal.mesh);
  assert.ok(supportOf(goal.position), 'goal stands on a platform');
  for (const c of colliders) assert.ok(c.distanceToPoint(goal.position) > -EPS);
});

test('collectible and goal positions are immutable', () => {
  const c = world.collectibles[0];
  assert.throws(() => { c.position.x = 99; }, TypeError);
  assert.throws(() => { world.goal.position.y = 99; }, TypeError);
  assert.throws(() => { c.id = 'x'; }, TypeError);
  assert.throws(() => { world.collectibles.push({}); }, TypeError);
});

test('goal and every collectible are reachable by jumping from spawn', () => {
  const reach = reachableFrom(supportOf(world.spawn));
  const goalPlatform = supportOf(world.goal.position);
  assert.ok(reach.has(goalPlatform), 'goal platform reachable');
  for (const c of world.collectibles) {
    const below = platforms
      .filter(
        (b) =>
          c.position.x >= b.min.x && c.position.x <= b.max.x &&
          c.position.z >= b.min.z && c.position.z <= b.max.z &&
          b.max.y <= c.position.y,
      )
      .sort((a, b) => b.max.y - a.max.y)[0];
    assert.ok(below, `${c.id} sits above a platform`);
    assert.ok(reach.has(below), `${c.id} platform reachable`);
    // Within a jump's apex from the surface under it.
    assert.ok(c.position.y - below.max.y <= PLAYER.height + MAX_RISE * 0.6 + c.radius);
  }
});

test('every platform in the chain can be reached from the one before', () => {
  const start = supportOf(world.spawn);
  assert.equal(reachableFrom(start).size, platforms.length);
});

test('createWorld returns independent worlds and dispose is safe to repeat', () => {
  const a = createWorld();
  const b = createWorld();
  assert.notEqual(a.group, b.group);
  assert.notEqual(a.colliders, b.colliders);
  let disposed = 0;
  a.group.traverse((o) => {
    if (o.geometry) o.geometry.addEventListener('dispose', () => { disposed++; });
  });
  a.dispose();
  assert.ok(disposed > 0);
  assert.doesNotThrow(() => a.dispose());
  assert.equal(b.group.children.length > 0, true);
  b.dispose();
});
