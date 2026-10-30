import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer } from '../src/player.js';

const HALF = 0.35;
const HEIGHT = 1.2;

function box(minX, minY, minZ, maxX, maxY, maxZ) {
  return { min: new THREE.Vector3(minX, minY, minZ), max: new THREE.Vector3(maxX, maxY, maxZ) };
}

const floor = () => box(-20, -1, -20, 20, 0, 20);
const idle = { moveX: 0, moveZ: 0, jumpPressed: false };

function run(player, seconds, dt, input) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) player.update(dt, typeof input === 'function' ? input(i) : input);
}

function settle(player) {
  run(player, 1, 1 / 60, idle);
}

test('creates a group at the spawn point and exposes the interface', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 1, y: 2, z: 3 } });
  assert.ok(player.group instanceof THREE.Group);
  assert.ok(player.group.children.length > 0);
  assert.deepEqual(player.position.toArray(), [1, 2, 3]);
  assert.deepEqual(player.group.position.toArray(), [1, 2, 3]);
  assert.equal(player.grounded, false);
  for (const fn of ['update', 'reset', 'dispose']) assert.equal(typeof player[fn], 'function');
});

test('accepts Vector3 and array spawns and Box3 colliders', () => {
  const player = createPlayer({
    colliders: [new THREE.Box3(new THREE.Vector3(-5, -1, -5), new THREE.Vector3(5, 0, 5))],
    spawn: new THREE.Vector3(0, 1, 0),
  });
  settle(player);
  assert.equal(player.position.y, 0);
  assert.deepEqual(createPlayer({ colliders: [], spawn: [4, 5, 6] }).position.toArray(), [4, 5, 6]);
});

test('falls under gravity and lands on the ground', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 3, z: 0 } });
  player.update(1 / 60, idle);
  assert.equal(player.grounded, false);
  assert.ok(player.position.y < 3);
  settle(player);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
  settle(player);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
});

test('free fall follows gravity of 20', () => {
  const player = createPlayer({ colliders: [], spawn: { x: 0, y: 100, z: 0 } });
  run(player, 0.5, 1 / 60, idle);
  const expected = 100 - 0.5 * 20 * 0.25;
  assert.ok(Math.abs(player.position.y - expected) < 0.2, `y=${player.position.y}`);
});

test('moves at speed 5 on world axes', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - 5) < 1e-6);
  assert.ok(Math.abs(player.position.z) < 1e-9);
  run(player, 1, 1 / 60, { moveX: 0, moveZ: -1, jumpPressed: false });
  assert.ok(Math.abs(player.position.z + 5) < 1e-6);
  assert.equal(player.grounded, true);
});

test('diagonal movement is normalized', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 1 / 60, { moveX: 1, moveZ: 1, jumpPressed: false });
  const dist = Math.hypot(player.position.x, player.position.z);
  assert.ok(Math.abs(dist - 5) < 1e-6, `dist=${dist}`);
  assert.ok(Math.abs(player.position.x - player.position.z) < 1e-9);
});

test('analog input below unit length is not amplified', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 1 / 60, { moveX: 0.5, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - 2.5) < 1e-6);
});

test('jump rises with speed 8 and lands again', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  player.update(1 / 60, { ...idle, jumpPressed: true });
  assert.equal(player.grounded, false);
  assert.ok(player.position.y > 0);
  let peak = 0;
  for (let i = 0; i < 120 && !player.grounded; i++) {
    player.update(1 / 60, { ...idle, jumpPressed: true });
    peak = Math.max(peak, player.position.y);
  }
  // v^2 / 2g = 1.6
  assert.ok(Math.abs(peak - 1.6) < 0.1, `peak=${peak}`);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
});

test('jump needs a rising edge: holding the button does not rejump on landing', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  const held = { ...idle, jumpPressed: true };
  player.update(1 / 60, held);
  for (let i = 0; i < 120; i++) player.update(1 / 60, held);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
  player.update(1 / 60, idle);
  player.update(1 / 60, held);
  assert.equal(player.grounded, false);
  assert.ok(player.position.y > 0);
});

