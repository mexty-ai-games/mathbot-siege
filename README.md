# MathBot Siege

Neon sci-fi first-person math game for the EdVerse store (MEXTY game `6ad711bd87e1e3de99f9e2c8`).
Robots march in with a problem above their head; the right answer glows on one of their screens — shoot it to power them down.

## Layout

- `blender/` — headless Blender 5.x scripts that build every 3D asset (rigged robots with Idle/Walk/Attack/Hit/PowerDown clips, blaster, hangar arena with generated textures).
- `game/` — the EdVerse block source (React + three.js + postprocessing). `src/block.tsx` holds the `BlockProps` schema.
- `content/props.json` — default content (EN + FR) with local model paths; `props.edverse.json` is the same with the CDN model URLs used on EdVerse.

## Rebuild the models

```bash
blender --background --factory-startup --python blender/make_robots.py -- blender/out preview
blender --background --factory-startup --python blender/make_world.py -- blender/out
cp blender/out/*.glb game/public/models/
```

## Run locally

```bash
cd game && npm install && npm run dev
```

Opens on http://localhost:5199 with `src/dev-props.json`. Type-check with `npx tsc --noEmit`; production bundle with `npm run build`.
On EdVerse, `src/App.tsx`, `src/index.tsx` and `webpack.config.js` come from the platform scaffold — only the other `src/` files are pushed there.
