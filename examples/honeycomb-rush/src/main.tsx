/**
 * Solidion Example: Honeycomb Rush (Hybrid RECS + Hooks)
 *
 * Tower defense game demonstrating RECS validation:
 *  - RECS (createStore + System + createIndex): Enemies (100+), Projectiles
 *  - Hooks: Worker bees (8-12 units)
 *  - Signals: Larvae HP, honey, wave state, UI
 *  - System phases: pre/main/post (all three used)
 *  - createIndex: 4 sets (walking/blocked/slowed/dying)
 */

import { createSignal, createMemo, createRoot, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { Game, Show, useScene } from "solidion";
import { System, forActive, createIndex } from "solidion/recs";
import * as debug from "solidion/debug";
import Phaser from "phaser";

debug.enable();

// ══════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════

const W = 640, H = 480;
const COLS = 13, ROWS = 10;
const CELL = 48;
const MAP_OFFSET_X = (W - COLS * CELL) / 2;
const MAP_OFFSET_Y = (H - ROWS * CELL) / 2;

const MAX_ENEMIES = 120;
const MAX_PROJECTILES = 25;

// Cell types
const WALL = "#";
const GROUND = ".";
const HIGH = "^";
const NEST = "S";  // ★ in map

type CellType = "#" | "." | "^" | "A" | "B" | "C" | "S";

const MAP_DATA: CellType[][] = [
  ["#","#","#","#","#","#","#","#","#","#","#","#","#"],
  ["A",".",".",".",".","^","#","^",".",".",".","C","#"],
  ["#","^","#",".","^",".",".",".","^",".","#","^","#"],
  ["#",".",".",".",".",".",".",".",".",".",".",".","."], // odd→ offset note: stagger display only
  ["#","^",".","^",".",".",".",".",".",".",".",".","#"], // corrected: row4 has ^ at edges
  ["#","#",".",".","^","S","S","^",".",".","#","#","#"],
  ["#","^",".","^",".",".",".",".",".","^",".","^","#"],
  ["#",".",".",".",".",".","^",".",".",".",".",".","#"],  // corrected: was missing ^
  ["#","^","#",".","^",".",".",".","^",".","#","^","#"],
  ["B",".",".",".",".","^","#","^",".",".",".","#","#"],
];

// Re-read the spec map more carefully:
// row0: # # # # # # # # # # # # #
// row1: A . . . . ^ # ^ . . . C #
// row2: # ^ # . ^ . . . ^ . # ^ #
// row3: # . . . . . ^ . . . . . #   (odd row, has ^ at col6)
// row4: # ^ . ^ . . . . . ^ . ^ #
// row5: # # . . ^ S S ^ . . # # #
// row6: # ^ . ^ . . . . . ^ . ^ #
// row7: # . . . . . ^ . . . . . #   (odd row, has ^ at col6)
// row8: # ^ # . ^ . . . ^ . # ^ #
// row9: B . . . . ^ # ^ . . . # #

// Fix MAP_DATA to match spec exactly:
MAP_DATA[3] = ["#",".",".",".",".",".","^",".",".",".",".",".","#"];
MAP_DATA[4] = ["#","^",".","^",".",".",".",".",".",".",".",".","#"];
// row4 spec: # ^ . ^ . . . . . ^ . ^ #
MAP_DATA[4] = ["#","^",".","^",".",".",".",".",".",".",".",".","#"];
// Actually re-reading: row4: # ^ . ^ . . . . . ^ . ^ #
MAP_DATA[4] = ["#","^",".","^",".",".",".",".",".","^",".","^","#"];
MAP_DATA[7] = ["#",".",".",".",".",".","^",".",".",".",".",".","#"];

// Spawn points
const SPAWN_A: [number, number] = [1, 0];
const SPAWN_B: [number, number] = [9, 0];
const SPAWN_C: [number, number] = [1, 11];

// Nest cells
const NEST_CELLS: [number, number][] = [[5, 5], [5, 6]];

// ══════════════════════════════════════════════════
// Pixel Art Texture Generation
// ══════════════════════════════════════════════════

function createPixelTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// Flat-top hexagon path within a 48x48 cell.
// Vertices: top-left, top-right (flat top), right, bottom-right, bottom-left (flat bottom), left
function hexPath(ctx: CanvasRenderingContext2D, inset = 0) {
  const w = 48, h = 48;
  const q = 12 - inset;        // horizontal inset for angled edges (~25% of width)
  const t = inset;              // top/bottom inset
  const b = h - inset;
  const l = inset;
  const r = w - inset;
  ctx.beginPath();
  ctx.moveTo(q + inset, t);          // top-left
  ctx.lineTo(r - q + inset, t);      // top-right  (flat top edge)
  ctx.lineTo(r, h / 2);              // right point
  ctx.lineTo(r - q + inset, b);      // bottom-right
  ctx.lineTo(q + inset, b);          // bottom-left (flat bottom edge)
  ctx.lineTo(l, h / 2);              // left point
  ctx.closePath();
}

function fillHex(ctx: CanvasRenderingContext2D, color: string, inset = 0) {
  ctx.fillStyle = color;
  hexPath(ctx, inset);
  ctx.fill();
}

function strokeHex(ctx: CanvasRenderingContext2D, color: string, width: number, inset = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  hexPath(ctx, inset);
  ctx.stroke();
}

function generateAllTextures(scene: Phaser.Scene) {
  // Ground cell — hex with honeycomb color
  createPixelTexture(scene, "cell-ground", 48, 48, (ctx) => {
    fillHex(ctx, "#dab040");
    fillHex(ctx, "#c8a028", 3);
    strokeHex(ctx, "#a07010", 2);
  });

  // Wall cell — dark hex
  createPixelTexture(scene, "cell-wall", 48, 48, (ctx) => {
    fillHex(ctx, "#4a2a08");
    fillHex(ctx, "#3a1a04", 3);
    strokeHex(ctx, "#2a0a00", 2);
  });

  // High ground cell — elevated hex with dots
  createPixelTexture(scene, "cell-high", 48, 48, (ctx) => {
    fillHex(ctx, "#f0d060");
    fillHex(ctx, "#e0c048", 3);
    strokeHex(ctx, "#b09020", 2);
    // Elevated marker dots (inside hex)
    ctx.fillStyle = "#c8a030";
    for (let y = 14; y < 36; y += 7) {
      for (let x = 16; x < 32; x += 7) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  });

  // Nest cell — golden hex with heart emblem
  createPixelTexture(scene, "cell-nest", 48, 48, (ctx) => {
    fillHex(ctx, "#ffee66");
    fillHex(ctx, "#ffdd44", 3);
    strokeHex(ctx, "#cc9900", 2);
    // Heart shape at center
    ctx.fillStyle = "#ff8800";
    const cx = 24, cy = 22;
    // Simple pixel-art heart
    for (const [dx, dy] of [
      [-3,-2],[-2,-3],[-1,-3],[0,-2],[1,-3],[2,-3],[3,-2],
      [-4,-1],[-3,-1],[-2,-1],[-1,-1],[0,-1],[1,-1],[2,-1],[3,-1],[4,-1],
      [-4,0],[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0],[4,0],
      [-3,1],[-2,1],[-1,1],[0,1],[1,1],[2,1],[3,1],
      [-2,2],[-1,2],[0,2],[1,2],[2,2],
      [-1,3],[0,3],[1,3],
      [0,4],
    ]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
  });

  // Spawn cell — red-tinted hex with arrow
  createPixelTexture(scene, "cell-spawn", 48, 48, (ctx) => {
    fillHex(ctx, "#904040");
    fillHex(ctx, "#803030", 3);
    strokeHex(ctx, "#602020", 2);
    // Arrow pointing inward
    ctx.fillStyle = "#ff6060";
    for (let x = 16; x < 32; x++) ctx.fillRect(x, 23, 1, 2);
    ctx.fillRect(28, 19, 2, 2); ctx.fillRect(30, 21, 2, 2);
    ctx.fillRect(28, 27, 2, 2); ctx.fillRect(30, 25, 2, 2);
  });

  // Ant (8x8 pixel art)
  createPixelTexture(scene, "ant", 8, 8, (ctx) => {
    const c = "#2a1a0a";
    px(ctx, 2, 1, c); px(ctx, 5, 1, c); // antennae
    px(ctx, 3, 2, c); px(ctx, 4, 2, c); // head
    px(ctx, 2, 3, c); px(ctx, 3, 3, "#3a2a1a"); px(ctx, 4, 3, "#3a2a1a"); px(ctx, 5, 3, c); // thorax
    px(ctx, 1, 4, c); px(ctx, 3, 4, "#4a3a2a"); px(ctx, 4, 4, "#4a3a2a"); px(ctx, 6, 4, c); // abdomen + legs
    px(ctx, 2, 5, c); px(ctx, 3, 5, "#3a2a1a"); px(ctx, 4, 5, "#3a2a1a"); px(ctx, 5, 5, c); // abdomen
    px(ctx, 1, 5, c); px(ctx, 6, 5, c); // legs
    px(ctx, 3, 6, c); px(ctx, 4, 6, c); // tail
  });

  // Hornet (10x10)
  createPixelTexture(scene, "hornet", 10, 10, (ctx) => {
    const y1 = "#e8c020", blk = "#1a1a1a";
    px(ctx, 4, 0, y1); px(ctx, 5, 0, y1); // antennae tips
    px(ctx, 3, 1, blk); px(ctx, 4, 1, y1); px(ctx, 5, 1, y1); px(ctx, 6, 1, blk);
    // Wings
    px(ctx, 1, 2, "#88bbee"); px(ctx, 2, 2, "#aaddff"); px(ctx, 7, 2, "#aaddff"); px(ctx, 8, 2, "#88bbee");
    // Body stripes
    for (let x = 3; x <= 6; x++) px(ctx, x, 2, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 3, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 4, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 5, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 6, y1);
    // Legs
    px(ctx, 2, 5, blk); px(ctx, 7, 5, blk);
    px(ctx, 2, 6, blk); px(ctx, 7, 6, blk);
    // Stinger
    px(ctx, 4, 7, blk); px(ctx, 5, 7, blk);
    px(ctx, 4, 8, "#cc2200"); px(ctx, 5, 8, "#cc2200");
  });

  // Beetle (12x12)
  createPixelTexture(scene, "beetle", 12, 12, (ctx) => {
    const sh = "#3a5a2a", dk = "#2a4a1a";
    // Head
    for (let x = 4; x <= 7; x++) px(ctx, x, 1, "#4a3a2a");
    // Horn
    px(ctx, 5, 0, "#5a4a3a"); px(ctx, 6, 0, "#5a4a3a");
    // Shell
    for (let y = 2; y <= 8; y++) {
      for (let x = 2; x <= 9; x++) {
        px(ctx, x, y, (x + y) % 2 === 0 ? sh : dk);
      }
    }
    // Shell highlight
    px(ctx, 4, 3, "#5a7a4a"); px(ctx, 5, 3, "#5a7a4a");
    // Legs
    px(ctx, 1, 4, "#2a1a0a"); px(ctx, 10, 4, "#2a1a0a");
    px(ctx, 1, 6, "#2a1a0a"); px(ctx, 10, 6, "#2a1a0a");
    px(ctx, 1, 8, "#2a1a0a"); px(ctx, 10, 8, "#2a1a0a");
    // Underside
    for (let x = 3; x <= 8; x++) px(ctx, x, 9, "#3a2a1a");
    for (let x = 4; x <= 7; x++) px(ctx, x, 10, "#3a2a1a");
  });

  // Moth (10x10)
  createPixelTexture(scene, "moth", 10, 10, (ctx) => {
    const w1 = "#ccbbaa", w2 = "#aa9988", body = "#665544";
    // Antennae
    px(ctx, 3, 0, "#887766"); px(ctx, 6, 0, "#887766");
    // Head
    px(ctx, 4, 1, body); px(ctx, 5, 1, body);
    // Body
    for (let y = 2; y <= 6; y++) { px(ctx, 4, y, body); px(ctx, 5, y, body); }
    // Wings (left)
    px(ctx, 1, 2, w1); px(ctx, 2, 2, w2); px(ctx, 3, 2, w1);
    px(ctx, 0, 3, w2); px(ctx, 1, 3, w1); px(ctx, 2, 3, w2); px(ctx, 3, 3, w1);
    px(ctx, 0, 4, w1); px(ctx, 1, 4, w2); px(ctx, 2, 4, w1); px(ctx, 3, 4, w2);
    px(ctx, 1, 5, w1); px(ctx, 2, 5, w2); px(ctx, 3, 5, w1);
    // Wings (right)
    px(ctx, 6, 2, w1); px(ctx, 7, 2, w2); px(ctx, 8, 2, w1);
    px(ctx, 6, 3, w1); px(ctx, 7, 3, w2); px(ctx, 8, 3, w1); px(ctx, 9, 3, w2);
    px(ctx, 6, 4, w2); px(ctx, 7, 4, w1); px(ctx, 8, 4, w2); px(ctx, 9, 4, w1);
    px(ctx, 6, 5, w1); px(ctx, 7, 5, w2); px(ctx, 8, 5, w1);
    // Eye dots
    px(ctx, 3, 2, "#ffeecc"); px(ctx, 6, 2, "#ffeecc");
  });

  // Guard bee (10x10)
  createPixelTexture(scene, "bee-guard", 10, 10, (ctx) => {
    const y1 = "#ffcc00", blk = "#222222";
    px(ctx, 4, 0, "#ffee44"); px(ctx, 5, 0, "#ffee44"); // antennae
    for (let x = 3; x <= 6; x++) px(ctx, x, 1, y1); // head
    px(ctx, 3, 1, "#ffffff"); px(ctx, 6, 1, "#ffffff"); // eyes
    // Wings
    px(ctx, 1, 2, "#ddeeFF"); px(ctx, 2, 2, "#ccddff"); px(ctx, 7, 2, "#ccddff"); px(ctx, 8, 2, "#ddeeFF");
    // Body stripes
    for (let x = 3; x <= 6; x++) px(ctx, x, 2, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 3, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 4, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 5, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 6, y1);
    // Legs
    px(ctx, 2, 5, blk); px(ctx, 7, 5, blk);
    // Stinger
    px(ctx, 4, 7, "#cc8800"); px(ctx, 5, 7, "#cc8800");
    // Shield emblem (guard marker)
    px(ctx, 4, 4, "#ff4444"); px(ctx, 5, 4, "#ff4444");
  });

  // Archer bee (10x10)
  createPixelTexture(scene, "bee-archer", 10, 10, (ctx) => {
    const y1 = "#ffcc00", blk = "#222222";
    px(ctx, 4, 0, "#ffee44"); px(ctx, 5, 0, "#ffee44");
    for (let x = 3; x <= 6; x++) px(ctx, x, 1, y1);
    px(ctx, 1, 2, "#ddeeFF"); px(ctx, 2, 2, "#ccddff"); px(ctx, 7, 2, "#ccddff"); px(ctx, 8, 2, "#ddeeFF");
    for (let x = 3; x <= 6; x++) px(ctx, x, 2, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 3, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 4, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 5, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 6, y1);
    px(ctx, 2, 5, blk); px(ctx, 7, 5, blk);
    // Arrow emblem
    px(ctx, 8, 3, "#aaaaaa"); px(ctx, 9, 4, "#aaaaaa"); px(ctx, 8, 5, "#aaaaaa");
    px(ctx, 4, 7, "#cc8800"); px(ctx, 5, 7, "#cc8800");
  });

  // Slower bee (honey spreader, 10x10)
  createPixelTexture(scene, "bee-slower", 10, 10, (ctx) => {
    const y1 = "#ffcc00", blk = "#222222";
    px(ctx, 4, 0, "#ffee44"); px(ctx, 5, 0, "#ffee44");
    for (let x = 3; x <= 6; x++) px(ctx, x, 1, y1);
    px(ctx, 1, 2, "#ddeeFF"); px(ctx, 2, 2, "#ccddff"); px(ctx, 7, 2, "#ccddff"); px(ctx, 8, 2, "#ddeeFF");
    for (let x = 3; x <= 6; x++) px(ctx, x, 2, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 3, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 4, y1);
    for (let x = 3; x <= 6; x++) px(ctx, x, 5, blk);
    for (let x = 3; x <= 6; x++) px(ctx, x, 6, y1);
    px(ctx, 2, 5, blk); px(ctx, 7, 5, blk);
    // Honey drop emblem
    px(ctx, 4, 4, "#ff8800"); px(ctx, 5, 4, "#ff8800");
    px(ctx, 4, 5, "#ff8800"); px(ctx, 5, 5, "#ff8800");
    px(ctx, 4, 7, "#cc8800"); px(ctx, 5, 7, "#cc8800");
  });

  // Queen bee (12x12)
  createPixelTexture(scene, "bee-queen", 12, 12, (ctx) => {
    const y1 = "#ffcc00", blk = "#222222";
    // Crown
    px(ctx, 4, 0, "#ffdd00"); px(ctx, 5, 0, "#ff4444"); px(ctx, 6, 0, "#ffdd00"); px(ctx, 7, 0, "#ff4444");
    px(ctx, 3, 1, "#ffdd00"); px(ctx, 4, 1, "#ffdd00"); px(ctx, 5, 1, "#ffdd00"); px(ctx, 6, 1, "#ffdd00"); px(ctx, 7, 1, "#ffdd00"); px(ctx, 8, 1, "#ffdd00");
    // Head
    for (let x = 4; x <= 7; x++) px(ctx, x, 2, y1);
    px(ctx, 4, 2, "#ffffff"); px(ctx, 7, 2, "#ffffff");
    // Wings
    px(ctx, 1, 3, "#ddeeFF"); px(ctx, 2, 3, "#ccddff"); px(ctx, 9, 3, "#ccddff"); px(ctx, 10, 3, "#ddeeFF");
    // Body
    for (let x = 4; x <= 7; x++) px(ctx, x, 3, y1);
    for (let x = 4; x <= 7; x++) px(ctx, x, 4, blk);
    for (let x = 4; x <= 7; x++) px(ctx, x, 5, y1);
    for (let x = 4; x <= 7; x++) px(ctx, x, 6, blk);
    for (let x = 4; x <= 7; x++) px(ctx, x, 7, y1);
    for (let x = 4; x <= 7; x++) px(ctx, x, 8, y1);
    // Legs
    px(ctx, 3, 6, blk); px(ctx, 8, 6, blk);
    // Stinger
    px(ctx, 5, 9, "#cc8800"); px(ctx, 6, 9, "#cc8800");
  });

  // Larva — oval/elliptical body (8x12, taller than wide)
  createPixelTexture(scene, "larva", 8, 12, (ctx) => {
    // Oval body shape (wider in middle, tapered at top/bottom)
    const body = "#fff8e0", shade = "#ffe8c0";
    //         row 0:     --XX--
    px(ctx, 3, 0, shade); px(ctx, 4, 0, shade);
    //         row 1:    -XXXX-
    for (let x = 2; x <= 5; x++) px(ctx, x, 1, body);
    //         rows 2-9: XXXXXX (full width)
    for (let y = 2; y <= 9; y++) {
      for (let x = 1; x <= 6; x++) px(ctx, x, y, body);
    }
    //         row 10:   -XXXX-
    for (let x = 2; x <= 5; x++) px(ctx, x, 10, body);
    //         row 11:    --XX--
    px(ctx, 3, 11, shade); px(ctx, 4, 11, shade);
    // Segment lines (horizontal grooves)
    for (let x = 2; x <= 5; x++) { px(ctx, x, 4, shade); px(ctx, x, 7, shade); }
    // Face — eyes
    px(ctx, 3, 3, "#333"); px(ctx, 5, 3, "#333");
    // Blush (hanakamu — blushing cheeks)
    px(ctx, 2, 5, "#ffaaaa"); px(ctx, 6, 5, "#ffaaaa");
    px(ctx, 2, 6, "#ffaaaa"); px(ctx, 6, 6, "#ffaaaa");
    // Shy smile
    px(ctx, 3, 6, "#cc8888"); px(ctx, 4, 6, "#cc8888"); px(ctx, 5, 6, "#cc8888");
  });

  // Larva scared — oval body, frightened face
  createPixelTexture(scene, "larva-scared", 8, 12, (ctx) => {
    const body = "#fff0d0", shade = "#ffe0b0";
    px(ctx, 3, 0, shade); px(ctx, 4, 0, shade);
    for (let x = 2; x <= 5; x++) px(ctx, x, 1, body);
    for (let y = 2; y <= 9; y++) {
      for (let x = 1; x <= 6; x++) px(ctx, x, y, body);
    }
    for (let x = 2; x <= 5; x++) px(ctx, x, 10, body);
    px(ctx, 3, 11, shade); px(ctx, 4, 11, shade);
    for (let x = 2; x <= 5; x++) { px(ctx, x, 4, shade); px(ctx, x, 7, shade); }
    // Wide scared eyes
    px(ctx, 2, 3, "#333"); px(ctx, 3, 3, "#333");
    px(ctx, 5, 3, "#333"); px(ctx, 6, 3, "#333");
    // Tear drops
    px(ctx, 2, 5, "#6688cc"); px(ctx, 6, 5, "#6688cc");
    // Worried mouth (open O)
    px(ctx, 3, 6, "#aaaaaa"); px(ctx, 4, 6, "#aaaaaa"); px(ctx, 5, 6, "#aaaaaa");
    px(ctx, 3, 7, "#aaaaaa"); px(ctx, 5, 7, "#aaaaaa");
  });

  // Larva crying — oval body, tears streaming
  createPixelTexture(scene, "larva-crying", 8, 12, (ctx) => {
    const body = "#ffe8c0", shade = "#ffd8a0";
    px(ctx, 3, 0, shade); px(ctx, 4, 0, shade);
    for (let x = 2; x <= 5; x++) px(ctx, x, 1, body);
    for (let y = 2; y <= 9; y++) {
      for (let x = 1; x <= 6; x++) px(ctx, x, y, body);
    }
    for (let x = 2; x <= 5; x++) px(ctx, x, 10, body);
    px(ctx, 3, 11, shade); px(ctx, 4, 11, shade);
    for (let x = 2; x <= 5; x++) { px(ctx, x, 4, shade); px(ctx, x, 7, shade); }
    // Squinting crying eyes
    px(ctx, 2, 3, "#333"); px(ctx, 3, 3, "#333");
    px(ctx, 5, 3, "#333"); px(ctx, 6, 3, "#333");
    // Streaming tears
    px(ctx, 1, 4, "#4488ff"); px(ctx, 1, 5, "#4488ff"); px(ctx, 1, 6, "#4488ff");
    px(ctx, 7, 4, "#4488ff"); px(ctx, 7, 5, "#4488ff"); px(ctx, 7, 6, "#4488ff");
    // Wide open crying mouth
    px(ctx, 3, 6, "#cc4444"); px(ctx, 4, 6, "#cc4444"); px(ctx, 5, 6, "#cc4444");
    px(ctx, 3, 7, "#cc4444"); px(ctx, 4, 7, "#cc4444"); px(ctx, 5, 7, "#cc4444");
  });

  // Projectile needle (4x4)
  createPixelTexture(scene, "needle", 4, 4, (ctx) => {
    px(ctx, 1, 0, "#cccccc");
    px(ctx, 1, 1, "#aaaaaa");
    px(ctx, 1, 2, "#888888");
    px(ctx, 1, 3, "#cc8800");
  });

  // Honey drop projectile (4x4)
  createPixelTexture(scene, "honey-drop", 4, 4, (ctx) => {
    px(ctx, 1, 0, "#ffcc00");
    px(ctx, 0, 1, "#ffcc00"); px(ctx, 1, 1, "#ffdd44"); px(ctx, 2, 1, "#ffcc00");
    px(ctx, 0, 2, "#ffcc00"); px(ctx, 1, 2, "#ffdd44"); px(ctx, 2, 2, "#ffcc00");
    px(ctx, 1, 3, "#ffcc00");
  });
}

// ══════════════════════════════════════════════════
// Grid Utilities
// ══════════════════════════════════════════════════

function cellToX(row: number, col: number): number {
  const stagger = row % 2 === 1 ? CELL / 2 : 0;
  return MAP_OFFSET_X + col * CELL + CELL / 2 + stagger;
}

function cellToY(row: number, _col: number): number {
  return MAP_OFFSET_Y + row * CELL + CELL / 2;
}

function getNeighbors(row: number, col: number): [number, number][] {
  const neighbors: [number, number][] = [];
  const isOdd = row % 2 === 1;

  const offsets = isOdd
    ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]   // odd row
    : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]; // even row

  for (const [dr, dc] of offsets) {
    const nr = row + dr, nc = col + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      neighbors.push([nr, nc]);
    }
  }
  return neighbors;
}

