// Generates icon.png (180x180 apple-touch-icon) with zero dependencies:
// dark Sector Defense bg + cyan hexagon mark. Run: node tools/make-icon.mjs
// Args: [size] [outputPath] [--opaque] — e.g. node tools/make-icon.mjs 1024 ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png --opaque
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIZE = Number(args[0]) || 180;
const OPAQUE = args.includes('--opaque'); // composite over bg, emit RGB (App Store icons must not carry alpha)
const OUT = args[1] && !args[1].startsWith('--') ? path.resolve(args[1]) : path.resolve(__dirname, '..', 'icon.png');
const S = SIZE / 180; // mark is authored at 180; scale radii for other sizes
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
    const outer = hexAlpha(x + 0.5, y + 0.5, 74 * S);
    const ring = Math.min(1, outer - hexAlpha(x + 0.5, y + 0.5, 64 * S)); // ring band
    const inner = hexAlpha(x + 0.5, y + 0.5, 46 * S);
    const core = hexAlpha(x + 0.5, y + 0.5, 22 * S);
    let c = bg, a = 255;
    if (ring > 0) { c = accent; a = Math.round(255 * ring); }
    else if (inner > 0) { c = [bg[0] + 20, bg[1] + 34, bg[2] + 56]; }
    if (core > 0) { c = accent; }
    if (OPAQUE && a < 255) { const al = a / 255; c = [Math.round(c[0] * al + bg[0] * (1 - al)), Math.round(c[1] * al + bg[1] * (1 - al)), Math.round(c[2] * al + bg[2] * (1 - al))]; a = 255; }
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
const CH = OPAQUE ? 3 : 4; // RGB when opaque, RGBA otherwise
const raw = Buffer.alloc(SIZE * (SIZE * CH + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * CH + 1)] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const src = (y * SIZE + x) * 4, dst = y * (SIZE * CH + 1) + 1 + x * CH;
    raw[dst] = px[src]; raw[dst + 1] = px[src + 1]; raw[dst + 2] = px[src + 2];
    if (!OPAQUE) raw[dst + 3] = px[src + 3];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = OPAQUE ? 2 : 6; // 8-bit RGB / RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, {level: 9})),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(OUT, 'written:', png.length, 'bytes');
