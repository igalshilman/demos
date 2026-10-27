const FORWARD = ['KeyW', 'ArrowUp'];
const BACK = ['KeyS', 'ArrowDown'];
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const MOVE_CODES = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);

const PREVENT_DEFAULT_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

function isInteractive(target) {
  return typeof target?.closest === 'function'
    && target.closest('button, a, input, select, textarea') !== null;
}

// `win` and `doc` default to the page's globals; tests pass event-target doubles.
export function createInput({ onRestart, win = globalThis.window, doc = globalThis.document } = {}) {
  // Physical key codes currently held, so two keys bound to one direction
  // (W and ArrowUp) never cancel each other when one is released.
  const down = new Set();
  let jumpQueued = false;
  let disposed = false;

  function clear() {
    down.clear();
    jumpQueued = false;
  }

  function held(codes) {
    return codes.some((code) => down.has(code));
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
    if (MOVE_CODES.has(code)) down.add(code);
  }

  function onKeyUp(event) {
    down.delete(event.code);
  }

  function onVisibility() {
    if (doc.hidden) clear();
  }

  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', clear);
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    clear,
    // Builds one step's input. The jump edge is consumed so it lasts exactly one step.
    // `yaw` is the camera's orbit angle; movement is relative to where the camera looks.
    read(yaw) {
      const h = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
      const v = (held(FORWARD) ? 1 : 0) - (held(BACK) ? 1 : 0);
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
      if (disposed) return;
      disposed = true;
      clear();
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
