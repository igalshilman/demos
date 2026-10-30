const STYLE_ID = 'orb-runner-hud-style';

const CSS = `
.orb-hud { position: absolute; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #fff; }
.orb-hud__stats { position: absolute; top: 12px; left: 12px; display: flex; gap: 8px; }
.orb-hud__pill { background: rgba(10, 16, 32, 0.82); border: 1px solid rgba(255, 255, 255, 0.55); border-radius: 8px; padding: 6px 12px; font-size: 1.1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.orb-hud__controls { position: absolute; bottom: 12px; left: 12px; background: rgba(10, 16, 32, 0.82); border: 1px solid rgba(255, 255, 255, 0.55); border-radius: 8px; padding: 6px 12px; font-size: 0.95rem; }
.orb-hud__win { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(5, 8, 20, 0.8); pointer-events: auto; text-align: center; }
.orb-hud__win[hidden] { display: none; }
.orb-hud__title { margin: 0; font-size: 2.2rem; }
.orb-hud__result { margin: 0; font-size: 1.3rem; }
.orb-hud__button { font: inherit; font-size: 1.1rem; font-weight: 700; padding: 10px 24px; border-radius: 8px; border: 2px solid #fff; background: #ffd54a; color: #111; cursor: pointer; }
.orb-hud__button:hover { background: #ffe382; }
.orb-hud__button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
`;

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createHud(root) {
  const doc = (root && root.ownerDocument) || globalThis.document;

  if (doc.head && typeof doc.getElementById === 'function' && !doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  const make = (tag, className, text) => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  const element = make('div', 'orb-hud');
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', 'Game status');

  const stats = make('div', 'orb-hud__stats');
  const coins = make('div', 'orb-hud__pill', 'Orbs: 0 / 0');
  coins.setAttribute('data-hud', 'coins');
  const time = make('div', 'orb-hud__pill', 'Time: 0:00');
  time.setAttribute('data-hud', 'time');
  stats.appendChild(coins);
  stats.appendChild(time);

  const status = make('div', 'orb-hud__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';

  const controls = make(
    'div',
    'orb-hud__controls',
    'Move: WASD / Arrows \u00b7 Jump: Space \u00b7 Collect every orb, then reach the goal ring',
  );
  controls.setAttribute('data-hud', 'controls');

  const win = make('div', 'orb-hud__win');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'true');
  win.setAttribute('aria-labelledby', 'orb-hud-win-title');
  win.setAttribute('data-hud', 'win');
  win.hidden = true;
  const title = make('h2', 'orb-hud__title', 'Course clear!');
  title.id = 'orb-hud-win-title';
  const result = make('p', 'orb-hud__result', '');
  result.setAttribute('data-hud', 'win-time');
  const button = make('button', 'orb-hud__button', 'Play again');
  button.setAttribute('type', 'button');
  button.setAttribute('data-hud', 'restart');
  win.appendChild(title);
  win.appendChild(result);
  win.appendChild(button);

  element.appendChild(stats);
  element.appendChild(status);
  element.appendChild(controls);
  element.appendChild(win);
  if (root) root.appendChild(element);

  let restartCallback = null;
  let lastTotal = 0;
  let lastWholeSeconds = -1;

  button.addEventListener('click', () => {
    if (restartCallback) restartCallback();
  });

  const hud = {
    element,
    setCoins(collected, total) {
      lastTotal = total;
      coins.textContent = `Orbs: ${collected} / ${total}`;
      if (total > 0 && collected >= total) {
        status.textContent = 'All orbs collected. The goal ring is open.';
      } else {
        status.textContent = '';
      }
    },
    setTime(seconds) {
      const whole = Math.max(0, Math.floor(Number(seconds) || 0));
      if (whole === lastWholeSeconds) return;
      lastWholeSeconds = whole;
      time.textContent = `Time: ${formatTime(whole)}`;
    },
    showWin(seconds) {
      result.textContent = `Your time: ${formatTime(seconds)}`;
      win.hidden = false;
      if (typeof button.focus === 'function') button.focus();
    },
    hideWin() {
      win.hidden = true;
    },
    onRestart(callback) {
      restartCallback = typeof callback === 'function' ? callback : null;
    },
    reset() {
      hud.setCoins(0, lastTotal);
      lastWholeSeconds = -1;
      hud.setTime(0);
      hud.hideWin();
    },
  };

  return hud;
}
