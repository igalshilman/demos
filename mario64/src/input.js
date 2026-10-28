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

  const clear = () => {
    for (const action of Object.keys(state)) state[action] = false;
  };

  const onKeyDown = (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (action) {
      event.preventDefault();
      state[action] = true;
    } else if (event.code === RESTART_CODE && !event.repeat) {
      onRestart();
    }
  };

  const onKeyUp = (event) => {
    const action = KEY_TO_ACTION[event.code];
    if (action) {
      event.preventDefault();
      state[action] = false;
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
