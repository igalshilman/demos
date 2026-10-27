import './styles.css';
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
import { createCameraRig } from './camera';
import { FIXED_DT, createFixedStepper } from './contracts';
import type { WorldData } from './contracts';
import { createGame } from './game';
import { createHud } from './hud';
import { createInput } from './input';
import { createPlayer } from './player';
import { createWorld } from './world';

const SKY = 0x8fd0f5;
const MAX_PIXEL_RATIO = 2;
const WEBGL_MESSAGE =
  "WebGL isn't available, so the 3D prototype can't start. Use a recent desktop Chrome, Edge, Firefox or Safari with hardware acceleration enabled, then reload.";
const GENERIC_MESSAGE = 'Something went wrong while starting the prototype. Please reload the page.';

/** Read-only-ish snapshot used by the browser tests; also handy in the console. */
export interface PrototypeSnapshot {
  position: [number, number, number];
  velocity: [number, number, number];
  grounded: boolean;
  status: 'playing' | 'won';
  collected: string[];
  totalCoins: number;
  deaths: number;
  elapsed: number;
  yaw: number;
  canvas: { width: number; height: number; clientWidth: number; clientHeight: number };
  pixelRatio: number;
}

export interface PrototypeDebug {
  snapshot(): PrototypeSnapshot;
  /** Run `count` fixed simulation steps right now (used for deterministic tests). */
  step(count: number): void;
  teleport(x: number, y: number, z: number): void;
  restart(): void;
  world: WorldData;
}

declare global {
  interface Window {
    __PROTOTYPE__?: PrototypeDebug;
  }
}

export interface App {
  dispose(): void;
}

function showFatal(root: HTMLElement, message: string): void {
  const fatal = root.querySelector<HTMLElement>('#fatal');
  if (!fatal) return;
  fatal.textContent = message;
  fatal.hidden = false;
}

