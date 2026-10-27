import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameState, formatTime } from '../src/game-state.js';

const coins = [
  { id: 'a', position: { x: 0, y: 1, z: 0 }, radius: 0.4 },
  { id: 'b', position: { x: 5, y: 1, z: 0 }, radius: 0.4 },
];
const goal = { position: { x: 10, y: 0, z: 0 }, radius: 1 };
const make = () => createGameState({ coins, goal, killY: -10 });

test('collects a token when the body center is within radius plus body radius', () => {
  const s = make();
  // body center at y = 0.7; coin at y=1 -> distance 0.3 along y
  const ev = s.update({ x: 0, y: 0, z: 0 }, 0.016);
  assert.deepEqual(ev.collected, ['a']);
  assert.equal(s.collectedCount, 1);
  assert.ok(s.isCollected('a'));
});

test('does not collect tokens that are out of range', () => {
  const s = make();
  // center distance to coin a: horizontal 0.76 > 0.75
  const ev = s.update({ x: 0.76, y: 0.3, z: 0 }, 0.016);
  assert.deepEqual(ev.collected, []);
  assert.equal(s.collectedCount, 0);
});

test('collects each token only once', () => {
  const s = make();
  s.update({ x: 0, y: 0, z: 0 }, 0.016);
  const ev = s.update({ x: 0, y: 0, z: 0 }, 0.016);
  assert.deepEqual(ev.collected, []);
  assert.equal(s.collectedCount, 1);
});

test('goal is gated until every token is collected', () => {
  const s = make();
  assert.equal(s.goalUnlocked, false);
  let ev = s.update({ x: 10, y: 0, z: 0 }, 0.016);
  assert.equal(ev.won, false);
  assert.equal(s.status, 'playing');

  s.update({ x: 0, y: 0, z: 0 }, 0.016);
  assert.equal(s.goalUnlocked, false);
  s.update({ x: 5, y: 0, z: 0 }, 0.016);
  assert.equal(s.goalUnlocked, true);

  ev = s.update({ x: 11.5, y: 0, z: 0 }, 0.016);
  assert.equal(ev.won, false);
  ev = s.update({ x: 10.5, y: 0, z: 0 }, 0.016);
  assert.equal(ev.won, true);
  assert.equal(s.status, 'won');
});

test('timer stops once the game is won', () => {
  const s = make();
  s.update({ x: 0, y: 0, z: 0 }, 1);
  s.update({ x: 5, y: 0, z: 0 }, 1);
  s.update({ x: 10, y: 0, z: 0 }, 1);
  const t = s.elapsed;
  s.update({ x: 10, y: 0, z: 0 }, 5);
  assert.equal(s.elapsed, t);
});

test('falling below killY reports a fall and preserves collected tokens', () => {
  const s = make();
  s.update({ x: 0, y: 0, z: 0 }, 0.016);
  const ev = s.update({ x: 3, y: -10.5, z: 0 }, 0.016);
  assert.equal(ev.fell, true);
  assert.equal(s.falls, 1);
  assert.equal(s.collectedCount, 1);
  assert.equal(s.status, 'playing');
});

test('a fall does not collect tokens or win', () => {
  const s = make();
  const ev = s.update({ x: 0, y: -11, z: 0 }, 0.016);
  assert.equal(ev.fell, true);
  assert.deepEqual(ev.collected, []);
});

test('restart clears tokens, timer, falls and victory', () => {
  const s = make();
  s.update({ x: 0, y: 0, z: 0 }, 1);
  s.update({ x: 5, y: 0, z: 0 }, 1);
  s.update({ x: 10, y: 0, z: 0 }, 1);
  s.update({ x: 0, y: -50, z: 0 }, 1);
  assert.equal(s.won, true);
  s.restart();
  assert.equal(s.status, 'playing');
  assert.equal(s.collectedCount, 0);
  assert.equal(s.elapsed, 0);
  assert.equal(s.falls, 0);
  assert.equal(s.isCollected('a'), false);
  const ev = s.update({ x: 0, y: 0, z: 0 }, 0.016);
  assert.deepEqual(ev.collected, ['a']);
});

test('formatTime renders mm:ss.t', () => {
  assert.equal(formatTime(0), '00:00.0');
  assert.equal(formatTime(65.43), '01:05.4');
});
