import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../src/input.js';
import { createFakeDocument, createFakeWindow } from './fake-dom.js';

function setup(options = {}) {
  const win = createFakeWindow();
  const doc = createFakeDocument();
  const input = createInput({ win, doc, ...options });
  const press = (code, extra = {}) => {
    const event = { code, repeat: false, target: win, preventDefault() { this.prevented = true; }, ...extra };
    win.fire('keydown', event);
    return event;
  };
  const release = (code) => win.fire('keyup', { code });
  return { win, doc, input, press, release };
}

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !~ ${expected}`);

test('releasing W does not cancel a still-held ArrowUp (and vice versa)', () => {
  const { input, press, release } = setup();
  press('KeyW');
  press('ArrowUp');
  release('KeyW');
  let v = input.read(0);
  near(v.moveX, 0);
  near(v.moveZ, -1);
  release('ArrowUp');
  v = input.read(0);
  near(Math.hypot(v.moveX, v.moveZ), 0);

  press('ArrowLeft');
  press('KeyA');
  release('ArrowLeft');
  near(input.read(0).moveX, -1);
  release('KeyA');
  near(input.read(0).moveX, 0);
});

test('opposite directions cancel and unrelated keys are ignored', () => {
  const { input, press } = setup();
  press('KeyW');
  press('ArrowDown');
  press('KeyQ');
  const v = input.read(0);
  near(Math.hypot(v.moveX, v.moveZ), 0);
});

test('movement is relative to the camera yaw', () => {
  const { input, press, release } = setup();
  press('KeyW');
  let v = input.read(0);
  near(v.moveX, 0);
  near(v.moveZ, -1);

  v = input.read(Math.PI / 2);
  near(v.moveX, -1);
  near(v.moveZ, 0);

  release('KeyW');
  press('KeyD');
  v = input.read(0);
  near(v.moveX, 1);
  near(v.moveZ, 0);
  v = input.read(Math.PI / 2);
  near(v.moveX, 0);
  near(v.moveZ, -1);
});

test('diagonal movement is normalized to length 1 at any yaw', () => {
  const { input, press } = setup();
  press('KeyW');
  press('ArrowRight');
  for (const yaw of [0, 0.7, 2, -3.1]) {
    const v = input.read(yaw);
    near(Math.hypot(v.moveX, v.moveZ), 1);
  }
  const v = input.read(0);
  near(v.moveX, Math.SQRT1_2);
  near(v.moveZ, -Math.SQRT1_2);
});

test('jump is a one-read edge and ignores key repeat', () => {
  const { input, press, release } = setup();
  assert.equal(input.read(0).jumpPressed, false);
  press('Space');
  assert.equal(input.read(0).jumpPressed, true);
  assert.equal(input.read(0).jumpPressed, false);

  press('Space', { repeat: true });
  press('Space', { repeat: true });
  assert.equal(input.read(0).jumpPressed, false);

  release('Space');
  press('Space');
  press('Space');
  assert.equal(input.read(0).jumpPressed, true);
  assert.equal(input.read(0).jumpPressed, false);
});

test('arrows and Space are default-prevented; other keys are not', () => {
  const { press } = setup();
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) {
    assert.equal(press(code).prevented, true, code);
  }
  assert.equal(press('KeyW').prevented, undefined);
  assert.equal(press('Tab').prevented, undefined);
});

test('Space on a focused button keeps its native behavior and does not jump', () => {
  const { input, press, win } = setup();
  const button = { closest: () => ({}) };
  const event = press('Space', { target: button });
  assert.equal(event.prevented, undefined);
  assert.equal(input.read(0).jumpPressed, false);
  // Arrow keys still must not scroll the page.
  assert.equal(press('ArrowDown', { target: button }).prevented, true);
  assert.ok(win);
});

test('keys with modifiers are ignored', () => {
  const { input, press } = setup();
  press('KeyW', { ctrlKey: true });
  press('Space', { metaKey: true });
  const v = input.read(0);
  assert.equal(Math.hypot(v.moveX, v.moveZ), 0);
  assert.equal(v.jumpPressed, false);
});

test('R restarts once per press, not on repeat', () => {
  let restarts = 0;
  const { press } = setup({ onRestart: () => { restarts += 1; } });
  press('KeyR');
  press('KeyR', { repeat: true });
  assert.equal(restarts, 1);
});

test('window blur clears held keys and a queued jump', () => {
  const { input, press, win } = setup();
  press('KeyW');
  press('KeyD');
  press('Space');
  win.fire('blur');
  const v = input.read(0);
  assert.equal(Math.hypot(v.moveX, v.moveZ), 0);
  assert.equal(v.jumpPressed, false);
});

test('hiding the page clears keys; showing it does not', () => {
  const { input, press, doc } = setup();
  press('KeyW');
  doc.hidden = false;
  doc.fire('visibilitychange');
  near(input.read(0).moveZ, -1);

  press('Space');
  doc.hidden = true;
  doc.fire('visibilitychange');
  const v = input.read(0);
  near(Math.hypot(v.moveX, v.moveZ), 0);
  assert.equal(v.jumpPressed, false);
});

test('dispose removes every listener, clears state and is idempotent', () => {
  const { input, press, win, doc } = setup();
  assert.equal(win.listenerCount(), 3);
  assert.equal(doc.listenerCount(), 1);
  press('KeyW');
  input.dispose();
  input.dispose();
  assert.equal(win.listenerCount(), 0);
  assert.equal(doc.listenerCount(), 0);
  const v = input.read(0);
  assert.equal(Math.hypot(v.moveX, v.moveZ), 0);
});
