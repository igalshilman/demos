import type { Box3, Group, Vector3 } from 'three';

/**
 * Shared contracts between the application shell and the independently owned
 * modules (world, player, camera, game, hud).
 *
 * Conventions
 * - Right-handed, Y up. World "forward" at yaw 0 is -Z.
 * - Positive yaw rotates counter-clockwise seen from above (Three.js Y rotation),
 *   so a camera yaw of +90deg looks toward -X. The camera looks along
 *   (-sin(yaw), 0, -cos(yaw)).
 * - InputFrame.moveZ is positive forward, moveX is positive to the right, both
 *   relative to cameraYaw. The input layer does NOT normalise diagonals; the
 *   player must (|move| is at most sqrt(2) on diagonals).
 * - Player position is the position of the feet. The collision body is a
 *   vertical capsule-like volume of PLAYER_RADIUS x PLAYER_HEIGHT above the feet.
 */

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.5;

/** Fixed simulation step in seconds. */
export const FIXED_DT = 1 / 60;
/** The accumulator never holds more than this many seconds of simulation. */
export const MAX_ACCUMULATED = 0.25;

export interface InputFrame {
  /** -1 (left) .. 1 (right). */
  moveX: number;
  /** -1 (back) .. 1 (forward). */
  moveZ: number;
  /** True for exactly one fixed step per key press (latched until consumed). */
  jumpPressed: boolean;
  sprint: boolean;
  /** Camera yaw in radians; 0 looks toward world -Z. */
  cameraYaw: number;
}

export interface WorldCoin {
  id: string;
  position: Vector3;
}

export interface WorldData {
  solids: Box3[];
  spawn: Vector3;
  /** Falling below this height means the player died. */
  killY: number;
  coins: WorldCoin[];
  goal: Box3;
}

export interface WorldHandle {
  group: Group;
  data: WorldData;
  /** Hide the coins whose ids are in the set, show all the others. */
  setCollected(ids: ReadonlySet<string>): void;
  dispose(): void;
}

export interface PlayerHandle {
  group: Group;
  /** Feet position. */
  position: Vector3;
  velocity: Vector3;
  grounded: boolean;
  update(dt: number, input: InputFrame, solids: readonly Box3[]): void;
  reset(spawn: Vector3): void;
  dispose(): void;
}

export interface CameraRig {
  update(dt: number, position: Vector3, yaw: number): void;
  reset(position: Vector3, yaw: number): void;
}

export interface GameState {
  status: 'playing' | 'won';
  collected: Set<string>;
  deaths: number;
  elapsed: number;
}

export interface GameHandle {
  state: GameState;
  tick(dt: number, position: Vector3): { respawn: boolean };
  reset(): void;
}

export interface HudHandle {
  update(state: GameState, totalCoins: number): void;
  dispose(): void;
}

export interface FixedStepper {
  /**
   * Feed a rendered frame's duration (seconds); calls `step` once per whole
   * fixed step now owed and returns how many ran. Frames longer than the cap
   * are clamped so a stall never causes a spiral of catch-up steps.
   */
  advance(frameSeconds: number, step: () => void): number;
  /** Drop any accumulated time (used on resume and restart). */
  reset(): void;
}

export function createFixedStepper(
  dt: number = FIXED_DT,
  maxAccumulated: number = MAX_ACCUMULATED,
): FixedStepper {
  let accumulator = 0;
  return {
    advance(frameSeconds, step) {
      if (!Number.isFinite(frameSeconds) || frameSeconds < 0) frameSeconds = 0;
      accumulator = Math.min(accumulator + frameSeconds, maxAccumulated);
      let steps = 0;
      // The epsilon keeps 60 x (1/60 s) frames from losing a step to rounding.
      while (accumulator >= dt - 1e-9) {
        accumulator -= dt;
        step();
        steps++;
      }
      if (accumulator < 0) accumulator = 0;
      return steps;
    },
    reset() {
      accumulator = 0;
    },
  };
}
