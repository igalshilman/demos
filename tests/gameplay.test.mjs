import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCollectibles } from '../src/collectibles/collectibles.js';
import { createGoal } from '../src/goal/goal.js';
import { createHud, formatTime } from '../src/ui/hud.js';

const coinPositions = Array.from({ length: 10 }, (_, i) => ({ x: i * 4, y: i % 3 === 0 ? 2 : 0, z: -i * 3 }));
const world = { coinPositions };

function fakeDocument() {
  const make = (tag) => {
    const listeners = {};
    const el = {
      tag,
      children: [],
      attrs: {},
      style: {},
      hidden: false,
      className: '',
      textContent: '',
      appendChild(c) { el.children.push(c); return c; },
      setAttribute(k, v) { el.attrs[k] = v; },
      addEventListener(t, fn) { (listeners[t] ||= []).push(fn); },
      click() { (listeners.click || []).forEach((fn) => fn({})); },
      focus() { el.focused = true; },
    };
    return el;
  };
  const doc = { createElement: make, head: make('head'), getElementById: () => null };
  return doc;
}

function find(el, hud) {
  if (el.attrs['data-hud'] === hud) return el;
  for (const c of el.children) {
    const r = find(c, hud);
    if (r) return r;
  }
  return null;
}

test('collectibles: total comes from the world and orbs start visible', () => {
  const scene = new THREE.Scene();
  const c = createCollectibles(scene, world);
  assert.equal(c.total, 10);
  assert.equal(c.collected, 0);
  assert.equal(c.isComplete(), false);
  assert.ok(scene.children.includes(c.group));
  assert.equal(c.group.children.length, 10);
});

test('collectibles: spin and bob over time', () => {
  const c = createCollectibles(new THREE.Scene(), world);
  const orb = c.group.children[0];
  const y0 = orb.position.y;
  const r0 = orb.rotation.y;
  c.update(0.3, { x: 999, y: 0, z: 999 });
  assert.notEqual(orb.rotation.y, r0);
  assert.notEqual(orb.position.y, y0);
});

test('collectibles: touching collects and hides, completing all works, reset restores', () => {
  const c = createCollectibles(new THREE.Scene(), world);
  for (const p of coinPositions) {
    c.update(0.016, { x: p.x, y: p.y + 0.9, z: p.z });
  }
  assert.equal(c.collected, 10);
  assert.equal(c.isComplete(), true);
  c.update(0.5, null);
  assert.ok(c.group.children.every((o) => o.visible === false));

  c.reset();
  assert.equal(c.collected, 0);
  assert.equal(c.isComplete(), false);
  assert.ok(c.group.children.every((o) => o.visible === true && o.scale.x === 1));
});

test('collectibles: an orb is collected only once and far players do not collect', () => {
  const c = createCollectibles(new THREE.Scene(), world);
  const p = coinPositions[1];
  c.update(0.016, { x: p.x + 5, y: p.y, z: p.z });
  assert.equal(c.collected, 0);
  c.update(0.016, { x: p.x, y: p.y + 0.9, z: p.z });
  c.update(0.016, { x: p.x, y: p.y + 0.9, z: p.z });
  assert.equal(c.collected, 1);
});

test('collectibles: ground-level orbs are reachable from the ground', () => {
  const c = createCollectibles(new THREE.Scene(), world);
  const p = coinPositions[1];
  c.update(0.016, { x: p.x, y: p.y, z: p.z });
  assert.equal(c.collected, 1);
});

test('goal: dim when locked, bright when unlocked', () => {
  const g = createGoal(new THREE.Scene(), { goalPosition: { x: 1, y: 2, z: 3 } });
  assert.ok(g.position instanceof THREE.Vector3);
  assert.deepEqual(g.position.toArray(), [1, 2, 3]);
  const ring = g.group.children.find((o) => o.geometry instanceof THREE.TorusGeometry);
  g.update(0.1, { x: 50, y: 0, z: 50 }, false);
  const dim = ring.material.emissiveIntensity;
  for (let i = 0; i < 60; i++) g.update(0.05, { x: 50, y: 0, z: 50 }, true);
  assert.ok(ring.material.emissiveIntensity > dim * 5);
});

test('goal: reached only when unlocked and player is nearby', () => {
  const g = createGoal(new THREE.Scene(), { goalPosition: { x: 0, y: 0, z: 0 } });
  const near = { x: 0.5, y: 1, z: 0.5 };
  g.update(0.016, near, false);
  assert.equal(g.reached, false);
  g.update(0.016, { x: 20, y: 0, z: 0 }, true);
  assert.equal(g.reached, false);
  g.update(0.016, near, true);
  assert.equal(g.reached, true);
  g.reset();
  assert.equal(g.reached, false);
  g.update(0.016, near, false);
  assert.equal(g.reached, false);
});

test('hud: formatTime', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65.9), '1:05');
  assert.equal(formatTime(600), '10:00');
  assert.equal(formatTime(-3), '0:00');
});

test('hud: coins, time, controls, win overlay and restart', () => {
  const doc = fakeDocument();
  const root = doc.createElement('div');
  root.ownerDocument = doc;
  const hud = createHud(root);
  assert.ok(root.children.includes(hud.element));

  hud.setCoins(3, 10);
  assert.match(find(hud.element, 'coins').textContent, /3 \/ 10/);
  hud.setTime(125);
  assert.match(find(hud.element, 'time').textContent, /2:05/);
  assert.match(find(hud.element, 'controls').textContent, /WASD/);

  const win = find(hud.element, 'win');
  assert.equal(win.hidden, true);
  hud.showWin(83);
  assert.equal(win.hidden, false);
  assert.match(find(hud.element, 'win-time').textContent, /1:23/);

  let restarts = 0;
  hud.onRestart(() => { restarts += 1; });
  const button = find(hud.element, 'restart');
  assert.equal(button.textContent, 'Play again');
  button.click();
  assert.equal(restarts, 1);

  hud.reset();
  assert.equal(win.hidden, true);
  assert.match(find(hud.element, 'coins').textContent, /0 \/ 10/);
  assert.match(find(hud.element, 'time').textContent, /0:00/);
});
