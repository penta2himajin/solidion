/**
 * Solidion Example: Null Pow!
 *
 * A Pac-Man-style maze game where a pointer (*ptr) collects data values
 * while avoiding four null references: NULL, nil, None, undefined.
 *
 * Demonstrates:
 *  - useStateMachine pattern: chase/scatter/frightened modes for 4 enemies
 *  - Tile-based maze with grid-snapped movement
 *  - Distinct character designs using rectangle/circle composites
 *  - Reactive dot collection (createSignal per tile)
 *  - Power-up state transitions (try-catch blocks)
 *
 * "ぬるぽ" → "ガッ!" / "Null" → "Pow!"
 */

import Phaser from "phaser";
import { createRoot, createSignal, createMemo, batch } from "solid-js";

import { createElement, insert, setProp, effect } from "solidion/renderer";
import { getMeta } from "solidion/core/meta";
import { pushScene } from "solidion/core/scene-stack";
import { createFrameManager } from "solidion/core/frame";
import { solidionFrameUpdate } from "solidion/core/sync";

// ============================================================
// Constants
// ============================================================

const TILE = 24;
// Maze: W=wall, .=dot, o=power, P=player start, G=ghost home, -=empty(ghost door), T=tunnel
const MAZE_STR = [
  "WWWWWWWWWWWWWWWWWWWWW",
  "W.........W.........W",
  "W.WWW.WWW.W.WWW.WWW.W",
  "WoW W.W W.W.W W.W WoW",
  "W.WWW.WWW.W.WWW.WWW.W",
  "W...................W",
  "W.WWW.W.WWWWW.W.WWW.W",
  "W.....W...W...W.....W",
  "WWWWW.WWW W WWW.WWWWW",
  "    W.W       W.W    ",
  "WWWWW.W WW-WW W.WWWWW",
  "T    .  WGGGW  .    T",
  "WWWWW.W WWWWW W.WWWWW",
  "    W.W       W.W    ",
  "WWWWW.W WWWWW W.WWWWW",
  "W.........W.........W",
  "W.WWW.WWW.W.WWW.WWW.W",
  "Wo..W.....P.....W..oW",
  "WWW.W.W.WWWWW.W.W.WWW",
  "W.....W...W...W.....W",
  "W.WWWWWWW.W.WWWWWWW.W",
  "W...................W",
  "WWWWWWWWWWWWWWWWWWWWW",
];

const ROWS = MAZE_STR.length;
const COLS = MAZE_STR[0].length;
const W = COLS * TILE;
const H = ROWS * TILE + 50; // extra for HUD
const HUD_H = 50;

const PLAYER_SPEED = 3.0;   // tiles per second
const GHOST_SPEED = 2.6;
const GHOST_FRIGHT_SPEED = 1.5;
const FRIGHT_DURATION = 7000; // ms

// Directions: 0=right, 1=down, 2=left, 3=up
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

// Colors
const COL_WALL = 0x2244aa;
const COL_DOT = 0x888888;
const COL_POWER = 0xffcc00;
const COL_BG = 0x000000;
const COL_PTR = 0x00ddaa;
const COL_FRIGHT = 0x2222cc;

// Ghost personalities
const GHOSTS = [
  { name: "NULL",      color: 0xcc3333, scatterTarget: [COLS - 2, 0] },
  { name: "nil",       color: 0xff66aa, scatterTarget: [1, 0] },
  { name: "None",      color: 0x4488ff, scatterTarget: [COLS - 2, ROWS - 1] },
  { name: "undefined", color: 0xffcc33, scatterTarget: [1, ROWS - 1] },
];

// ============================================================
// Maze helpers
// ============================================================

