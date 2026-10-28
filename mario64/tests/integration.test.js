import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLevel } from '../src/level.js';
import { createPlayer } from '../src/player.js';
import { createFollowCamera } from '../src/follow-camera.js';
import { createInput } from '../src/input.js';
import { createGame } from '../src/game.js';

function key(code) {
  return { code, repeat: false, preventDefault() {} };
}

function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    emit: (type, event = {}) => listeners.get(type)?.(event),
  };
}

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  const level = createLevel(scene);
  const player = createPlayer({ scene, spawn: level.spawn, colliders: level.colliders });
  const followCamera = createFollowCamera(camera);
  const statuses = [];
  const game = createGame({ player, followCamera, level, onStatus: (s) => statuses.push(s) });
  game.reset();
  return { scene, camera, level, player, followCamera, game, statuses };
}

const forward = () => new THREE.Vector3(0, 0, -1);

function run(game, seconds, input, fwd = forward()) {
  for (let t = 0; t < seconds; t += 1 / 60) game.update(1 / 60, input, fwd);
}

test('real factories honour the agreed interfaces', () => {
  const { scene, level, player, followCamera } = setup();
  assert.ok(level.spawn.isVector3);
  assert.ok(Array.isArray(level.colliders) && level.colliders.every((b) => b.isBox3));
  assert.ok(level.goal.isBox3);
  assert.equal(typeof level.respawnY, 'number');
  assert.ok(player.position.isVector3);
  assert.equal(typeof player.update, 'function');
  assert.equal(typeof player.reset, 'function');
  assert.ok(player.getBounds().isBox3);
  assert.equal(typeof followCamera.update, 'function');
  assert.equal(typeof followCamera.reset, 'function');
  assert.ok(scene.children.length >= 2, 'level and player were added to the scene');
});

test('player stands on the start platform, then moves and jumps with input from the real input module', () => {
  const { game, player, level, camera } = setup();
  const target = fakeTarget();
  const input = createInput(target, { doc: fakeTarget() });

  run(game, 0.5, input.state);
  assert.ok(Math.abs(player.position.y - level.spawn.y) < 0.1, 'rests on the start platform');

  const z0 = player.position.z;
  target.emit('keydown', key('KeyW'));
  run(game, 0.5, input.state);
  assert.ok(player.position.z < z0 - 1, 'W moves forward (-Z)');
  target.emit('keyup', key('KeyW'));

  const z1 = player.position.z;
  target.emit('keydown', key('KeyS'));
  run(game, 0.3, input.state);
  assert.ok(player.position.z > z1 + 0.5, 'S moves backward');
  target.emit('keyup', key('KeyS'));

  const y0 = player.position.y;
  let peak = y0;
  target.emit('keydown', key('Space'));
  for (let i = 0; i < 40; i++) {
    game.update(1 / 60, input.state, forward());
    peak = Math.max(peak, player.position.y);
  }
  assert.ok(peak > y0 + 0.5, 'Space jumps');
  assert.ok(camera.position.distanceTo(player.position) > 1, 'camera follows at a distance');
});

test('walking off the course respawns; touching the goal wins and halts; reset restores', () => {
  const { game, player, level, statuses } = setup();
  const input = { forward: false, backward: false, left: false, right: false, jump: false };

  player.position.set(40, 0, 40);
  run(game, 3, input);
  assert.ok(statuses.includes('respawned'));
  assert.ok(player.position.distanceTo(level.spawn) < 0.5, 'back at spawn');

  const goalCentre = level.goal.getCenter(new THREE.Vector3());
  player.position.set(goalCentre.x, level.goal.min.y + 0.01, goalCentre.z);
  game.update(1 / 60, input, forward());
  assert.equal(game.won, true);
  const frozen = player.position.clone();
  input.forward = true;
  run(game, 0.5, input);
  assert.ok(player.position.equals(frozen), 'simulation halted after victory');

  game.reset();
  assert.equal(game.won, false);
  assert.ok(player.position.distanceTo(level.spawn) < 0.5);
});

test('a scripted run with real modules and camera-relative input reaches the goal', () => {
  const { game, player, level, camera } = setup();
  const input = { forward: false, backward: false, left: false, right: false, jump: false };
  const fwd = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const boxes = [...level.colliders.slice(1), level.goal];
  let index = 0;
  let jumpCooldown = 0;

  const distanceToBox = (box) =>
    Math.hypot(
      Math.max(box.min.x - player.position.x, 0, player.position.x - box.max.x),
      Math.max(box.min.z - player.position.z, 0, player.position.z - box.max.z),
    );
  const onBox = (box) => distanceToBox(box) === 0 && Math.abs(player.position.y - box.max.y) < 0.05;

  for (let frame = 0; frame < 60 * 120 && !game.won; frame++) {
    if (onBox(level.colliders[0])) index = 0;
    if (index < boxes.length - 1 && onBox(boxes[index])) index++;
    const box = boxes[index];
    const centre = box.getCenter(new THREE.Vector3());
    const prior = level.colliders[index];
    const lo = Math.max(prior.min.x, box.min.x) + 0.4;
    const hi = Math.min(prior.max.x, box.max.x) - 0.4;
    const aimX = lo <= hi ? Math.min(Math.max(centre.x, lo), hi) : centre.x;
    const dx = aimX - player.position.x;
    const dz = centre.z - player.position.z;

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, up);
    const wantF = dx * fwd.x + dz * fwd.z;
    const wantR = dx * right.x + dz * right.z;
    input.forward = wantF > 0.2;
    input.backward = wantF < -0.2;
    input.right = wantR > 0.2;
    input.left = wantR < -0.2;

    jumpCooldown -= 1;
    input.jump = jumpCooldown < 0 && distanceToBox(box) > 0 && distanceToBox(box) < 1.6 && player.position.y < box.max.y + 0.3;
    if (input.jump) jumpCooldown = 20;
    game.update(1 / 60, input, fwd);
  }
  assert.equal(
    game.won,
    true,
    `bot did not reach the goal; at ${player.position.toArray().map((n) => n.toFixed(1))}, target ${index}`,
  );
});
