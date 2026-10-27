import type { InputFrame } from './contracts';

/** Radians per second of camera yaw while Q/E is held. */
export const YAW_RATE = 2;

export interface InputController {
  /** Current camera yaw in radians (0 looks toward -Z). */
  readonly yaw: number;
  /**
   * Build the input for one fixed step of `dt` seconds. Advances the yaw from
   * held Q/E and consumes the jump latch, so a press yields `jumpPressed` for
   * exactly one step however many steps run per rendered frame.
   */
  consume(dt: number): InputFrame;
  /** Release every held key and drop a pending jump (focus loss, hidden tab). */
  clearHeld(): void;
  /** clearHeld() plus yaw back to 0 (restart). */
  reset(): void;
  dispose(): void;
}

export interface InputOptions {
  /** Where key events are listened for. Defaults to `window`. */
  target?: Window;
  onRestart?: () => void;
}

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="textbox"], [role="slider"], [role="checkbox"]';

/** True when a keyboard shortcut should leave the event to the focused control. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return (target as Element).closest(INTERACTIVE_SELECTOR) !== null;
}

const TEXT_ENTRY_SELECTOR =
  'textarea, select, input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), [contenteditable]:not([contenteditable="false"]), [role="textbox"]';

/** True for targets where typing letters means text, so even restart must stay out of the way. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  return (target as Element).closest(TEXT_ENTRY_SELECTOR) !== null;
}

type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'yawLeft'
  | 'yawRight'
  | 'restart';

const KEY_ACTIONS: Readonly<Record<string, Action>> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyQ: 'yawLeft',
  KeyE: 'yawRight',
  KeyR: 'restart',
};

export function createInput(options: InputOptions = {}): InputController {
  const target = options.target ?? window;
  /** Held physical keys by `event.code`, so two keys on one action stay independent. */
  const held = new Set<string>();
  let jumpLatched = false;
  let yaw = 0;

  const isHeld = (action: Action): boolean => {
    for (const code of held) if (KEY_ACTIONS[code] === action) return true;
    return false;
  };

  const clearHeld = (): void => {
    held.clear();
    jumpLatched = false;
  };

  const onKeyDown = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Restart stays available on buttons (the HUD focuses its restart button on
    // victory); every other shortcut leaves interactive controls alone.
    if (action === 'restart' ? isTextEntryTarget(event.target) : isInteractiveTarget(event.target)) return;
    // Handled keys never scroll the page or trigger browser find-as-you-type.
    event.preventDefault();
    if (action === 'restart') {
      if (!event.repeat) options.onRestart?.();
      return;
    }
    if (action === 'jump' && !event.repeat && !held.has(event.code)) jumpLatched = true;
    held.add(event.code);
  };

  const onKeyUp = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    // Releases are honoured even when focus moved to a control meanwhile,
    // otherwise the key would stay stuck.
    if (!held.delete(event.code)) return;
    if (KEY_ACTIONS[event.code]) event.preventDefault();
  };

  const onBlur = (): void => clearHeld();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    get yaw() {
      return yaw;
    },
    consume(dt) {
      const turn = (isHeld('yawLeft') ? 1 : 0) - (isHeld('yawRight') ? 1 : 0);
      yaw += turn * YAW_RATE * dt;
      const frame: InputFrame = {
        moveX: (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0),
        moveZ: (isHeld('forward') ? 1 : 0) - (isHeld('back') ? 1 : 0),
        jumpPressed: jumpLatched,
        sprint: isHeld('sprint'),
        cameraYaw: yaw,
      };
      jumpLatched = false;
      return frame;
    },
    clearHeld,
    reset() {
      clearHeld();
      yaw = 0;
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
      clearHeld();
    },
  };
}
