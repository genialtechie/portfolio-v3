# portfolio-v3

High-performance portfolio site built around a guided 3D room experience (Three.js + glTF).

## Concept

- Base scene: a room (`wall_floor_model_corner_room.glb`)
- Attractions in the room: arcade, table, MacBook (each a GLB)
- Navigation: users cycle points-of-interest (POIs) with `Prev/Next` buttons and arrow keys (no free scrolling through a long page)
- Camera: guided transitions between POIs, with a small, constrained orbit when focused on a POI
- MacBook: double-click opens a full-screen, macOS-inspired portfolio UI (lazy-loaded so it does not bloat initial load)

## Performance Philosophy (TL;DR)

- Keep the initial experience frameworkless: minimal JS, no React in the critical path.
- Render on demand: do not run an infinite `requestAnimationFrame` loop unless something is animating or being interacted with.
- Prefer glTF/GLB assets, compressed textures (KTX2), and reasonable draw-call/texture budgets.
- Be strict about GPU memory and cleanup: dispose of three.js resources when they are no longer needed.

## Assets (Current Repo State)

The repo currently contains only the source GLBs in `public/`:

- `public/scene.glb` (assembled room + props exported from the Three.js editor; treat as a source asset and run an optimization pipeline before shipping)
- `public/wall_floor_model_corner_room.glb` (room base)
- `public/final_fight_arcade.glb` (arcade)
- `public/work_table.glb` (table)
- `public/macbook.glb` (MacBook)
- `public/neon__posters.glb` (posters/decals)

## Roadmap

1. Bootstrap: Vite + TypeScript + Three.js (core scene only).
2. Guided POI system: camera targets per POI, `Prev/Next` + arrow-key cycling, constrained orbit when focused.
3. DOM annotations: POI labels projected from 3D anchors, with optional occlusion.
4. Full-screen macOS portfolio overlay: lazy-loaded UI; opens on MacBook double-click.
5. Dev-only layout editor (`?edit=1`): place objects and anchors in-browser and export `layout.json`.
6. Asset pipeline: KTX2 textures, meshopt/quantization, material/workflow fixes (room specGloss -> metal/rough).

## Development

Prereqs: Node.js 20+.

```bash
npm install
npm run dev
```

## Content (Markdown)

The macOS overlay reads markdown pages from `content/` (generated automatically).

- Add/edit files like `content/01_projects.md`
- Ordering is alphabetical, so numeric prefixes work well (`00_`, `01_`, `02_`, ...)

Build:

```bash
npm run build
```

## Docs

- Agent guidance and standards: `AGENTS.md`
