# Mario64 Demo – First Playable

A small, self-contained 3D platformer built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/). Run to the goal across a course of platforms. Everything lives in this folder and does not touch the rest of the repository.

## Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite) and npm
- A browser with WebGL support

## Commands

Run from the `mario64/` directory:

```sh
npm install      # install dependencies (three, vite)
npm run dev      # start the dev server with hot reload
npm run build    # production build into dist/
npm run preview  # serve the production build locally
npm test         # node --test tests/*.test.js
```

## Controls

| Action  | Keys                   |
| ------- | ---------------------- |
| Move    | `W` `A` `S` `D` or arrow keys (relative to the camera) |
| Jump    | `Space`                |
| Restart | `R`                    |

Held keys are cleared when the window loses focus or the tab is hidden, and Space/arrow keys never scroll the page.

## How it fits together

- `src/main.js` – renderer, scene, lighting, resize handling, animation loop, HUD/status overlay
- `src/input.js` – keyboard state (held booleans) and restart key
- `src/game.js` – per-frame rules: dt clamp (0.05 s), goal overlap, fall respawn, restart
- `src/level.js` – `createLevel(scene)` → `{ spawn, colliders, goal, respawnY }`
- `src/player.js` – `createPlayer({ scene, spawn, colliders })` → `{ position, update(dt, input, cameraForward), reset(), getBounds() }`
- `src/follow-camera.js` – `createFollowCamera(camera)` → `{ update(dt, targetPosition), reset(targetPosition) }`

Each frame the camera's world-forward direction is flattened onto the ground plane and passed to the player, then the follow camera is updated. Touching the goal ends the run and halts the simulation until you restart. Falling below `respawnY` puts you back at the start.

## Original assets

All visuals are original placeholders made from Three.js primitives and flat colours: the character, platforms, and goal. No external models, textures, audio, or third-party game assets are used, and there are no enemies or collectibles.

## Manual checks

After `npm run dev`, open the printed URL and confirm:

1. **Movement** – WASD and arrow keys move the character relative to the camera direction.
2. **Jump** – Space makes the character jump; holding it does not keep re-jumping mid-air.
3. **Land** – the character lands on platforms and stands on them without sinking or jittering.
4. **Side** – running into the side of a platform blocks you rather than passing through.
5. **Fall** – walking off the course respawns you at the start with the camera reset.
6. **Goal** – reaching the goal shows the "You made it!" overlay and the character stops responding.
7. **Restart** – pressing `R` (during play or after winning) returns to the start and clears the victory overlay.
8. **Resize** – resizing the window keeps the scene filling the page with no stretching.
9. **Focus** – release a key after switching tabs or windows: the character must not keep moving.

## Verification record

Last verified on a clean checkout of the PR branch, with the real level, player and follow-camera modules (no stand-ins):

- `npm ci` – clean install succeeds
- `npm test` – all tests pass, including `tests/integration.test.js`, which builds the real level, player and follow camera, drives them with the real input module, and runs a scripted playthrough from spawn to the goal
- `npm run build` – production build succeeds
- `npm run dev` – dev server serves the page and every module (HTTP 200)

Not yet done: the manual browser checks above. No browser was available in the automated environment, so run them once in a real browser before sign-off.

## Known integration notes

- `src/player.js` reads `input.back` for the backward key, while the agreed input shape uses `backward`. `src/input.js` exposes both names so S / Down work today. Once the player module accepts `backward`, the alias can be dropped.
- `src/level.js` adds its own lights; `src/main.js` adds only a gentle fill light on top, to avoid over-exposure.
