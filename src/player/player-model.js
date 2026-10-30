import * as THREE from 'three';

const TEAL = 0x1fb5a6;
const DARK_TEAL = 0x138a7f;
const ORANGE = 0xff8a2b;
const VISOR_GLASS = 0x1b2b36;

function mesh(geometry, color, options = {}) {
  const m = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...options }),
  );
  m.castShadow = true;
  m.receiveShadow = false;
  return m;
}

/**
 * Pip: a round teal explorer with an orange visor, antenna and feet.
 * The model's origin is at the feet; it faces -z and stands 1.8 tall.
 */
export function createPlayerModel() {
  const root = new THREE.Group();
  root.name = 'Pip';

  const body = new THREE.Group();
  body.name = 'PipBody';
  root.add(body);

  const torso = mesh(new THREE.SphereGeometry(0.62, 24, 18), TEAL);
  torso.scale.set(1, 1.05, 0.95);
  torso.position.y = 0.95;
  body.add(torso);

  const belly = mesh(new THREE.SphereGeometry(0.4, 16, 12), DARK_TEAL);
  belly.scale.set(1, 0.9, 0.5);
  belly.position.set(0, 0.8, -0.42);
  body.add(belly);

  const head = new THREE.Group();
  head.name = 'PipHead';
  head.position.y = 1.35;
  body.add(head);

  const dome = mesh(new THREE.SphereGeometry(0.42, 24, 18), TEAL);
  head.add(dome);

  const visor = mesh(new THREE.SphereGeometry(0.34, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), ORANGE);
  visor.scale.set(1.05, 0.7, 0.8);
  visor.rotation.x = -Math.PI / 2;
  visor.position.set(0, 0.02, -0.26);
  head.add(visor);

  const glass = mesh(new THREE.SphereGeometry(0.27, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), VISOR_GLASS, {
    roughness: 0.15,
    metalness: 0.4,
  });
  glass.scale.set(1.05, 0.55, 0.6);
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(0, 0.02, -0.32);
  head.add(glass);

  const stalk = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), DARK_TEAL);
  stalk.position.y = 0.52;
  head.add(stalk);

  const antennaTip = mesh(new THREE.SphereGeometry(0.07, 12, 10), ORANGE, {
    emissive: ORANGE,
    emissiveIntensity: 0.35,
  });
  antennaTip.position.y = 0.7;
  head.add(antennaTip);

  const armGeometry = new THREE.SphereGeometry(0.16, 12, 10);
  const armL = mesh(armGeometry, DARK_TEAL);
  const armR = mesh(armGeometry, DARK_TEAL);
  armL.scale.set(0.8, 1.5, 0.8);
  armR.scale.copy(armL.scale);
  const shoulderL = new THREE.Group();
  const shoulderR = new THREE.Group();
  shoulderL.position.set(-0.62, 1.1, 0);
  shoulderR.position.set(0.62, 1.1, 0);
  armL.position.y = -0.2;
  armR.position.y = -0.2;
  shoulderL.add(armL);
  shoulderR.add(armR);
  body.add(shoulderL, shoulderR);

  const footGeometry = new THREE.SphereGeometry(0.2, 14, 10);
  const footL = mesh(footGeometry, ORANGE);
  const footR = mesh(footGeometry, ORANGE);
  footL.scale.set(1, 0.65, 1.4);
  footR.scale.copy(footL.scale);
  const hipL = new THREE.Group();
  const hipR = new THREE.Group();
  hipL.position.set(-0.25, 0.3, 0);
  hipR.position.set(0.25, 0.3, 0);
  footL.position.set(0, -0.13, -0.05);
  footR.position.set(0, -0.13, -0.05);
  hipL.add(footL);
  hipR.add(footR);
  root.add(hipL, hipR);

  return {
    root,
    parts: { body, head, antennaTip, shoulderL, shoulderR, hipL, hipR },
  };
}

/**
 * Drives the walking animation. Call every frame with the planar speed (units/s),
 * whether Pip is grounded, and the vertical velocity.
 */
export function createPlayerAnimator(model) {
  const { body, head, antennaTip, shoulderL, shoulderR, hipL, hipR } = model.parts;
  let phase = 0;
  let blend = 0;

  function update(dt, planarSpeed, grounded, verticalVelocity = 0) {
    const targetBlend = grounded ? Math.min(planarSpeed / 8, 1) : 0;
    blend += (targetBlend - blend) * Math.min(1, dt * 14);
    phase += dt * (6 + planarSpeed * 0.9) * (grounded ? 1 : 0.2);

    const swing = Math.sin(phase);
    const stride = 0.7 * blend;

    hipL.rotation.x = swing * stride;
    hipR.rotation.x = -swing * stride;
    shoulderL.rotation.x = -swing * stride * 0.9;
    shoulderR.rotation.x = swing * stride * 0.9;

    const bob = Math.abs(Math.cos(phase)) * 0.07 * blend;
    const idle = Math.sin(performance.now ? performance.now() / 500 : phase) * 0.01 * (1 - blend);
    let squashY = 1;
    if (!grounded) squashY = 1 + THREE.MathUtils.clamp(verticalVelocity / 12, -1, 1) * 0.08;
    body.position.y = bob + idle;
    body.scale.set(1 / Math.sqrt(squashY), squashY, 1 / Math.sqrt(squashY));

    body.rotation.x = -0.12 * blend;
    head.rotation.z = Math.sin(phase * 0.5) * 0.05 * blend;
    antennaTip.position.x = Math.sin(phase * 1.3) * 0.05 * blend;

    if (!grounded) {
      const lift = THREE.MathUtils.clamp(-verticalVelocity / 20, -0.4, 0.4);
      shoulderL.rotation.z = -0.6 + lift;
      shoulderR.rotation.z = 0.6 - lift;
      hipL.rotation.x = 0.3;
      hipR.rotation.x = -0.2;
    } else {
      shoulderL.rotation.z = 0;
      shoulderR.rotation.z = 0;
    }
  }

  function reset() {
    phase = 0;
    blend = 0;
  }

  return { update, reset };
}
