import * as THREE from 'three';

const SLAB_THICKNESS = 1;
const RESPAWN_Y = -8;
const GOAL_HEIGHT = 2.5;
const SPAWN_CLEARANCE = 0.05;

// Each platform is a broad axis-aligned solid: centre x/z, width (x), depth (z),
// and the height of its walkable top surface. Visuals and colliders are both
// built from this list. Order is the order the player is expected to travel,
// heading toward negative Z.
const PLATFORMS = [
  { name: 'start', x: 0, z: 0, width: 6, depth: 6, top: 0, color: 0x4f9d69 },
  { name: 'step-1', x: 0, z: -6.2, width: 4, depth: 4, top: 0.5, color: 0x5b8def },
  { name: 'step-2', x: 1.5, z: -11.4, width: 4, depth: 4, top: 1, color: 0xe08a3c },
  { name: 'step-3', x: 3, z: -16.45, width: 3.5, depth: 3.5, top: 1.5, color: 0x5b8def },
  { name: 'step-4', x: 1, z: -21.6, width: 4, depth: 4, top: 1, color: 0xe08a3c },
  { name: 'step-5', x: -1.5, z: -26.8, width: 4, depth: 4, top: 1.5, color: 0x5b8def },
  { name: 'final', x: 0, z: -35.1, width: 10, depth: 10, top: 2, color: 0xc9b458 },
];

const GOAL = { x: 0, z: -37, halfSize: 1.25 };

function platformBox(p) {
  return new THREE.Box3(
    new THREE.Vector3(p.x - p.width / 2, p.top - SLAB_THICKNESS, p.z - p.depth / 2),
    new THREE.Vector3(p.x + p.width / 2, p.top, p.z + p.depth / 2),
  );
}

function addBoxMesh(group, box, material) {
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(centre);
  group.add(mesh);
  return mesh;
}

export function createLevel(scene) {
  const group = new THREE.Group();
  group.name = 'level';

  const colliders = PLATFORMS.map(platformBox);
  PLATFORMS.forEach((p, i) => {
    const mesh = addBoxMesh(
      group,
      colliders[i],
      new THREE.MeshLambertMaterial({ color: p.color }),
    );
    mesh.name = `platform-${p.name}`;
  });

  const start = PLATFORMS[0];
  const final = PLATFORMS[PLATFORMS.length - 1];
  const spawn = new THREE.Vector3(start.x, start.top + SPAWN_CLEARANCE, start.z);

  const goal = new THREE.Box3(
    new THREE.Vector3(GOAL.x - GOAL.halfSize, final.top, GOAL.z - GOAL.halfSize),
    new THREE.Vector3(GOAL.x + GOAL.halfSize, final.top + GOAL_HEIGHT, GOAL.z + GOAL.halfSize),
  );

  // Goal marker: a glowing ring on the floor with a flag behind it. Purely
  // visual and kept thin so it never blocks the follow camera.
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 32), markerMaterial);
  ring.name = 'goal-ring';
  ring.rotation.x = Math.PI / 2;
  ring.position.set(GOAL.x, final.top + 0.12, GOAL.z);
  group.add(ring);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), markerMaterial);
  pole.name = 'goal-pole';
  pole.position.set(GOAL.x, final.top + 1.5, GOAL.z - 1.25);
  group.add(pole);

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xe5383b }),
  );
  flag.name = 'goal-flag';
  flag.position.set(GOAL.x + 0.6, final.top + 2.6, GOAL.z - 1.25);
  group.add(flag);

  // Decor far below the course so falling reads clearly. Not part of colliders.
  const abyss = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshLambertMaterial({ color: 0x1c2233 }),
  );
  abyss.name = 'abyss-floor';
  abyss.rotation.x = -Math.PI / 2;
  abyss.position.set(0, RESPAWN_Y - 4, -20);
  group.add(abyss);

  const light = new THREE.HemisphereLight(0xffffff, 0x445566, 1.6);
  light.name = 'level-light';
  group.add(light);
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.name = 'level-sun';
  sun.position.set(5, 12, 6);
  group.add(sun);

  scene.add(group);

  return { spawn, colliders, goal, respawnY: RESPAWN_Y };
}
