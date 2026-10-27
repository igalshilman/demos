import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GameSession, type PlayerInput, type SessionLevel, type SessionPlayer } from './game-session';

const idle: PlayerInput = { moveX: 0, moveZ: 0, jumpPressed: false };

function setup() {
  const spawn = new Vector3(0, 0, 0);
  const resets: Vector3[] = [];
  const player: SessionPlayer = {
    root: { position: new Vector3() },
    reset(s) {
      resets.push(s.clone());
      this.root.position.copy(s);
    },
    update() {},
  };
  const collectedCalls: string[] = [];
  let levelResets = 0;
  const level: SessionLevel = {
    spawn,
    colliders: [],
    collectibles: [
      { id: 'a', position: new Vector3(2, 0.8, 0), radius: 0.4 },
      { id: 'b', position: new Vector3(4, 0.8, 0), radius: 0.4 },
    ],
    goal: new Box3(new Vector3(9, 0, -1), new Vector3(11, 3, 1)),
    collect: (id) => void collectedCalls.push(id),
    reset: () => void levelResets++,
  };
  const session = new GameSession(player, level);
  const moveTo = (x: number, y = 0, z = 0) => player.root.position.set(x, y, z);
  return { session, player, level, moveTo, collectedCalls, resets, levelResets: () => levelResets };
}

describe('GameSession', () => {
  it('collects an item once only', () => {
    const { session, moveTo, collectedCalls } = setup();
    moveTo(2);
    session.update(0.016, idle);
    session.update(0.016, idle);
    expect(collectedCalls).toEqual(['a']);
    expect(session.snapshot.collected).toBe(1);
  });

  it('uses radius plus margin around the player center', () => {
    const { session, moveTo } = setup();
    moveTo(2.7);
    session.update(0.016, idle);
    expect(session.snapshot.collected).toBe(1);
    moveTo(4.9);
    session.update(0.016, idle);
    expect(session.snapshot.collected).toBe(1);
  });

  it('keeps the goal locked until everything is collected', () => {
    const { session, moveTo } = setup();
    moveTo(2);
    session.update(0.016, idle);
    moveTo(10);
    session.update(0.016, idle);
    expect(session.status).toBe('playing');
    expect(session.snapshot.goalUnlocked).toBe(false);
  });

  it('wins when all collected and the goal is reached, then freezes', () => {
    const { session, moveTo } = setup();
    moveTo(2);
    session.update(0.016, idle);
    moveTo(4);
    session.update(0.016, idle);
    expect(session.snapshot.goalUnlocked).toBe(true);
    moveTo(10);
    expect(session.update(0.016, idle)).toBe(true);
    expect(session.status).toBe('won');
    moveTo(0);
    expect(session.update(0.016, idle)).toBe(false);
    expect(session.status).toBe('won');
  });

  it('restart resets player, level, progress and status', () => {
    const { session, moveTo, resets, levelResets, player } = setup();
    moveTo(2);
    session.update(0.016, idle);
    moveTo(4);
    session.update(0.016, idle);
    moveTo(10);
    session.update(0.016, idle);
    expect(session.status).toBe('won');
    session.restart();
    expect(session.status).toBe('playing');
    expect(session.snapshot.collected).toBe(0);
    expect(levelResets()).toBe(1);
    expect(resets).toHaveLength(1);
    expect(player.root.position.toArray()).toEqual([0, 0, 0]);
  });

  it('allows re-collecting after a restart', () => {
    const { session, moveTo, collectedCalls } = setup();
    moveTo(2);
    session.update(0.016, idle);
    session.restart();
    moveTo(2);
    session.update(0.016, idle);
    expect(collectedCalls).toEqual(['a', 'a']);
  });

  it('restarts everything when falling below -12', () => {
    const { session, moveTo, levelResets } = setup();
    moveTo(2);
    session.update(0.016, idle);
    moveTo(0, -12.5);
    session.update(0.016, idle);
    expect(session.snapshot.collected).toBe(0);
    expect(levelResets()).toBe(1);
  });
});