function parseMaze() {
  const walls: boolean[][] = [];
  const dots: number[][] = []; // 0=none, 1=dot, 2=power
  let playerStart = [10, 17];
  const ghostHome: [number, number][] = [];

  for (let r = 0; r < ROWS; r++) {
    walls[r] = [];
    dots[r] = [];
    for (let c = 0; c < COLS; c++) {
      const ch = MAZE_STR[r][c] ?? " ";
      walls[r][c] = ch === "W";
      if (ch === ".") dots[r][c] = 1;
      else if (ch === "o") dots[r][c] = 2;
      else dots[r][c] = 0;
      if (ch === "P") playerStart = [c, r];
      if (ch === "G") ghostHome.push([c, r]);
    }
  }
  return { walls, dots, playerStart, ghostHome };
}

function canMove(walls: boolean[][], c: number, r: number): boolean {
  // Tunnel wrapping
  if (c < 0 || c >= COLS) return true;
  if (r < 0 || r >= ROWS) return false;
  return !walls[r][c];
}

function wrapC(c: number): number {
  if (c < 0) return COLS - 1;
  if (c >= COLS) return 0;
  return c;
}

function tileToPixel(c: number, r: number): [number, number] {
  return [c * TILE + TILE / 2, r * TILE + TILE / 2 + HUD_H];
}

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}

// ============================================================
// Helpers
// ============================================================

function rect(
  root: any, x: number, y: number, w: number, h: number,
  color: number, depth: number
) {
  const r = createElement("rectangle");
  setProp(r, "x", x); setProp(r, "y", y);
  setProp(r, "width", w); setProp(r, "height", h);
  setProp(r, "fillColor", color);
  setProp(r, "origin", 0.5); setProp(r, "depth", depth);
  insert(root, r);
  return r;
}

function circ(
  root: any, x: number, y: number, d: number,
  color: number, depth: number
) {
  const c = createElement("ellipse");
  setProp(c, "x", x); setProp(c, "y", y);
  setProp(c, "width", d); setProp(c, "height", d);
  setProp(c, "fillColor", color); setProp(c, "origin", 0.5);
  setProp(c, "depth", depth);
  insert(root, c);
  return c;
}

function label(
  root: any, x: number, y: number,
  text: string, size: number, color: string, depth: number
) {
  const t = createElement("text");
  setProp(t, "x", x); setProp(t, "y", y);
  setProp(t, "text", text); setProp(t, "fontSize", size);
  setProp(t, "fontFamily", "monospace"); setProp(t, "color", color);
  setProp(t, "origin", 0.5); setProp(t, "depth", depth);
  insert(root, t);
  return t;
}

// ============================================================
// Character builders (composite shapes)
// ============================================================

function createPtrVisual(root: any) {
  // Arrow cursor shape — chevron pointing right by default
  const body = rect(root, 0, 0, 14, 14, COL_PTR, 6);
  const tip = rect(root, 0, 0, 6, 6, 0xffffff, 7);    // bright tip
  const tail = rect(root, 0, 0, 4, 10, 0x008866, 6);   // darker tail
  return { body, tip, tail };
}

function positionPtr(parts: ReturnType<typeof createPtrVisual>, px: number, py: number, dir: number) {
  setProp(parts.body, "x", px); setProp(parts.body, "y", py);
  setProp(parts.body, "angle", dir * 90);
  // Tip in movement direction
  setProp(parts.tip, "x", px + DX[dir] * 5); setProp(parts.tip, "y", py + DY[dir] * 5);
  // Tail opposite
  setProp(parts.tail, "x", px - DX[dir] * 6); setProp(parts.tail, "y", py - DY[dir] * 6);
  setProp(parts.tail, "angle", dir * 90);
}

// NULL (C) — large blocky, intimidating
function createNullVisual(root: any) {
  const body = rect(root, 0, 0, 18, 18, GHOSTS[0].color, 5);
  const eyeL = rect(root, 0, 0, 5, 5, 0xffffff, 6);
  const eyeR = rect(root, 0, 0, 5, 5, 0xffffff, 6);
  const pupilL = rect(root, 0, 0, 3, 3, 0x000000, 7);
  const pupilR = rect(root, 0, 0, 3, 3, 0x000000, 7);
  const brow = rect(root, 0, 0, 18, 3, 0x991111, 6); // angry brow
  return { body, eyeL, eyeR, pupilL, pupilR, brow };
}

