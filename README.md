# Platformer prototype

A small, playable 3D platformer for desktop browsers, inspired by the movement and exploration feel of
Super Mario 64: run, sprint, jump between platforms, collect every token, then reach the goal.
Built with TypeScript, Vite and Three.js; tested with Vitest and Playwright.

## Run it

```sh
npm install
npm run dev          # http://127.0.0.1:5173
npm run build        # type-check + production build into dist/
npm test             # Vitest unit tests (deterministic, no browser)
npx playwright install chromium   # once, to download the test browser
npm run test:e2e     # builds, serves with `vite preview`, runs Playwright smoke tests
```

## Controls

| Input                | Action                        |
| -------------------- | ----------------------------- |
| `W A S D` / arrows   | Move (relative to the camera) |
| `Space`              | Jump                          |
| `Shift`              | Sprint                        |
| `Q` / `E`            | Turn the camera left / right  |
| `R` or HUD button    | Restart                       |

The HUD also lists these controls. Keyboard notes: the game canvas is focused on load and shows a visible focus ring for keyboard users.
Handled keys never scroll the page, shortcuts with Ctrl/Cmd/Alt are left to the browser, and movement
shortcuts are ignored while a button, link or text field has focus (`R` still restarts from a focused
button, because the HUD focuses its restart button on victory). Held keys are released when the window
loses focus or the tab is hidden. A jump press is latched until a simulation step consumes it, so a quick
tap is never lost between steps.

## How it fits together

| File                | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `src/contracts.ts`  | Shared types (`InputFrame`, `WorldData`, `PlayerHandle`, ...), constants, fixed stepper |
| `src/input.ts`      | Keyboard input: held keys, jump latch, Q/E yaw, restart shortcut                       |
| `src/main.ts`       | Renderer, scene lighting, fixed-step loop, resize, restart, teardown                   |
| `src/world.ts`      | `createWorld()`: static level, coins, goal                                             |
| `src/player.ts`     | `createPlayer(spawn)`: movement and collision                                          |
| `src/camera.ts`     | `createCameraRig(camera)`: follow camera                                               |
| `src/game.ts`       | `createGame(data)`: coin collection, win, deaths, timer                                |
| `src/hud.ts`        | `createHud(container, onRestart)`: overlay                                             |

Conventions (see `src/contracts.ts`): Y is up; yaw 0 faces world -Z and positive yaw turns
counter-clockwise seen from above; `moveZ` is positive forward and `moveX` positive right. The player owns
diagonal normalisation. The player position is its feet; the collision body has radius 0.35 and height 1.5.

### The loop

The simulation advances in fixed 1/60 s steps from an accumulator capped at 0.25 s, so a slow frame never
causes a catch-up spiral. Each step: read input, update the player, tick the game, and on respawn reset the
player and camera. After the steps of a frame the shell syncs coin visibility, the HUD and the renderer.
When the game is won the player and clock freeze, but restarting stays available. Hiding the tab pauses
the loop, and on return the timing is reset so no time passes while away. Restart resets the game, player,
held input, camera yaw and camera smoothing.

The renderer caps device pixel ratio at 2, follows the viewport size with a `ResizeObserver`, and shows a
readable message if WebGL is unavailable. `startApp(...).dispose()` tears everything down (also used on Vite
hot reload).

### Test hook

`window.__PROTOTYPE__` exposes `snapshot()`, `step(count)`, `teleport(x, y, z)`, `restart()` and the world
data. The browser tests use it to run fixed steps deterministically and to reach the win state quickly;
it is also handy in the dev console.

## Art and asset policy

Everything on screen is an original placeholder made from Three.js primitives (boxes, cylinders, capsules)
with flat colours. No Nintendo characters, names, music, textures, models or other assets are used, and no
third-party assets are imported. Replace placeholders only with assets you created or have licensed.

## Scope

This is a deliberately small prototype: one static level, a short collectible challenge, desktop browsers
with a keyboard only. Not included: enemies, slopes, moving platforms, mobile/touch controls, audio, or
imported assets.
