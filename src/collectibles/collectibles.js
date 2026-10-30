import * as THREE from 'three';

const ORB_RADIUS = 0.35;
const HOVER_HEIGHT = 0.9;
const BOB_AMPLITUDE = 0.18;
const BOB_SPEED = 2.2;
const SPIN_SPEED = 2.4;
const PICKUP_RADIUS = 1.2;
const PICKUP_HEIGHT = 2;
const POP_DURATION = 0.25;

const FALLBACK_POSITIONS = [
  { x: -6, y: 0, z: -4 },
  { x: -3, y: 0, z: -9 },
  { x: 0, y: 2, z: -12 },
  { x: 4, y: 2, z: -8 },
  { x: 7, y: 0, z: -3 },
  { x: 8, y: 0, z: 3 },
  { x: 4, y: 0, z: 8 },
  { x: 0, y: 0, z: 10 },
  { x: -5, y: 0, z: 7 },
  { x: -8, y: 0, z: 1 },
];

function readPositions(world) {
  const list = world && Array.isArray(world.coinPositions) ? world.coinPositions : null;
  if (!list || list.length === 0) return FALLBACK_POSITIONS;
  return list;
}

function buildOrb() {
  const orb = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(ORB_RADIUS, 1),
    new THREE.MeshStandardMaterial({
      color: 0x32e6ff,
      emissive: 0x16b8e0,
      emissiveIntensity: 1.6,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );
  orb.add(core);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(ORB_RADIUS * 1.6, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7ff3ff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  orb.add(halo);

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(ORB_RADIUS * 1.25, 0.03, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xc8fbff }),
  );
  band.rotation.x = Math.PI / 2.4;
  orb.add(band);

  return orb;
}

export function createCollectibles(scene, world) {
  const group = new THREE.Group();
  group.name = 'collectibles';

  const items = readPositions(world).map((p, index) => {
    const object = buildOrb();
    const baseY = p.y + HOVER_HEIGHT;
    object.position.set(p.x, baseY, p.z);
    group.add(object);
    return {
      object,
      x: p.x,
      y: p.y,
      z: p.z,
      baseY,
      phase: index * 0.9,
      collected: false,
      pop: 0,
    };
  });

  if (scene) scene.add(group);

  const state = { time: 0 };

  const api = {
    group,
    total: items.length,
    collected: 0,
    isComplete() {
      return api.collected >= api.total;
    },
    update(dt, playerPosition) {
      state.time += dt;
      for (const item of items) {
        if (item.collected) {
          if (item.pop > 0) {
            item.pop = Math.max(0, item.pop - dt);
            const t = item.pop / POP_DURATION;
            item.object.scale.setScalar(Math.max(0.001, t * (1 + (1 - t) * 0.8)));
            if (item.pop === 0) item.object.visible = false;
          }
          continue;
        }

        const t = state.time;
        item.object.rotation.y = t * SPIN_SPEED + item.phase;
        item.object.position.y = item.baseY + Math.sin(t * BOB_SPEED + item.phase) * BOB_AMPLITUDE;

        if (!playerPosition) continue;
        const dx = playerPosition.x - item.x;
        const dz = playerPosition.z - item.z;
        const dy = playerPosition.y - item.baseY;
        if (dx * dx + dz * dz <= PICKUP_RADIUS * PICKUP_RADIUS && Math.abs(dy) <= PICKUP_HEIGHT) {
          item.collected = true;
          item.pop = POP_DURATION;
          api.collected += 1;
        }
      }
    },
    reset() {
      api.collected = 0;
      state.time = 0;
      for (const item of items) {
        item.collected = false;
        item.pop = 0;
        item.object.visible = true;
        item.object.scale.setScalar(1);
        item.object.position.set(item.x, item.baseY, item.z);
      }
    },
  };

  return api;
}