// nil (Ruby) — small, round, cute
function createNilVisual(root: any) {
  const body = circ(root, 0, 0, 18, GHOSTS[1].color, 5);
  const eyeL = circ(root, 0, 0, 5, 0xffffff, 6);
  const eyeR = circ(root, 0, 0, 5, 0xffffff, 6);
  const pupilL = circ(root, 0, 0, 3, 0x000000, 7);
  const pupilR = circ(root, 0, 0, 3, 0x000000, 7);
  const cheek = circ(root, 0, 0, 4, 0xff88aa, 6); // blush
  return { body, eyeL, eyeR, pupilL, pupilR, cheek };
}

// None (Python) — elongated, snake-like head + trailing segment
function createNoneVisual(root: any) {
  const body = rect(root, 0, 0, 20, 14, GHOSTS[2].color, 5);
  const tail = circ(root, 0, 0, 10, 0x3366cc, 5);    // trailing segment
  const eyeL = circ(root, 0, 0, 4, 0xffcc00, 6);      // yellow snake eyes
  const eyeR = circ(root, 0, 0, 4, 0xffcc00, 6);
  const pupilL = rect(root, 0, 0, 2, 4, 0x000000, 7);  // slit pupils
  const pupilR = rect(root, 0, 0, 2, 4, 0x000000, 7);
  return { body, tail, eyeL, eyeR, pupilL, pupilR };
}

// undefined (JS) — glitchy, asymmetric, offset parts
function createUndefVisual(root: any) {
  const body = rect(root, 0, 0, 16, 16, GHOSTS[3].color, 5);
  const glitch1 = rect(root, 0, 0, 8, 4, 0xffaa00, 5); // offset shard
  const glitch2 = rect(root, 0, 0, 5, 6, 0xffee66, 5); // another shard
  const eyeL = rect(root, 0, 0, 5, 4, 0xffffff, 6);    // different shaped eyes
  const eyeR = circ(root, 0, 0, 5, 0xffffff, 6);        // asymmetric!
  const pupilL = rect(root, 0, 0, 3, 3, 0x000000, 7);
  const pupilR = circ(root, 0, 0, 3, 0x000000, 7);
  return { body, glitch1, glitch2, eyeL, eyeR, pupilL, pupilR };
}

type GhostVisual = {
  parts: any;
  setPos: (x: number, y: number, dir: number, frightened: boolean) => void;
  setVisible: (v: boolean) => void;
};

