import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createLevel, type Level } from './level';

const HALF_WIDTH = 0.35;
const HEIGHT = 1.6;
const EPS = 1e-6;

function bodyAt(feet: Vector3): Box3 {
  return new Box3(
    new Vector3(feet.x - HALF_WIDTH, feet.y, feet.z - HALF_WIDTH),
    new Vector3(feet.x + HALF_WIDTH, feet.y + HEIGHT, feet.z + HALF_WIDTH),
  );
}

function shrink(box: Box3, by: number): Box3 {
  return new Box3(box.min.clone().addScalar(by), box.max.clone().addScalar(-by));
}

function supported(feet: Vector3, colliders: readonly Box3[]): boolean {
  return colliders.some(
    (c) =>
      Math.abs(c.max.y - feet.y) < 1e-4 &&
      feet.x >= c.min.x &&
      feet.x <= c.max.x &&
      feet.z >= c.min.z &&
      feet.z <= c.max.z,
  );
}

describe('createLevel', () => {
  it('has valid, untransformed geometry', () => {
    const level = createLevel();
    expect(level.root.position.toArray()).toEqual([0, 0, 0]);
    expect(level.root.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(level.root.scale.toArray()).toEqual([1, 1, 1]);
    expect(level.colliders.length).toBeGreaterThan(0);
    for (const box of level.colliders) {
      expect(box.isEmpty()).toBe(false);
      expect(Number.isFinite(box.min.x + box.min.y + box.min.z + box.max.x + box.max.y + box.max.z)).toBe(true);
    }
  });

  it('has a visual for every collider with exactly the same bounds', () => {
    const level = createLevel();
    level.root.updateMatrixWorld(true);
    const meshes = level.root.children.filter(
      (c): c is Mesh => c instanceof Mesh && c.name.startsWith('block:'),
    );
    expect(meshes).toHaveLength(level.colliders.length);
    for (const box of level.colliders) {
      const match = meshes.some((m) => {
        const b = new Box3().setFromObject(m);
        return b.min.distanceTo(box.min) < EPS && b.max.distanceTo(box.max) < EPS;
      });
      expect(match).toBe(true);
    }
  });

  it('does not mutate static colliders on collect or reset', () => {
    const level = createLevel();
    const before = level.colliders.map((b) => b.clone());
    level.collect(level.collectibles[0].id);
    level.reset();
    level.colliders.forEach((b, i) => expect(b.equals(before[i])).toBe(true));
  });

  it('spawns on a surface with a clear body, away from the edge', () => {
    const { spawn, colliders } = createLevel();
    expect(supported(spawn, colliders)).toBe(true);
    const body = shrink(bodyAt(spawn), 1e-3);
    expect(colliders.some((c) => c.intersectsBox(body))).toBe(false);
    const floor = colliders.find((c) => Math.abs(c.max.y - spawn.y) < 1e-4 && c.containsPoint(new Vector3(spawn.x, spawn.y - 0.1, spawn.z)))!;
    expect(spawn.x - floor.min.x).toBeGreaterThan(1);
    expect(floor.max.x - spawn.x).toBeGreaterThan(1);
    expect(floor.max.z - spawn.z).toBeGreaterThan(1);
  });

  it('keeps nothing tall overhead and lets gaps drop below -12', () => {
    const { colliders } = createLevel();
    const spawnTop = Math.max(...colliders.map((c) => c.max.y));
    expect(spawnTop).toBeLessThanOrEqual(2.1);
    expect(Math.min(...colliders.map((c) => c.min.y))).toBeGreaterThan(-12);
  });

  it('has a visible goal supported by the final platform and overlapping a standing body', () => {
    const level = createLevel();
    const { goal, colliders, root } = level;
    expect(goal.isEmpty()).toBe(false);
    expect(root.getObjectByName('goal')).toBeDefined();
    const goalMesh = root.getObjectByName('goal') as Mesh;
    const gb = new Box3().setFromObject(goalMesh);
    expect(gb.min.distanceTo(goal.min)).toBeLessThan(EPS);
    expect(gb.max.distanceTo(goal.max)).toBeLessThan(EPS);

    const feet = new Vector3((goal.min.x + goal.max.x) / 2, goal.min.y, (goal.min.z + goal.max.z) / 2);
    expect(supported(feet, colliders)).toBe(true);
    expect(goal.intersectsBox(bodyAt(feet))).toBe(true);
    expect(colliders.some((c) => c.intersectsBox(goal) && c.max.y > goal.min.y + 1e-4)).toBe(false);
    expect(goal.max.z).toBeLessThan(-30);
  });

  it('has unique, reachable collectibles with world centers', () => {
    const { collectibles, colliders } = createLevel();
    expect(collectibles.length).toBeGreaterThanOrEqual(5);
    const ids = collectibles.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of collectibles) {
      expect(c.radius).toBeCloseTo(0.35, 5);
      const sphereBox = new Box3().setFromCenterAndSize(c.position, new Vector3(1, 1, 1).multiplyScalar(c.radius * 2));
      expect(colliders.some((b) => b.intersectsBox(sphereBox))).toBe(false);
      // a jump-height player (rise <= 1.6) standing on some surface below can reach it
      const below = colliders.filter(
        (b) => c.position.x >= b.min.x - 1 && c.position.x <= b.max.x + 1 && c.position.z >= b.min.z - 1 && c.position.z <= b.max.z + 1 && b.max.y < c.position.y,
      );
      expect(below.length).toBeGreaterThan(0);
      const top = Math.max(...below.map((b) => b.max.y));
      expect(c.position.y - c.radius - top).toBeLessThan(1.6);
    }
  });

  it('collects idempotently, ignores unknown ids and restores on reset', () => {
    const level = createLevel();
    const visual = (id: string) => level.root.getObjectByName(`collectible:${id}`)!;
    for (const c of level.collectibles) expect(visual(c.id).visible).toBe(true);

    const [first, second] = level.collectibles;
    level.collect(first.id);
    level.collect(first.id);
    expect(visual(first.id).visible).toBe(false);
    expect(visual(second.id).visible).toBe(true);

    expect(() => level.collect('nope')).not.toThrow();
    expect(level.collectibles).toHaveLength(5);

    level.reset();
    level.reset();
    for (const c of level.collectibles) expect(visual(c.id).visible).toBe(true);
  });
});

