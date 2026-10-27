import test from 'node:test';
import assert from 'node:assert/strict';
import { createUI } from '../src/ui.js';
import { createFakeDocument, FakeNode } from './fake-dom.js';

// Timer doubles built on plain globals, so the tests need nothing newer than Node 18.
function installFakeTimers() {
  const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const timers = new Map();
  let nextId = 1;
  let now = 0;
  globalThis.setTimeout = (fn, delay = 0) => {
    const id = nextId++;
    timers.set(id, { fn, at: now + delay });
    return id;
  };
  globalThis.clearTimeout = (id) => { timers.delete(id); };
  return {
    pending: () => timers.size,
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now && timers.delete(id)) timer.fn();
      }
    },
    restore() {
      globalThis.setTimeout = real.setTimeout;
      globalThis.clearTimeout = real.clearTimeout;
    },
  };
}

function setup(options = {}) {
  const doc = createFakeDocument();
  const root = new FakeNode('main');
  const calls = { restart: 0, reload: 0 };
  const ui = createUI(
    root,
    { onRestart: () => { calls.restart += 1; }, reload: () => { calls.reload += 1; }, ...options },
    doc,
  );
  return { root, ui, calls };
}

const countListeners = (root) => root.find(() => true).reduce((n, node) => n + node.listenerCount(), 0);
const gameState = (extra = {}) => ({
  collectedCount: 2, total: 6, elapsed: 12.34, won: false, goalUnlocked: false, ...extra,
});

test('renders HUD text with textContent only', () => {
  const { root, ui } = setup();
  ui.render(gameState());
  const text = root.find(() => true).map((n) => n.textContent).join('|');
  assert.match(text, /Tokens: 2 \/ 6/);
  assert.match(text, /Time: 00:12\.3/);
  assert.match(text, /Goal locked/);

  ui.showError('<img src=x onerror=alert(1)>');
  assert.equal(root.byClass('overlay-error')[0].hidden, false);
  assert.ok(root.find((n) => n.textContent === '<img src=x onerror=alert(1)>').length === 1);
});

test('win panel shows and hides with the game state', () => {
  const { root, ui } = setup();
  const win = root.byClass('overlay-win')[0];
  assert.equal(win.hidden, true);
  ui.render(gameState({ won: true, collectedCount: 6 }));
  assert.equal(win.hidden, false);
  ui.render(gameState());
  assert.equal(win.hidden, true);
});

test('restart and play-again buttons call onRestart', () => {
  const { root, ui, calls } = setup();
  const buttons = root.find((n) => n.tag === 'button');
  assert.ok(buttons.every((b) => b.type === 'button'));
  buttons[0].click();
  buttons[1].click();
  assert.equal(calls.restart, 2);
  ui.dispose();
});

test('dispose removes all nodes and listeners, clears the toast timer, and is idempotent', () => {
  const timers = installFakeTimers();
  try {
    const { root, ui, calls } = setup();
    const toast = root.byClass('toast')[0];
    const restartButton = root.find((n) => n.tag === 'button')[0];
    assert.ok(countListeners(root) > 0);

    ui.notify('hello');
    assert.equal(timers.pending(), 1);
    ui.dispose();
    ui.dispose();
    assert.equal(timers.pending(), 0, 'dispose cancels the toast timer');

    assert.equal(root.children.length, 0);
    assert.equal(restartButton.listenerCount(), 0);
    timers.tick(5000);
    assert.equal(toast.textContent, 'hello', 'toast timer must not fire after dispose');

    restartButton.click();
    assert.equal(calls.restart, 0);
    ui.render(gameState());
    ui.notify('later');
    ui.showError('late');
    assert.equal(root.children.length, 0);
  } finally {
    timers.restore();
  }
});

test('toast clears itself after a delay while live', () => {
  const timers = installFakeTimers();
  try {
    const { root, ui } = setup();
    const toast = root.byClass('toast')[0];
    ui.notify('hi');
    assert.equal(toast.textContent, 'hi');
    timers.tick(3000);
    assert.equal(toast.textContent, '');
    ui.dispose();
  } finally {
    timers.restore();
  }
});

test('dispose({keepError}) keeps a visible error panel working, a later dispose removes it', () => {
  const { root, ui, calls } = setup();
  ui.showError('boom');
  ui.dispose({ keepError: true });

  assert.deepEqual(root.children.map((n) => n.className), ['overlay overlay-error']);
  const panel = root.children[0];
  assert.equal(panel.hidden, false);
  assert.ok(panel.find((n) => n.textContent === 'boom').length === 1);
  panel.find((n) => n.tag === 'button')[0].click();
  assert.equal(calls.reload, 1);

  ui.dispose({ keepError: true });
  assert.equal(root.children.length, 1);

  ui.showError('second');
  assert.ok(panel.find((n) => n.textContent === 'second').length === 1);

  ui.dispose();
  ui.dispose();
  assert.equal(root.children.length, 0);
  assert.equal(countListeners(panel), 0);
});

test('dispose({keepError}) without an error removes everything', () => {
  const { root, ui } = setup();
  ui.dispose({ keepError: true });
  assert.equal(root.children.length, 0);
});
