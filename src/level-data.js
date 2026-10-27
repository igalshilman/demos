// Serializable course definition. Units are meters, +Y is up, the course runs toward -Z.
// Platform boxes are world-coordinate AABBs; every walkable surface in the level is listed here.

export const PLAYER = Object.freeze({ radius: 0.35, height: 1.4, speed: 6, jump: 8, gravity: 22 });

export const LIMITS = Object.freeze({ maxRise: 1, maxGap: 1.5, minSize: 2.5 });

const THICKNESS = 1.2;

function slab(id, cx, cz, width, depth, top, style) {
  return {
    id,
    min: { x: cx - width / 2, y: top - THICKNESS, z: cz - depth / 2 },
    max: { x: cx + width / 2, y: top, z: cz + depth / 2 },
    style,
  };
}

export const LEVEL = {
  name: 'Lantern Reach',
  platforms: [
    slab('start', 0, 0, 10, 10, 0, 'meadow'),
    slab('step-a', 0, -8.2, 4, 4, 0.6, 'mint'),
    slab('step-b', 2, -13.5, 4, 4, 1.2, 'sand'),
    slab('step-c', 4, -19.4, 4, 5, 1.2, 'coral'),
    slab('step-d', 9.4, -19.4, 4, 4, 2, 'violet'),
    slab('step-e', 9.5, -24.7, 4, 4, 2.8, 'sky'),
    slab('step-f', 4.1, -24.7, 4, 4, 3.4, 'peach'),
    slab('step-g', 4.1, -30, 4, 4, 4, 'lime'),
    slab('finish', 4.1, -38.4, 10, 10, 4.5, 'beacon'),
  ],
  // Order the player is expected to travel; consecutive entries are one jump apart.
  route: ['start', 'step-a', 'step-b', 'step-c', 'step-d', 'step-e', 'step-f', 'step-g', 'finish'],
  spawn: { x: 0, y: 0, z: 2 },
  coins: [
    { id: 'coin-1', position: { x: 0, y: 1.4, z: -8.2 }, radius: 0.45 },
    { id: 'coin-2', position: { x: 4, y: 2, z: -19.4 }, radius: 0.45 },
    { id: 'coin-3', position: { x: 9.4, y: 2.8, z: -19.4 }, radius: 0.45 },
    { id: 'coin-4', position: { x: 9.5, y: 3.6, z: -24.7 }, radius: 0.45 },
    { id: 'coin-5', position: { x: 4.1, y: 4.2, z: -24.7 }, radius: 0.45 },
    { id: 'coin-6', position: { x: 4.1, y: 4.8, z: -30 }, radius: 0.45 },
  ],
  goal: { position: { x: 4.1, y: 4.5, z: -38.4 }, radius: 1.6 },
  killY: -15,
};
