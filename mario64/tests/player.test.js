import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Scene, Vector3 } from 'three';
import { createPlayer } from '../src/player.js';

const box = (x0, y0, z0, x1, y1, z1) => new Box3(new Vector3(x0, y0, z0), new Vector3(x1, y1, z1));
const FLOOR = box(-50, -1, -50, 50, 0, 50);
const FORWARD = new Vector3(0, 0, -1);
const DT = 1 / 60;

function make(colliders = [FLOOR], spawn = new Vector3(0, 0, 0)) {
  const scene = new Scene();
  const player = createPlayer({ scene, spawn, colliders });
  return { scene, player };
}

function run(player, seconds, input, forward = FORWARD, dt = DT) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) player.update(dt, typeof input === 'function' ? input(i) : input, forward);
}

test('adds a group of the right size to the scene, using position as feet', () => {
  const { scene, player } = make([FLOOR], new Vector3(1, 2, 3));
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0].position, player.position);
  assert.deepEqual(player.position.toArray(), [1, 2, 3]);
  const b = player.getBounds();
  assert.ok(Math.abs(b.max.x - b.min.x - 0.7) < 1e-9);
  assert.ok(Math.abs(b.max.z - b.min.z - 0.7) < 1e-9);
  assert.ok(Math.abs(b.max.y - b.min.y - 1.6) < 1e-9);
  assert.equal(b.min.y, 2);
});

test('settles stably on the floor', () => {
  const { player } = make([FLOOR], new Vector3(0, 3, 0));
  run(player, 2, {});
  assert.equal(player.position.y, 0);
  run(player, 1, {});
  assert.equal(player.position.y, 0);
});

test('moves camera-relative: forward goes along camera forward', () => {
  const { player } = make();
  run(player, 1, { y: 1 }, new Vector3(0, 0, -1));
  assert.ok(Math.abs(player.position.z + 5) < 1e-6);
  assert.ok(Math.abs(player.position.x) < 1e-6);

  const other = make().player;
  run(other, 1, { y: 1 }, new Vector3(1, 0, 0));
  assert.ok(Math.abs(other.position.x - 5) < 1e-6);
  assert.ok(Math.abs(other.position.z) < 1e-6);
});

test('right is to the right of the camera heading, and keys work too', () => {
  const a = make().player;
  run(a, 1, { x: 1 }, new Vector3(0, 0, -1));
  assert.ok(a.position.x > 4.9);

  const b = make().player;
  run(b, 1, { x: 1 }, new Vector3(1, 0, 0));
  assert.ok(b.position.z > 4.9);

  const c = make().player;
  run(c, 1, { left: true }, new Vector3(0, 0, -1));
  assert.ok(c.position.x < -4.9);

  const d = make().player;
  run(d, 1, { back: true }, new Vector3(0, 0, -1));
  assert.ok(d.position.z > 4.9);
});

test('ignores the vertical component of the camera direction', () => {
  const { player } = make();
  run(player, 1, { y: 1 }, new Vector3(0, -0.7, -0.7));
  assert.ok(Math.abs(player.position.z + 5) < 1e-6);
});

test('diagonal movement is not faster than straight movement', () => {
  const { player } = make();
  run(player, 1, { x: 1, y: 1 });
  const dist = Math.hypot(player.position.x, player.position.z);
  assert.ok(Math.abs(dist - 5) < 1e-6, `distance ${dist}`);
  assert.ok(Math.abs(player.position.x - player.position.z * -1) < 1e-6);
});

test('lands on a platform from a jump and stays on top of it', () => {
  const platform = box(-2, 0, -2, 2, 1, 2);
  const { player } = make([FLOOR, platform], new Vector3(0, 3, 0));
  run(player, 2, {});
  assert.equal(player.position.y, 1);
});

test('head hits a ceiling and falls back down', () => {
  const ceiling = box(-5, 2.0, -5, 5, 3, 5);
  const { player } = make([FLOOR, ceiling]);
  run(player, 0.2, {});
  let maxY = 0;
  for (let i = 0; i < 120; i++) {
    player.update(DT, { jump: i === 0 }, FORWARD);
    maxY = Math.max(maxY, player.position.y);
  }
  assert.ok(maxY <= 2.0 - 1.6 + 1e-9, `maxY ${maxY}`);
  assert.ok(maxY > 0.3);
  assert.equal(player.position.y, 0);
});

test('side collisions block movement on x and z', () => {
  const wallZ = box(-5, 0, -3, 5, 4, -2);
  const a = make([FLOOR, wallZ]).player;
  run(a, 2, { y: 1 });
  assert.ok(Math.abs(a.position.z - (-2 + 0.35)) < 1e-4, `z ${a.position.z}`);

  const wallX = box(2, 0, -5, 3, 4, 5);
  const b = make([FLOOR, wallX]).player;
  run(b, 2, { x: 1 });
  assert.ok(Math.abs(b.position.x - (2 - 0.35)) < 1e-4, `x ${b.position.x}`);
  assert.equal(b.position.y, 0);
});

test('slides along a wall when moving diagonally into it', () => {
  const wallX = box(2, 0, -50, 3, 4, 50);
  const { player } = make([FLOOR, wallX]);
  run(player, 1.5, { x: 1, y: 1 });
  assert.ok(Math.abs(player.position.x - 1.65) < 1e-4);
  assert.ok(player.position.z < -3);
});

test('cannot pass through a wall at large frame times', () => {
  const wallZ = box(-5, 0, -3, 5, 4, -2.8);
  const { player } = make([FLOOR, wallZ]);
  for (let i = 0; i < 20; i++) player.update(0.05, { y: 1 }, FORWARD);
  assert.ok(player.position.z >= -2.8 + 0.35 - 1e-4);
});

