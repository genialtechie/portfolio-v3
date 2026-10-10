# Hey reader

Welcome to my journal.

Here I try to document what I'm working on, the decisions behind it, and the numbers when I have them. Nothing too polished, just a place to keep receipts and share context.

## Why a room?

I wanted the site itself to show how I build. A list of links works, but I'd rather you open something that loads fast, runs fine on your phone, and still feels a little bit magical.

## How it came together

I sourced free `.glb` models from Sketchfab (huge thanks to the 3D artists behind each asset). You can see the credits anytime by clicking `?` in the room. I arranged everything in the three.js editor instead of Blender, added a few anchor points the code can find, and exported it all as one scene.

From there, most of the work was the boring (important) part. I wrote down a strict set of rules for performance and accessibility so that every change, whether it came from me or an AI agent, had to follow them:

- No React in the initial load. The 3D room is plain TypeScript and three.js.
- Only render when something is actually changing.
- Load the MacBook overlay only when you open it.
- Real buttons, full keyboard support, and respect for reduced motion.
- Be careful with GPU memory and file sizes.

I use AI coding agents a lot, Codex and Claude especially. They help me move fast. The rules, the architecture and the judgment calls are still on me, and that's mostly what I write about here.

## Recent notes

- [Putting a 25 MB scene on a diet](#page=writing/scene-diet)
- [How I decided where the camera is allowed to look](#page=writing/camera-bounds)
