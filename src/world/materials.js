import * as THREE from 'three';

function flat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...extra });
}

export function createMaterials() {
  return {
    ground: flat(0x5fa84f),
    wall: flat(0x8a8f99),
    platform: flat(0xd9a441),
    platformTop: flat(0xf2c75c),
    moving: flat(0x4aa3d9),
    final: flat(0xb86adf),
    trunk: flat(0x7a5230),
    leaves: flat(0x2f8a4a),
    rock: flat(0x9b9a94),
    crystal: flat(0x6fe3ff, { emissive: 0x1a6f8a, emissiveIntensity: 0.6, roughness: 0.3 }),
    goalLocked: flat(0x666a73, { emissive: 0x000000 }),
    goalUnlocked: flat(0xffe066, { emissive: 0xffb300, emissiveIntensity: 0.8 }),
  };
}

export function disposeMaterials(materials) {
  for (const material of Object.values(materials)) material.dispose();
}