function makeGhostVisual(root: any, idx: number): GhostVisual {
  const ghost = GHOSTS[idx];

  if (idx === 0) {
    // NULL
    const p = createNullVisual(root);
    return {
      parts: p,
      setPos(x, y, dir, fr) {
        const col = fr ? COL_FRIGHT : ghost.color;
        setProp(p.body, "x", x); setProp(p.body, "y", y);
        setProp(p.body, "fillColor", col);
        setProp(p.brow, "x", x); setProp(p.brow, "y", y - 7);
        setProp(p.brow, "fillColor", fr ? 0x1111aa : 0x991111);
        setProp(p.eyeL, "x", x - 4); setProp(p.eyeL, "y", y - 1);
        setProp(p.eyeR, "x", x + 4); setProp(p.eyeR, "y", y - 1);
        const pd = fr ? 0 : dir;
        setProp(p.pupilL, "x", x - 4 + DX[pd] * 1); setProp(p.pupilL, "y", y - 1 + DY[pd] * 1);
        setProp(p.pupilR, "x", x + 4 + DX[pd] * 1); setProp(p.pupilR, "y", y - 1 + DY[pd] * 1);
      },
      setVisible(v) {
        for (const node of Object.values(p)) setProp(node, "visible", v);
      },
    };
  }

  if (idx === 1) {
    // nil
    const p = createNilVisual(root);
    return {
      parts: p,
      setPos(x, y, dir, fr) {
        const col = fr ? COL_FRIGHT : ghost.color;
        setProp(p.body, "x", x); setProp(p.body, "y", y);
        setProp(p.body, "fillColor", col);
        setProp(p.eyeL, "x", x - 3); setProp(p.eyeL, "y", y - 2);
        setProp(p.eyeR, "x", x + 3); setProp(p.eyeR, "y", y - 2);
        const pd = fr ? 0 : dir;
        setProp(p.pupilL, "x", x - 3 + DX[pd]); setProp(p.pupilL, "y", y - 2 + DY[pd]);
        setProp(p.pupilR, "x", x + 3 + DX[pd]); setProp(p.pupilR, "y", y - 2 + DY[pd]);
        setProp(p.cheek, "x", x + 5); setProp(p.cheek, "y", y + 3);
        setProp(p.cheek, "visible", !fr);
      },
      setVisible(v) {
        for (const node of Object.values(p)) setProp(node, "visible", v);
      },
    };
  }

  if (idx === 2) {
    // None
    const p = createNoneVisual(root);
    return {
      parts: p,
      setPos(x, y, dir, fr) {
        const col = fr ? COL_FRIGHT : ghost.color;
        setProp(p.body, "x", x); setProp(p.body, "y", y);
        setProp(p.body, "fillColor", col);
        setProp(p.tail, "x", x - DX[dir] * 8); setProp(p.tail, "y", y - DY[dir] * 8);
        setProp(p.tail, "fillColor", fr ? 0x1111aa : 0x3366cc);
        setProp(p.eyeL, "x", x - 4); setProp(p.eyeL, "y", y - 2);
        setProp(p.eyeR, "x", x + 4); setProp(p.eyeR, "y", y - 2);
        const pd = fr ? 0 : dir;
        setProp(p.pupilL, "x", x - 4 + DX[pd]); setProp(p.pupilL, "y", y - 2 + DY[pd]);
        setProp(p.pupilR, "x", x + 4 + DX[pd]); setProp(p.pupilR, "y", y - 2 + DY[pd]);
      },
      setVisible(v) {
        for (const node of Object.values(p)) setProp(node, "visible", v);
      },
    };
  }

  // idx === 3: undefined
  const p = createUndefVisual(root);
  return {
    parts: p,
    setPos(x, y, dir, fr) {
      const col = fr ? COL_FRIGHT : ghost.color;
      setProp(p.body, "x", x); setProp(p.body, "y", y);
      setProp(p.body, "fillColor", col);
      // Glitch shards offset from body
      const t = performance.now() / 200;
      const gx = Math.sin(t) * 2;
      setProp(p.glitch1, "x", x + 6 + gx); setProp(p.glitch1, "y", y - 7);
      setProp(p.glitch1, "fillColor", fr ? 0x1111aa : 0xffaa00);
      setProp(p.glitch2, "x", x - 7 - gx); setProp(p.glitch2, "y", y + 5);
      setProp(p.glitch2, "fillColor", fr ? 0x1111aa : 0xffee66);
      setProp(p.eyeL, "x", x - 3); setProp(p.eyeL, "y", y - 2);
      setProp(p.eyeR, "x", x + 4); setProp(p.eyeR, "y", y - 1); // asymmetric y!
      const pd = fr ? 0 : dir;
      setProp(p.pupilL, "x", x - 3 + DX[pd]); setProp(p.pupilL, "y", y - 2 + DY[pd]);
      setProp(p.pupilR, "x", x + 4 + DX[pd]); setProp(p.pupilR, "y", y - 1 + DY[pd]);
    },
    setVisible(v) {
      for (const node of Object.values(p)) setProp(node, "visible", v);
    },
  };
}

// ============================================================
// Scene
// ============================================================

class NullPowScene extends Phaser.Scene {
  constructor() { super("null-pow"); }

