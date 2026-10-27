import {
  Box3,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from 'three';

export interface PlayerInput {
  /** Positive is right (+X). */
  moveX: number;
  /** Negative is forward (-Z). */
  moveZ: number;
  /** True on the frame the jump key goes down; only a rising edge triggers a jump. */
  jumpPressed: boolean;
}

export interface Player {
  /** Add to an untransformed scene; root.position is the world-space position of the feet. */
  root: Group;
  reset(spawn: Vector3): void;
  update(dt: number, input: PlayerInput, colliders: readonly Box3[]): void;
  updateCamera(camera: PerspectiveCamera, dt: number): void;
}

export const PLAYER_HALF_WIDTH = 0.35;
export const PLAYER_HEIGHT = 1.6;
export const MOVE_SPEED = 5;
export const JUMP_VELOCITY = 8;
export const GRAVITY = 20;

const MAX_FALL_SPEED = 40;
const MAX_FRAME_DT = 0.1;
const MAX_STEP_DISTANCE = 0.1;
const MAX_SUBSTEPS = 100;
const OVERLAP_EPSILON = 1e-6;

const CAMERA_OFFSET = new Vector3(0, 4.5, 8);
const CAMERA_FOCUS_HEIGHT = 1.2;
const CAMERA_SMOOTHING = 6;

function buildCharacter(): Group {
  const body = new Group();
  const mat = (color: number) => new MeshStandardMaterial({ color: new Color(color), roughness: 0.7 });
  const part = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const mesh = new Mesh(new BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    body.add(mesh);
    return mesh;
  };

  part(0.2, 0.5, 0.25, 0x2f4b7c, -0.13, 0.25, 0);
  part(0.2, 0.5, 0.25, 0x2f4b7c, 0.13, 0.25, 0);
  part(0.46, 0.6, 0.36, 0xf28f3b, 0, 0.8, 0);
  part(0.12, 0.5, 0.2, 0xf6c177, -0.29, 0.85, 0);
  part(0.12, 0.5, 0.2, 0xf6c177, 0.29, 0.85, 0);
  part(0.4, 0.45, 0.14, 0x6a4c93, 0, 0.85, 0.25);

  const head = new Mesh(new SphereGeometry(0.25, 16, 12), mat(0xf6c177));
  head.position.set(0, 1.35, 0);
  body.add(head);
  const eyeMat = mat(0x1b1b1b);
  for (const x of [-0.09, 0.09]) {
    const eye = new Mesh(new SphereGeometry(0.04, 8, 6), eyeMat);
    eye.position.set(x, 1.4, -0.22);
    body.add(eye);
  }
  return body;
}

function overlaps(min: Vector3, max: Vector3, box: Box3): boolean {
  return (
    min.x < box.max.x - OVERLAP_EPSILON && max.x > box.min.x + OVERLAP_EPSILON &&
    min.y < box.max.y - OVERLAP_EPSILON && max.y > box.min.y + OVERLAP_EPSILON &&
    min.z < box.max.z - OVERLAP_EPSILON && max.z > box.min.z + OVERLAP_EPSILON
  );
}

export function createPlayer(spawn: Vector3): Player {
  const root = new Group();
  root.name = 'player';
  const model = buildCharacter();
  root.add(model);

  const position = root.position;
  const velocity = new Vector3();
  const min = new Vector3();
  const max = new Vector3();
  const focus = new Vector3();
  let grounded = false;
  let jumpHeld = false;
  let cameraSnap = true;
  let targetYaw = 0;

  const updateBounds = () => {
    min.set(position.x - PLAYER_HALF_WIDTH, position.y, position.z - PLAYER_HALF_WIDTH);
    max.set(position.x + PLAYER_HALF_WIDTH, position.y + PLAYER_HEIGHT, position.z + PLAYER_HALF_WIDTH);
  };

  const moveAxis = (axis: 'x' | 'y' | 'z', delta: number, colliders: readonly Box3[]): boolean => {
    if (delta === 0) return false;
    position[axis] += delta;
    updateBounds();
    let hit = false;
    for (const box of colliders) {
      if (!overlaps(min, max, box)) continue;
      hit = true;
      if (axis === 'y') {
        position.y = delta > 0 ? box.min.y - PLAYER_HEIGHT : box.max.y;
      } else {
        position[axis] = delta > 0 ? box.min[axis] - PLAYER_HALF_WIDTH : box.max[axis] + PLAYER_HALF_WIDTH;
      }
      updateBounds();
    }
    return hit;
  };

  const reset = (spawnPoint: Vector3) => {
    position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    grounded = false;
    cameraSnap = true;
  };
  reset(spawn);

  const update = (dt: number, input: PlayerInput, colliders: readonly Box3[]) => {
    if (!(dt > 0)) {
      jumpHeld = input.jumpPressed;
      return;
    }
    const frameDt = Math.min(dt, MAX_FRAME_DT);

    let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
    let mz = Number.isFinite(input.moveZ) ? input.moveZ : 0;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    velocity.x = mx * MOVE_SPEED;
    velocity.z = mz * MOVE_SPEED;
    if (len > 0.01) targetYaw = Math.atan2(-mx, -mz);

    const jumpEdge = input.jumpPressed && !jumpHeld;
    jumpHeld = input.jumpPressed;
    if (jumpEdge && grounded) {
      velocity.y = JUMP_VELOCITY;
      grounded = false;
    }

    const fastest = Math.max(Math.abs(velocity.x), Math.abs(velocity.y), Math.abs(velocity.z), GRAVITY * frameDt);
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil((fastest * frameDt) / MAX_STEP_DISTANCE)));
    const h = frameDt / steps;

    for (let i = 0; i < steps; i++) {
      moveAxis('x', velocity.x * h, colliders);
      moveAxis('z', velocity.z * h, colliders);

      // Semi-implicit Euler with the average velocity over the substep keeps jump height independent of dt.
      const vy0 = velocity.y;
      velocity.y = Math.max(-MAX_FALL_SPEED, vy0 - GRAVITY * h);
      const dy = ((vy0 + velocity.y) / 2) * h;
      const hit = moveAxis('y', dy, colliders);
      grounded = hit && dy < 0;
      if (hit) velocity.y = 0;
    }

    // Smoothly turn the model toward the movement direction.
    let diff = targetYaw - model.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    model.rotation.y += diff * (1 - Math.exp(-14 * frameDt));
  };

  const updateCamera = (camera: PerspectiveCamera, dt: number) => {
    const targetY = position.y + CAMERA_FOCUS_HEIGHT;
    if (cameraSnap) {
      focus.set(position.x, targetY, position.z);
      cameraSnap = false;
    } else {
      const a = 1 - Math.exp(-CAMERA_SMOOTHING * Math.max(0, dt));
      focus.x += (position.x - focus.x) * a;
      focus.y += (targetY - focus.y) * a;
      focus.z += (position.z - focus.z) * a;
    }
    camera.position.copy(focus).add(CAMERA_OFFSET);
    camera.lookAt(focus);
  };

  return { root, reset, update, updateCamera };
}