export function startApp(root: HTMLElement): App | null {
  const viewport = root.querySelector<HTMLElement>('#viewport');
  const hudContainer = root.querySelector<HTMLElement>('#hud');
  if (!viewport || !hudContainer) throw new Error('Missing #viewport or #hud container');

  const disposers: Array<() => void> = [];
  const disposeAll = (): void => {
    while (disposers.length) {
      try {
        disposers.pop()!();
      } catch (error) {
        console.error(error);
      }
    }
  };

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch (error) {
    console.warn('WebGL unavailable', error);
    showFatal(root, WEBGL_MESSAGE);
    return null;
  }
  disposers.push(() => {
    renderer.dispose();
    renderer.domElement.remove();
  });

  try {
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D game view. Move with WASD or arrow keys, jump with Space.');
    viewport.appendChild(canvas);

    const scene = new Scene();
    scene.background = new Color(SKY);
    scene.fog = new Fog(SKY, 70, 220);
    scene.add(new HemisphereLight(0xdff2ff, 0x4f6b3a, 1.6));
    const sun = new DirectionalLight(0xfff1d0, 2.4);
    sun.position.set(30, 50, 20);
    scene.add(sun);

    const camera = new PerspectiveCamera(60, 1, 0.1, 500);

    const world = createWorld();
    disposers.push(() => world.dispose());
    scene.add(world.group);

    const player = createPlayer(world.data.spawn.clone());
    disposers.push(() => player.dispose());
    scene.add(player.group);

    const cameraRig = createCameraRig(camera);
    const game = createGame(world.data);

    const stepper = createFixedStepper();

    const restart = (): void => {
      game.reset();
      player.reset(world.data.spawn);
      input.reset();
      stepper.reset();
      cameraRig.reset(player.position, 0);
      lastCollectedKey = null;
      sync(true);
      canvas.focus({ preventScroll: true });
    };

    const input = createInput({ onRestart: restart });
    disposers.push(() => input.dispose());

    const hud = createHud(hudContainer, restart);
    disposers.push(() => hud.dispose());

    let lastCollectedKey: string | null = null;
    let lastHudKey: string | null = null;
    const totalCoins = world.data.coins.length;

    /** Push game state into the world's coin visibility and the HUD when it changed. */
    function sync(force = false): void {
      const state = game.state;
      const collectedKey = [...state.collected].sort().join(',');
      if (force || collectedKey !== lastCollectedKey) {
        world.setCollected(state.collected);
        lastCollectedKey = collectedKey;
      }
      const hudKey = `${state.status}|${state.deaths}|${collectedKey}|${Math.floor(state.elapsed * 10)}`;
      if (force || hudKey !== lastHudKey) {
        hud.update(state, totalCoins);
        lastHudKey = hudKey;
      }
    }

    function fixedStep(): void {
      const frame = input.consume(FIXED_DT);
      if (game.state.status === 'playing') {
        player.update(FIXED_DT, frame, world.data.solids);
        const { respawn } = game.tick(FIXED_DT, player.position);
        if (respawn) {
          player.reset(world.data.spawn);
          cameraRig.reset(player.position, frame.cameraYaw);
        }
      }
      cameraRig.update(FIXED_DT, player.position, frame.cameraYaw);
    }

    const pixelRatio = (): number => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

    function resize(): void {
      const width = Math.max(1, Math.floor(viewport!.clientWidth));
      const height = Math.max(1, Math.floor(viewport!.clientHeight));
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }

    let frameId = 0;
    let lastTime: number | null = null;
    let running = false;

    function frame(now: number): void {
      frameId = requestAnimationFrame(frame);
      const seconds = lastTime === null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      stepper.advance(seconds, fixedStep);
      sync();
      renderer.render(scene, camera);
    }

    function startLoop(): void {
      if (running) return;
      running = true;
      lastTime = null;
      stepper.reset();
      frameId = requestAnimationFrame(frame);
    }

    function stopLoop(): void {
      running = false;
      cancelAnimationFrame(frameId);
    }

    const onVisibility = (): void => {
      if (document.hidden) {
        stopLoop();
        input.clearHeld();
      } else {
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    disposers.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const onContextLost = (event: Event): void => {
      event.preventDefault();
      stopLoop();
      showFatal(root, WEBGL_MESSAGE);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    window.addEventListener('resize', resize);
    disposers.push(() => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
    });

    const onViewportPointerDown = (): void => canvas.focus({ preventScroll: true });
    viewport.addEventListener('pointerdown', onViewportPointerDown);
    disposers.push(() => viewport.removeEventListener('pointerdown', onViewportPointerDown));

    disposers.push(() => {
      stopLoop();
      delete window.__PROTOTYPE__;
    });

    window.__PROTOTYPE__ = {
      world: world.data,
      restart,
      step(count) {
        for (let i = 0; i < count; i++) fixedStep();
        sync();
        renderer.render(scene, camera);
      },
      teleport(x, y, z) {
        player.position.set(x, y, z);
        player.velocity.set(0, 0, 0);
        player.group.position.copy(player.position);
      },
      snapshot() {
        const p: Vector3 = player.position;
        const v: Vector3 = player.velocity;
        return {
          position: [p.x, p.y, p.z],
          velocity: [v.x, v.y, v.z],
          grounded: player.grounded,
          status: game.state.status,
          collected: [...game.state.collected],
          totalCoins,
          deaths: game.state.deaths,
          elapsed: game.state.elapsed,
          yaw: input.yaw,
          canvas: {
            width: canvas.width,
            height: canvas.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
          },
          pixelRatio: renderer.getPixelRatio(),
        };
      },
    };

    cameraRig.reset(player.position, 0);
    resize();
    sync(true);
    canvas.focus({ preventScroll: true });
    if (!document.hidden) startLoop();

    return {
      dispose() {
        disposeAll();
      },
    };
  } catch (error) {
    console.error(error);
    disposeAll();
    showFatal(root, GENERIC_MESSAGE);
    return null;
  }
}

const root = document.getElementById('app');
if (root) {
  const app = startApp(root);
  if (app && import.meta.hot) import.meta.hot.dispose(() => app.dispose());
}
