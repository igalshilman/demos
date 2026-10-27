import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { Group, DirectionalLight } from 'three';
import { createApp, STEP, MAX_STEPS_PER_FRAME } from '../src/main.js';
import { createUI } from '../src/ui.js';
import { createFakeDocument, createFakeWindow, FakeNode } from './fake-dom.js';

const MS = STEP * 1000;

function createHarness({ coinsCount = 2, useRealUI = false, failures = {} } = {}) {
  const win = createFakeWindow();
  const doc = createFakeDocument();
  const canvas = { focusCount: 0, focus() { this.focusCount += 1; } };
  const root = new FakeNode('main');

  const raf = { next: 1, pending: new Map(), cancelled: [] };
  const env = {
    win,
    doc,
    requestAnimationFrame(cb) {
      const id = raf.next++;
      raf.pending.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) {
      raf.cancelled.push(id);
      raf.pending.delete(id);
    },
  };

  const log = {
    steps: [], worldUpdates: 0, playerResets: [], rigResets: [], rigUpdates: 0, renders: 0,
    inputClears: 0, disposed: [], renderer: { sizes: [], pixelRatios: [] },
  };
  const script = { stepPositions: [] };
  const parts = {};

  const spawn = Object.freeze({ x: 0, y: 0, z: 0 });
  const coinPositions = [{ x: 5, y: 1, z: 0 }, { x: 8, y: 1, z: 0 }];
  const goal = { position: { x: 12, y: 0, z: 0 }, radius: 1 };

  const createWorld = () => {
    if (failures.world) throw new Error(failures.world);
    const world = {
      group: new Group(),
      platforms: [],
      coins: coinPositions.slice(0, coinsCount).map((position, i) => ({
        id: `c${i + 1}`, mesh: { visible: true }, position, radius: 0.4,
      })),
      spawn,
      goal,
      killY: -10,
      update() { log.worldUpdates += 1; },
      dispose() { log.disposed.push('world'); },
    };
    parts.world = world;
    return world;
  };

  const createPlayer = (options) => {
    if (failures.player) throw new Error(failures.player);
    const group = new Group();
    group.position.set(options.spawn.x, options.spawn.y, options.spawn.z);
    const player = {
      group,
      position: group.position,
      grounded: true,
      step(dt, input) {
        log.steps.push({ dt, input });
        const next = script.stepPositions.shift();
        if (next === 'throw') throw new Error('step exploded');
        if (next) group.position.set(next.x, next.y, next.z);
      },
      reset(p) {
        log.playerResets.push(p);
        group.position.set(p.x, p.y, p.z);
      },
      dispose() { log.disposed.push('player'); },
    };
    parts.player = player;
    parts.playerOptions = options;
    return player;
  };

  const createFollowCamera = () => {
    const rig = {
      camera: {}, yaw: 0,
      resize(w, h) { log.rigResize = [w, h]; },
      reset(target) { log.rigResets.push({ ...target }); },
      update() { log.rigUpdates += 1; },
      dispose() { log.disposed.push('rig'); },
    };
    parts.rig = rig;
    return rig;
  };

  const createInput = (options) => {
    const input = {
      read: () => ({ moveX: 0, moveZ: 0, jumpPressed: false }),
      clear() { log.inputClears += 1; },
      dispose() { log.disposed.push('input'); },
      onRestart: options.onRestart,
    };
    parts.input = input;
    return input;
  };

  const createRenderer = () => {
    const renderer = {
      render() { log.renders += 1; },
      setSize(w, h) { log.renderer.sizes.push([w, h]); },
      setPixelRatio(r) { log.renderer.pixelRatios.push(r); },
      dispose() { log.disposed.push('renderer'); },
    };
    parts.renderer = renderer;
    return renderer;
  };

  let ui;
  if (useRealUI) {
    ui = createUI(root, { onRestart: () => {} }, doc);
  } else {
    ui = {
      calls: [],
      render(s) { this.calls.push(['render', s.collectedCount, s.won]); },
      notify(m) { this.calls.push(['notify', m]); },
      hideLoading() { this.calls.push(['hideLoading']); },
      showError(m) { this.calls.push(['showError', m]); },
      dispose(o) { this.calls.push(['dispose', o]); },
    };
  }

  const app = createApp({
    canvas,
    ui,
    env,
    deps: {
      createWorld: failures.missingModules ? undefined : createWorld,
      createPlayer,
      createFollowCamera,
      createInput,
      createRenderer,
    },
  });

  let clock = 0;
  // Runs the pending animation frame callback at an absolute time in ms.
  const frameAt = (ms) => {
    clock = ms;
    const [id, cb] = [...raf.pending.entries()].pop();
    raf.pending.delete(id);
    cb(ms);
  };
  const count = (name) => log.steps.length && name;

  return { app, win, doc, canvas, root, raf, log, script, parts, ui, spawn, goal, frameAt, count, get clock() { return clock; } };
}