test('jump is rejected while airborne', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  player.update(1 / 60, { ...idle, jumpPressed: true });
  run(player, 0.2, 1 / 60, idle);
  const vyBefore = player.position.y;
  player.update(1 / 60, { ...idle, jumpPressed: true });
  player.update(1 / 60, idle);
  player.update(1 / 60, { ...idle, jumpPressed: true });
  const trace = [];
  for (let i = 0; i < 200 && !player.grounded; i++) {
    player.update(1 / 60, idle);
    trace.push(player.position.y);
  }
  assert.ok(Math.max(...trace, vyBefore) < 1.65, 'no double jump boost');
  assert.equal(player.grounded, true);

  const fall = createPlayer({ colliders: [], spawn: { x: 0, y: 10, z: 0 } });
  fall.update(1 / 60, idle);
  const y0 = fall.position.y;
  fall.update(1 / 60, { ...idle, jumpPressed: true });
  assert.ok(fall.position.y < y0, 'still falling after airborne jump press');
});

test('jump press is ignored if the player just walked off an edge', () => {
  const player = createPlayer({ colliders: [box(-5, -1, -5, 0, 0, 5)], spawn: { x: -1, y: 0, z: 0 } });
  settle(player);
  run(player, 0.5, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.equal(player.grounded, false);
  const y = player.position.y;
  player.update(1 / 60, { moveX: 1, moveZ: 0, jumpPressed: true });
  assert.ok(player.position.y < y);
});

test('walls block horizontal movement on both axes and allow sliding', () => {
  const wallX = box(3, 0, -5, 4, 5, 5);
  const player = createPlayer({ colliders: [floor(), wallX], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 2, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - (3 - HALF)) < 1e-6, `x=${player.position.x}`);
  assert.equal(player.grounded, true);

  // pushing diagonally into the wall slides along it
  const z0 = player.position.z;
  run(player, 1, 1 / 60, { moveX: 1, moveZ: 1, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - (3 - HALF)) < 1e-6);
  assert.ok(player.position.z > z0 + 3);

  const wallZ = box(-5, 0, -4, 5, 5, -3);
  const p2 = createPlayer({ colliders: [floor(), wallZ], spawn: { x: 0, y: 0, z: 0 } });
  settle(p2);
  run(p2, 2, 1 / 60, { moveX: 0, moveZ: -1, jumpPressed: false });
  assert.ok(Math.abs(p2.position.z - (-3 + HALF)) < 1e-6, `z=${p2.position.z}`);

  const p3 = createPlayer({ colliders: [floor(), box(-4, 0, -5, -3, 5, 5)], spawn: { x: 0, y: 0, z: 0 } });
  settle(p3);
  run(p3, 2, 1 / 60, { moveX: -1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(p3.position.x - (-3 + HALF)) < 1e-6);
});

test('a fast frame cannot tunnel through a thin wall', () => {
  const wall = box(1, 0, -5, 1.05, 5, 5);
  const player = createPlayer({ colliders: [floor(), wall], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 0.05, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(player.position.x <= 1 - HALF + 1e-6);
});

test('lands on a raised platform and can walk off it', () => {
  const platform = box(2, 0, -2, 5, 1, 2);
  const player = createPlayer({ colliders: [floor(), platform], spawn: { x: 3, y: 4, z: 0 } });
  settle(player);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 1);
  let steps = 0;
  while (player.grounded && steps++ < 120) player.update(1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.equal(player.grounded, false);
  assert.ok(player.position.x > 5 + HALF - 0.1);
  settle(player);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
});

test('a platform wall blocks walking into it from the floor, but a jump can clear it', () => {
  const platform = box(2, 0, -2, 12, 1, 2);
  const player = createPlayer({ colliders: [floor(), platform], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - (2 - HALF)) < 1e-6);
  assert.equal(player.position.y, 0);

  let first = true;
  run(player, 1, 1 / 60, () => {
    const input = { moveX: 1, moveZ: 0, jumpPressed: first };
    first = false;
    return input;
  });
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 1);
  assert.ok(player.position.x > 2);
});

test('hitting a ceiling stops the rise and the player falls back', () => {
  const ceiling = box(-5, 1.5, -5, 5, 2.5, 5);
  const player = createPlayer({ colliders: [floor(), ceiling], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  let maxTop = 0;
  player.update(1 / 60, { ...idle, jumpPressed: true });
  for (let i = 0; i < 120 && !player.grounded; i++) {
    player.update(1 / 60, idle);
    maxTop = Math.max(maxTop, player.position.y + HEIGHT);
  }
  assert.ok(maxTop <= 1.5 + 1e-6, `top=${maxTop}`);
  assert.ok(maxTop > 1.45, 'reached the ceiling');
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
});

test('ceiling contact does not report grounded', () => {
  const ceiling = box(-5, 2, -5, 5, 3, 5);
  const player = createPlayer({ colliders: [ceiling], spawn: { x: 0, y: 0.7, z: 0 } });
  player.update(1 / 60, { ...idle, jumpPressed: true });
  assert.equal(player.grounded, false);
});

test('standing beside a wall flush with the floor does not snag', () => {
  const player = createPlayer({ colliders: [floor(), box(1, 0, -5, 2, 3, 5)], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 1, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  run(player, 1, 1 / 60, { moveX: 0, moveZ: 1, jumpPressed: false });
  assert.ok(Math.abs(player.position.z - 5) < 1e-6);
  assert.equal(player.grounded, true);
});

test('seams between adjacent floor boxes do not snag', () => {
  const colliders = [box(-5, -1, -5, 0, 0, 5), box(0, -1, -5, 5, 0, 5)];
  const player = createPlayer({ colliders, spawn: { x: -4, y: 0, z: 0 } });
  settle(player);
  run(player, 1.5, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - 3.5) < 1e-6);
  assert.equal(player.position.y, 0);
  assert.equal(player.grounded, true);
});

test('edge: stays supported while partly overhanging, and falls once clear', () => {
  const platform = box(-2, -1, -2, 2, 0, 2);
  const partly = createPlayer({ colliders: [platform], spawn: { x: 2.3, y: 0.5, z: 0 } });
  settle(partly);
  assert.equal(partly.grounded, true);
  assert.equal(partly.position.y, 0);

  const clear = createPlayer({ colliders: [platform], spawn: { x: 2.4, y: 0.5, z: 0 } });
  settle(clear);
  assert.equal(clear.grounded, false);
  assert.ok(clear.position.y < 0);
});

test('edge: walking off a ledge turns grounded off immediately after clearing it', () => {
  const player = createPlayer({ colliders: [box(-2, -1, -2, 2, 0, 2)], spawn: { x: 0, y: 0.5, z: 0 } });
  settle(player);
  assert.equal(player.grounded, true);
  let steps = 0;
  while (player.grounded && steps++ < 120) player.update(1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(player.position.x > 2 + HALF - 0.1 && player.position.x < 2 + HALF + 0.2, `x=${player.position.x}`);
});

test('reset returns to spawn with zero velocity', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 1, y: 0, z: 2 } });
  settle(player);
  run(player, 0.5, 1 / 60, { moveX: 1, moveZ: 1, jumpPressed: false });
  player.update(1 / 60, { ...idle, jumpPressed: true });
  player.reset();
  assert.deepEqual(player.position.toArray(), [1, 0, 2]);
  assert.deepEqual(player.group.position.toArray(), [1, 0, 2]);
  assert.equal(player.grounded, false);
  player.update(1 / 60, idle);
  assert.ok(player.position.y <= 0);
  assert.ok(player.position.y > -0.01, 'no leftover velocity');
  assert.equal(player.position.x, 1);
  settle(player);
  assert.equal(player.grounded, true);
});

test('reset keeps the same position object', () => {
  const player = createPlayer({ colliders: [], spawn: { x: 0, y: 5, z: 0 } });
  const ref = player.position;
  run(player, 0.5, 1 / 60, idle);
  player.reset();
  assert.equal(player.position, ref);
  assert.equal(ref.y, 5);
});

test('spawn point is copied, not aliased', () => {
  const spawn = { x: 0, y: 5, z: 0 };
  const player = createPlayer({ colliders: [], spawn });
  spawn.y = 99;
  run(player, 0.2, 1 / 60, idle);
  player.reset();
  assert.equal(player.position.y, 5);
});

test('character faces the direction of travel', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  run(player, 0.5, 1 / 60, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.group.rotation.y - Math.PI / 2) < 1e-6);
  run(player, 0.5, 1 / 60, { moveX: 0, moveZ: -1, jumpPressed: false });
  assert.ok(Math.abs(Math.abs(player.group.rotation.y) - Math.PI) < 1e-6);
  const facing = player.group.rotation.y;
  run(player, 0.2, 1 / 60, idle);
  assert.equal(player.group.rotation.y, facing, 'facing is kept when idle');
});

test('facing turns gradually over the shortest arc', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  player.update(1 / 60, { moveX: 0, moveZ: -1, jumpPressed: false });
  const r = player.group.rotation.y;
  assert.ok(Math.abs(r) > 0 && Math.abs(r) < Math.PI);
});

