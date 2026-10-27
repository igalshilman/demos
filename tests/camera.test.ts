import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { createCameraRig } from '../src/camera';

const make = () => {
  const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 200);
  return { camera, rig: createCameraRig(camera) };
};

describe('camera rig', () => {
  it('reset snaps ~7 behind and 5 above for yaw 0', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(10, 2, 3), 0);
    expect(camera.position.x).toBeCloseTo(10, 6);
    expect(camera.position.y).toBeCloseTo(7, 6);
    expect(camera.position.z).toBeCloseTo(10, 6);
  });

  it('places the camera behind the player for any yaw', () => {
    const { camera, rig } = make();
    const pos = new Vector3(0, 0, 0);
    rig.reset(pos, Math.PI / 2);
    // yaw +90deg looks toward -X (contract), so the camera sits at +X
    expect(camera.position.x).toBeCloseTo(7, 6);
    expect(camera.position.z).toBeCloseTo(0, 6);
    rig.reset(pos, Math.PI);
    expect(camera.position.z).toBeCloseTo(-7, 6);
  });

  it('looks at the chest, along the same yaw', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(0, 0, 0), Math.PI / 2);
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    expect(dir.x).toBeLessThan(-0.8);
    expect(Math.abs(dir.z)).toBeLessThan(1e-6);
    expect(dir.y).toBeLessThan(0);
    const target = camera.position.clone().addScaledVector(dir, camera.position.distanceTo(new Vector3(0, 1.1, 0)));
    expect(target.distanceTo(new Vector3(0, 1.1, 0))).toBeLessThan(1e-6);
  });

  it('smooths follow movement instead of snapping', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(0, 0, 0), 0);
    rig.update(1 / 60, new Vector3(10, 0, 0), 0);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.x).toBeLessThan(10);
  });

  it('converges to the follow position and yaw', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(0, 0, 0), 0);
    for (let i = 0; i < 600; i++) rig.update(1 / 60, new Vector3(10, 0, -4), Math.PI / 2);
    expect(camera.position.x).toBeCloseTo(10 + 7, 3);
    expect(camera.position.y).toBeCloseTo(5, 3);
    expect(camera.position.z).toBeCloseTo(-4, 3);
  });

  it('turns by the shortest path across the +/-PI seam', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(), Math.PI - 0.1);
    rig.update(1 / 60, new Vector3(), -Math.PI + 0.1);
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    // short way keeps the view pointed near -Z (yaw PI), never swinging through +Z
    expect(dir.z).toBeGreaterThan(0.3);
  });

  it('is frame-rate independent', () => {
    const a = make();
    const b = make();
    a.rig.reset(new Vector3(), 0);
    b.rig.reset(new Vector3(), 0);
    const target = new Vector3(6, 0, 0);
    for (let i = 0; i < 60; i++) a.rig.update(1 / 60, target, 1);
    for (let i = 0; i < 30; i++) b.rig.update(1 / 30, target, 1);
    expect(a.camera.position.x).toBeCloseTo(b.camera.position.x, 3);
    expect(a.camera.position.z).toBeCloseTo(b.camera.position.z, 3);
  });

  it('keeps zero, negative and non-finite dt safe', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(), 0);
    const before = camera.position.clone();
    for (const dt of [0, -1, NaN, Infinity]) rig.update(dt, new Vector3(5, 0, 0), 0);
    expect(camera.position.x).toBeCloseTo(before.x, 6);
    expect(Number.isFinite(camera.position.length())).toBe(true);
  });

  it('bounds huge dt and stays finite', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(), 0);
    rig.update(1000, new Vector3(5, 0, 0), 0.5);
    expect(Number.isFinite(camera.position.length())).toBe(true);
  });

  it('reset after movement is immediate and discards smoothing', () => {
    const { camera, rig } = make();
    rig.reset(new Vector3(), 0);
    for (let i = 0; i < 10; i++) rig.update(1 / 60, new Vector3(50, 0, 0), 2);
    rig.reset(new Vector3(-3, 1, 8), 0);
    expect(camera.position.x).toBeCloseTo(-3, 6);
    expect(camera.position.y).toBeCloseTo(6, 6);
    expect(camera.position.z).toBeCloseTo(15, 6);
  });

  it('does not retain or mutate the passed-in position', () => {
    const { rig } = make();
    const p = new Vector3(1, 2, 3);
    rig.reset(p, 0);
    rig.update(1 / 60, p, 0);
    expect(p.toArray()).toEqual([1, 2, 3]);
  });
});
