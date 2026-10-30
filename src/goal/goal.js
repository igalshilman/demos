import * as THREE from 'three';

const RING_RADIUS = 1.4;
const REACH_RADIUS = 1.8;
const REACH_HEIGHT = 2.5;
const LOCKED_INTENSITY = 0.08;
const UNLOCKED_INTENSITY = 2.4;
const LOCKED_COLOR = 0x4a5568;
const UNLOCKED_COLOR = 0xffd54a;

const FALLBACK_POSITION = { x: 0, y: 0, z: -16 };

function readPosition(world) {
  const p = world && (world.goalPosition || world.goal);
  if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)) return p;
  return FALLBACK_POSITION;
}

export function createGoal(scene, world) {
  const source = readPosition(world);
  const position = new THREE.Vector3(source.x, source.y, source.z);

  const group = new THREE.Group();
  group.name = 'goal';
  group.position.copy(position);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: LOCKED_COLOR,
    emissive: UNLOCKED_COLOR,
    emissiveIntensity: LOCKED_INTENSITY,
    roughness: 0.35,
    metalness: 0.4,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 0.16, 16, 48), ringMaterial);
  ring.position.y = RING_RADIUS + 0.4;
  group.add(ring);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.65, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 }),
  );
  base.position.y = 0.15;
  group.add(base);

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(RING_RADIUS * 0.85, 32),
    new THREE.MeshBasicMaterial({
      color: UNLOCKED_COLOR,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glow.position.y = ring.position.y;
  group.add(glow);

  if (scene) scene.add(group);

  const lockedColor = new THREE.Color(LOCKED_COLOR);
  const unlockedColor = new THREE.Color(UNLOCKED_COLOR);
  const state = { time: 0, glowLevel: 0 };

  const api = {
    group,
    position,
    reached: false,
    unlocked: false,
    update(dt, playerPosition, isUnlocked) {
      state.time += dt;
      api.unlocked = !!isUnlocked;

      const target = api.unlocked ? 1 : 0;
      const blend = Math.min(1, dt * 6);
      state.glowLevel += (target - state.glowLevel) * blend;
      if (Math.abs(target - state.glowLevel) < 0.001) state.glowLevel = target;

      const pulse = api.unlocked ? 1 + Math.sin(state.time * 4) * 0.15 : 1;
      ringMaterial.emissiveIntensity =
        (LOCKED_INTENSITY + (UNLOCKED_INTENSITY - LOCKED_INTENSITY) * state.glowLevel) * pulse;
      ringMaterial.color.copy(lockedColor).lerp(unlockedColor, state.glowLevel);
      glow.material.opacity = 0.3 * state.glowLevel;
      ring.rotation.y = state.time * (api.unlocked ? 1.6 : 0.3);

      if (api.unlocked && !api.reached && playerPosition) {
        const dx = playerPosition.x - position.x;
        const dz = playerPosition.z - position.z;
        const dy = playerPosition.y - (position.y + ring.position.y);
        if (dx * dx + dz * dz <= REACH_RADIUS * REACH_RADIUS && Math.abs(dy) <= REACH_HEIGHT) {
          api.reached = true;
        }
      }
    },
    reset() {
      api.reached = false;
      api.unlocked = false;
      state.glowLevel = 0;
      state.time = 0;
      ringMaterial.emissiveIntensity = LOCKED_INTENSITY;
      ringMaterial.color.copy(lockedColor);
      glow.material.opacity = 0;
      ring.rotation.y = 0;
    },
  };

  return api;
}