// Blocked cells: walls, occupied ground (by guard bees), high ground
function isPassable(grid: CellType[][], row: number, col: number, isFlying: boolean): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const cell = grid[row][col];
  if (cell === WALL) return false;
  if (cell === HIGH && !isFlying) return false;
  return true;
}

// ══════════════════════════════════════════════════
// BFS Pathfinding
// ══════════════════════════════════════════════════

function bfs(
  grid: CellType[][],
  start: [number, number],
  goals: [number, number][],
  isFlying: boolean,
  guardPositions: Set<string>,
): [number, number][] | null {
  const goalSet = new Set(goals.map(([r, c]) => `${r},${c}`));
  const visited = new Set<string>();
  const prev = new Map<string, string>();
  const queue: [number, number][] = [start];
  const startKey = `${start[0]},${start[1]}`;
  visited.add(startKey);

  while (queue.length > 0) {
    const [cr, cc] = queue.shift()!;
    const ck = `${cr},${cc}`;

    if (goalSet.has(ck)) {
      // Reconstruct path
      const path: [number, number][] = [];
      let cur: string | undefined = ck;
      while (cur) {
        const [r, c] = cur.split(",").map(Number);
        path.unshift([r, c]);
        cur = prev.get(cur);
      }
      return path;
    }

    for (const [nr, nc] of getNeighbors(cr, cc)) {
      const nk = `${nr},${nc}`;
      if (visited.has(nk)) continue;

      // Ground cells occupied by guards are blocked (unless flying)
      if (!isFlying && guardPositions.has(nk) && !goalSet.has(nk)) continue;

      const cell = grid[nr][nc];
      // Spawns and nests are passable
      if (cell === WALL) { continue; }
      if (cell === HIGH && !isFlying) { continue; }

      visited.add(nk);
      prev.set(nk, ck);
      queue.push([nr, nc]);
    }
  }

  return null; // No path found
}

