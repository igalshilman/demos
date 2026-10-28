import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { createFollowCamera } from '../src/follow-camera.js';

const near = (a, b, eps = 1e-6) => assert.ok(a.distanceTo(b) < eps, `${a.toArray()} vs ${b.toArray()}`);

test('reset places the camera behind and above the target instantly', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  follow.reset(new Vector3(10, 0, -4));
  near(camera.position, new Vector3(10, 5, 4));
});

test('camera looks at the upper body, not the feet', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  const target = new Vector3(2, 1, 3);
  follow.reset(target);
  const dir = camera.getWorldDirection(new Vector3());
  const toBody = new Vector3(2, 2.2, 3).sub(camera.position).normalize();
  const toFeet = target.clone().sub(camera.position).normalize();
  assert.ok(dir.dot(toBody) > 0.99999);
  assert.ok(dir.dot(toFeet) < 0.9999);
  assert.ok(dir.y < 0 && dir.z < 0);
});

test('first update without reset snaps to the target', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  follow.update(0.016, new Vector3(1, 0, 1));
  near(camera.position, new Vector3(1, 5, 9));
});

test('update eases toward a moved target without overshooting', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  follow.reset(new Vector3(0, 0, 0));
  const target = new Vector3(10, 0, 0);
  follow.update(1 / 60, target);
  assert.ok(camera.position.x > 0 && camera.position.x < 10);
  let prev = camera.position.x;
  for (let i = 0; i < 600; i++) {
    follow.update(1 / 60, target);
    assert.ok(camera.position.x >= prev && camera.position.x <= 10 + 1e-9);
    prev = camera.position.x;
  }
  near(camera.position, new Vector3(10, 5, 8), 1e-3);
});

test('smoothing is frame-rate independent', () => {
  const target = new Vector3(6, 2, -3);
  const a = new PerspectiveCamera();
  const b = new PerspectiveCamera();
  const fa = createFollowCamera(a);
  const fb = createFollowCamera(b);
  fa.reset(new Vector3());
  fb.reset(new Vector3());
  for (let i = 0; i < 6; i++) fa.update(1 / 60, target);
  for (let i = 0; i < 12; i++) fb.update(1 / 120, target);
  near(a.position, b.position, 1e-9);
});

test('zero dt keeps the camera still', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  follow.reset(new Vector3());
  follow.update(0, new Vector3(5, 0, 5));
  near(camera.position, new Vector3(0, 5, 8));
});

test('reset snaps instantly after the target teleports', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  follow.reset(new Vector3());
  follow.update(1 / 60, new Vector3(50, 0, 50));
  follow.reset(new Vector3(-20, 3, 7));
  near(camera.position, new Vector3(-20, 8, 15));
  follow.update(1 / 60, new Vector3(-20, 3, 7));
  near(camera.position, new Vector3(-20, 8, 15));
});

test('does not hold on to the target vector', () => {
  const camera = new PerspectiveCamera();
  const follow = createFollowCamera(camera);
  const target = new Vector3();
  follow.reset(target);
  target.set(100, 0, 0);
  follow.update(0, target);
  near(camera.position, new Vector3(0, 5, 8));
});
