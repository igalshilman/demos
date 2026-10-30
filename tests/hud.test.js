import { describe, it, expect, vi } from 'vitest';
import { createHud, formatTime } from '../src/ui/hud.js';

const mount = () => {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const hud = createHud(root);
  const part = (name) => root.querySelector(`[data-hud="${name}"]`);
  return { root, hud, part };
};

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(600)).toBe('10:00');
  });

  it('floors fractions and clamps bad values to 0:00', () => {
    expect(formatTime(59.9)).toBe('0:59');
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});

describe('createHud', () => {
  it('mounts its element into the root', () => {
    const { root, hud } = mount();
    expect(root.children).toContain(hud.element);
  });

  it('shows the orb count out of the total', () => {
    const { hud, part } = mount();
    expect(part('coins').textContent).toBe('Orbs: 0 / 0');
    hud.setCoins(7, 10);
    expect(part('coins').textContent).toBe('Orbs: 7 / 10');
    hud.setCoins(0, 10);
    expect(part('coins').textContent).toBe('Orbs: 0 / 10');
  });

  it('shows the time as 0:00 and 1:05', () => {
    const { hud, part } = mount();
    expect(part('time').textContent).toBe('Time: 0:00');
    hud.setTime(65);
    expect(part('time').textContent).toBe('Time: 1:05');
    hud.setTime(0);
    expect(part('time').textContent).toBe('Time: 0:00');
  });

  it('floors fractional seconds in the time display', () => {
    const { hud, part } = mount();
    hud.setTime(59.9);
    expect(part('time').textContent).toBe('Time: 0:59');
  });

  it('starts with the win overlay hidden, shows it with the final time, and hides it again', () => {
    const { hud, part } = mount();
    expect(part('win').hidden).toBe(true);
    hud.showWin(65);
    expect(part('win').hidden).toBe(false);
    expect(part('win-time').textContent).toBe('Your time: 1:05');
    expect(part('win').textContent).toContain('Course clear!');
    hud.hideWin();
    expect(part('win').hidden).toBe(true);
  });

  it('calls the restart callback when the restart button is clicked', () => {
    const { hud, part } = mount();
    const onRestart = vi.fn();
    hud.onRestart(onRestart);
    expect(onRestart).not.toHaveBeenCalled();
    part('restart').click();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the button is clicked with no callback', () => {
    const { part } = mount();
    expect(() => part('restart').click()).not.toThrow();
  });

  it('reset clears the orb count, time and win overlay', () => {
    const { hud, part } = mount();
    hud.setCoins(10, 10);
    hud.setTime(65);
    hud.showWin(65);
    hud.reset();
    expect(part('coins').textContent).toBe('Orbs: 0 / 10');
    expect(part('time').textContent).toBe('Time: 0:00');
    expect(part('win').hidden).toBe(true);
  });
});
