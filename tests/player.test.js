import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPlayer } from '../src/player.js';

const FLOOR = new THREE.Box3(new THREE.Vector3(-50, -1, -50), new THREE.Vector3(50, 0, 50));
const idle = { move: new THREE.Vector3(), jump: false };

function make(solids = [FLOOR], spawn = new THREE.Vector3(0, 0, 0)) {
  const scene = new THREE.Scene();
  const player = createPlayer(scene, { spawn, solids });
  return { scene, player };
}

function run(player, seconds, input, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) player.update(dt, input);
}

function settle(player) {
  run(player, 0.5, idle);
}

describe('player', () => {
  it('starts at the spawn point and adds itself to the scene', () => {
    const { scene, player } = make([FLOOR], new THREE.Vector3(1, 0, 2));
    expect(player.position.toArray()).toEqual([1, 0, 2]);
    expect(scene.children.length).toBe(1);
  });

  it('walks at speed 6', () => {
    const { player } = make();
    settle(player);
    const x0 = player.position.x;
    run(player, 1, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(player.position.x - x0).toBeCloseTo(6, 3);
    expect(player.position.y).toBeCloseTo(0, 5);
    expect(player.grounded).toBe(true);
  });

  it('does not move faster diagonally or with oversized input', () => {
    const { player } = make();
    settle(player);
    const start = player.position.clone();
    run(player, 1, { move: new THREE.Vector3(1, 0, 1), jump: false });
    const dist = Math.hypot(player.position.x - start.x, player.position.z - start.z);
    expect(dist).toBeCloseTo(6, 3);
    expect(player.position.x - start.x).toBeCloseTo(player.position.z - start.z, 5);
  });

  it('lands on the floor and becomes grounded', () => {
    const { player } = make([FLOOR], new THREE.Vector3(0, 5, 0));
    player.update(1 / 60, idle);
    expect(player.grounded).toBe(false);
    run(player, 2, idle);
    expect(player.position.y).toBeCloseTo(0, 5);
    expect(player.grounded).toBe(true);
  });

  it('jumps with speed 9 and reaches the expected apex', () => {
    const { player } = make();
    settle(player);
    player.update(1 / 60, { move: new THREE.Vector3(), jump: true });
    expect(player.grounded).toBe(false);
    let apex = 0;
    for (let i = 0; i < 120; i++) {
      player.update(1 / 60, idle);
      apex = Math.max(apex, player.position.y);
    }
    expect(apex).toBeGreaterThan(1.6);
    expect(apex).toBeLessThan(1.75);
    expect(player.position.y).toBeCloseTo(0, 5);
    expect(player.grounded).toBe(true);
  });

  it('rejects jumps in midair', () => {
    const { player } = make();
    settle(player);
    player.update(1 / 60, { move: new THREE.Vector3(), jump: true });
    run(player, 0.2, idle);
    // Pressing jump repeatedly in the air must not extend the single-jump arc.
    let apex = player.position.y;
    for (let i = 0; i < 120; i++) {
      player.update(1 / 60, { move: new THREE.Vector3(), jump: true });
      apex = Math.max(apex, player.position.y);
    }
    expect(apex).toBeLessThan(1.75);
  });

  it('rejects a jump when falling off the ground from spawn in the air', () => {
    const { player } = make([FLOOR], new THREE.Vector3(0, 5, 0));
    player.update(1 / 60, { move: new THREE.Vector3(), jump: true });
    expect(player.position.y).toBeLessThan(5);
  });

  it('is blocked by walls and does not enter them', () => {
    const wall = new THREE.Box3(new THREE.Vector3(3, 0, -5), new THREE.Vector3(4, 5, 5));
    const { player } = make([FLOOR, wall]);
    settle(player);
    run(player, 2, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(player.position.x).toBeCloseTo(3 - 0.35, 4);
    run(player, 1, { move: new THREE.Vector3(-1, 0, 0), jump: false });
    expect(player.position.x).toBeLessThan(0);
  });

  it('slides along a wall while moving diagonally', () => {
    const wall = new THREE.Box3(new THREE.Vector3(3, 0, -50), new THREE.Vector3(4, 5, 50));
    const { player } = make([FLOOR, wall]);
    settle(player);
    run(player, 1, { move: new THREE.Vector3(1, 0, 1), jump: false });
    run(player, 1, { move: new THREE.Vector3(1, 0, 1), jump: false });
    expect(player.position.x).toBeCloseTo(3 - 0.35, 4);
    expect(player.position.z).toBeGreaterThan(5);
  });

  it('stops against a ceiling and falls back down', () => {
    const ceiling = new THREE.Box3(new THREE.Vector3(-5, 2.5, -5), new THREE.Vector3(5, 3, 5));
    const { player } = make([FLOOR, ceiling]);
    settle(player);
    player.update(1 / 60, { move: new THREE.Vector3(), jump: true });
    let maxTop = 0;
    for (let i = 0; i < 20; i++) {
      player.update(1 / 60, idle);
      maxTop = Math.max(maxTop, player.position.y + 1.6);
    }
    expect(maxTop).toBeLessThanOrEqual(2.5 + 1e-6);
    expect(maxTop).toBeGreaterThan(2.4);
    run(player, 2, idle);
    expect(player.position.y).toBeCloseTo(0, 5);
    expect(player.grounded).toBe(true);
  });

  it('can land on and stand on a raised platform', () => {
    const platform = new THREE.Box3(new THREE.Vector3(2, 0, -2), new THREE.Vector3(5, 1, 2));
    const { player } = make([FLOOR, platform], new THREE.Vector3(3, 4, 0));
    run(player, 2, idle);
    expect(player.position.y).toBeCloseTo(1, 5);
    expect(player.grounded).toBe(true);
  });

  it('does not tunnel through thin floors with a huge frame delta', () => {
    const thin = new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 0.2, 5));
    const { player } = make([thin], new THREE.Vector3(0, 10, 0));
    player.update(10, idle);
    expect(player.position.y).toBeGreaterThanOrEqual(0.2 - 1e-6);
    run(player, 3, idle);
    expect(player.position.y).toBeCloseTo(0.2, 5);
    expect(player.grounded).toBe(true);
  });

  it('clamps large deltas so walking does not teleport', () => {
    const { player } = make();
    settle(player);
    const x0 = player.position.x;
    player.update(5, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(player.position.x - x0).toBeLessThan(1);
    const wall = new THREE.Box3(new THREE.Vector3(1, 0, -5), new THREE.Vector3(1.2, 5, 5));
    const other = make([FLOOR, wall]);
    settle(other.player);
    other.player.update(5, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(other.player.position.x).toBeLessThanOrEqual(1 - 0.35 + 1e-6);
  });

  it('reset restores spawn and clears velocity', () => {
    const { player } = make([FLOOR], new THREE.Vector3(0, 0, 0));
    const ref = player.position;
    settle(player);
    player.update(1 / 60, { move: new THREE.Vector3(1, 0, 0), jump: true });
    run(player, 0.2, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(player.position.x).toBeGreaterThan(0.5);
    player.reset();
    expect(player.position).toBe(ref);
    expect(player.position.toArray()).toEqual([0, 0, 0]);
    // Velocity cleared: with no input it falls from rest, not upward.
    player.update(1 / 60, idle);
    expect(player.position.x).toBe(0);
    expect(player.position.y).toBeLessThanOrEqual(0);
  });

  it('faces its movement direction', () => {
    const { scene, player } = make();
    settle(player);
    run(player, 1, { move: new THREE.Vector3(1, 0, 0), jump: false });
    expect(scene.children[0].rotation.y).toBeCloseTo(Math.PI / 2, 2);
  });

  it('dispose removes the character from the scene', () => {
    const { scene, player } = make();
    player.dispose();
    expect(scene.children.length).toBe(0);
  });
});
