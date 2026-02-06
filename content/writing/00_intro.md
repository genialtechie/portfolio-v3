# Hey reader

Welcome to my journal.

Here I try to document what I'm currently working on, what is happening in my life, and carry you along in the journey. Nothing too polished, just a place to keep receipts and share context.

## So, how did I build this snappy 3D experience?

First, I know you're probably wondering how I pulled this off. For the most part, Codex did the heavy lifting.

I sourced free `.glb` models from Sketchfab (huge thanks to the 3D artists behind each asset). You can view credits anytime by clicking `?` in the scene.

I also saved a ton of time (and avoided Blender) by arranging everything inside the three.js editor. I placed the room, arcade, table, MacBook, and posters, added a few POI anchors, exported the combined scene as a single `.glb`, and started building the site around that.

## The boring (important) part: performance and accessibility

Performance, accessibility, and access are the whole point. This is a portfolio that can be opened on all kinds of devices and networks, so it has to feel instant, not fragile.

I started by writing a strict `AGENTS.md` to keep the project disciplined:

- No React in the initial bundle (the core 3D experience is frameworkless TypeScript + Three.js).
- Render on demand (no infinite `requestAnimationFrame` unless something is actually animating).
- Lazy-load the MacBook overlay UI so first load stays fast.
- Use real buttons, focus management, and keyboard shortcuts (and respect reduced motion).
- Be careful with GPU memory (textures and draw calls matter).

And because mobile is reality, not a "nice to have", I made sure double-tap opens the MacBook overlay and navigation still works even without a keyboard.

## Where this is going

The room is the homepage. The MacBook is the portal to everything else.

Next up, I want to expand the attractions (more POIs, better annotations, better camera framing), optimize the scene asset pipeline, and keep writing as I ship.
