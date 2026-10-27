import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { FIXED_DT, MAX_ACCUMULATED, createFixedStepper } from '../src/contracts';
import { YAW_RATE, createInput, isInteractiveTarget, isTextEntryTarget } from '../src/input';
import type { InputController } from '../src/input';

function key(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
const down = (code: string, init?: KeyboardEventInit, target?: EventTarget) => key('keydown', code, init, target);
const up = (code: string, init?: KeyboardEventInit, target?: EventTarget) => key('keyup', code, init, target);

describe('createInput', () => {
  let input: InputController;
  let onRestart: Mock<() => void>;

  beforeEach(() => {
    document.body.innerHTML = '';
    onRestart = vi.fn<() => void>();
    input = createInput({ onRestart });
  });
  afterEach(() => input.dispose());

  it('reports an idle frame with yaw 0', () => {
    expect(input.consume(FIXED_DT)).toEqual({ moveX: 0, moveZ: 0, jumpPressed: false, sprint: false, cameraYaw: 0 });
  });

  it.each([
    ['KeyW', 0, 1],
    ['ArrowUp', 0, 1],
    ['KeyS', 0, -1],
    ['ArrowDown', 0, -1],
    ['KeyA', -1, 0],
    ['ArrowLeft', -1, 0],
    ['KeyD', 1, 0],
    ['ArrowRight', 1, 0],
  ])('maps %s to move (%d, %d)', (code, moveX, moveZ) => {
    down(code);
    const frame = input.consume(FIXED_DT);
    expect(frame.moveX).toBe(moveX);
    expect(frame.moveZ).toBe(moveZ);
    up(code);
    expect(input.consume(FIXED_DT)).toMatchObject({ moveX: 0, moveZ: 0 });
  });

  it('leaves diagonals un-normalised for the player to handle', () => {
    down('KeyW');
    down('KeyD');
    expect(input.consume(FIXED_DT)).toMatchObject({ moveX: 1, moveZ: 1 });
  });

  it('cancels opposing keys and keeps an action held while either key is down', () => {
    down('KeyW');
    down('KeyS');
    expect(input.consume(FIXED_DT).moveZ).toBe(0);
    up('KeyS');
    expect(input.consume(FIXED_DT).moveZ).toBe(1);
    down('ArrowUp');
    up('KeyW');
    expect(input.consume(FIXED_DT).moveZ).toBe(1);
  });

  it('tracks sprint on either shift key', () => {
    down('ShiftLeft');
    expect(input.consume(FIXED_DT).sprint).toBe(true);
    up('ShiftLeft');
    down('ShiftRight');
    expect(input.consume(FIXED_DT).sprint).toBe(true);
    up('ShiftRight');
    expect(input.consume(FIXED_DT).sprint).toBe(false);
  });

  it('latches a jump press until a fixed step consumes it, exactly once', () => {
    down('Space');
    up('Space'); // released before any step ran
    expect(input.consume(FIXED_DT).jumpPressed).toBe(true);
    expect(input.consume(FIXED_DT).jumpPressed).toBe(false);
  });

  it('gives only the first of several steps in a frame the jump edge, and ignores key repeat', () => {
    down('Space');
    expect([input.consume(FIXED_DT), input.consume(FIXED_DT), input.consume(FIXED_DT)].map((f) => f.jumpPressed)).toEqual([
      true,
      false,
      false,
    ]);
    down('Space', { repeat: true });
    down('Space');
    expect(input.consume(FIXED_DT).jumpPressed).toBe(false);
    up('Space');
    down('Space');
    expect(input.consume(FIXED_DT).jumpPressed).toBe(true);
  });

  it('turns the camera with Q (positive yaw) and E (negative yaw) at a fixed rate', () => {
    down('KeyQ');
    expect(input.consume(0.5).cameraYaw).toBeCloseTo(YAW_RATE * 0.5);
    up('KeyQ');
    down('KeyE');
    input.consume(0.5);
    expect(input.yaw).toBeCloseTo(0);
    input.consume(0.25);
    expect(input.yaw).toBeCloseTo(-YAW_RATE * 0.25);
  });

  it('calls onRestart for R once per press, not on repeat', () => {
    down('KeyR');
    down('KeyR', { repeat: true });
    expect(onRestart).toHaveBeenCalledTimes(1);
    up('KeyR');
    down('KeyR');
    expect(onRestart).toHaveBeenCalledTimes(2);
  });

  it('clears held keys and a pending jump when the window loses focus', () => {
    down('KeyW');
    down('ShiftLeft');
    down('KeyQ');
    down('Space');
    window.dispatchEvent(new Event('blur'));
    expect(input.consume(FIXED_DT)).toEqual({ moveX: 0, moveZ: 0, jumpPressed: false, sprint: false, cameraYaw: 0 });
  });

  it('clearHeld releases keys but keeps the yaw; reset also restores yaw 0', () => {
    down('KeyQ');
    input.consume(1);
    const yaw = input.yaw;
    down('KeyW');
    input.clearHeld();
    expect(input.consume(0)).toMatchObject({ moveZ: 0, cameraYaw: yaw });
    down('Space');
    input.reset();
    expect(input.consume(FIXED_DT)).toEqual({ moveX: 0, moveZ: 0, jumpPressed: false, sprint: false, cameraYaw: 0 });
  });

  it('prevents default (page scroll) for handled keys only', () => {
    expect(down('Space').defaultPrevented).toBe(true);
    expect(down('ArrowDown').defaultPrevented).toBe(true);
    expect(down('KeyW').defaultPrevented).toBe(true);
    expect(down('KeyK').defaultPrevented).toBe(false);
    expect(down('Tab').defaultPrevented).toBe(false);
  });

  it('ignores shortcuts that target interactive controls', () => {
    const button = document.createElement('button');
    const field = document.createElement('input');
    const inner = document.createElement('span');
    button.append(inner);
    document.body.append(button, field);
    for (const target of [button, inner, field]) {
      const event = down('Space', {}, target);
      expect(event.defaultPrevented).toBe(false);
    }
    down('KeyW', {}, field);
    down('KeyW', {}, button);
    down('KeyR', {}, field);
    expect(onRestart).not.toHaveBeenCalled();
    expect(input.consume(FIXED_DT)).toMatchObject({ moveZ: 0, jumpPressed: false });
  });

  it('still lets R restart while a button (such as the HUD restart button) has focus', () => {
    const button = document.createElement('button');
    document.body.append(button);
    down('KeyR', {}, button);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('handles keys aimed at a focused canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    document.body.append(canvas);
    canvas.focus();
    expect(down('Space', {}, canvas).defaultPrevented).toBe(true);
    expect(input.consume(FIXED_DT).jumpPressed).toBe(true);
  });

  it('does not hijack browser shortcuts with modifiers', () => {
    expect(down('KeyR', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(down('KeyW', { metaKey: true }).defaultPrevented).toBe(false);
    expect(down('KeyA', { altKey: true }).defaultPrevented).toBe(false);
    expect(onRestart).not.toHaveBeenCalled();
    expect(input.consume(FIXED_DT)).toMatchObject({ moveX: 0, moveZ: 0 });
  });

  it('still releases a key whose keyup lands on a control after focus moved', () => {
    const button = document.createElement('button');
    document.body.append(button);
    down('KeyW');
    up('KeyW', {}, button);
    expect(input.consume(FIXED_DT).moveZ).toBe(0);
  });

  it('stops listening after dispose', () => {
    input.dispose();
    down('KeyW');
    down('KeyR');
    expect(input.consume(FIXED_DT).moveZ).toBe(0);
    expect(onRestart).not.toHaveBeenCalled();
  });
});

describe('isInteractiveTarget', () => {
  it('recognises controls and their descendants but not plain elements', () => {
    const link = document.createElement('a');
    link.href = '#x';
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const div = document.createElement('div');
    expect(isInteractiveTarget(link)).toBe(true);
    expect(isInteractiveTarget(editable)).toBe(true);
    expect(isInteractiveTarget(div)).toBe(false);
    expect(isInteractiveTarget(window)).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });

  it('separates text entry from buttons', () => {
    const area = document.createElement('textarea');
    const button = document.createElement('button');
    const submit = document.createElement('input');
    submit.type = 'submit';
    expect(isTextEntryTarget(area)).toBe(true);
    expect(isTextEntryTarget(button)).toBe(false);
    expect(isTextEntryTarget(submit)).toBe(false);
    expect(isTextEntryTarget(window)).toBe(false);
  });
});

describe('createFixedStepper', () => {
  it('runs one step per 1/60 s and carries the remainder', () => {
    const stepper = createFixedStepper();
    const step = vi.fn();
    expect(stepper.advance(FIXED_DT / 2, step)).toBe(0);
    expect(stepper.advance(FIXED_DT / 2, step)).toBe(1);
    expect(stepper.advance(FIXED_DT * 2.5, step)).toBe(2);
    expect(stepper.advance(FIXED_DT * 0.5, step)).toBe(1);
    expect(step).toHaveBeenCalledTimes(4);
  });

  it('does not lose steps to rounding over 60 frames of 1/60 s', () => {
    const stepper = createFixedStepper();
    let steps = 0;
    for (let i = 0; i < 60; i++) steps += stepper.advance(1 / 60, () => {});
    expect(steps).toBe(60);
  });

  it('caps the accumulator after a long stall', () => {
    const stepper = createFixedStepper();
    const steps = stepper.advance(30, () => {});
    expect(steps).toBe(Math.floor(MAX_ACCUMULATED / FIXED_DT + 1e-9));
    expect(stepper.advance(0, () => {})).toBe(0);
  });

  it('reset drops accumulated time, and bad durations count as zero', () => {
    const stepper = createFixedStepper();
    stepper.advance(FIXED_DT * 0.9, () => {});
    stepper.reset();
    expect(stepper.advance(FIXED_DT * 0.2, () => {})).toBe(0);
    expect(stepper.advance(Number.NaN, () => {})).toBe(0);
    expect(stepper.advance(-5, () => {})).toBe(0);
  });
});
