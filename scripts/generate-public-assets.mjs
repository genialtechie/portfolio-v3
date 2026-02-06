import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32Table() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const d = Buffer.from(data);
  const len = u32be(d.length);
  const crc = u32be(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}

function encodePngRgba({ width, height, rgba }) {
  if (rgba.length !== width * height * 4) throw new Error("RGBA length mismatch");

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.allocUnsafe((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// 5x7 font, uppercase only. Each entry is 7 rows of 5 bits.
const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b11111, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0, 0b00100],
  ",": [0, 0, 0, 0, 0, 0b00100, 0b01000],
  "|": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  "/": [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0, 0],
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
  "6": [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};

function setPx(img, w, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  img[i + 0] = r;
  img[i + 1] = g;
  img[i + 2] = b;
  img[i + 3] = a;
}

function fill(img, w, h, r, g, b, a = 255) {
  for (let i = 0; i < w * h; i++) {
    img[i * 4 + 0] = r;
    img[i * 4 + 1] = g;
    img[i * 4 + 2] = b;
    img[i * 4 + 3] = a;
  }
}

function drawRect(img, w, h, x0, y0, x1, y1, r, g, b, a = 255) {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(w - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(h - 1, Math.max(y0, y1));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) setPx(img, w, x, y, r, g, b, a);
  }
}

function drawText(img, w, h, x, y, text, scale, color) {
  const up = text.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const glyph = FONT[ch] || FONT[" "];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row] || 0;
      for (let col = 0; col < 5; col++) {
        const on = (bits >> (4 - col)) & 1;
        if (!on) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = cx + col * scale + sx;
            const py = y + row * scale + sy;
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            setPx(img, w, px, py, color[0], color[1], color[2], color[3]);
          }
        }
      }
    }
    cx += (5 + 1) * scale;
  }
}

function gradientBg(img, w, h, top, bottom) {
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const r = Math.round(top[0] * (1 - t) + bottom[0] * t);
    const g = Math.round(top[1] * (1 - t) + bottom[1] * t);
    const b = Math.round(top[2] * (1 - t) + bottom[2] * t);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      img[i + 0] = r;
      img[i + 1] = g;
      img[i + 2] = b;
      img[i + 3] = 255;
    }
  }
}

function makeOg() {
  const width = 1200;
  const height = 630;
  const img = Buffer.alloc(width * height * 4);
  gradientBg(img, width, height, [11, 12, 16], [17, 19, 26]);

  // Frame
  drawRect(img, width, height, 28, 28, width - 29, height - 29, 110, 231, 255, 40);
  drawRect(img, width, height, 30, 30, width - 31, height - 31, 11, 12, 16, 255);
  drawRect(img, width, height, 30, 30, width - 31, 72, 255, 255, 255, 14);

  // "traffic lights"
  const dots = [
    [50, 51, [255, 95, 87]],
    [74, 51, [254, 188, 46]],
    [98, 51, [40, 200, 64]],
  ];
  for (const [x, y, c] of dots) drawRect(img, width, height, x, y, x + 12, y + 12, c[0], c[1], c[2], 255);

  const accent = [110, 231, 255, 255];
  const fg = [233, 236, 242, 235];
  const muted = [233, 236, 242, 165];

  drawText(img, width, height, 66, 140, "HALEEM BELLO", 7, fg);
  drawText(img, width, height, 66, 215, "FULL STACK DEVELOPER", 4, accent);
  drawText(img, width, height, 66, 270, "ATLANTA, GA | TYPESCRIPT | THREE.JS", 3, muted);

  drawText(img, width, height, 66, 370, "$ OPEN MACBOOK TO EXPLORE", 4, muted);
  drawText(img, width, height, 66, 420, "PROJECTS  WRITING  ABOUT  CONTACT", 3, muted);

  return encodePngRgba({ width, height, rgba: img });
}

function makeIcon(size) {
  const width = size;
  const height = size;
  const img = Buffer.alloc(width * height * 4);
  fill(img, width, height, 11, 12, 16, 255);

  // Simple border
  const border = Math.max(2, Math.floor(size * 0.02));
  for (let i = 0; i < border; i++) {
    drawRect(img, width, height, i, i, width - 1 - i, i, 110, 231, 255, 120);
    drawRect(img, width, height, i, height - 1 - i, width - 1 - i, height - 1 - i, 110, 231, 255, 120);
    drawRect(img, width, height, i, i, i, height - 1 - i, 110, 231, 255, 120);
    drawRect(img, width, height, width - 1 - i, i, width - 1 - i, height - 1 - i, 110, 231, 255, 120);
  }

  const scale = Math.max(6, Math.floor(size / 64));
  const text = "HB";
  const textW = text.length * (5 + 1) * scale - scale;
  const x = Math.floor((size - textW) / 2);
  const y = Math.floor((size - 7 * scale) / 2);
  drawText(img, width, height, x, y, text, scale, [110, 231, 255, 255]);

  return encodePngRgba({ width, height, rgba: img });
}

function writePublic(name, buf) {
  const out = path.join(process.cwd(), "public", name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`wrote public/${name}`);
}

writePublic("og.png", makeOg());
writePublic("icon-192.png", makeIcon(192));
writePublic("icon-512.png", makeIcon(512));
writePublic("apple-touch-icon.png", makeIcon(180));

