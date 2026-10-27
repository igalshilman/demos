// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHud } from '../src/hud';
import type { GameState } from '../src/contracts';

const state = (over: Partial<GameState> = {}, ids: string[] = []): GameState => ({
  status: 'playing',
  collected: new Set(ids),
  deaths: 0,
  elapsed: 0,
  ...over,
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);

describe('createHud', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });
  afterEach(() => container.remove());

  const q = <T extends Element>(sel: string) => container.querySelector<T>(sel)!;

  it('renders title, stats, progress, controls and no Nintendo branding', () => {
    const hud = createHud(container, () => {});
    hud.update(state({ elapsed: 12.34, deaths: 2 }, ids(3)), 8);
    const text = container.textContent ?? '';
    expect(q('.lh-hud__title').textContent).toBe('Lumen Hop');
    expect(text).toContain('3 / 8');
    expect(text).toContain('00:12.3');
    expect(text).toMatch(/Falls\s*2/);
    for (const key of ['W', 'A', 'S', 'D', 'Space', 'Shift', 'Q', 'E', 'R']) {
      expect(Array.from(container.querySelectorAll('kbd')).map((k) => k.textContent)).toContain(key);
    }
    expect(text.toLowerCase()).not.toMatch(/nintendo|mario/);
    const progress = q<HTMLProgressElement>('progress');
    expect(progress.max).toBe(8);
    expect(progress.value).toBe(3);
    expect(progress.getAttribute('aria-label')).toBeTruthy();
    expect(q('section').getAttribute('aria-label')).toBeTruthy();
  });

  it('shows locked then unlocked finish state', () => {
    const hud = createHud(container, () => {});
    hud.update(state({}, ids(7)), 8);
    expect(q('.lh-hud__goal').textContent).toContain('locked');
    expect(q('.lh-hud__goal').textContent).toContain('1 token to go');
    expect(q('.lh-hud').classList.contains('lh-hud--unlocked')).toBe(false);
    hud.update(state({}, ids(8)), 8);
    expect(q('.lh-hud__goal').textContent).toContain('unlocked');
    expect(q('.lh-hud').classList.contains('lh-hud--unlocked')).toBe(true);
  });

  it('announces progress only when the count changes, never the timer', () => {
    const hud = createHud(container, () => {});
    const live = q('[role="status"]');
    expect(live.getAttribute('aria-live')).toBe('polite');
    hud.update(state({ elapsed: 1 }), 8);
    expect(live.textContent).toBe('');
    hud.update(state({ elapsed: 2 }, ids(1)), 8);
    expect(live.textContent).toBe('1 of 8 tokens collected.');
    live.textContent = 'sentinel';
    hud.update(state({ elapsed: 3 }, ids(1)), 8);
    expect(live.textContent).toBe('sentinel');
    expect(live.textContent).not.toMatch(/\d:\d/);
    hud.update(state({ elapsed: 4 }, ids(8)), 8);
    expect(live.textContent).toContain('Finish unlocked');
  });

  it('shows victory with completion time, announces once, and restarts via native button', () => {
    const onRestart = vi.fn();
    const hud = createHud(container, onRestart);
    const victory = q<HTMLElement>('.lh-hud__victory');
    expect(victory.hidden).toBe(true);
    hud.update(state({ status: 'won', elapsed: 75.4, deaths: 1 }, ids(8)), 8);
    expect(victory.hidden).toBe(false);
    expect(victory.textContent).toContain('01:15.4');
    expect(q('[role="status"]').textContent).toBe('Course complete in 01:15.4.');
    const button = q<HTMLButtonElement>('button');
    expect(button.tagName).toBe('BUTTON');
    expect(button.type).toBe('button');
    expect(document.activeElement).toBe(button);
    button.click();
    expect(onRestart).toHaveBeenCalledTimes(1);
    hud.update(state(), 8);
    expect(victory.hidden).toBe(true);
    expect(q('[role="status"]').textContent).toBe('Course restarted.');
  });

  it('removes DOM and listeners on dispose, and ignores later updates', () => {
    const onRestart = vi.fn();
    const hud = createHud(container, onRestart);
    const button = q<HTMLButtonElement>('button');
    hud.dispose();
    expect(container.children.length).toBe(0);
    button.click();
    expect(onRestart).not.toHaveBeenCalled();
    expect(() => hud.update(state({}, ids(1)), 8)).not.toThrow();
    expect(() => hud.dispose()).not.toThrow();
    expect(container.children.length).toBe(0);
  });
});