// ══════════════════════════════════════════════════
// Enemy Types Configuration
// ══════════════════════════════════════════════════

interface EnemyConfig {
  hp: number;
  speed: number; // progress/s
  reward: number;
  texture: string;
  size: number;
  color: number;
}

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  ant:    { hp: 3,  speed: 0.07,  reward: 1, texture: "ant",    size: 3,  color: 0x4a3a2a },
  hornet: { hp: 8,  speed: 0.05,  reward: 3, texture: "hornet", size: 4,  color: 0xe8c020 },
  beetle: { hp: 25, speed: 0.025, reward: 5, texture: "beetle", size: 5,  color: 0x3a5a2a },
  moth:   { hp: 4,  speed: 0.06,  reward: 2, texture: "moth",   size: 4,  color: 0xccbbaa },
};

// ══════════════════════════════════════════════════
// RECS Stores
// ══════════════════════════════════════════════════

interface EnemyEntity {
  active: boolean;
  id: number;
  type: string;
  routeIndex: number;
  progress: number;
  x: number; y: number;
  fsmState: string;
  fsmTimer: number;
  hp: number;
  maxHp: number;
  speed: number;
  speedMult: number;
  blockedBy: number;
  size: number;
  color: number;
  popProgress: number;
  isFlying: boolean;
}

