import * as THREE from 'three';

// Static level data and meshes. Walkable tops line up with the collision boxes.
// Pickup and goal positions are centers, floating about 0.9 above the platform top.

const GROUND = { min: { x: -14, y: -2, z: -14 }, max: { x: 14, y: 0, z: 14 } };

// Ascending route, each step up by 1.0 with gaps of 1.5 or less.
// center x/z, half sizes, top height, colors. Pillars run down to the ground.
const PLATFORMS = [
  { id: 'A', x: -5, z: -1, w: 6, d: 6, top: 1, color: 0xf2a65a },
  { id: 'B', x: -5, z: -8, w: 5, d: 5, top: 2, color: 0x6ec6ca },
  { id: 'C', x: 1, z: -9, w: 5, d: 5, top: 3, color: 0xe86f8d },
  { id: 'D', x: 7, z: -7, w: 5, d: 5, top: 4, color: 0x9d8cf0 },
  { id: 'E', x: 7, z: -0.5, w: 5, d: 5, top: 5, color: 0x7bd88f },
  { id: 'F', x: 1, z: -0.5, w: 5, d: 5, top: 6, color: 0xffd23f },
];

const SPAWN = { x: 0, y: 0, z: 8 };
const PICKUP_HEIGHT = 0.9;
const CRYSTAL_RADIUS = 0.6;
const GOAL_RADIUS = 1;
const FALL_Y = -10;

function shade(color, factor) {
  return new THREE.Color(color).multiplyScalar(factor);
}

function createBox(box, topColor, sideColor, name) {
  const size = new THREE.Vector3(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z,
  );
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const side = new THREE.MeshBasicMaterial({ color: sideColor });
  const top = new THREE.MeshBasicMaterial({ color: topColor });
  const bottom = new THREE.MeshBasicMaterial({ color: shade(sideColor, 0.6) });
  // Face order: +x, -x, +y, -y, +z, -z
  const mesh = new THREE.Mesh(geometry, [side, side, top, bottom, side, side]);
  mesh.position.set(
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2,
  );
  mesh.name = name;
  return mesh;
}

function createCrystal(position, id) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35),
    new THREE.MeshBasicMaterial({ color: 0x4de3ff }),
  );
  mesh.scale.y = 1.5;
  mesh.position.set(position.x, position.y, position.z);
  mesh.name = `crystal-${id}`;
  return mesh;
}

function createGoalMesh(position) {
  const mesh = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.12, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a5f }),
  );
  ring.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  mesh.add(ring, core);
  mesh.position.set(position.x, position.y, position.z);
  mesh.name = 'goal';
  return mesh;
}

export function createLevel() {
  const group = new THREE.Group();
  group.name = 'level';

  const solids = [];
  const addSolid = (box, topColor, sideColor, name) => {
    solids.push({ min: { ...box.min }, max: { ...box.max } });
    group.add(createBox(box, topColor, sideColor, name));
  };

  addSolid(GROUND, 0x58c26a, 0x8a5a3c, 'ground');

  for (const p of PLATFORMS) {
    addSolid(
      {
        min: { x: p.x - p.w / 2, y: 0, z: p.z - p.d / 2 },
        max: { x: p.x + p.w / 2, y: p.top, z: p.z + p.d / 2 },
      },
      p.color,
      shade(p.color, 0.7),
      `platform-${p.id}`,
    );
  }

  const crystalPlatforms = PLATFORMS.slice(0, 5);
  const collectibles = crystalPlatforms.map((p, i) => {
    const id = `crystal-${i + 1}`;
    const position = { x: p.x, y: p.top + PICKUP_HEIGHT, z: p.z };
    const mesh = createCrystal(position, i + 1);
    group.add(mesh);
    return { id, position, radius: CRYSTAL_RADIUS, mesh };
  });

  const goalPlatform = PLATFORMS[PLATFORMS.length - 1];
  const goalPosition = {
    x: goalPlatform.x,
    y: goalPlatform.top + PICKUP_HEIGHT,
    z: goalPlatform.z,
  };
  const goalMesh = createGoalMesh(goalPosition);
  group.add(goalMesh);

  return {
    group,
    solids,
    spawn: { ...SPAWN },
    collectibles,
    goal: { position: goalPosition, radius: GOAL_RADIUS, mesh: goalMesh },
    fallY: FALL_Y,
  };
}
