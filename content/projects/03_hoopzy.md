# Hoopzy

`2025–26 · web game · three.js · Ammo.js (Bullet physics) · no framework`

A 60-second basketball game: touch the ball, swipe up, and let real physics carry it to the rim. Every shot gets a call (SWISH, BANK, BRICK, AIRBALL), streaks catch fire, and your best score sticks around. It's the arcade cabinet in this room.

[Play at hoopzy.fun](https://hoopzy.fun)

## What makes it work

**Scoring that can't be skipped.** A fast ball can pass the rim between two frames, which is the classic way physics games miss baskets. Every frame, Hoopzy compares the ball's current and previous positions. When the ball moves down through the rim's height, it works out where the ball crossed that plane and only counts the basket if that point is inside the hoop. That fixed a real scoring bug.

**Feel over realism.** Gravity is -12, not -9.8, so shots feel snappy. A swipe's sideways force is damped, its lift is boosted, and its forward force scales with distance to the hoop, with a gentle pull toward the center. Pure physics felt unfair on a phone, and these tweaks made it feel skillful.

**Mobile first, including the annoying parts.** iOS Safari blocks audio until the first interaction, so the first touch plays a silent clip to unlock sound. Everything resizes with the visual viewport, so the browser's own toolbars don't break the layout. A shot ends cleanly on any of three conditions: the ball leaves the court, stops moving, or runs past 1.5 seconds.

**Zero asset downloads for the court.** The court, hoop, net and ball seams are all built in code from primitives. There are no models to download.

## What's next

It's going inside this arcade cabinet. A shared leaderboard would need server-side score checks, because the best score lives only in the browser today.

## Stack

three.js · Ammo.js via enable3d (WebAssembly) · Vite · vanilla JavaScript · Vercel

Sound effects are my own, plus free-to-use sources.
