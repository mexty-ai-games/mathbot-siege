# MathBot Siege

**Solve to survive.** A neon sci-fi first-person math game for the [EdVerse](https://workspace.mexty.ai/edverse/studio) kids' store.
Robots march into the hangar with a math problem floating above their head. Every robot carries glowing number screens, and only one shows the right answer: aim, shoot it, and the robot powers down.

![Title screen: three robots lined up in the neon hangar under the MathBot Siege logo](docs/screenshots/title.jpg)

## Gameplay

| Robots incoming | Right answer: power down! |
| --- | --- |
| ![Wave 1: a teal drone walks in with "4×5=?" above it and numbers on its screens](docs/screenshots/gameplay.jpg) | ![A correct hit: sparks, +100 and the toast "Math power! 2 × 5 = 10"](docs/screenshots/hit.jpg) |

<img src="docs/screenshots/mobile.jpg" alt="Phone layout: joystick bottom-left, FIRE button, radar, and robots up close" width="260" align="right">

- **5 training modes:** addition, subtraction, multiplication (times tables up to 12), division without remainders, and mixed.
- **8 waves** with three robot types:
  - **Drones** (teal): one problem each.
  - **Heavy mechs** (red): two problems in a row, slower.
  - **Spiders** (orange): fast, with harder numbers.
- Numbers grow with each wave and with each robot type.
- **Kind feedback:** a wrong shot costs one shield cell and explains the mistake. After two misses on the same robot, its right screen blinks green.
- **Score:** a combo multiplier for answers right in a row, and a bonus for each cleared wave.
- **HUD:** shield cells, wave counter, score, ammo, a radar, and arrows pointing at robots off-screen.
- **Controls:**
  - **Desktop:** mouse aim and click, WASD or ZQSD to move.
  - **Phone:** joystick to move, drag to look, tap a screen to shoot it.
  - **Keyboard only:** Tab jumps your aim to the next answer screen.
- **Look:** bloom, light shafts, floating dust, holographic formulas, sparks and shockwaves.
- **Sound:** music and sound effects are generated in code with WebAudio, so there are no audio files.
- **EdVerse SDK:** cloud saves (best score per mode), learning progress for the parents' dashboard, pause and mute from the store, English and French.

<br clear="right">

## Repository layout

| Path | What it is |
| --- | --- |
| `blender/` | Headless Blender 5.x scripts that build every 3D asset: the rigged robots with Idle / Walk / Attack / Hit / PowerDown clips and `PANEL_*` sockets for the answer screens, the first-person blaster, and the hangar arena with generated textures. |
| `game/` | The EdVerse block source: React, three.js and postprocessing. `src/block.tsx` holds the `BlockProps` schema; `src/engine/` holds the game itself. |
| `game/public/models/` | The exported `.glb` models used for local development. |
| `content/props.json` | Default content (EN and FR) with local model paths. `props.edverse.json` is the same content with the CDN model URLs used on EdVerse. |
| `docs/screenshots/` | The images on this page. |

## Rebuild the models

```bash
blender --background --factory-startup --python blender/make_robots.py -- blender/out preview
blender --background --factory-startup --python blender/make_world.py -- blender/out
cp blender/out/*.glb game/public/models/
```

`preview` also renders pose frames of every animation clip into `blender/out/preview/`.

## Run locally

```bash
cd game && npm install && npm run dev
```

The game opens on http://localhost:5199 using `src/dev-props.json`.

- Type-check with `npx tsc --noEmit`.
- Build the production bundle with `npm run build`.
- To regenerate the README screenshots, open `/?shot=title|play|hit|mobile` (or `/phone-frame.html` for the phone view) in headless Chrome. `src/dev-shots.ts` drives the game to each scene.

On EdVerse, `src/App.tsx`, `src/index.tsx` and `webpack.config.js` come from the platform scaffold. Only the other `src/` files are pushed there.
