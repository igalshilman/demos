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

// Camera-relative movement. The camera follows with smoothing, so movement must
// be derived from where the camera actually is, not from the yaw it is heading to.

export function desiredCameraPosition(target, yaw, distance, height) {
  return {
    x: target.x + Math.sin(yaw) * distance,
    y: target.y + height,
    z: target.z + Math.cos(yaw) * distance,
  };
}

export function cameraAxes(cameraPosition, lookTarget, fallbackYaw = 0) {
  let fx = lookTarget.x - cameraPosition.x;
  let fz = lookTarget.z - cameraPosition.z;
  let length = Math.hypot(fx, fz);
  if (length < 1e-6) {
    fx = -Math.sin(fallbackYaw);
    fz = -Math.cos(fallbackYaw);
    length = 1;
  }
  fx /= length;
  fz /= length;
  return { forward: { x: fx, z: fz }, right: { x: -fz, z: fx } };
}

export function cameraRelativeMove(input, cameraPosition, lookTarget, fallbackYaw = 0) {
  const length = Math.hypot(input.x, input.y);
  if (length === 0) return { moveX: 0, moveZ: 0 };
  const x = input.x / length;
  const y = input.y / length;
  const { forward, right } = cameraAxes(cameraPosition, lookTarget, fallbackYaw);
  return {
    moveX: right.x * x + forward.x * y,
    moveZ: right.z * x + forward.z * y,
  };
}
