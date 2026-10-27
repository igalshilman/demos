import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { PrototypeSnapshot } from '../../src/main';

const snapshot = (page: Page): Promise<PrototypeSnapshot> => page.evaluate(() => window.__PROTOTYPE__!.snapshot());
const step = (page: Page, count: number): Promise<void> => page.evaluate((n) => window.__PROTOTYPE__!.step(n), count);

async function load(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__PROTOTYPE__));
  // Wait for the player to land after spawning.
  await expect.poll(async () => (await snapshot(page)).grounded).toBe(true);
  return problems;
}

test('loads a rendered 3D scene without errors', async ({ page }) => {
  const problems = await load(page);

  await expect(page.locator('#fatal')).toBeHidden();
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await expect(page).toHaveTitle(/platformer/i);

  // Render and copy the frame in the same task so the WebGL buffer is still valid.
  const distinctColours = await page.evaluate(() => {
    window.__PROTOTYPE__!.step(0);
    const source = document.querySelector<HTMLCanvasElement>('#viewport canvas')!;
    const copy = document.createElement('canvas');
    copy.width = 64;
    copy.height = 36;
    const context = copy.getContext('2d')!;
    context.drawImage(source, 0, 0, copy.width, copy.height);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    const colours = new Set<number>();
    for (let i = 0; i < data.length; i += 4) colours.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
    return colours.size;
  });
  expect(distinctColours).toBeGreaterThan(3);

  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).toBe('CANVAS');
  expect(problems).toEqual([]);
});

test('shows the HUD with the coin count', async ({ page }) => {
  await load(page);
  const hud = page.locator('#hud');
  await expect(hud).not.toBeEmpty();
  await expect(hud).toBeVisible();
  const { totalCoins, collected } = await snapshot(page);
  expect(totalCoins).toBeGreaterThan(0);
  await expect(hud).toContainText(new RegExp(`${collected.length}\\s*(/|of)\\s*${totalCoins}`));
});

test('moves forward (-Z), jumps, turns the camera and ignores input after blur', async ({ page }) => {
  await load(page);
  const start = await snapshot(page);

  await page.keyboard.down('KeyW');
  await step(page, 30);
  await page.keyboard.up('KeyW');
  const moved = await snapshot(page);
  expect(moved.position[2]).toBeLessThan(start.position[2] - 0.5);

  // Jump: Space must lift the player off the ground.
  await page.waitForTimeout(400);
  const peak = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let max = -Infinity;
        const begin = performance.now();
        const sample = () => {
          max = Math.max(max, window.__PROTOTYPE__!.snapshot().position[1]);
          if (performance.now() - begin > 700) resolve(max);
          else requestAnimationFrame(sample);
        };
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
        requestAnimationFrame(sample);
      }),
  );
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })));
  expect(peak).toBeGreaterThan(moved.position[1] + 0.5);

  // Q turns the camera (positive yaw).
  await page.keyboard.down('KeyQ');
  await step(page, 30);
  await page.keyboard.up('KeyQ');
  expect((await snapshot(page)).yaw).toBeGreaterThan(0.5);

  // Holding a key and losing focus must not leave the player running.
  await expect.poll(async () => (await snapshot(page)).grounded).toBe(true);
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const before = await snapshot(page);
  await step(page, 30);
  const after = await snapshot(page);
  await page.keyboard.up('KeyW');
  expect(after.position[0]).toBeCloseTo(before.position[0], 3);
  expect(after.position[2]).toBeCloseTo(before.position[2], 3);
});

