import * as THREE from 'three';
import './style.css';
import { createInput } from './input.js';
import { createWorld } from './world/world.js';
import { createPlayer } from './player/player.js';
import { createFollowCamera } from './camera/follow-camera.js';
import { createCollectibles } from './collectibles/collectibles.js';
import { createGoal } from './goal/goal.js';
import { createHud } from './ui/hud.js';

const MAX_DT = 0.05;

const container = document.getElementById('app');
const hudRoot = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ecbff);
scene.fog = new THREE.Fog(0x8ecbff, 60, 180);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 6, 12);

const hemisphere = new THREE.HemisphereLight(0xdff2ff, 0x5b7a4a, 0.9);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.4);
const SUN_OFFSET = new THREE.Vector3(24, 40, 16);
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

const world = createWorld(scene);
const player = createPlayer(scene, world.spawn);
const followCamera = createFollowCamera(camera, player, renderer.domElement);
const collectibles = createCollectibles(scene, world);
const goal = createGoal(scene, world);
const hud = createHud(hudRoot);

const input = createInput(window);

let elapsed = 0;
let won = false;

function restart() {
  world.reset();
  player.reset(world.spawn);
  followCamera.reset();
  collectibles.reset();
  goal.reset();
  hud.reset();
  elapsed = 0;
  won = false;
  hud.setCoins(collectibles.collected, collectibles.total);
  hud.setTime(elapsed);
}

hud.onRestart(restart);
hud.setCoins(collectibles.collected, collectibles.total);
hud.setTime(elapsed);

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), MAX_DT);

  if (input.state.restartPressed) restart();

  if (!won) elapsed += dt;

  world.update(dt);
  player.update(dt, input.state, followCamera.getYaw(), world);
  followCamera.update(dt);
  collectibles.update(dt, player.position);
  goal.update(dt, player.position, collectibles.isComplete);

  hud.setCoins(collectibles.collected, collectibles.total);
  hud.setTime(elapsed);

  if (goal.reached && !won) {
    won = true;
    hud.showWin(elapsed, collectibles.collected, collectibles.total);
  }

  sun.position.copy(player.position).add(SUN_OFFSET);
  sun.target.position.copy(player.position);

  input.endFrame();
  renderer.render(scene, camera);
}

frame();
