import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVEL, PLAYER, LIMITS } from '../src/level-data.js';

const byId = new Map(LEVEL.platforms.map((p) => [p.id, p]));
const top = (p) => p.max.y;

function gap(a, b) {
  const dx = Math.max(0, b.min.x - a.max.x, a.min.x - b.max.x);
  const dz = Math.max(0, b.min.z - a.max.z, a.min.z - b.max.z);
  return Math.hypot(dx, dz);
}

function insideFootprint(p, point, margin = 0) {
  return (
    point.x >= p.min.x + margin &&
    point.x <= p.max.x - margin &&
    point.z >= p.min.z + margin &&
    point.z <= p.max.z - margin
  );
}

function supportOf(point, margin = 0) {
  return LEVEL.platforms.find((p) => insideFootprint(p, point, margin));
}

test('platform count and ids are sensible', () => {
  assert.ok(LEVEL.platforms.length >= 6 && LEVEL.platforms.length <= 10);
  assert.equal(byId.size, LEVEL.platforms.length, 'platform ids must be unique');
  for (const p of LEVEL.platforms) assert.ok(typeof p.id === 'string' && p.id.length > 0);
});

test('platform boxes are valid and large enough', () => {
  for (const p of LEVEL.platforms) {
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Number.isFinite(p.min[axis]) && Number.isFinite(p.max[axis]), `${p.id} ${axis} finite`);
      assert.ok(p.max[axis] > p.min[axis], `${p.id} ${axis} has positive extent`);
    }
    assert.ok(p.max.x - p.min.x >= LIMITS.minSize, `${p.id} width`);
    assert.ok(p.max.z - p.min.z >= LIMITS.minSize, `${p.id} depth`);
  }
});

test('platforms do not overlap each other', () => {
  const list = LEVEL.platforms;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const overlap =
        a.min.x < b.max.x && a.max.x > b.min.x &&
        a.min.y < b.max.y && a.max.y > b.min.y &&
        a.min.z < b.max.z && a.max.z > b.min.z;
      assert.equal(overlap, false, `${a.id} overlaps ${b.id}`);
    }
  }
});

test('start island is broad with top at y=0 and spawn is safely supported', () => {
  const start = byId.get('start');
  assert.equal(top(start), 0);
  assert.ok(start.max.x - start.min.x >= 8 && start.max.z - start.min.z >= 8);
  assert.equal(LEVEL.spawn.y, top(start));
  assert.ok(insideFootprint(start, LEVEL.spawn, PLAYER.radius + 1.5), 'spawn well inside the start island');
  assert.equal(LEVEL.route[0], 'start');
});

test('killY is below the whole course', () => {
  const lowest = Math.min(...LEVEL.platforms.map((p) => p.min.y));
  assert.ok(LEVEL.killY < lowest - 5);
});

test('route is explicit, uses known platforms, and visits each once', () => {
  assert.equal(new Set(LEVEL.route).size, LEVEL.route.length);
  for (const id of LEVEL.route) assert.ok(byId.has(id), `unknown route id ${id}`);
  assert.equal(LEVEL.route.length, LEVEL.platforms.length, 'every platform is on the route');
});

test('route gaps and rises are within player ability', () => {
  const maxJumpHeight = (PLAYER.jump * PLAYER.jump) / (2 * PLAYER.gravity);
  assert.ok(LIMITS.maxRise < maxJumpHeight);
  for (let i = 1; i < LEVEL.route.length; i++) {
    const a = byId.get(LEVEL.route[i - 1]);
    const b = byId.get(LEVEL.route[i]);
    const g = gap(a, b);
    const rise = top(b) - top(a);
    assert.ok(g > 0, `${a.id} -> ${b.id} should be a real gap`);
    assert.ok(g <= LIMITS.maxGap, `${a.id} -> ${b.id} gap ${g} too wide`);
    assert.ok(rise <= LIMITS.maxRise, `${a.id} -> ${b.id} rise ${rise} too high`);
  }
});

