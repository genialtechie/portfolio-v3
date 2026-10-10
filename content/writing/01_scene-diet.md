# Putting a 25 MB scene on a diet

`October 2026 · performance · three.js`

The room you're standing in used to be a 25 MB download. On a fast connection that meant two seconds of a blank screen, and on a phone it meant much longer. It's now 12.7 MB, and the renders before and after are visually identical. Here's how, and why I didn't just reach for compression first.

## Look before you squeeze

I already thought I'd done a compression pass. The file said otherwise. Reading the glTF header showed no texture or mesh compression at all. Every texture was already capped at 1024px, so a resize *had* happened. But 16 MB of the file was PNG and JPEG textures, and 8.6 MB was raw geometry for only about 91k vertices.

So the question wasn't "how do I compress this?" It was "what in here is actually doing anything?"

## Measure every texture

For each texture I computed the per-channel standard deviation. A normal map that's basically flat (deviation under 2 out of 255) adds nothing you can see, so it gets dropped. Two did, including the MacBook's. Roughness/metalness maps with low variance on stickers, rubber and screens became single constant values, set to the map's average so the overall look doesn't shift. Between them, those two steps removed six textures, about 4.8 MB.

Some I kept on purpose. The sticker and wall normal maps had real variation, so they'll be compressed properly instead of deleted.

## The geometry surprise

The MacBook was 93% of the scene's triangles, and every vertex carried five UV sets plus tangents. Two of those UV sets weren't used by any material, and the tangents only existed for the flat normal map I'd just removed. Pruning them took its mesh from **6.7 MB to 2.8 MB**. Nothing about how it looks changed; the data simply wasn't being used.

## Make it repeatable

The original export now lives in `assets/source/`, and a script (`npm run assets:optimize`) produces the file the site ships. The rules are code, not a one-off: the thresholds, the list of materials allowed to lose their maps, and the poster size (512px, since they're background now).

I verified it by rendering three framings before and after in a headless browser and diffing the pixels. The mean differences were 0.0, 0.14 and 0.68 out of 255.

## What's next

This pass needed no runtime changes, which made it safe to ship on its own. The next pass is the one that changes how the site loads: meshopt geometry compression and KTX2 textures. KTX2 matters for GPU memory, not just download size: 24 uncompressed 1024px textures with mipmaps take roughly 130 MB of video memory, and that's what crashes phone tabs.

<!-- TODO(haleem): update with the KTX2/meshopt results when that pass lands. -->
