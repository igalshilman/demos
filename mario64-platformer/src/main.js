import * as THREE from "three";
import { createLevel } from "./level.js";
import {
  PLAYER_HEIGHT,
  createPlayer,
  resetPlayer,
  stepPlayer,
} from "./player-controller.js";
import {
  collectCrystal,
  counterText,
  createGameState,
  hintText,
  isCollected,
  reachGoal,
  resetGameState,
} from "./game-state.js";

const FIXED_STEP = 1 / 60;
const MAX_FRAME_TIME = 0.1;
const CAMERA_DISTANCE = 11;
const CAMERA_HEIGHT = 6.5;
const CAMERA_ORBIT_SPEED = 1.8;
const CAMERA_FOLLOW_RATE = 6;
const GOAL_HINT_DISTANCE_EXTRA = 3;

const canvas = document.getElementById("game");
const counterEl = document.getElementById("crystal-counter");
const hintEl = document.getElementById("hint");
const winBanner = document.getElementById("win-banner");
const errorBanner = document.getElementById("error-banner");
const errorMessage = document.getElementById("error-message");

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function showError(message) {
  errorMessage.textContent = message;
  errorBanner.hidden = false;
  document.getElementById("hud").hidden = true;
  document.getElementById("controls-help").hidden = true;
}

function createRenderer() {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    return renderer;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function buildPlayerMesh() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3f7de0, roughness: 0.6 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x20243a, roughness: 0.7 });

  const bodyHeight = PLAYER_HEIGHT * 0.5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, bodyHeight, 16), bodyMaterial);
  body.position.y = bodyHeight / 2;
  group.add(body);

  const headRadius = PLAYER_HEIGHT * 0.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 20, 14), accentMaterial);
  head.position.y = bodyHeight + headRadius * 0.9;
  group.add(head);

  const cap = new THREE.Mesh(
    new THREE.ConeGeometry(headRadius * 0.9, headRadius * 1.1, 16),
    bodyMaterial,
  );
  cap.position.y = head.position.y + headRadius * 0.95;
  group.add(cap);

  // Eyes and nose mark the front (+z in local space) so facing is readable.
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.14, 8, 8), darkMaterial);
    eye.position.set(side * headRadius * 0.38, head.position.y + headRadius * 0.15, headRadius * 0.88);
    group.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 0.16, 8, 8), bodyMaterial);
  nose.position.set(0, head.position.y - headRadius * 0.1, headRadius * 0.98);
  group.add(nose);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return group;
}

function setupScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 60, 160);

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5b45, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(20, 40, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -40;
  cam.right = 40;
  cam.top = 40;
  cam.bottom = -40;
  cam.near = 1;
  cam.far = 120;
  scene.add(sun);
  return scene;
}