const quietErrors = () => mock.method(console, 'error', () => {});

test('start sizes the renderer (pixel ratio capped), resets the camera and schedules a frame', () => {
  const h = createHarness();
  assert.equal(h.app.start(), true);
  assert.deepEqual(h.log.renderer.pixelRatios, [2]);
  assert.deepEqual(h.log.renderer.sizes, [[800, 600]]);
  assert.deepEqual(h.log.rigResize, [800, 600]);
  assert.equal(h.log.rigResets.length, 1);
  assert.equal(h.raf.pending.size, 1);
  assert.deepEqual(h.parts.playerOptions.spawn, h.spawn);
  assert.notEqual(h.parts.playerOptions.spawn, h.spawn, 'the player gets its own spawn copy');
  assert.ok(h.ui.calls.some(([name]) => name === 'hideLoading'));
  assert.equal(h.win.listenerCount('resize'), 1);
  h.app.dispose();
});

test('fixed timestep: the first frame never steps, then whole 1/60 s steps with the remainder kept', () => {
  const h = createHarness();
  h.app.start();
  h.frameAt(0);
  assert.equal(h.log.steps.length, 0);

  h.frameAt(2.5 * MS);
  assert.equal(h.log.steps.length, 2);
  assert.ok(h.log.steps.every((s) => s.dt === STEP));
  assert.equal(h.log.worldUpdates, 2);

  h.frameAt(2.5 * MS + 0.6 * MS);
  assert.equal(h.log.steps.length, 3, 'half a step carried over plus 0.6 of a step makes one more');
  assert.equal(h.log.rigUpdates, 3);
  assert.equal(h.log.renders, 3);
  h.app.dispose();
});

test('catch-up is capped and the backlog is dropped', () => {
  const h = createHarness();
  h.app.start();
  h.frameAt(0);
  h.frameAt(10_000);
  assert.equal(h.log.steps.length, MAX_STEPS_PER_FRAME);

  h.frameAt(10_000 + 0.5 * MS);
  assert.equal(h.log.steps.length, MAX_STEPS_PER_FRAME, 'no leftover backlog to burn through');
  h.frameAt(10_000 + 1.1 * MS);
  assert.equal(h.log.steps.length, MAX_STEPS_PER_FRAME + 1);
  h.app.dispose();
});

test('hidden tab pauses the simulation and resuming does not replay the gap', () => {
  const h = createHarness();
  h.app.start();
  h.frameAt(0);
  h.frameAt(MS * 1.01);
  assert.equal(h.log.steps.length, 1);

  h.doc.hidden = true;
  h.doc.fire('visibilitychange');
  h.frameAt(5 * MS);
  h.frameAt(50 * MS);
  assert.equal(h.log.steps.length, 1);
  assert.equal(h.log.worldUpdates, 1);

  h.doc.hidden = false;
  h.doc.fire('visibilitychange');
  h.frameAt(60_000);
  assert.equal(h.log.steps.length, 1, 'first frame after resume has zero elapsed time');
  h.frameAt(60_000 + 1.01 * MS);
  assert.equal(h.log.steps.length, 2);
  h.app.dispose();
});

