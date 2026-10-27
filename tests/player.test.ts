import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { createPlayer, PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/player';
import type { InputFrame } from '../src/contracts';

const DT = 1 / 60;
const idle: InputFrame = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false, cameraYaw: 0 };
const input = (p: Partial<InputFrame> = {}): InputFrame => ({ ...idle, ...p });
const box = (min: [number, number, number], max: [number, number, number]): Box3 =>
  new Box3(new Vector3(...min), new Vector3(...max));
const floor = (): Box3 => box([-100, -1, -100], [100, 0, 100]);

function run(player: ReturnType<typeof createPlayer>, seconds: number, i: InputFrame, solids: Box3[], dt = DT): void {
  const n = Math.round(seconds / dt);
  for (let k = 0; k < n; k++) player.update(dt, k === 0 ? i : { ...i, jumpPressed: false }, solids);
}

function settled(spawn = new Vector3(0, 0, 0), solids: Box3[] = [floor()]) {
  const p = createPlayer(spawn);
  p.update(DT, idle, solids);
  return p;
}

describe('player movement', () => {
  it('spawns at the given feet position and grounds on the first tick', () => {
    const p = createPlayer(new Vector3(1, 0, 2));
    expect(p.position.toArray()).toEqual([1, 0, 2]);
    expect(p.group.position).toBe(p.position);
    p.update(DT, idle, [floor()]);
    expect(p.grounded).toBe(true);
    expect(p.position.y).toBe(0);
    expect(p.velocity.y).toBe(0);
  });

  it('walks forward (-Z at yaw 0) at 5 u/s', () => {
    const p = settled();
    run(p, 1, input({ moveZ: 1 }), [floor()]);
    expect(p.position.z).toBeCloseTo(-5, 5);
    expect(p.position.x).toBeCloseTo(0, 5);
  });

  it('sprints at 8 u/s', () => {
    const p = settled();
    run(p, 1, input({ moveZ: 1, sprint: true }), [floor()]);
    expect(p.position.z).toBeCloseTo(-8, 5);
  });

  it('strafes right (+X at yaw 0) and backwards', () => {
    const p = settled();
    run(p, 1, input({ moveX: 1 }), [floor()]);
    expect(p.position.x).toBeCloseTo(5, 5);
    run(p, 1, input({ moveZ: -1 }), [floor()]);
    expect(p.position.z).toBeCloseTo(5, 5);
  });

  it('normalizes diagonal input', () => {
    const p = settled();
    run(p, 1, input({ moveX: 1, moveZ: 1 }), [floor()]);
    expect(Math.hypot(p.position.x, p.position.z)).toBeCloseTo(5, 5);
    expect(p.position.x).toBeCloseTo(5 / Math.SQRT2, 5);
    expect(p.position.z).toBeCloseTo(-5 / Math.SQRT2, 5);
  });

  it('moves relative to camera yaw', () => {
    const p = settled();
    run(p, 1, input({ moveZ: 1, cameraYaw: Math.PI / 2 }), [floor()]);
    expect(p.position.x).toBeCloseTo(5, 5);
    expect(p.position.z).toBeCloseTo(0, 5);
    const q = settled();
    run(q, 1, input({ moveX: 1, cameraYaw: Math.PI / 2 }), [floor()]);
    expect(q.position.z).toBeCloseTo(5, 5);
  });

  it('stops when input is released', () => {
    const p = settled();
    run(p, 0.5, input({ moveZ: 1 }), [floor()]);
    const z = p.position.z;
    run(p, 0.5, idle, [floor()]);
    expect(p.position.z).toBe(z);
  });

  it('rotates the visual toward the travel direction', () => {
    const p = settled();
    run(p, 0.5, input({ moveX: 1 }), [floor()]);
    // model front is -Z; rotation.y = -PI/2 turns it toward +X
    expect(p.group.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
    run(p, 0.5, idle, [floor()]);
    expect(p.group.rotation.y).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('does not move on non-finite input', () => {
    const p = settled();
    p.update(DT, input({ moveX: NaN, moveZ: Infinity, cameraYaw: NaN }), [floor()]);
    expect(Number.isFinite(p.position.x + p.position.y + p.position.z)).toBe(true);
    p.update(NaN, idle, [floor()]);
    p.update(-1, idle, [floor()]);
    expect(Number.isFinite(p.position.x + p.position.y + p.position.z)).toBe(true);
  });
});

describe('player jumping and landing', () => {
  it('jumps with impulse 9 and lands back at the same height', () => {
    const solids = [floor()];
    const p = settled();
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.grounded).toBe(false);
    expect(p.velocity.y).toBeGreaterThan(8);
    let peak = 0;
    let steps = 0;
    while (!p.grounded && steps++ < 200) {
      p.update(DT, idle, solids);
      peak = Math.max(peak, p.position.y);
    }
    expect(peak).toBeGreaterThan(1.5);
    expect(peak).toBeLessThan(1.8);
    expect(p.grounded).toBe(true);
    expect(p.position.y).toBe(0);
    expect(p.velocity.y).toBe(0);
  });

  it('cannot jump in mid-air', () => {
    const solids = [floor()];
    const p = settled();
    p.update(DT, input({ jumpPressed: true }), solids);
    for (let i = 0; i < 5; i++) p.update(DT, idle, solids);
    const vy = p.velocity.y;
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.velocity.y).toBeLessThan(vy);
  });

  it('can jump again after landing, but a held press only jumps once per call', () => {
    const solids = [floor()];
    const p = settled();
    p.update(DT, input({ jumpPressed: true }), solids);
    let steps = 0;
    while (!p.grounded && steps++ < 200) p.update(DT, idle, solids);
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.velocity.y).toBeGreaterThan(8);
  });

  it('only jumps once per update even with a large dt', () => {
    const solids = [floor()];
    const p = settled();
    p.update(0.1, input({ jumpPressed: true }), solids);
    // one impulse, then gravity for 0.1s at most
    expect(p.velocity.y).toBeLessThanOrEqual(9);
    expect(p.position.y).toBeLessThan(1);
  });

  it('lands on a platform top', () => {
    const solids = [floor(), box([-2, 0, -2], [2, 1, 2])];
    const p = createPlayer(new Vector3(0, 4, 0));
    run(p, 2, idle, solids);
    expect(p.grounded).toBe(true);
    expect(p.position.y).toBe(1);
  });

  it('does not tunnel through a thin floor at high fall speed or large dt', () => {
    const thin = [box([-10, -0.05, -10], [10, 0, 10])];
    const p = createPlayer(new Vector3(0, 200, 0));
    for (let i = 0; i < 400; i++) p.update(0.1, idle, thin);
    expect(p.position.y).toBe(0);
    expect(p.grounded).toBe(true);
  });

  it('bumps its head on a ceiling and falls back', () => {
    const solids = [floor(), box([-2, 1.9, -2], [2, 2.5, 2])];
    const p = settled(new Vector3(0, 0, 0), solids);
    p.update(DT, input({ jumpPressed: true }), solids);
    let maxY = 0;
    let hit = false;
    for (let i = 0; i < 120 && !(hit && p.grounded); i++) {
      p.update(DT, idle, solids);
      maxY = Math.max(maxY, p.position.y);
      if (p.position.y + PLAYER_HEIGHT >= 1.9 - 1e-9 && p.velocity.y <= 0) hit = true;
    }
    expect(maxY).toBeCloseTo(1.9 - PLAYER_HEIGHT, 6);
    expect(hit).toBe(true);
    expect(p.position.y).toBe(0);
  });

  it('falls off a ledge and is no longer grounded', () => {
    const solids = [box([-5, -1, -5], [5, 0, 5])];
    const p = settled(new Vector3(0, 0, 0), solids);
    run(p, 1.2, input({ moveX: 1 }), solids);
    expect(p.position.x).toBeGreaterThan(5 + PLAYER_RADIUS);
    expect(p.grounded).toBe(false);
    expect(p.position.y).toBeLessThan(0);
    expect(p.velocity.y).toBeLessThan(0);
  });

  it('stays grounded while standing on the very edge of a platform', () => {
    const solids = [box([-5, -1, -5], [5, 0, 5])];
    const p = settled(new Vector3(5, 0, 0), solids);
    p.update(DT, idle, solids);
    expect(p.grounded).toBe(true);
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.velocity.y).toBeGreaterThan(8);
  });
});

