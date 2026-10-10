# Hey reader

This is my build journal: what I'm working on, the decisions behind it, and the numbers when I have them. It's not polished, it's a place to keep receipts.

## Why a room?

A portfolio is a product with one job: get someone to understand what you build and how well you build it, quickly. A list of links does that job adequately. I wanted the site itself to be evidence, so the first thing you see is something that loads fast, runs on a phone, and still feels a little magical.

## How it came together

I assembled the scene in the three.js editor rather than Blender, from CC-licensed models (credits under `?`), with named anchor nodes the code can find. From there the work was the boring, important part: a strict set of rules for performance and accessibility, written down so every change, mine or an AI agent's, has to respect them.

- No framework in the critical path; the overlay loads only when you open the Mac.
- Render on demand. No permanent animation loop.
- Real buttons, full keyboard control, and reduced-motion support.
- Measure GPU memory and bytes, don't guess.

I use coding agents a lot, Codex and Claude among them. They're fast hands. The rules, the architecture and the judgment calls are what I bring, and that's what these posts are about.

## Recent notes

- [Putting a 25 MB scene on a diet](#page=writing/scene-diet)
- [How I decided where the camera is allowed to look](#page=writing/camera-bounds)

<!-- TODO(haleem): this replaces the original intro. Adjust the agents paragraph to your voice. -->