test('victory stops the simulation but keeps rendering', () => {
  const h = createHarness();
  h.app.start();
  h.script.stepPositions.push(
    { x: 5, y: 0, z: 0 },
    { x: 8, y: 0, z: 0 },
    { x: 12, y: 0, z: 0 },
  );
  h.frameAt(0);
  h.frameAt(10_000);

  assert.equal(h.log.steps.length, 3, 'stepping stops on the step that wins, within the same frame');
  assert.equal(h.app.state.won, true);
  assert.equal(h.parts.world.coins.every((c) => !c.mesh.visible), true);
  assert.deepEqual(h.ui.calls.filter(([n]) => n === 'render').pop(), ['render', 2, true]);
  assert.ok(h.log.inputClears >= 1, 'held keys are cleared on victory');

  const rendersBefore = h.log.renders;
  const elapsed = h.app.state.elapsed;
  h.frameAt(20_000);
  h.frameAt(30_000);
  assert.equal(h.log.steps.length, 3);
  assert.equal(h.log.worldUpdates, 3);
  assert.equal(h.app.state.elapsed, elapsed);
  assert.equal(h.log.renders, rendersBefore + 2);
  assert.equal(h.log.rigUpdates, 4);
  h.app.dispose();
});

test('falling respawns at the spawn, resets the camera and keeps collected tokens', () => {
  const h = createHarness();
  h.app.start();
  h.script.stepPositions.push({ x: 5, y: 0, z: 0 }, { x: 6, y: -20, z: 0 });
  h.frameAt(0);
  h.frameAt(2.1 * MS);

  const coins = h.parts.world.coins;
  assert.equal(coins[0].mesh.visible, false);
  assert.equal(coins[1].mesh.visible, true);
  assert.equal(h.app.state.collectedCount, 1);
  assert.equal(h.app.state.status, 'playing');
  assert.equal(h.app.state.falls, 1);

  assert.deepEqual(h.log.playerResets, [h.spawn]);
  assert.notEqual(h.log.playerResets[0], h.spawn);
  assert.equal(h.log.rigResets.length, 2);
  assert.deepEqual(h.log.rigResets[1], { x: 0, y: 0, z: 0 });
  assert.ok(h.ui.calls.some(([n, m]) => n === 'notify' && /fell/i.test(m)));
  h.app.dispose();
});

test('restart restores coins, player, camera, input, tokens and timer (also after winning)', () => {
  const h = createHarness();
  h.app.start();
  h.script.stepPositions.push({ x: 5, y: 0, z: 0 }, { x: 8, y: 0, z: 0 }, { x: 12, y: 0, z: 0 });
  h.frameAt(0);
  h.frameAt(10_000);
  assert.equal(h.app.state.won, true);

  const clearsBefore = h.log.inputClears;
  h.parts.player.position.set(99, 5, 99);
  h.app.restart();

  assert.ok(h.parts.world.coins.every((c) => c.mesh.visible));
  assert.deepEqual(h.log.playerResets.at(-1), h.spawn);
  assert.deepEqual(h.log.rigResets.at(-1), { x: 0, y: 0, z: 0 });
  assert.equal(h.log.inputClears, clearsBefore + 1);
  assert.equal(h.app.state.status, 'playing');
  assert.equal(h.app.state.collectedCount, 0);
  assert.equal(h.app.state.elapsed, 0);
  assert.equal(h.canvas.focusCount, 1);
  assert.deepEqual(h.ui.calls.filter(([n]) => n === 'render').pop(), ['render', 0, false]);

  const stepsBefore = h.log.steps.length;
  h.frameAt(10_000 + 1.1 * MS);
  assert.equal(h.log.steps.length, stepsBefore + 1, 'the simulation runs again after restart');
  h.app.dispose();
});

test('the R key callback given to the input module restarts the game', () => {
  const h = createHarness();
  h.app.start();
  h.script.stepPositions.push({ x: 5, y: 0, z: 0 });
  h.frameAt(0);
  h.frameAt(1.1 * MS);
  assert.equal(h.app.state.collectedCount, 1);
  h.parts.input.onRestart();
  assert.equal(h.app.state.collectedCount, 0);
  assert.equal(h.parts.world.coins[0].mesh.visible, true);
  h.app.dispose();
});