function start() {
  const renderer = createRenderer();
  if (!renderer) {
    showError(
      "Your browser could not start WebGL, which this game needs. Try enabling hardware acceleration, updating your browser, or using a different one.",
    );
    return;
  }

  const scene = setupScene();
  const level = createLevel();
  scene.add(level.group);
  level.group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const player = createPlayer(level.spawn);
  const playerMesh = buildPlayerMesh();
  scene.add(playerMesh);

  const state = createGameState(level.collectibles.map((c) => c.id));

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  let cameraYaw = 0;
  const cameraTarget = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  let facing = 0;

  const keys = new Set();
  let jumpQueued = false;
  let lastNearGoal = false;

  const GAME_KEYS = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyQ", "KeyE", "Space", "KeyR",
  ]);

  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!GAME_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (event.code === "KeyR") {
      restart();
      return;
    }
    if (event.code === "Space") jumpQueued = true;
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
  window.addEventListener("blur", () => {
    keys.clear();
    jumpQueued = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keys.clear();
      jumpQueued = false;
    }
  });

  function syncPlayerMesh() {
    playerMesh.position.set(player.position.x, player.position.y, player.position.z);
    playerMesh.rotation.y = facing;
  }

  function snapCamera() {
    cameraTarget.set(player.position.x, player.position.y + PLAYER_HEIGHT * 0.5, player.position.z);
    cameraPosition.set(
      cameraTarget.x + Math.sin(cameraYaw) * CAMERA_DISTANCE,
      cameraTarget.y + CAMERA_HEIGHT,
      cameraTarget.z + Math.cos(cameraYaw) * CAMERA_DISTANCE,
    );
    camera.position.copy(cameraPosition);
    camera.lookAt(cameraTarget);
  }

  function refreshHud(nearGoal = false) {
    counterEl.textContent = counterText(state);
    hintEl.textContent = hintText(state, { nearGoal });
    winBanner.hidden = !state.won;
  }

  function restart() {
    resetGameState(state);
    for (const crystal of level.collectibles) crystal.mesh.visible = true;
    resetPlayer(player, level.spawn);
    keys.clear();
    jumpQueued = false;
    cameraYaw = 0;
    facing = 0;
    lastNearGoal = false;
    syncPlayerMesh();
    snapCamera();
    refreshHud();
  }

  function movementInput() {
    let x = 0;
    let y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y -= 1;
    const length = Math.hypot(x, y);
    if (length === 0) return { moveX: 0, moveZ: 0 };
    x /= length;
    y /= length;
    // Camera sits at +yaw offset looking at the player: forward is away from the camera.
    const forwardX = -Math.sin(cameraYaw);
    const forwardZ = -Math.cos(cameraYaw);
    const rightX = Math.cos(cameraYaw);
    const rightZ = -Math.sin(cameraYaw);
    return {
      moveX: rightX * x + forwardX * y,
      moveZ: rightZ * x + forwardZ * y,
    };
  }

  function playerCenter() {
    return new THREE.Vector3(
      player.position.x,
      player.position.y + PLAYER_HEIGHT * 0.5,
      player.position.z,
    );
  }

  function updateGame(dt) {
    const { moveX, moveZ } = movementInput();
    stepPlayer(player, { moveX, moveZ, jump: jumpQueued }, dt, level.solids);
    jumpQueued = false;

    if (moveX !== 0 || moveZ !== 0) {
      const target = Math.atan2(moveX, moveZ);
      let delta = target - facing;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      facing += delta * Math.min(1, dt * 14);
    }

    if (player.position.y < level.fallY) {
      resetPlayer(player, level.spawn);
    }

    const center = playerCenter();
    let changed = false;
    for (const crystal of level.collectibles) {
      if (isCollected(state, crystal.id)) continue;
      if (distance(center, crystal.position) <= crystal.radius) {
        if (collectCrystal(state, crystal.id)) {
          crystal.mesh.visible = false;
          changed = true;
        }
      }
    }

    const goalDistance = distance(center, level.goal.position);
    const atGoal = goalDistance <= level.goal.radius;
    if (atGoal && reachGoal(state)) changed = true;

    const nearGoal = goalDistance <= level.goal.radius + GOAL_HINT_DISTANCE_EXTRA;
    if (changed || nearGoal !== lastNearGoal) {
      lastNearGoal = nearGoal;
      refreshHud(nearGoal);
    }
  }

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  restart();
  canvas.focus();

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME_TIME);
    last = now;

    if (!state.won) {
      let orbit = 0;
      if (keys.has("KeyQ")) orbit -= 1;
      if (keys.has("KeyE")) orbit += 1;
      cameraYaw += orbit * CAMERA_ORBIT_SPEED * dt;

      accumulator += dt;
      while (accumulator >= FIXED_STEP) {
        updateGame(FIXED_STEP);
        accumulator -= FIXED_STEP;
        if (state.won) break;
      }
    } else {
      accumulator = 0;
    }

    syncPlayerMesh();

    const time = now / 1000;
    for (const crystal of level.collectibles) {
      if (crystal.mesh.visible) crystal.mesh.rotation.y = time * 2;
    }

    cameraTarget.lerp(
      new THREE.Vector3(player.position.x, player.position.y + PLAYER_HEIGHT * 0.5, player.position.z),
      1 - Math.exp(-CAMERA_FOLLOW_RATE * dt),
    );
    const desired = new THREE.Vector3(
      cameraTarget.x + Math.sin(cameraYaw) * CAMERA_DISTANCE,
      cameraTarget.y + CAMERA_HEIGHT,
      cameraTarget.z + Math.cos(cameraYaw) * CAMERA_DISTANCE,
    );
    camera.position.lerp(desired, 1 - Math.exp(-CAMERA_FOLLOW_RATE * dt));
    camera.lookAt(cameraTarget);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

try {
  start();
} catch (error) {
  console.error(error);
  showError("Something went wrong while starting the game. Check the browser console for details.");
}
