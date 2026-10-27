const MOVE_KEYS = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

function isInteractive(target) {
  return target instanceof Element && target.closest('button, a, input, select, textarea') !== null;
}

export function createInput({ onRestart } = {}) {
  const down = new Set();
  let jumpQueued = false;

  function clear() {
    down.clear();
    jumpQueued = false;
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const code = event.code;
    // Let a focused button keep its native Space/Enter activation.
    if (isInteractive(event.target) && (code === 'Space' || code === 'Enter')) return;

    if (PREVENT_DEFAULT_KEYS.has(code)) event.preventDefault();

    if (code === 'KeyR') {
      if (!event.repeat && onRestart) onRestart();
      return;
    }
    if (code === 'Space') {
      if (!event.repeat) jumpQueued = true;
      return;
    }
    if (MOVE_KEYS[code]) down.add(MOVE_KEYS[code]);
  }

  function onKeyUp(event) {
    if (MOVE_KEYS[event.code]) down.delete(MOVE_KEYS[event.code]);
  }

  function onVisibility() {
    if (document.hidden) clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    clear,
    // Builds one step's input. The jump edge is consumed so it lasts exactly one step.
    // `yaw` is the camera's orbit angle; movement is relative to where the camera looks.
    read(yaw) {
      const h = (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0);
      const v = (down.has('forward') ? 1 : 0) - (down.has('back') ? 1 : 0);
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = -fz;
      const rz = fx;
      let moveX = rx * h + fx * v;
      let moveZ = rz * h + fz * v;
      const len = Math.hypot(moveX, moveZ);
      if (len > 1) {
        moveX /= len;
        moveZ /= len;
      }
      const jumpPressed = jumpQueued;
      jumpQueued = false;
      return { moveX, moveZ, jumpPressed };
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