test('dispose cancels the frame, removes listeners, disposes modules and renderer, and is idempotent', () => {
  const h = createHarness();
  h.app.start();
  h.frameAt(0);
  const scene = h.app.scene;
  const sun = scene.children.find((c) => c instanceof DirectionalLight);
  const shadowDispose = mock.method(sun.shadow, 'dispose');
  const [pendingId, pendingCb] = [...h.raf.pending.entries()][0];

  h.app.dispose();
  assert.deepEqual(h.raf.cancelled, [pendingId]);
  assert.equal(h.raf.pending.size, 0);
  assert.equal(h.win.listenerCount(), 0);
  assert.equal(h.doc.listenerCount(), 0);
  assert.deepEqual([...h.log.disposed].sort(), ['input', 'player', 'renderer', 'rig', 'world']);
  assert.equal(shadowDispose.mock.callCount(), 1);
  assert.equal(scene.children.length, 0);
  assert.deepEqual(h.ui.calls.at(-1), ['dispose', { keepError: false }]);
  assert.equal(h.app.disposed, true);

  h.app.dispose();
  assert.equal(h.log.disposed.length, 5);
  assert.equal(shadowDispose.mock.callCount(), 1);

  // A stale animation frame or late event does nothing.
  const stepsBefore = h.log.steps.length;
  const rendersBefore = h.log.renders;
  pendingCb(5000);
  h.app.restart();
  assert.equal(h.log.steps.length, stepsBefore);
  assert.equal(h.log.renders, rendersBefore);
  assert.equal(h.raf.pending.size, 0);
  assert.equal(h.log.inputClears, 0);
});

test('a throwing step shows the error, tears the game down and keeps the error panel', () => {
  quietErrors();
  try {
    const h = createHarness({ useRealUI: true });
    h.app.start();
    h.script.stepPositions.push('throw');
    h.frameAt(0);
    h.frameAt(1.1 * MS);

    assert.equal(h.app.disposed, true);
    assert.deepEqual([...h.log.disposed].sort(), ['input', 'player', 'renderer', 'rig', 'world']);
    assert.equal(h.raf.pending.size, 0);
    assert.equal(h.win.listenerCount(), 0);

    assert.deepEqual(h.root.children.map((n) => n.className), ['overlay overlay-error']);
    const panel = h.root.children[0];
    assert.equal(panel.hidden, false);
    assert.ok(panel.find((n) => n.textContent === 'step exploded').length === 1);

    h.app.dispose();
    assert.equal(h.root.children.length, 0, 'an explicit dispose finally removes the error panel');
    assert.equal(h.log.disposed.length, 5, 'resources are released only once');
  } finally {
    mock.restoreAll();
  }
});

test('with a mock UI, a fatal error reports then disposes with keepError', () => {
  quietErrors();
  try {
    const h = createHarness();
    h.app.start();
    h.script.stepPositions.push('throw');
    h.frameAt(0);
    h.frameAt(1.1 * MS);
    const names = h.ui.calls.map(([n]) => n);
    assert.ok(names.indexOf('showError') < names.indexOf('dispose'));
    assert.deepEqual(h.ui.calls.at(-1), ['dispose', { keepError: true }]);
    assert.deepEqual(h.ui.calls.find(([n]) => n === 'showError'), ['showError', 'step exploded']);
  } finally {
    mock.restoreAll();
  }
});

test('partial initialization failure releases what was built and shows the error', () => {
  quietErrors();
  try {
    const h = createHarness({ failures: { player: 'no player today' } });
    assert.equal(h.app.start(), false);
    assert.deepEqual([...h.log.disposed].sort(), ['renderer', 'world']);
    assert.equal(h.raf.pending.size, 0);
    assert.equal(h.win.listenerCount(), 0);
    assert.deepEqual(h.ui.calls.find(([n]) => n === 'showError'), ['showError', 'no player today']);
    assert.deepEqual(h.ui.calls.at(-1), ['dispose', { keepError: true }]);
    assert.equal(h.ui.calls.some(([n]) => n === 'hideLoading'), false);
    assert.equal(h.app.start(), false);
  } finally {
    mock.restoreAll();
  }
});

