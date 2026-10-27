import * as THREE from 'three';
import { LEVEL } from './level-data.js';

const PALETTE = {
  meadow: 0x6fcf6a,
  mint: 0x58d6b0,
  sand: 0xf0d27a,
  coral: 0xff7d6b,
  violet: 0xa58bff,
  sky: 0x5cc4ff,
  peach: 0xffb27a,
  lime: 0xc4e84f,
  beacon: 0xfff1a8,
};

function clonePoint(p) {
  return { x: p.x, y: p.y, z: p.z };
}

function deepFreezeBox(b) {
  return Object.freeze({
    id: b.id,
    min: Object.freeze(clonePoint(b.min)),
    max: Object.freeze(clonePoint(b.max)),
  });
}

export function createWorld() {
  const group = new THREE.Group();
  group.name = 'floating-island-world';

  const geometries = new Set();
  const materials = new Set();
  const track = (geometry, material) => {
    geometries.add(geometry);
    materials.add(material);
    return new THREE.Mesh(geometry, material);
  };

  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5c48, roughness: 1, flatShading: true });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const platforms = [];

  for (const def of LEVEL.platforms) {
    const w = def.max.x - def.min.x;
    const h = def.max.y - def.min.y;
    const d = def.max.z - def.min.z;
    const cx = (def.max.x + def.min.x) / 2;
    const cz = (def.max.z + def.min.z) / 2;
    const color = PALETTE[def.style] ?? 0x88cc88;

    const body = track(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    body.position.set(cx, def.max.y - h / 2, cz);
    body.name = `platform-${def.id}`;
    group.add(body);

    const rim = track(new THREE.BoxGeometry(w + 0.1, 0.12, d + 0.1), trimMaterial);
    rim.position.set(cx, def.max.y - 0.35, cz);
    group.add(rim);

    // Decorative underside rock; lies fully below and inside the footprint, so it is not walkable.
    const rock = track(new THREE.ConeGeometry(Math.min(w, d) * 0.45, Math.min(w, d) * 0.6, 7), rockMaterial);
    rock.rotation.x = Math.PI;
    rock.position.set(cx, def.min.y - Math.min(w, d) * 0.3, cz);
    group.add(rock);

    platforms.push(deepFreezeBox(def));
  }
  Object.freeze(platforms);

  const coinGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 20);
  coinGeometry.rotateX(Math.PI / 2);
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc933,
    emissive: 0x8a5a00,
    metalness: 0.6,
    roughness: 0.3,
  });
  const coins = LEVEL.coins.map((def) => {
    const mesh = track(coinGeometry, coinMaterial);
    mesh.name = def.id;
    mesh.position.set(def.position.x, def.position.y, def.position.z);
    mesh.visible = true;
    group.add(mesh);
    return { id: def.id, mesh, position: Object.freeze(clonePoint(def.position)), radius: def.radius };
  });

  const goal = Object.freeze({
    position: Object.freeze(clonePoint(LEVEL.goal.position)),
    radius: LEVEL.goal.radius,
  });

  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff3a0,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const beam = track(new THREE.CylinderGeometry(0.5, 0.9, 9, 16, 1, true), beaconMaterial);
  beam.position.set(goal.position.x, goal.position.y + 4.5, goal.position.z);
  group.add(beam);

  const ringMaterial = new THREE.MeshStandardMaterial({ color: 0xff5fa2, emissive: 0x7a1240 });
  const ring = track(new THREE.TorusGeometry(goal.radius * 0.8, 0.12, 10, 32), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(goal.position.x, goal.position.y + 0.15, goal.position.z);
  group.add(ring);

  const orb = track(
    new THREE.IcosahedronGeometry(0.45, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe066 }),
  );
  orb.position.set(goal.position.x, goal.position.y + 2.2, goal.position.z);
  group.add(orb);

  let time = 0;
  let disposed = false;

  function update(dt) {
    if (disposed) return;
    time += dt;
    for (const coin of coins) coin.mesh.rotation.y = time * 2.5;
    ring.rotation.z = time * 0.8;
    orb.rotation.y = time * 1.2;
    orb.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    beaconMaterial.opacity = 0.3 + Math.sin(time * 2) * 0.07;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
    geometries.clear();
    materials.clear();
  }

  return {
    group,
    platforms,
    coins,
    spawn: Object.freeze(clonePoint(LEVEL.spawn)),
    goal,
    killY: LEVEL.killY,
    update,
    dispose,
  };
}
