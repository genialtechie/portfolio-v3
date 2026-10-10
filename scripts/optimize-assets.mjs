// Asset pipeline: assets/source/scene.glb -> public/scene.glb
//
// Pass 1 (cleanup): structural cleanup + removing texture data that is
// invisible at our camera framing.
// Pass 2 (compression): KTX2/Basis textures (smaller downloads and ~4x less
// GPU memory, since they stay compressed on the GPU) and meshopt geometry.
// Runtime needs KTX2Loader (transcoder in public/basis/) and MeshoptDecoder.
//
// Usage: node scripts/optimize-assets.mjs
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, meshopt } from "@gltf-transform/functions";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";

const SRC = "assets/source/scene.glb";
const OUT = "public/scene.glb";

// Thresholds measured with scripts/texture-stats.mjs (channel stdev on 0-255 scale).
const FLAT_NORMAL_STDEV = 2; // normal map indistinguishable from a flat surface
// Metal-rough maps on these materials have low variance and sit on stickers/rubber/
// screens that are never seen close enough for roughness variation to read.
const CONSTANT_MR_MATERIALS = new Set([
  "Rubber", "Rubber.2", "Board_Sticker", "Top_Sticker", "Side_Sticker",
  "Side_Sticker_0", "Side_Sticker.1", "Screen", "Screen_Sticker",
]);
// Posters are set dressing (no longer POIs): 512px is plenty at their distance.
const POSTER_MATERIALS = new Set(["poster", "poster1", "poster.2"]);
const POSTER_MAX = 512;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(SRC);
const root = doc.getRoot();
const log = (...a) => console.log("  ", ...a);

const channelStats = async (tex) => (await sharp(Buffer.from(tex.getImage())).stats()).channels;

// 1. Drop normal maps that are effectively flat.
for (const mat of root.listMaterials()) {
  const n = mat.getNormalTexture();
  if (!n) continue;
  const [r, g] = await channelStats(n);
  if (r.stdev < FLAT_NORMAL_STDEV && g.stdev < FLAT_NORMAL_STDEV) {
    mat.setNormalTexture(null);
    log(`flat normal map removed: ${mat.getName()}`);
  }
}

// 2. Replace low-variance metal-rough maps with their mean as constant factors.
for (const mat of root.listMaterials()) {
  if (!CONSTANT_MR_MATERIALS.has(mat.getName())) continue;
  const mr = mat.getMetallicRoughnessTexture();
  if (!mr) continue;
  const [, g, b] = await channelStats(mr); // glTF: G = roughness, B = metalness
  const rough = +(mat.getRoughnessFactor() * (g.mean / 255)).toFixed(3);
  const metal = +(mat.getMetallicFactor() * (b.mean / 255)).toFixed(3);
  mat.setMetallicRoughnessTexture(null).setRoughnessFactor(rough).setMetallicFactor(metal);
  log(`MR map -> constants: ${mat.getName()} (roughness ${rough}, metalness ${metal})`);
}

// 3. Structural cleanup. keepLeaves keeps empty POI_*_ANCHOR nodes that main.ts
//    discovers by name; prune also drops vertex attributes no material uses
//    (extra UV sets, tangents without a normal map).
await doc.transform(
  prune({ keepLeaves: true, keepAttributes: false, keepExtras: true }),
  dedup(),
  weld(),
);

// 4. Posters: downsize and store as JPEG (opaque).
const posterTextures = new Set(
  root.listMaterials()
    .filter((m) => POSTER_MATERIALS.has(m.getName()))
    .map((m) => m.getBaseColorTexture())
    .filter(Boolean),
);
for (const tex of posterTextures) {
  const buf = await sharp(Buffer.from(tex.getImage()))
    .resize(POSTER_MAX, POSTER_MAX, { fit: "inside" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  tex.setImage(new Uint8Array(buf)).setMimeType("image/jpeg");
}
log(`posters resized to ${POSTER_MAX}px JPEG: ${posterTextures.size}`);

// 5. KTX2 textures. Encoding settings follow the slot:
//    - normal maps: UASTC + zstd (ETC1S smears normals), normal-map preset
//    - color (baseColor, emissive): ETC1S, sRGB transfer, perceptual
//    - other data (metal/rough, occlusion): ETC1S, linear
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(Buffer.from(buffer)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const common = { generateMipmap: true, imageDecoder, enableDebug: false };
await doc.transform(
  ktx2({ ...common, slots: /normalTexture/, isUASTC: true, isNormalMap: true, needSupercompression: true,
    enableRDO: true, rdoQualityLevel: 1, isSetKTX2SRGBTransferFunc: false, isPerceptual: false }),
  ktx2({ ...common, slots: /baseColorTexture|emissiveTexture/, isUASTC: false, qualityLevel: 160,
    compressionLevel: 2, isSetKTX2SRGBTransferFunc: true, isPerceptual: true }),
  ktx2({ ...common, slots: /metallicRoughnessTexture|occlusionTexture/, isUASTC: false, qualityLevel: 160,
    compressionLevel: 2, isSetKTX2SRGBTransferFunc: false, isPerceptual: false }),
);
log("textures -> KTX2 (UASTC normals, ETC1S color/data)");

// 6. Geometry: quantize + meshopt compression.
await MeshoptEncoder.ready;
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));
log("geometry -> meshopt + quantization");

await io.write(OUT, doc);
const mb = (p) => (fs.statSync(p).size / 1024 / 1024).toFixed(2);
console.log(`\n${SRC} ${mb(SRC)} MB -> ${OUT} ${mb(OUT)} MB`);
