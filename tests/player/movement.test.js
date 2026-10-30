import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accelerateHorizontal,
  applyFriction,
  applyGravity,
  applyJump,
  cameraRelativeDirection,
  moveTowards,
} from '../../src/player/movement.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('moveTowards steps and clamps', () => {
  assert.equal(moveTowards(0, 10, 3), 3);
  assert.equal(moveTowards(10, 0, 3), 7);
  assert.equal(moveTowards(9, 10, 3), 10);
  assert.equal(moveTowards(5, 5, 1), 5);
});

test('forward at yaw 0 points -z', () => {
  const d = cameraRelativeDirection({ forward: true }, 0);
  close(d.x, 0);
  close(d.z, -1);
});

test('right/left/back at yaw 0', () => {
  const r = cameraRelativeDirection({ right: true }, 0);
  close(r.x, 1);
  close(r.z, 0);
  const l = cameraRelativeDirection({ left: true }, 0);
  close(l.x, -1);
  const b = cameraRelativeDirection({ backward: true }, 0);
  close(b.z, 1);
});

test('direction follows camera yaw', () => {
  // yaw +90deg turns the camera to face -x
  const d = cameraRelativeDirection({ forward: true }, Math.PI / 2);
  close(d.x, -1);
  close(d.z, 0);
  const r = cameraRelativeDirection({ right: true }, Math.PI / 2);
  close(r.x, 0);
  close(r.z, -1);
});

test('diagonals are normalized', () => {
  const d = cameraRelativeDirection({ forward: true, right: true }, 0.7);
  close(Math.hypot(d.x, d.z), 1);
});

test('opposing and empty input give zero', () => {
  assert.deepEqual(cameraRelativeDirection({ forward: true, backward: true }, 1), { x: 0, z: 0 });
  assert.deepEqual(cameraRelativeDirection({}, 1), { x: 0, z: 0 });
  assert.deepEqual(cameraRelativeDirection(undefined, 1), { x: 0, z: 0 });
});

test('arrow-style aliases work', () => {
  const d = cameraRelativeDirection({ up: true }, 0);
  close(d.z, -1);
});

test('applyGravity accelerates and clamps at max fall', () => {
  close(applyGravity(0, 0.1), -3);
  assert.equal(applyGravity(-44, 1), -45);
  assert.equal(applyGravity(-45, 0.016), -45);
});

test('applyJump sets upward speed', () => {
  assert.equal(applyJump(-10), 12);
  assert.equal(applyJump(0, 15), 15);
});

test('accelerateHorizontal ramps at accel rate and caps at speed', () => {
  let v = accelerateHorizontal({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.1);
  close(v.x, 4.5);
  v = accelerateHorizontal(v, { x: 1, z: 0 }, 1);
  close(v.x, 8);
  close(v.z, 0);
});

test('accelerateHorizontal does not exceed speed on diagonals', () => {
  const d = cameraRelativeDirection({ forward: true, right: true }, 0);
  let v = { x: 0, z: 0 };
  for (let i = 0; i < 100; i++) v = accelerateHorizontal(v, d, 1 / 60);
  close(Math.hypot(v.x, v.z), 8, 1e-6);
});

test('applyFriction decays and eventually stops', () => {
  const v = applyFriction({ x: 8, z: 0 }, 0.1);
  assert.ok(v.x < 8 && v.x > 0);
  close(v.x, 8 * Math.exp(-1.2));
  assert.deepEqual(applyFriction({ x: 0.005, z: 0 }, 0.016), { x: 0, z: 0 });
});
