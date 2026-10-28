import { Vector3 } from 'three';

export const CAMERA_OFFSET = new Vector3(0, 5, 8);
export const LOOK_OFFSET = new Vector3(0, 1.2, 0);
export const SMOOTHING = 6;

export function createFollowCamera(camera) {
  const anchor = new Vector3();
  const look = new Vector3();
  let initialized = false;

  function apply() {
    camera.position.copy(anchor).add(CAMERA_OFFSET);
    look.copy(anchor).add(LOOK_OFFSET);
    camera.lookAt(look);
  }

  function reset(targetPosition) {
    anchor.copy(targetPosition);
    initialized = true;
    apply();
  }

  function update(dt, targetPosition) {
    if (!initialized) {
      reset(targetPosition);
      return;
    }
    const t = dt > 0 ? 1 - Math.exp(-SMOOTHING * dt) : 0;
    anchor.lerp(targetPosition, t);
    apply();
  }

  return { update, reset };
}
