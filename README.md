# Block Hopper

A first-playable 3D platformer prototype that runs in the browser, built with Three.js, TypeScript and Vite. Run across a small obstacle course, collect every gem, then reach the goal.

## Setup

```sh
npm install
npm run dev       # start the dev server (Vite prints the local URL)
npm run build     # type-check and build to dist/
npm run preview   # serve the production build
npm test          # run the unit tests (Vitest)
```

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D or arrow keys | Move (W = away from the camera, diagonals are normalized) |
| Space | Jump |
| R or the Restart button | Restart the course |

## Rules

- Walk into a gem to collect it (each gem counts once).
- The goal only counts once all gems are collected.
- Reaching the unlocked goal wins and freezes the game until you restart.
- Falling below y = -12 restarts the course, including gems.

## Layout

- `src/main.ts`: renderer, scene, camera, input, HUD and the animation loop.
- `src/game-session.ts`: game rules (collection, goal, win, fall, restart), independent of the browser.
- `src/game-session.test.ts`: unit tests for those rules.
- `src/player.ts` and `src/level.ts`: the character and the course, each exposing `createPlayer` and `createLevel`.

## Manual browser checklist

Unit tests do not cover rendering or input. Before calling a build good, check in a browser:

- [ ] The page loads with no console errors and the course and character are visible.
- [ ] WASD and arrow keys move the character; W goes away from the camera, D to the right; diagonals are not faster.
- [ ] Space jumps once per press; holding it does not repeat; the page never scrolls.
- [ ] The camera follows the character smoothly.
- [ ] The gem counter updates as gems are collected, and each gem disappears once.
- [ ] Reaching the goal early does nothing; after all gems it shows the win screen and the game freezes.
- [ ] R, the Restart button and "Play again" all reset the character, gems and HUD.
- [ ] Falling off the course resets everything.
- [ ] Switching tabs or windows and returning does not cause a jump, and no key stays stuck.
- [ ] Resizing the window, and a narrow phone-sized window, keeps the HUD readable.
