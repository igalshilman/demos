import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFollowCamera } from '../src/camera/follow-camera.js';

function fakeDom() {
  const listeners = new Map();
  return {
    style: {},
    listeners,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type, event) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ preventDefault() {}, ...event });
    },
    count() {
      return [...listeners.values()].reduce((n, s) => n + s.size, 0);
    },
  };
}

function setup() {
  const camera = new THREE.PerspectiveCamera();
  const player = { position: new THREE.Vector3(2, 0, -3) };
  const dom = fakeDom();
  const rig = createFollowCamera(camera, player, dom);
  return { camera, player, dom, rig };
}

test('starts behind the player at +z with yaw 0', () => {
  const { camera, player, rig } = setup();
  assert.equal(rig.getYaw(), 0);
  assert.ok(Math.abs(camera.position.x - player.position.x) < 1e-9);
  assert.ok(camera.position.z > player.position.z);
  const expectedZ = player.position.z + Math.cos(0.45) * 9;
  assert.ok(Math.abs(camera.position.z - expectedZ) < 1e-9);
  const expectedY = 1.4 + Math.sin(0.45) * 9 + 1.1;
  assert.ok(Math.abs(camera.position.y - expectedY) < 1e-9);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  assert.ok(forward.z < 0);
});

test('smoothly follows the player', () => {
  const { camera, player, rig } = setup();
  const startZ = camera.position.z;
  player.position.z -= 10;
  rig.update(1 / 60);
  const t = 1 - Math.exp(-8 / 60);
  assert.ok(Math.abs(camera.position.z - (startZ - 10 * t)) < 1e-6);
  for (let i = 0; i < 300; i++) rig.update(1 / 60);
  assert.ok(Math.abs(camera.position.z - (startZ - 10)) < 1e-3);
});

test('drag orbits yaw and clamps pitch', () => {
  const { dom, rig } = setup();
  dom.emit('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
  dom.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 100 });
  assert.ok(Math.abs(rig.getYaw() + 0.5) < 1e-9);
  dom.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 5000 });
  dom.emit('pointermove', { pointerId: 1, clientX: 200, clientY: 5000 - 20000 });
  dom.emit('pointerup', { pointerId: 1 });
  dom.emit('pointermove', { pointerId: 1, clientX: 900, clientY: 100 });
  assert.ok(Math.abs(rig.getYaw() + 0.5) < 1e-9);
});

test('pitch limits', () => {
  const { camera, player, dom, rig } = setup();
  dom.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dom.emit('pointermove', { pointerId: 1, clientX: 0, clientY: 100000 });
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  assert.ok(Math.abs(camera.position.y - (1.4 + Math.sin(1.15) * 9 + 1.1)) < 1e-3);
  dom.emit('pointermove', { pointerId: 1, clientX: 0, clientY: -100000 });
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  assert.ok(Math.abs(camera.position.y - Math.max(1, 1.4 + Math.sin(-0.15) * 9 + 1.1)) < 1e-3);
  player.position.y = -10;
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  assert.ok(camera.position.y >= 1 - 1e-9);
});

test('wheel zoom clamps to 4..18', () => {
  const { camera, dom, rig } = setup();
  dom.emit('wheel', { deltaY: -100000 });
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  const flat = Math.cos(0.45) * 4;
  assert.ok(Math.abs(Math.hypot(camera.position.x - 2, camera.position.z + 3) - flat) < 1e-3);
  dom.emit('wheel', { deltaY: 100000 });
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  const far = Math.cos(0.45) * 18;
  assert.ok(Math.abs(Math.hypot(camera.position.x - 2, camera.position.z + 3) - far) < 1e-3);
});

test('two-pointer pinch zooms', () => {
  const { camera, dom, rig } = setup();
  dom.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dom.emit('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 });
  dom.emit('pointermove', { pointerId: 2, clientX: 200, clientY: 0 });
  assert.equal(rig.getYaw(), 0);
  for (let i = 0; i < 600; i++) rig.update(1 / 60);
  assert.ok(Math.hypot(camera.position.x - 2, camera.position.z + 3) < Math.cos(0.45) * 9);
});

test('reset restores orientation and position', () => {
  const { camera, dom, rig } = setup();
  const start = camera.position.clone();
  dom.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dom.emit('pointermove', { pointerId: 1, clientX: 300, clientY: 50 });
  dom.emit('wheel', { deltaY: 300 });
  rig.update(0.5);
  rig.reset();
  assert.equal(rig.getYaw(), 0);
  assert.ok(camera.position.distanceTo(start) < 1e-9);
});

test('dispose removes all listeners', () => {
  const { dom, rig } = setup();
  assert.ok(dom.count() > 0);
  rig.dispose();
  assert.equal(dom.count(), 0);
  dom.emit('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
  dom.emit('pointermove', { pointerId: 1, clientX: 300, clientY: 0 });
  assert.equal(rig.getYaw(), 0);
});