describe('route', () => {
  // Minimal player simulation: speed 5, jump 8, gravity 20, 0.7 x 1.6 body.
  function simulate(level: Level, waypoints: Vector3[], jumpWhen: (feet: Vector3, dir: Vector3) => boolean) {
    const feet = level.spawn.clone();
    let vy = 0;
    let grounded = true;
    const dt = 1 / 120;
    const hit = (f: Vector3) => {
      const b = shrink(bodyAt(f), 1e-6);
      return level.colliders.some((c) => c.intersectsBox(b));
    };
    let target = 0;
    const touched: Vector3[] = [];
    for (let i = 0; i < 120 * 60 && target < waypoints.length; i++) {
      const to = waypoints[target].clone().sub(feet);
      to.y = 0;
      if (to.length() < 0.15) {
        target++;
        continue;
      }
      to.normalize().multiplyScalar(5 * dt);
      if (grounded && jumpWhen(feet, to.clone().normalize())) {
        vy = 8;
        grounded = false;
      }
      for (const axis of ['x', 'z'] as const) {
        const next = feet.clone();
        next[axis] += to[axis];
        if (!hit(next)) feet[axis] = next[axis];
      }
      vy -= 20 * dt;
      const next = feet.clone();
      next.y += vy * dt;
      if (hit(next)) {
        if (vy < 0) grounded = true;
        vy = 0;
        // snap onto the surface we landed on
        const top = level.colliders.filter((c) => c.min.x < feet.x + 0.35 && c.max.x > feet.x - 0.35 && c.min.z < feet.z + 0.35 && c.max.z > feet.z - 0.35 && c.max.y <= feet.y + 0.8).reduce((m, c) => Math.max(m, c.max.y), -Infinity);
        if (Number.isFinite(top) && grounded) feet.y = top;
      } else {
        feet.y = next.y;
        grounded = false;
      }
      if (feet.y < -12) return { fell: true, feet, level, touched };
      for (const c of level.collectibles) {
        const nearest = bodyAt(feet).clampPoint(c.position, new Vector3());
        if (nearest.distanceTo(c.position) <= c.radius) {
          if (!touched.includes(c.position)) touched.push(c.position);
        }
      }
    }
    return { fell: false, feet, level, touched, done: target >= waypoints.length };
  }

  // Jump when the ground ahead is missing or a step/block is in the way.
  const autoJump = (level: Level) => (feet: Vector3, dir: Vector3) => {
    const probe = feet.clone().addScaledVector(dir, 0.6);
    const body = shrink(bodyAt(probe), 1e-3);
    if (level.colliders.some((c) => c.intersectsBox(body))) return true;
    const under = new Vector3(probe.x, feet.y - 0.05, probe.z);
    return !level.colliders.some((c) => c.containsPoint(under));
  };

  it('can be walked and jumped from spawn to the goal along the main path', () => {
    const level = createLevel();
    const wp = [
      new Vector3(0, 0, -1),
      new Vector3(0, 0, -34),
      new Vector3(0, 0, -36),
    ];
    const result = simulate(level, wp, autoJump(level));
    expect(result.fell).toBe(false);
    expect(result.done).toBe(true);
    expect(level.goal.intersectsBox(bodyAt(result.feet))).toBe(true);
    // the main path alone picks up every collectible except the detour one
    const picked = level.collectibles.filter((c) => result.touched.includes(c.position));
    expect(picked.map((c) => c.id)).not.toContain('gem-detour');
    expect(picked).toHaveLength(level.collectibles.length - 1);
  });

  it('reaches the detour collectible and still gets back to the goal', () => {
    const level = createLevel();
    const wp = [
      new Vector3(0, 0, -1),
      new Vector3(0, 0, -19.2),
      new Vector3(6.2, 0, -19.2),
      new Vector3(0, 0, -19.2),
      new Vector3(0, 0, -34),
      new Vector3(0, 0, -36),
    ];
    const result = simulate(level, wp, autoJump(level));
    expect(result.fell).toBe(false);
    expect(result.done).toBe(true);
    expect(result.touched).toContain(level.collectibles.find((c) => c.id === 'gem-detour')!.position);
    expect(level.goal.intersectsBox(bodyAt(result.feet))).toBe(true);
  });
});
