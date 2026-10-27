import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { createGame } from '../src/game';
import type { WorldData } from '../src/contracts';

function makeWorld(coinCount = 3): WorldData {
  return {
    solids: [new Box3(new Vector3(-10, -1, -10), new Vector3(10, 0, 10))],
    spawn: new Vector3(0, 1, 0),
    killY: -20,
    coins: Array.from({ length: coinCount }, (_, i) => ({
      id: `c${i}`,
      position: new Vector3(i * 5, 0.75, 0),
    })),
    goal: new Box3(new Vector3(20, 0, -2), new Vector3(24, 4, 2)),
  };
}

const feetFor = (coin: { position: Vector3 }) => new Vector3(coin.position.x, 0, coin.position.z);
const inGoal = () => new Vector3(22, 0, 0);

describe('createGame', () => {
  it('starts in a clean playing state', () => {
    const game = createGame(makeWorld());
    expect(game.state.status).toBe('playing');
    expect(game.state.collected.size).toBe(0);
    expect(game.state.deaths).toBe(0);
    expect(game.state.elapsed).toBe(0);
  });

  it('accumulates elapsed time while playing', () => {
    const game = createGame(makeWorld());
    game.tick(0.5, new Vector3(0, 5, 50));
    game.tick(0.25, new Vector3(0, 5, 50));
    expect(game.state.elapsed).toBeCloseTo(0.75);
  });

  it('collects a coin at exactly distance 1 but not beyond', () => {
    const world = makeWorld(1);
    const game = createGame(world);
    game.tick(0.1, new Vector3(0, 1.01, 0)); // center 1.76, coin .75 -> 1.01 away
    expect(game.state.collected.size).toBe(0);
    game.tick(0.1, new Vector3(0, 1, 0)); // center 1.75 -> exactly 1 away
    expect(game.state.collected.has('c0')).toBe(true);
  });

  it('measures from feet + 0.75 on Y', () => {
    const game = createGame(makeWorld(1));
    game.tick(0.1, new Vector3(0, 0, 0)); // center at .75, coin at .75 -> 0
    expect(game.state.collected.has('c0')).toBe(true);
  });

  it('does not collect a coin just out of reach horizontally', () => {
    const game = createGame(makeWorld(1));
    game.tick(0.1, new Vector3(1.01, 0, 0));
    expect(game.state.collected.size).toBe(0);
  });

  it('counts each coin once even when revisited', () => {
    const world = makeWorld(2);
    const game = createGame(world);
    game.tick(0.1, feetFor(world.coins[0]));
    game.tick(0.1, feetFor(world.coins[0]));
    expect(game.state.collected.size).toBe(1);
  });

  it('does not unlock the goal with tokens missing', () => {
    const world = makeWorld(2);
    const game = createGame(world);
    game.tick(0.1, feetFor(world.coins[0]));
    game.tick(0.1, inGoal());
    expect(game.state.status).toBe('playing');
  });

  it('does not win when all tokens collected but feet are outside the goal', () => {
    const world = makeWorld(2);
    const game = createGame(world);
    world.coins.forEach((c) => game.tick(0.1, feetFor(c)));
    expect(game.state.collected.size).toBe(2);
    expect(game.state.status).toBe('playing');
  });

  it('wins on the tick the last token is collected inside the goal', () => {
    const world = makeWorld(1);
    world.coins[0].position.set(22, 0.75, 0);
    const game = createGame(world);
    game.tick(0.1, inGoal());
    expect(game.state.collected.size).toBe(1);
    expect(game.state.status).toBe('won');
  });

  it('wins after all tokens when later entering the goal', () => {
    const world = makeWorld(2);
    const game = createGame(world);
    world.coins.forEach((c) => game.tick(0.1, feetFor(c)));
    game.tick(0.1, inGoal());
    expect(game.state.status).toBe('won');
  });

  it('treats the goal boundary as inside', () => {
    const world = makeWorld(0);
    const game = createGame(world);
    game.tick(0.1, new Vector3(20, 0, -2));
    expect(game.state.status).toBe('won');
  });

  it('counts a fall, requests respawn, and keeps progress and time', () => {
    const world = makeWorld(2);
    const game = createGame(world);
    game.tick(0.5, feetFor(world.coins[0]));
    const result = game.tick(0.5, new Vector3(0, -20.5, 0));
    expect(result).toEqual({ respawn: true });
    expect(game.state.deaths).toBe(1);
    expect(game.state.collected.has('c0')).toBe(true);
    expect(game.state.elapsed).toBeCloseTo(1);
    expect(game.state.status).toBe('playing');
  });

  it('does not treat exactly killY as a fall', () => {
    const game = createGame(makeWorld());
    expect(game.tick(0.1, new Vector3(0, -20, 50)).respawn).toBe(false);
    expect(game.state.deaths).toBe(0);
  });

  it('skips collection and winning on a fall tick', () => {
    const world = makeWorld(1);
    world.coins[0].position.set(22, -25, 0);
    const game = createGame(world);
    const result = game.tick(0.1, new Vector3(22, -24.25, 0));
    expect(result.respawn).toBe(true);
    expect(game.state.collected.size).toBe(0);
    expect(game.state.status).toBe('playing');
  });

  it('stays won and frozen on further ticks', () => {
    const world = makeWorld(0);
    const game = createGame(world);
    game.tick(1, inGoal());
    expect(game.state.status).toBe('won');
    const elapsed = game.state.elapsed;
    expect(game.tick(5, inGoal())).toEqual({ respawn: false });
    expect(game.tick(5, new Vector3(0, -100, 0))).toEqual({ respawn: false });
    expect(game.state.elapsed).toBe(elapsed);
    expect(game.state.deaths).toBe(0);
    expect(game.state.status).toBe('won');
  });

  it('reset restores a complete initial state', () => {
    const world = makeWorld(1);
    const game = createGame(world);
    game.tick(1, new Vector3(0, -50, 0));
    game.tick(1, feetFor(world.coins[0]));
    game.reset();
    expect(game.state.status).toBe('playing');
    expect(game.state.collected.size).toBe(0);
    expect(game.state.deaths).toBe(0);
    expect(game.state.elapsed).toBe(0);
    game.tick(0.1, feetFor(world.coins[0]));
    expect(game.state.collected.size).toBe(1);
  });

  it('reset after winning allows playing again', () => {
    const game = createGame(makeWorld(0));
    game.tick(1, inGoal());
    game.reset();
    expect(game.state.status).toBe('playing');
    game.tick(0.5, new Vector3(0, 0, 40));
    expect(game.state.elapsed).toBeCloseTo(0.5);
  });

  it('does not mutate world inputs', () => {
    const world = makeWorld(2);
    const snapshot = JSON.stringify({
      s: world.solids,
      p: world.spawn,
      k: world.killY,
      c: world.coins,
      g: world.goal,
    });
    const game = createGame(world);
    const position = feetFor(world.coins[0]);
    game.tick(0.1, position);
    game.tick(0.1, new Vector3(0, -30, 0));
    game.reset();
    expect(
      JSON.stringify({ s: world.solids, p: world.spawn, k: world.killY, c: world.coins, g: world.goal }),
    ).toBe(snapshot);
    expect(position.toArray()).toEqual([0, 0, 0]);
  });
});
