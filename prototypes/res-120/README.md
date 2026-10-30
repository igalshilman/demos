# RES-120 low-poly platformer prototype

A small playable three.js platformer: an original low-poly character, a compact course, jumping, collectible gems and a goal. All geometry is generated in code; there are no external or third-party game assets.

The app is self-contained in this folder (Vite, ES modules, three.js pinned to exact versions).

## Requirements

- Node.js 20.19 or newer (Node 22.12+ also works). Vite 8 requires it.
- A browser with WebGL (any current desktop Chrome, Firefox, Safari or Edge).

## Run it

```sh
cd prototypes/res-120
npm ci
npm run dev       # dev server with hot reload, prints the local URL
npm test          # unit tests for the game progression logic
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Controls

| Action  | Keys                          |
| ------- | ----------------------------- |
| Move    | `W` `A` `S` `D` or arrow keys |
| Jump    | `Space` (one jump per press)  |
| Restart | `R`                           |

Movement is relative to the camera: `W`/Up moves away from the camera, which looks along the course (towards +X), so `W` runs the route and `D` strafes to the right.

## How it plays

- Collect every gem (the HUD shows `collected / total`).
- Touching the goal before all gems are collected does nothing except show a hint.
- Reaching the goal with every gem wins: the game freezes and shows a win screen.
- Falling off the course puts only the player back at the start; collected gems stay collected.
- `R` resets everything: player, gems, and win state.
- Switching tabs or hiding the page pauses the game; losing window focus releases all held keys.

## Layout

- `src/main.js`: renderer, lights, camera, input, HUD and game loop.
- `src/game-state.js`: renderer-independent progression (collecting, goal gating, falls, restart).
- `src/world.js` and `src/player.js`: the course and the character, built in separate pull requests (`createWorld()`, `createPlayer()`). `main.js` imports them, so they must be present for `dev` and `build` to work.
- `tests/game-state.test.js`: progression tests.

## Manual smoke checklist

Run `npm run dev` and open the printed URL.

- [ ] **Movement:** WASD and the arrow keys move the character; diagonals are not faster than straight lines; releasing keys stops movement.
- [ ] **Camera:** the camera follows smoothly; `W` always moves away from the camera.
- [ ] **Jump:** Space jumps once per press; holding Space does not bunny-hop; the page does not scroll with Space or arrows.
- [ ] **Collision:** the character cannot walk through platforms or obstacles and can land on them.
- [ ] **Collectibles:** touching a gem hides it and increments the HUD counter; it cannot be counted twice.
- [ ] **Goal blocked early:** touching the goal with gems missing shows a hint and does not win.
- [ ] **Win:** with all gems collected, touching the goal shows the win screen and input is frozen.
- [ ] **Respawn:** falling off the course returns only the player to the start; the gem count is unchanged.
- [ ] **Restart:** `R` (during play and on the win screen) restores all gems, the counter, and the player position.
- [ ] **Resize:** resizing the window keeps the full view, with no stretching.
- [ ] **Tabs:** switch to another tab and back: the game is paused while hidden, resumes without a jump, and no key stays stuck. Clicking outside the window while holding a key also releases it.
- [ ] **No WebGL:** with WebGL disabled the page shows a message instead of a blank screen.

## Integration check (2026-10-30)

The app was checked against the real `world.js` and `player.js` from the companion pull requests (#57 world, #59 player), merged locally in a throwaway worktree (nothing was merged on GitHub, no stubs committed).

- `npm ci`, `npm test` (55 tests: game state, world and player) and `npm run build` all pass on the integrated tree.
- Browser smoke run with headless Chromium (software WebGL) against `npm run preview` (the production build), no console or page errors:
  - Verified by real key presses: WASD/arrow movement along the camera direction, a single jump per Space press (holding does not re-jump), landing on the meadow platform, picking up the first gem (HUD 1 / 6), gameplay keys call `preventDefault`, blur stops held movement, `R` restart.
  - Verified by moving the player with a temporary debug hook (not committed): goal blocked with gems missing, fall reset keeps progress (player back at spawn, HUD unchanged), all six gems then the goal shows the win screen and freezes input, `R` restores gems, HUD and spawn.
  - Verified: canvas follows window resize, hidden tab pauses and resumes, the no-WebGL message appears when WebGL is blocked.
- Not done: the full course was not played end to end by hand with a keyboard; real-GPU browsers (Firefox, Safari) were not tried.
