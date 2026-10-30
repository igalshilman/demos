# Star Hopper

A compact 3D platformer for the browser, built with [Three.js](https://threejs.org/) and Vite.
Run, jump across floating platforms and collect all five stars. Everything is drawn from
original procedural shapes and colors; there are no downloaded assets.

## Quick start

```sh
npm install && npm run dev
```

Then open the address Vite prints (usually http://localhost:5173).

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm install`     | Installs dependencies                          |
| `npm run dev`     | Starts the dev server with hot reload          |
| `npm test`        | Runs the automated checks (`vitest run`)       |
| `npm run build`   | Creates a production build in `dist/`          |
| `npm run preview` | Serves the production build locally            |

## Controls

| Input              | Action                                        |
| ------------------ | --------------------------------------------- |
| `W A S D` / arrows | Move, relative to the camera                  |
| `Space`            | Jump                                          |
| `R` or the button  | Restart: player, all stars, counter and victory |

Falling below the world sends you back to the start; stars you already collected stay collected.

## Project layout

- `index.html`, `src/style.css` - page, HUD (star counter, controls, restart, victory, WebGL fallback)
- `src/main.js` - renderer, lights, game loop, camera, HUD wiring
- `src/gameLogic.js` - input, camera-relative movement, follow camera and pickup logic (unit tested)
- `src/world.js` - level: `createWorld(scene)` returns `{spawn, killY, solids, collectibles, dispose()}`
- `src/player.js` - character: `createPlayer(scene, {spawn, solids})` returns `{position, grounded, update(dt, {move, jump}), reset(), dispose()}`

## Manual acceptance checklist

Run `npm run dev` and check each item in a WebGL-capable browser.

- [ ] **Movement**: W/A/S/D and the arrow keys move the character relative to the camera; diagonals are not faster than straight movement; the page never scrolls.
- [ ] **Jump and landing**: Space jumps once per press (holding it does not re-jump mid-air), and the character lands cleanly on platforms and ground.
- [ ] **Platform reachability**: every platform, including the one holding each star, can be reached by jumping.
- [ ] **Pickups and victory**: touching each of the five stars hides it and advances the counter from 0/5 to 5/5; collecting the fifth shows the victory message.
- [ ] **Fall recovery**: walking off the edge returns you to the start; the collected stars and counter are unchanged.
- [ ] **Restart**: pressing R, and separately the Restart button, resets the character, shows all five stars again, sets the counter to 0/5 and hides the victory message.
- [ ] **Resize**: resizing the window (or rotating a device) keeps the canvas full-size with no stretching.
- [ ] **Keyboard focus loss**: hold a movement key, switch to another tab or window and back; the character does not keep moving and no key seems stuck.
- [ ] **No WebGL** (optional): with WebGL disabled the page shows the "WebGL is not available" message instead of a blank screen.