describe('player walls', () => {
  const wall = box([2, 0, -10], [3, 3, 10]);

  it('is stopped by a wall using the radius', () => {
    const solids = [floor(), wall];
    const p = settled(new Vector3(0, 0, 0), solids);
    run(p, 2, input({ moveX: 1 }), solids);
    expect(p.position.x).toBeCloseTo(2 - PLAYER_RADIUS, 9);
  });

  it('slides along a wall on diagonal input', () => {
    const solids = [floor(), wall];
    const p = settled(new Vector3(0, 0, 0), solids);
    run(p, 1, input({ moveX: 1, moveZ: 1, cameraYaw: 0 }), solids);
    expect(p.position.x).toBeCloseTo(2 - PLAYER_RADIUS, 9);
    expect(p.position.z).toBeLessThan(-1);
  });

  it('is stopped by a wall in each direction', () => {
    const solids = [floor(), box([-10, 0, -3], [10, 3, -2]), box([-10, 0, 2], [10, 3, 3]), box([-3, 0, -10], [-2, 3, 10])];
    const p = settled(new Vector3(0, 0, 0), solids);
    run(p, 1, input({ moveZ: 1 }), solids);
    expect(p.position.z).toBeCloseTo(-2 + PLAYER_RADIUS, 9);
    run(p, 1, input({ moveX: -1 }), solids);
    expect(p.position.x).toBeCloseTo(-2 + PLAYER_RADIUS, 9);
    run(p, 2, input({ moveZ: -1 }), solids);
    expect(p.position.z).toBeCloseTo(2 - PLAYER_RADIUS, 9);
  });

  it('does not tunnel through a thin wall at sprint speed with large dt', () => {
    const thin = box([5, 0, -10], [5.02, 3, 10]);
    const solids = [floor(), thin];
    const p = settled(new Vector3(0, 0, 0), solids);
    for (let i = 0; i < 20; i++) p.update(0.1, input({ moveX: 1, sprint: true }), solids);
    expect(p.position.x).toBeCloseTo(5 - PLAYER_RADIUS, 9);
  });

  it('can walk off the floor and past a wall that is below its feet', () => {
    const solids = [floor(), box([2, -2, -10], [3, 0, 10])];
    const p = settled(new Vector3(0, 0, 0), solids);
    run(p, 1, input({ moveX: 1 }), solids);
    expect(p.position.x).toBeCloseTo(5, 5);
  });
});