test('group follows the feet position', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 2, z: 0 } });
  run(player, 1, 1 / 60, { moveX: 1, moveZ: -1, jumpPressed: false });
  assert.deepEqual(player.group.position.toArray(), player.position.toArray());
});

test('frame times above 0.05 are clamped', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  player.update(10, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(player.position.x - 5 * 0.05) < 1e-9);
});

test('zero, negative and invalid dt leave the state unchanged', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  for (const dt of [0, -1, NaN, Infinity]) {
    player.update(dt, { moveX: 1, moveZ: 0, jumpPressed: false });
  }
  assert.deepEqual(player.position.toArray(), [0, 0, 0]);
});

test('missing input fields default to idle', () => {
  const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
  settle(player);
  player.update(1 / 60);
  player.update(1 / 60, {});
  assert.deepEqual(player.position.toArray(), [0, 0, 0]);
});

test('behaviour is representative across frame rates', () => {
  const platform = box(2, 0, -2, 40, 1, 2);
  const results = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 144, 0.05]) {
    const player = createPlayer({ colliders: [floor(), platform], spawn: { x: 0, y: 0, z: 0 } });
    const total = 2;
    let t = 0;
    let jumped = false;
    let peak = 0;
    while (t < total - 1e-9) {
      const jumpPressed = !jumped && t >= 0.1;
      if (jumpPressed) jumped = true;
      player.update(dt, { moveX: 1, moveZ: 0, jumpPressed });
      peak = Math.max(peak, player.position.y);
      t += dt;
    }
    results.push({ dt, x: player.position.x, y: player.position.y, peak, grounded: player.grounded });
  }
  for (const r of results) {
    assert.equal(r.grounded, true, JSON.stringify(r));
    assert.equal(r.y, 1, JSON.stringify(r));
    assert.ok(Math.abs(r.peak - results[0].peak) < 0.05, JSON.stringify(results));
    assert.ok(Math.abs(r.x - results[0].x) < 0.3, JSON.stringify(results));
  }
});

