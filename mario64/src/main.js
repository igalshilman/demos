import * as THREE from 'three';
import './style.css';
import { createLevel } from './level.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './follow-camera.js';
import { createInput } from './input.js';
import { createGame } from './game.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const victoryEl = document.getElementById('victory');

const STATUS_TEXT = {
  playing: 'Reach the goal!',
  respawned: 'You fell! Back to the start.',
  won: 'Goal reached! Press R to restart.',
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 200);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.1));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(20, 40, 15);
scene.add(sun);

const level = createLevel(scene);
const player = createPlayer({ scene, spawn: level.spawn, colliders: level.colliders });
const followCamera = createFollowCamera(camera);

let statusTimer = 0;
function setStatus(state) {
  statusEl.textContent = STATUS_TEXT[state] ?? STATUS_TEXT.playing;
  statusEl.dataset.state = state;
  victoryEl.hidden = state !== 'won';
  clearTimeout(statusTimer);
  if (state === 'respawned') {
    statusTimer = setTimeout(() => setStatus('playing'), 2500);
  }
}

const game = createGame({ player, followCamera, level, onStatus: setStatus });
const input = createInput(window, { onRestart: () => game.reset() });

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const forward = new THREE.Vector3();
function getCameraForward() {
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  return forward.normalize();
}

game.reset();
canvas.focus();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  game.update(clock.getDelta(), input.state, getCameraForward());
  renderer.render(scene, camera);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    renderer.setAnimationLoop(null);
    input.dispose();
    window.removeEventListener('resize', resize);
    renderer.dispose();
  });
}
