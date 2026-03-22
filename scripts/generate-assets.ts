/**
 * Generate pixel art PNG assets for the Aquarium example.
 * Uses raw PNG encoding (no external dependencies).
 *
 * Run: mise exec -- npx tsx scripts/generate-assets.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { deflateSync } from "zlib";

const OUT_DIR = resolve(__dirname, "../examples/aquarium/public/assets");
mkdirSync(OUT_DIR, { recursive: true });

// ============================================================
// Minimal PNG encoder
// ============================================================

function createPNG(width: number, height: number, pixels: number[][]): Buffer {
  // pixels[y][x] = 0xRRGGBBAA

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw pixel data with filter byte per row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const c = pixels[y]?.[x] ?? 0;
      const offset = y * (1 + width * 4) + 1 + x * 4;
      rawData[offset] = (c >> 24) & 0xff;     // R
      rawData[offset + 1] = (c >> 16) & 0xff; // G
      rawData[offset + 2] = (c >> 8) & 0xff;  // B
      rawData[offset + 3] = c & 0xff;          // A
    }
  }
  const compressed = deflateSync(rawData);

  // Build PNG file
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type: string, data: Buffer): Buffer {
    const buf = Buffer.alloc(4 + 4 + data.length + 4);
    buf.writeUInt32BE(data.length, 0);
    buf.write(type, 4, 4, "ascii");
    data.copy(buf, 8);
    // CRC32 of type + data
    const crcData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    buf.writeUInt32BE(crc32(crcData) >>> 0, 8 + data.length);
    return buf;
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// CRC32 lookup table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ 0xffffffff;
}

// ============================================================
// Color helpers
// ============================================================

function rgba(r: number, g: number, b: number, a: number = 255): number {
  return ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
}

const TRANSPARENT = 0x00000000;

function makeGrid(w: number, h: number, fill: number = TRANSPARENT): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

// ============================================================
// Pixel art sprites
// ============================================================

function generateFish(bodyR: number, bodyG: number, bodyB: number, name: string) {
  // 16x10 fish facing right
  const w = 16, h = 10;
  const px = makeGrid(w, h);
  const body = rgba(bodyR, bodyG, bodyB);
  const dark = rgba(Math.floor(bodyR * 0.6), Math.floor(bodyG * 0.6), Math.floor(bodyB * 0.6));
  const eye = rgba(255, 255, 255);
  const pupil = rgba(20, 20, 40);
  const fin = rgba(bodyR, bodyG, bodyB, 180);

  // Body (ellipse-ish)
  const bodyPixels = [
    "      xxxxxx    ",
    "    xxxxxxxxxx  ",
    "   xxxxxxxxxxxx ",
    "  xxxxxxxxxxxxxx",
    " xxxxxxxEPxxxxxx",
    " xxxxxxxxxxxxxxx",
    "  xxxxxxxxxxxxxx",
    "   xxxxxxxxxxxx ",
    "    xxxxxxxxxx  ",
    "      xxxxxx    ",
  ];

  // Tail
  const tailPixels = [
    "tt              ",
    "ttt             ",
    "tttt            ",
    "ttttt           ",
    "tttttt          ",
    "tttttt          ",
    "ttttt           ",
    "tttt            ",
    "ttt             ",
    "tt              ",
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bc = bodyPixels[y]?.[x];
      const tc = tailPixels[y]?.[x];
      if (bc === "E") px[y][x] = eye;
      else if (bc === "P") px[y][x] = pupil;
      else if (bc === "x") px[y][x] = body;
      else if (tc === "t") px[y][x] = fin;
    }
  }

  // Darker belly
  for (let x = 4; x < 14; x++) {
    if (px[7][x] === body) px[7][x] = dark;
    if (px[8][x] === body) px[8][x] = dark;
  }

  writeFileSync(resolve(OUT_DIR, name), createPNG(w, h, px));
  console.log(`  ${name} (${w}x${h})`);
}

function generateJellyfish() {
  const w = 14, h = 16;
  const px = makeGrid(w, h);
  const bell = rgba(180, 140, 220, 200);
  const tentacle = rgba(160, 120, 200, 140);

  // Bell (dome shape)
  const dome = [
    "     xxxx     ",
    "   xxxxxxxx   ",
    "  xxxxxxxxxx  ",
    " xxxxxxxxxxxx ",
    " xxxxxxxxxxxx ",
    "  xxxxxxxxxx  ",
    "   xxxxxxxx   ",
  ];

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < w; x++) {
      if (dome[y]?.[x] === "x") px[y][x] = bell;
    }
  }

  // Eyes
  px[3][5] = rgba(255, 255, 255, 200);
  px[3][8] = rgba(255, 255, 255, 200);

  // Tentacles
  for (let y = 7; y < 16; y++) {
    const wave = Math.sin(y * 0.8) * 1.5;
    px[y][Math.floor(3 + wave)] = tentacle;
    px[y][Math.floor(6 - wave * 0.5)] = tentacle;
    px[y][Math.floor(8 + wave * 0.5)] = tentacle;
    px[y][Math.floor(11 - wave)] = tentacle;
  }

  writeFileSync(resolve(OUT_DIR, "jellyfish.png"), createPNG(w, h, px));
  console.log(`  jellyfish.png (${w}x${h})`);
}

function generateSeaweed() {
  const w = 8, h = 32;
  const px = makeGrid(w, h);
  const green = rgba(45, 139, 70);
  const light = rgba(60, 180, 90);

  for (let y = 0; y < h; y++) {
    const wave = Math.sin(y * 0.3) * 1.5;
    const cx = Math.floor(4 + wave);
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      if (x >= 0 && x < w) {
        px[y][x] = dx === 0 ? green : light;
      }
    }
    // Leaf every 6 pixels
    if (y % 6 === 3) {
      const leafDir = (y % 12 < 6) ? 1 : -1;
      for (let lx = 1; lx <= 3; lx++) {
        const x = cx + leafDir * lx;
        if (x >= 0 && x < w) px[y][x] = light;
        if (x >= 0 && x < w && y + 1 < h) px[y + 1][x] = green;
      }
    }
  }

  writeFileSync(resolve(OUT_DIR, "seaweed.png"), createPNG(w, h, px));
  console.log(`  seaweed.png (${w}x${h})`);
}

function generateBubble() {
  const w = 8, h = 8;
  const px = makeGrid(w, h);
  const outer = rgba(136, 204, 238, 150);
  const inner = rgba(200, 230, 255, 100);
  const shine = rgba(255, 255, 255, 200);

  // Circle
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - 3.5, dy = y - 3.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 3) px[y][x] = inner;
      else if (d < 3.8) px[y][x] = outer;
    }
  }
  // Highlight
  px[2][2] = shine;
  px[2][3] = shine;

  writeFileSync(resolve(OUT_DIR, "bubble.png"), createPNG(w, h, px));
  console.log(`  bubble.png (${w}x${h})`);
}

function generateFood() {
  const w = 6, h = 6;
  const px = makeGrid(w, h);
  const outer = rgba(200, 150, 60);
  const inner = rgba(230, 180, 80);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - 2.5, dy = y - 2.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2) px[y][x] = inner;
      else if (d < 2.8) px[y][x] = outer;
    }
  }

  writeFileSync(resolve(OUT_DIR, "food.png"), createPNG(w, h, px));
  console.log(`  food.png (${w}x${h})`);
}

function generateBackground() {
  const w = 64, h = 48;
  const px = makeGrid(w, h);

  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = Math.floor(10 + t * 5);
    const g = Math.floor(30 + (1 - t) * 30);
    const b = Math.floor(50 + (1 - t) * 50);
    for (let x = 0; x < w; x++) {
      px[y][x] = rgba(r, g, b);
    }
  }

  // Light rays at top
  for (let x = 10; x < 54; x += 8) {
    for (let y = 0; y < 12; y++) {
      const alpha = Math.floor(30 * (1 - y / 12));
      px[y][x] = rgba(80, 120, 160, alpha);
      if (x + 1 < w) px[y][x + 1] = rgba(80, 120, 160, Math.floor(alpha * 0.6));
    }
  }

  writeFileSync(resolve(OUT_DIR, "background.png"), createPNG(w, h, px));
  console.log(`  background.png (${w}x${h})`);
}

// ============================================================
// Generate all
// ============================================================

console.log("Generating aquarium pixel art assets...");
console.log(`Output: ${OUT_DIR}\n`);

generateFish(255, 107, 107, "fish-red.png");
generateFish(78, 205, 196, "fish-teal.png");
generateFish(255, 230, 109, "fish-yellow.png");
generateJellyfish();
generateSeaweed();
generateBubble();
generateFood();
generateBackground();

console.log("\nDone! All assets generated.");