test('walking off an edge makes the player fall', () => {
  const island = box(-2, -1, -2, 2, 0, 2);
  const { player } = make([island]);
  run(player, 2, { x: 1 });
  assert.ok(player.position.x > 2);
  assert.ok(player.position.y < -1);
  const y = player.position.y;
  run(player, 0.5, {});
  assert.ok(player.position.y < y);
});

test('jump is only possible when grounded', () => {
  const { player } = make();
  run(player, 0.5, {});
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 0);
  let peak = 0;
  for (let i = 0; i < 20; i++) {
    player.update(DT, { jump: false }, FORWARD);
    player.update(DT, { jump: true }, FORWARD);
    peak = Math.max(peak, player.position.y);
  }
  assert.ok(peak < 8 * 8 / (2 * 20) + 0.01, `peak ${peak}`);
});

test('jump reaches about v^2 / 2g', () => {
  const { player } = make();
  run(player, 0.2, {});
  let peak = 0;
  for (let i = 0; i < 90; i++) {
    player.update(1 / 120, { jump: i === 0 }, FORWARD);
    peak = Math.max(peak, player.position.y);
  }
  assert.ok(Math.abs(peak - 1.6) < 0.05, `peak ${peak}`);
});

test('jump is edge-triggered: holding does not rejump on landing', () => {
  const { player } = make();
  run(player, 0.3, {});
  let landedAt = -1;
  let leftGround = false;
  for (let i = 0; i < 180; i++) {
    player.update(DT, { jump: true }, FORWARD);
    if (player.position.y > 0) leftGround = true;
    if (leftGround && player.position.y === 0 && landedAt < 0) landedAt = i;
  }
  assert.ok(landedAt > 0);
  assert.equal(player.position.y, 0);
  player.update(DT, { jump: false }, FORWARD);
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 0);
});

test('jump pressed in the air is not buffered', () => {
  const { player } = make([FLOOR], new Vector3(0, 0.5, 0));
  player.update(DT, { jump: true }, FORWARD);
  for (let i = 0; i < 60; i++) player.update(DT, { jump: true }, FORWARD);
  assert.equal(player.position.y, 0);
});

test('reset restores spawn, clears velocity and the jump edge state', () => {
  const { player } = make([FLOOR], new Vector3(1, 0, 2));
  const ref = player.position;
  run(player, 0.1, {});
  player.update(DT, { jump: true, y: 1 }, FORWARD);
  run(player, 0.2, { y: 1, jump: true });
  assert.notDeepEqual(player.position.toArray(), [1, 0, 2]);
  player.reset();
  assert.equal(player.position, ref);
  assert.deepEqual(player.position.toArray(), [1, 0, 2]);
  player.update(DT, {}, FORWARD);
  assert.deepEqual(player.position.toArray(), [1, 0, 2].map((v, i) => (i === 1 ? player.position.y : v)));
  assert.ok(player.position.y <= 0);
  run(player, 0.5, {});
  assert.equal(player.position.y, 0);
  assert.equal(player.position.x, 1);
  assert.equal(player.position.z, 2);

  // Reset while a held jump: the next update with jump counts as a new press.
  player.update(DT, { jump: true }, FORWARD);
  player.reset();
  run(player, 0.5, {});
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 0);
});

test('reset drops stored horizontal and vertical velocity', () => {
  const { player } = make([FLOOR], new Vector3(0, 10, 0));
  run(player, 0.3, { y: 1 });
  player.reset();
  player.update(DT, {}, FORWARD);
  assert.ok(Math.abs(player.position.x) < 1e-9);
  assert.ok(Math.abs(player.position.z) < 1e-9);
  assert.ok(10 - player.position.y < 0.02);
});

test('instances keep independent state', () => {
  const a = make().player;
  const b = make().player;
  run(a, 1, { y: 1 });
  assert.equal(b.position.z, 0);
});

test('a supported player can jump on the very first update after creation', () => {
  const { player } = make();
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 0);
});

test('a player standing on a platform can jump on the first update', () => {
  const platform = box(-2, 0, -2, 2, 1, 2);
  const { player } = make([FLOOR, platform], new Vector3(0, 1, 0));
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 1);
});

test('a supported player can jump on the first update after reset', () => {
  const { player } = make([FLOOR], new Vector3(1, 0, 2));
  run(player, 0.5, { y: 1 });
  player.update(DT, { jump: true }, FORWARD);
  run(player, 0.1, {});
  player.reset();
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y > 0);
  assert.equal(player.position.x, 1);
});

test('an unsupported spawn cannot jump, including right after reset', () => {
  const { player } = make([FLOOR], new Vector3(0, 3, 0));
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y < 3);
  player.reset();
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y < 3);
  assert.ok(player.position.y > 2.9);
});

test('a spawn beside a platform edge (not over it) is unsupported', () => {
  const island = box(-2, -1, -2, 2, 0, 2);
  const { player } = make([island], new Vector3(2.5, 0, 0));
  player.update(DT, { jump: true }, FORWARD);
  assert.ok(player.position.y < 0);
});

test('a held jump does not retrigger after a first-update jump and landing', () => {
  const { player } = make();
  let airborne = false;
  let landed = false;
  for (let i = 0; i < 240; i++) {
    player.update(DT, { jump: true }, FORWARD);
    if (player.position.y > 0) airborne = true;
    else if (airborne) landed = true;
    if (landed) assert.equal(player.position.y, 0);
  }
  assert.ok(airborne && landed);
});
