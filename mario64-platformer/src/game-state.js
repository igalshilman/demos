export const CRYSTAL_TOTAL = 5;

export function createGameState(crystalIds) {
  const ids = [...crystalIds];
  return {
    crystalIds: ids,
    total: ids.length,
    collected: new Set(),
    won: false,
  };
}

export function collectCrystal(state, id) {
  if (state.won) return false;
  if (!state.crystalIds.includes(id)) return false;
  if (state.collected.has(id)) return false;
  state.collected.add(id);
  return true;
}

export function isCollected(state, id) {
  return state.collected.has(id);
}

export function collectedCount(state) {
  return state.collected.size;
}

export function allCollected(state) {
  return state.total > 0 && state.collected.size === state.total;
}

export function reachGoal(state) {
  if (state.won) return false;
  if (!allCollected(state)) return false;
  state.won = true;
  return true;
}

export function resetGameState(state) {
  state.collected.clear();
  state.won = false;
}

export function counterText(state) {
  return `Crystals: ${collectedCount(state)} / ${state.total}`;
}

export function hintText(state, { nearGoal = false } = {}) {
  if (state.won) return "Level complete! Press R to play again.";
  if (allCollected(state)) return "All crystals collected! Head to the finish platform.";
  if (nearGoal) {
    const left = state.total - collectedCount(state);
    return `The finish is locked. Collect ${left} more ${left === 1 ? "crystal" : "crystals"}.`;
  }
  if (collectedCount(state) === 0) return "Find all the crystals, then reach the finish platform.";
  return "Keep going, there are more crystals to find.";
}
