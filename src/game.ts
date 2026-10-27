import type { Vector3 } from 'three';
import type { GameHandle, GameState, WorldData } from './contracts';

const COIN_REACH = 1;
const BODY_CENTER_HEIGHT = 0.75;

function freshState(): GameState {
  return { status: 'playing', collected: new Set<string>(), deaths: 0, elapsed: 0 };
}

export function createGame(data: WorldData): GameHandle {
  const state = freshState();
  const coinIds = new Set(data.coins.map((coin) => coin.id));

  function tick(dt: number, position: Vector3): { respawn: boolean } {
    if (state.status === 'won') return { respawn: false };

    if (Number.isFinite(dt) && dt > 0) state.elapsed += dt;

    if (position.y < data.killY) {
      state.deaths += 1;
      return { respawn: true };
    }

    const cx = position.x;
    const cy = position.y + BODY_CENTER_HEIGHT;
    const cz = position.z;
    for (const coin of data.coins) {
      if (state.collected.has(coin.id)) continue;
      const dx = coin.position.x - cx;
      const dy = coin.position.y - cy;
      const dz = coin.position.z - cz;
      if (dx * dx + dy * dy + dz * dz <= COIN_REACH * COIN_REACH) state.collected.add(coin.id);
    }

    if (state.collected.size >= coinIds.size && data.goal.containsPoint(position)) {
      state.status = 'won';
    }

    return { respawn: false };
  }

  function reset(): void {
    const next = freshState();
    state.status = next.status;
    state.deaths = next.deaths;
    state.elapsed = next.elapsed;
    state.collected.clear();
  }

  return { state, tick, reset };
}
