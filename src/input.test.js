import { describe, it, expect, vi } from 'vitest';
import { createInput } from './input.js';

function key(target, type, code, extra = {}) {
  const event = new Event(type);
  event.code = code;
  Object.assign(event, extra);
  target.dispatchEvent(event);
  return event;
}

describe('createInput', () => {
  it('tracks WASD and arrow keys', () => {
    const target = new EventTarget();
    const { state } = createInput(target);
    key(target, 'keydown', 'KeyW');
    expect(state.forward).toBe(true);
    expect(state.moveZ).toBe(1);
    key(target, 'keydown', 'ArrowLeft');
    expect(state.left).toBe(true);
    expect(state.moveX).toBe(-1);
    key(target, 'keydown', 'KeyD');
    expect(state.moveX).toBe(0);
    key(target, 'keyup', 'KeyW');
    key(target, 'keydown', 'ArrowDown');
    expect(state.moveZ).toBe(-1);
    key(target, 'keyup', 'ArrowDown');
    expect(state.moveZ).toBe(0);
  });

  it('reports jumpPressed for one frame only', () => {
    const target = new EventTarget();
    const input = createInput(target);
    key(target, 'keydown', 'Space');
    expect(input.state.jump).toBe(true);
    expect(input.state.jumpPressed).toBe(true);
    input.endFrame();
    expect(input.state.jumpPressed).toBe(false);
    expect(input.state.jump).toBe(true);
    key(target, 'keydown', 'Space', { repeat: true });
    expect(input.state.jumpPressed).toBe(false);
    key(target, 'keyup', 'Space');
    expect(input.state.jump).toBe(false);
  });

  it('handles restart with R', () => {
    const target = new EventTarget();
    const onRestart = vi.fn();
    const input = createInput(target, { onRestart });
    key(target, 'keydown', 'KeyR');
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(input.state.restartPressed).toBe(true);
    input.endFrame();
    expect(input.state.restartPressed).toBe(false);
  });

  it('prevents page scrolling keys and clears on blur', () => {
    const target = new EventTarget();
    const input = createInput(target);
    const preventDefault = vi.fn();
    key(target, 'keydown', 'Space', { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    key(target, 'keydown', 'KeyA');
    target.dispatchEvent(new Event('blur'));
    expect(input.state.left).toBe(false);
    expect(input.state.jump).toBe(false);
  });

  it('ignores events after dispose', () => {
    const target = new EventTarget();
    const input = createInput(target);
    input.dispose();
    key(target, 'keydown', 'KeyW');
    expect(input.state.forward).toBe(false);
  });
});
