import { PerspectiveCamera, Vector3, MathUtils } from 'three';

const PITCH_MIN = 0.12;
const PITCH_MAX = 1.35;
const DISTANCE_MIN = 4;
const DISTANCE_MAX = 14;
const DEFAULTS = { yaw: 0, pitch: 0.5, distance: 8 };
const LOOK_HEIGHT = 1;
const DRAG_SPEED = 0.006;
const FOLLOW_RATE = 8;

export function createFollowCamera(domElement) {
  const camera = new PerspectiveCamera(60, 1, 0.1, 300);
  const focus = new Vector3();
  const desired = new Vector3();
  let yaw = DEFAULTS.yaw;
  let pitch = DEFAULTS.pitch;
  let distance = DEFAULTS.distance;
  let dragPointer = null;
  let lastX = 0;
  let lastY = 0;

  function place() {
    const cp = Math.cos(pitch);
    camera.position.set(
      focus.x + Math.sin(yaw) * cp * distance,
      focus.y + Math.sin(pitch) * distance,
      focus.z + Math.cos(yaw) * cp * distance,
    );
    camera.lookAt(focus);
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
    dragPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    domElement.setPointerCapture?.(event.pointerId);
    domElement.focus?.({ preventScroll: true });
  }

  function onPointerMove(event) {
    if (event.pointerId !== dragPointer) return;
    yaw -= (event.clientX - lastX) * DRAG_SPEED;
    pitch = MathUtils.clamp(pitch + (event.clientY - lastY) * DRAG_SPEED, PITCH_MIN, PITCH_MAX);
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerEnd(event) {
    if (event.pointerId !== dragPointer) return;
    dragPointer = null;
    domElement.releasePointerCapture?.(event.pointerId);
  }

  function onWheel(event) {
    event.preventDefault();
    distance = MathUtils.clamp(distance + event.deltaY * 0.01, DISTANCE_MIN, DISTANCE_MAX);
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerEnd);
  domElement.addEventListener('pointercancel', onPointerEnd);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('contextmenu', onContextMenu);

  return {
    camera,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get distance() { return distance; },
    resize(width, height) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    reset(target) {
      yaw = DEFAULTS.yaw;
      pitch = DEFAULTS.pitch;
      distance = DEFAULTS.distance;
      dragPointer = null;
      focus.set(target.x, target.y + LOOK_HEIGHT, target.z);
      place();
    },
    // Eases the focus point toward the player; frame-rate independent.
    update(dt, target) {
      desired.set(target.x, target.y + LOOK_HEIGHT, target.z);
      focus.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * dt));
      place();
    },
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerEnd);
      domElement.removeEventListener('pointercancel', onPointerEnd);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('contextmenu', onContextMenu);
    },
  };
}

export const CAMERA_LIMITS = { PITCH_MIN, PITCH_MAX, DISTANCE_MIN, DISTANCE_MAX };
