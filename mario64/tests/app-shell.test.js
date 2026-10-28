import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createInput } from '../src/input.js';
import { createGame, MAX_DT } from '../src/game.js';

function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    emit: (type, event = {}) => listeners.get(type)?.(event),
    listeners,
  };
}

function key(code, extra = {}) {
  const event = { code, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
  return event;
}

test('input maps WASD, arrows and Space to held actions and prevents scrolling', () => {
  const target = fakeTarget();
  const input = createInput(target, { doc: fakeTarget() });
  const pairs = [['KeyW', 'forward'], ['ArrowUp', 'forward'], ['KeyS', 'backward'], ['ArrowDown', 'backward'],
    ['KeyA', 'left'], ['ArrowLeft', 'left'], ['KeyD', 'right'], ['ArrowRight', 'right'], ['Space', 'jump']];
  for (const [code, action] of pairs) {
    const down = key(code);
    target.emit('keydown', down);
    assert.equal(input.state[action], true, `${code} down`);
    assert.equal(down.defaultPrevented, true, `${code} prevented`);
    target.emit('keyup', key(code));
    assert.equal(input.state[action], false, `${code} up`);
  }
});

test('input clears held keys on blur and when the page is hidden', () => {
  const target = fakeTarget();
  const doc = Object.assign(fakeTarget(), { hidden: false });
  const input = createInput(target, { doc });
  target.emit('keydown', key('KeyW'));
  target.emit('keydown', key('Space'));
  target.emit('blur');
  assert.deepEqual(Object.values(input.state), [false, false, false, false, false]);
  target.emit('keydown', key('KeyD'));
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(input.state.right, false);
});

test('R triggers restart once per press and other keys are not prevented', () => {
  const target = fakeTarget();
  let restarts = 0;
  createInput(target, { onRestart: () => restarts++, doc: fakeTarget() });
  target.emit('keydown', key('KeyR'));
  target.emit('keydown', key('KeyR', { repeat: true }));
  assert.equal(restarts, 1);
  const other = key('KeyP');
  target.emit('keydown', other);
  assert.equal(other.defaultPrevented, false);
});

test('dispose removes listeners', () => {
  const target = fakeTarget();
  const input = createInput(target, { doc: fakeTarget() });
  input.dispose();
  assert.equal(target.listeners.size, 0);
});

function makeGame({ playerBox, goal, y = 5 }) {
  const calls = [];
  const position = new THREE.Vector3(0, y, 0);
  const player = {
    position,
    update: (dt, input, fwd) => calls.push(['player', dt, fwd]),
    reset: () => { position.set(0, 5, 0); calls.push(['playerReset']); },
    getBounds: () => playerBox,
  };
  const followCamera = {
    update: (dt, pos) => calls.push(['camera', dt, pos]),
    reset: (pos) => calls.push(['cameraReset', pos]),
  };
  const level = { goal, respawnY: -20 };
  const statuses = [];
  const game = createGame({ player, followCamera, level, onStatus: (s) => statuses.push(s) });
  return { game, calls, statuses, position };
}

const far = new THREE.Box3(new THREE.Vector3(100, 0, 100), new THREE.Vector3(101, 1, 101));
const near = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));

test('game clamps dt, updates player then camera with forward vector', () => {
  const { game, calls } = makeGame({ playerBox: near, goal: far });
  const fwd = new THREE.Vector3(0, 0, -1);
  game.update(1, {}, fwd);
  assert.deepEqual(calls.map((c) => c[0]), ['player', 'camera']);
  assert.equal(calls[0][1], MAX_DT);
  assert.equal(calls[0][2], fwd);
  assert.equal(calls[1][1], MAX_DT);
});

test('overlapping the goal wins and halts simulation until reset', () => {
  const { game, calls, statuses } = makeGame({ playerBox: near, goal: near });
  game.update(0.016, {}, new THREE.Vector3(0, 0, -1));
  assert.equal(game.won, true);
  assert.deepEqual(statuses, ['won']);
  const count = calls.length;
  game.update(0.016, {}, new THREE.Vector3(0, 0, -1));
  assert.equal(calls.length, count);
  game.reset();
  assert.equal(game.won, false);
  assert.deepEqual(statuses, ['won', 'playing']);
  assert.deepEqual(calls.slice(count).map((c) => c[0]), ['playerReset', 'cameraReset']);
});

test('falling below respawnY resets player and camera', () => {
  const { game, calls, statuses } = makeGame({ playerBox: near, goal: far, y: -21 });
  game.update(0.016, {}, new THREE.Vector3(0, 0, -1));
  assert.deepEqual(calls.map((c) => c[0]), ['player', 'playerReset', 'cameraReset']);
  assert.deepEqual(statuses, ['respawned']);
});

test('index.html provides the canvas, HUD controls and entry script', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['game', 'status', 'victory']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /src="\/src\/main\.js"/);
});
