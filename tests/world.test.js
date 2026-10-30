import test from 'node:test';
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
  const findMoving = () => world.boxes.find((b) => b.min.z < -10 && b.max.z > -14 && b.max.y === 1.25);
  const mover = findMoving();
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
  const meshes = [];
  world.group.traverse((o) => { if (o.isMesh && Math.abs(o.position.z + 12) < 1e-9 && o.position.y > 0) meshes.push(o); });
  assert.equal(meshes.length, 1);
  assert.ok(Math.abs(meshes[0].position.x - center()) < 1e-9);
  world.reset();
  assert.ok(Math.abs(center() + 6) < 1e-9);
});

test('player standing on the moving platform is carried', () => {
  const world = createWorld(new THREE.Scene());
  const position = new THREE.Vector3(-6, 1.25, -12);
  const velocity = new THREE.Vector3();
  world.update(0.5);
  const before = position.x;
  const grounded = world.movePlayer(position, velocity, 0.016, 0.4, 1);
  assert.equal(grounded, true);
  assert.ok(position.x > before);
});

test('every platform top is reachable from the previous one with a modest jump', () => {
  const world = createWorld(new THREE.Scene());
  const tops = [1, 1.5, 2, 2.5].map((top, i) => groundHeightAt(world.boxes, 6, -7 - i * 8, 10));
  assert.deepEqual(tops, [1, 1.5, 2, 2.5]);
});
