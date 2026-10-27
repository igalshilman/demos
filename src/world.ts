import {
  BoxGeometry,
  Box3,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import type { WorldData, WorldHandle } from './contracts';

interface PlatformSpec {
  /** [minX, maxX, minZ, maxZ] */
  area: [number, number, number, number];
  top: number;
  coin?: string;
}

const SLAB_THICKNESS = 1.5;
const CAP_THICKNESS = 0.2;
const COIN_HEIGHT = 0.8;
const KILL_DEPTH = 12;

// Listed in route order: a broad start, two wide connecting platforms, a
// turn, then a stepped climb to the finish. Gaps are 1 unit, rises <= 0.75.
const PLATFORMS: PlatformSpec[] = [
  { area: [-4, 4, -4, 4], top: 0, coin: 'coin-1' },
  { area: [5, 10, -3, 3], top: 0.5, coin: 'coin-2' },
  { area: [11, 15, -2.5, 2.5], top: 1, coin: 'coin-3' },
  { area: [16, 20, -2, 2], top: 1.5, coin: 'coin-4' },
  { area: [16, 20, 3, 6], top: 2.25 },
  { area: [16, 20, 7, 10], top: 3, coin: 'coin-5' },
  { area: [16, 20, 11, 14], top: 3.75, coin: 'coin-6' },
  { area: [11, 15, 11, 14], top: 4.5, coin: 'coin-7' },
  { area: [6, 10, 11, 14], top: 5.25, coin: 'coin-8' },
  { area: [-3, 5, 10, 15], top: 6 },
];

const GRASS = new Color('#5fbf5a');
const SOIL = new Color('#8a5a3b');

export function createWorld(): WorldHandle {
  const group = new Group();
  group.name = 'world';

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const track = <T extends BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const unitBox = track(new BoxGeometry(1, 1, 1));
  const soilMaterial = trackMat(new MeshLambertMaterial({ color: SOIL }));
  const grassMaterial = trackMat(new MeshLambertMaterial({ color: GRASS }));
  const coinMaterial = trackMat(new MeshLambertMaterial({ color: '#ffd23f', emissive: '#6b5000' }));
  const coinGeometry = track(new CylinderGeometry(0.3, 0.3, 0.08, 20));
  coinGeometry.rotateX(Math.PI / 2);
  const goalPostMaterial = trackMat(new MeshLambertMaterial({ color: '#f2f2f2' }));
  const goalFlagMaterial = trackMat(new MeshLambertMaterial({ color: '#e63946' }));
  const goalBeamMaterial = trackMat(
    new MeshBasicMaterial({ color: '#7df9ff', transparent: true, opacity: 0.25, depthWrite: false }),
  );
  const goalPostGeometry = track(new CylinderGeometry(0.08, 0.08, 1, 8));
  const goalBeamGeometry = track(new CylinderGeometry(1, 1, 1, 24, 1, true));
  const goalRingGeometry = track(new TorusGeometry(1.1, 0.08, 8, 32));
  goalRingGeometry.rotateX(Math.PI / 2);

  const addBox = (
    name: string,
    box: Box3,
    material: Material,
    parent: Group,
  ): Mesh => {
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const mesh = new Mesh(unitBox, material);
    mesh.name = name;
    mesh.scale.copy(size);
    mesh.position.copy(center);
    parent.add(mesh);
    return mesh;
  };

  const solids: Box3[] = [];
  const coins: WorldData['coins'] = [];
  const coinMeshes = new Map<string, Mesh>();
  const platformGroup = new Group();
  platformGroup.name = 'platforms';
  group.add(platformGroup);
  const coinGroup = new Group();
  coinGroup.name = 'coins';
  group.add(coinGroup);

  PLATFORMS.forEach((spec, index) => {
    const [x0, x1, z0, z1] = spec.area;
    const solid = new Box3(
      new Vector3(x0, spec.top - SLAB_THICKNESS, z0),
      new Vector3(x1, spec.top, z1),
    );
    solids.push(solid);

    // Visuals tile the solid exactly: soil body below a thin grass cap.
    const capBottom = spec.top - CAP_THICKNESS;
    addBox(
      `island-${index}-body`,
      new Box3(solid.min.clone(), new Vector3(x1, capBottom, z1)),
      soilMaterial,
      platformGroup,
    );
    addBox(
      `island-${index}-cap`,
      new Box3(new Vector3(x0, capBottom, z0), solid.max.clone()),
      grassMaterial,
      platformGroup,
    );

    if (spec.coin) {
      const position = new Vector3((x0 + x1) / 2, spec.top + COIN_HEIGHT, (z0 + z1) / 2);
      coins.push({ id: spec.coin, position });
      const mesh = new Mesh(coinGeometry, coinMaterial);
      mesh.name = spec.coin;
      mesh.userData.coinId = spec.coin;
      mesh.position.copy(position);
      coinGroup.add(mesh);
      coinMeshes.set(spec.coin, mesh);
    }
  });

  const finish = PLATFORMS[PLATFORMS.length - 1];
  const [fx0, fx1, fz0, fz1] = finish.area;
  const fcx = (fx0 + fx1) / 2;
  const fcz = (fz0 + fz1) / 2;
  const goal = new Box3(
    new Vector3(fcx - 1.5, finish.top - 0.25, fcz - 1.5),
    new Vector3(fcx + 1.5, finish.top + 4, fcz + 1.5),
  );

  const goalGroup = new Group();
  goalGroup.name = 'goal';
  const beam = new Mesh(goalBeamGeometry, goalBeamMaterial);
  beam.name = 'goal-beam';
  beam.scale.set(1.4, 4, 1.4);
  beam.position.set(fcx, finish.top + 2, fcz);
  goalGroup.add(beam);
  const ring = new Mesh(goalRingGeometry, goalFlagMaterial);
  ring.name = 'goal-ring';
  ring.position.set(fcx, finish.top + 0.1, fcz);
  goalGroup.add(ring);
  const pole = new Mesh(goalPostGeometry, goalPostMaterial);
  pole.name = 'goal-pole';
  pole.scale.set(1, 3.5, 1);
  pole.position.set(fcx, finish.top + 1.75, fcz);
  goalGroup.add(pole);
  const flag = new Mesh(unitBox, goalFlagMaterial);
  flag.name = 'goal-flag';
  flag.scale.set(1.2, 0.8, 0.05);
  flag.position.set(fcx + 0.68, finish.top + 3.1, fcz);
  goalGroup.add(flag);
  group.add(goalGroup);

  const lowest = Math.min(...solids.map((s) => s.min.y));
  const data: WorldData = {
    solids,
    spawn: new Vector3(0, PLATFORMS[0].top, 0),
    killY: lowest - KILL_DEPTH,
    coins,
    goal,
  };

  let disposed = false;

  return {
    group,
    data,
    setCollected(ids: ReadonlySet<string>): void {
      for (const [id, mesh] of coinMeshes) mesh.visible = !ids.has(id);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      for (const g of new Set(geometries)) g.dispose();
      for (const m of new Set(materials)) m.dispose();
    },
  };
}
