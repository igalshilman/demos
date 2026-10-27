# Floating Islands

A small, original Three.js platformer: hop across a compact course of floating islands, collect every glowing token, then reach the finish goal. Built with plain ES modules and Vite.

## Getting started

```sh
npm install
npm run dev       # start the dev server (Vite prints the local URL)
npm test          # Node tests for the game rules (node --test tests/*.test.js)
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

Requires Node 18+ and a browser with WebGL.

## Controls

| Action | Input |
| --- | --- |
| Move (relative to the camera) | `W A S D` or arrow keys |
| Jump | `Space` |
| Orbit camera | Drag with the mouse (no pointer lock) |
| Zoom camera | Mouse wheel |
| Restart | `R` or the **Restart** button |

Keys are cleared when the window loses focus or the tab is hidden, and the game pauses while the tab is hidden or after you win. Arrow keys and Space do not scroll the page.

## Rules

- Touch a token to collect it (once each). A token counts when it is within its radius plus the character radius (0.35) of the body center, 0.7 above the feet.
- The goal unlocks once every token is collected. Walking into the goal radius with your feet wins.
- Falling below the level's kill height respawns you at the start and keeps your tokens.
- Restart resets tokens, timer, player, camera and the victory screen.

## Architecture

| File | Responsibility |
| --- | --- |
| `index.html`, `src/styles.css` | Page shell, canvas, HUD styling |
| `src/main.js` | Renderer, lights, resize, fixed 1/60 s timestep (capped catch-up) inside `requestAnimationFrame`, wiring of all modules |
| `src/game-state.js` | Pure, DOM-free rules: collection, goal gating, falls, win, timer, restart. Covered by `tests/game-state.test.js` |
| `src/input.js` | Keyboard state; produces `{moveX, moveZ, jumpPressed}` in world space (length <= 1, one-step jump edge) from the camera yaw |
| `src/camera.js` | Third-person follow camera with drag orbit, pitch/distance limits and smooth follow |
| `src/ui.js` | HUD, win, loading and error panels (semantic buttons, `textContent` only) |
| `src/world.js` | Level, separately owned: `createWorld()` returns `{group, platforms, coins, spawn, goal, killY, update(dt), dispose()}` |
| `src/player.js` | Player controller, separately owned: `createPlayer({platforms, spawn})` returns `{group, position, grounded, step(dt, input), reset(position), dispose()}` |

`main.js` only relies on those two interfaces, so the world and player modules can change independently.

## Original art scope

All visuals are generated in code from Three.js primitives (boxes, cones, cylinders, capsules) with flat colors and emissive materials. There are no imported models, textures, audio or third-party art, and nothing is derived from existing games.
