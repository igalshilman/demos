import type { GameState, HudHandle } from './contracts';
import './hud.css';

const CONTROLS: Array<[string, string[]]> = [
  ['Move', ['W', 'A', 'S', 'D', '↑', '←', '↓', '→']],
  ['Jump', ['Space']],
  ['Sprint', ['Shift']],
  ['Turn camera', ['Q', 'E']],
  ['Restart', ['R']],
];

export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const tenths = Math.floor(safe * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;
  return `${String(minutes).padStart(2, '0')}:${rest.toFixed(1).padStart(4, '0')}`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function createHud(container: HTMLElement, onRestart: () => void): HudHandle {
  const root = el('section', 'lh-hud');
  root.setAttribute('aria-label', 'Lumen Hop game status');

  const title = el('h2', 'lh-hud__title', 'Lumen Hop');

  const stats = el('dl', 'lh-hud__stats');
  const statValue = (label: string): HTMLElement => {
    const wrap = el('div', 'lh-hud__stat');
    const dt = el('dt', undefined, label);
    const dd = el('dd');
    wrap.append(dt, dd);
    stats.append(wrap);
    return dd;
  };
  const tokensValue = statValue('Tokens');
  const timeValue = statValue('Time');
  const fallsValue = statValue('Falls');

  const progress = el('progress', 'lh-hud__progress');
  progress.setAttribute('aria-label', 'Tokens collected');
  const goal = el('p', 'lh-hud__goal');

  const controls = el('dl', 'lh-hud__controls');
  controls.setAttribute('aria-label', 'Controls');
  for (const [action, keys] of CONTROLS) {
    const dt = el('dt', undefined, action);
    const dd = el('dd');
    keys.forEach((key, i) => {
      if (i > 0) dd.append(' ');
      dd.append(el('kbd', undefined, key));
    });
    controls.append(dt, dd);
  }

  const victory = el('div', 'lh-hud__victory');
  victory.hidden = true;
  victory.setAttribute('role', 'group');
  victory.setAttribute('aria-label', 'Course complete');
  const victoryTitle = el('h3', 'lh-hud__victory-title', 'Course complete!');
  const victoryTime = el('p', 'lh-hud__victory-time');
  const restart = el('button', 'lh-hud__restart', 'Restart');
  restart.type = 'button';
  victory.append(victoryTitle, victoryTime, restart);

  const live = el('div', 'lh-hud__live');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  root.append(title, stats, progress, goal, controls, victory, live);
  container.append(root);

  const handleRestart = (): void => onRestart();
  restart.addEventListener('click', handleRestart);

  let disposed = false;
  let lastCollected = 0;
  let lastStatus: GameState['status'] = 'playing';

  function announce(message: string): void {
    live.textContent = message;
  }

  function update(state: GameState, totalCoins: number): void {
    if (disposed) return;
    const collected = state.collected.size;
    const total = Math.max(0, totalCoins);
    const unlocked = collected >= total;
    const won = state.status === 'won';

    tokensValue.textContent = `${collected} / ${total}`;
    timeValue.textContent = formatTime(state.elapsed);
    fallsValue.textContent = String(state.deaths);

    progress.max = Math.max(1, total);
    progress.value = Math.min(collected, progress.max);
    progress.setAttribute('aria-valuetext', `${collected} of ${total} tokens`);

    const remaining = Math.max(0, total - collected);
    goal.textContent = unlocked
      ? 'Finish unlocked: reach the goal!'
      : `Finish locked: ${plural(remaining, 'token')} to go`;
    root.classList.toggle('lh-hud--unlocked', unlocked);

    if (won) {
      victoryTime.textContent = `Completion time ${formatTime(state.elapsed)} with ${plural(state.deaths, 'fall')}.`;
    }
    victory.hidden = !won;

    if (won && lastStatus !== 'won') {
      announce(`Course complete in ${formatTime(state.elapsed)}.`);
      restart.focus();
    } else if (!won && lastStatus === 'won') {
      announce('Course restarted.');
    } else if (!won && collected > lastCollected) {
      announce(
        unlocked
          ? `${collected} of ${total} tokens collected. Finish unlocked.`
          : `${collected} of ${total} tokens collected.`,
      );
    } else if (!won && collected < lastCollected) {
      announce('Course restarted.');
    }

    lastCollected = collected;
    lastStatus = state.status;
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    restart.removeEventListener('click', handleRestart);
    root.remove();
  }

  return { update, dispose };
}