test('route can be jumped given air time and speed', () => {
  // Time to come back down to the landing height, for the largest allowed rise.
  const v = PLAYER.jump;
  const g = PLAYER.gravity;
  const rise = LIMITS.maxRise;
  const airTime = (v + Math.sqrt(v * v - 2 * g * rise)) / g;
  assert.ok(airTime * PLAYER.speed >= LIMITS.maxGap + 2 * PLAYER.radius);
});

test('finish platform is generous and the goal sits on it at foot height', () => {
  const finish = byId.get(LEVEL.route[LEVEL.route.length - 1]);
  assert.equal(finish.id, 'finish');
  assert.ok(finish.max.x - finish.min.x >= 6 && finish.max.z - finish.min.z >= 6);
  assert.equal(LEVEL.goal.position.y, top(finish));
  assert.ok(insideFootprint(finish, LEVEL.goal.position, LEVEL.goal.radius));
  assert.ok(LEVEL.goal.radius >= 1);
});

test('tokens: unique ids, about six, supported and reachable', () => {
  assert.ok(LEVEL.coins.length >= 5 && LEVEL.coins.length <= 8);
  assert.equal(new Set(LEVEL.coins.map((c) => c.id)).size, LEVEL.coins.length);
  const maxJumpHeight = (PLAYER.jump * PLAYER.jump) / (2 * PLAYER.gravity);
  for (const c of LEVEL.coins) {
    assert.ok(c.radius > 0);
    const p = supportOf(c.position, 0.5);
    assert.ok(p, `${c.id} is over a platform with an edge margin`);
    assert.ok(LEVEL.route.includes(p.id));
    const clearance = c.position.y - top(p);
    assert.ok(clearance >= c.radius, `${c.id} does not sink into the platform`);
    assert.ok(clearance - c.radius <= PLAYER.height, `${c.id} reachable while standing`);
    assert.ok(clearance <= PLAYER.height + maxJumpHeight);
    // nothing solid directly overhead within player height
    for (const other of LEVEL.platforms) {
      if (other === p || !insideFootprint(other, c.position)) continue;
      assert.ok(other.min.y > c.position.y + PLAYER.height || other.max.y < top(p), `${c.id} blocked overhead`);
    }
  }
});

test('tokens do not sit on the finish or start platform duplicates', () => {
  const positions = LEVEL.coins.map((c) => `${c.position.x},${c.position.y},${c.position.z}`);
  assert.equal(new Set(positions).size, positions.length);
});

test('level data is plain serializable data', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(LEVEL)), LEVEL);
});

let THREE_OK = true;
try {
  await import('three');
} catch {
  THREE_OK = false;
}

test('createWorld exposes the documented contract', { skip: !THREE_OK && 'three not installed' }, async () => {
  const { createWorld } = await import('../src/world.js');
  const world = createWorld();
  assert.ok(world.group.isGroup);
  assert.equal(world.platforms.length, LEVEL.platforms.length);
  assert.deepEqual(world.platforms.map((p) => p.id), LEVEL.platforms.map((p) => p.id));
  assert.ok(Object.isFrozen(world.platforms) && Object.isFrozen(world.platforms[0].min));
  assert.deepEqual({ ...world.spawn }, LEVEL.spawn);
  assert.equal(world.killY, LEVEL.killY);
  assert.deepEqual(world.goal.position, LEVEL.goal.position);
  assert.equal(world.coins.length, LEVEL.coins.length);

  const before = world.coins.map((c) => ({ ...c.position }));
  for (const c of world.coins) {
    assert.ok(c.mesh.visible);
    assert.equal(c.mesh.parent, world.group);
  }
  world.update(0.5);
  world.update(0.016);
  assert.deepEqual(world.coins.map((c) => ({ ...c.position })), before);
  for (const c of world.coins) {
    assert.ok(c.mesh.visible);
    assert.deepEqual(
      [c.mesh.position.x, c.mesh.position.y, c.mesh.position.z],
      [c.position.x, c.position.y, c.position.z],
    );
  }
  world.dispose();
  world.dispose();
});
