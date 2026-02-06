# Agent Guide (portfolio-v3)

This repo is a performance-first 3D portfolio site. The homepage is a guided 3D room with a few "attractions" (POIs). Users cycle POIs with `Prev/Next` and arrow keys, the camera animates between POIs, and a small orbit is enabled only while focused on a POI. Double-clicking the MacBook opens a full-screen macOS-inspired portfolio UI.

The core rules below are intentionally strict. The point is to ship a site that feels instant, not a tech demo that happens to be a portfolio.

## Non-Negotiables

- No React in the initial bundle. Keep the core scene frameworkless (TypeScript + Three.js).
- Lazy-load the macOS overlay UI. It must not affect first load or first interaction with the 3D room.
- Render on demand. Do not run a permanent `requestAnimationFrame` loop unless required for an active animation/interaction.
- Correct color management. Do not "eyeball" gamma fixes.
- Be disciplined about GPU memory: texture dimensions, mipmaps, and disposal.

## Three.js Manual Standards (Source of Truth)

When in doubt, follow the three.js manual pages:

- Loading glTF models: https://threejs.org/manual/en/loading-3d-models.html
- Color management: https://threejs.org/manual/en/color-management.html
- Responsive canvas sizing: https://threejs.org/manual/en/responsive.html
- Rendering on demand: https://threejs.org/manual/en/rendering-on-demand.html
- Textures and texture memory: https://threejs.org/manual/en/textures.html
- Lots of objects and draw-call strategy: https://threejs.org/manual/en/optimize-lots-of-objects.html
- Cleanup and disposal: https://threejs.org/manual/en/cleanup.html
- Disposing objects: https://threejs.org/manual/en/how-to-dispose-of-objects.html

Do not add new behavior that conflicts with these without a clear written rationale in the PR/commit message.

## Project Goals

- Feel fast on real devices (especially laptops on battery and mid-range phones).
- Clear, guided narrative: users should always know what to do next (POI cycling).
- Delight is allowed, but never at the expense of first-load and interaction latency.

## Core UX Requirements

- POI cycling:
  - Controls: `Prev` / `Next` buttons and keyboard arrow keys.
  - No "free scroll" driven by mousewheel/trackpad to move through content.
  - The URL should encode state (at least via `#poi=<id>` or similar) so deep links work.
- Camera:
  - Each POI has a saved camera pose (position + target) and optional orbit constraints.
  - Transitions are animated with an ease function and are interruptible (user can quickly go `Next` multiple times).
  - OrbitControls is allowed only after arriving at a POI, and should be constrained to "tiny orbit" ranges.
- MacBook:
  - Double-click on the MacBook opens the macOS overlay full screen.
  - Closing the overlay returns to the 3D scene without a full page refresh.
  - Overlay UI is lazy-loaded (separate chunk/module).

## Asset/Scene Strategy (No Blender Assumption)

You cannot assume Blender/DCC authoring. The workflow must work with only the browser and CLI tools.

- Preferred: scene assembly happens in code, driven by a `layout.json` (stable assets, fast iteration, no re-export step).
- Alternative (acceptable): assemble in the Three.js editor and export `public/scene.glb` as a combined scene. If using this approach, add explicit empty nodes for POIs/camera targets and name them deterministically so code can find them.
- A dev-only "layout editor" mode (`?edit=1`) is recommended only if the editor workflow becomes limiting.
- The room model currently appears to be in non-meter units (bounds are ~`131 x 104 x 155`). Expect to apply a room scale (likely `0.0254`) to convert inches -> meters.

## Current Assets (public/)

- `public/scene.glb`
  - Combined room + props exported via `THREE.GLTFExporter` (Three.js editor).
  - Expect it to be unoptimized and to re-encode textures (often to PNG). Treat it as a source asset and run an optimization pipeline (KTX2 + mesh compression) for production builds.
- `public/wall_floor_model_corner_room.glb`
  - Very low-poly geometry, but embedded textures dominate size.
  - Uses `KHR_materials_pbrSpecularGlossiness` (legacy workflow). Prefer converting to metallic-roughness in the asset pipeline.
- `public/final_fight_arcade.glb`
  - Light geometry, many materials/primitives relative to tri count.
  - Texture compression and draw-call reduction will be important.
- `public/work_table.glb`
  - Reasonable geometry, single mesh/primitive. Texture compression (KTX2) is still important.
  - Contains internal transforms (common FBX export artifacts). Plan to wrap and normalize at runtime for sane placement.
- `public/macbook.glb`
  - Moderate geometry. Good draw-call setup (few primitives/materials), still worth optimizing and possibly LOD-ing for mobile.
  - Contains internal transforms (unit conversion). Plan to wrap and normalize at runtime for sane placement.
- `public/neon__posters.glb`
  - Geometry is trivial, but multiple 1024x1024 textures means GPU memory can be higher than file size suggests.
  - Prefer atlasing/combining poster textures and/or using KTX2 for baseColor textures.

## Rendering Policy (On Demand)

Default to an event-driven renderer:

