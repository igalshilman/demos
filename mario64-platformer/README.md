# Crystal Climb

A small, standalone 3D platformer that runs in the browser. Run, jump across platforms, collect five crystals, then reach the finish platform. Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). All visuals are original and made from simple primitive shapes.

## Requirements

- Node.js 20.19 or newer (Node 22 LTS recommended)
- A browser with WebGL support

## Installation

```sh
cd mario64-platformer
npm install
```

## Scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Starts the Vite dev server with hot reload            |
| `npm run build`   | Creates a production build in `dist/`                 |
| `npm run preview` | Serves the production build locally                   |
| `npm test`        | Runs the unit tests (`node --test tests/*.test.js`)   |

Open the address printed by `npm run dev` (usually http://localhost:5173) to play.

## Controls

| Key                | Action                                   |
| ------------------ | ---------------------------------------- |
| `W` `A` `S` `D` / arrow keys | Move, relative to the camera   |
| `Space`            | Jump (one jump per key press)            |
| `Q` / `E`          | Orbit the camera left / right            |
| `R`                | Restart the run                          |

## How to play

- Collect all five crystals. The counter in the top-left shows your progress.
- Once all five are collected, reach the finish platform to win. Touching the finish early does nothing, and a hint tells you how many crystals are left.
- If you fall off the level you respawn at the start. Crystals you already collected stay collected.
- After winning the game pauses. Press `R` to reset crystals, player and victory and play again.

## Project layout

- `src/main.js` - renderer, scene, input, camera, and the game loop
- `src/game-state.js` - pure collection / win rules and camera-relative movement math (no browser or Three.js dependency)
- `src/level.js` - level geometry, collision boxes, crystals and goal
- `src/player-controller.js` - player movement, gravity, jumping and collision
- `tests/game-state.test.js` - unit tests for the game rules

## Scope

This is intentionally a small demo. It has no pointer lock, no sophisticated camera collision (the camera can pass through walls), no sound, and no touch controls. Collision is simple box-based collision handled by the player controller.

## Tests

```sh
npm test
```

The automated tests cover the game rules (collecting each crystal only once, the goal staying locked until all five are collected, winning, restarting), camera-relative movement including a regression test that movement follows the camera as displayed while it is still smoothing towards a new orbit angle, plus the level and player controller tests. Rendering and real input are checked manually.

## Manual test checklist

- [ ] **Movement**: WASD and arrow keys move the player; diagonal movement is not faster than straight movement.
- [ ] **Camera**: The camera follows smoothly from above; `Q` / `E` orbit it; movement keys stay relative to where the camera looks.
- [ ] **Jump**: `Space` jumps once per press; holding it does not bounce repeatedly. The page does not scroll.
- [ ] **Walls**: The player cannot walk or jump through walls and solid blocks, and can land on top of platforms.
- [ ] **Fall**: Walking off the edge respawns the player at the start with collected crystals still hidden.
- [ ] **Pickups**: Touching a crystal hides it and increases the counter; all five reach `5 / 5`.
- [ ] **Goal**: Reaching the finish with fewer than five crystals shows a locked hint; with all five it shows the win message and pauses the game.
- [ ] **Restart**: `R` restores all crystals, returns the player to the start, and clears the win message (also works after winning).
- [ ] **Focus**: Switching to another tab or window while holding a key does not leave the player running when you return.
- [ ] **Resize**: Resizing the browser window keeps the view filling the window with the right proportions.
- [ ] **No WebGL**: With WebGL disabled the page shows a friendly message instead of a blank screen.

## Browser verification log

Run on 2026-10-30 against `npm run dev` with the real level and player controller, in headless Chromium (software WebGL) driven by Playwright with real key presses. To reach pickups quickly, the script teleported the player onto each crystal and the goal; the game logic then ran normally.

Passed:

- Movement, jump and camera: W/D move relative to the camera, and W still moves along the camera's forward direction after orbiting with E; Space jumps.
- Pickups: all five crystals are counted once, hidden when collected, and touching one again does not double count (counter reaches 5 / 5).
- Goal: the finish stays locked before all five crystals, and wins after all five.
- Win pause: no movement after winning.
- Restart: R restores crystals, player position and clears victory.
- Fall reset: falling below the level respawns at the start with collected crystals still collected.
- Focus, scroll and resize: blur clears held keys, Space and arrows do not scroll the page, resizing keeps the aspect ratio right. No console errors.

Not checked in a browser: walking into walls and landing on platforms by hand (covered by the controller's unit tests), the no-WebGL message, and play on a real GPU or with a person at the keyboard.
