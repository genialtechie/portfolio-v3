// Copies the Basis Universal transcoder (used by KTX2Loader) from the installed
// three.js into public/basis/, so it always matches the three version.
// Runs automatically before dev and build.
import fs from "node:fs";

const src = "node_modules/three/examples/jsm/libs/basis";
const dst = "public/basis";
fs.mkdirSync(dst, { recursive: true });
for (const f of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  fs.copyFileSync(`${src}/${f}`, `${dst}/${f}`);
}
console.log("copied basis transcoder -> public/basis/");