test('handled keys do not scroll the page', async ({ page }) => {
  await load(page);
  const prevented = await page.evaluate(() => {
    const results: Record<string, boolean> = {};
    const listener = (event: KeyboardEvent) => {
      results[event.code] = event.defaultPrevented;
    };
    window.addEventListener('keydown', listener);
    for (const code of ['Space', 'ArrowDown', 'ArrowUp']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
    }
    window.removeEventListener('keydown', listener);
    return results;
  });
  expect(prevented).toEqual({ Space: true, ArrowDown: true, ArrowUp: true });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('resizes the canvas with the window', async ({ page }) => {
  await load(page);
  for (const [width, height] of [
    [800, 500],
    [1100, 700],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () => {
        const { canvas, pixelRatio } = await snapshot(page);
        return [canvas.clientWidth, canvas.clientHeight, canvas.width, canvas.height].join('x') ===
          [width, height, Math.floor(width * pixelRatio), Math.floor(height * pixelRatio)].join('x');
      })
      .toBe(true);
    const aspect = await page.evaluate(() => {
      const { canvas } = window.__PROTOTYPE__!.snapshot();
      return canvas.width / canvas.height;
    });
    expect(aspect).toBeCloseTo(width / height, 1);
  }
});

test.describe('high density display', () => {
  test.use({ deviceScaleFactor: 3 });
  test('caps the pixel ratio at 2', async ({ page }) => {
    await load(page);
    const { canvas, pixelRatio } = await snapshot(page);
    expect(pixelRatio).toBe(2);
    expect(canvas.width).toBe(canvas.clientWidth * 2);
  });
});

test('restart (R key, twice) resets position, yaw, coins and timer', async ({ page }) => {
  await load(page);
  const start = await snapshot(page);

  const dirty = async () => {
    await page.evaluate(() => {
      const world = window.__PROTOTYPE__!.world;
      const last = world.coins[world.coins.length - 1].position;
      window.__PROTOTYPE__!.teleport(last.x, last.y, last.z);
      window.__PROTOTYPE__!.step(1);
    });
    await page.keyboard.down('KeyQ');
    await step(page, 40);
    await page.keyboard.up('KeyQ');
    const now = await snapshot(page);
    expect(now.yaw).toBeGreaterThan(0.3);
    expect(now.collected.length).toBeGreaterThan(start.collected.length);
    expect(now.elapsed).toBeGreaterThan(0.5);
  };
  const expectFresh = async () => {
    await step(page, 2);
    const now = await snapshot(page);
    expect(now.yaw).toBe(0);
    expect(now.collected).toEqual(start.collected);
    expect(now.status).toBe('playing');
    expect(now.elapsed).toBeLessThan(0.3);
    expect(now.position[0]).toBeCloseTo(start.position[0], 1);
    expect(now.position[2]).toBeCloseTo(start.position[2], 1);
  };

  for (let round = 0; round < 2; round++) {
    await dirty();
    await page.keyboard.press('KeyR');
    await expectFresh();
  }
});

async function winGame(page: Page): Promise<void> {
  const positions = await page.evaluate(() => {
    const { coins, goal } = window.__PROTOTYPE__!.world;
    const middle = (min: number, max: number) => (min + max) / 2;
    return [
      ...coins.map((coin) => [coin.position.x, coin.position.y, coin.position.z]),
      [middle(goal.min.x, goal.max.x), middle(goal.min.y, goal.max.y), middle(goal.min.z, goal.max.z)],
    ];
  });
  for (const [x, y, z] of positions) {
    await page.evaluate(
      ([px, py, pz]) => {
        window.__PROTOTYPE__!.teleport(px, py, pz);
        window.__PROTOTYPE__!.step(1);
      },
      [x, y, z],
    );
  }
  expect((await snapshot(page)).status).toBe('won');
}

test('collecting every coin and reaching the goal wins, freezes play and can be restarted', async ({ page }) => {
  await load(page);
  const initial = await snapshot(page);

  await winGame(page);
  const won = await snapshot(page);
  expect(won.collected).toHaveLength(won.totalCoins);
  await expect(page.locator('#hud')).toContainText(new RegExp(`${won.totalCoins}\\s*(/|of)\\s*${won.totalCoins}`));

  // Frozen: no movement and no clock while won.
  await page.keyboard.down('KeyW');
  await step(page, 30);
  await page.keyboard.up('KeyW');
  const later = await snapshot(page);
  expect(later.position).toEqual(won.position);
  expect(later.elapsed).toBe(won.elapsed);

  const restart = page.locator('#hud').getByRole('button', { name: /restart|again/i }).first();
  await expect(restart).toBeVisible();
  await restart.click();
  await step(page, 2);
  const fresh = await snapshot(page);
  expect(fresh.status).toBe('playing');
  expect(fresh.collected).toEqual(initial.collected);
  expect(fresh.yaw).toBe(0);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
  await expect(restart).toBeHidden();

  await page.keyboard.down('KeyW');
  await step(page, 20);
  await page.keyboard.up('KeyW');
  expect((await snapshot(page)).position[2]).toBeLessThan(fresh.position[2] - 0.2);
});

test('R restarts from the victory screen even though the HUD button has focus', async ({ page }) => {
  await load(page);
  await winGame(page);
  const restart = page.locator('#hud').getByRole('button', { name: /restart|again/i }).first();
  await expect(restart).toBeVisible();
  await page.keyboard.press('KeyR');
  await expect.poll(async () => (await snapshot(page)).status).toBe('playing');
  await expect(restart).toBeHidden();
});

test('shows a clear message when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  const fatal = page.locator('#fatal');
  await expect(fatal).toBeVisible();
  await expect(fatal).toContainText(/WebGL/);
  await expect(page.locator('#viewport canvas')).toHaveCount(0);
});
