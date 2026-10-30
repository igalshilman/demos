export const BODY_CENTER_OFFSET = 0.9;
export const BODY_RADIUS = 0.4;

export function bodyCenter(feet, offset = BODY_CENTER_OFFSET) {
  return { x: feet.x, y: feet.y + offset, z: feet.z };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function isTouching(center, target, bodyRadius = BODY_RADIUS) {
  return distance(center, target.position) <= target.radius + bodyRadius;
}

export function createGameState(collectibleIds = []) {
  const ids = [...new Set(collectibleIds)];
  const known = new Set(ids);
  const collected = new Set();
  let won = false;
  let falls = 0;

  const state = {
    get total() {
      return ids.length;
    },
    get collectedCount() {
      return collected.size;
    },
    get remaining() {
      return ids.length - collected.size;
    },
    get allCollected() {
      return collected.size === ids.length;
    },
    get won() {
      return won;
    },
    get falls() {
      return falls;
    },
    has(id) {
      return collected.has(id);
    },
    collect(id) {
      if (won || !known.has(id) || collected.has(id)) return false;
      collected.add(id);
      return true;
    },
    reachGoal() {
      if (won || !state.allCollected) return false;
      won = true;
      return true;
    },
    fall() {
      if (won) return false;
      falls += 1;
      return true;
    },
    restart() {
      collected.clear();
      won = false;
      falls = 0;
    },
    snapshot() {
      return {
        total: ids.length,
        collected: collected.size,
        remaining: ids.length - collected.size,
        allCollected: collected.size === ids.length,
        won,
        falls,
      };
    },
  };
  return state;
}
