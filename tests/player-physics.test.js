import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlayerPhysics,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  RUN_SPEED,
} from '../src/player-physics.js';

const DT = 1 / 60;
const box = (id, min, max) => ({ id, min: { x: min[0], y: min[1], z: min[2] }, max: { x: max[0], y: max[1], z: max[2] } });
const ground = box('ground', [-10, -1, -10], [10, 0, 10]);
const fence = [
  box('fence-w', [-11, 0, -11], [-10, 50, 11]),
  box('fence-e', [10, 0, -11], [11, 50, 11]),
  box('fence-n', [-11, 0, -11], [11, 50, -10]),
  box('fence-s', [-11, 0, 10], [11, 50, 11]),
];
const NONE = { moveX: 0, moveZ: 0, jumpPressed: false };
const JUMP = { moveX: 0, moveZ: 0, jumpPressed: true };

function make(platforms = [ground], spawn = { x: 0, y: 0, z: 0 }) {
  return createPlayerPhysics({ platforms, spawn });
}

function run(p, seconds, input = NONE, dt = DT) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i += 1) p.step(dt, input);
}

test('standing on a platform is stable and grounded', () => {
  const p = make();
  run(p, 5);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
  assert.equal(p.position.x, 0);
  assert.equal(p.position.z, 0);
  assert.equal(p.velocity.y, 0);
});

test('initial support: spawning on a surface is grounded immediately and can jump on first step', () => {
  const p = make();
  assert.equal(p.grounded, true);
  p.step(DT, JUMP);
  assert.ok(p.position.y > 0);
  assert.equal(p.grounded, false);
});

test('spawning in the air is not grounded and falls to the platform', () => {
  const p = make([ground], { x: 0, y: 3, z: 0 });
  assert.equal(p.grounded, false);
  run(p, 2);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
});

test('jump reaches expected apex and lands back on the ground', () => {
  const p = make();
  p.step(DT, JUMP);
  let apex = 0;
  let airSteps = 1;
  while (!p.grounded && airSteps < 600) {
    apex = Math.max(apex, p.position.y);
    p.step(DT, NONE);
    airSteps += 1;
  }
  const expected = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
  assert.ok(Math.abs(apex - expected) < 0.12, `apex ${apex} vs ${expected}`);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
  assert.equal(p.velocity.y, 0);
  const expectedTime = (2 * JUMP_VELOCITY) / GRAVITY;
  assert.ok(Math.abs(airSteps * DT - expectedTime) < 0.1);
});

test('no air jump: jump pressed while airborne does nothing', () => {
  const p = make();
  p.step(DT, JUMP);
  run(p, 0.2);
  const vyBefore = p.velocity.y;
  p.step(DT, JUMP);
  assert.ok(p.velocity.y < vyBefore);
  // Also not on the way down.
  run(p, 0.3);
  const vyDown = p.velocity.y;
  assert.ok(vyDown < 0);
  p.step(DT, JUMP);
  assert.ok(p.velocity.y < vyDown);
});

test('jump pressed in the same step as landing does not need a held button', () => {
  const p = make();
  p.step(DT, JUMP);
  while (!p.grounded) p.step(DT, JUMP);
  assert.equal(p.grounded, true);
  p.step(DT, NONE);
  assert.equal(p.position.y, 0);
});

test('running reaches run speed and stops responsively', () => {
  const p = make();
  run(p, 0.25, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(p.velocity.x - RUN_SPEED) < 1e-9);
  const x = p.position.x;
  run(p, 0.2, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(p.position.x - x - RUN_SPEED * 0.2) < 1e-6);
  run(p, 0.2);
  assert.equal(p.velocity.x, 0);
  assert.equal(p.grounded, true);
});

