import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { aabbOverlap, groundHeightAt, moveAndSlide } from '../src/world/collision.js';
import { createWorld } from '../src/world/world.js';

const box = (minX, minY, minZ, maxX, maxY, maxZ) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

test('aabbOverlap detects overlap, separation and touching', () => {
  const a = box(0, 0, 0, 2, 2, 2);
  assert.equal(aabbOverlap(a, box(1, 1, 1, 3, 3, 3)), true);
  assert.equal(aabbOverlap(a, box(3, 0, 0, 4, 2, 2)), false);
  assert.equal(aabbOverlap(a, box(2, 0, 0, 4, 2, 2)), false);
  assert.equal(aabbOverlap(a, box(0, 3, 0, 2, 4, 2)), false);
});

test('groundHeightAt returns highest top at or below feet, else -Infinity', () => {
  const boxes = [box(-10, -1, -10, 10, 0, 10), box(-1, 0, -1, 1, 2, 1)];
  assert.equal(groundHeightAt(boxes, 0, 0, 5), 2);
  assert.equal(groundHeightAt(boxes, 0, 0, 1), 0);
  assert.equal(groundHeightAt(boxes, 0, 0, 1.98), 0);
  assert.equal(groundHeightAt(boxes, 0, 0, 1.99 + 0.02), 2);
  assert.equal(groundHeightAt(boxes, 5, 5, 5), 0);
  assert.equal(groundHeightAt(boxes, 50, 50, 5), -Infinity);
  assert.equal(groundHeightAt(boxes, 0, 0, -5), -Infinity);
});

test('moveAndSlide lands on a surface, zeroes vertical velocity and does not mutate inputs', () => {
  const boxes = [box(-10, -1, -10, 10, 0, 10)];
  const position = { x: 0, y: 0.1, z: 0 };
  const velocity = { x: 0, y: -10, z: 0 };
  const result = moveAndSlide(boxes, position, velocity, 0.1, 0.4, 1);
  assert.equal(result.grounded, true);
  assert.equal(result.position.y, 0);
  assert.equal(result.velocity.y, 0);
  assert.deepEqual(position, { x: 0, y: 0.1, z: 0 });
  assert.deepEqual(velocity, { x: 0, y: -10, z: 0 });
});

test('moveAndSlide stays grounded when resting and is airborne when jumping', () => {
  const boxes = [box(-10, -1, -10, 10, 0, 10)];
  const resting = moveAndSlide(boxes, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.016, 0.4, 1);
  assert.equal(resting.grounded, true);
  const jumping = moveAndSlide(boxes, { x: 0, y: 0, z: 0 }, { x: 0, y: 8, z: 0 }, 0.016, 0.4, 1);
  assert.equal(jumping.grounded, false);
  assert.ok(jumping.position.y > 0);
});

test('moveAndSlide slides along walls', () => {
  const boxes = [box(-10, -1, -10, 10, 0, 10), box(2, 0, -5, 3, 3, 5)];
  const result = moveAndSlide(boxes, { x: 1.4, y: 0, z: 0 }, { x: 5, y: 0, z: 3 }, 0.1, 0.4, 1);
  assert.ok(Math.abs(result.position.x - 1.6) < 1e-9);
  assert.equal(result.velocity.x, 0);
  assert.ok(Math.abs(result.position.z - 0.3) < 1e-9);
  assert.equal(result.velocity.z, 3);
});

