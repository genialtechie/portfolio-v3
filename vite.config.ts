import { defineConfig } from "vite";
import { statSync } from "node:fs";

// Decoded byte size of the scene. Vercel serves scene.glb compressed, so the
// response has no usable Content-Length; the boot log uses this as the total.
const SCENE_BYTES = statSync("public/scene.glb").size;

export default defineConfig({
  define: {
    __SCENE_BYTES__: JSON.stringify(SCENE_BYTES),
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
