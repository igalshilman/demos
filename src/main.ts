import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { GameSession, type PlayerInput } from './game-session';
import { createLevel } from './level';
import { createPlayer } from './player';
import './styles.css';

const MAX_DT = 1 / 20;

const container = document.getElementById('app') as HTMLElement;
const countEl = document.getElementById('hud-count') as HTMLElement;
const goalEl = document.getElementById('hud-goal') as HTMLElement;
const winOverlay = document.getElementById('win-overlay') as HTMLElement;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x8fc6ea);
scene.fog = new Fog(0x8fc6ea, 40, 120);
scene.add(new AmbientLight(0xffffff, 0.7));
const sun = new DirectionalLight(0xffffff, 1.4);
sun.position.set(10, 20, 8);
scene.add(sun);

const camera = new PerspectiveCamera(60, 1, 0.1, 300);

const level = createLevel();
const player = createPlayer(level.spawn.clone());
scene.add(level.root);
scene.add(player.root);

const session = new GameSession(player, level);

function resize(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const held = new Set<string>();
let jumpQueued = false;
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
  'Space', 'KeyR',
]);

function restart(): void {
  session.restart();
  held.clear();
  jumpQueued = false;
  player.updateCamera(camera, 1);
  refreshHud();
}

window.addEventListener('keydown', (event) => {
  if (!GAME_KEYS.has(event.code)) return;
  event.preventDefault();
  if (event.code === 'KeyR') {
    if (!event.repeat) restart();
    return;
  }
  if (event.code === 'Space') {
    if (!event.repeat) jumpQueued = true;
    return;
  }
  held.add(event.code);
});
window.addEventListener('keyup', (event) => {
  held.delete(event.code);
});
window.addEventListener('blur', () => {
  held.clear();
  jumpQueued = false;
});

for (const id of ['restart-button', 'win-restart-button']) {
  document.getElementById(id)?.addEventListener('click', (event) => {
    restart();
    (event.currentTarget as HTMLElement).blur();
  });
}

function readInput(): PlayerInput {
  let moveX = 0;
  let moveZ = 0;
  if (held.has('KeyA') || held.has('ArrowLeft')) moveX -= 1;
  if (held.has('KeyD') || held.has('ArrowRight')) moveX += 1;
  if (held.has('KeyW') || held.has('ArrowUp')) moveZ -= 1;
  if (held.has('KeyS') || held.has('ArrowDown')) moveZ += 1;
  const length = Math.hypot(moveX, moveZ);
  if (length > 0) {
    moveX /= length;
    moveZ /= length;
  }
  const jumpPressed = jumpQueued;
  jumpQueued = false;
  return { moveX, moveZ, jumpPressed };
}

let lastCount = -1;
let lastTotal = -1;
let lastUnlocked: boolean | null = null;
let lastWon: boolean | null = null;

function refreshHud(): void {
  const { collected, total, goalUnlocked, status } = session.snapshot;
  if (collected !== lastCount || total !== lastTotal) {
    countEl.textContent = `Gems ${collected} / ${total}`;
    lastCount = collected;
    lastTotal = total;
  }
  if (goalUnlocked !== lastUnlocked) {
    goalEl.textContent = goalUnlocked ? 'Goal unlocked: reach it!' : 'Goal locked: collect all gems';
    goalEl.classList.toggle('unlocked', goalUnlocked);
    lastUnlocked = goalUnlocked;
  }
  const won = status === 'won';
  if (won !== lastWon) {
    winOverlay.hidden = !won;
    lastWon = won;
  }
}

let lastTime = performance.now();
let running = true;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0), MAX_DT);
  lastTime = now;
  if (running) {
    if (session.update(dt, readInput())) {
      player.updateCamera(camera, dt);
    }
    refreshHud();
  }
  renderer.render(scene, camera);
}

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  lastTime = performance.now();
  if (!running) {
    held.clear();
    jumpQueued = false;
  }
});

restart();
requestAnimationFrame((now) => {
  lastTime = now;
  frame(now);
});
