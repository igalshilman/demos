import { describe, expect, it, vi } from 'vitest';
import { Box3, BufferGeometry, Material, Mesh, Vector3 } from 'three';
import { createWorld } from '../src/world';

const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.5;
const MAX_GAP = 1.5;
const MAX_RISE = 1;
const MIN_LANDING = 2.5;

const topOf = (b: Box3) => b.max.y;

function horizontalGap(a: Box3, b: Box3): number {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}

function overlapsXZ(a: Box3, b: Box3): boolean {
  return a.min.x < b.max.x && a.max.x > b.min.x && a.min.z < b.max.z && a.max.z > b.min.z;
}

function supportIndex(solids: Box3[], p: Vector3, eps = 1e-6): number {
  return solids.findIndex(
    (s) =>
      Math.abs(topOf(s) - p.y) <= eps &&
      p.x >= s.min.x &&
      p.x <= s.max.x &&
      p.z >= s.min.z &&
      p.z <= s.max.z,
  );
}

function reachable(solids: Box3[], start: number): Set<number> {
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length) {
    const i = queue.shift()!;
    solids.forEach((s, j) => {
      if (seen.has(j)) return;
      const rise = topOf(s) - topOf(solids[i]);
      if (rise <= MAX_RISE && horizontalGap(solids[i], s) <= MAX_GAP) {
        seen.add(j);
        queue.push(j);
      }
    });
  }
  return seen;
}

function meshes(root: { traverse: (f: (o: any) => void) => void }): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

function coinMeshes(world: ReturnType<typeof createWorld>): Mesh[] {
  return meshes(world.group).filter((m) => m.userData.coinId !== undefined);
}