interface ProjectileEntity {
  active: boolean;
  x: number; y: number;
  targetX: number; targetY: number;
  speed: number;
  damage: number;
  sourceId: number;
}

const [enemies, setEnemies] = createStore<EnemyEntity[]>(
  Array.from({ length: MAX_ENEMIES }, (): EnemyEntity => ({
    active: false, id: 0, type: "ant",
    routeIndex: 0, progress: 0,
    x: 0, y: 0,
    fsmState: "dead", fsmTimer: 0,
    hp: 1, maxHp: 1, speed: 0.07, speedMult: 1,
    blockedBy: -1,
    size: 3, color: 0x4a3a2a, popProgress: 0,
    isFlying: false,
  }))
);

const [projectiles, setProjectiles] = createStore<ProjectileEntity[]>(
  Array.from({ length: MAX_PROJECTILES }, (): ProjectileEntity => ({
    active: false, x: 0, y: 0,
    targetX: 0, targetY: 0,
    speed: 300, damage: 1, sourceId: -1,
  }))
);

// createIndex sets — initialized inside createRoot (need reactive context)
let walkingSet: ReadonlySet<number>;
let blockedSet: ReadonlySet<number>;
let slowedSet: ReadonlySet<number>;
let dyingSet: ReadonlySet<number>;

let nextEnemyId = 1;

// ══════════════════════════════════════════════════
// Worker Bees (hooks-managed, few entities)
// ══════════════════════════════════════════════════

interface WorkerBee {
  id: number;
  type: "guard" | "archer" | "slower" | "queen";
  row: number;
  col: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackTimer: number;
  attackInterval: number;
  range: number;
  damage: number;
}

const BEE_CONFIGS = {
  guard:  { cost: 10, hp: 15, attackInterval: 800,  range: 0, damage: 2, cell: GROUND },
  archer: { cost: 15, hp: 8,  attackInterval: 1200, range: 3, damage: 4, cell: HIGH },
  slower: { cost: 20, hp: 8,  attackInterval: 2000, range: 2, damage: 0, cell: HIGH },
  queen:  { cost: 25, hp: 10, attackInterval: 3000, range: 2, damage: 0, cell: HIGH },
};

const BEE_TEXTURES: Record<string, string> = {
  guard: "bee-guard",
  archer: "bee-archer",
  slower: "bee-slower",
  queen: "bee-queen",
};

// ══════════════════════════════════════════════════
// Wave Definitions
// ══════════════════════════════════════════════════

interface WaveSpawn {
  type: string;
  count: number;
  route: number; // 0=A, 1=B, 2=C
  interval: number; // ms between spawns
  delay: number; // ms delay before starting this group
}

interface WaveDef {
  spawns: WaveSpawn[];
}

const WAVES: WaveDef[] = [
  // Wave 1: A only, ants
  { spawns: [
    { type: "ant", count: 30, route: 0, interval: 200, delay: 0 },
  ]},
  // Wave 2: A,B, ants + hornets
  { spawns: [
    { type: "ant", count: 20, route: 0, interval: 200, delay: 0 },
    { type: "ant", count: 20, route: 1, interval: 200, delay: 500 },
    { type: "hornet", count: 3, route: 0, interval: 1500, delay: 3000 },
    { type: "hornet", count: 2, route: 1, interval: 1500, delay: 4000 },
  ]},
  // Wave 3: A,B,C, ants + hornets + moths
  { spawns: [
    { type: "ant", count: 20, route: 0, interval: 200, delay: 0 },
    { type: "ant", count: 20, route: 1, interval: 200, delay: 0 },
    { type: "ant", count: 20, route: 2, interval: 200, delay: 2000 },
    { type: "hornet", count: 5, route: 0, interval: 1200, delay: 3000 },
    { type: "hornet", count: 5, route: 1, interval: 1200, delay: 3500 },
    { type: "moth", count: 5, route: 2, interval: 800, delay: 5000 },
  ]},
  // Wave 4: all routes, heavy
  { spawns: [
    { type: "ant", count: 30, route: 0, interval: 180, delay: 0 },
    { type: "ant", count: 25, route: 1, interval: 180, delay: 0 },
    { type: "ant", count: 25, route: 2, interval: 180, delay: 1000 },
    { type: "hornet", count: 5, route: 0, interval: 1000, delay: 2000 },
    { type: "hornet", count: 5, route: 1, interval: 1000, delay: 2500 },
    { type: "hornet", count: 5, route: 2, interval: 1000, delay: 3000 },
    { type: "beetle", count: 1, route: 0, interval: 2000, delay: 6000 },
    { type: "beetle", count: 1, route: 1, interval: 2000, delay: 7000 },
    { type: "beetle", count: 1, route: 2, interval: 2000, delay: 8000 },
    { type: "moth", count: 5, route: 2, interval: 600, delay: 4000 },
  ]},
  // Wave 5 (Boss): all routes, everything
  { spawns: [
    { type: "ant", count: 30, route: 0, interval: 160, delay: 0 },
    { type: "ant", count: 25, route: 1, interval: 160, delay: 0 },
    { type: "ant", count: 25, route: 2, interval: 160, delay: 0 },
    { type: "hornet", count: 5, route: 0, interval: 800, delay: 2000 },
    { type: "hornet", count: 5, route: 1, interval: 800, delay: 2000 },
    { type: "hornet", count: 8, route: 2, interval: 800, delay: 2000 },
    { type: "beetle", count: 2, route: 0, interval: 3000, delay: 5000 },
    { type: "beetle", count: 2, route: 1, interval: 3000, delay: 6000 },
    { type: "moth", count: 5, route: 0, interval: 500, delay: 4000 },
    { type: "moth", count: 5, route: 1, interval: 500, delay: 4500 },
  ]},
];

// ══════════════════════════════════════════════════
// Route/Path Management
// ══════════════════════════════════════════════════

const ROUTE_SPAWNS: [number, number][] = [SPAWN_A, SPAWN_B, SPAWN_C];

// Cached paths per route (recalculated on bee placement)
let routePaths: ([number, number][] | null)[] = [null, null, null];
let routePathsFlying: ([number, number][] | null)[] = [null, null, null];

function recalcPaths(grid: CellType[][], guardPositions: Set<string>) {
  for (let r = 0; r < 3; r++) {
    routePaths[r] = bfs(grid, ROUTE_SPAWNS[r], NEST_CELLS, false, guardPositions);
    routePathsFlying[r] = bfs(grid, ROUTE_SPAWNS[r], NEST_CELLS, true, guardPositions);
  }
}

