// Generates icon.png (180x180 apple-touch-icon) with zero dependencies:
// dark Sector Defense bg + cyan hexagon mark. Run: node tools/make-icon.mjs
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SIZE = 180;
const cx = SIZE / 2, cy = SIZE / 2;

// Precise hexagon membership: 6 half-plane tests, pointy-top (matches the game's hexes).
function hexAlpha(x, y, r) {
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 3 * i;
    const d = (x - cx) * Math.cos(ang) + (y - cy) * Math.sin(ang);
    if (d > r) return 0;
  }
  return 1;
}

const px = new Uint8Array(SIZE * SIZE * 4); // RGBA
const bg = [10, 14, 26];        // #0a0e1a game background
const accent = [0, 204, 255];   // #00ccff game accent

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const outer = hexAlpha(x + 0.5, y + 0.5, 74);
    const ring = Math.min(1, outer - hexAlpha(x + 0.5, y + 0.5, 64)); // 10px ring
    const inner = hexAlpha(x + 0.5, y + 0.5, 46);
    const core = hexAlpha(x + 0.5, y + 0.5, 22);
    let c = bg, a = 255;
    if (ring > 0) { c = accent; a = Math.round(255 * ring); }
    else if (inner > 0) { c = [bg[0] + 20, bg[1] + 34, bg[2] + 56]; }
    if (core > 0) { c = accent; }
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = a;
  }
}

// Minimal PNG encoder: IHDR + IDAT(deflate of filter-prefixed scanlines) + IEND.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0; // filter: none
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, {level: 9})),
  chunk('IEND', Buffer.alloc(0)),
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.resolve(__dirname, '..', 'icon.png'), png);
console.log('icon.png written:', png.length, 'bytes');
