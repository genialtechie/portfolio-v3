# Putting a 25 MB scene on a diet

`October 2026 · performance · three.js`

The room you're standing in used to be a 25 MB download. On a fast connection that was about two seconds of a blank screen, and on a phone it was a lot longer. It's now 12.7 MB, and if you compare before and after, it looks exactly the same. Here's how I did it.

## First, I looked inside the file

I thought I'd already compressed this scene. Turns out I hadn't. When I read the file's header, there was no texture or mesh compression at all. Every texture was already capped at 1024px, so I had done a resize at some point. But 16 MB of the file was still PNG and JPEG images, and 8.6 MB was raw geometry for only about 91k vertices.

So before compressing anything, I wanted to know which parts of the file were actually doing something.

## Then I measured every texture

For each texture, I measured how much its pixels actually vary. A normal map that's basically flat doesn't change how anything looks, so I dropped those. Two were flat, including the MacBook's. A few roughness and metalness maps on the stickers, rubber and screens barely varied either, so I swapped each one for a single value set to its average. That way the overall look doesn't shift. Those two changes removed six textures, about 4.8 MB.

I kept some on purpose. The sticker and wall normal maps had real detail in them, so I'll compress those properly later.

## The geometry was a surprise

The MacBook was 93% of all the triangles in the scene, and every vertex carried five sets of texture coordinates plus extra tangent data. Two of those coordinate sets weren't used by anything, and the tangents were only there for the flat normal map I had just removed. Removing them took the MacBook from 6.7 MB to 2.8 MB, and it looks exactly the same.

## Making it repeatable

The original export now lives in `assets/source/`, and a script (`npm run assets:optimize`) builds the file the site actually ships. All the rules are in code: the thresholds, which materials are allowed to lose their maps, and the poster size (512px, since they're just in the background now).

To check nothing changed visually, I rendered three camera angles before and after in a headless browser and compared the pixels. The average difference was basically zero (0.0, 0.14 and 0.68 out of 255).

## What's next

This pass didn't need any code changes, so it was safe to ship on its own. The next pass is real compression: meshopt for the geometry and KTX2 for the textures. KTX2 matters for more than download size. Right now 24 uncompressed 1024px textures take up roughly 130 MB of GPU memory, and that's the kind of thing that crashes tabs on phones.

<!-- TODO(haleem): update with the KTX2/meshopt results when that pass lands. -->
