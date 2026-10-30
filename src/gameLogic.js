import { Vector3 } from 'three';

export const MAX_FRAME_DELTA = 1 / 20;
export const PICKUP_RADIUS = 1.3;
export const PLAYER_CENTER_HEIGHT = 0.8;

const KEY_GROUPS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

const GAMEPLAY_CODES = new Set([
  ...Object.values(KEY_GROUPS).flat(),
  'Space',
  'KeyR',
]);

export function clampDelta(dt, max = MAX_FRAME_DELTA) {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  return Math.min(dt, max);
}

// Camera-relative horizontal movement; diagonals are normalized to length 1.
export function movementFromKeys(keys, forward, right, out = new Vector3()) {
  const has = (group) => KEY_GROUPS[group].some((code) => keys.has(code));
  const f = (has('forward') ? 1 : 0) - (has('back') ? 1 : 0);
  const r = (has('right') ? 1 : 0) - (has('left') ? 1 : 0);
  out.set(0, 0, 0);
  out.addScaledVector(forward, f).addScaledVector(right, r);
  out.y = 0;
  if (out.lengthSq() > 0) out.normalize();
  return out;
}

export function playerCenter(position, out = new Vector3()) {
  return out.copy(position).setY(position.y + PLAYER_CENTER_HEIGHT);
}

export function createCollectionTracker(collectibles, radius = PICKUP_RADIUS) {
  const collected = new Set();
  const center = new Vector3();
  for (const item of collectibles) item.mesh.visible = true;

  return {
    total: collectibles.length,
    get count() {
      return collected.size;
    },
    get complete() {
      return collectibles.length > 0 && collected.size === collectibles.length;
    },
    isCollected: (id) => collected.has(id),
    update(feetPosition) {
      playerCenter(feetPosition, center);
      const gained = [];
      for (const item of collectibles) {
        if (collected.has(item.id)) continue;
        if (center.distanceTo(item.position) <= radius) {
          collected.add(item.id);
          item.mesh.visible = false;
          gained.push(item.id);
        }
      }
      return gained;
    },
    reset() {
      collected.clear();
      for (const item of collectibles) item.mesh.visible = true;
    },
  };
}

// Keyboard state that cannot get stuck: cleared on blur/hidden, jump is a one-shot signal.
export function createInput(target, doc = target) {
  const keys = new Set();
  let jumpQueued = false;
  let restartQueued = false;

  const isGameplay = (e) => GAMEPLAY_CODES.has(e.code);
  const hasModifier = (e) => e.ctrlKey || e.metaKey || e.altKey;

  const onKeyDown = (e) => {
    if (!isGameplay(e) || hasModifier(e)) return;
    e.preventDefault();
    if (e.code === 'Space') {
      if (!e.repeat && !keys.has('Space')) jumpQueued = true;
      keys.add('Space');
    } else if (e.code === 'KeyR') {
      if (!e.repeat) restartQueued = true;
    } else {
      keys.add(e.code);
    }
  };
  const onKeyUp = (e) => {
    if (!isGameplay(e)) return;
    e.preventDefault();
    keys.delete(e.code);
  };
  const clear = () => {
    keys.clear();
    jumpQueued = false;
    restartQueued = false;
  };
  const onVisibility = () => {
    if (doc.hidden) clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    keys,
    clear,
    consumeJump() {
      const j = jumpQueued;
      jumpQueued = false;
      return j;
    },
    consumeRestart() {
      const r = restartQueued;
      restartQueued = false;
      return r;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

// Fixed-direction follow camera: constant offset, exponentially smoothed target.
export function createFollowCamera(camera, offset = new Vector3(0, 7, 10), smoothing = 5) {
  const focus = new Vector3();
  const lookOffset = new Vector3(0, 1, 0);
  const desired = new Vector3();
  let initialised = false;

  const apply = () => {
    desired.copy(focus).add(offset);
    camera.position.copy(desired);
    camera.lookAt(focus.x + lookOffset.x, focus.y + lookOffset.y, focus.z + lookOffset.z);
  };

  return {
    // fixed viewing direction on the ground plane: toward -Z
    forward: new Vector3(0, 0, -1),
    right: new Vector3(1, 0, 0),
    snap(target) {
      focus.copy(target);
      initialised = true;
      apply();
    },
    update(target, dt) {
      if (!initialised) return this.snap(target);
      const k = 1 - Math.exp(-smoothing * dt);
      focus.lerp(target, k);
      apply();
    },
  };
}
