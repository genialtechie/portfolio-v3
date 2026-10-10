# Colophon

How this site is built, and why.

## The idea

The room is the homepage, and the MacBook is where everything lives. You boot into the Mac, pull back into the room, and go back into the screen to read. The whole site speaks one language: a terminal.

## Rules I held it to

- **No framework in the critical path.** The 3D scene is plain TypeScript and three.js. The portfolio overlay is a separate chunk that loads only when you open the Mac.
- **Render on demand.** There's no permanent animation loop. Frames are drawn only when something changes: camera moves, your input, a loading step.
- **Honest loading.** The boot log prints real events with real numbers from your device: GPU, bytes downloaded, shader compile time. Nothing is faked.
- **Correct color, careful memory.** Proper sRGB/linear handling, capped pixel ratio, and disposal of everything that leaves the scene.
- **Accessible by default.** Real buttons, keyboard control for everything (arrows, 1/2, Enter, Esc, ?), focus handling in dialogs, and reduced-motion support.
- **The URL is the state.** Every stop and page has a deep link, and back/forward work.

## Things I measured

- The scene went from **25.0 MB to 12.7 MB** with no visible change. Every texture was measured before anything was dropped ([write-up](#page=writing/scene-diet)).
- Camera limits come from **rendering about 1,700 candidate views** and rejecting any that showed empty space ([write-up](#page=writing/camera-bounds)).
- The Mac's screen is a real texture in the scene, redrawn only when its text changes.

## Stack

TypeScript · three.js · Vite · marked · Vercel (+ Analytics) · gltf-transform for the asset pipeline

3D models are CC BY 4.0. Credits are under `?` in the room.
