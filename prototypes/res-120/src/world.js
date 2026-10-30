import * as THREE from 'three';

// Player numbers this course is tuned for: radius 0.35, height 1.2, speed 5,
// jump 8, gravity 20. A jump rises 1.6 and stays airborne 0.8s (4 units
// of travel); gaps and rises below stay well inside that.
const SLAB_THICKNESS = 1;
const RESPAWN_Y = -12;
const COLLECTIBLE_RADIUS = 0.5;
const GOAL_RADIUS = 1.2;

// Broad landing areas: x/z are [min, max] ranges, top is the walkable height.
const PLATFORMS = [
  { id: 'start', x: [-4, 4], z: [-4, 4], top: 0, color: 0x6fbf73 },
  { id: 'meadow', x: [6, 10], z: [-3, 3], top: 0.8, color: 0x7ac96f },
  { id: 'hurdles', x: [12, 17], z: [-3, 3], top: 0.8, color: 0x8ccf6a },
  { id: 'ridge', x: [19, 23], z: [-3, 3], top: 1.6, color: 0x9ad463 },
  { id: 'bend', x: [19, 23], z: [5, 9], top: 2.4, color: 0xa7d95e },
  { id: 'terrace', x: [18.5, 22.5], z: [11.2, 15], top: 3.0, color: 0xb6dc5a },
  { id: 'summit', x: [11.6, 16.1], z: [10.5, 15.5], top: 3.8, color: 0xf2c94c },
];

// Low blocks to hop over; narrower than a landing area on purpose.
const HURDLES = [
  { id: 'hurdle-a', x: [13.6, 14.2], z: [-3, 3], base: 0.8, height: 0.6 },
  { id: 'hurdle-b', x: [15.4, 16.0], z: [-3, 3], base: 0.8, height: 0.6 },
];

// Gem centres: x, y offset above the surface they sit over, z.
const GEMS = [
  { id: 'gem-1', at: [8, 0.8 + 0.7, 0] },
  { id: 'gem-2', at: [14.9, 1.4 + 0.9, 0] },
  { id: 'gem-3', at: [21, 1.6 + 0.7, 0] },
  { id: 'gem-4', at: [21, 2.4 + 0.7, 7] },
  { id: 'gem-5', at: [20.5, 3.0 + 0.7, 13.1] },
  { id: 'gem-6', at: [13.8, 3.8 + 0.7, 14] },
];

const GOAL_AT = [13.8, 3.8, 12.6];

function boxFrom(xr, yr, zr) {
  return new THREE.Box3(
    new THREE.Vector3(xr[0], yr[0], zr[0]),
    new THREE.Vector3(xr[1], yr[1], zr[1]),
  );
}

function freezeBox(box) {
  Object.freeze(box.min);
  Object.freeze(box.max);
  return Object.freeze(box);
}

function frozenVector(x, y, z) {
  return Object.freeze(new THREE.Vector3(x, y, z));
}

export function createWorld() {
  const group = new THREE.Group();
  group.name = 'res-120-world';

  const geometries = new Set();
  const materials = new Set();
  const track = (geometry, material) => {
    geometries.add(geometry);
    materials.add(material);
    return new THREE.Mesh(geometry, material);
  };
  const standard = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

  const soilMaterial = standard(0x7a5a3c);
  const stoneMaterial = standard(0x8d8f98);
  const hurdleMaterial = standard(0xd9734e);
  const gemMaterial = standard(0xffd23f, { emissive: 0x6a4a00, metalness: 0.3, roughness: 0.35 });
  const goalPoleMaterial = standard(0xf4f1ea);
  const goalRingMaterial = standard(0xff5d8f, { emissive: 0x4a0f24 });

  const colliders = [];

  for (const p of PLATFORMS) {
    const [x0, x1] = p.x;
    const [z0, z1] = p.z;
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;

    colliders.push(freezeBox(boxFrom(p.x, [p.top - SLAB_THICKNESS, p.top], p.z)));

    const slab = track(
      new THREE.BoxGeometry(w, SLAB_THICKNESS, d),
      standard(p.color),
    );
    slab.position.set(cx, p.top - SLAB_THICKNESS / 2, cz);
    slab.name = `platform-${p.id}`;
    group.add(slab);

    // Floating-island underside: an inverted low-poly cone, visual only.
    const radius = Math.min(w, d) * 0.5;
    const under = track(new THREE.ConeGeometry(radius, 2.2, 5), soilMaterial);
    under.rotation.x = Math.PI;
    under.position.set(cx, p.top - SLAB_THICKNESS - 1.1, cz);
    under.name = `underside-${p.id}`;
    group.add(under);
  }

  for (const h of HURDLES) {
    colliders.push(freezeBox(boxFrom(h.x, [h.base, h.base + h.height], h.z)));
    const mesh = track(
      new THREE.BoxGeometry(h.x[1] - h.x[0], h.height, h.z[1] - h.z[0]),
      hurdleMaterial,
    );
    mesh.position.set(
      (h.x[0] + h.x[1]) / 2,
      h.base + h.height / 2,
      (h.z[0] + h.z[1]) / 2,
    );
    mesh.name = h.id;
    group.add(mesh);
  }

  // A few decorative standing stones at the start, no collision.
  const stoneGeometry = new THREE.DodecahedronGeometry(0.5, 0);
  [[-3.2, -3.2, 1], [-3.4, 3.0, 1.3], [3.3, 3.3, 0.8]].forEach(([x, z, s], i) => {
    const stone = track(stoneGeometry, stoneMaterial);
    stone.scale.setScalar(s);
    stone.position.set(x, 0.3 * s, z);
    stone.name = `stone-${i}`;
    group.add(stone);
  });

  const collectibles = GEMS.map((g) => {
    const mesh = track(new THREE.OctahedronGeometry(COLLECTIBLE_RADIUS * 0.7, 0), gemMaterial);
    mesh.position.set(...g.at);
    mesh.name = g.id;
    group.add(mesh);
    return Object.freeze({
      id: g.id,
      position: frozenVector(...g.at),
      radius: COLLECTIBLE_RADIUS,
      mesh,
    });
  });

  const goalMesh = new THREE.Group();
  goalMesh.name = 'goal';
  const base = track(new THREE.CylinderGeometry(1, 1.2, 0.25, 8), stoneMaterial);
  base.position.y = 0.125;
  const pole = track(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), goalPoleMaterial);
  pole.position.y = 1.55;
  const ring = track(new THREE.TorusGeometry(0.7, 0.12, 6, 12), goalRingMaterial);
  ring.position.y = 1.6;
  const pennant = track(new THREE.ConeGeometry(0.3, 0.9, 3), goalRingMaterial);
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.set(0.45, 2.55, 0);
  goalMesh.add(base, pole, ring, pennant);
  goalMesh.position.set(...GOAL_AT);
  group.add(goalMesh);
  const goal = Object.freeze({
    position: frozenVector(...GOAL_AT),
    radius: GOAL_RADIUS,
    mesh: goalMesh,
  });

  Object.freeze(colliders);
  Object.freeze(collectibles);

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    group.clear();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  }

  return {
    group,
    colliders,
    spawn: frozenVector(-1.5, 0, 0),
    collectibles,
    goal,
    respawnY: RESPAWN_Y,
    dispose,
  };
}