function getPath(routeIndex: number, isFlying: boolean): [number, number][] | null {
  return isFlying ? routePathsFlying[routeIndex] : routePaths[routeIndex];
}

function progressToXY(path: [number, number][], progress: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, progress));
  const totalSegs = path.length - 1;
  if (totalSegs <= 0) return { x: cellToX(path[0][0], path[0][1]), y: cellToY(path[0][0], path[0][1]) };

  const segFloat = t * totalSegs;
  const segIdx = Math.min(Math.floor(segFloat), totalSegs - 1);
  const segFrac = segFloat - segIdx;

  const [r0, c0] = path[segIdx];
  const [r1, c1] = path[segIdx + 1];
  const x0 = cellToX(r0, c0), y0 = cellToY(r0, c0);
  const x1 = cellToX(r1, c1), y1 = cellToY(r1, c1);
  return { x: x0 + (x1 - x0) * segFrac, y: y0 + (y1 - y0) * segFrac };
}

// ══════════════════════════════════════════════════
// Renderers
// ══════════════════════════════════════════════════

function MapRenderer(props: {
  grid: CellType[][];
  onCellClick: (row: number, col: number) => void;
  guardPositions: Set<string>;
}) {
  const cells: { row: number; col: number; type: CellType }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push({ row: r, col: c, type: props.grid[r][c] });
    }
  }

  const textureFor = (t: CellType, key: string) => {
    if (t === WALL) return "cell-wall";
    if (t === HIGH) return "cell-high";
    if (t === NEST) return "cell-nest";
    if (t === "A" || t === "B" || t === "C") return "cell-spawn";
    // Ground: check if occupied by guard
    if (props.guardPositions.has(key)) return "cell-high"; // visually occupied
    return "cell-ground";
  };

  return (
    <>
      {cells.map(({ row, col, type }) => {
        const x = cellToX(row, col);
        const y = cellToY(row, col);
        const key = `${row},${col}`;
        return (
          <sprite
            x={x} y={y}
            texture={textureFor(type, key)}
            origin={0.5}
            depth={1}
            scaleX={1} scaleY={1}
            onClick={() => props.onCellClick(row, col)}
          />
        );
      })}
    </>
  );
}

function EnemyRenderer() {
  return (
    <>
      {enemies.map((e, i) => {
        const vis = () => e.active && e.fsmState !== "dead";
        const sc = () => {
          if (e.fsmState === "spawn") return e.size * e.popProgress * 0.5;
          if (e.fsmState === "dying") return e.size * (1 - e.popProgress) * 0.5;
          return e.size * 0.5;
        };
        const al = () => {
          if (e.fsmState === "dying") return 1 - e.popProgress;
          return 1;
        };
        const tex = () => ENEMY_CONFIGS[e.type]?.texture ?? "ant";
        return (
          <Show when={vis()}>
            <sprite
              x={e.x} y={e.y}
              texture={tex()}
              origin={0.5}
              depth={10}
              scaleX={sc()} scaleY={sc()}
              alpha={al()}
            />
            {/* HP bar */}
            <Show when={e.fsmState !== "spawn" && e.fsmState !== "dying" && e.hp < e.maxHp}>
              <rectangle
                x={e.x - 10} y={e.y - e.size * 3 - 4}
                width={20} height={3}
                fillColor={0x333333}
                originX={0} originY={0.5}
                depth={15}
              />
              <rectangle
                x={e.x - 10} y={e.y - e.size * 3 - 4}
                width={20 * (e.hp / e.maxHp)} height={3}
                fillColor={e.hp / e.maxHp > 0.5 ? 0x44cc44 : 0xcc4444}
                originX={0} originY={0.5}
                depth={16}
              />
            </Show>
          </Show>
        );
      })}
    </>
  );
}

function ProjectileRenderer() {
  return (
    <>
      {projectiles.map((p) => (
        <sprite
          x={p.x} y={p.y}
          texture="needle"
          origin={0.5}
          depth={12}
          scaleX={2} scaleY={2}
          visible={p.active}
        />
      ))}
    </>
  );
}

function BeeRenderer(props: {
  bees: WorkerBee[];
  onBeeClick: (id: number) => void;
}) {
  return (
    <>
      {props.bees.map((bee) => (
        <sprite
          x={bee.x} y={bee.y}
          texture={BEE_TEXTURES[bee.type] ?? "bee-guard"}
          origin={0.5}
          depth={8}
          scaleX={4} scaleY={4}
          onClick={() => props.onBeeClick(bee.id)}
        />
      ))}
    </>
  );
}

function LarvaRenderer(props: {
  larvae: { hp: number; x: number; y: number }[];
}) {
  return (
    <>
      {props.larvae.map((l) => {
        const tex = () => l.hp >= 3 ? "larva" : l.hp > 0 ? "larva-scared" : "larva-crying";
        const wiggle = () => l.hp > 0 && l.hp < 3 ? Math.sin(performance.now() / 100) * 2 : 0;
        return (
          <sprite
            x={l.x + wiggle()} y={l.y}
            texture={tex()}
            origin={0.5}
            depth={6}
            scaleX={4} scaleY={4}
          />
        );
      })}
    </>
  );
}

// ══════════════════════════════════════════════════
// TextureGen — generates pixel art textures on scene ready
// ══════════════════════════════════════════════════

let texturesGenerated = false;

function TextureGen() {
  const scene = useScene();
  if (!texturesGenerated) {
    generateAllTextures(scene);
    texturesGenerated = true;
  }
  return null;
}

// ══════════════════════════════════════════════════
// App
// ══════════════════════════════════════════════════