describe('createWorld data', () => {
  it('has exactly eight unique coins with finite positions', () => {
    const { data } = createWorld();
    expect(data.coins).toHaveLength(8);
    expect(new Set(data.coins.map((c) => c.id)).size).toBe(8);
    const keys = data.coins.map((c) => c.position.toArray().join(','));
    expect(new Set(keys).size).toBe(8);
    for (const c of data.coins) {
      expect(c.position.toArray().every(Number.isFinite)).toBe(true);
    }
  });

  it('has valid, non-empty, axis-aligned solids', () => {
    const { data } = createWorld();
    expect(data.solids.length).toBeGreaterThan(1);
    for (const s of data.solids) {
      expect(s.isEmpty()).toBe(false);
      const size = s.getSize(new Vector3());
      expect(size.x).toBeGreaterThan(0);
      expect(size.y).toBeGreaterThan(0);
      expect(size.z).toBeGreaterThan(0);
    }
  });

  it('keeps every platform a generous landing', () => {
    const { data } = createWorld();
    for (const s of data.solids) {
      const size = s.getSize(new Vector3());
      expect(size.x).toBeGreaterThanOrEqual(MIN_LANDING);
      expect(size.z).toBeGreaterThanOrEqual(MIN_LANDING);
    }
  });

  it('spawns on a platform, well away from its edge, with headroom', () => {
    const { data } = createWorld();
    const i = supportIndex(data.solids, data.spawn);
    expect(i).toBeGreaterThanOrEqual(0);
    const s = data.solids[i];
    const margin = Math.min(
      data.spawn.x - s.min.x,
      s.max.x - data.spawn.x,
      data.spawn.z - s.min.z,
      s.max.z - data.spawn.z,
    );
    expect(margin).toBeGreaterThanOrEqual(2);
    for (const other of data.solids) {
      if (other === s) continue;
      const blocks =
        data.spawn.x + PLAYER_RADIUS > other.min.x &&
        data.spawn.x - PLAYER_RADIUS < other.max.x &&
        data.spawn.z + PLAYER_RADIUS > other.min.z &&
        data.spawn.z - PLAYER_RADIUS < other.max.z &&
        other.max.y > data.spawn.y &&
        other.min.y < data.spawn.y + PLAYER_HEIGHT;
      expect(blocks).toBe(false);
    }
  });

  it('places the kill plane below every platform', () => {
    const { data } = createWorld();
    for (const s of data.solids) expect(data.killY).toBeLessThan(s.min.y);
    expect(data.killY).toBeLessThan(data.spawn.y);
  });

  it('puts the first coin on the spawn platform, about 0.8 above the surface', () => {
    const { data } = createWorld();
    const spawnPlatform = data.solids[supportIndex(data.solids, data.spawn)];
    const first = data.coins[0];
    expect(first.position.x).toBeGreaterThanOrEqual(spawnPlatform.min.x);
    expect(first.position.x).toBeLessThanOrEqual(spawnPlatform.max.x);
    expect(first.position.z).toBeGreaterThanOrEqual(spawnPlatform.min.z);
    expect(first.position.z).toBeLessThanOrEqual(spawnPlatform.max.z);
    expect(first.position.y - topOf(spawnPlatform)).toBeCloseTo(0.8, 5);
  });

  it('places every coin above a platform, about 0.8 above its top, with headroom', () => {
    const { data } = createWorld();
    for (const c of data.coins) {
      const below = data.solids.filter(
        (s) =>
          c.position.x >= s.min.x &&
          c.position.x <= s.max.x &&
          c.position.z >= s.min.z &&
          c.position.z <= s.max.z &&
          topOf(s) <= c.position.y,
      );
      expect(below.length).toBe(1);
      expect(c.position.y - topOf(below[0])).toBeCloseTo(0.8, 5);
      for (const s of data.solids) {
        const inside = s.containsPoint(c.position);
        expect(inside).toBe(false);
      }
    }
  });

  it('spreads coins across several platforms, not clumped at the start', () => {
    const { data } = createWorld();
    const platforms = new Set(
      data.coins.map((c) =>
        data.solids.findIndex(
          (s) =>
            c.position.x >= s.min.x &&
            c.position.x <= s.max.x &&
            c.position.z >= s.min.z &&
            c.position.z <= s.max.z,
        ),
      ),
    );
    expect(platforms.size).toBeGreaterThanOrEqual(6);
    const maxDistance = Math.max(...data.coins.map((c) => c.position.distanceTo(data.spawn)));
    expect(maxDistance).toBeGreaterThan(15);
  });

  it('has a goal box that contains a player standing on the finish platform', () => {
    const { data } = createWorld();
    expect(data.goal.isEmpty()).toBe(false);
    const i = data.solids.findIndex(
      (s) =>
        data.goal.min.x >= s.min.x &&
        data.goal.max.x <= s.max.x &&
        data.goal.min.z >= s.min.z &&
        data.goal.max.z <= s.max.z &&
        data.goal.min.y <= topOf(s) &&
        data.goal.max.y > topOf(s) + PLAYER_HEIGHT,
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const s = data.solids[i];
    const center = data.goal.getCenter(new Vector3());
    const feet = new Vector3(center.x, topOf(s), center.z);
    expect(data.goal.containsPoint(feet)).toBe(true);
    expect(data.goal.containsPoint(feet.clone().setY(topOf(s) + PLAYER_HEIGHT))).toBe(true);
    // The finish is the highest point on the course.
    for (const other of data.solids) expect(topOf(other)).toBeLessThanOrEqual(topOf(s));
  });
});

describe('course traversability', () => {
  it('connects every platform to the spawn with jumpable gaps and rises', () => {
    const { data } = createWorld();
    const start = supportIndex(data.solids, data.spawn);
    const seen = reachable(data.solids, start);
    expect(seen.size).toBe(data.solids.length);
  });

  it('can reach every coin and the goal', () => {
    const { data } = createWorld();
    const seen = reachable(data.solids, supportIndex(data.solids, data.spawn));
    const platformOf = (p: Vector3) =>
      data.solids.findIndex(
        (s) => p.x >= s.min.x && p.x <= s.max.x && p.z >= s.min.z && p.z <= s.max.z && topOf(s) <= p.y,
      );
    for (const c of data.coins) expect(seen.has(platformOf(c.position))).toBe(true);
    const gc = data.goal.getCenter(new Vector3());
    gc.y = data.goal.max.y;
    expect(seen.has(platformOf(gc))).toBe(true);
  });

  it('keeps consecutive route platforms within gap and rise limits', () => {
    const { data } = createWorld();
    for (let i = 1; i < data.solids.length; i++) {
      const a = data.solids[i - 1];
      const b = data.solids[i];
      expect(horizontalGap(a, b)).toBeLessThanOrEqual(MAX_GAP);
      expect(horizontalGap(a, b)).toBeGreaterThan(0);
      expect(topOf(b) - topOf(a)).toBeLessThanOrEqual(MAX_RISE);
    }
  });

  it('never overlaps platforms and leaves overhead clearance above every surface', () => {
    const { data } = createWorld();
    data.solids.forEach((a, i) => {
      data.solids.forEach((b, j) => {
        if (i === j) return;
        expect(a.intersectsBox(b) && overlapsXZ(a, b)).toBe(false);
        if (overlapsXZ(a, b) && b.min.y >= topOf(a)) {
          expect(b.min.y - topOf(a)).toBeGreaterThanOrEqual(PLAYER_HEIGHT);
        }
      });
    });
  });
});

describe('collection state', () => {
  it('has one visible mesh per coin', () => {
    const world = createWorld();
    const ms = coinMeshes(world);
    expect(ms).toHaveLength(8);
    expect(new Set(ms.map((m) => m.userData.coinId))).toEqual(new Set(world.data.coins.map((c) => c.id)));
    for (const m of ms) expect(m.visible).toBe(true);
    for (const c of world.data.coins) {
      const m = ms.find((x) => x.userData.coinId === c.id)!;
      expect(m.position.distanceTo(c.position)).toBeLessThan(1e-9);
    }
  });

  it('hides only collected coins and restores them on an empty set', () => {
    const world = createWorld();
    const before = JSON.stringify(world.data);
    const ids = world.data.coins.map((c) => c.id);
    world.setCollected(new Set([ids[0], ids[3]]));
    for (const m of coinMeshes(world)) {
      expect(m.visible).toBe(![ids[0], ids[3]].includes(m.userData.coinId));
    }
    world.setCollected(new Set(ids.slice(0, 2)));
    for (const m of coinMeshes(world)) {
      expect(m.visible).toBe(!ids.slice(0, 2).includes(m.userData.coinId));
    }
    world.setCollected(new Set(ids));
    for (const m of coinMeshes(world)) expect(m.visible).toBe(false);
    world.setCollected(new Set());
    for (const m of coinMeshes(world)) expect(m.visible).toBe(true);
    expect(world.data.coins).toHaveLength(8);
    expect(JSON.stringify(world.data)).toBe(before);
  });

  it('ignores unknown ids', () => {
    const world = createWorld();
    world.setCollected(new Set(['nope']));
    for (const m of coinMeshes(world)) expect(m.visible).toBe(true);
  });
});

describe('lifecycle', () => {
  it('uses a modest number of primitive meshes with shared materials', () => {
    const world = createWorld();
    const ms = meshes(world.group);
    expect(ms.length).toBeLessThanOrEqual(60);
    const mats = new Set(ms.map((m) => m.material as Material));
    expect(mats.size).toBeLessThan(ms.length / 2);
  });

  it('creates independent worlds each time', () => {
    const a = createWorld();
    const b = createWorld();
    expect(a.group).not.toBe(b.group);
    expect(a.data.solids[0]).not.toBe(b.data.solids[0]);
    a.setCollected(new Set(a.data.coins.map((c) => c.id)));
    for (const m of coinMeshes(b)) expect(m.visible).toBe(true);
    a.dispose();
    b.dispose();
  });

  it('disposes each geometry and material exactly once, even when called twice', () => {
    const world = createWorld();
    const geos = new Set<BufferGeometry>();
    const mats = new Set<Material>();
    for (const m of meshes(world.group)) {
      geos.add(m.geometry);
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
    }
    const spies = [...geos, ...mats].map((r) => vi.spyOn(r, 'dispose'));
    world.dispose();
    world.dispose();
    expect(spies.length).toBeGreaterThan(0);
    for (const s of spies) expect(s).toHaveBeenCalledTimes(1);
  });

  it('survives repeated create/dispose cycles', () => {
    for (let i = 0; i < 5; i++) {
      const w = createWorld();
      expect(w.data.coins).toHaveLength(8);
      w.dispose();
      expect(w.group.children).toHaveLength(0);
    }
  });
});