  create() {
    pushScene(this);
    const fm = createFrameManager();
    const root = this.add.container(0, 0);
    getMeta(root);

    this.events.on("update", (time: number, delta: number) => {
      solidionFrameUpdate(fm, time, delta);
    });

    createRoot(() => {
      const maze = parseMaze();

      // ── State ──
      const [score, setScore] = createSignal(0);
      const [lives, setLives] = createSignal(3);
      const [phase, setPhase] = createSignal<"ready" | "play" | "win" | "dead">("ready");

      // Dot signals — one per tile
      const dotSignals: [() => number, (v: number) => void][][] = [];
      for (let r = 0; r < ROWS; r++) {
        dotSignals[r] = [];
        for (let c = 0; c < COLS; c++) {
          dotSignals[r][c] = createSignal(maze.dots[r][c]);
        }
      }
      const totalDots = createMemo(() => {
        let count = 0;
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (dotSignals[r][c][0]() > 0) count++;
        return count;
      });

      // Player state (mutable)
      let pCol = maze.playerStart[0], pRow = maze.playerStart[1];
      let pDir = 0, pNextDir = 0;
      let pProgress = 0; // 0..1 progress between tiles

      // Ghost state
      type GhostMode = "chase" | "scatter" | "frightened" | "eaten";
      interface GhostState {
        col: number; row: number; dir: number;
        progress: number;
        mode: GhostMode;
        visual: GhostVisual;
        homeCol: number; homeRow: number;
        startDelay: number; // ms before leaving home
      }

      const ghostStates: GhostState[] = [];
      const ghostHomeCenter = [10, 11]; // center of ghost house

      // Mode timer
      let modeTimer = 0;
      let modePhaseIdx = 0;
      const MODE_SEQUENCE: [GhostMode, number][] = [
        ["scatter", 7000], ["chase", 20000],
        ["scatter", 7000], ["chase", 20000],
        ["scatter", 5000], ["chase", 20000],
        ["scatter", 5000], ["chase", Infinity],
      ];
      let frightTimer = 0;
      let frightActive = false;

      // ── Draw maze ──
      rect(root, W / 2, H / 2, W, H, COL_BG, 0);

      // Walls
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (maze.walls[r][c]) {
            const [px, py] = tileToPixel(c, r);
            rect(root, px, py, TILE - 1, TILE - 1, COL_WALL, 1);
          }
        }
      }

      // Dots
      const dotNodes: any[][] = [];
      for (let r = 0; r < ROWS; r++) {
        dotNodes[r] = [];
        for (let c = 0; c < COLS; c++) {
          const [px, py] = tileToPixel(c, r);
          const dotType = maze.dots[r][c];
          if (dotType === 1) {
            const d = circ(root, px, py, 4, COL_DOT, 2);
            dotNodes[r][c] = d;
          } else if (dotType === 2) {
            const d = circ(root, px, py, 10, COL_POWER, 2);
            dotNodes[r][c] = d;
          } else {
            dotNodes[r][c] = null;
          }

          if (dotType > 0) {
            const [getDot] = dotSignals[r][c];
            const node = dotNodes[r][c];
            if (node) {
              effect(() => setProp(node, "visible", getDot() > 0));
            }
          }
        }
      }

      // ── Player visual ──
      const ptrVisual = createPtrVisual(root);

      // ── Ghost visuals ──
      for (let i = 0; i < 4; i++) {
        const homePos = maze.ghostHome[i] ?? [10, 11];
        const vis = makeGhostVisual(root, i);
        ghostStates.push({
          col: homePos[0], row: homePos[1], dir: 3,
          progress: 0, mode: "scatter",
          visual: vis,
          homeCol: homePos[0], homeRow: homePos[1],
          startDelay: i * 3000, // staggered exit
        });
      }

      // ── HUD ──
      const scoreLbl = label(root, 8, 16, "", 16, "#00ddaa", 10);
      setProp(scoreLbl, "originX", 0); setProp(scoreLbl, "originY", 0.5);
      effect(() => setProp(scoreLbl, "text", `*ptr → ${score()}`));

      const livesLbl = label(root, W - 8, 16, "", 16, "#00ddaa", 10);
      setProp(livesLbl, "originX", 1); setProp(livesLbl, "originY", 0.5);
      effect(() => setProp(livesLbl, "text", "ptr ".repeat(lives())));

      const titleLbl = label(root, W / 2, 16, "NULL POW!", 14, "#444444", 10);

      // ── Overlay ──
      const overlayBg = rect(root, W / 2, H / 2, 280, 100, 0x000000, 9);
      setProp(overlayBg, "alpha", 0.9);
      const msg = label(root, W / 2, H / 2 - 14, "", 22, "#00ddaa", 10);
      const sub = label(root, W / 2, H / 2 + 14, "", 12, "#666666", 10);

      // POW! flash text (shown briefly on death)
      const powTxt = label(root, W / 2, H / 2 - 10, "ｶﾞｯ!", 36, "#ff3333", 11);
      setProp(powTxt, "visible", false);

      effect(() => {
        const p = phase();
        const show = p !== "play";
        setProp(overlayBg, "visible", show);
        setProp(msg, "visible", show);
        setProp(sub, "visible", show);

        if (p === "ready") {
          setProp(msg, "text", "NULL POW!");
          setProp(msg, "color", "#00ddaa");
          setProp(sub, "text", "ARROW KEYS TO MOVE — SPACE TO START");
        } else if (p === "dead") {
          setProp(msg, "text", "NullPointerException");
          setProp(msg, "color", "#ff3333");
          setProp(sub, "text", `score: ${score()} — SPACE to retry`);
        } else if (p === "win") {
          setProp(msg, "text", "GARBAGE COLLECTED!");
          setProp(msg, "color", "#00ff88");
          setProp(sub, "text", `score: ${score()} — all data recovered`);
        }
      });

      // ── Ghost AI: choose direction ──
      function chooseDir(gs: GhostState, targetC: number, targetR: number): number {
        const nextC = wrapC(gs.col + DX[gs.dir]);
        const nextR = gs.row + DY[gs.dir];

        let bestDir = gs.dir;
        let bestDist = Infinity;
        const reverse = (gs.dir + 2) % 4;

        for (let d = 0; d < 4; d++) {
          if (d === reverse) continue; // no 180° turns
          const nc = wrapC(gs.col + DX[d]);
          const nr = gs.row + DY[d];
          if (!canMove(maze.walls, nc, nr)) continue;
          // Ghost door: only allow up through door when eaten
          if (MAZE_STR[nr]?.[nc] === "-" && gs.mode !== "eaten") continue;
          const dist = distSq(nc, nr, targetC, targetR);
          if (dist < bestDist) { bestDist = dist; bestDir = d; }
        }
        return bestDir;
      }

      function getChaseTarget(gs: GhostState, idx: number): [number, number] {
        if (idx === 0) return [pCol, pRow]; // NULL: direct chase
        if (idx === 1) {
          // nil: target 4 tiles ahead of player
          return [wrapC(pCol + DX[pDir] * 4), pRow + DY[pDir] * 4];
        }
        if (idx === 2) {
          // None: ambush — target symmetric to NULL's position relative to a point 2 ahead of player
          const aheadC = pCol + DX[pDir] * 2;
          const aheadR = pRow + DY[pDir] * 2;
          const nullGs = ghostStates[0];
          return [aheadC * 2 - nullGs.col, aheadR * 2 - nullGs.row];
        }
        // undefined: random target when far, direct chase when close
        const dist = Math.abs(gs.col - pCol) + Math.abs(gs.row - pRow);
        if (dist < 8) return [pCol, pRow];
        return [Math.floor(Math.random() * COLS), Math.floor(Math.random() * ROWS)];
      }

      // ── Actions ──
      function resetPositions() {
        pCol = maze.playerStart[0]; pRow = maze.playerStart[1];
        pDir = 0; pNextDir = 0; pProgress = 0;
        for (let i = 0; i < ghostStates.length; i++) {
          const gs = ghostStates[i];
          const hp = maze.ghostHome[i] ?? [10, 11];
          gs.col = hp[0]; gs.row = hp[1]; gs.dir = 3;
          gs.progress = 0; gs.mode = "scatter";
          gs.startDelay = i * 3000;
        }
        modeTimer = 0; modePhaseIdx = 0;
        frightTimer = 0; frightActive = false;
      }

      function resetDots() {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            dotSignals[r][c][1](maze.dots[r][c]);
      }

      function startGame() {
        batch(() => {
          setScore(0); setLives(3);
          resetDots(); resetPositions();
          setPhase("play");
        });
      }

      function playerDeath() {
        // Show POW! flash
        setProp(powTxt, "visible", true);
        const nl = lives() - 1;
        if (nl <= 0) {
          batch(() => { setLives(0); setPhase("dead"); });
        } else {
          batch(() => { setLives(nl); });
          resetPositions();
          // Hide POW after delay
          setTimeout(() => {
            setProp(powTxt, "visible", false);
          }, 800);
          return;
        }
        setTimeout(() => setProp(powTxt, "visible", false), 1200);
      }

      function activateFrightened() {
        frightActive = true;
        frightTimer = FRIGHT_DURATION;
        for (const gs of ghostStates) {
          if (gs.mode !== "eaten") {
            gs.mode = "frightened";
            gs.dir = (gs.dir + 2) % 4; // reverse direction
          }
        }
      }

      // ── Input ──
      const kb = this.input.keyboard!;
      kb.on("keydown-LEFT", () => { pNextDir = 2; });
      kb.on("keydown-RIGHT", () => { pNextDir = 0; });
      kb.on("keydown-UP", () => { pNextDir = 3; });
      kb.on("keydown-DOWN", () => { pNextDir = 1; });
      kb.on("keydown-SPACE", () => {
        const p = phase();
        if (p === "ready" || p === "dead" || p === "win") startGame();
      });

      // ── Game loop ──
      fm.register((_, delta) => {
        if (phase() !== "play") return;
        const dt = Math.min(delta / 1000, 0.05);

        // ── Mode timer ──
        if (!frightActive) {
          modeTimer += delta;
          const [currentMode, duration] = MODE_SEQUENCE[modePhaseIdx];
          if (modeTimer >= duration && modePhaseIdx < MODE_SEQUENCE.length - 1) {
            modeTimer = 0;
            modePhaseIdx++;
            const [nextMode] = MODE_SEQUENCE[modePhaseIdx];
            for (const gs of ghostStates) {
              if (gs.mode !== "eaten") {
                gs.mode = nextMode;
                gs.dir = (gs.dir + 2) % 4;
              }
            }
          }
        } else {
          frightTimer -= delta;
          if (frightTimer <= 0) {
            frightActive = false;
            const [currentMode] = MODE_SEQUENCE[modePhaseIdx];
            for (const gs of ghostStates) {
              if (gs.mode === "frightened") gs.mode = currentMode;
            }
          }
        }

        // ── Player movement ──

        // When stopped or at a tile boundary, allow direction change immediately
        if (pProgress === 0) {
          const nc = wrapC(pCol + DX[pNextDir]);
          const nr = pRow + DY[pNextDir];
          if (canMove(maze.walls, nc, nr)) {
            pDir = pNextDir;
          }
        }

        // Advance if current direction is clear
        const canFwd = canMove(maze.walls, wrapC(pCol + DX[pDir]), pRow + DY[pDir]);
        if (canFwd) {
          pProgress += PLAYER_SPEED * dt;
        }

        if (pProgress >= 1) {
          pProgress -= 1;
          // Move to next tile (already validated above)
          pCol = wrapC(pCol + DX[pDir]);
          pRow = pRow + DY[pDir];

          // Collect dot
          if (pRow >= 0 && pRow < ROWS && pCol >= 0 && pCol < COLS) {
            const dotVal = dotSignals[pRow][pCol][0]();
            if (dotVal === 1) {
              dotSignals[pRow][pCol][1](0);
              setScore(s => s + 10);
            } else if (dotVal === 2) {
              dotSignals[pRow][pCol][1](0);
              setScore(s => s + 50);
              activateFrightened();
            }
          }

          // Try queued direction at new tile
          const nc = wrapC(pCol + DX[pNextDir]);
          const nr = pRow + DY[pNextDir];
          if (canMove(maze.walls, nc, nr)) {
            pDir = pNextDir;
          }

          // If current direction is now blocked, stop progress
          const fc = wrapC(pCol + DX[pDir]);
          const fr = pRow + DY[pDir];
          if (!canMove(maze.walls, fc, fr)) {
            pProgress = 0;
          }
        }

        // Update player visual
        const pLerpC = pCol + DX[pDir] * pProgress;
        const pLerpR = pRow + DY[pDir] * pProgress;
        const [ppx, ppy] = tileToPixel(pLerpC, pLerpR);
        positionPtr(ptrVisual, ppx, ppy, pDir);

        // ── Ghost movement ──
        for (let i = 0; i < ghostStates.length; i++) {
          const gs = ghostStates[i];

          // Start delay
          if (gs.startDelay > 0) {
            gs.startDelay -= delta;
            const [gx, gy] = tileToPixel(gs.col, gs.row);
            gs.visual.setPos(gx, gy, gs.dir, gs.mode === "frightened");
            continue;
          }

          const speed = gs.mode === "frightened" ? GHOST_FRIGHT_SPEED :
                        gs.mode === "eaten" ? PLAYER_SPEED * 2 : GHOST_SPEED;
          gs.progress += speed * dt;

          if (gs.progress >= 1) {
            gs.progress -= 1;
            gs.col = wrapC(gs.col + DX[gs.dir]);
            gs.row = gs.row + DY[gs.dir];

            // Choose next direction at intersection
            let target: [number, number];
            if (gs.mode === "chase") {
              target = getChaseTarget(gs, i);
            } else if (gs.mode === "scatter") {
              target = GHOSTS[i].scatterTarget as [number, number];
            } else if (gs.mode === "eaten") {
              target = [ghostHomeCenter[0], ghostHomeCenter[1]];
              if (gs.col === ghostHomeCenter[0] && gs.row === ghostHomeCenter[1]) {
                const [curMode] = MODE_SEQUENCE[modePhaseIdx];
                gs.mode = frightActive ? "frightened" : curMode;
              }
            } else {
              // Frightened: random
              const dirs = [0, 1, 2, 3].filter(d => {
                if (d === (gs.dir + 2) % 4) return false;
                const nc = wrapC(gs.col + DX[d]);
                const nr = gs.row + DY[d];
                return canMove(maze.walls, nc, nr);
              });
              if (dirs.length > 0) {
                gs.dir = dirs[Math.floor(Math.random() * dirs.length)];
              }
              target = [gs.col + DX[gs.dir], gs.row + DY[gs.dir]]; // dummy
            }

            if (gs.mode !== "frightened") {
              gs.dir = chooseDir(gs, target[0], target[1]);
            }

            // Validate direction
            const nc = wrapC(gs.col + DX[gs.dir]);
            const nr = gs.row + DY[gs.dir];
            if (!canMove(maze.walls, nc, nr)) {
              gs.progress = 0;
            }
          }

          // Render ghost
          const gLerpC = gs.col + DX[gs.dir] * gs.progress;
          const gLerpR = gs.row + DY[gs.dir] * gs.progress;
          const [gx, gy] = tileToPixel(gLerpC, gLerpR);
          gs.visual.setPos(gx, gy, gs.dir, gs.mode === "frightened");

          // ── Collision with player ──
          const dist = Math.abs(gLerpC - pLerpC) + Math.abs(gLerpR - pLerpR);
          if (dist < 0.8) {
            if (gs.mode === "frightened") {
              gs.mode = "eaten";
              setScore(s => s + 200);
            } else if (gs.mode !== "eaten") {
              playerDeath();
              return;
            }
          }
        }

        // ── Win check ──
        if (totalDots() === 0) {
          batch(() => { setPhase("win"); });
        }
      });
    });
  }
}

// ============================================================
// Boot
// ============================================================

new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: "game-container",
  backgroundColor: "#000000",
  scene: NullPowScene,
  banner: false,
  input: { keyboard: true },
});
