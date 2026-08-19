#!/usr/bin/env node
// Generates the Tauri app icons (PNG + Windows .ico) without any native deps.
// Design: violet -> cyan diagonal gradient with a white mind-map motif
// (a central node branching to three satellites), matching the app theme.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });

// ---------- minimal PNG encoder (RGBA, filter 0, no interlace) ----------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, pixelFn) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace: none
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- icon artwork ----------
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

const CENTER = { x: 0.5, y: 0.5 };
const SATELLITES = [
  { x: 0.5, y: 0.2 }, // top
  { x: 0.24, y: 0.66 }, // bottom-left
  { x: 0.76, y: 0.66 }, // bottom-right
];
const CENTER_R = 0.13;
const SAT_R = 0.075;
const LINE_HALF = 0.026;

function motifCoverage(px, py, size) {
  const cx = CENTER.x * size;
  const cy = CENTER.y * size;
  const lineHalf = LINE_HALF * size;
  let cov = 0;
  const nodes = [
    { x: cx, y: cy, r: CENTER_R * size },
    ...SATELLITES.map((s) => ({ x: s.x * size, y: s.y * size, r: SAT_R * size })),
  ];
  for (const n of nodes) {
    const d = Math.hypot(px - n.x, py - n.y);
    cov = Math.max(cov, clamp(n.r - d + 0.5, 0, 1));
  }
  for (const s of SATELLITES) {
    const d = distToSegment(px, py, cx, cy, s.x * size, s.y * size);
    cov = Math.max(cov, clamp(lineHalf - d + 0.5, 0, 1));
  }
  return cov;
}

function iconPixel(x, y, size) {
  const u = (x + 0.5) / size;
  const v = (y + 0.5) / size;
  const t = (u + v) / 2;
  // violet #8b7cff -> cyan #5ee7ff
  let r = 139 + (94 - 139) * t;
  let g = 124 + (231 - 124) * t;
  let b = 255;
  const cov = motifCoverage(x + 0.5, y + 0.5, size);
  r = r * (1 - cov) + 255 * cov;
  g = g * (1 - cov) + 255 * cov;
  b = b * (1 - cov) + 255 * cov;
  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

function writePng(name, size) {
  writeFileSync(join(outDir, name), encodePng(size, iconPixel));
}

writePng("32x32.png", 32);
writePng("128x128.png", 128);
writePng("128x128@2x.png", 256);
writePng("icon.png", 512);

// ---------- Windows .ico (single 256x256 PNG-compressed entry) ----------
const png256 = encodePng(256, iconPixel);
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: 1 = icon
icoHeader.writeUInt16LE(1, 4); // image count
const icoDir = Buffer.alloc(16);
icoDir.writeUInt8(0, 0); // width: 0 => 256
icoDir.writeUInt8(0, 1); // height: 0 => 256
icoDir.writeUInt8(0, 2); // palette: 0
icoDir.writeUInt8(0, 3); // reserved
icoDir.writeUInt16LE(1, 4); // planes
icoDir.writeUInt16LE(32, 6); // bpp
icoDir.writeUInt32LE(png256.length, 8); // data size
icoDir.writeUInt32LE(22, 12); // data offset (6 header + 16 dir)
writeFileSync(join(outDir, "icon.ico"), Buffer.concat([icoHeader, icoDir, png256]));

console.log("Generated icons in", outDir);
