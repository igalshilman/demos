import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAYER_HALF_WIDTH,
  PLAYER_HEIGHT,
  createPlayer,
  resetPlayer,
  stepPlayer,
} from "../src/player-controller.js";

const box = (min, max) => ({ min, max });
const floor = box({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
const NONE = { moveX: 0, moveZ: 0, jump: false };
const FRAME = 1 / 60;

function run(player, input, seconds, solids, dt = FRAME) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) stepPlayer(player, input, dt, solids);
  return player;
}

function settled(spawn = { x: 0, y: 0, z: 0 }, solids = [floor]) {
  const player = createPlayer(spawn);
  run(player, NONE, 0.2, solids);
  return player;
}

test("constants match the spec", () => {
  assert.equal(PLAYER_HALF_WIDTH, 0.35);
  assert.equal(PLAYER_HEIGHT, 1.6);
});

test("createPlayer copies the spawn and starts at rest", () => {
  const spawn = { x: 1, y: 2, z: 3 };
  const player = createPlayer(spawn);
  assert.deepEqual(player.position, spawn);
  assert.deepEqual(player.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(player.grounded, false);
  player.position.x = 99;
  assert.equal(spawn.x, 1);
  spawn.z = 42;
  assert.equal(player.position.z, 3);
});

test("resetPlayer mutates in place, clears velocity and grounded, and does not alias spawn", () => {
  const player = settled();
  player.velocity.x = 5;
  player.velocity.y = 7;
  player.velocity.z = -2;
  const position = player.position;
  const spawn = { x: 4, y: 5, z: 6 };
  const result = resetPlayer(player, spawn);
  assert.equal(result, player);
  assert.equal(player.position, position);
  assert.deepEqual(player.position, { x: 4, y: 5, z: 6 });
  assert.deepEqual(player.velocity, { x: 0, y: 0, z: 0 });
  assert.equal(player.grounded, false);
  spawn.x = -1;
  assert.equal(player.position.x, 4);
});

test("stepPlayer mutates and returns the same player", () => {
  const player = createPlayer({ x: 0, y: 5, z: 0 });
  assert.equal(stepPlayer(player, NONE, FRAME, [floor]), player);
  assert.ok(player.position.y < 5);
});

test("player falls, lands on a floor and becomes grounded", () => {
  const player = createPlayer({ x: 0, y: 3, z: 0 });
  run(player, NONE, 1, [floor]);
  assert.equal(player.position.y, 0);
  assert.equal(player.velocity.y, 0);
  assert.equal(player.grounded, true);
});

test("grounding is stable every frame while standing still", () => {
  const player = settled();
  for (let i = 0; i < 300; i++) {
    stepPlayer(player, NONE, FRAME, [floor]);
    assert.equal(player.grounded, true);
    assert.equal(player.position.y, 0);
    assert.equal(player.velocity.y, 0);
  }
});

test("grounded player walks at speed 6", () => {
  const player = settled();
  run(player, { moveX: 1, moveZ: 0, jump: false }, 0.5, [floor]);
  assert.ok(Math.abs(player.position.x - 3) < 1e-6);
  assert.equal(player.grounded, true);
  assert.equal(player.velocity.x, 6);
});

test("diagonal input is normalized and oversized input is clamped", () => {
  const diagonal = settled();
  run(diagonal, { moveX: 1, moveZ: 1, jump: false }, 0.5, [floor]);
  const travelled = Math.hypot(diagonal.position.x, diagonal.position.z);
  assert.ok(Math.abs(travelled - 3) < 1e-6);
  assert.ok(Math.abs(diagonal.position.x - diagonal.position.z) < 1e-9);

  const big = settled();
  run(big, { moveX: 10, moveZ: 0, jump: false }, 0.5, [floor]);
  assert.ok(Math.abs(big.position.x - 3) < 1e-6);

  const slow = settled();
  run(slow, { moveX: 0, moveZ: -0.5, jump: false }, 0.5, [floor]);
  assert.ok(Math.abs(slow.position.z + 1.5) < 1e-6);
});

test("jump reaches roughly v^2/2g and lands again", () => {
  const player = settled();
  stepPlayer(player, { ...NONE, jump: true }, FRAME, [floor]);
  assert.equal(player.grounded, false);
  assert.ok(player.velocity.y > 0);
  let peak = player.position.y;
  let frames = 0;
  while (!player.grounded && frames++ < 300) {
    stepPlayer(player, NONE, FRAME, [floor]);
    peak = Math.max(peak, player.position.y);
  }
  assert.ok(Math.abs(peak - 81 / 48) < 0.02, `peak was ${peak}`);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
});

test("holding jump does not re-jump in the air", () => {
  const player = settled();
  const jump = { ...NONE, jump: true };
  stepPlayer(player, jump, FRAME, [floor]);
  let peak = 0;
  for (let i = 0; i < 20; i++) {
    stepPlayer(player, jump, FRAME, [floor]);
    peak = Math.max(peak, player.position.y);
  }
  assert.ok(peak < 1.7, `peak was ${peak}`);
});

test("jump pressed while airborne is rejected", () => {
  const player = createPlayer({ x: 0, y: 5, z: 0 });
  stepPlayer(player, { ...NONE, jump: true }, FRAME, [floor]);
  assert.ok(player.velocity.y < 0);
  assert.ok(player.position.y < 5);
});

test("a wall blocks horizontal movement", () => {
  const wall = box({ x: 2, y: 0, z: -5 }, { x: 3, y: 4, z: 5 });
  const player = settled({ x: 0, y: 0, z: 0 }, [floor, wall]);
  run(player, { moveX: 1, moveZ: 0, jump: false }, 1, [floor, wall]);
  assert.ok(Math.abs(player.position.x - (2 - PLAYER_HALF_WIDTH)) < 1e-9);
  assert.equal(player.grounded, true);
  assert.equal(player.position.y, 0);
});

test("walking into a wall in z and from the other side also blocks", () => {
  const wall = box({ x: -5, y: 0, z: -3 }, { x: 5, y: 4, z: -2 });
  const player = settled({ x: 0, y: 0, z: 0 }, [floor, wall]);
  run(player, { moveX: 0, moveZ: -1, jump: false }, 1, [floor, wall]);
  assert.ok(Math.abs(player.position.z - (-2 + PLAYER_HALF_WIDTH)) < 1e-9);
  const far = settled({ x: 0, y: 0, z: -5 }, [floor, wall]);
  run(far, { moveX: 0, moveZ: 1, jump: false }, 1, [floor, wall]);
  assert.ok(Math.abs(far.position.z - (-3 - PLAYER_HALF_WIDTH)) < 1e-9);
});

test("wall contact slides along the other axis", () => {
  const wall = box({ x: 2, y: 0, z: -5 }, { x: 3, y: 4, z: 5 });
  const player = settled({ x: 0, y: 0, z: 0 }, [floor, wall]);
  run(player, { moveX: 1, moveZ: 1, jump: false }, 0.5, [floor, wall]);
  assert.ok(Math.abs(player.position.x - (2 - PLAYER_HALF_WIDTH)) < 1e-9);
  assert.ok(player.position.z > 1);
});

test("a ceiling stops the jump and the player falls back", () => {
  const ceiling = box({ x: -5, y: 1.9, z: -5 }, { x: 5, y: 2.5, z: 5 });
  const solids = [floor, ceiling];
  const player = settled({ x: 0, y: 0, z: 0 }, solids);
  stepPlayer(player, { ...NONE, jump: true }, FRAME, solids);
  let peak = 0;
  let falling = false;
  for (let i = 0; i < 60; i++) {
    stepPlayer(player, NONE, FRAME, solids);
    peak = Math.max(peak, player.position.y);
    if (player.velocity.y < 0) falling = true;
  }
  const limit = 1.9 - PLAYER_HEIGHT;
  assert.ok(peak <= limit + 1e-9, `peak ${peak} went into the ceiling`);
  assert.ok(peak > limit - 0.02, `peak ${peak} should reach the ceiling`);
  assert.ok(falling);
  assert.equal(player.grounded, true);
});

test("walking off an edge clears grounded and the player falls", () => {
  const platform = box({ x: -2, y: -1, z: -2 }, { x: 2, y: 0, z: 2 });
  const player = settled({ x: 0, y: 0, z: 0 }, [platform]);
  assert.equal(player.grounded, true);
  const walk = { moveX: 1, moveZ: 0, jump: false };
  let frames = 0;
  while (player.grounded && frames++ < 120) stepPlayer(player, walk, FRAME, [platform]);
  assert.equal(player.grounded, false);
  assert.ok(player.position.x > 2);
  run(player, walk, 0.5, [platform]);
  assert.ok(player.position.y < -1);
  assert.equal(player.grounded, false);
});

test("standing partly over an edge stays grounded; jumping off an edge works only while grounded", () => {
  const platform = box({ x: -2, y: -1, z: -2 }, { x: 2, y: 0, z: 2 });
  const player = settled({ x: 2.2, y: 0, z: 0 }, [platform]);
  assert.equal(player.grounded, true);
  run(player, { moveX: 1, moveZ: 0, jump: false }, 0.5, [platform]);
  assert.equal(player.grounded, false);
  const vy = player.velocity.y;
  stepPlayer(player, { moveX: 1, moveZ: 0, jump: true }, FRAME, [platform]);
  assert.ok(player.velocity.y < vy);
});

test("a large frame is clamped and does not tunnel through the floor", () => {
  const player = createPlayer({ x: 0, y: 3, z: 0 });
  stepPlayer(player, NONE, 5, [floor]);
  assert.ok(player.position.y >= 0);
  assert.ok(player.position.y < 3);
  // Clamped to 0.1s: fell ~0.5 * 24 * 0.01 = 0.12
  assert.ok(Math.abs(player.position.y - (3 - 0.12)) < 1e-6);

  const walker = settled();
  stepPlayer(walker, { moveX: 1, moveZ: 0, jump: false }, 10, [floor]);
  assert.ok(Math.abs(walker.position.x - 0.6) < 1e-6);
});

test("fast falls cannot skip through a thin platform", () => {
  const thin = box({ x: -5, y: 0, z: -5 }, { x: 5, y: 0.05, z: 5 });
  const low = createPlayer({ x: 0, y: 3, z: 0 });
  low.velocity.y = -400;
  stepPlayer(low, NONE, 0.1, [thin]);
  assert.equal(low.position.y, 0.05);
  assert.equal(low.grounded, true);
});

test("result is independent of frame rate for small frames", () => {
  const a = settled();
  const b = settled();
  const input = { moveX: 1, moveZ: 0, jump: false };
  stepPlayer(a, { ...input, jump: true }, FRAME, [floor]);
  stepPlayer(b, { ...input, jump: true }, FRAME, [floor]);
  run(a, input, 0.5, [floor], 1 / 60);
  run(b, input, 0.5, [floor], 1 / 30);
  assert.ok(Math.abs(a.position.x - b.position.x) < 1e-6);
});

test("zero or invalid dt and input leave the player unchanged", () => {
  const player = settled();
  const before = JSON.stringify(player);
  stepPlayer(player, NONE, 0, [floor]);
  stepPlayer(player, { moveX: NaN, moveZ: undefined, jump: false }, FRAME, [floor]);
  assert.equal(JSON.stringify(player), before);
});