test('failure while building the world leaves only the renderer to release', () => {
  quietErrors();
  try {
    const h = createHarness({ failures: { world: 'bad level' } });
    assert.equal(h.app.start(), false);
    assert.deepEqual(h.log.disposed, ['renderer']);
  } finally {
    mock.restoreAll();
  }
});

test('missing level/player modules produce a readable error', () => {
  quietErrors();
  try {
    const h = createHarness({ failures: { missingModules: true } });
    assert.equal(h.app.start(), false);
    assert.match(h.ui.calls.find(([n]) => n === 'showError')[1], /missing/i);
    assert.deepEqual(h.log.disposed, []);
  } finally {
    mock.restoreAll();
  }
});

test('uncaught window errors are fatal once, and ignored after disposal', () => {
  quietErrors();
  try {
    const h = createHarness();
    h.app.start();
    h.win.fire('error', { error: new Error('async trouble') });
    h.win.fire('error', { error: new Error('second') });
    assert.equal(h.ui.calls.filter(([n]) => n === 'showError').length, 1);
    assert.equal(h.app.disposed, true);

    const h2 = createHarness();
    h2.app.start();
    const handlerHolder = [...h2.win.handlers.get('unhandledrejection')][0];
    h2.app.dispose();
    handlerHolder({ reason: new Error('too late') });
    assert.equal(h2.ui.calls.some(([n]) => n === 'showError'), false);
  } finally {
    mock.restoreAll();
  }
});

test('a disposer that throws does not stop the other disposers', () => {
  quietErrors();
  try {
    const h = createHarness();
    h.app.start();
    h.parts.input.dispose = () => { throw new Error('nope'); };
    h.app.dispose();
    assert.deepEqual([...h.log.disposed].sort(), ['player', 'renderer', 'rig', 'world']);
    assert.deepEqual(h.ui.calls.at(-1), ['dispose', { keepError: false }]);
  } finally {
    mock.restoreAll();
  }
});

// Runs against the real level and player modules once they are present in the tree.
const haveRealModules = existsSync(new URL('../src/world.js', import.meta.url))
  && existsSync(new URL('../src/player.js', import.meta.url));

test('real world and player modules satisfy the shell contract', { skip: !haveRealModules }, async () => {
  const [{ createWorld }, { createPlayer }] = await Promise.all([
    import('../src/world.js'),
    import('../src/player.js'),
  ]);
  const world = createWorld();
  try {
    assert.ok(world.group && Array.isArray(world.platforms) && world.platforms.length > 0);
    assert.ok(world.coins.length > 0);
    for (const coin of world.coins) {
      assert.ok(coin.id !== undefined && coin.mesh && coin.radius > 0);
      assert.equal(typeof coin.position.x, 'number');
    }
    assert.equal(typeof world.killY, 'number');
    assert.equal(typeof world.update, 'function');
    assert.equal(typeof world.dispose, 'function');
    assert.ok(world.goal.radius > 0);

    const player = createPlayer({ platforms: world.platforms, spawn: { ...world.spawn } });
    try {
      assert.strictEqual(player.position, player.group.position, 'foot position is the live group position');
      assert.deepEqual({ ...player.position }, { ...world.spawn });
      for (let i = 0; i < 120; i += 1) player.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: false });
      assert.equal(player.grounded, true, 'player settles on the spawn platform');
      assert.ok(player.position.y > world.killY);

      const y0 = player.position.y;
      player.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: true });
      for (let i = 0; i < 10; i += 1) player.step(STEP, { moveX: 0, moveZ: 0, jumpPressed: false });
      assert.ok(player.position.y > y0, 'jump edge lifts the player');

      player.reset({ ...world.spawn });
      assert.deepEqual({ ...player.position }, { ...world.spawn });
    } finally {
      player.dispose();
    }
  } finally {
    world.dispose();
  }
});
