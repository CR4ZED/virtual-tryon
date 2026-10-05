// Renders the extension icon (white T-shirt on an indigo rounded square) to PNG without dependencies.
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const SHIRT = [[0.35, 0.2], [0.42, 0.2], [0.5, 0.28], [0.58, 0.2], [0.65, 0.2], [0.85, 0.33], [0.78, 0.46], [0.7, 0.42], [0.7, 0.82], [0.3, 0.82], [0.3, 0.42], [0.22, 0.46], [0.15, 0.33]];

function inShirt(x, y) {
  let inside = false;
  for (let i = 0, j = SHIRT.length - 1; i < SHIRT.length; j = i++) {
    const [xi, yi] = SHIRT[i];
    const [xj, yj] = SHIRT[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedSquare(x, y, r = 0.22) {
  const dx = Math.max(r - x, 0, x - (1 - r));
  const dy = Math.max(r - y, 0, y - (1 - r));
  return dx * dx + dy * dy <= r * r;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const SS = 4; // supersampling for anti-aliased edges
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let fg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (inRoundedSquare(u, v)) {
            bg++;
            if (inShirt(u, v)) fg++;
          }
        }
      }
      const f = bg ? fg / bg : 0;
      const rgba = [79 + 176 * f, 70 + 185 * f, 229 + 26 * f, (bg / (SS * SS)) * 255].map(Math.round);
      row.set(rgba, 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icon', { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(`public/icon/${size}.png`, png(size));
