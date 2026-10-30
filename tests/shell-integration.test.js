import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createGame, handleResize, MAX_DT } from '../src/main.js';
import { createInput } from '../src/input.js';

class FakeElement {
  constructor(tagName, doc) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this._text = '';
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  click() {
    (this.listeners.click || []).forEach((fn) => fn({ type: 'click' }));
  }
  focus() {}
  find(name) {
    if (this.attributes['data-hud'] === name) return this;
    for (const child of this.children) {
      const found = child.find(name);
      if (found) return found;
    }
    return null;
  }
}

function makeRoot() {
  const doc = { createElement: (tag) => new FakeElement(tag, doc) };
  return new FakeElement('div', doc);
}

function makeCanvas() {
  const canvas = new EventTarget();
  canvas.style = {};
  return canvas;
}

function keyEvent(target, type, code) {
  const event = new Event(type);
  event.code = code;
  target.dispatchEvent(event);
}

describe('app shell with the real modules', () => {
  let keys;
  let input;
  let game;
  let root;
  const text = (name) => root.find(name).textContent;
  const winShown = () => root.find('win').hidden === false;

  const runFrames = (count, dt = 1 / 60) => {
    for (let i = 0; i < count; i += 1) game.step(dt);
  };

  beforeEach(() => {
    keys = new EventTarget();
    input = createInput(keys);
    root = makeRoot();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    game = createGame({
      scene: new THREE.Scene(),
      camera,
      domElement: makeCanvas(),
      hudRoot: root,
      input,
    });
    runFrames(5);
  });

  const collectAll = () => {
    for (const p of game.world.coinPositions) {
      game.player.position.set(p.x, p.y, p.z);
      game.step(1 / 60);
    }
  };

  const goToGoal = () => {
    const g = game.world.goalPosition;
    game.player.position.set(g.x, g.y + 0.05, g.z);
    game.step(1 / 60);
  };

  it('starts up with lights, level, ten orbs, a locked goal and a zeroed HUD', () => {
    const lights = game.scene.children.filter((c) => c.isLight);
    expect(lights.length).toBeGreaterThanOrEqual(2);
    expect(game.collectibles.total).toBe(10);
    expect(game.collectibles.collected).toBe(0);
    expect(game.goal.reached).toBe(false);
    expect(text('coins')).toBe('Orbs: 0 / 10');
    expect(text('time')).toBe('Time: 0:00');
    expect(winShown()).toBe(false);
    expect(game.player.grounded).toBe(true);
    expect(game.camera.position.distanceTo(game.player.position)).toBeGreaterThan(2);
  });

  it('hides the world placeholder goal so only one goal is drawn', () => {
    expect(game.world.group.getObjectByName('goal').visible).toBe(false);
    expect(game.goal.group.visible).toBe(true);
  });

  it('advances frames: timer, camera and world move, and dt is capped', () => {
    const before = game.elapsed;
    const camBefore = game.camera.position.clone();
    keyEvent(keys, 'keydown', 'KeyW');
    const startZ = game.player.position.z;
    runFrames(30);
    expect(game.elapsed).toBeGreaterThan(before);
    expect(game.player.position.z).toBeLessThan(startZ - 1);
    expect(game.camera.position.distanceTo(camBefore)).toBeGreaterThan(0.1);

    const t = game.elapsed;
    game.step(5);
    expect(game.elapsed - t).toBeCloseTo(MAX_DT, 6);
    game.step(-1);
    game.step(NaN);
    expect(game.elapsed - t).toBeCloseTo(MAX_DT, 6);
  });

  it('keeps moving forward when W is released but ArrowUp is still held', () => {
    keyEvent(keys, 'keydown', 'KeyW');
    keyEvent(keys, 'keydown', 'ArrowUp');
    keyEvent(keys, 'keyup', 'KeyW');
    const z = game.player.position.z;
    runFrames(20);
    expect(game.player.position.z).toBeLessThan(z - 1);
  });

  it('jumps on space', () => {
    runFrames(5);
    const y = game.player.position.y;
    keyEvent(keys, 'keydown', 'Space');
    runFrames(6);
    expect(game.player.position.y).toBeGreaterThan(y + 0.3);
  });

  it('counts orbs on the HUD and unlocks the goal only when all are collected', () => {
    goToGoal();
    expect(game.goal.reached).toBe(false);
    expect(winShown()).toBe(false);

    const [first, ...rest] = game.world.coinPositions;
    game.player.position.set(first.x, first.y, first.z);
    game.step(1 / 60);
    expect(text('coins')).toBe('Orbs: 1 / 10');

    for (const p of rest) {
      game.player.position.set(p.x, p.y, p.z);
      game.step(1 / 60);
    }
    expect(game.collectibles.isComplete()).toBe(true);
    expect(text('coins')).toBe('Orbs: 10 / 10');
    expect(game.goal.unlocked).toBe(true);
  });

  it('shows the win panel and freezes the timer after reaching the goal', () => {
    collectAll();
    runFrames(10);
    goToGoal();
    expect(game.goal.reached).toBe(true);
    expect(game.won).toBe(true);
    expect(winShown()).toBe(true);

    const frozen = game.elapsed;
    const shownTime = text('time');
    runFrames(120);
    expect(game.elapsed).toBe(frozen);
    expect(text('time')).toBe(shownTime);
  });

  it('restarts from the HUD button after a win', () => {
    collectAll();
    goToGoal();
    expect(winShown()).toBe(true);

    root.find('restart').click();
    expect(game.won).toBe(false);
    expect(game.elapsed).toBe(0);
    expect(game.collectibles.collected).toBe(0);
    expect(game.goal.reached).toBe(false);
    expect(game.player.position.distanceTo(game.world.spawn)).toBeLessThan(1e-6);
    expect(winShown()).toBe(false);
    expect(text('coins')).toBe('Orbs: 0 / 10');
    expect(text('time')).toBe('Time: 0:00');

    runFrames(30);
    expect(game.elapsed).toBeGreaterThan(0);
    expect(game.won).toBe(false);
  });

  it('restarts mid-run with the R key', () => {
    keyEvent(keys, 'keydown', 'KeyW');
    runFrames(40);
    const first = game.world.coinPositions[0];
    game.player.position.set(first.x, first.y, first.z);
    game.step(1 / 60);
    expect(game.collectibles.collected).toBe(1);
    keyEvent(keys, 'keyup', 'KeyW');

    keyEvent(keys, 'keydown', 'KeyR');
    game.step(0);
    expect(game.collectibles.collected).toBe(0);
    expect(game.elapsed).toBe(0);
    expect(game.player.position.distanceTo(game.world.spawn)).toBeLessThan(1e-6);
    expect(text('coins')).toBe('Orbs: 0 / 10');
  });
});

describe('resize', () => {
  it('updates the camera aspect and the renderer size and pixel ratio', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
    const calls = [];
    const renderer = {
      setSize: (w, h) => calls.push(['size', w, h]),
      setPixelRatio: (r) => calls.push(['ratio', r]),
    };
    handleResize(camera, renderer, 1200, 600, 3);
    expect(camera.aspect).toBeCloseTo(2);
    expect(camera.projectionMatrix.elements[0]).toBeCloseTo(
      camera.projectionMatrix.elements[5] / 2,
    );
    expect(calls).toContainEqual(['size', 1200, 600]);
    expect(calls).toContainEqual(['ratio', 2]);
    handleResize(camera, renderer, 500, 0, 1);
    expect(Number.isFinite(camera.aspect)).toBe(true);
  });
});
