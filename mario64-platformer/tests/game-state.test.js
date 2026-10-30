import test from "node:test";
import assert from "node:assert/strict";
import {
  allCollected,
  collectCrystal,
  collectedCount,
  counterText,
  createGameState,
  hintText,
  isCollected,
  reachGoal,
  resetGameState,
} from "../src/game-state.js";

const IDS = ["a", "b", "c", "d", "e"];

function collectAll(state) {
  for (const id of IDS) collectCrystal(state, id);
}

test("a new state has nothing collected and is not won", () => {
  const state = createGameState(IDS);
  assert.equal(collectedCount(state), 0);
  assert.equal(state.total, 5);
  assert.equal(state.won, false);
  assert.equal(counterText(state), "Crystals: 0 / 5");
});

test("collecting a crystal counts once; duplicates and unknown ids are ignored", () => {
  const state = createGameState(IDS);
  assert.equal(collectCrystal(state, "a"), true);
  assert.equal(collectCrystal(state, "a"), false);
  assert.equal(collectCrystal(state, "nope"), false);
  assert.equal(collectedCount(state), 1);
  assert.equal(isCollected(state, "a"), true);
  assert.equal(isCollected(state, "b"), false);
});

test("the goal stays locked until all five crystals are collected", () => {
  const state = createGameState(IDS);
  assert.equal(reachGoal(state), false);
  for (const id of IDS.slice(0, 4)) collectCrystal(state, id);
  assert.equal(allCollected(state), false);
  assert.equal(reachGoal(state), false);
  assert.equal(state.won, false);
  assert.match(hintText(state, { nearGoal: true }), /locked.*1 more crystal\b/);
});

test("reaching the goal after all five crystals wins, once", () => {
  const state = createGameState(IDS);
  collectAll(state);
  assert.equal(allCollected(state), true);
  assert.equal(reachGoal(state), true);
  assert.equal(state.won, true);
  assert.equal(reachGoal(state), false);
  assert.match(hintText(state), /complete/i);
});

test("restart clears pickups and victory", () => {
  const state = createGameState(IDS);
  collectAll(state);
  reachGoal(state);
  resetGameState(state);
  assert.equal(collectedCount(state), 0);
  assert.equal(state.won, false);
  assert.equal(reachGoal(state), false);
  assert.equal(collectCrystal(state, "a"), true);
});

test("an empty crystal list never counts as all collected", () => {
  const state = createGameState([]);
  assert.equal(allCollected(state), false);
  assert.equal(reachGoal(state), false);
});
