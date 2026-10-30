import test from "node:test";
import assert from "node:assert/strict";
import {
  createGameState,
  bodyCenter,
  distance,
  isTouching,
  BODY_CENTER_OFFSET,
} from "../src/game-state.js";

test("counts each collectible only once", () => {
  const s = createGameState(["a", "b", "c"]);
  assert.equal(s.collect("a"), true);
  assert.equal(s.collect("a"), false);
  assert.equal(s.collectedCount, 1);
  assert.equal(s.remaining, 2);
  assert.equal(s.total, 3);
});

test("ignores unknown ids and de-duplicates the id list", () => {
  const s = createGameState(["a", "a", "b"]);
  assert.equal(s.total, 2);
  assert.equal(s.collect("zzz"), false);
  assert.equal(s.collectedCount, 0);
});

test("goal is gated on every collectible", () => {
  const s = createGameState(["a", "b"]);
  assert.equal(s.reachGoal(), false);
  s.collect("a");
  assert.equal(s.reachGoal(), false);
  assert.equal(s.won, false);
  s.collect("b");
  assert.equal(s.allCollected, true);
  assert.equal(s.reachGoal(), true);
  assert.equal(s.won, true);
  assert.equal(s.reachGoal(), false);
});

test("a world with no collectibles can be finished at once", () => {
  const s = createGameState([]);
  assert.equal(s.reachGoal(), true);
});

test("falling preserves collected progress", () => {
  const s = createGameState(["a", "b"]);
  s.collect("a");
  assert.equal(s.fall(), true);
  assert.equal(s.fall(), true);
  assert.equal(s.falls, 2);
  assert.equal(s.collectedCount, 1);
  assert.equal(s.has("a"), true);
  assert.equal(s.won, false);
});

test("winning freezes progress until restart", () => {
  const s = createGameState(["a"]);
  s.collect("a");
  s.reachGoal();
  assert.equal(s.fall(), false);
  assert.equal(s.falls, 0);
  assert.equal(s.won, true);
});

test("restart resets everything", () => {
  const s = createGameState(["a", "b"]);
  s.collect("a");
  s.fall();
  s.collect("b");
  s.reachGoal();
  s.restart();
  assert.deepEqual(s.snapshot(), {
    total: 2,
    collected: 0,
    remaining: 2,
    allCollected: false,
    won: false,
    falls: 0,
  });
  assert.equal(s.collect("a"), true);
  assert.equal(s.has("b"), false);
});

test("pickup detection uses body center, not feet", () => {
  const feet = { x: 0, y: 0, z: 0 };
  const center = bodyCenter(feet);
  assert.equal(center.y, BODY_CENTER_OFFSET);
  assert.equal(distance(center, { x: 0, y: BODY_CENTER_OFFSET + 3, z: 4 }), 5);
  const item = { position: { x: 0, y: BODY_CENTER_OFFSET, z: 1 }, radius: 0.5 };
  assert.equal(isTouching(center, item, 0.4), false);
  assert.equal(isTouching(center, item, 0.6), true);
  const atFeet = { position: { x: 0, y: 0, z: 0 }, radius: 0.1 };
  assert.equal(isTouching(center, atFeet, 0.4), false);
});
