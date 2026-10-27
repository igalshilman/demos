export const BODY_RADIUS = 0.35;
export const BODY_CENTER_HEIGHT = 0.7;

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function createGameState({ coins, goal, killY, bodyRadius = BODY_RADIUS, bodyCenterHeight = BODY_CENTER_HEIGHT }) {
  const collected = new Set();
  let status = 'playing';
  let elapsed = 0;
  let falls = 0;

  const total = coins.length;

  function goalUnlocked() {
    return collected.size >= total;
  }

  function tickTime(dt) {
    if (status === 'playing' && dt > 0) elapsed += dt;
  }

  function update(foot, dt = 0) {
    const events = { collected: [], fell: false, won: false };
    if (status !== 'playing') return events;

    tickTime(dt);

    if (foot.y < killY) {
      falls += 1;
      events.fell = true;
      return events;
    }

    const center = { x: foot.x, y: foot.y + bodyCenterHeight, z: foot.z };
    for (const coin of coins) {
      if (collected.has(coin.id)) continue;
      if (distance(coin.position, center) <= coin.radius + bodyRadius) {
        collected.add(coin.id);
        events.collected.push(coin.id);
      }
    }

    if (goalUnlocked() && distance(foot, goal.position) <= goal.radius) {
      status = 'won';
      events.won = true;
    }
    return events;
  }

  function restart() {
    collected.clear();
    status = 'playing';
    elapsed = 0;
    falls = 0;
  }

  return {
    update,
    restart,
    isCollected: (id) => collected.has(id),
    get collectedCount() { return collected.size; },
    get total() { return total; },
    get goalUnlocked() { return goalUnlocked(); },
    get status() { return status; },
    get won() { return status === 'won'; },
    get elapsed() { return elapsed; },
    get falls() { return falls; },
  };
}

export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}
