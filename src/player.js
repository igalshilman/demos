import * as THREE from 'three';
import { createPlayerPhysics, PLAYER_HEIGHT, PLAYER_RADIUS, RUN_SPEED } from './player-physics.js';

const TURN_RATE = 14;
const RUN_CYCLE_RATE = 2.2;

function createCharacter() {
  const geometries = [];
  const materials = [];

  const geo = (g) => {
    geometries.push(g);
    return g;
  };
  const mat = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0.05, ...extra });
    materials.push(m);
    return m;
  };

  const teal = mat(0x2bb5a6);
  const cream = mat(0xf3e6c8);
  const coral = mat(0xf2705a);
  const dark = mat(0x2a2f4a);
  const glow = mat(0xffe27a, { emissive: 0xffc933, emissiveIntensity: 0.6 });

  const mesh = (g, m, parent, x, y, z) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  // The "model" faces +Z and holds all animation, so the outer group's
  // origin stays at the foot centre and matches the physics body exactly.
  const model = new THREE.Group();

  const body = new THREE.Group();
  model.add(body);
  mesh(geo(new THREE.CylinderGeometry(0.24, 0.2, 0.46, 8)), teal, body, 0, 0.74, 0);
  mesh(geo(new THREE.CylinderGeometry(0.245, 0.245, 0.08, 8)), coral, body, 0, 0.6, 0);
  mesh(geo(new THREE.BoxGeometry(0.28, 0.34, 0.12)), cream, body, 0, 0.78, -0.25);

  const head = new THREE.Group();
  head.position.set(0, 1.1, 0);
  body.add(head);
  mesh(geo(new THREE.IcosahedronGeometry(0.255, 0)), cream, head, 0, 0.0, 0);
  mesh(geo(new THREE.BoxGeometry(0.3, 0.14, 0.1)), dark, head, 0, 0.02, 0.2);
  mesh(geo(new THREE.BoxGeometry(0.05, 0.05, 0.02)), glow, head, -0.07, 0.02, 0.255);
  mesh(geo(new THREE.BoxGeometry(0.05, 0.05, 0.02)), glow, head, 0.07, 0.02, 0.255);
  mesh(geo(new THREE.ConeGeometry(0.06, 0.12, 5)), coral, head, 0, 0.225, -0.02);

  const makeLimb = (x, y, length, radius, material, footMaterial) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    body.add(pivot);
    mesh(geo(new THREE.CylinderGeometry(radius, radius * 0.9, length, 6)), material, pivot, 0, -length / 2, 0);
    if (footMaterial) {
      mesh(geo(new THREE.BoxGeometry(0.17, 0.12, 0.28)), footMaterial, pivot, 0, -length - 0.04, 0.04);
    }
    return pivot;
  };

  const legL = makeLimb(-0.11, 0.52, 0.34, 0.07, dark, coral);
  const legR = makeLimb(0.11, 0.52, 0.34, 0.07, dark, coral);
  const armL = makeLimb(-0.28, 0.9, 0.3, 0.06, cream);
  const armR = makeLimb(0.28, 0.9, 0.3, 0.06, cream);

  return { model, body, head, legL, legR, armL, armR, geometries, materials };
}

/**
 * @param {{platforms: Array, spawn: {x:number,y:number,z:number}}} options
 */
export function createPlayer({ platforms = [], spawn = { x: 0, y: 0, z: 0 } } = {}) {
  const character = createCharacter();
  const group = new THREE.Group();
  group.name = 'player';
  group.add(character.model);
  group.userData.radius = PLAYER_RADIUS;
  group.userData.height = PLAYER_HEIGHT;

  const physics = createPlayerPhysics({ platforms, spawn, position: group.position });
  const position = group.position;

  let facing = 0;
  let runPhase = 0;
  let lean = 0;
  let wasGrounded = physics.grounded;
  let landSquash = 0;
  let disposed = false;
  // Cosmetic idle clock only; never used by physics.
  let clock = 0;

  function animate(dt) {
    const { velocity } = physics;
    const speed = Math.hypot(velocity.x, velocity.z);

    if (speed > 0.3) {
      const target = Math.atan2(velocity.x, velocity.z);
      let delta = target - facing;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      facing += delta * Math.min(1, TURN_RATE * dt);
    }

    const grounded = physics.grounded;
    if (grounded && !wasGrounded) landSquash = 1;
    wasGrounded = grounded;
    landSquash = Math.max(0, landSquash - dt * 6);

    const c = character;
    const run = Math.min(1, speed / RUN_SPEED);
    runPhase += dt * RUN_CYCLE_RATE * Math.PI * 2 * run * (grounded ? 1 : 0.3);
    const swing = Math.sin(runPhase) * 0.9 * run;
    const idleBreath = Math.sin(clock * 3) * 0.02;

    lean += ((grounded ? run * 0.18 : 0.1) - lean) * Math.min(1, 10 * dt);

    c.model.rotation.y = facing;
    c.body.rotation.x = lean;
    c.body.position.y = grounded ? Math.abs(Math.sin(runPhase)) * 0.05 * run + idleBreath * (1 - run) : 0;

    if (grounded) {
      c.legL.rotation.x = swing;
      c.legR.rotation.x = -swing;
      c.armL.rotation.x = -swing * 0.8;
      c.armR.rotation.x = swing * 0.8;
    } else {
      const rising = velocity.y > 0;
      c.legL.rotation.x = rising ? -0.5 : 0.3;
      c.legR.rotation.x = rising ? 0.4 : -0.2;
      c.armL.rotation.x = rising ? -2.6 : -1.2;
      c.armR.rotation.x = rising ? -2.6 : -1.2;
    }

    const stretch = grounded ? 0 : Math.max(-0.1, Math.min(0.12, velocity.y * 0.012));
    const squash = landSquash * 0.12;
    c.model.scale.set(1 - stretch * 0.5 + squash * 0.6, 1 + stretch - squash, 1 - stretch * 0.5 + squash * 0.6);
  }

  function step(dt, input) {
    if (disposed) return;
    physics.step(dt, input);
    if (typeof dt === 'number' && dt > 0) {
      const visualDt = Math.min(dt, 0.1);
      clock += visualDt;
      animate(visualDt);
    }
  }

  function reset(p) {
    physics.reset(p ?? spawn);
    wasGrounded = physics.grounded;
    landSquash = 0;
    lean = 0;
    runPhase = 0;
    character.model.scale.set(1, 1, 1);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const g of character.geometries) g.dispose();
    for (const m of character.materials) m.dispose();
  }

  return {
    group,
    position,
    get grounded() {
      return physics.grounded;
    },
    step,
    reset,
    dispose,
  };
}
