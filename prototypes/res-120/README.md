# RES-120 low-poly platformer prototype

A small playable three.js platformer: an original low-poly character, a compact course, jumping, collectible stars and a goal. All geometry is generated in code; there are no external or third-party game assets.

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

Movement is relative to the camera: `W`/Up moves away from the camera.

## How it plays

- Collect every star (the HUD shows `collected / total`).
- Touching the goal before all stars are collected does nothing except show a hint.
- Reaching the goal with every star wins: the game freezes and shows a win screen.
- Falling off the course puts only the player back at the start; collected stars stay collected.
- `R` resets everything: player, stars, and win state.
- Switching tabs or hiding the page pauses the game; losing window focus releases all held keys.

## Layout

- `src/main.js`: renderer, lights, camera, input, HUD and game loop.
- `src/game-state.js`: renderer-independent progression (collecting, goal gating, falls, restart).
- `src/world.js` and `src/player.js`: the course and the character, built separately (`createWorld()`, `createPlayer()`).
- `tests/game-state.test.js`: progression tests.

## Manual smoke checklist

Run `npm run dev` and open the printed URL.

- [ ] **Movement:** WASD and the arrow keys move the character; diagonals are not faster than straight lines; releasing keys stops movement.
- [ ] **Camera:** the camera follows smoothly; `W` always moves away from the camera.
- [ ] **Jump:** Space jumps once per press; holding Space does not bunny-hop; the page does not scroll with Space or arrows.
- [ ] **Collision:** the character cannot walk through platforms or obstacles and can land on them.
- [ ] **Collectibles:** touching a star hides it and increments the HUD counter; it cannot be counted twice.
- [ ] **Goal blocked early:** touching the goal with stars missing shows a hint and does not win.
- [ ] **Win:** with all stars collected, touching the goal shows the win screen and input is frozen.
- [ ] **Respawn:** falling off the course returns only the player to the start; the star count is unchanged.
- [ ] **Restart:** `R` (during play and on the win screen) restores all stars, the counter, and the player position.
- [ ] **Resize:** resizing the window keeps the full view, with no stretching.
- [ ] **Tabs:** switch to another tab and back: the game is paused while hidden, resumes without a jump, and no key stays stuck. Clicking outside the window while holding a key also releases it.
- [ ] **No WebGL:** with WebGL disabled the page shows a message instead of a blank screen.
