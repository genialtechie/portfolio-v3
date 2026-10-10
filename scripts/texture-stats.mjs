import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const r = doc.getRoot();
for (const [i,t] of r.listTextures().entries()) {
  const mats = t.listParents().filter(p=>p.propertyType==='Material');
  const slots = new Set(); for (const m of mats) { if(m.getNormalTexture()===t) slots.add('normal'); if(m.getMetallicRoughnessTexture()===t) slots.add('mr'); if(m.getBaseColorTexture()===t) slots.add('base'); if(m.getOcclusionTexture()===t) slots.add('ao'); if(m.getEmissiveTexture()===t) slots.add('emis'); }
  const s = await sharp(Buffer.from(t.getImage())).stats();
  const ch = s.channels.map(c=>`${c.mean.toFixed(0)}±${c.stdev.toFixed(1)}`).join(' ');
  console.log(i, [...slots].join('/'), Math.round(t.getImage().byteLength/1024)+'KB', ch, '|', mats.map(m=>`${m.getName()}(r${m.getRoughnessFactor()},m${m.getMetallicFactor()})`).join(','));
}
