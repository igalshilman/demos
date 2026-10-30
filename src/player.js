import * as THREE from 'three';

const WIDTH = 0.7;
const HEIGHT = 1.6;
const HALF_WIDTH = WIDTH / 2;
const MOVE_SPEED = 6;
const GRAVITY = 24;
const JUMP_SPEED = 9;
const MAX_FALL_SPEED = 50;
const MAX_DT = 0.05;
const MAX_STEP_TIME = 1 / 120;
const MAX_STEP_DISTANCE = 0.1;
const EPS = 1e-6;
const TURN_RATE = 18;

function buildCharacter() {
  const group = new THREE.Group();
  group.name = 'player';

  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const add = (geometry, color, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, mat(color));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };

  // Body, legs, head, cap, eyes and a backpack; the character faces local +Z.
  add(new THREE.CylinderGeometry(0.3, 0.34, 0.6, 12), 0x2f9e9a, 0, 0.75, 0);
  add(new THREE.BoxGeometry(0.2, 0.4, 0.24), 0x36405a, -0.14, 0.2, 0);
  add(new THREE.BoxGeometry(0.2, 0.4, 0.24), 0x36405a, 0.14, 0.2, 0);
  add(new THREE.SphereGeometry(0.3, 16, 12), 0xf2c38b, 0, 1.2, 0);
  add(new THREE.ConeGeometry(0.28, 0.4, 12), 0xe8553d, 0, 1.52, -0.02);
  add(new THREE.SphereGeometry(0.05, 8, 6), 0x1c1c28, -0.1, 1.24, 0.27);
  add(new THREE.SphereGeometry(0.05, 8, 6), 0x1c1c28, 0.1, 1.24, 0.27);
  add(new THREE.BoxGeometry(0.4, 0.5, 0.18), 0xf0b429, 0, 0.8, -0.32);

  return group;
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPlayer(scene, { spawn, solids = [] } = {}) {
  const spawnPoint = spawn.clone();
  const position = spawnPoint.clone();
  const velocity = new THREE.Vector3();
  const boxes = solids.map((box) => box.clone());
  let grounded = false;
  let facing = 0;

  const mesh = buildCharacter();
  mesh.position.copy(position);
  scene?.add(mesh);

  const overlaps = (box) =>
    position.x + HALF_WIDTH > box.min.x + EPS &&
    position.x - HALF_WIDTH < box.max.x - EPS &&
    position.z + HALF_WIDTH > box.min.z + EPS &&
    position.z - HALF_WIDTH < box.max.z - EPS &&
    position.y + HEIGHT > box.min.y + EPS &&
    position.y < box.max.y - EPS;

  // Moves along one axis then pushes the collider out of any box it entered.
  // Returns true when the movement was blocked.
  function moveAxis(axis, delta) {
    if (delta === 0) return false;
    position[axis] += delta;
    let blocked = false;
    for (const box of boxes) {
      if (!overlaps(box)) continue;
      blocked = true;
      if (axis === 'y') {
        position.y = delta > 0 ? box.min.y - HEIGHT : box.max.y;
      } else if (delta > 0) {
        position[axis] = box.min[axis] - HALF_WIDTH;
      } else {
        position[axis] = box.max[axis] + HALF_WIDTH;
      }
    }
    return blocked;
  }

  function step(h, move) {
    velocity.x = move.x * MOVE_SPEED;
    velocity.z = move.z * MOVE_SPEED;
    velocity.y = Math.max(velocity.y - GRAVITY * h, -MAX_FALL_SPEED);

    if (moveAxis('x', velocity.x * h)) velocity.x = 0;
    if (moveAxis('z', velocity.z * h)) velocity.z = 0;

    const dy = velocity.y * h;
    const blocked = moveAxis('y', dy);
    grounded = false;
    if (blocked) {
      if (dy < 0) grounded = true;
      velocity.y = 0;
    }
  }

  function update(dt, input = {}) {
    if (!(dt > 0)) return;
    const frame = Math.min(dt, MAX_DT);

    const move = new THREE.Vector3(input.move?.x || 0, 0, input.move?.z || 0);
    if (move.lengthSq() > 1) move.normalize();

    if (input.jump && grounded) {
      velocity.y = JUMP_SPEED;
      grounded = false;
    }

    const maxSpeed = Math.max(MOVE_SPEED, Math.abs(velocity.y) + GRAVITY * frame);
    const steps = Math.max(
      Math.ceil(frame / MAX_STEP_TIME),
      Math.ceil((maxSpeed * frame) / MAX_STEP_DISTANCE),
    );
    const h = frame / steps;
    for (let i = 0; i < steps; i++) step(h, move);

    mesh.position.copy(position);
    if (move.lengthSq() > 1e-4) {
      const target = Math.atan2(move.x, move.z);
      const diff = shortestAngle(facing, target);
      facing += diff * Math.min(1, TURN_RATE * frame);
      mesh.rotation.y = facing;
    }
  }

  function reset() {
    position.copy(spawnPoint);
    velocity.set(0, 0, 0);
    grounded = false;
    mesh.position.copy(position);
  }

  function dispose() {
    scene?.remove(mesh);
    mesh.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.dispose();
      child.material.dispose();
    });
    mesh.clear();
  }

  return {
    position,
    get grounded() {
      return grounded;
    },
    update,
    reset,
    dispose,
  };
}
