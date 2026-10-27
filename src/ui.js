import { formatTime } from './game-state.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createUI(root, { onRestart }) {
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
  restartButton.addEventListener('click', () => {
    onRestart();
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
  playAgain.addEventListener('click', onRestart);
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
  const reload = el('button', 'button button-primary', 'Reload');
  reload.type = 'button';
  reload.addEventListener('click', () => window.location.reload());
  errorCard.append(errorTitle, errorMessage, reload);
  errorPanel.append(errorCard);

  root.append(hud, controls, toast, winPanel, loading, errorPanel);

  let toastTimer = null;

  return {
    render(state) {
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
      toast.textContent = message;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.textContent = ''; }, 2500);
    },
    hideLoading() {
      loading.hidden = true;
    },
    showError(message) {
      loading.hidden = true;
      errorMessage.textContent = message;
      errorPanel.hidden = false;
    },
  };
}
