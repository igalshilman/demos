import { describe, it, expect } from 'vitest';
import { aabbOverlap, groundHeightAt, moveAndSlide } from '../src/world/collision.js';

// Boxes are { min: {x,y,z}, max: {x,y,z} }.
const box = (minX, minY, minZ, maxX, maxY, maxZ) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

const half = { x: 0.5, y: 1, z: 0.5 };
const floor = box(-50, -1, -50, 50, 0, 50);

describe('aabbOverlap', () => {
  it('detects overlapping boxes', () => {
    expect(aabbOverlap(box(0, 0, 0, 2, 2, 2), box(1, 1, 1, 3, 3, 3))).toBe(true);
  });

  it('detects a box fully contained in another', () => {
    expect(aabbOverlap(box(0, 0, 0, 10, 10, 10), box(4, 4, 4, 5, 5, 5))).toBe(true);
  });

  it('returns false for separated boxes on each axis', () => {
    const a = box(0, 0, 0, 1, 1, 1);
    expect(aabbOverlap(a, box(2, 0, 0, 3, 1, 1))).toBe(false);
    expect(aabbOverlap(a, box(0, 2, 0, 1, 3, 1))).toBe(false);
    expect(aabbOverlap(a, box(0, 0, 2, 1, 1, 3))).toBe(false);
  });

  it('is symmetric', () => {
    const a = box(0, 0, 0, 2, 2, 2);
    const b = box(1, 1, 1, 3, 3, 3);
    const c = box(5, 5, 5, 6, 6, 6);
    expect(aabbOverlap(a, b)).toBe(aabbOverlap(b, a));
    expect(aabbOverlap(a, c)).toBe(aabbOverlap(c, a));
  });

  it('does not count boxes that merely touch as overlapping', () => {
    expect(aabbOverlap(box(0, 0, 0, 1, 1, 1), box(1, 0, 0, 2, 1, 1))).toBe(false);
  });
});

describe('groundHeightAt', () => {
  const platform = box(0, 0, 0, 4, 3, 4);

  it('returns the top of the box under the point', () => {
    expect(groundHeightAt([floor, platform], 2, 2)).toBe(3);
  });

  it('returns the floor height away from raised platforms', () => {
    expect(groundHeightAt([floor, platform], 10, 10)).toBe(0);
  });

  it('picks the highest surface when boxes are stacked', () => {
    const upper = box(1, 3, 1, 3, 5, 3);
    expect(groundHeightAt([floor, platform, upper], 2, 2)).toBe(5);
  });

  it('does not mutate its inputs', () => {
    const colliders = [floor, platform];
    const snapshot = JSON.parse(JSON.stringify(colliders));
    groundHeightAt(colliders, 2, 2);
    expect(colliders).toEqual(snapshot);
  });
});

describe('moveAndSlide', () => {
  const dt = 1 / 60;

  it('moves freely through empty space', () => {
    const result = moveAndSlide({ x: 0, y: 5, z: 0 }, { x: 6, y: 0, z: 0 }, half, [], 1);
    expect(result.position.x).toBeCloseTo(6);
    expect(result.position.y).toBeCloseTo(5);
    expect(result.onGround).toBe(false);
  });

  it('lands on the ground and zeroes vertical velocity', () => {
    const result = moveAndSlide({ x: 0, y: 1.05, z: 0 }, { x: 0, y: -20, z: 0 }, half, [floor], dt);
    expect(result.position.y).toBeCloseTo(1);
    expect(result.velocity.y).toBe(0);
    expect(result.onGround).toBe(true);
  });

  it('lands on a raised platform', () => {
    const platform = box(-2, 0, -2, 2, 3, 2);
    const result = moveAndSlide({ x: 0, y: 4.05, z: 0 }, { x: 0, y: -20, z: 0 }, half, [floor, platform], dt);
    expect(result.position.y).toBeCloseTo(4);
    expect(result.onGround).toBe(true);
  });

  it('stays on the ground when resting there', () => {
    const result = moveAndSlide({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, half, [floor], dt);
    expect(result.position.y).toBeCloseTo(1);
    expect(result.onGround).toBe(true);
  });

  it('is not grounded while moving upward', () => {
    const result = moveAndSlide({ x: 0, y: 1, z: 0 }, { x: 0, y: 10, z: 0 }, half, [floor], dt);
    expect(result.position.y).toBeGreaterThan(1);
    expect(result.onGround).toBe(false);
  });

  it('stops at a wall and slides along it', () => {
    const wall = box(2, 0, -10, 3, 10, 10);
    const result = moveAndSlide(
      { x: 1, y: 1, z: 0 },
      { x: 2, y: 0, z: 10 },
      half,
      [floor, wall],
      0.5,
    );
    // Blocked on x by the wall's face (wall.min.x - half.x), free on z.
    expect(result.position.x).toBeCloseTo(1.5);
    expect(result.position.z).toBeCloseTo(5);
    expect(result.velocity.x).toBe(0);
    expect(result.velocity.z).toBeCloseTo(10);
  });

  it('does not mutate its inputs', () => {
    const position = { x: 0, y: 1.05, z: 0 };
    const velocity = { x: 3, y: -20, z: 1 };
    const halfExtents = { ...half };
    const colliders = [floor];
    const snapshot = JSON.parse(JSON.stringify({ position, velocity, halfExtents, colliders }));
    moveAndSlide(position, velocity, halfExtents, colliders, dt);
    expect({ position, velocity, halfExtents, colliders }).toEqual(snapshot);
  });
});
