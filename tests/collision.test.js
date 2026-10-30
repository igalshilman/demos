import { describe, it, expect } from 'vitest';
import { aabbOverlap, groundHeightAt, moveAndSlide } from '../src/world/collision.js';

// Boxes are { min: {x,y,z}, max: {x,y,z} }; bodies are a feet position plus radius and height.
const box = (minX, minY, minZ, maxX, maxY, maxZ) => ({
  min: { x: minX, y: minY, z: minZ },
  max: { x: maxX, y: maxY, z: maxZ },
});

const RADIUS = 0.5;
const HEIGHT = 1.8;
const floor = box(-50, -1, -50, 50, 0, 50);
const still = { x: 0, y: 0, z: 0 };
const dt = 1 / 60;

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
    expect(groundHeightAt([floor, platform], 2, 2, 3)).toBe(3);
  });

  it('returns the floor height away from raised platforms', () => {
    expect(groundHeightAt([floor, platform], 10, 10, 3)).toBe(0);
  });

  it('ignores surfaces above the feet', () => {
    expect(groundHeightAt([floor, platform], 2, 2, 1)).toBe(0);
  });

  it('picks the highest surface at or below the feet when boxes are stacked', () => {
    const upper = box(1, 3, 1, 3, 5, 3);
    expect(groundHeightAt([floor, platform, upper], 2, 2, 6)).toBe(5);
    expect(groundHeightAt([floor, platform, upper], 2, 2, 4)).toBe(3);
  });

  it('returns -Infinity when nothing is below', () => {
    expect(groundHeightAt([platform], 20, 20, 5)).toBe(-Infinity);
  });

  it('uses the body radius for the footprint', () => {
    expect(groundHeightAt([platform], 4.3, 2, 5, 0)).toBe(-Infinity);
    expect(groundHeightAt([platform], 4.3, 2, 5, RADIUS)).toBe(3);
  });

  it('does not mutate its inputs', () => {
    const colliders = [floor, platform];
    const snapshot = JSON.parse(JSON.stringify(colliders));
    groundHeightAt(colliders, 2, 2, 3);
    expect(colliders).toEqual(snapshot);
  });
});

describe('moveAndSlide', () => {
  it('moves freely through empty space', () => {
    const r = moveAndSlide([], { x: 0, y: 5, z: 0 }, { x: 6, y: 0, z: 0 }, 1, RADIUS, HEIGHT);
    expect(r.position.x).toBeCloseTo(6);
    expect(r.position.y).toBeCloseTo(5);
    expect(r.grounded).toBe(false);
  });

  it('lands on the ground and zeroes vertical velocity', () => {
    const r = moveAndSlide([floor], { x: 0, y: 0.05, z: 0 }, { x: 0, y: -20, z: 0 }, dt, RADIUS, HEIGHT);
    expect(r.position.y).toBeCloseTo(0);
    expect(r.velocity.y).toBe(0);
    expect(r.grounded).toBe(true);
  });

  it('lands on a raised platform', () => {
    const platform = box(-2, 0, -2, 2, 3, 2);
    const r = moveAndSlide([floor, platform], { x: 0, y: 3.05, z: 0 }, { x: 0, y: -20, z: 0 }, dt, RADIUS, HEIGHT);
    expect(r.position.y).toBeCloseTo(3);
    expect(r.grounded).toBe(true);
  });

  it('stays grounded when resting on the ground', () => {
    const r = moveAndSlide([floor], { x: 0, y: 0, z: 0 }, still, dt, RADIUS, HEIGHT);
    expect(r.position.y).toBeCloseTo(0);
    expect(r.grounded).toBe(true);
  });

  it('is not grounded while moving upward', () => {
    const r = moveAndSlide([floor], { x: 0, y: 0, z: 0 }, { x: 0, y: 10, z: 0 }, dt, RADIUS, HEIGHT);
    expect(r.position.y).toBeGreaterThan(0);
    expect(r.grounded).toBe(false);
  });

  it('stops at a wall and slides along it', () => {
    const wall = box(2, 0, -10, 3, 10, 10);
    const r = moveAndSlide([floor, wall], { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 10 }, 0.5, RADIUS, HEIGHT);
    // Blocked on x at the wall face (wall.min.x - radius), free along z.
    expect(r.position.x).toBeCloseTo(1.5);
    expect(r.position.z).toBeCloseTo(5);
    expect(r.velocity.x).toBe(0);
    expect(r.velocity.z).toBeCloseTo(10);
  });

  it('does not mutate its inputs', () => {
    const position = { x: 0, y: 0.05, z: 0 };
    const velocity = { x: 3, y: -20, z: 1 };
    const colliders = [floor];
    const snapshot = JSON.parse(JSON.stringify({ position, velocity, colliders }));
    moveAndSlide(colliders, position, velocity, dt, RADIUS, HEIGHT);
    expect({ position, velocity, colliders }).toEqual(snapshot);
  });
});