function App() {
  // ── Game State ──
  type Phase = "title" | "prep" | "wave" | "interval" | "victory" | "defeat";
  const [phase, setPhase] = createSignal<Phase>("title");
  const [honey, setHoney] = createSignal(30);
  const [currentWave, setCurrentWave] = createSignal(0);
  const [selectedBeeType, setSelectedBeeType] = createSignal<string | null>(null);
  const [selectedBeeId, setSelectedBeeId] = createSignal<number | null>(null);

  // Larvae
  const [larvaHP, setLarvaHP] = createStore([3, 3, 3]);
  const totalHP = createMemo(() => larvaHP[0] + larvaHP[1] + larvaHP[2]);

  // Worker bees (hooks-managed)
  const [bees, setBees] = createSignal<WorkerBee[]>([]);
  let nextBeeId = 1;

  // Guard positions for BFS
  const guardPositions = createMemo(() => {
    const s = new Set<string>();
    for (const b of bees()) {
      if (b.type === "guard") s.add(`${b.row},${b.col}`);
    }
    return s;
  });

  // Grid (mutable copy for placement tracking)
  const grid: CellType[][] = MAP_DATA.map(row => [...row]);

  // Wave spawn state
  let spawnTimers: { elapsed: number; spawned: number; def: WaveSpawn }[] = [];
  let honeyAccum = 0;
  let intervalTimer = 0;

  // ── Path recalculation ──
  function refreshPaths() {
    recalcPaths(grid, guardPositions());
  }

  // ── Bee Placement ──
  function placeBee(row: number, col: number) {
    const beeType = selectedBeeType();
    if (!beeType) return;

    const config = BEE_CONFIGS[beeType as keyof typeof BEE_CONFIGS];
    if (!config) return;
    if (honey() < config.cost) return;

    const cell = grid[row][col];

    // Validate placement
    if (beeType === "guard") {
      if (cell !== GROUND) return;
      // Check if placing here blocks all paths
      const testGuards = new Set(guardPositions());
      testGuards.add(`${row},${col}`);
      const canPass = ROUTE_SPAWNS.every((spawn) =>
        bfs(grid, spawn, NEST_CELLS, false, testGuards) !== null
      );
      if (!canPass) return; // Would block all paths
    } else {
      if (cell !== HIGH) return;
    }

    // Check not already occupied
    if (bees().some(b => b.row === row && b.col === col)) return;

    const bee: WorkerBee = {
      id: nextBeeId++,
      type: beeType as WorkerBee["type"],
      row, col,
      x: cellToX(row, col),
      y: cellToY(row, col),
      hp: config.hp,
      maxHp: config.hp,
      attackTimer: 0,
      attackInterval: config.attackInterval,
      range: config.range,
      damage: config.damage,
    };

    setBees(prev => [...prev, bee]);
    setHoney(h => h - config.cost);
    setSelectedBeeType(null);
    refreshPaths();
  }

  function removeBee(id: number) {
    const bee = bees().find(b => b.id === id);
    if (!bee) return;
    const config = BEE_CONFIGS[bee.type];
    setHoney(h => h + Math.floor(config.cost * 0.6));
    setBees(prev => prev.filter(b => b.id !== id));
    setSelectedBeeId(null);
    refreshPaths();
  }

  // ── Cell Click Handler ──
  function onCellClick(row: number, col: number) {
    const p = phase();
    if (p !== "prep" && p !== "wave" && p !== "interval") return;

    if (selectedBeeType()) {
      placeBee(row, col);
    }
  }

  function onBeeClick(id: number) {
    setSelectedBeeId(prev => prev === id ? null : id);
    setSelectedBeeType(null);
  }

  // ── Enemy Spawning ──
  function spawnEnemy(type: string, routeIndex: number) {
    const slot = enemies.findIndex(e => !e.active);
    if (slot < 0) return;

    const config = ENEMY_CONFIGS[type];
    if (!config) return;

    const isFlying = type === "moth";
    const path = getPath(routeIndex, isFlying);
    if (!path) return;

    const start = path[0];
    const sx = cellToX(start[0], start[1]);
    const sy = cellToY(start[0], start[1]);

    setEnemies(slot, {
      active: true,
      id: nextEnemyId++,
      type,
      routeIndex,
      progress: 0,
      x: sx, y: sy,
      fsmState: "spawn",
      fsmTimer: 0,
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed,
      speedMult: 1,
      blockedBy: -1,
      size: config.size,
      color: config.color,
      popProgress: 0,
      isFlying,
    });
  }

  // ── Fire Projectile ──
  function fireProjectile(fromX: number, fromY: number, toX: number, toY: number, damage: number, sourceId: number) {
    const slot = projectiles.findIndex(p => !p.active);
    if (slot < 0) return;
    setProjectiles(slot, {
      active: true,
      x: fromX, y: fromY,
      targetX: toX, targetY: toY,
      speed: 300,
      damage,
      sourceId,
    });
  }

  // ── Start Wave ──
  function startWave() {
    const waveIdx = currentWave();
    if (waveIdx >= WAVES.length) return;

    const wave = WAVES[waveIdx];
    spawnTimers = wave.spawns.map(def => ({ elapsed: 0, spawned: 0, def }));
    setPhase("wave");
  }

  // ── Distance helper (cell units) ──
  function cellDist(r1: number, c1: number, r2: number, c2: number): number {
    const x1 = cellToX(r1, c1), y1 = cellToY(r1, c1);
    const x2 = cellToX(r2, c2), y2 = cellToY(r2, c2);
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / CELL;
  }

  // ══════════════════════════════════════════════════
  // System Update Functions
  // ══════════════════════════════════════════════════

  // ── PRE PHASE ──

  // System 1: UnblockSystem — release blocked enemies whose guard died
  const unblockUpdate = () => {
    const beeIds = new Set(bees().map(b => b.id));
    for (const i of blockedSet) {
      const e = enemies[i];
      if (e.blockedBy >= 0 && !beeIds.has(e.blockedBy)) {
        setEnemies(i, { fsmState: "walking", blockedBy: -1, speedMult: 1 });
      }
    }
  };

  // System 2: SlowFieldSystem — check slower bee ranges
  const slowFieldUpdate = () => {
    const slowerBees = bees().filter(b => b.type === "slower");

    // Reset speed for walking enemies first
    for (const i of walkingSet) {
      if (enemies[i].speedMult < 1) {
        setEnemies(i, "speedMult", 1);
      }
    }

    if (slowerBees.length === 0) {
      // Also clear slowed enemies back to walking
      for (const i of slowedSet) {
        setEnemies(i, { fsmState: "walking", speedMult: 1 });
      }
      return;
    }

    // Check walking enemies: are they in range of a slower?
    for (const i of walkingSet) {
      const e = enemies[i];
      for (const sb of slowerBees) {
        const dx = e.x - sb.x, dy = e.y - sb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
        if (dist <= sb.range) {
          setEnemies(i, { fsmState: "slowed", speedMult: 0.4 });
          break;
        }
      }
    }

    // Check slowed enemies: are they still in range?
    for (const i of slowedSet) {
      const e = enemies[i];
      let inRange = false;
      for (const sb of slowerBees) {
        const dx = e.x - sb.x, dy = e.y - sb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
        if (dist <= sb.range) { inRange = true; break; }
      }
      if (!inRange) {
        setEnemies(i, { fsmState: "walking", speedMult: 1 });
      }
    }
  };

  // ── MAIN PHASE ──

  // System 3: EnemyMoveSystem
  const enemyMoveUpdate = (_t: number, delta: number) => {
    const dt = delta / 1000;

    // Move walking enemies
    for (const i of walkingSet) {
      const e = enemies[i];
      const path = getPath(e.routeIndex, e.isFlying);
      if (!path) continue;
      const newProgress = e.progress + e.speed * e.speedMult * dt;
      const pos = progressToXY(path, newProgress);
      setEnemies(i, { progress: newProgress, x: pos.x, y: pos.y });
    }

    // Move slowed enemies
    for (const i of slowedSet) {
      const e = enemies[i];
      const path = getPath(e.routeIndex, e.isFlying);
      if (!path) continue;
      const newProgress = e.progress + e.speed * e.speedMult * dt;
      const pos = progressToXY(path, newProgress);
      setEnemies(i, { progress: newProgress, x: pos.x, y: pos.y });
    }
  };

  // System 4: EnemySpawnSystem (wave timer)
  const enemySpawnUpdate = (_t: number, delta: number) => {
    if (phase() !== "wave") return;

    let allDone = true;
    for (const st of spawnTimers) {
      if (st.spawned >= st.def.count) continue;
      allDone = false;
      st.elapsed += delta;
      const readyTime = st.def.delay + st.spawned * st.def.interval;
      while (st.elapsed >= readyTime && st.spawned < st.def.count) {
        spawnEnemy(st.def.type, st.def.route);
        st.spawned++;
        if (st.spawned < st.def.count) {
          // next readyTime
          break; // One per frame per group for visual stagger
        }
      }
    }

    // Check if wave is complete (all spawned and all enemies dead)
    if (allDone) {
      const anyAlive = enemies.some(e => e.active && e.fsmState !== "dead");
      if (!anyAlive) {
        const nextWave = currentWave() + 1;
        if (nextWave >= WAVES.length) {
          setPhase("victory");
        } else {
          setCurrentWave(nextWave);
          setPhase("interval");
          intervalTimer = 5000;
        }
      }
    }
  };

  // System 5: ProjectileMoveSystem
  const projectileMoveUpdate = (_t: number, delta: number) => {
    const dt = delta / 1000;
    batch(() => {
      for (let i = 0; i < MAX_PROJECTILES; i++) {
        const p = projectiles[i];
        if (!p.active) continue;
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5) {
          setProjectiles(i, "active", false);
          continue;
        }
        const move = p.speed * dt;
        const nx = p.x + (dx / dist) * move;
        const ny = p.y + (dy / dist) * move;
        setProjectiles(i, { x: nx, y: ny });
      }
    });
  };

  // System 6: SpawnAnimSystem
  const spawnAnimUpdate = (_t: number, delta: number) => {
    batch(() => {
      for (let i = 0; i < MAX_ENEMIES; i++) {
        const e = enemies[i];
        if (!e.active || e.fsmState !== "spawn") continue;
        const newPop = e.popProgress + delta / 300;
        if (newPop >= 1) {
          setEnemies(i, { fsmState: "walking", popProgress: 1 });
        } else {
          setEnemies(i, "popProgress", newPop);
        }
      }
    });
  };

  // System 7: DyingAnimSystem
  const dyingAnimUpdate = (_t: number, delta: number) => {
    for (const i of dyingSet) {
      const e = enemies[i];
      const newPop = e.popProgress + delta / 400;
      if (newPop >= 1) {
        setEnemies(i, { active: false, fsmState: "dead", popProgress: 0 });
      } else {
        setEnemies(i, "popProgress", newPop);
      }
    }
  };

  // ── POST PHASE ──

  // System 8: BlockCheckSystem — guard bees block walking enemies
  const blockCheckUpdate = () => {
    const guards = bees().filter(b => b.type === "guard");
    if (guards.length === 0) return;

    for (const i of walkingSet) {
      const e = enemies[i];
      if (e.isFlying) continue; // Moths fly over
      for (const g of guards) {
        const dx = e.x - g.x, dy = e.y - g.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CELL * 0.6) {
          // Check if guard isn't already blocking max enemies
          const blockedByThis = enemies.filter(
            en => en.active && en.fsmState === "blocked" && en.blockedBy === g.id
          ).length;
          if (blockedByThis < 2) {
            setEnemies(i, { fsmState: "blocked", blockedBy: g.id, speedMult: 0 });
            break;
          }
        }
      }
    }
  };

  // System 9: ProjectileHitSystem
  const projectileHitUpdate = () => {
    batch(() => {
      for (let pi = 0; pi < MAX_PROJECTILES; pi++) {
        const p = projectiles[pi];
        if (!p.active) continue;

        for (let ei = 0; ei < MAX_ENEMIES; ei++) {
          const e = enemies[ei];
          if (!e.active || e.fsmState === "dying" || e.fsmState === "dead" || e.fsmState === "spawn") continue;

          const dx = p.x - e.x, dy = p.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 12) {
            // Hit!
            setProjectiles(pi, "active", false);
            const newHp = e.hp - p.damage;
            if (newHp <= 0) {
              setEnemies(ei, { fsmState: "dying", popProgress: 0, hp: 0 });
              setHoney(h => h + (ENEMY_CONFIGS[e.type]?.reward ?? 1));
            } else {
              setEnemies(ei, "hp", newHp);
            }
            break;
          }
        }
      }
    });
  };

  // System 10: GoalCheckSystem
  const goalCheckUpdate = () => {
    for (const i of walkingSet) {
      const e = enemies[i];
      if (e.progress >= 1.0) {
        setEnemies(i, { active: false, fsmState: "dead" });
        // Damage a larva
        for (let l = 0; l < 3; l++) {
          if (larvaHP[l] > 0) {
            setLarvaHP(l, larvaHP[l] - 1);
            break;
          }
        }
      }
    }
    // Also check slowed enemies reaching goal
    for (const i of slowedSet) {
      const e = enemies[i];
      if (e.progress >= 1.0) {
        setEnemies(i, { active: false, fsmState: "dead" });
        for (let l = 0; l < 3; l++) {
          if (larvaHP[l] > 0) {
            setLarvaHP(l, larvaHP[l] - 1);
            break;
          }
        }
      }
    }
  };

  // ══════════════════════════════════════════════════
  // Worker Bee Attack Logic (in GameLoop, hooks-style)
  // ══════════════════════════════════════════════════

  const beeAttackUpdate = (_t: number, delta: number) => {
    const p = phase();
    if (p !== "wave") return;

    const currentBees = bees();
    const updatedBees: WorkerBee[] = [];
    let changed = false;

    for (const bee of currentBees) {
      let newTimer = bee.attackTimer + delta;

      if (newTimer >= bee.attackInterval) {
        newTimer = 0;

        if (bee.type === "guard") {
          // Guard: damage blocked enemies
          for (let i = 0; i < MAX_ENEMIES; i++) {
            const e = enemies[i];
            if (e.active && e.fsmState === "blocked" && e.blockedBy === bee.id) {
              const newHp = e.hp - bee.damage;
              if (newHp <= 0) {
                setEnemies(i, { fsmState: "dying", popProgress: 0, hp: 0 });
                setHoney(h => h + (ENEMY_CONFIGS[e.type]?.reward ?? 1));
              } else {
                setEnemies(i, "hp", newHp);
              }
            }
          }
        } else if (bee.type === "archer") {
          // Archer: shoot at nearest enemy in range
          let nearestDist = Infinity, nearestIdx = -1;
          for (let i = 0; i < MAX_ENEMIES; i++) {
            const e = enemies[i];
            if (!e.active || e.fsmState === "dying" || e.fsmState === "dead" || e.fsmState === "spawn") continue;
            const dx = e.x - bee.x, dy = e.y - bee.y;
            const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
            if (dist <= bee.range && dist < nearestDist) {
              nearestDist = dist; nearestIdx = i;
            }
          }
          if (nearestIdx >= 0) {
            fireProjectile(bee.x, bee.y, enemies[nearestIdx].x, enemies[nearestIdx].y, bee.damage, bee.id);
          }
        } else if (bee.type === "queen") {
          // Queen: heal nearby bees
          const updBees = bees();
          const healed = updBees.map(b => {
            if (b.id === bee.id) return b;
            const dx = b.x - bee.x, dy = b.y - bee.y;
            const dist = Math.sqrt(dx * dx + dy * dy) / CELL;
            if (dist <= bee.range && b.hp < b.maxHp) {
              return { ...b, hp: Math.min(b.maxHp, b.hp + 2) };
            }
            return b;
          });
          setBees(healed);
        }
        // Slower bee effect is handled in SlowFieldSystem

        changed = true;
      }

      updatedBees.push({ ...bee, attackTimer: newTimer });
    }

    if (changed || currentBees.some((b, i) => b.attackTimer !== updatedBees[i].attackTimer)) {
      setBees(updatedBees);
    }
  };

  // ── Honey auto-income & interval timer ──
  const economyUpdate = (_t: number, delta: number) => {
    const p = phase();
    if (p === "wave" || p === "interval") {
      honeyAccum += delta;
      if (honeyAccum >= 1000) {
        honeyAccum -= 1000;
        setHoney(h => h + 1);
      }
    }

    if (p === "interval") {
      intervalTimer -= delta;
      if (intervalTimer <= 0) {
        startWave();
      }
    }

    // Check defeat
    if (totalHP() <= 0 && p === "wave") {
      setPhase("defeat");
    }

    // Debug state for E2E tests
    const activeEnemies = enemies.filter(e => e.active && e.fsmState !== "dead");
    debug.expose({
      phase: phase(),
      wave: currentWave(),
      honey: honey(),
      larvaHP: [larvaHP[0], larvaHP[1], larvaHP[2]],
      totalHP: totalHP(),
      beeCount: bees().length,
      enemyCount: activeEnemies.length,
      walkingCount: walkingSet.size,
      blockedCount: blockedSet.size,
      slowedCount: slowedSet.size,
      dyingCount: dyingSet.size,
      projectileCount: projectiles.filter(p => p.active).length,
      selectedBeeType: selectedBeeType(),
      selectedBeeId: selectedBeeId(),
      beePositions: bees().map(b => ({ id: b.id, type: b.type, row: b.row, col: b.col, x: b.x, y: b.y })),
    });
  };

  // ── Guard damage from blocked enemies ──
  const guardDamageUpdate = (_t: number, delta: number) => {
    if (phase() !== "wave") return;

    // Blocked enemies damage their blocking guard
    let guardsChanged = false;
    const updatedBees = bees().map(bee => {
      if (bee.type !== "guard") return bee;

      let dmgAccum = 0;
      for (const i of blockedSet) {
        const e = enemies[i];
        if (e.blockedBy === bee.id) {
          dmgAccum += 0.5 * delta / 1000; // 0.5 dps per blocked enemy
        }
      }

      if (dmgAccum > 0) {
        guardsChanged = true;
        const newHp = bee.hp - dmgAccum;
        if (newHp <= 0) {
          // Guard dies — unblock handled by UnblockSystem next frame
          return null;
        }
        return { ...bee, hp: newHp };
      }
      return bee;
    }).filter((b): b is WorkerBee => b !== null);

    if (guardsChanged) {
      setBees(updatedBees);
      refreshPaths();
    }
  };

  // ── Pointer handler ──
  const handlePointerDown = (ptr: Phaser.Input.Pointer) => {
    if (phase() === "title") {
      setPhase("prep");
      refreshPaths();
      return;
    }
  };

  // ── UI button position helpers ──
  const barY = H - 30;
  const beeTypes = ["guard", "archer", "slower", "queen"] as const;
  const beeLabels = ["Guard", "Archer", "Honey", "Queen"];
  const beeCosts = [10, 15, 20, 25];

  const isPrep = () => phase() === "prep";
  const isWave = () => phase() === "wave";
  const isInterval = () => phase() === "interval";
  const isPlaying = () => isPrep() || isWave() || isInterval();

  const selBee = () => {
    const id = selectedBeeId();
    if (id === null) return null;
    return bees().find(b => b.id === id) ?? null;
  };

  // Larvae positions (spread across nest cells)
  const larvaeData = createMemo(() => {
    const cx = (cellToX(5, 5) + cellToX(5, 6)) / 2;
    const cy = cellToY(5, 5);
    const positions = [
      { x: cx - 20, y: cy - 4 },
      { x: cx,      y: cy + 6 },
      { x: cx + 20, y: cy - 4 },
    ];
    return positions.map((pos, i) => ({
      hp: larvaHP[i],
      x: pos.x,
      y: pos.y,
    }));
  });

  return (
    <Game width={W} height={H} backgroundColor={0x2a1a08} parent="game-container"
      onPointerDown={handlePointerDown}
    >
      {/* Texture generation on scene ready */}
      <TextureGen />

      {/* ── RECS Systems (3 phases) ── */}

      {/* PRE: React to previous frame changes */}
      <System phase="pre" update={unblockUpdate} when={isWave} />
      <System phase="pre" update={slowFieldUpdate} when={isWave} />

      {/* MAIN: Physics & timers */}
      <System update={enemyMoveUpdate} when={isWave} />
      <System update={enemySpawnUpdate} />
      <System update={projectileMoveUpdate} when={isWave} />
      <System update={spawnAnimUpdate} when={isWave} />
      <System update={dyingAnimUpdate} when={isWave} />
      <System update={beeAttackUpdate} />
      <System update={economyUpdate} />
      <System update={guardDamageUpdate} />

      {/* POST: React to physics results */}
      <System phase="post" update={blockCheckUpdate} when={isWave} />
      <System phase="post" update={projectileHitUpdate} when={isWave} />
      <System phase="post" update={goalCheckUpdate} when={isWave} />

      {/* ── Title Screen ── */}
      <Show when={phase() === "title"}>
        <rectangle x={W / 2} y={H / 2} width={W} height={H}
          fillColor={0x2a1a08} origin={0.5} depth={100} />
        <text x={W / 2} y={H / 2 - 60} text="Honeycomb Rush"
          fontSize={32} fontFamily="Georgia, serif" color="#ffcc44" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 - 20} text="- Hanikamu Rush -"
          fontSize={14} fontFamily="monospace" color="#cc8833" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 + 30} text="Tap to Start"
          fontSize={16} fontFamily="monospace" color="#aa7722" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 + 70} text="Protect the larvae from invading bugs!"
          fontSize={11} fontFamily="monospace" color="#886633" origin={0.5} depth={101} />
      </Show>

      {/* ── Game World ── */}
      <Show when={isPlaying()}>
        {/* Map */}
        <MapRenderer grid={grid} onCellClick={onCellClick} guardPositions={guardPositions()} />

        {/* Entities */}
        <EnemyRenderer />
        <ProjectileRenderer />
        <BeeRenderer bees={bees()} onBeeClick={onBeeClick} />
        <LarvaRenderer larvae={larvaeData()} />

        {/* ── HUD ── */}
        <rectangle x={W / 2} y={14} width={W} height={28}
          fillColor={0x1a0a00} origin={0.5} depth={20} alpha={0.8} />

        {/* Wave indicator */}
        <text x={20} y={14} text={`Wave ${currentWave() + 1}/${WAVES.length}`}
          fontSize={13} fontFamily="monospace" color="#ccaa44" originX={0} originY={0.5} depth={21} />

        {/* Honey */}
        <text x={W / 2 - 30} y={14} text={`Honey: ${honey()}`}
          fontSize={13} fontFamily="monospace" color="#ffcc00" origin={0.5} depth={21} />

        {/* Hearts (larva HP) */}
        {[0, 1, 2].map(i => (
          <text x={W - 80 + i * 24} y={14}
            text={larvaHP[i] >= 3 ? "♥" : larvaHP[i] >= 2 ? "♥" : larvaHP[i] >= 1 ? "♡" : "✗"}
            fontSize={16} fontFamily="monospace"
            color={larvaHP[i] >= 3 ? "#ff4444" : larvaHP[i] >= 1 ? "#ff8888" : "#666666"}
            origin={0.5} depth={21}
          />
        ))}

        {/* Phase indicator — single element, content driven by phase */}
        <rectangle x={W / 2} y={H / 2 - 40} width={200} height={36}
          fillColor={0x446622} origin={0.5} depth={25}
          alpha={isPrep() ? 0.9 : 0}
          onClick={() => { if (isPrep()) startWave(); }} />
        <text x={W / 2} y={H / 2 - 40}
          text={isPrep() ? "Start Wave!" : isInterval() ? `Next wave in ${Math.ceil(intervalTimer / 1000)}s` : ""}
          fontSize={isPrep() ? 16 : 14} fontFamily="monospace"
          color={isPrep() ? "#88cc44" : "#ccaa44"}
          origin={0.5} depth={26} />

        {/* ── Bee Selection Bar ── */}
        <rectangle x={W / 2} y={barY} width={W} height={48}
          fillColor={0x1a0a00} origin={0.5} depth={20} alpha={0.85} />

        {beeTypes.map((type, idx) => {
          const cost = beeCosts[idx];
          const canAfford = () => honey() >= cost;
          const isSelected = () => selectedBeeType() === type;
          return (
            <>
              <rectangle
                x={80 + idx * 120} y={barY}
                width={100} height={36}
                fillColor={isSelected() ? 0x886622 : canAfford() ? 0x443311 : 0x221100}
                origin={0.5} depth={21}
                onClick={() => {
                  if (canAfford()) {
                    setSelectedBeeType(prev => prev === type ? null : type);
                    setSelectedBeeId(null);
                  }
                }}
              />
              <text
                x={80 + idx * 120} y={barY - 6}
                text={beeLabels[idx]}
                fontSize={10} fontFamily="monospace"
                color={canAfford() ? "#ffcc88" : "#665533"}
                origin={0.5} depth={22}
              />
              <text
                x={80 + idx * 120} y={barY + 8}
                text={`${cost} honey`}
                fontSize={8} fontFamily="monospace"
                color={canAfford() ? "#cc9944" : "#554422"}
                origin={0.5} depth={22}
              />
            </>
          );
        })}

        {/* ── Selected Bee Info Panel (alpha-driven visibility) ── */}
        {(() => {
          const vis = () => selBee() !== null;
          const a = () => vis() ? 1 : 0;
          return (
            <>
              <rectangle x={W - 80} y={H / 2} width={140} height={120}
                fillColor={0x1a0a00} origin={0.5} depth={30} alpha={vis() ? 0.9 : 0} />
              <text x={W - 80} y={H / 2 - 40}
                text={selBee()?.type?.toUpperCase() ?? ""}
                fontSize={12} fontFamily="monospace" color="#ffcc88" origin={0.5} depth={31} alpha={a()} />
              <text x={W - 80} y={H / 2 - 20}
                text={`HP: ${Math.ceil(selBee()?.hp ?? 0)}/${selBee()?.maxHp ?? 0}`}
                fontSize={10} fontFamily="monospace" color="#cc9944" origin={0.5} depth={31} alpha={a()} />
              <rectangle x={W - 80} y={H / 2 + 10} width={80} height={22}
                fillColor={0x884422} origin={0.5} depth={31} alpha={a()}
                onClick={() => { if (vis()) removeBee(selectedBeeId()!); }} />
              <text x={W - 80} y={H / 2 + 10} text="Retreat"
                fontSize={10} fontFamily="monospace" color="#ffaaaa" origin={0.5} depth={32} alpha={a()} />
              <rectangle x={W - 80} y={H / 2 + 38} width={80} height={22}
                fillColor={0x333322} origin={0.5} depth={31} alpha={a()}
                onClick={() => { if (vis()) setSelectedBeeId(null); }} />
              <text x={W - 80} y={H / 2 + 38} text="Close"
                fontSize={10} fontFamily="monospace" color="#aaaaaa" origin={0.5} depth={32} alpha={a()} />
            </>
          );
        })()}
      </Show>

      {/* ── Victory Screen ── */}
      <Show when={phase() === "victory"}>
        <rectangle x={W / 2} y={H / 2} width={W} height={H}
          fillColor={0x2a3a08} origin={0.5} depth={100} alpha={0.9} />
        <text x={W / 2} y={H / 2 - 30} text="Victory!"
          fontSize={36} fontFamily="Georgia, serif" color="#88ff44" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 + 20} text="The larvae are safe and hanakamu!"
          fontSize={14} fontFamily="monospace" color="#66cc22" origin={0.5} depth={101} />
      </Show>

      {/* ── Defeat Screen ── */}
      <Show when={phase() === "defeat"}>
        <rectangle x={W / 2} y={H / 2} width={W} height={H}
          fillColor={0x3a0808} origin={0.5} depth={100} alpha={0.9} />
        <text x={W / 2} y={H / 2 - 30} text="Defeat..."
          fontSize={36} fontFamily="Georgia, serif" color="#ff4444" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 + 20} text="All larvae are crying..."
          fontSize={14} fontFamily="monospace" color="#cc4422" origin={0.5} depth={101} />
      </Show>
    </Game>
  );
}

// ── Mount ──
createRoot(() => {
  // Initialize createIndex sets within reactive root
  walkingSet = createIndex(
    () => enemies.length,
    (i) => enemies[i].active && enemies[i].fsmState === "walking",
  );
  blockedSet = createIndex(
    () => enemies.length,
    (i) => enemies[i].active && enemies[i].fsmState === "blocked",
  );
  slowedSet = createIndex(
    () => enemies.length,
    (i) => enemies[i].active && enemies[i].fsmState === "slowed",
  );
  dyingSet = createIndex(
    () => enemies.length,
    (i) => enemies[i].active && enemies[i].fsmState === "dying",
  );

  const el = App();
  if (el instanceof HTMLElement) document.getElementById("game-container")?.appendChild(el);
});
