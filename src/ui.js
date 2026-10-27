import { formatTime } from './game-state.js';

export function createUI(root, { onRestart, reload } = {}, doc = globalThis.document) {
  const listeners = [];
  const reloadPage = reload ?? (() => globalThis.location.reload());
  // 'live' -> 'errorOnly' (game torn down, error panel kept) -> 'gone'
  let phase = 'live';
  let toastTimer = null;

  function el(tag, className, text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function listen(node, type, handler) {
    node.addEventListener(type, handler);
    const entry = { node, type, handler };
    listeners.push(entry);
    return entry;
  }

  function unlisten(entry) {
    entry.node.removeEventListener(entry.type, entry.handler);
    const i = listeners.indexOf(entry);
    if (i >= 0) listeners.splice(i, 1);
  }

  const hud = el('div', 'hud');
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Game status');

  const stats = el('div', 'hud-stats');
  const tokens = el('p', 'hud-item');
  const time = el('p', 'hud-item');
  const goal = el('p', 'hud-item hud-goal');
  stats.append(tokens, time, goal);

  const restartButton = el('button', 'button', 'Restart (R)');
  restartButton.type = 'button';
  listen(restartButton, 'click', () => {
    onRestart?.();
    restartButton.blur();
  });

  const controls = el('p', 'hud-controls',
    'Move: WASD / Arrow keys · Jump: Space · Camera: drag mouse, scroll to zoom · Restart: R');

  const toast = el('p', 'toast');
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  hud.append(stats, restartButton);

  const winPanel = el('div', 'overlay overlay-win');
  winPanel.hidden = true;
  const winCard = el('div', 'card');
  winCard.setAttribute('role', 'dialog');
  winCard.setAttribute('aria-labelledby', 'win-title');
  const winTitle = el('h2', '', 'You made it!');
  winTitle.id = 'win-title';
  const winSummary = el('p');
  const playAgain = el('button', 'button button-primary', 'Play again');
  playAgain.type = 'button';
  listen(playAgain, 'click', () => onRestart?.());
  winCard.append(winTitle, winSummary, playAgain);
  winPanel.append(winCard);

  const loading = el('div', 'overlay overlay-loading');
  loading.setAttribute('role', 'status');
  loading.append(el('p', '', 'Loading…'));

  const errorPanel = el('div', 'overlay overlay-error');
  errorPanel.hidden = true;
  errorPanel.setAttribute('role', 'alert');
  const errorCard = el('div', 'card');
  const errorTitle = el('h2', '', 'Something went wrong');
  const errorMessage = el('p');
  const reloadButton = el('button', 'button button-primary', 'Reload');
  reloadButton.type = 'button';
  const reloadListener = listen(reloadButton, 'click', () => reloadPage());
  errorCard.append(errorTitle, errorMessage, reloadButton);
  errorPanel.append(errorCard);

  root.append(hud, controls, toast, winPanel, loading, errorPanel);

  return {
    render(state) {
      if (phase !== 'live') return;
      tokens.textContent = `Tokens: ${state.collectedCount} / ${state.total}`;
      time.textContent = `Time: ${formatTime(state.elapsed)}`;
      goal.textContent = state.won
        ? 'Goal reached'
        : state.goalUnlocked ? 'Goal unlocked — head to the finish!' : 'Goal locked — collect every token';
      if (state.won) {
        if (winPanel.hidden) {
          winSummary.textContent =
            `All ${state.total} tokens collected in ${formatTime(state.elapsed)}.`;
          winPanel.hidden = false;
          playAgain.focus();
        }
      } else if (!winPanel.hidden) {
        winPanel.hidden = true;
      }
    },
    notify(message) {
      if (phase !== 'live') return;
      toast.textContent = message;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastTimer = null;
        toast.textContent = '';
      }, 2500);
    },
    hideLoading() {
      if (phase === 'live') loading.hidden = true;
    },
    showError(message) {
      if (phase === 'gone') return;
      if (phase === 'live') loading.hidden = true;
      errorMessage.textContent = message;
      errorPanel.hidden = false;
    },
    // Idempotent. With keepError, a visible error panel (and its Reload button)
    // stays on screen after the rest of the UI is removed; a later dispose() removes it too.
    dispose({ keepError = false } = {}) {
      if (phase === 'gone') return;
      if (phase === 'live') {
        clearTimeout(toastTimer);
        toastTimer = null;
        for (const entry of [...listeners]) {
          if (entry !== reloadListener) unlisten(entry);
        }
        for (const node of [hud, controls, toast, winPanel, loading]) node.remove();
        phase = 'errorOnly';
      }
      if (keepError && !errorPanel.hidden) return;
      unlisten(reloadListener);
      errorPanel.remove();
      phase = 'gone';
    },
  };
}
