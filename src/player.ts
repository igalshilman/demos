import {
  BoxGeometry,
  Box3,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry } from 'three';
import type { InputFrame, PlayerHandle } from './contracts';

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.5;
export const WALK_SPEED = 5;
export const SPRINT_SPEED = 8;
export const GRAVITY = 24;
export const JUMP_IMPULSE = 9;
export const TERMINAL_VELOCITY = 50;
export const MAX_FRAME_DT = 0.1;
export const SUBSTEP_DT = 1 / 60;
export const MAX_SUBSTEPS = 6;
export const TURN_RATE = 20;

const EPS = 1e-6;
const GROUND_PROBE = 1e-3;
const TWO_PI = Math.PI * 2;

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return d;
}

export function createPlayer(spawn: Vector3): PlayerHandle {
  const group = new Group();
  group.name = 'player';
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const part = (geometry: BufferGeometry, color: number, x: number, y: number, z: number): Mesh => {
    const material = new MeshStandardMaterial({ color, roughness: 0.7 });
    geometries.push(geometry);
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  part(new CylinderGeometry(0.3, 0.35, 0.9, 12), 0x3b82f6, 0, 0.75, 0);
  part(new SphereGeometry(0.28, 14, 10), 0xfde68a, 0, 1.3, 0);
  part(new BoxGeometry(0.16, 0.12, 0.2), 0xef4444, 0, 1.3, -0.28);
  part(new BoxGeometry(0.18, 0.3, 0.3), 0x1e3a8a, -0.16, 0.15, 0);
  part(new BoxGeometry(0.18, 0.3, 0.3), 0x1e3a8a, 0.16, 0.15, 0);

  const position = group.position;
  const velocity = new Vector3();
  let grounded = false;
  let heading = 0;

  position.copy(spawn);

  const overlapXZ = (b: Box3): boolean =>
    position.x - PLAYER_RADIUS < b.max.x - EPS &&
    position.x + PLAYER_RADIUS > b.min.x + EPS &&
    position.z - PLAYER_RADIUS < b.max.z - EPS &&
    position.z + PLAYER_RADIUS > b.min.z + EPS;

  const overlapY = (b: Box3): boolean =>
    position.y < b.max.y - EPS && position.y + PLAYER_HEIGHT > b.min.y + EPS;

  const overlapXY = (b: Box3): boolean =>
    position.x - PLAYER_RADIUS < b.max.x - EPS && position.x + PLAYER_RADIUS > b.min.x + EPS && overlapY(b);

  const overlapZY = (b: Box3): boolean =>
    position.z - PLAYER_RADIUS < b.max.z - EPS && position.z + PLAYER_RADIUS > b.min.z + EPS && overlapY(b);

  // Sweeps along one horizontal axis; returns true when a wall stopped the move.
  const moveHorizontal = (axis: 'x' | 'z', delta: number, solids: readonly Box3[]): boolean => {
    if (delta === 0) return false;
    let allowed = delta;
    for (const b of solids) {
      if (b.isEmpty()) continue;
      if (axis === 'x' ? !overlapZY(b) : !overlapXY(b)) continue;
      const p = position[axis];
      if (delta > 0) {
        if (b.min[axis] < p + PLAYER_RADIUS - EPS) continue;
        allowed = Math.min(allowed, Math.max(0, b.min[axis] - PLAYER_RADIUS - p));
      } else {
        if (b.max[axis] > p - PLAYER_RADIUS + EPS) continue;
        allowed = Math.max(allowed, Math.min(0, b.max[axis] + PLAYER_RADIUS - p));
      }
    }
    position[axis] += allowed;
    return allowed !== delta;
  };

  // Sweeps vertically. Returns 'floor' / 'ceiling' when blocked, otherwise null.
  const moveVertical = (delta: number, solids: readonly Box3[]): 'floor' | 'ceiling' | null => {
    if (delta === 0) return null;
    let allowed = delta;
    for (const b of solids) {
      if (b.isEmpty() || !overlapXZ(b)) continue;
      if (delta < 0) {
        if (b.max.y > position.y + EPS) continue;
        allowed = Math.max(allowed, Math.min(0, b.max.y - position.y));
      } else {
        if (b.min.y < position.y + PLAYER_HEIGHT - EPS) continue;
        allowed = Math.min(allowed, Math.max(0, b.min.y - PLAYER_HEIGHT - position.y));
      }
    }
    position.y += allowed;
    if (allowed === delta) return null;
    return delta < 0 ? 'floor' : 'ceiling';
  };

  const supported = (solids: readonly Box3[]): boolean => {
    for (const b of solids) {
      if (b.isEmpty() || !overlapXZ(b)) continue;
      const gap = position.y - b.max.y;
      if (gap >= -EPS && gap <= GROUND_PROBE && position.y + PLAYER_HEIGHT > b.min.y) return true;
    }
    return false;
  };

  const update = (dt: number, input: InputFrame, solids: readonly Box3[]): void => {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const frame = Math.min(dt, MAX_FRAME_DT);
    const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(frame / SUBSTEP_DT - 1e-6)));
    const h = frame / steps;

    const yaw = finite(input.cameraYaw);
    const mx = finite(input.moveX);
    const mz = finite(input.moveZ);
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);
    let dx = sinY * mz + cosY * mx;
    let dz = -cosY * mz + sinY * mx;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    velocity.x = dx * speed;
    velocity.z = dz * speed;

    grounded = velocity.y <= 0 && supported(solids);
    if (input.jumpPressed && grounded) {
      velocity.y = JUMP_IMPULSE;
      grounded = false;
    }

    const moving = len > EPS;
    const targetHeading = moving ? Math.atan2(-dx, -dz) : heading;

    for (let i = 0; i < steps; i++) {
      velocity.y = Math.max(-TERMINAL_VELOCITY, velocity.y - GRAVITY * h);

      if (moveHorizontal('x', velocity.x * h, solids)) velocity.x = 0;
      if (moveHorizontal('z', velocity.z * h, solids)) velocity.z = 0;

      const hit = moveVertical(velocity.y * h, solids);
      grounded = hit === 'floor';
      if (hit) velocity.y = 0;

      if (moving) {
        const diff = shortestAngle(heading, targetHeading);
        const maxTurn = TURN_RATE * h;
        heading += Math.abs(diff) <= maxTurn ? diff : Math.sign(diff) * maxTurn;
      }
    }

    group.rotation.y = heading;
  };

  const reset = (to: Vector3): void => {
    position.copy(to);
    velocity.set(0, 0, 0);
    grounded = false;
    heading = 0;
    group.rotation.set(0, 0, 0);
  };

  const dispose = (): void => {
    group.removeFromParent();
    group.clear();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    geometries.length = 0;
    materials.length = 0;
  };

  return {
    group,
    position,
    velocity,
    get grounded() {
      return grounded;
    },
    update,
    reset,
    dispose,
  };
}
