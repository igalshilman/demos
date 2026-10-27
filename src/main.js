import {
  WebGLRenderer, Scene, Color, Fog, HemisphereLight, DirectionalLight, SRGBColorSpace,
  PCFSoftShadowMap, ACESFilmicToneMapping,
} from 'three';
import { createInput } from './input.js';
import { createFollowCamera } from './camera.js';
import { createUI } from './ui.js';
import { createGameState } from './game-state.js';

export const STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const MAX_FRAME_TIME = 0.25;

function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

const DEFAULT_DEPS = { createInput, createFollowCamera, createGameState, createRenderer };

// Builds the whole game around a canvas and an existing UI. `deps` must supply
// createWorld and createPlayer (the separately owned modules); everything else
// defaults to the real implementation and can be swapped for a test double.
export function createApp({ canvas, ui, deps, env = {} }) {
  const d = { ...DEFAULT_DEPS, ...deps };
  const win = env.win ?? globalThis.window;
  const doc = env.doc ?? globalThis.document;
  const raf = env.requestAnimationFrame ?? ((cb) => win.requestAnimationFrame(cb));
  const caf = env.cancelAnimationFrame ?? ((id) => win.cancelAnimationFrame(id));

  let renderer = null;
  let scene = null;
  let sun = null;
  let world = null;
  let player = null;
  let input = null;
  let rig = null;
  let state = null;

  let rafId = null;
  let fatal = false;
  let torn = false;
  let lastTime = null;
  let accumulator = 0;
  const listeners = [];

  function on(target, type, handler) {
    target.addEventListener(type, handler);
    listeners.push({ target, type, handler });
  }

  function attempt(fn) {
    try {
      fn();
    } catch (error) {
      console.error(error);
    }
  }

  function teardown(keepError) {
    if (!torn) {
      torn = true;
      if (rafId !== null) attempt(() => caf(rafId));
      rafId = null;
      for (const { target, type, handler } of listeners.splice(0)) {
        attempt(() => target.removeEventListener(type, handler));
      }
      attempt(() => input?.dispose());
      attempt(() => rig?.dispose());
      attempt(() => player?.dispose());
      attempt(() => world?.dispose());
      attempt(() => {
        if (sun) {
          sun.shadow.map?.dispose();
          sun.shadow.dispose();
        }
      });
      attempt(() => scene?.clear());
      attempt(() => {
        renderer?.dispose();
        renderer?.forceContextLoss?.();
      });
    }
    attempt(() => ui.dispose({ keepError }));
  }

  function fail(error) {
    if (fatal || torn) return;
    fatal = true;
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    ui.showError(message || 'Unexpected error.');
    teardown(true);
  }

  function resize() {
    const width = win.innerWidth;
    const height = win.innerHeight;
    renderer.setPixelRatio(Math.min(win.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    rig.resize(width, height);
  }

  function restart() {
    if (fatal || torn || !state) return;
    state.restart();
    for (const coin of world.coins) coin.mesh.visible = true;
    player.reset({ ...world.spawn });
    input.clear();
    rig.reset(player.position);
    accumulator = 0;
    ui.render(state);
    canvas.focus?.({ preventScroll: true });
  }

  function respawn() {
    player.reset({ ...world.spawn });
    rig.reset(player.position);
    ui.notify('You fell! Back to the start — your tokens are kept.');
  }

  function fixedStep() {
    const stepInput = input.read(rig.yaw);
    player.step(STEP, stepInput);
    world.update(STEP);

    const events = state.update(player.position, STEP);
    for (const id of events.collected) {
      const coin = world.coins.find((c) => c.id === id);
      if (coin) coin.mesh.visible = false;
    }
    if (events.collected.length) {
      ui.notify(state.goalUnlocked
        ? 'All tokens collected — the goal is open!'
        : `Token ${state.collectedCount} of ${state.total}`);
    }
    if (events.fell) respawn();
    if (events.won) input.clear();
    ui.render(state);
  }

  function frame(now) {
    if (torn) return;
    rafId = raf(frame);
    try {
      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_TIME);
      lastTime = now;

      if (!doc.hidden && !state.won) {
        accumulator += dt;
        let steps = 0;
        while (accumulator >= STEP && steps < MAX_STEPS_PER_FRAME && !state.won) {
          fixedStep();
          accumulator -= STEP;
          steps += 1;
        }
        // Past the catch-up cap, drop the backlog instead of spiralling.
        if (accumulator >= STEP) accumulator = 0;
      } else {
        accumulator = 0;
      }

      rig.update(dt, player.position);
      renderer.render(scene, rig.camera);
    } catch (error) {
      fail(error);
    }
  }

  function onVisibility() {
    lastTime = null;
    accumulator = 0;
  }

  function build() {
    if (typeof d.createWorld !== 'function' || typeof d.createPlayer !== 'function') {
      throw new Error('The level and player modules are missing.');
    }
    renderer = d.createRenderer(canvas);

    scene = new Scene();
    scene.background = new Color(0x8fc8ff);
    scene.fog = new Fog(0x8fc8ff, 40, 140);
    scene.add(new HemisphereLight(0xdfefff, 0x4a5a78, 1.1));
    sun = new DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
    scene.add(sun);

    world = d.createWorld();
    scene.add(world.group);

    player = d.createPlayer({ platforms: world.platforms, spawn: { ...world.spawn } });
    scene.add(player.group);

    state = d.createGameState({ coins: world.coins, goal: world.goal, killY: world.killY });
    rig = d.createFollowCamera(canvas);
    input = d.createInput({ onRestart: restart, win, doc });

    rig.reset(player.position);
    resize();
    on(win, 'resize', resize);
    on(doc, 'visibilitychange', onVisibility);
    on(win, 'error', (e) => fail(e.error || e.message));
    on(win, 'unhandledrejection', (e) => fail(e.reason));
    ui.render(state);
  }

  return {
    // Returns true when the game is running; on failure the error panel is shown
    // and everything built so far has been released.
    start() {
      if (torn) return false;
      try {
        build();
      } catch (error) {
        fail(error);
        return false;
      }
      ui.hideLoading();
      rafId = raf(frame);
      return true;
    },
    restart,
    frame,
    dispose() {
      teardown(false);
    },
    get scene() { return scene; },
    get state() { return state; },
    get disposed() { return torn; },
  };
}

let app = null;
let ui = null;
let cancelled = false;

async function bootstrap() {
  const canvas = document.getElementById('game');
  ui = createUI(document.getElementById('app'), { onRestart: () => app?.restart() });
  try {
    const [{ createWorld }, { createPlayer }] = await Promise.all([
      import('./world.js'),
      import('./player.js'),
    ]);
    if (cancelled) return;
    app = createApp({ canvas, ui, deps: { createWorld, createPlayer } });
    app.start();
  } catch (error) {
    console.error(error);
    ui.showError(error instanceof Error && error.message ? error.message : 'Failed to load the game.');
  }
}

if (typeof document !== 'undefined') bootstrap();

import.meta.hot?.dispose(() => {
  cancelled = true;
  app?.dispose();
  ui?.dispose();
});
