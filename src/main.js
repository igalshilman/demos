import {
  WebGLRenderer, Scene, Color, Fog, HemisphereLight, DirectionalLight, SRGBColorSpace,
  PCFSoftShadowMap, ACESFilmicToneMapping,
} from 'three';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createFollowCamera } from './camera.js';
import { createUI } from './ui.js';
import { createGameState } from './game-state.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_TIME = 0.25;

const root = document.getElementById('app');
const canvas = document.getElementById('game');

let fatal = false;
const ui = createUI(root, { onRestart: () => restart() });

function fail(error) {
  fatal = true;
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  ui.showError(message || 'Unexpected error.');
}

let renderer;
let scene;
let world;
let player;
let input;
let rig;
let state;

function init() {
  renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  scene = new Scene();
  scene.background = new Color(0x8fc8ff);
  scene.fog = new Fog(0x8fc8ff, 40, 140);

  scene.add(new HemisphereLight(0xdfefff, 0x4a5a78, 1.1));
  const sun = new DirectionalLight(0xfff1d6, 2.2);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 80 });
  scene.add(sun);

  world = createWorld();
  scene.add(world.group);

  player = createPlayer({ platforms: world.platforms, spawn: { ...world.spawn } });
  scene.add(player.group);

  state = createGameState({ coins: world.coins, goal: world.goal, killY: world.killY });
  rig = createFollowCamera(canvas);
  input = createInput({ onRestart: () => restart() });

  rig.reset(player.position);
  resize();
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { lastTime = null; });
  window.addEventListener('error', (e) => fail(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => fail(e.reason));
  ui.render(state);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  rig.resize(width, height);
}

function restart() {
  if (fatal || !state) return;
  state.restart();
  for (const coin of world.coins) coin.mesh.visible = true;
  player.reset({ ...world.spawn });
  input.clear();
  rig.reset(player.position);
  accumulator = 0;
  ui.render(state);
  canvas.focus({ preventScroll: true });
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

let lastTime = null;
let accumulator = 0;

function frame(now) {
  if (fatal) return;
  requestAnimationFrame(frame);
  try {
    const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_TIME);
    lastTime = now;

    if (!document.hidden && !state.won) {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < MAX_STEPS_PER_FRAME && !state.won) {
        fixedStep();
        accumulator -= STEP;
        steps += 1;
      }
      if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    } else {
      accumulator = 0;
    }

    rig.update(dt, player.position);
    renderer.render(scene, rig.camera);
  } catch (error) {
    fail(error);
  }
}

try {
  init();
  ui.hideLoading();
  requestAnimationFrame(frame);
} catch (error) {
  fail(error);
}