describe('player timestep handling', () => {
  it('large dt is bounded: never advances more than 0.1s of motion', () => {
    const solids = [floor()];
    const p = settled();
    p.update(10, input({ moveZ: 1 }), solids);
    expect(p.position.z).toBeCloseTo(-0.5, 5);
  });

  it('matches between a fixed step and a larger step closely on flat ground', () => {
    const solids = [floor()];
    const a = settled();
    const b = settled();
    for (let i = 0; i < 60; i++) a.update(1 / 60, input({ moveZ: 1 }), solids);
    for (let i = 0; i < 30; i++) b.update(1 / 30, input({ moveZ: 1 }), solids);
    expect(a.position.z).toBeCloseTo(b.position.z, 5);
  });

  it('is deterministic', () => {
    const solids = [floor(), box([2, 0, -10], [3, 3, 10]), box([-2, 0, -4], [0, 1, -2])];
    const trace = (): number[] => {
      const p = createPlayer(new Vector3(0, 3, 0));
      const out: number[] = [];
      for (let i = 0; i < 300; i++) {
        p.update(i % 3 ? 1 / 60 : 0.03, input({ moveX: Math.sin(i / 20), moveZ: 1, jumpPressed: i % 50 === 0, cameraYaw: i / 100 }), solids);
        out.push(p.position.x, p.position.y, p.position.z);
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});

describe('player reset and lifecycle', () => {
  it('reset restores position, velocity and transient state', () => {
    const solids = [floor()];
    const p = settled();
    run(p, 0.3, input({ moveX: 1, sprint: true }), solids);
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.grounded).toBe(false);
    p.reset(new Vector3(3, 0, 4));
    expect(p.position.toArray()).toEqual([3, 0, 4]);
    expect(p.velocity.toArray()).toEqual([0, 0, 0]);
    expect(p.grounded).toBe(false);
    expect(p.group.rotation.y).toBe(0);
    p.update(DT, idle, solids);
    expect(p.grounded).toBe(true);
    expect(p.position.toArray()).toEqual([3, 0, 4]);
  });

  it('can jump on the first tick after reset', () => {
    const solids = [floor()];
    const p = settled();
    p.reset(new Vector3(0, 0, 0));
    p.update(DT, input({ jumpPressed: true }), solids);
    expect(p.velocity.y).toBeGreaterThan(8);
  });

  it('reset does not copy the spawn vector by reference', () => {
    const spawn = new Vector3(1, 0, 1);
    const p = createPlayer(spawn);
    spawn.set(9, 9, 9);
    expect(p.position.toArray()).toEqual([1, 0, 1]);
    p.reset(spawn);
    spawn.set(0, 0, 0);
    expect(p.position.toArray()).toEqual([9, 9, 9]);
  });

  it('never mutates solids', () => {
    const solids = [floor(), box([2, 0, -10], [3, 3, 10]), box([-2, 1.9, -2], [2, 2.5, 2])];
    const before = solids.map((b) => b.clone());
    const p = createPlayer(new Vector3(0, 1, 0));
    for (let i = 0; i < 200; i++) p.update(DT, input({ moveX: 1, moveZ: 1, jumpPressed: i % 40 === 0 }), solids);
    p.reset(new Vector3());
    solids.forEach((b, i) => expect(b.equals(before[i])).toBe(true));
    expect(solids).toHaveLength(3);
  });

  it('has a visual group with meshes that dispose cleanly', () => {
    const p = createPlayer(new Vector3());
    expect(p.group.children.length).toBeGreaterThan(2);
    let disposed = 0;
    p.group.traverse((o) => {
      const m = o as unknown as { geometry?: { addEventListener: (t: string, f: () => void) => void }; material?: { addEventListener: (t: string, f: () => void) => void } };
      m.geometry?.addEventListener('dispose', () => disposed++);
      m.material?.addEventListener('dispose', () => disposed++);
    });
    p.dispose();
    expect(disposed).toBeGreaterThan(0);
    expect(p.group.children).toHaveLength(0);
    p.dispose();
  });
});
