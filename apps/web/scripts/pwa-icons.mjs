import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/icons");

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) {
    c ^= byte;
    for (let bit = 0; bit < 8; bit += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([length, typeBuf, data, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function icon(x, y, size, maskable) {
  const blue = [61, 79, 191, 255];
  const cream = [251, 250, 247, 255];
  const nx = x / (size - 1);
  const ny = y / (size - 1);
  const radius = maskable ? 0 : 0.18;
  const dx = Math.max(radius - nx, 0, nx - (1 - radius));
  const dy = Math.max(radius - ny, 0, ny - (1 - radius));
  if (!maskable && dx * dx + dy * dy > radius * radius) return [0, 0, 0, 0];
  const cx = (nx - 0.5) * size;
  const cy = (ny - 0.42) * size;
  const scale = size * (maskable ? 0.34 : 0.42);
  const onStem = Math.abs(cx + scale * 0.15) < size * 0.035 && cy > -scale * 0.05 && cy < scale * 0.55;
  const onArm = Math.abs(cy - cx * 0.9 + scale * 0.05) < size * 0.04 && cx > -scale * 0.05 && cx < scale * 0.55 && cy < scale * 0.2;
  if (onStem || onArm) return cream;
  return blue;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "icon-192.png"), png(192, (x, y, size) => icon(x, y, size, false)));
writeFileSync(join(outDir, "icon-512.png"), png(512, (x, y, size) => icon(x, y, size, false)));
writeFileSync(join(outDir, "icon-maskable-512.png"), png(512, (x, y, size) => icon(x, y, size, true)));
writeFileSync(join(outDir, "apple-touch-icon.png"), png(180, (x, y, size) => icon(x, y, size, false)));
