import * as THREE from "three";
import { createWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { createGameState, bodyCenter, isTouching } from "./game-state.js";

const MAX_DT = 0.05;
const CAMERA_OFFSET = new THREE.Vector3(-9, 6, 0);
const CAMERA_LOOK_HEIGHT = 1.2;
const CAMERA_FOLLOW_RATE = 6;

const MOVE_KEYS = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
};
const GAMEPLAY_KEYS = new Set([...Object.keys(MOVE_KEYS), "Space", "KeyR"]);

const $ = (id) => document.getElementById(id);

function showError(text) {
  const el = $("error");
  el.textContent = text;
  el.hidden = false;
}

function createRenderer(container) {
  const canvas = document.createElement("canvas");
  const gl =
    canvas.getContext("webgl2") ||
    canvas.getContext("webgl") ||
    canvas.getContext("experimental-webgl");
  if (!gl) throw new Error("WebGL is not available");
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  container.appendChild(renderer.domElement);
  return renderer;
}

function start() {
  const container = $("app");
  let renderer;
  try {
    renderer = createRenderer(container);
  } catch (err) {
    console.error(err);
    showError(
      "This prototype needs WebGL, which is unavailable in this browser. " +
        "Try a current desktop browser with hardware acceleration enabled."
    );
    return () => {};
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4f5);
  scene.fog = new THREE.Fog(0x9fd4f5, 40, 120);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b8f5e, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.0);
  sun.position.set(12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 80;
  scene.add(sun, sun.target);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

  let world;
  let player;
  try {
    world = createWorld();
    player = createPlayer({ colliders: world.colliders, spawn: world.spawn });
  } catch (err) {
    console.error(err);
    showError("Could not build the game world: " + err.message);
    world?.dispose?.();
    renderer.dispose();
    renderer.domElement.remove();
    return () => {};
  }
  scene.add(world.group, player.group);
  world.group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  player.group.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });

  const state = createGameState(world.collectibles.map((c) => c.id));
  const progressEl = $("progress-count");
  const messageEl = $("message");
  const winEl = $("win");
  const pausedEl = $("paused");

  const focus = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  const keys = { forward: false, back: false, left: false, right: false };
  let jumpHeld = false;
  let jumpLatched = false;
  let paused = false;
  let running = true;
  let rafId = 0;
  let lastTime = null;
  let message = "";
  let messageTime = 0;

  function setMessage(text, seconds) {
    messageTime = seconds;
    if (text === message) return;
    message = text;
    messageEl.textContent = text;
    messageEl.hidden = !text;
  }

  function updateHud() {
    progressEl.textContent = `${state.collectedCount} / ${state.total}`;
    winEl.hidden = !state.won;
  }

  function clearInput() {
    keys.forward = keys.back = keys.left = keys.right = false;
    jumpHeld = false;
    jumpLatched = false;
  }

  function snapCamera() {
    focus.set(player.position.x, player.position.y, player.position.z);
    placeCamera();
  }

  function placeCamera() {
    camera.position.copy(focus).add(CAMERA_OFFSET);
    lookTarget.copy(focus);
    lookTarget.y += CAMERA_LOOK_HEIGHT;
    camera.lookAt(lookTarget);
    sun.target.position.copy(focus);
    sun.position.copy(focus).add(new THREE.Vector3(12, 24, 10));
  }

  function restart() {
    state.restart();
    for (const c of world.collectibles) c.mesh.visible = true;
    player.reset();
    clearInput();
    setMessage("", 0);
    snapCamera();
    updateHud();
  }

  function readMove() {
    const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    const r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (f === 0 && r === 0) return { moveX: 0, moveZ: 0 };
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
    fwd.normalize();
    let x = fwd.x * f - fwd.z * r;
    let z = fwd.z * f + fwd.x * r;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { moveX: x, moveZ: z };
  }

  function step(dt) {
    if (!state.won) {
      const { moveX, moveZ } = readMove();
      const jumpPressed = jumpLatched;
      jumpLatched = false;
      player.update(dt, { moveX, moveZ, jumpPressed });

      if (player.position.y < world.respawnY) {
        state.fall();
        player.reset();
        snapCamera();
        setMessage("Oops! Back to the start. Your gems are kept.", 1.8);
      }

      const center = bodyCenter(player.position);
      for (const c of world.collectibles) {
        if (state.has(c.id) || !isTouching(center, c)) continue;
        if (state.collect(c.id)) {
          c.mesh.visible = false;
          updateHud();
          setMessage(
            state.allCollected ? "All gems collected! Head to the goal." : "Gem collected!",
            1.5
          );
        }
      }

      if (isTouching(center, world.goal)) {
        if (state.reachGoal()) {
          clearInput();
          setMessage("", 0);
          updateHud();
        } else {
          setMessage(`Collect all gems first (${state.remaining} left).`, 0.25);
        }
      }
    }

    if (messageTime > 0) {
      messageTime -= dt;
      if (messageTime <= 0) setMessage("", 0);
    }

    const k = 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt);
    focus.lerp(player.position, k);
    placeCamera();
  }

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    if (paused) return;
    const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;
    step(dt);
    renderer.render(scene, camera);
  }

  function resize() {
    const w = Math.max(window.innerWidth, 1);
    const h = Math.max(window.innerHeight, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setPaused(value) {
    if (paused === value) return;
    paused = value;
    pausedEl.hidden = !value;
    lastTime = null;
    if (value) clearInput();
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!GAMEPLAY_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.code === "KeyR") {
      if (!e.repeat) restart();
      return;
    }
    if (e.code === "Space") {
      if (!jumpHeld) jumpLatched = true;
      jumpHeld = true;
      return;
    }
    keys[MOVE_KEYS[e.code]] = true;
  }

  function onKeyUp(e) {
    if (!GAMEPLAY_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.code === "Space") {
      jumpHeld = false;
      return;
    }
    const dir = MOVE_KEYS[e.code];
    if (dir) keys[dir] = false;
  }

  function onVisibility() {
    setPaused(document.hidden);
  }

  function onContextLost(e) {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(rafId);
    showError("The graphics context was lost. Reload the page to continue.");
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearInput);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", onVisibility);
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);

  resize();
  updateHud();
  snapCamera();
  paused = document.hidden;
  pausedEl.hidden = !paused;
  rafId = requestAnimationFrame(frame);

  return function dispose() {
    running = false;
    cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", clearInput);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", onVisibility);
    renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
    scene.remove(world.group, player.group);
    player.dispose();
    world.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}

const dispose = start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => dispose());
}