test('diagonal input is clamped to run speed', () => {
  const p = make();
  run(p, 0.5, { moveX: 1, moveZ: 1, jumpPressed: false });
  const speed = Math.hypot(p.velocity.x, p.velocity.z);
  assert.ok(Math.abs(speed - RUN_SPEED) < 1e-9, `speed ${speed}`);
  assert.ok(Math.abs(p.velocity.x - p.velocity.z) < 1e-9);

  const q = make();
  run(q, 0.5, { moveX: 5, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(q.velocity.x - RUN_SPEED) < 1e-9);

  const half = make();
  run(half, 0.5, { moveX: 0.5, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(half.velocity.x - RUN_SPEED / 2) < 1e-9);
});

test('walking off an edge makes the player fall', () => {
  const p = make([box('pad', [-1, -1, -1], [1, 0, 1])]);
  assert.equal(p.grounded, true);
  run(p, 0.6, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(p.position.x - PLAYER_RADIUS > 1 - 1e-6, 'player left the pad');
  assert.equal(p.grounded, false);
  const y = p.position.y;
  run(p, 0.3, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(p.position.y < y);
  assert.ok(p.velocity.y < 0);
});

test('stays supported while any part of the footprint overlaps the edge', () => {
  const p = make([box('pad', [-1, -1, -1], [1, 0, 1])], { x: 1.2, y: 0, z: 0 });
  assert.equal(p.grounded, true);
  run(p, 1);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
});

test('side collision blocks movement and zeroes that velocity', () => {
  const wall = box('wall', [2, 0, -5], [3, 4, 5]);
  const p = make([ground, wall]);
  run(p, 2, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(p.position.x - (2 - PLAYER_RADIUS)) < 1e-9);
  assert.equal(p.velocity.x, 0);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
});

test('sliding along a wall keeps moving on the free axis', () => {
  const wall = box('wall', [2, 0, -5], [3, 4, 5]);
  const p = make([ground, wall]);
  run(p, 1, { moveX: 1, moveZ: 0, jumpPressed: false });
  const z = p.position.z;
  run(p, 0.5, { moveX: 1, moveZ: 1, jumpPressed: false });
  assert.ok(p.position.z > z + 1);
  assert.ok(Math.abs(p.position.x - (2 - PLAYER_RADIUS)) < 1e-9);
});

test('negative-direction walls and z walls block too', () => {
  const p = make([ground, box('w1', [-3, 0, -3], [-2, 4, 3]), box('w2', [-3, 0, 2], [3, 4, 3])]);
  run(p, 1.5, { moveX: -1, moveZ: 0, jumpPressed: false });
  assert.ok(Math.abs(p.position.x - (-2 + PLAYER_RADIUS)) < 1e-9);
  const q = make([ground, box('w2', [-3, 0, 2], [3, 4, 3])]);
  run(q, 1.5, { moveX: 0, moveZ: 1, jumpPressed: false });
  assert.ok(Math.abs(q.position.z - (2 - PLAYER_RADIUS)) < 1e-9);
  run(q, 0.5, { moveX: 0, moveZ: -1, jumpPressed: false });
  assert.ok(q.position.z < 2 - PLAYER_RADIUS);
});

test('head collision stops the rise and drops the player', () => {
  const ceilingY = 2.0;
  const ceiling = box('ceiling', [-3, ceilingY, -3], [3, ceilingY + 0.5, 3]);
  const p = make([ground, ceiling]);
  p.step(DT, JUMP);
  let maxHead = 0;
  let sawFall = false;
  for (let i = 0; i < 120 && !p.grounded; i += 1) {
    p.step(DT, NONE);
    maxHead = Math.max(maxHead, p.position.y + PLAYER_HEIGHT);
    if (p.velocity.y < 0) sawFall = true;
  }
  assert.ok(maxHead <= ceilingY + 1e-9, 'head never passes ceiling');
  assert.ok(maxHead > ceilingY - 0.01, 'head reached the ceiling');
  assert.ok(sawFall);
  // Without the ceiling the same jump would have risen to about 1.45 above the floor.
  assert.ok(p.position.y < 0.7);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 0);
});

test('can jump up onto a ledge and stay stable on top', () => {
  const ledge = box('ledge', [1, 0, -2], [4, 1, 2]);
  const p = make([ground, ledge]);
  run(p, 0.2, { moveX: 1, moveZ: 0, jumpPressed: false });
  p.step(DT, { moveX: 1, moveZ: 0, jumpPressed: true });
  for (let i = 0; i < 25; i += 1) p.step(DT, { moveX: 1, moveZ: 0, jumpPressed: false });
  for (let i = 0; i < 90; i += 1) p.step(DT, NONE);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 1);
  run(p, 3);
  assert.equal(p.position.y, 1);
});

test('reset clears velocity and state and keeps position object identity', () => {
  const p = make();
  const position = p.position;
  p.step(DT, JUMP);
  run(p, 0.1, { moveX: 1, moveZ: -1, jumpPressed: false });
  assert.notEqual(p.velocity.y, 0);
  p.reset({ x: 3, y: 5, z: -2 });
  assert.equal(p.position, position);
  assert.deepEqual({ ...p.position }, { x: 3, y: 5, z: -2 });
  assert.deepEqual({ ...p.velocity }, { x: 0, y: 0, z: 0 });
  assert.equal(p.grounded, false);
  p.step(DT, NONE);
  assert.ok(Math.abs(p.velocity.x) < 1e-12 && Math.abs(p.velocity.z) < 1e-12);
  assert.ok(p.velocity.y > -GRAVITY * DT - 1e-9);

  p.reset({ x: 0, y: 0, z: 0 });
  assert.equal(p.grounded, true);
  p.step(DT, NONE);
  assert.equal(p.position.y, 0);
});

test('long run is stable and deterministic', () => {
  const platforms = [ground, ...fence, box('a', [2, 0, 2], [4, 1.5, 4]), box('b', [-6, 0, -3], [-4, 2, 3])];
  const script = (i) => ({
    moveX: Math.sin(i * 0.013) * 1.3,
    moveZ: Math.cos(i * 0.007),
    jumpPressed: i % 97 === 0,
  });
  const trace = () => {
    const p = make(platforms);
    for (let i = 0; i < 60 * 120; i += 1) {
      p.step(DT, script(i));
      assert.ok(Number.isFinite(p.position.x + p.position.y + p.position.z));
      assert.ok(p.position.y >= -1e-9, 'never sinks into the ground');
      assert.ok(Math.abs(p.position.x) <= 10 && Math.abs(p.position.z) <= 10);
    }
    return [p.position.x, p.position.y, p.position.z, p.grounded];
  };
  assert.deepEqual(trace(), trace());

  const idle = make();
  run(idle, 120);
  assert.equal(idle.position.y, 0);
  assert.equal(idle.grounded, true);
});

test('never ends inside a platform while wandering', () => {
  const platforms = [ground, ...fence, box('a', [2, 0, 2], [4, 1.5, 4]), box('b', [-6, 0, -3], [-4, 2, 3])];
  const p = make(platforms);
  const r = PLAYER_RADIUS;
  for (let i = 0; i < 60 * 60; i += 1) {
    p.step(DT, { moveX: Math.sin(i * 0.05), moveZ: Math.cos(i * 0.031), jumpPressed: i % 41 === 0 });
    const { x, y, z } = p.position;
    for (const b of platforms) {
      const inside =
        x + r > b.min.x + 1e-5 && x - r < b.max.x - 1e-5 &&
        y + PLAYER_HEIGHT > b.min.y + 1e-5 && y < b.max.y - 1e-5 &&
        z + r > b.min.z + 1e-5 && z - r < b.max.z - 1e-5;
      assert.equal(inside, false, `inside ${b.id} at step ${i}`);
    }
  }
});

test('thin platform: fast fall does not tunnel, even with large dt', () => {
  const thin = box('thin', [-2, 5, -2], [2, 5.02, 2]);
  const p = make([thin], { x: 0, y: 40, z: 0 });
  for (let i = 0; i < 600 && !p.grounded; i += 1) p.step(DT, NONE);
  assert.equal(p.grounded, true);
  assert.equal(p.position.y, 5.02);

  const q = make([thin], { x: 0, y: 40, z: 0 });
  for (let i = 0; i < 200 && !q.grounded; i += 1) q.step(0.1, NONE);
  assert.equal(q.grounded, true);
  assert.equal(q.position.y, 5.02);
});

test('thin platform: falls past one it does not overlap, and walks off a thin strip', () => {
  const strip = box('strip', [-0.05, -1, -3], [0.05, 0, 3]);
  const p = make([strip]);
  assert.equal(p.grounded, true);
  run(p, 1, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.equal(p.grounded, false);
  assert.ok(p.position.y < -1);
});

test('thin wall is not run through at speed', () => {
  const wall = box('thin-wall', [3, 0, -5], [3.02, 3, 5]);
  const p = make([ground, wall]);
  run(p, 3, { moveX: 1, moveZ: 0, jumpPressed: false }, 0.1);
  assert.ok(p.position.x <= 3 - PLAYER_RADIUS + 1e-9);
});

test('zero, negative, NaN and oversized dt are handled', () => {
  const p = make();
  p.step(0, JUMP);
  p.step(-1, JUMP);
  p.step(NaN, JUMP);
  assert.equal(p.position.y, 0);
  assert.equal(p.grounded, true);

  p.step(5, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(p.position.x <= RUN_SPEED * 0.1 + 1e-9, 'oversized dt is clamped');
  assert.equal(p.grounded, true);

  p.step(DT);
  p.step(DT, null);
  assert.equal(p.grounded, true);
});

test('larger dt gives results close to the fixed step', () => {
  const a = make();
  const b = make();
  const move = { moveX: 1, moveZ: 0, jumpPressed: false };
  a.step(DT, { ...move, jumpPressed: true });
  b.step(DT * 2, { ...move, jumpPressed: true });
  for (let i = 0; i < 20; i += 1) a.step(DT, move);
  for (let i = 0; i < 10; i += 1) b.step(DT * 2, move);
  assert.ok(Math.abs(a.position.y - b.position.y) < 0.2);
});

test('platform data is copied: later mutation does not move collisions', () => {
  const plat = box('g', [-10, -1, -10], [10, 0, 10]);
  const p = make([plat]);
  plat.max.y = 50;
  run(p, 1);
  assert.equal(p.position.y, 0);
});

test('uses a supplied position object in place', () => {
  const position = { x: 9, y: 9, z: 9 };
  const p = createPlayerPhysics({ platforms: [ground], spawn: { x: 1, y: 0, z: 2 }, position });
  assert.equal(p.position, position);
  assert.deepEqual({ ...position }, { x: 1, y: 0, z: 2 });
  p.step(DT, { moveX: 1, moveZ: 0, jumpPressed: false });
  assert.ok(position.x > 1);
});
