import * as THREE from 'three';

const GROUND_HALF = 14;
const GROUND_DEPTH = 2;
const KILL_Y = -12;
const STAR_HEIGHT = 0.9;

// Platform tops rise at most 1.0 unit from the surface they are reached from,
// and neighbouring platforms are separated by gaps of 1.5 units at most.
const PLATFORMS = [
  { name: 'A', min: [3, -3], max: [7, 1], top: 1, color: 0xf2a541 },
  { name: 'B', min: [8.5, -3], max: [12, 1], top: 2, color: 0xe86a5c },
  { name: 'C', min: [8.5, 2.5], max: [12, 6], top: 3, color: 0xb86ad9 },
  { name: 'D', min: [3, 2.5], max: [7, 6], top: 4, color: 0x4fb3e8 },
  { name: 'E', min: [-7, -8], max: [-3, -4], top: 1, color: 0x6fcf6f },
  { name: 'F', min: [-7, -11.5], max: [-3, -9.5], top: 2, color: 0xf2d541 },
  { name: 'G', min: [-10.5, -11.5], max: [-8.5, -9.5], top: 3, color: 0xf27ca8 },
];

const STAR_PLATFORMS = ['A', 'C', 'D', 'F', 'G'];

function makeStarGeometry() {
  const shape = new THREE.Shape();
  const points = 5;
  const outer = 0.45;
  const inner = 0.2;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -0.07);
  return geometry;
}

export function createWorld(scene) {
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const geometries = new Set();
  const materials = new Set();
  const solids = [];
  const collectibles = [];

  const trackGeometry = (g) => {
    geometries.add(g);
    return g;
  };
  const trackMaterial = (m) => {
    materials.add(m);
    return m;
  };
  const lambert = (color, extra = {}) =>
    trackMaterial(new THREE.MeshLambertMaterial({ color, ...extra }));

  const addSolidBox = (minX, minZ, maxX, maxZ, bottom, top, sideMat, topMat) => {
    const box = new THREE.Box3(
      new THREE.Vector3(minX, bottom, minZ),
      new THREE.Vector3(maxX, top, maxZ),
    );
    solids.push(box);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const mesh = new THREE.Mesh(
      trackGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
      [sideMat, sideMat, topMat, sideMat, sideMat, sideMat],
    );
    mesh.position.copy(center);
    root.add(mesh);
    return box;
  };

  // Lighting
  root.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b8f4e, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(10, 20, 8);
  root.add(sun);

  // Ground slab
  addSolidBox(
    -GROUND_HALF,
    -GROUND_HALF,
    GROUND_HALF,
    GROUND_HALF,
    -GROUND_DEPTH,
    0,
    lambert(0x8a6a45),
    lambert(0x5fbf5a),
  );

  // Platforms, solid from the ground up to their top surface
  const platformsByName = {};
  for (const p of PLATFORMS) {
    const box = addSolidBox(
      p.min[0],
      p.min[1],
      p.max[0],
      p.max[1],
      0,
      p.top,
      lambert(p.color),
      lambert(new THREE.Color(p.color).offsetHSL(0, 0, 0.12)),
    );
    platformsByName[p.name] = box;
  }

  // Decorative scenery (never added to solids)
  const trunkGeo = trackGeometry(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 8));
  const leafGeo = trackGeometry(new THREE.ConeGeometry(1.1, 2.4, 8));
  const bushGeo = trackGeometry(new THREE.SphereGeometry(0.6, 10, 8));
  const cloudGeo = trackGeometry(new THREE.SphereGeometry(1, 10, 8));
  const trunkMat = lambert(0x7a4e2d);
  const leafMat = lambert(0x2f9e4f);
  const bushMat = lambert(0x3fb860);
  const cloudMat = lambert(0xffffff, { transparent: true, opacity: 0.9 });

  const trees = [[-12, 12], [12, 11], [-12, 2], [12.5, -9], [0, -12.5], [-1, 12.8]];
  for (const [x, z] of trees) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 0.8, z);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 2.8, z);
    root.add(trunk, leaves);
  }

  const bushes = [[-4, 6], [-8, 9], [5, 10], [-3, -1], [1, -11], [-13, -5]];
  for (const [x, z] of bushes) {
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(x, 0.3, z);
    bush.scale.set(1.2, 0.8, 1.2);
    root.add(bush);
  }

  const clouds = [[-8, 14, -14], [6, 16, -16], [15, 13, 4], [-16, 15, 6], [0, 17, 14]];
  for (const [x, y, z] of clouds) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(x, y, z);
    cloud.scale.set(3, 1, 1.8);
    root.add(cloud);
  }

  // Star collectibles
  const starGeo = trackGeometry(makeStarGeometry());
  const starMat = lambert(0xffd400, {
    emissive: 0xaa7a00,
    emissiveIntensity: 0.6,
  });
  STAR_PLATFORMS.forEach((name, i) => {
    const box = platformsByName[name];
    const center = box.getCenter(new THREE.Vector3());
    const position = new THREE.Vector3(center.x, box.max.y + STAR_HEIGHT, center.z);
    const mesh = new THREE.Mesh(starGeo, starMat);
    mesh.name = `star-${i + 1}`;
    mesh.position.copy(position);
    scene.add(mesh);
    collectibles.push({ id: `star-${i + 1}`, position, mesh });
  });

  const spawn = new THREE.Vector3(0, 0.1, 8);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    for (const c of collectibles) scene.remove(c.mesh);
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  return { spawn, killY: KILL_Y, solids, collectibles, dispose };
}