test('moveAndSlide resolves existing horizontal penetration', () => {
  const boxes = [box(-10, -1, -10, 10, 0, 10), box(2, 0, -5, 3, 3, 5)];
  const fromLeft = moveAndSlide(boxes, { x: 1.8, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.016, 0.4, 1);
  assert.ok(fromLeft.position.x <= 1.6 + 1e-9);
  const fromRight = moveAndSlide(boxes, { x: 3.2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.016, 0.4, 1);
  assert.ok(fromRight.position.x >= 3.4 - 1e-9);
});

test('moveAndSlide bumps head on a ceiling', () => {
  const boxes = [box(-10, 2, -10, 10, 3, 10)];
  const result = moveAndSlide(boxes, { x: 0, y: 0.9, z: 0 }, { x: 0, y: 10, z: 0 }, 0.1, 0.4, 1);
  assert.equal(result.velocity.y, 0);
  assert.ok(Math.abs(result.position.y - 1) < 1e-9);
});

test('createWorld exposes the expected API and layout', () => {
  const scene = new THREE.Scene();
  const world = createWorld(scene);
  assert.ok(scene.children.includes(world.group));
  assert.deepEqual(world.spawn.toArray(), [0, 0.1, 0]);
  assert.equal(world.coinPositions.length, 10);
  assert.ok(world.goalPosition instanceof THREE.Vector3);
  assert.ok(world.boxes.length > 0);
  for (const c of world.coinPositions) {
    assert.ok(c.x >= -25 && c.x <= 25 && c.z >= -50 && c.z <= 10);
  }
  assert.equal(groundHeightAt(world.boxes, 0, 0, 0.1), 0);
  assert.equal(groundHeightAt(world.boxes, 6, -7, 5), 1);
  assert.equal(groundHeightAt(world.boxes, -6, -31, 5), 2.5);
  assert.equal(groundHeightAt(world.boxes, 0, -41, 10), 3);
});

test('no collision boxes overlap the spawn or each other unexpectedly at spawn', () => {
  const world = createWorld(new THREE.Scene());
  const p = world.spawn;
  const player = box(p.x - 0.4, p.y, p.z - 0.4, p.x + 0.4, p.y + 1, p.z + 0.4);
  const hits = world.boxes.filter((b) => aabbOverlap(player, b));
  assert.equal(hits.length, 0);
});

test('movePlayer writes results back to Vector3s and lands on ground', () => {
  const world = createWorld(new THREE.Scene());
  const position = world.spawn.clone();
  const velocity = new THREE.Vector3(0, -5, 0);
  const grounded = world.movePlayer(position, velocity, 0.1, 0.4, 1);
  assert.equal(grounded, true);
  assert.equal(position.y, 0);
  assert.equal(velocity.y, 0);
});

test('perimeter walls block the player', () => {
  const world = createWorld(new THREE.Scene());
  const position = new THREE.Vector3(24, 0, 0);
  const velocity = new THREE.Vector3(30, 0, 0);
  world.movePlayer(position, velocity, 0.1, 0.4, 1);
  assert.ok(Math.abs(position.x - 24.6) < 1e-9);
  assert.equal(velocity.x, 0);
});

test('moving platform oscillates between -6 and 6, box follows mesh, reset restores', () => {
  const world = createWorld(new THREE.Scene());
  const mover = world.movingPlatform.box;
  assert.ok(world.boxes.includes(mover));
  assert.ok(mover);
  const center = () => (mover.min.x + mover.max.x) / 2;
  assert.ok(Math.abs(center() + 6) < 1e-9);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < 800; i += 1) {
    world.update(0.01);
    min = Math.min(min, center());
    max = Math.max(max, center());
  }
  assert.ok(min >= -6 - 1e-9 && max <= 6 + 1e-9);
  assert.ok(max > 5.9 && min < -5.9);
  world.update(2);
  assert.ok(Math.abs(world.movingPlatform.mesh.position.x - center()) < 1e-9);
  world.reset();
  assert.ok(Math.abs(center() + 6) < 1e-9);
});

// Rider simulation at frame intervals, in the game's order: world.update, then the player move.
function rideFor(world, offsetFromCenter, dt, seconds, radius = 0.45, height = 1.8) {
  const mover = world.movingPlatform.box;
  const center = () => (mover.min.x + mover.max.x) / 2;
  const position = new THREE.Vector3(center() + offsetFromCenter, mover.max.y, (mover.min.z + mover.max.z) / 2);
  const velocity = new THREE.Vector3();
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i += 1) {
    world.update(dt);
    velocity.y = Math.max(velocity.y - 30 * dt, -45);
    const grounded = world.movePlayer(position, velocity, dt, radius, height);
    assert.equal(grounded, true, `frame ${i} offset ${offsetFromCenter} dt ${dt}`);
    assert.ok(Math.abs(position.y - mover.max.y) < 1e-9);
    assert.ok(Math.abs(position.x - center() - offsetFromCenter) < 1e-6, `drifted at frame ${i}`);
  }
}

test('riders are carried at every position on the platform, including both edges and the radius margin', () => {
  // 8 s covers a full period: rightward leg (left edge trails) then leftward leg (right edge trails).
  for (const dt of [1 / 60, 1 / 30, 0.05]) {
    for (const offset of [-2.4, -2, -1.9, 0, 1.9, 2, 2.4]) {
      rideFor(createWorld(new THREE.Scene()), offset, dt, 8);
    }
  }
});

test('a rider on the trailing edge is carried on the very first frame of each direction', () => {
  const world = createWorld(new THREE.Scene());
  const mover = world.movingPlatform.box;
  const mid = (mover.min.z + mover.max.z) / 2;
  // Platform starts at x=-6 and moves right, so its left edge trails.
  const position = new THREE.Vector3(mover.min.x + 0.01, mover.max.y, mid);
  const velocity = new THREE.Vector3();
  world.update(1 / 60);
  assert.equal(world.movePlayer(position, velocity, 1 / 60, 0.45, 1.8), true);
  assert.ok(Math.abs(position.x - (mover.min.x + 0.01)) < 1e-9, 'rider keeps its place on the platform');
  assert.equal(position.y, mover.max.y);
});

test('a player beside the platform (not on it) is not carried', () => {
  const world = createWorld(new THREE.Scene());
  const mover = world.movingPlatform.box;
  const position = new THREE.Vector3(mover.min.x - 1.5, 0, (mover.min.z + mover.max.z) / 2);
  const velocity = new THREE.Vector3();
  const x0 = position.x;
  world.update(0.1);
  world.movePlayer(position, velocity, 0.1, 0.45, 1.8);
  assert.equal(position.x, x0);
});

test('carry is applied once per update', () => {
  const world = createWorld(new THREE.Scene());
  const mover = world.movingPlatform.box;
  const position = new THREE.Vector3(mover.min.x + 2, mover.max.y, (mover.min.z + mover.max.z) / 2);
  const velocity = new THREE.Vector3();
  world.update(0.5);
  world.movePlayer(position, velocity, 0.016, 0.45, 1.8);
  const x1 = position.x;
  world.movePlayer(position, velocity, 0.016, 0.45, 1.8);
  assert.equal(position.x, x1);
});

test('moveAndSlide also accepts centre position + half extents (unit-test call form)', () => {
  const floor = box(-50, -1, -50, 50, 0, 50);
  const half = { x: 0.5, y: 1, z: 0.5 };
  const landed = moveAndSlide({ x: 0, y: 1.05, z: 0 }, { x: 0, y: -20, z: 0 }, half, [floor], 1 / 60);
  assert.ok(Math.abs(landed.position.y - 1) < 1e-9);
  assert.equal(landed.velocity.y, 0);
  assert.equal(landed.onGround, true);
  assert.equal(groundHeightAt([floor], 0, 0), 0);
});
