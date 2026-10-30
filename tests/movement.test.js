import { describe, it, expect } from 'vitest';
import {
  cameraRelativeDirection,
  applyGravity,
  applyJump,
  accelerateHorizontal,
  applyFriction,
  moveTowards,
  GRAVITY,
  MAX_FALL_SPEED,
  JUMP_SPEED,
  MOVE_SPEED,
} from '../src/player/movement.js';

const len = (v) => Math.hypot(v.x, v.z);

describe('cameraRelativeDirection', () => {
  it('maps forward to -z when the camera yaw is 0', () => {
    const d = cameraRelativeDirection({ forward: true }, 0);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-1);
  });

  it('maps backward to +z and right to +x at yaw 0', () => {
    const back = cameraRelativeDirection({ backward: true }, 0);
    expect(back.z).toBeCloseTo(1);
    const right = cameraRelativeDirection({ right: true }, 0);
    expect(right.x).toBeCloseTo(1);
    expect(right.z).toBeCloseTo(0);
  });

  it('rotates with the camera yaw', () => {
    // A quarter turn to the left (positive yaw) makes forward point to -x.
    const d = cameraRelativeDirection({ forward: true }, Math.PI / 2);
    expect(d.x).toBeCloseTo(-1);
    expect(d.z).toBeCloseTo(0);
  });

  it('normalizes diagonal input', () => {
    const d = cameraRelativeDirection({ forward: true, right: true }, 0.7);
    expect(len(d)).toBeCloseTo(1);
  });

  it('returns a zero vector for no input or opposing input', () => {
    expect(cameraRelativeDirection({}, 1.2)).toEqual({ x: 0, z: 0 });
    expect(cameraRelativeDirection({ left: true, right: true }, 0)).toEqual({ x: 0, z: 0 });
  });
});

describe('applyGravity', () => {
  it('accelerates downward over time', () => {
    expect(applyGravity(0, 0.5, -20, -100)).toBeCloseTo(-10);
  });

  it('clamps to the terminal fall speed', () => {
    expect(applyGravity(-49, 1, -20, -50)).toBe(-50);
    expect(applyGravity(-50, 1, -20, -50)).toBe(-50);
  });

  it('slows an upward velocity without clamping it', () => {
    expect(applyGravity(10, 0.25, -20, -50)).toBeCloseTo(5);
  });

  it('uses the default gravity and fall limit', () => {
    expect(applyGravity(0, 0.1)).toBeCloseTo(GRAVITY * 0.1);
    expect(applyGravity(0, 100)).toBe(MAX_FALL_SPEED);
  });
});

describe('applyJump', () => {
  it('sets upward velocity to the jump speed', () => {
    expect(applyJump(0, 12)).toBe(12);
  });

  it('replaces a downward velocity', () => {
    expect(applyJump(-15, 12)).toBe(12);
  });

  it('defaults to the standard jump speed', () => {
    expect(applyJump(0)).toBe(JUMP_SPEED);
  });
});

describe('accelerateHorizontal', () => {
  it('accelerates toward the wanted direction at the acceleration rate', () => {
    const v = accelerateHorizontal({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.1, 8, 10);
    expect(v.x).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('reaches but never exceeds the target speed', () => {
    let v = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) v = accelerateHorizontal(v, { x: 1, z: 0 }, 0.1, 8, 50);
    expect(len(v)).toBeCloseTo(8);
  });

  it('caps diagonal speed to the target speed', () => {
    const d = Math.SQRT1_2;
    let v = { x: 0, z: 0 };
    for (let i = 0; i < 200; i++) v = accelerateHorizontal(v, { x: d, z: d }, 0.1, 8, 50);
    expect(len(v)).toBeCloseTo(8);
  });

  it('defaults to the standard move speed', () => {
    const v = accelerateHorizontal({ x: 0, z: 0 }, { x: 0, z: -1 }, 100);
    expect(v.z).toBeCloseTo(-MOVE_SPEED);
  });

  it('does not mutate the input velocity', () => {
    const v = { x: 1, z: 2 };
    accelerateHorizontal(v, { x: 1, z: 0 }, 0.1, 8, 10);
    expect(v).toEqual({ x: 1, z: 2 });
  });
});

describe('applyFriction', () => {
  it('reduces horizontal speed exponentially', () => {
    const v = applyFriction({ x: 6, z: 0 }, 0.1, 10);
    expect(v.x).toBeCloseTo(6 * Math.exp(-1));
    expect(v.z).toBeCloseTo(0);
  });

  it('snaps to zero once nearly stopped', () => {
    expect(applyFriction({ x: 0.005, z: -0.005 }, 0.016, 12)).toEqual({ x: 0, z: 0 });
    expect(applyFriction({ x: 1, z: -1 }, 100, 12)).toEqual({ x: 0, z: 0 });
  });

  it('keeps the direction of motion', () => {
    const v = applyFriction({ x: 3, z: 4 }, 0.1, 5);
    expect(len(v)).toBeCloseTo(5 * Math.exp(-0.5));
    expect(v.x / v.z).toBeCloseTo(3 / 4);
  });

  it('does not mutate the input velocity', () => {
    const v = { x: 3, z: 4 };
    applyFriction(v, 0.1, 5);
    expect(v).toEqual({ x: 3, z: 4 });
  });
});

describe('moveTowards', () => {
  it('steps toward a higher target', () => {
    expect(moveTowards(0, 10, 3)).toBe(3);
  });

  it('steps toward a lower target', () => {
    expect(moveTowards(10, 0, 3)).toBe(7);
  });

  it('does not overshoot the target', () => {
    expect(moveTowards(9, 10, 3)).toBe(10);
    expect(moveTowards(1, 0, 3)).toBe(0);
  });

  it('stays put when already at the target', () => {
    expect(moveTowards(5, 5, 3)).toBe(5);
  });
});
