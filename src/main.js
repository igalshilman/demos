import * as THREE from 'three';
import './style.css';
import { createInput } from './input.js';
import { createWorld } from './world/world.js';
import { createPlayer } from './player/player.js';
import { createFollowCamera } from './camera/follow-camera.js';
import { createCollectibles } from './collectibles/collectibles.js';
import { createGoal } from './goal/goal.js';
import { createHud } from './ui/hud.js';

export const MAX_DT = 0.05;
const SUN_OFFSET = new THREE.Vector3(24, 40, 16);

function addLights(scene) {
  const hemisphere = new THREE.HemisphereLight(0xdff2ff, 0x5b7a4a, 0.9);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/**
 * Builds the game on a scene and camera and returns `step(dt)`, which advances
 * one frame. Kept free of the renderer so it can run headless in tests.
 */
export function createGame({ scene, camera, domElement, hudRoot, input }) {
  const sun = addLights(scene);

  const world = createWorld(scene);
  const player = createPlayer(scene, world.spawn);
  const followCamera = createFollowCamera(camera, player, domElement);
  const collectibles = createCollectibles(scene, world);
  const goal = createGoal(scene, world);
  const hud = createHud(hudRoot);

  // The goal module draws the real goal ring; hide the world's placeholder.
  const placeholder = world.group && world.group.getObjectByName('goal');
  if (placeholder) placeholder.visible = false;

  const game = {
    scene,
    camera,
    world,
    player,
    followCamera,
    collectibles,
    goal,
    hud,
    sun,
    elapsed: 0,
    won: false,
    restart,
    step,
  };

  function syncHud() {
    hud.setCoins(collectibles.collected, collectibles.total);
    hud.setTime(game.elapsed);
  }

  function restart() {
    world.reset();
    player.reset(world.spawn);
    followCamera.reset();
    collectibles.reset();
    goal.reset();
    hud.reset();
    game.elapsed = 0;
    game.won = false;
    syncHud();
  }

  function step(rawDt) {
    const dt = Math.min(Math.max(Number(rawDt) || 0, 0), MAX_DT);

    if (input.state.restartPressed) restart();

    if (!game.won) game.elapsed += dt;

    world.update(dt);
    player.update(dt, input.state, followCamera.getYaw(), world);
    followCamera.update(dt);
    collectibles.update(dt, player.position);

    const complete = collectibles.isComplete();
    world.setGoalUnlocked(complete);
    goal.update(dt, player.position, complete);

    syncHud();

    if (goal.reached && !game.won) {
      game.won = true;
      hud.showWin(game.elapsed, collectibles.collected, collectibles.total);
    }

    sun.position.copy(player.position).add(SUN_OFFSET);
    sun.target.position.copy(player.position);

    input.endFrame();
  }

  hud.onRestart(restart);
  syncHud();

  return game;
}

export function handleResize(camera, renderer, width, height, pixelRatio = 1) {
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.setSize(width, height);
}

function start() {
  const container = document.getElementById('app');
  const hudRoot = document.getElementById('hud');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecbff);
  scene.fog = new THREE.Fog(0x8ecbff, 60, 180);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  camera.position.set(0, 6, 12);

  const input = createInput(window);
  const game = createGame({
    scene,
    camera,
    domElement: renderer.domElement,
    hudRoot,
    input,
  });

  const onResize = () =>
    handleResize(camera, renderer, window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
  window.addEventListener('resize', onResize);
  onResize();

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    game.step(clock.getDelta());
    renderer.render(scene, camera);
  }
  frame();

  window.__orbRunner = game;
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  start();
}
