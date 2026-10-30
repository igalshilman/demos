import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createWorld } from '../src/world.js';

const MAX_RISE = 1.2;
const MAX_GAP = 2;
const HALF_WIDTH = 0.35;

function supportTop(solids, x, z, below = Infinity) {
  let best = -Infinity;
  for (const b of solids) {
    if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= below) {
      best = Math.max(best, b.max.y);
    }
  }
  return best;
}

function horizontalGap(a, b) {
  const dx = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const dz = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return Math.hypot(dx, dz);
}

describe('createWorld', () => {
  it('returns the agreed interface', () => {
    const scene = new THREE.Scene();
    const world = createWorld(scene);
    expect(world.spawn).toBeInstanceOf(THREE.Vector3);
    expect(Number.isFinite(world.killY)).toBe(true);
    expect(Array.isArray(world.solids)).toBe(true);
    expect(Array.isArray(world.collectibles)).toBe(true);
    expect(typeof world.dispose).toBe('function');
  });

  it('has exactly five collectibles with unique ids attached to the scene', () => {
    const scene = new THREE.Scene();
    const { collectibles } = createWorld(scene);
    expect(collectibles).toHaveLength(5);
    expect(new Set(collectibles.map((c) => c.id)).size).toBe(5);
    for (const c of collectibles) {
      expect(c.position).toBeInstanceOf(THREE.Vector3);
      expect(c.position.toArray().every(Number.isFinite)).toBe(true);
      expect(c.mesh.parent).toBe(scene);
      expect(c.mesh.position.distanceTo(c.position)).toBeLessThan(1e-9);
    }
  });

  it('has valid, finite, non-empty collision boxes', () => {
    const { solids } = createWorld(new THREE.Scene());
    expect(solids.length).toBeGreaterThan(1);
    for (const b of solids) {
      expect(b).toBeInstanceOf(THREE.Box3);
      expect(b.isEmpty()).toBe(false);
      for (const v of [...b.min.toArray(), ...b.max.toArray()]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      const size = b.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(0);
      expect(size.y).toBeGreaterThan(0);
      expect(size.z).toBeGreaterThan(0);
    }
  });

  it('spawns safely just above a supporting surface, with killY below the level', () => {
    const { spawn, solids, killY } = createWorld(new THREE.Scene());
    const top = supportTop(solids, spawn.x, spawn.z);
    expect(Number.isFinite(top)).toBe(true);
    expect(spawn.y).toBeGreaterThanOrEqual(top);
    expect(spawn.y - top).toBeLessThan(0.5);
    // the spawn point is not inside any solid
    const feetToHead = new THREE.Box3(
      new THREE.Vector3(spawn.x - HALF_WIDTH, spawn.y + 0.01, spawn.z - HALF_WIDTH),
      new THREE.Vector3(spawn.x + HALF_WIDTH, spawn.y + 1.6, spawn.z + HALF_WIDTH),
    );
    expect(solids.some((b) => b.intersectsBox(feetToHead))).toBe(false);
    const lowest = Math.min(...solids.map((b) => b.min.y));
    expect(killY).toBeLessThan(lowest);
    expect(killY).toBeLessThan(spawn.y);
  });

  it('places pickups about 0.9 above a supporting platform', () => {
    const { collectibles, solids } = createWorld(new THREE.Scene());
    for (const c of collectibles) {
      const top = supportTop(solids, c.position.x, c.position.z);
      expect(Number.isFinite(top)).toBe(true);
      expect(c.position.y - top).toBeGreaterThan(0.8);
      expect(c.position.y - top).toBeLessThan(1.0);
      // pickup is not embedded in any solid
      expect(solids.some((b) => b.containsPoint(c.position))).toBe(false);
    }
  });

  it('keeps every platform and pickup reachable within jump limits', () => {
    const { solids, spawn, collectibles } = createWorld(new THREE.Scene());
    const start = solids.find(
      (b) =>
        spawn.x >= b.min.x && spawn.x <= b.max.x && spawn.z >= b.min.z && spawn.z <= b.max.z,
    );
    const reached = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const next of solids) {
        if (reached.has(next)) continue;
        if (next.max.y - cur.max.y <= MAX_RISE && horizontalGap(cur, next) <= MAX_GAP) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    expect(reached.size).toBe(solids.length);
    for (const c of collectibles) {
      const top = supportTop(solids, c.position.x, c.position.z);
      expect(solids.some((b) => reached.has(b) && b.max.y === top)).toBe(true);
    }
  });

  it('disposes owned objects and resources', () => {
    const scene = new THREE.Scene();
    const before = scene.children.length;
    const world = createWorld(scene);
    expect(scene.children.length).toBeGreaterThan(before);

    const meshes = [];
    scene.traverse((o) => o.isMesh && meshes.push(o));
    const geometries = new Set(meshes.map((m) => m.geometry));
    const materials = new Set(meshes.flatMap((m) => [m.material].flat()));
    const geoDisposed = new Set();
    const matDisposed = new Set();
    geometries.forEach((g) => g.addEventListener('dispose', () => geoDisposed.add(g)));
    materials.forEach((m) => m.addEventListener('dispose', () => matDisposed.add(m)));

    world.dispose();
    expect(scene.children.length).toBe(before);
    expect(geoDisposed.size).toBe(geometries.size);
    expect(matDisposed.size).toBe(materials.size);
    expect(() => world.dispose()).not.toThrow();
  });
});
