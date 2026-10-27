import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  Vector3,
} from 'three';

export interface Collectible {
  id: string;
  position: Vector3;
  radius: number;
}

export interface Level {
  root: Group;
  spawn: Vector3;
  colliders: readonly Box3[];
  collectibles: readonly Collectible[];
  goal: Box3;
  collect(id: string): void;
  reset(): void;
}

interface BlockSpec {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  color: number;
}

const COLLECTIBLE_RADIUS = 0.35;
const SLAB_DEPTH = 1;

/** A platform whose top face is at `top`, spanning x and z, one slab deep. */
function slab(
  name: string,
  x: [number, number],
  z: [number, number],
  top: number,
  color: number,
): BlockSpec {
  return { name, min: [x[0], top - SLAB_DEPTH, z[0]], max: [x[1], top, z[1]], color };
}

/** A low obstacle standing on a platform surface. */
function block(
  name: string,
  x: [number, number],
  z: [number, number],
  base: number,
  height: number,
  color: number,
): BlockSpec {
  return { name, min: [x[0], base, z[0]], max: [x[1], base + height, z[1]], color };
}

// The course runs from +Z (start, near the camera) towards -Z (goal).
// Surface heights: start 0, steps +0.5 each, small gaps of at most 1.4.
const BLOCKS: readonly BlockSpec[] = [
  slab('start', [-3, 3], [-2, 8], 0, 0x3a7ca5),
  slab('step-1', [-3, 3], [-5, -2], 0.5, 0x4f9d8f),
  slab('step-2', [-3, 3], [-8, -5], 1.0, 0x6bb36b),
  // gap of 1.2 between z=-8 and z=-9.2
  slab('yard', [-3.5, 3.5], [-16, -9.2], 1.0, 0xe0a458),
  block('yard-block-left', [-3.5, -1.8], [-12.5, -11], 1.0, 0.6, 0xd1495b),
  block('yard-block-right', [1.8, 3.5], [-14.5, -13], 1.0, 0.6, 0xd1495b),
  // gap of 1.4 between z=-16 and z=-17.4
  slab('terrace', [-3, 3], [-22, -17.4], 1.5, 0x9b6bb3),
  // optional detour, 1.4 to the side of the terrace and one step higher
  slab('detour', [4.4, 8], [-21, -17.4], 2.0, 0xf2cc5c),
  slab('bridge', [-1.2, 1.2], [-30, -22], 1.5, 0x5c7aea),
  // gap of 1.3 between z=-30 and z=-31.3
  slab('goal-platform', [-4, 4], [-40, -31.3], 2.0, 0x2ec4b6),
];

const COLLECTIBLE_SPECS: readonly Collectible[] = [
  { id: 'gem-1', position: new Vector3(0, 1.8, -6.5), radius: COLLECTIBLE_RADIUS },
  { id: 'gem-2', position: new Vector3(0, 1.8, -12.5), radius: COLLECTIBLE_RADIUS },
  { id: 'gem-3', position: new Vector3(0, 2.4, -16.7), radius: COLLECTIBLE_RADIUS },
  { id: 'gem-detour', position: new Vector3(6.2, 2.8, -19.2), radius: COLLECTIBLE_RADIUS },
  { id: 'gem-5', position: new Vector3(0, 2.3, -26), radius: COLLECTIBLE_RADIUS },
];

const GOAL_BOX = {
  min: new Vector3(-1.2, 2.0, -37),
  max: new Vector3(1.2, 4.0, -35),
};

export function createLevel(): Level {
  const root = new Group();
  root.name = 'level';

  const colliders: Box3[] = [];
  for (const spec of BLOCKS) {
    const min = new Vector3(...spec.min);
    const max = new Vector3(...spec.max);
    const size = max.clone().sub(min);
    const mesh = new Mesh(
      new BoxGeometry(size.x, size.y, size.z),
      new MeshLambertMaterial({ color: spec.color, emissive: spec.color, emissiveIntensity: 0.25 }),
    );
    mesh.name = `block:${spec.name}`;
    mesh.position.copy(min).add(max).multiplyScalar(0.5);
    root.add(mesh);
    colliders.push(new Box3(min, max));
  }

  const collectibles: Collectible[] = [];
  const visuals = new Map<string, Mesh>();
  for (const spec of COLLECTIBLE_SPECS) {
    const mesh = new Mesh(
      new OctahedronGeometry(spec.radius),
      new MeshBasicMaterial({ color: 0xffe14d }),
    );
    mesh.name = `collectible:${spec.id}`;
    mesh.position.copy(spec.position);
    root.add(mesh);
    visuals.set(spec.id, mesh);
    collectibles.push({
      id: spec.id,
      position: spec.position.clone(),
      radius: spec.radius,
    });
  }

  const goal = new Box3(GOAL_BOX.min.clone(), GOAL_BOX.max.clone());
  const goalSize = goal.getSize(new Vector3());
  const goalMesh = new Mesh(
    new BoxGeometry(goalSize.x, goalSize.y, goalSize.z),
    new MeshBasicMaterial({ color: 0xff5ea8, transparent: true, opacity: 0.45 }),
  );
  goalMesh.name = 'goal';
  goalMesh.position.copy(goal.getCenter(new Vector3()));
  root.add(goalMesh);

  root.updateMatrixWorld(true);

  return {
    root,
    spawn: new Vector3(0, 0, 5),
    colliders,
    collectibles,
    goal,
    collect(id: string) {
      const mesh = visuals.get(id);
      if (mesh) mesh.visible = false;
    },
    reset() {
      for (const mesh of visuals.values()) mesh.visible = true;
    },
  };
}