- Render a frame when:
  - A model finishes loading
  - The camera transitions (while transitioning)
  - OrbitControls is actively changing the camera
  - A POI annotation needs an update due to camera/viewport changes
  - Any time-dependent animation is playing
- Otherwise, do not call `requestAnimationFrame`.

If OrbitControls damping is enabled, it continuously changes the camera for a short time after user input. In that case, schedule frames only while the controls report changes.

## Responsive Canvas Policy

- Canvas uses `clientWidth`/`clientHeight` and resizes the drawing buffer to match.
- Cap device pixel ratio on high-DPI screens (battery and fill-rate protection). Do not blindly set `renderer.setPixelRatio(window.devicePixelRatio)` without a cap.
- Update camera aspect and projection matrix on resize.

## Color Management Policy

Follow the manual. The intent is:

- Color textures (baseColor, emissive) should be treated as sRGB.
- Data textures (normal, roughness/metalness, occlusion) should be treated as non-color (linear/no-color).
- Renderer output must be configured to the correct color space.

Implementation details change across three.js versions (property names moved over time). Use the current manual and the installed three.js version as the source of truth.

## Texture and Memory Budgets

General rules:

- Texture *dimensions* are the main driver of GPU memory, not file size.
- Prefer KTX2/Basis-compressed textures for anything that is not tiny UI-only imagery.
- Avoid 4k textures unless there is a very explicit need.

Target budgets (rough, adjust based on actual profiling):

- Mobile:
  - Keep total visible color textures at or under 2048 max dimension per asset
  - Keep normal maps small and sparse
  - Keep draw calls modest (try for < 50 visible at once)
- Desktop:
  - Slightly higher budgets are acceptable, but still avoid waste

## Draw Calls and Geometry Budgets

- Draw calls matter more than triangle count once triangle count is reasonable.
- Prefer merging/atlasing when it does not block interaction (for static props like the arcade body).
- Keep the MacBook geometry reasonable. Use `macbook.glb` unless there is a clear reason not to.

## Cleanup Policy

Three.js does not automatically free GPU resources. Any time you remove objects or swap scenes:

- Dispose geometries
- Dispose materials (and their textures)
- Dispose render targets
- Dispose loaders/decoders if they allocate resources

Reference: cleanup + disposal manual pages (see links above).

## Interaction and Input Policy

- Pointer:
  - Single click selects a POI if it is the intended interaction.
  - Double click on the MacBook opens the overlay.
  - Avoid accidental activation during camera transitions (debounce/lock input during transition if needed).
- Keyboard:
  - Left/Right arrows cycle POIs.
  - Escape closes the macOS overlay.
- Accessibility:
  - Buttons must be real `<button>` elements.
  - Ensure focus management when opening/closing the overlay (trap focus in overlay; return focus on close).
  - Respect `prefers-reduced-motion` by shortening or disabling camera transition animations.

## POIs and Annotations (Architecture)

POI spec should be data-driven (in `layout.json` or equivalent):

- `id`: stable string (`arcade`, `table`, `mac`)
- `anchor`: 3D point (local to the object or world space) used to position a DOM annotation
- `camera`: position + target to focus the POI
- `orbit`: constraints (min/max distance, polar angle bounds, azimuth bounds) for the "tiny orbit"

Annotation rendering:

- Project the anchor to screen space each time you render a frame.
- Position a DOM element with `transform: translate3d(...)` to avoid layout thrash.
- Optional: occlude/fade annotation if a raycast to the anchor hits intervening geometry.

## Layout Editor Mode (?edit=1)

This is a critical feature because it replaces Blender.

Minimum features:

- Toggle edit mode via query string.
- Select an object (room/table/arcade/mac) and adjust:
  - Translate, rotate (Y at minimum), scale
- Add/move POI anchor points.
- Export:
  - Generate `layout.json` with transforms and POI spec.
  - Either download the JSON or save via a dev-only endpoint.

Keep editor code behind a dev-only flag so it is tree-shaken from production builds.

## MacOS Overlay UI (Lazy-Loaded)

The overlay must be:

- A separate entry/module imported only when opened.
- State-driven and snappy (windowing, Finder-like panels, etc.) without pulling in a heavy framework.
- Accessible (focus trap, keyboard shortcuts, ARIA where needed).

Suggested approach (frameworkless):

- Small store (`createStore`) with `subscribe` and immutable updates.
- DOM rendering via:
  - Web Components, or
  - A tiny templating layer you write, or
  - A minimal library only if it is demonstrably worth the bytes

## Deep Linking

The URL should map to app state:

- `#poi=mac` should focus the MacBook POI
- Opening the overlay should update the URL (`#overlay=macos` or similar)
- Back/forward should work without reloading

## Debugging and Profiling

Do not guess performance.

- Use Chrome Performance panel and WebGL inspector tooling where appropriate.
- Add a dev-only HUD to show:
  - draw calls (renderer.info)
  - triangles (renderer.info)
  - GPU memory proxy stats (textures, geometries)
  - current POI and transition state

## Dependency Policy

- Prefer small, focused deps.
- Avoid bundling large UI frameworks in the critical path.
- Any new dependency must justify:
  - runtime bytes
  - parse/compile cost
  - long-term maintenance risk
