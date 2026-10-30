import { describe, it, expect, vi } from 'vitest';
import { createHud } from '../src/ui/hud.js';

// createHud({ totalOrbs, onRestart }) builds its elements with the global
// document and returns { setOrbs(n), setTime(seconds), showWin(), hide() }.
const text = () => document.body.textContent;

describe('createHud', () => {
  it('mounts itself into the document', () => {
    createHud({ totalOrbs: 10, onRestart: () => {} });
    expect(document.body.children.length).toBeGreaterThan(0);
  });

  it('shows the orb count out of the total', () => {
    const hud = createHud({ totalOrbs: 10, onRestart: () => {} });
    hud.setOrbs(0);
    expect(text()).toContain('0 / 10');
    hud.setOrbs(7);
    expect(text()).toContain('7 / 10');
    expect(text()).not.toContain('0 / 10');
  });

  it('formats time as m:ss', () => {
    const hud = createHud({ totalOrbs: 10, onRestart: () => {} });
    hud.setTime(0);
    expect(text()).toContain('0:00');
    hud.setTime(65);
    expect(text()).toContain('1:05');
    expect(text()).not.toContain('0:00');
  });

  it('floors fractional seconds', () => {
    const hud = createHud({ totalOrbs: 10, onRestart: () => {} });
    hud.setTime(59.9);
    expect(text()).toContain('0:59');
  });

  it('shows the course clear overlay on win and hides it again', () => {
    const hud = createHud({ totalOrbs: 10, onRestart: () => {} });
    const winEl = () =>
      [...document.body.descendants()].find((el) => /clear|win/i.test(el.className + el.id));
    expect(winEl()).toBeTruthy();
    const visible = (el) => !el.hidden && el.style.display !== 'none';

    hud.hide();
    expect(visible(winEl())).toBe(false);
    hud.showWin();
    expect(visible(winEl())).toBe(true);
    hud.hide();
    expect(visible(winEl())).toBe(false);
  });

  it('calls onRestart when the restart button is clicked', () => {
    const onRestart = vi.fn();
    createHud({ totalOrbs: 10, onRestart });
    const button = document.body.querySelector('button');
    expect(button).toBeTruthy();
    expect(onRestart).not.toHaveBeenCalled();
    button.click();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
