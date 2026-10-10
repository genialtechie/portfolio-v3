# How I decided where the camera is allowed to look

`October 2026 · 3D UX · testing`

This room is a corner model floating in empty space. It's two walls, a floor and a window. If you let people orbit around freely, eventually they swing past where the walls end and see nothing. It looks broken, because it kind of is.

The obvious fix is to limit how far the camera can turn. The hard part was picking those limits without just guessing.

## Why eyeballing it doesn't work

You could drag around, find where it starts looking bad, and hard-code some angles. I tried that first. It works on your screen at your window size, and that's about it. A phone held upright shows a lot more above and below, a square window shows more on the sides, and zooming out changes everything again.

## Letting the renderer decide

The renderer already knows when a view is empty, because the canvas is transparent anywhere there's no geometry. So I wrote a script to test it:

1. Start from each stop's normal view (the Mac and the arcade).
2. Step through a range of camera angles and distances.
3. Render each view at a small size, read the pixels back, and count how many are transparent.
4. Throw out any view that shows more empty space than the normal view, or that puts the camera outside the room or above the walls.
5. Grow the allowed range outward from the normal view for as long as every view inside it stays clean.

The window was the tricky part. It shows the page background, which looks like a night sky, so even the normal view has some "empty" pixels. Comparing each view against the normal view, instead of expecting zero empty pixels, fixed that.

## Different screens, different limits

I ran it for a wide laptop screen, an older laptop shape, a square window and a phone. The safe ranges were different, so the site picks a wider or tighter set depending on your screen shape. Then I tested both sets properly: about 1,700 rendered views, and none of them showed empty space.

## Two bugs it caught

- **Zooming into the Mac's screen ended with a little jump.** The camera library snaps to a minimum distance whenever it updates, and the screen close-up is closer than that. Now any transition that ends inside that minimum skips the snap.
- **Clicking the arcade did nothing.** three.js strips some characters out of names, so `final_fight_arcade.glb` turned into `final_fight_arcadeglb` and the lookup silently failed.

Neither had anything to do with camera limits. They only showed up because I was testing everything step by step.

<!-- TODO(haleem): optional, add a gif of the sweep or a before/after of an out-of-bounds view. -->
