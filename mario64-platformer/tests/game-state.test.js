import test from "node:test";
import assert from "node:assert/strict";
import {
  allCollected,
  cameraAxes,
  cameraRelativeMove,
  desiredCameraPosition,
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

const DIST = 11;
const HEIGHT = 6.5;
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);

test("forward is away from the camera and right is to its right", () => {
  const target = { x: 3, y: 1, z: -2 };
  const cam = desiredCameraPosition(target, 0, DIST, HEIGHT);
  const move = cameraRelativeMove({ x: 0, y: 1 }, cam, target);
  near(move.moveX, 0, "forward x");
  near(move.moveZ, -1, "forward z");
  const right = cameraRelativeMove({ x: 1, y: 0 }, cam, target);
  near(right.moveX, 1, "right x");
  near(right.moveZ, 0, "right z");
});

test("diagonal movement is normalized", () => {
  const target = { x: 0, y: 0, z: 0 };
  const cam = desiredCameraPosition(target, 0.7, DIST, HEIGHT);
  const move = cameraRelativeMove({ x: 1, y: 1 }, cam, target);
  near(Math.hypot(move.moveX, move.moveZ), 1, "speed");
  assert.deepEqual(cameraRelativeMove({ x: 0, y: 0 }, cam, target), { moveX: 0, moveZ: 0 });
});

test("movement follows the displayed camera while orbit smoothing lags the target yaw", () => {
  const target = { x: 0, y: 0, z: 0 };
  const targetYaw = Math.PI / 2;
  const goal = desiredCameraPosition(target, targetYaw, DIST, HEIGHT);
  const cam = desiredCameraPosition(target, 0, DIST, HEIGHT);

  // Smooth a few frames towards the new orbit position, as the game loop does.
  for (let frame = 0; frame < 6; frame++) {
    const k = 1 - Math.exp(-6 / 60);
    cam.x += (goal.x - cam.x) * k;
    cam.y += (goal.y - cam.y) * k;
    cam.z += (goal.z - cam.z) * k;

    const displayed = cameraAxes(cam, target).forward;
    const move = cameraRelativeMove({ x: 0, y: 1 }, cam, target, targetYaw);
    near(move.moveX, displayed.x, "forward x matches the displayed camera");
    near(move.moveZ, displayed.z, "forward z matches the displayed camera");

    // Not the direction of the not-yet-reached target yaw.
    const viaTargetYaw = { x: -Math.sin(targetYaw), z: -Math.cos(targetYaw) };
    assert.ok(Math.hypot(move.moveX - viaTargetYaw.x, move.moveZ - viaTargetYaw.z) > 0.1);
  }

  for (let frame = 0; frame < 2000; frame++) {
    cam.x += (goal.x - cam.x) * 0.1;
    cam.z += (goal.z - cam.z) * 0.1;
  }
  const settled = cameraRelativeMove({ x: 0, y: 1 }, cam, target, targetYaw);
  near(settled.moveX, -1, "settled forward x");
  near(settled.moveZ, 0, "settled forward z");
});

test("a camera directly above the target falls back to the given yaw", () => {
  const target = { x: 0, y: 0, z: 0 };
  const move = cameraRelativeMove({ x: 0, y: 1 }, { x: 0, y: 9, z: 0 }, target, Math.PI / 2);
  near(move.moveX, -1, "x");
  near(move.moveZ, 0, "z");
});
