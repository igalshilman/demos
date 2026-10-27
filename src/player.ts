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
import { PLAYER_HEIGHT, PLAYER_RADIUS } from './contracts';
import type { InputFrame, PlayerHandle } from './contracts';

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

  const lo = [0, 0, 0];
  const hi = [0, 0, 0];
  const d = [0, 0, 0];

  // Swept-AABB move: finds the earliest contact along the whole displacement on
  // all three axes at once, so the path through an edge or corner is never
  // reordered by axis. On contact the player is snapped to the face, that axis
  // is cancelled and the rest of the displacement slides. Returns the axes
  // (bit 0 x, 1 y, 2 z) that were blocked and the direction of the y block.
  const moveSwept = (dx: number, dy: number, dz: number, solids: readonly Box3[]): { blocked: number; floor: boolean } => {
    d[0] = dx;
    d[1] = dy;
    d[2] = dz;
    let blocked = 0;
    let floor = false;
    for (let iter = 0; iter < 3; iter++) {
      if (d[0] === 0 && d[1] === 0 && d[2] === 0) break;
      lo[0] = position.x - PLAYER_RADIUS;
      lo[1] = position.y;
      lo[2] = position.z - PLAYER_RADIUS;
      hi[0] = position.x + PLAYER_RADIUS;
      hi[1] = position.y + PLAYER_HEIGHT;
      hi[2] = position.z + PLAYER_RADIUS;

      let best = Infinity;
      let bestAxis = -1;
      let bestFace = 0;
      for (const b of solids) {
        if (b.isEmpty()) continue;
        const bmin = [b.min.x, b.min.y, b.min.z];
        const bmax = [b.max.x, b.max.y, b.max.z];
        let tIn = -Infinity;
        let tOut = Infinity;
        let inAxis = -1;
        let inFace = 0;
        let miss = false;
        for (let a = 0; a < 3 && !miss; a++) {
          const v = d[a];
          if (v === 0) {
            if (!(lo[a] < bmax[a] - EPS && hi[a] > bmin[a] + EPS)) miss = true;
            continue;
          }
          const gapIn = v > 0 ? bmin[a] - hi[a] : lo[a] - bmax[a];
          const gapOut = v > 0 ? bmax[a] - lo[a] : hi[a] - bmin[a];
          if (gapOut <= EPS) {
            miss = true;
            continue;
          }
          const speed = Math.abs(v);
          if (gapIn >= -EPS) {
            const t = Math.max(0, gapIn) / speed;
            if (t > tIn) {
              tIn = t;
              inAxis = a;
              inFace = v > 0 ? bmin[a] : bmax[a];
            }
          }
          tOut = Math.min(tOut, gapOut / speed);
        }
        if (miss || inAxis < 0 || tIn > 1 || tIn >= tOut - 1e-9) continue;
        if (tIn < best) {
          best = tIn;
          bestAxis = inAxis;
          bestFace = inFace;
        }
      }

      if (bestAxis < 0) {
        position.x += d[0];
        position.y += d[1];
        position.z += d[2];
        break;
      }
      position.x += d[0] * best;
      position.y += d[1] * best;
      position.z += d[2] * best;
      const dir = d[bestAxis];
      if (bestAxis === 0) position.x = dir > 0 ? bestFace - PLAYER_RADIUS : bestFace + PLAYER_RADIUS;
      else if (bestAxis === 2) position.z = dir > 0 ? bestFace - PLAYER_RADIUS : bestFace + PLAYER_RADIUS;
      else {
        position.y = dir > 0 ? bestFace - PLAYER_HEIGHT : bestFace;
        if (dir < 0) floor = true;
      }
      blocked |= 1 << bestAxis;
      d[bestAxis] = 0;
      const rest = 1 - best;
      for (let a = 0; a < 3; a++) d[a] *= rest;
    }
    return { blocked, floor };
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
    // Contract convention: yaw 0 faces -Z and positive yaw turns toward -X.
    let dx = -sinY * mz + cosY * mx;
    let dz = -cosY * mz - sinY * mx;
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

      const { blocked, floor } = moveSwept(velocity.x * h, velocity.y * h, velocity.z * h, solids);
      if (blocked & 1) velocity.x = 0;
      if (blocked & 4) velocity.z = 0;
      grounded = floor;
      if (blocked & 2) velocity.y = 0;

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
