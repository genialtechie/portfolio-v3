# Hoopzy

`2025 to 2026 · web game · three.js · Ammo.js (Bullet physics) · no framework`

[Play at hoopzy.fun](https://hoopzy.fun)

Hoopzy is a 60 second basketball game. You touch the ball, swipe up, and real physics carries it to the rim. Every shot gets called out (SWISH, BANK, BRICK, AIRBALL), streaks catch fire, and your best score is saved. It's also the arcade cabinet in this room, and you can play it right there.

## How it works

Scoring was the trickiest part. A fast ball can fly past the rim between two frames, which is a classic way physics games miss baskets. So every frame, Hoopzy compares where the ball is now with where it was last frame. If the ball passed down through the rim, it works out exactly where it crossed and only counts the basket if that point is inside the hoop. That fixed a real scoring bug I had.

I also tuned the physics so it feels good to play. Gravity is set to -12 instead of -9.8 so shots feel snappier. The side to side force of a swipe gets toned down, the lift gets boosted, and the forward force scales with how far you are from the hoop, with a little pull toward the center. Pure physics felt unfair on a phone, and these tweaks made it feel like skill.

It's built for phones first. iOS Safari won't play sound until you interact, so the first touch plays a silent clip to unlock audio. Everything resizes with the visible viewport, so the browser's toolbars don't mess up the layout. A shot ends if the ball leaves the court, stops moving, or takes longer than 1.5 seconds.

There are no 3D models to download. The court, hoop, net and even the seams on the ball are all built in code.

## What's next

If I add a shared leaderboard, I'll need to check scores on a server, since right now your best score only lives in your browser.

## Stack

three.js · Ammo.js via enable3d (WebAssembly) · Vite · vanilla JavaScript · Netlify

The sound effects are my own, plus some free to use sources.
