import * as THREE from 'three';
import { createMaterials, disposeMaterials } from './materials.js';
import { moveAndSlide } from './collision.js';

const GROUND_X = [-25, 25];
const GROUND_Z = [-50, 10];
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 1;

const PLATFORM_SIZE = { x: 4, z: 3.6 };
const PLATFORM_ROWS = [
  { z: -7, top: 1.0 },
  { z: -15, top: 1.5 },
  { z: -23, top: 2.0 },
  { z: -31, top: 2.5 },
];
const PLATFORM_X = [-6, 6];
const PLATFORM_THICKNESS = 1;

const FINAL_PLATFORM = { x: 0, z: -41, top: 3.0, sizeX: 10, sizeZ: 7 };

const MOVING = { z: -12, top: 1.25, sizeX: 4, sizeZ: 2, range: 6, period: 8 };

const CARRY_TOLERANCE = 0.05;

function makeBox(minX, minY, minZ, maxX, maxY, maxZ) {
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'world';
  const materials = createMaterials();
  const boxes = [];

  // Adds a mesh and its matching collision box from the same centre and size.
  function addSolid(cx, cy, cz, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    const box = makeBox(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2);
    boxes.push(box);
    return { mesh, box };
  }

  // Ground: top surface at y = 0.
  const [gx0, gx1] = GROUND_X;
  const [gz0, gz1] = GROUND_Z;
  const gw = gx1 - gx0;
  const gd = gz1 - gz0;
  const gcx = (gx0 + gx1) / 2;
  const gcz = (gz0 + gz1) / 2;
  addSolid(gcx, -0.5, gcz, gw, 1, gd, materials.ground);

  // Perimeter walls, just outside the ground.
  const wallY = WALL_HEIGHT / 2;
  addSolid(gx0 - WALL_THICKNESS / 2, wallY, gcz, WALL_THICKNESS, WALL_HEIGHT, gd + 2 * WALL_THICKNESS, materials.wall);
  addSolid(gx1 + WALL_THICKNESS / 2, wallY, gcz, WALL_THICKNESS, WALL_HEIGHT, gd + 2 * WALL_THICKNESS, materials.wall);
  addSolid(gcx, wallY, gz0 - WALL_THICKNESS / 2, gw, WALL_HEIGHT, WALL_THICKNESS, materials.wall);
  addSolid(gcx, wallY, gz1 + WALL_THICKNESS / 2, gw, WALL_HEIGHT, WALL_THICKNESS, materials.wall);

  // Raised platforms: two per row, standing on the ground.
  for (const row of PLATFORM_ROWS) {
    for (const x of PLATFORM_X) {
      const height = row.top + PLATFORM_THICKNESS;
      addSolid(x, row.top - height / 2, row.z, PLATFORM_SIZE.x, height, PLATFORM_SIZE.z, materials.platform);
    }
  }

  const fp = FINAL_PLATFORM;
  const finalHeight = fp.top + PLATFORM_THICKNESS;
  addSolid(fp.x, fp.top - finalHeight / 2, fp.z, fp.sizeX, finalHeight, fp.sizeZ, materials.final);

  // Moving platform: slides along x between -range and +range.
  const movingHeight = 0.5;
  const moving = addSolid(
    -MOVING.range, MOVING.top - movingHeight / 2, MOVING.z,
    MOVING.sizeX, movingHeight, MOVING.sizeZ, materials.moving,
  );
  const movingHalfX = MOVING.sizeX / 2;
  let time = 0;
  let movingX = -MOVING.range;
  let pendingCarry = 0;
  let carryPending = false;
  let supportMinX = 0;
  let supportMaxX = 0;

  function placeMoving(x) {
    moving.mesh.position.x = x;
    moving.box.min.x = x - movingHalfX;
    moving.box.max.x = x + movingHalfX;
  }

  // The goal ring itself is drawn by the goal module at goalPosition.
  const goalPosition = new THREE.Vector3(fp.x, fp.top, fp.z);

  // Orb positions sit on the surface they belong to; the orb module adds its own hover height.
  const coinPositions = [
    new THREE.Vector3(0, 0, -3),
    new THREE.Vector3(-6, 1.0, -7),
    new THREE.Vector3(6, 1.0, -7),
    new THREE.Vector3(0, MOVING.top, MOVING.z),
    new THREE.Vector3(-6, 1.5, -15),
    new THREE.Vector3(6, 1.5, -15),
    new THREE.Vector3(-6, 2.0, -23),
    new THREE.Vector3(6, 2.0, -23),
    new THREE.Vector3(-6, 2.5, -31),
    new THREE.Vector3(6, 2.5, -31),
  ];

  // Decorations (no collision), kept clear of the course.
  const random = seededRandom(95);
  function decorationSpot() {
    const side = random() < 0.5 ? -1 : 1;
    return {
      x: side * (11 + random() * 12),
      z: gz0 + 2 + random() * (gd - 4),
    };
  }

  function makeTree(x, z, scale) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), materials.trunk);
    trunk.position.y = 0.8;
    const lower = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2, 7), materials.leaves);
    lower.position.y = 2.4;
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 7), materials.leaves);
    upper.position.y = 3.6;
    tree.add(trunk, lower, upper);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    return tree;
  }

  function makeRock(x, z, scale) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), materials.rock);
    rock.position.set(x, 0.3 * scale, z);
    rock.scale.set(scale, scale * 0.7, scale);
    rock.rotation.y = random() * Math.PI;
    return rock;
  }

  function makeCrystal(x, z, scale) {
    const cluster = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), materials.crystal);
      shard.scale.set(1, 2.2 + i * 0.4, 1);
      shard.position.set((i - 1) * 0.45, 0.5 + i * 0.1, (i % 2) * 0.3);
      shard.rotation.z = (i - 1) * 0.2;
      cluster.add(shard);
    }
    cluster.position.set(x, 0, z);
    cluster.scale.setScalar(scale);
    return cluster;
  }

  const decorations = new THREE.Group();
  decorations.name = 'decorations';
  for (let i = 0; i < 18; i += 1) {
    const spot = decorationSpot();
    decorations.add(makeTree(spot.x, spot.z, 0.8 + random() * 0.6));
  }
  for (let i = 0; i < 10; i += 1) {
    const spot = decorationSpot();
    decorations.add(makeRock(spot.x, spot.z, 0.6 + random() * 0.9));
  }
  for (let i = 0; i < 6; i += 1) {
    const spot = decorationSpot();
    decorations.add(makeCrystal(spot.x, spot.z, 0.7 + random() * 0.6));
  }
  group.add(decorations);

  placeMoving(movingX);
  if (scene) scene.add(group);

  function update(dt) {
    if (!carryPending) {
      // Remember where the platform was before this frame's motion: riders are
      // supported by those bounds, not by the ones it has just moved to.
      supportMinX = moving.box.min.x;
      supportMaxX = moving.box.max.x;
      carryPending = true;
    }
    time += dt;
    const next = -MOVING.range * Math.cos((2 * Math.PI * time) / MOVING.period);
    pendingCarry += next - movingX;
    movingX = next;
    placeMoving(movingX);
  }

  function reset() {
    time = 0;
    movingX = -MOVING.range;
    pendingCarry = 0;
    carryPending = false;
    placeMoving(movingX);
  }

  function isOnMoving(position, radius) {
    const b = moving.box;
    return (
      Math.abs(position.y - b.max.y) <= CARRY_TOLERANCE &&
      position.x + radius > supportMinX && position.x - radius < supportMaxX &&
      position.z + radius > b.min.z && position.z - radius < b.max.z
    );
  }

  // Moves a player (feet position) and writes the result back into the inputs.
  function movePlayer(position, velocity, dt, radius = 0.4, height = 1.0) {
    const start = { x: position.x, y: position.y, z: position.z };
    if (carryPending) {
      if (isOnMoving(start, radius)) start.x += pendingCarry;
      pendingCarry = 0;
      carryPending = false;
    }
    const result = moveAndSlide(
      boxes,
      start,
      { x: velocity.x, y: velocity.y, z: velocity.z },
      dt,
      radius,
      height,
    );
    position.set(result.position.x, result.position.y, result.position.z);
    velocity.set(result.velocity.x, result.velocity.y, result.velocity.z);
    return result.grounded;
  }

  function dispose() {
    group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
    });
    if (group.parent) group.parent.remove(group);
    disposeMaterials(materials);
  }

  return {
    group,
    spawn: new THREE.Vector3(0, 0.1, 0),
    coinPositions,
    goalPosition,
    boxes,
    update,
    reset,
    movePlayer,
    movingPlatform: { box: moving.box, mesh: moving.mesh },
    dispose,
  };
}
