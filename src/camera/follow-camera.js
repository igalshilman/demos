import * as THREE from 'three';

const INITIAL_DISTANCE = 9;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 18;
const INITIAL_PITCH = 0.45;
const MIN_PITCH = -0.15;
const MAX_PITCH = 1.15;
const TARGET_HEIGHT = 1.4;
const CAMERA_HEIGHT = 1.1;
const MIN_CAMERA_Y = 1;
const FOLLOW_RATE = 8;
const MAX_DT = 0.1;
const ORBIT_SPEED = 0.005;
const ZOOM_SPEED = 0.01;
const TOUCH_ZOOM_SPEED = 0.02;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createFollowCamera(camera, player, domElement) {
  let yaw = 0;
  let pitch = INITIAL_PITCH;
  let distance = INITIAL_DISTANCE;

  const target = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();

  const pointers = new Map();
  let pinchDistance = 0;

  const computeDesired = () => {
    target.copy(player.position);
    target.y += TARGET_HEIGHT;
    const cosPitch = Math.cos(pitch);
    desired.set(
      target.x + Math.sin(yaw) * cosPitch * distance,
      target.y + Math.sin(pitch) * distance + CAMERA_HEIGHT,
      target.z + Math.cos(yaw) * cosPitch * distance,
    );
    desired.y = Math.max(MIN_CAMERA_Y, desired.y);
  };

  const snap = () => {
    computeDesired();
    camera.position.copy(desired);
    lookTarget.copy(target);
    camera.lookAt(lookTarget);
  };

  const pinchSpan = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) pinchDistance = pinchSpan();
    if (domElement.setPointerCapture) {
      try {
        domElement.setPointerCapture(event.pointerId);
      } catch {
        // pointer may already be gone
      }
    }
  };

  const onPointerMove = (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    last.x = event.clientX;
    last.y = event.clientY;

    if (pointers.size >= 2) {
      const span = pinchSpan();
      distance = clamp(distance - (span - pinchDistance) * TOUCH_ZOOM_SPEED, MIN_DISTANCE, MAX_DISTANCE);
      pinchDistance = span;
      return;
    }

    yaw -= dx * ORBIT_SPEED;
    pitch = clamp(pitch + dy * ORBIT_SPEED, MIN_PITCH, MAX_PITCH);
  };

  const onPointerEnd = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 2) pinchDistance = pinchSpan();
    if (domElement.releasePointerCapture) {
      try {
        domElement.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
    }
  };

  const onWheel = (event) => {
    event.preventDefault();
    distance = clamp(distance + event.deltaY * ZOOM_SPEED, MIN_DISTANCE, MAX_DISTANCE);
  };

  const previousTouchAction = domElement.style ? domElement.style.touchAction : undefined;
  if (domElement.style) domElement.style.touchAction = 'none';

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerEnd);
  domElement.addEventListener('pointercancel', onPointerEnd);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  snap();

  return {
    getYaw() {
      return yaw;
    },

    update(dt) {
      computeDesired();
      const step = clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_DT);
      const t = 1 - Math.exp(-FOLLOW_RATE * step);
      camera.position.lerp(desired, t);
      camera.position.y = Math.max(MIN_CAMERA_Y, camera.position.y);
      lookTarget.lerp(target, t);
      camera.lookAt(lookTarget);
    },

    reset() {
      yaw = 0;
      pitch = INITIAL_PITCH;
      distance = INITIAL_DISTANCE;
      pointers.clear();
      snap();
    },

    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerEnd);
      domElement.removeEventListener('pointercancel', onPointerEnd);
      domElement.removeEventListener('wheel', onWheel);
      pointers.clear();
      if (domElement.style && previousTouchAction !== undefined) {
        domElement.style.touchAction = previousTouchAction;
      }
    },
  };
}
