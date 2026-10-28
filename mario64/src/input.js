const KEY_TO_ACTION = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
};

const RESTART_CODE = 'KeyR';

export function createInput(target, { onRestart = () => {}, doc = target.document } = {}) {
  const state = { forward: false, backward: false, left: false, right: false, jump: false };
  // player.js reads `back` for the backward key; keep it in step with `backward`.
  Object.defineProperty(state, 'back', { get: () => state.backward, enumerable: false });
  const pressed = new Set();

  const sync = () => {
    for (const action of Object.keys(state)) state[action] = false;
    for (const code of pressed) state[KEY_TO_ACTION[code]] = true;
  };

  const clear = () => {
    pressed.clear();
    sync();
  };

  const onKeyDown = (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (action) {
      event.preventDefault();
      pressed.add(event.code);
      sync();
    } else if (event.code === RESTART_CODE && !event.repeat) {
      onRestart();
    }
  };

  const onKeyUp = (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (action) {
      event.preventDefault();
      pressed.delete(event.code);
      sync();
    }
  };

  const onVisibility = () => {
    if (doc?.hidden) clear();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);
  doc?.addEventListener('visibilitychange', onVisibility);

  return {
    state,
    pressed,
    clear,
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', clear);
      doc?.removeEventListener('visibilitychange', onVisibility);
      clear();
    },
  };
}
