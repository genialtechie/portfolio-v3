# Colophon

A quick look at how this site is built.

## The idea

The room is the homepage and the MacBook is where everything lives. When the site loads you start inside the Mac, then pull back into the room, and you go back into the screen whenever you want to read something. I kept everything looking and feeling like a terminal.

## The rules I set for myself

- **No framework slowing down the first load.** The 3D scene is plain TypeScript and three.js. The portfolio part only loads when you open the Mac.
- **Only draw when something changes.** There's no animation loop running all the time. A new frame only renders when the camera moves, you interact, or something is loading.
- **Real loading info.** The boot screen shows actual numbers from your device, like your GPU, how much has downloaded, and how long the shaders took to compile.
- **Careful with color and memory.** Correct color handling, a cap on pixel density, and cleaning up anything that leaves the scene.
- **Works without a mouse.** Everything has a keyboard shortcut (arrows, 1 and 2, Enter, Esc, ?), dialogs handle focus properly, and it respects reduced motion settings.
- **Every page has a link.** Every stop and page has its own URL, and back and forward work like you'd expect.

## Some numbers

- The 3D scene went from 25.0 MB to 12.7 MB without any visible change ([how I did it](#page=writing/scene-diet)).
- The camera limits came from rendering about 1,700 different views and throwing out any that showed empty space ([how I did it](#page=writing/camera-bounds)).
- The Mac's screen is a real texture in the scene, and it only redraws when the text on it changes.

## Stack

TypeScript · three.js · Vite · marked · Vercel and Vercel Analytics · gltf-transform for the 3D files

The 3D models are CC BY 4.0. You can find the credits under `?` in the room.
