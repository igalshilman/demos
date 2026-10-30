import { describe, it, expect } from 'vitest';
import { Vector3, PerspectiveCamera } from 'three';
import {
  clampDelta,
  movementFromKeys,
  createCollectionTracker,
  createInput,
  createFollowCamera,
  MAX_FRAME_DELTA,
} from './gameLogic.js';

const F = new Vector3(0, 0, -1);
const R = new Vector3(1, 0, 0);

function makeItems() {
  return [0, 1, 2, 3, 4].map((i) => ({
    id: `star-${i}`,
    position: new Vector3(i * 10, 2, 0),
    mesh: { visible: true },
  }));
}

function key(type, code, extra = {}) {
  return Object.assign(new Event(type, { cancelable: true }), { code, repeat: false, ...extra });
}

describe('clampDelta', () => {
  it('passes small values and clamps long pauses', () => {
    expect(clampDelta(0.016)).toBe(0.016);
    expect(clampDelta(5)).toBe(MAX_FRAME_DELTA);
  });
  it('rejects negative and non-finite values', () => {
    expect(clampDelta(-1)).toBe(0);
    expect(clampDelta(NaN)).toBe(0);
    expect(clampDelta(Infinity)).toBe(0);
  });
});

describe('movementFromKeys', () => {
  it('maps WASD and arrows relative to the camera', () => {
    expect(movementFromKeys(new Set(['KeyW']), F, R).toArray()).toEqual([0, 0, -1]);
    expect(movementFromKeys(new Set(['ArrowDown']), F, R).z).toBe(1);
    expect(movementFromKeys(new Set(['KeyA']), F, R).x).toBe(-1);
    expect(movementFromKeys(new Set(['ArrowRight']), F, R).x).toBe(1);
  });
  it('normalizes diagonals', () => {
    const v = movementFromKeys(new Set(['KeyW', 'KeyD']), F, R);
    expect(v.length()).toBeCloseTo(1, 6);
  });
  it('cancels opposite keys and idles with no keys', () => {
    expect(movementFromKeys(new Set(['KeyW', 'KeyS']), F, R).length()).toBe(0);
    expect(movementFromKeys(new Set(), F, R).length()).toBe(0);
  });
  it('follows a rotated camera basis', () => {
    const v = movementFromKeys(new Set(['KeyW']), new Vector3(1, 0, 0), new Vector3(0, 0, 1));
    expect(v.toArray()).toEqual([1, 0, 0]);
  });
});

describe('collection tracker', () => {
  it('uses the player center (feet + 0.8) and a 1.3 radius', () => {
    const items = makeItems();
    const t = createCollectionTracker(items);
    // feet at y=0 -> center y=0.8, star at y=2: distance 1.2 -> collected
    expect(t.update(new Vector3(0, 0, 0))).toEqual(['star-0']);
    expect(items[0].mesh.visible).toBe(false);
    // distance 1.4 from star-1 center
    expect(t.update(new Vector3(10, 2 - 0.8 - 1.4, 0))).toEqual([]);
    expect(t.update(new Vector3(10, 2 - 0.8 - 1.29, 0))).toEqual(["star-1"]);
    expect(t.count).toBe(2);
  });
  it('does not collect twice and completes at five', () => {
    const items = makeItems();
    const t = createCollectionTracker(items);
    expect(t.complete).toBe(false);
    for (const it of items) t.update(new Vector3(it.position.x, it.position.y - 0.8, 0));
    expect(t.count).toBe(5);
    expect(t.complete).toBe(true);
    expect(t.update(new Vector3(0, 1.2, 0))).toEqual([]);
  });
  it('reset restores visibility and count', () => {
    const items = makeItems();
    const t = createCollectionTracker(items);
    t.update(new Vector3(0, 1.2, 0));
    t.reset();
    expect(t.count).toBe(0);
    expect(items.every((i) => i.mesh.visible)).toBe(true);
  });
});

describe('input', () => {
  it('tracks keys, prevents default on gameplay keys, and leaves others alone', () => {
    const target = new EventTarget();
    const input = createInput(target, new EventTarget());
    const down = key('keydown', 'Space');
    target.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    const arrow = key('keydown', 'ArrowDown');
    target.dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(true);
    const other = key('keydown', 'KeyP');
    target.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(input.keys.has('ArrowDown')).toBe(true);
    target.dispatchEvent(key('keyup', 'ArrowDown'));
    expect(input.keys.has('ArrowDown')).toBe(false);
  });
  it('emits jump once per press, ignoring key repeat', () => {
    const target = new EventTarget();
    const input = createInput(target, new EventTarget());
    target.dispatchEvent(key('keydown', 'Space'));
    target.dispatchEvent(key('keydown', 'Space', { repeat: true }));
    expect(input.consumeJump()).toBe(true);
    expect(input.consumeJump()).toBe(false);
    target.dispatchEvent(key('keydown', 'Space', { repeat: true }));
    expect(input.consumeJump()).toBe(false);
    target.dispatchEvent(key('keyup', 'Space'));
    target.dispatchEvent(key('keydown', 'Space'));
    expect(input.consumeJump()).toBe(true);
  });
  it('queues restart on R and ignores browser shortcuts', () => {
    const target = new EventTarget();
    const input = createInput(target, new EventTarget());
    const ctrl = key('keydown', 'KeyR', { ctrlKey: true });
    target.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).toBe(false);
    expect(input.consumeRestart()).toBe(false);
    target.dispatchEvent(key('keydown', 'KeyR'));
    expect(input.consumeRestart()).toBe(true);
  });
  it('clears everything on blur and when the page is hidden', () => {
    const target = new EventTarget();
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const input = createInput(target, doc);
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(key('keydown', 'Space'));
    target.dispatchEvent(new Event('blur'));
    expect(input.keys.size).toBe(0);
    expect(input.consumeJump()).toBe(false);
    target.dispatchEvent(key('keydown', 'KeyD'));
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(input.keys.size).toBe(0);
  });
  it('stops listening after dispose', () => {
    const target = new EventTarget();
    const input = createInput(target, new EventTarget());
    input.dispose();
    target.dispatchEvent(key('keydown', 'KeyW'));
    expect(input.keys.size).toBe(0);
  });
});

describe('follow camera', () => {
  it('snaps first, then smoothly approaches without changing direction', () => {
    const cam = new PerspectiveCamera();
    const fc = createFollowCamera(cam);
    fc.update(new Vector3(0, 0, 0), 0.016);
    const startOffset = cam.position.clone();
    expect(startOffset.y).toBeGreaterThan(0);
    expect(startOffset.z).toBeGreaterThan(0);
    fc.update(new Vector3(20, 0, 0), 0.016);
    expect(cam.position.x).toBeGreaterThan(0);
    expect(cam.position.x).toBeLessThan(20);
    for (let i = 0; i < 600; i++) fc.update(new Vector3(20, 0, 0), 0.016);
    expect(cam.position.x).toBeCloseTo(20, 2);
    expect(cam.position.y).toBeCloseTo(startOffset.y, 2);
    expect(cam.position.z).toBeCloseTo(startOffset.z, 2);
  });
});
