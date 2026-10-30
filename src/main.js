import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import {
  clampDelta,
  createCollectionTracker,
  createFollowCamera,
  createInput,
  movementFromKeys,
} from './gameLogic.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const hud = $('hud');
const victory = $('victory');
const fallback = $('fallback');

function createRenderer() {
  try {
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    if (!renderer.getContext()) throw new Error('No WebGL context');
    return renderer;
  } catch (err) {
    console.error('WebGL unavailable:', err);
    return null;
  }
}

function start() {
  const renderer = createRenderer();
  if (!renderer) {
    fallback.hidden = false;
    return;
  }

  const SKY = new Color('#8fd3ff');
  const scene = new Scene();
  scene.background = SKY;
  scene.fog = new Fog(SKY, 60, 160);

  const hemi = new HemisphereLight('#ffffff', '#6a8f5a', 0.5);
  const sun = new DirectionalLight('#fff4d6', 0.8);
  sun.position.set(20, 40, 15);
  scene.add(hemi, sun);

  const camera = new PerspectiveCamera(60, 1, 0.1, 400);
  const follow = createFollowCamera(camera);

  const world = createWorld(scene);
  const player = createPlayer(scene, { spawn: world.spawn, solids: world.solids });
  const tracker = createCollectionTracker(world.collectibles);
  const input = createInput(window, document);

  // star counter
  const starsEl = $('stars');
  const countText = $('count-text');
  const starIcons = Array.from({ length: tracker.total }, () => {
    const s = document.createElement('span');
    s.className = 'star';
    s.textContent = '\u2605';
    starsEl.appendChild(s);
    return s;
  });
  hud.hidden = false;

  const baseY = new Map(world.collectibles.map((c) => [c.id, c.mesh.position.y]));

  function renderHud() {
    starIcons.forEach((el, i) => el.classList.toggle('on', i < tracker.count));
    countText.textContent = `${tracker.count} / ${tracker.total} stars`;
    victory.hidden = !tracker.complete;
  }

  function restart() {
    tracker.reset();
    player.reset();
    input.clear();
    follow.snap(player.position);
    renderHud();
    document.activeElement?.blur?.();
  }

  function resize() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  $('restart').addEventListener('click', restart);
  $('victory-restart').addEventListener('click', restart);

  const move = new Vector3();
  follow.snap(player.position);
  renderHud();

  let last = null;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = last === null ? 0 : clampDelta((now - last) / 1000);
    last = now;

    if (input.consumeRestart()) restart();

    movementFromKeys(input.keys, follow.forward, follow.right, move);
    player.update(dt, { move, jump: input.consumeJump() });

    if (player.position.y < world.killY) {
      player.reset();
      follow.snap(player.position);
    }

    if (tracker.update(player.position).length > 0) renderHud();

    const t = now / 1000;
    for (const item of world.collectibles) {
      if (tracker.isCollected(item.id)) continue;
      item.mesh.rotation.y = t * 2;
      item.mesh.position.y = (baseY.get(item.id) ?? item.mesh.position.y) + Math.sin(t * 3 + item.position.x) * 0.15;
    }

    follow.update(player.position, dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

start();