test('jump height and flight time are frame-rate independent', () => {
  const heights = [];
  for (const dt of [1 / 20, 1 / 30, 1 / 60, 1 / 120, 1 / 240]) {
    const player = createPlayer({ colliders: [floor()], spawn: { x: 0, y: 0, z: 0 } });
    run(player, 1, 1 / 60, idle);
    player.update(dt, { ...idle, jumpPressed: true });
    let peak = player.position.y;
    let t = dt;
    while (!player.grounded && t < 3) {
      player.update(dt, idle);
      peak = Math.max(peak, player.position.y);
      t += dt;
    }
    heights.push({ dt, peak, t });
  }
  for (const h of heights) {
    assert.ok(Math.abs(h.peak - 1.6) < 0.1, JSON.stringify(heights));
    assert.ok(Math.abs(h.t - 0.8) < 0.1, JSON.stringify(heights));
  }
});

test('dispose removes the group from its parent and frees GPU resources', () => {
  const player = createPlayer({ colliders: [], spawn: { x: 0, y: 0, z: 0 } });
  const scene = new THREE.Scene();
  scene.add(player.group);
  const geometries = [];
  const materials = [];
  player.group.traverse((o) => {
    if (o.isMesh) {
      geometries.push(o.geometry);
      materials.push(o.material);
    }
  });
  let disposed = 0;
  for (const r of new Set([...geometries, ...materials])) r.addEventListener('dispose', () => disposed++);
  player.dispose();
  assert.equal(player.group.parent, null);
  assert.equal(scene.children.length, 0);
  assert.equal(disposed, new Set([...geometries, ...materials]).size);
  assert.doesNotThrow(() => player.dispose());
});

test('source file stays free of DOM usage', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/player.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /\b(document|window|addEventListener|requestAnimationFrame)\b/);
});
