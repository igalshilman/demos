const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  KeyR: 'restart',
};

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Keyboard input.
 *
 * `state` is a live object with:
 *   forward, backward, left, right  - booleans, true while held
 *   moveX  - -1 (left) .. 1 (right)
 *   moveZ  - -1 (backward) .. 1 (forward)
 *   jump        - true while space is held
 *   jumpPressed - true for one frame after space goes down
 *   restartPressed - true for one frame after R goes down
 *
 * Call `endFrame()` once per frame after consuming the state.
 */
export function createInput(target = globalThis.window, { onRestart } = {}) {
  const held = new Set();
  const state = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    moveX: 0,
    moveZ: 0,
    jump: false,
    jumpPressed: false,
    restartPressed: false,
  };

  function refresh() {
    state.forward = held.has('forward');
    state.backward = held.has('backward');
    state.left = held.has('left');
    state.right = held.has('right');
    state.jump = held.has('jump');
    state.moveX = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    state.moveZ = (state.forward ? 1 : 0) - (state.backward ? 1 : 0);
  }

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (PREVENT_DEFAULT.has(event.code) && event.preventDefault) event.preventDefault();
    if (event.repeat) return;
    if (action === 'jump' && !held.has('jump')) state.jumpPressed = true;
    if (action === 'restart') {
      state.restartPressed = true;
      if (onRestart) onRestart();
      return;
    }
    held.add(action);
    refresh();
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action || action === 'restart') return;
    held.delete(action);
    refresh();
  }

  function clear() {
    held.clear();
    state.jumpPressed = false;
    state.restartPressed = false;
    refresh();
  }

  function endFrame() {
    state.jumpPressed = false;
    state.restartPressed = false;
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);

  function dispose() {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', clear);
  }

  return { state, endFrame, clear, dispose };
}
