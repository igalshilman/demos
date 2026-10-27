import { PerspectiveCamera, Vector3 } from 'three';
import type { CameraRig } from './contracts';

export const CAMERA_DISTANCE = 7;
export const CAMERA_HEIGHT = 5;
export const CHEST_HEIGHT = 1.1;
export const FOLLOW_RATE = 8;
export const YAW_RATE = 10;
export const MAX_CAMERA_DT = 0.1;

const TWO_PI = Math.PI * 2;

function shortestAngle(from: number, to: number): number {
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d < -Math.PI) d += TWO_PI;
  return d;
}

export function createCameraRig(camera: PerspectiveCamera): CameraRig {
  const focus = new Vector3();
  const look = new Vector3();
  let yaw = 0;

  const apply = (): void => {
    // Camera sits behind the focus point: opposite of forward (sin y, 0, -cos y).
    camera.position.set(
      focus.x - Math.sin(yaw) * CAMERA_DISTANCE,
      focus.y + CAMERA_HEIGHT,
      focus.z + Math.cos(yaw) * CAMERA_DISTANCE,
    );
    look.set(focus.x, focus.y + CHEST_HEIGHT, focus.z);
    camera.lookAt(look);
  };

  const finiteVec = (p: Vector3): boolean => Number.isFinite(p.x + p.y + p.z);

  return {
    update(dt, position, targetYaw) {
      if (!finiteVec(position) || !Number.isFinite(targetYaw)) return;
      const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_CAMERA_DT) : 0;
      focus.lerp(position, 1 - Math.exp(-FOLLOW_RATE * step));
      yaw += shortestAngle(yaw, targetYaw) * (1 - Math.exp(-YAW_RATE * step));
      apply();
    },
    reset(position, targetYaw) {
      focus.copy(position);
      yaw = Number.isFinite(targetYaw) ? targetYaw : 0;
      apply();
    },
  };
}
