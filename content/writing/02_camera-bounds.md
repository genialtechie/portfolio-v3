# How I decided where the camera is allowed to look

`October 2026 · 3D UX · testing`

This room is a corner model floating in empty space: two walls, a floor, a window. If you let people orbit freely, sooner or later they swing round to where the walls end and see nothing. It looks broken, and it is.

The fix is obvious: limit the orbit. The interesting part was choosing the limits without guessing.

## The problem with eyeballing it

You can drag around, find where it starts looking bad, and hard-code some angles. I tried that. It works on your screen, at your window size. A phone in portrait shows much more above and below, a square window shows more at the sides, and zooming out changes everything. Hand-tuned numbers are right in exactly one place.

## Let the renderer judge

The renderer already knows when a view is empty: the canvas is transparent wherever there's no geometry. So I wrote a sweep:

1. For each stop (the Mac, the arcade), start from its rest view.
2. Step through candidate views: left/right angle, up/down angle and distance.
3. Render each one small, read the pixels back, and count the transparent ones.
4. Reject the view if it shows more emptiness than the rest view, or if the camera ends up outside the room or above the walls.
5. Grow a box of allowed angles and distances outward from the rest view, as far as every view inside it stays clean.

The window was the catch. It shows the page background, which reads as night sky, so the rest view already contains some "empty" pixels. Comparing each view against its rest view, instead of demanding zero, handled that cleanly.

## Different screens, different limits

I ran the sweep for a landscape laptop, an older laptop shape, a square window and a phone. The safe ranges differ, so the site picks a wide or narrow set by screen shape. Then I verified both sets densely: about **1,700 rendered views, zero bad ones**.

## Two bugs it flushed out

- **The zoom into the Mac's screen ended with a small jump.** The camera library snaps to its minimum distance on update, and the screen close-up is closer than that. Transitions that end outside the orbit range now skip that snap.
- **Clicking the arcade did nothing.** three.js strips characters from node names, so `final_fight_arcade.glb` became `final_fight_arcadeglb` and the lookup silently failed.

Neither was about camera limits. Both turned up because I was testing systematically instead of clicking around.

<!-- TODO(haleem): optional — add a gif of the sweep or a before/after of an out-of-bounds view. -->
