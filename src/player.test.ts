import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createPlayer, JUMP_VELOCITY, MOVE_SPEED, PLAYER_HALF_WIDTH, PLAYER_HEIGHT } from './player';

const none = { moveX: 0, moveZ: 0, jumpPressed: false };
const floor = new Box3(new Vector3(-50, -1, -50), new Vector3(50, 0, 50));
const DT = 1 / 60;

function run(player: ReturnType<typeof createPlayer>, seconds: number, input = none, colliders: Box3[] = [floor], dt = DT) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) player.update(dt, input, colliders);
}

describe('player', () => {
  it('lands on the floor and does not sink while idle or walking', () => {
    const p = createPlayer(new Vector3(0, 3, 0));
    run(p, 2);
    expect(p.root.position.y).toBeCloseTo(0, 6);
    run(p, 2, { moveX: 1, moveZ: 0, jumpPressed: false });
    expect(p.root.position.y).toBeCloseTo(0, 6);
    expect(p.root.position.x).toBeGreaterThan(5);
  });

  it('does not tunnel through a thin floor on a big timestep', () => {
    const thin = new Box3(new Vector3(-5, -0.05, -5), new Vector3(5, 0, 5));
    const p = createPlayer(new Vector3(0, 30, 0));
    run(p, 3, none, [thin], 0.1);
    expect(p.root.position.y).toBeCloseTo(0, 6);
  });

  it('is stopped by walls and does not penetrate them', () => {
    const wall = new Box3(new Vector3(2, 0, -5), new Vector3(3, 3, 5));
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 2, { moveX: 1, moveZ: 0, jumpPressed: false }, [floor, wall]);
    expect(p.root.position.x).toBeCloseTo(2 - PLAYER_HALF_WIDTH, 6);
    const q = createPlayer(new Vector3(6, 0, 0));
    run(q, 2, { moveX: -1, moveZ: 0, jumpPressed: false }, [floor, wall]);
    expect(q.root.position.x).toBeCloseTo(3 + PLAYER_HALF_WIDTH, 6);
  });

  it('slides along a wall when moving diagonally and is blocked on Z walls', () => {
    const wall = new Box3(new Vector3(-5, 0, -3), new Vector3(5, 3, -2));
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 1, { moveX: 1, moveZ: -1, jumpPressed: false }, [floor, wall]);
    expect(p.root.position.z).toBeCloseTo(-2 + PLAYER_HALF_WIDTH, 6);
    expect(p.root.position.x).toBeGreaterThan(3);
  });

  it('bonks its head on an underside and falls back down', () => {
    const ceiling = new Box3(new Vector3(-5, 2, -5), new Vector3(5, 3, 5));
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 0.1);
    p.update(DT, { ...none, jumpPressed: true }, [floor, ceiling]);
    let maxY = 0;
    for (let i = 0; i < 120; i++) {
      p.update(DT, none, [floor, ceiling]);
      maxY = Math.max(maxY, p.root.position.y + PLAYER_HEIGHT);
    }
    expect(maxY).toBeLessThanOrEqual(2 + 1e-6);
    expect(p.root.position.y).toBeCloseTo(0, 6);
  });

  it('stands on top of a box and walks off its edge', () => {
    const box = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 1, 1));
    const p = createPlayer(new Vector3(0, 3, 0));
    run(p, 1, none, [floor, box]);
    expect(p.root.position.y).toBeCloseTo(1, 6);
    run(p, 1, { moveX: 1, moveZ: 0, jumpPressed: false }, [floor, box]);
    expect(p.root.position.y).toBeCloseTo(0, 6);
  });

  it('normalizes diagonal movement', () => {
    const a = createPlayer(new Vector3(0, 0, 0));
    run(a, 0.5);
    const start = a.root.position.clone();
    run(a, 1, { moveX: 1, moveZ: -1, jumpPressed: false });
    const dist = a.root.position.clone().sub(start).length();
    expect(dist).toBeCloseTo(MOVE_SPEED, 1);
    expect(a.root.position.x).toBeGreaterThan(0);
    expect(a.root.position.z).toBeLessThan(0);
  });

  it('jumps once per grounded press and rejects airborne jumps', () => {
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 0.2);
    p.update(DT, { ...none, jumpPressed: true }, [floor]);
    expect(p.root.position.y).toBeGreaterThan(0);
    let maxY = 0;
    for (let i = 0; i < 20; i++) {
      p.update(DT, none, [floor]);
      p.update(DT, { ...none, jumpPressed: true }, [floor]);
      maxY = Math.max(maxY, p.root.position.y);
    }
    // Apex of a single jump: v^2 / 2g = 1.6
    expect(maxY).toBeCloseTo((JUMP_VELOCITY * JUMP_VELOCITY) / 40, 1);
    expect(maxY).toBeLessThan(2);
  });

  it('does not re-jump while the key is held after landing', () => {
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 0.2);
    run(p, 2, { ...none, jumpPressed: true });
    expect(p.root.position.y).toBeCloseTo(0, 6);
  });

  it('reset restores position, clears velocity and grounded', () => {
    const p = createPlayer(new Vector3(0, 0, 0));
    run(p, 0.2);
    p.update(DT, { ...none, jumpPressed: true }, [floor]);
    run(p, 0.1, { moveX: 1, moveZ: 0, jumpPressed: false });
    p.reset(new Vector3(10, 5, -4));
    expect(p.root.position.toArray()).toEqual([10, 5, -4]);
    // no leftover upward velocity or horizontal drift in an empty world
    p.update(DT, none, []);
    expect(p.root.position.x).toBe(10);
    expect(p.root.position.z).toBe(-4);
    expect(p.root.position.y).toBeLessThan(5);
    // not grounded after reset: cannot jump in mid-air
    p.reset(new Vector3(10, 5, -4));
    p.update(DT, { ...none, jumpPressed: true }, []);
    expect(p.root.position.y).toBeLessThan(5);
  });

  it('gives consistent results across timesteps', () => {
    const wall = new Box3(new Vector3(4, 0, -5), new Vector3(5, 3, 5));
    const sim = (dt: number) => {
      const p = createPlayer(new Vector3(0, 0, 0));
      run(p, 0.2, none, [floor, wall], dt);
      p.update(dt, { moveX: 1, moveZ: 0, jumpPressed: true }, [floor, wall]);
      run(p, 0.8, { moveX: 1, moveZ: 0, jumpPressed: false }, [floor, wall], dt);
      return p.root.position.clone();
    };
    const a = sim(1 / 30);
    const b = sim(1 / 120);
    expect(a.distanceTo(b)).toBeLessThan(0.15);
  });

  it('keeps the character within its AABB footprint (~0.7 wide, 1.6 tall)', () => {
    const p = createPlayer(new Vector3(0, 0, 0));
    const box = new Box3().setFromObject(p.root);
    expect(box.max.y - box.min.y).toBeCloseTo(1.6, 1);
    expect(box.max.x - box.min.x).toBeLessThanOrEqual(0.75);
  });

  it('camera sits behind (+Z) and above, snaps after reset and follows smoothly', () => {
    const cam = new PerspectiveCamera();
    const p = createPlayer(new Vector3(0, 0, 0));
    p.updateCamera(cam, DT);
    expect(cam.position.z).toBeGreaterThan(p.root.position.z);
    expect(cam.position.y).toBeGreaterThan(p.root.position.y + PLAYER_HEIGHT);
    const snapped = cam.position.clone();

    p.reset(new Vector3(30, 0, 0));
    p.updateCamera(cam, DT);
    expect(cam.position.x).toBeCloseTo(30, 6);
    expect(cam.position.z).toBeCloseTo(snapped.z, 6);

    p.root.position.x += 5;
    p.updateCamera(cam, DT);
    expect(cam.position.x).toBeGreaterThan(30);
    expect(cam.position.x).toBeLessThan(35);
  });
});
