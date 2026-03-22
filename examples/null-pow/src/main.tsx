/**
 * Solidion Example: Null Pow! (JSX version)
 *
 * A Pac-Man-style maze game where a pointer (*ptr) collects data values
 * while avoiding four null references: NULL, nil, None, undefined.
 *
 * Demonstrates:
 *  - JSX declarative rendering of Phaser GameObjects
 *  - Reactive signals for all game state
 *  - Solidion <Show> for conditional overlay
 *  - <GameLoop> for physics
 *  - useScene() for keyboard input (L4)
 *  - Ghost character components with composite shapes
 *
 * "ぬるぽ" → "ガッ!" / "Null" → "Pow!"
 */

import Phaser from "phaser";
import { createRoot, createSignal, createMemo, batch } from "solid-js";
import { Game } from "solidion/components/Game";
import { GameLoop } from "solidion/components/GameLoop";
import { Show } from "solidion/components/Show";
import { useScene } from "solidion/contexts";

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
// Ghost visual components
// ============================================================

function NullGhost(props: { x: number; y: number; dir: number; frightened: boolean; visible: boolean }) {
  const col = () => props.frightened ? COL_FRIGHT : GHOSTS[0].color;
  const pd = () => props.frightened ? 0 : props.dir;
  return (
    <>
      <rectangle x={props.x} y={props.y} width={18} height={18} fillColor={col()} origin={0.5} depth={5} visible={props.visible} />
      <rectangle x={props.x} y={props.y - 7} width={18} height={3} fillColor={props.frightened ? 0x1111aa : 0x991111} origin={0.5} depth={6} visible={props.visible} />
      <rectangle x={props.x - 4} y={props.y - 1} width={5} height={5} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <rectangle x={props.x + 4} y={props.y - 1} width={5} height={5} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <rectangle x={props.x - 4 + DX[pd()] * 1} y={props.y - 1 + DY[pd()] * 1} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
      <rectangle x={props.x + 4 + DX[pd()] * 1} y={props.y - 1 + DY[pd()] * 1} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
    </>
  );
}

function NilGhost(props: { x: number; y: number; dir: number; frightened: boolean; visible: boolean }) {
  const col = () => props.frightened ? COL_FRIGHT : GHOSTS[1].color;
  const pd = () => props.frightened ? 0 : props.dir;
  return (
    <>
      <ellipse x={props.x} y={props.y} width={18} height={18} fillColor={col()} origin={0.5} depth={5} visible={props.visible} />
      <ellipse x={props.x - 3} y={props.y - 2} width={5} height={5} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <ellipse x={props.x + 3} y={props.y - 2} width={5} height={5} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <ellipse x={props.x - 3 + DX[pd()]} y={props.y - 2 + DY[pd()]} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
      <ellipse x={props.x + 3 + DX[pd()]} y={props.y - 2 + DY[pd()]} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
      <ellipse x={props.x + 5} y={props.y + 3} width={4} height={4} fillColor={0xff88aa} origin={0.5} depth={6} visible={props.visible && !props.frightened} />
    </>
  );
}

function NoneGhost(props: { x: number; y: number; dir: number; frightened: boolean; visible: boolean }) {
  const col = () => props.frightened ? COL_FRIGHT : GHOSTS[2].color;
  const tailCol = () => props.frightened ? 0x1111aa : 0x3366cc;
  const pd = () => props.frightened ? 0 : props.dir;
  return (
    <>
      <rectangle x={props.x} y={props.y} width={20} height={14} fillColor={col()} origin={0.5} depth={5} visible={props.visible} />
      <ellipse x={props.x - DX[props.dir] * 8} y={props.y - DY[props.dir] * 8} width={10} height={10} fillColor={tailCol()} origin={0.5} depth={5} visible={props.visible} />
      <ellipse x={props.x - 4} y={props.y - 2} width={4} height={4} fillColor={0xffcc00} origin={0.5} depth={6} visible={props.visible} />
      <ellipse x={props.x + 4} y={props.y - 2} width={4} height={4} fillColor={0xffcc00} origin={0.5} depth={6} visible={props.visible} />
      <rectangle x={props.x - 4 + DX[pd()]} y={props.y - 2 + DY[pd()]} width={2} height={4} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
      <rectangle x={props.x + 4 + DX[pd()]} y={props.y - 2 + DY[pd()]} width={2} height={4} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
    </>
  );
}

function UndefGhost(props: { x: number; y: number; dir: number; frightened: boolean; visible: boolean; time: number }) {
  const col = () => props.frightened ? COL_FRIGHT : GHOSTS[3].color;
  const gx = () => Math.sin(props.time / 200) * 2;
  const pd = () => props.frightened ? 0 : props.dir;
  return (
    <>
      <rectangle x={props.x} y={props.y} width={16} height={16} fillColor={col()} origin={0.5} depth={5} visible={props.visible} />
      <rectangle x={props.x + 6 + gx()} y={props.y - 7} width={8} height={4} fillColor={props.frightened ? 0x1111aa : 0xffaa00} origin={0.5} depth={5} visible={props.visible} />
      <rectangle x={props.x - 7 - gx()} y={props.y + 5} width={5} height={6} fillColor={props.frightened ? 0x1111aa : 0xffee66} origin={0.5} depth={5} visible={props.visible} />
      <rectangle x={props.x - 3} y={props.y - 2} width={5} height={4} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <ellipse x={props.x + 4} y={props.y - 1} width={5} height={5} fillColor={0xffffff} origin={0.5} depth={6} visible={props.visible} />
      <rectangle x={props.x - 3 + DX[pd()]} y={props.y - 2 + DY[pd()]} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
      <ellipse x={props.x + 4 + DX[pd()]} y={props.y - 1 + DY[pd()]} width={3} height={3} fillColor={0x000000} origin={0.5} depth={7} visible={props.visible} />
    </>
  );
}

// ============================================================
// Player visual component
// ============================================================

function PtrVisual(props: { x: number; y: number; dir: number }) {
  return (
    <>
      <rectangle x={props.x} y={props.y} width={14} height={14} fillColor={COL_PTR} origin={0.5} depth={6} angle={props.dir * 90} />
      <rectangle x={props.x + DX[props.dir] * 5} y={props.y + DY[props.dir] * 5} width={6} height={6} fillColor={0xffffff} origin={0.5} depth={7} />
      <rectangle x={props.x - DX[props.dir] * 6} y={props.y - DY[props.dir] * 6} width={4} height={10} fillColor={0x008866} origin={0.5} depth={6} angle={props.dir * 90} />
    </>
  );
}

// ============================================================
// Keyboard setup component (uses L4 useScene)
// ============================================================

function KeyboardInput(props: {
  onLeft: () => void;
  onRight: () => void;
  onUp: () => void;
  onDown: () => void;
  onSpace: () => void;
}) {
  const scene = useScene();
  const kb = scene.input.keyboard!;
  kb.on("keydown-LEFT", props.onLeft);
  kb.on("keydown-RIGHT", props.onRight);
  kb.on("keydown-UP", props.onUp);
  kb.on("keydown-DOWN", props.onDown);
  kb.on("keydown-SPACE", props.onSpace);
  return null;
}

// ============================================================
// App
// ============================================================

function App() {
  const maze = parseMaze();

  // ── State ──
  const [score, setScore] = createSignal(0);
  const [lives, setLives] = createSignal(3);
  const [phase, setPhase] = createSignal<"ready" | "play" | "win" | "dead">("ready");
  const [powVisible, setPowVisible] = createSignal(false);

  // Player position signals for reactive rendering
  const [playerX, setPlayerX] = createSignal(0);
  const [playerY, setPlayerY] = createSignal(0);
  const [playerDir, setPlayerDir] = createSignal(0);

  // Ghost position signals
  const ghostSignals = Array.from({ length: 4 }, () => ({
    x: createSignal(0),
    y: createSignal(0),
    dir: createSignal(0),
    frightened: createSignal(false),
    visible: createSignal(true),
  }));
  const [undefTime, setUndefTime] = createSignal(0);

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
  let pProgress = 0;

  // Ghost state
  type GhostMode = "chase" | "scatter" | "frightened" | "eaten";
  interface GhostState {
    col: number; row: number; dir: number;
    progress: number;
    mode: GhostMode;
    homeCol: number; homeRow: number;
    startDelay: number;
  }

  const ghostStates: GhostState[] = [];
  const ghostHomeCenter = [10, 11];

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

  // Init ghost states
  for (let i = 0; i < 4; i++) {
    const homePos = maze.ghostHome[i] ?? [10, 11];
    ghostStates.push({
      col: homePos[0], row: homePos[1], dir: 3,
      progress: 0, mode: "scatter",
      homeCol: homePos[0], homeRow: homePos[1],
      startDelay: i * 3000,
    });
  }

  // ── Overlay ──
  const overlayMsg = () => {
    const p = phase();
    if (p === "ready") return ["NULL POW!", "#00ddaa", "ARROW KEYS TO MOVE — SPACE TO START"] as const;
    if (p === "dead") return ["NullPointerException", "#ff3333", `score: ${score()} — SPACE to retry`] as const;
    if (p === "win") return ["GARBAGE COLLECTED!", "#00ff88", `score: ${score()} — all data recovered`] as const;
    return null;
  };

  // ── Ghost AI: choose direction ──
  function chooseDir(gs: GhostState, targetC: number, targetR: number): number {
    let bestDir = gs.dir;
    let bestDist = Infinity;
    const reverse = (gs.dir + 2) % 4;

    for (let d = 0; d < 4; d++) {
      if (d === reverse) continue;
      const nc = wrapC(gs.col + DX[d]);
      const nr = gs.row + DY[d];
      if (!canMove(maze.walls, nc, nr)) continue;
      if (MAZE_STR[nr]?.[nc] === "-" && gs.mode !== "eaten") continue;
      const dist = distSq(nc, nr, targetC, targetR);
      if (dist < bestDist) { bestDist = dist; bestDir = d; }
    }
    return bestDir;
  }

  function getChaseTarget(gs: GhostState, idx: number): [number, number] {
    if (idx === 0) return [pCol, pRow];
    if (idx === 1) {
      return [wrapC(pCol + DX[pDir] * 4), pRow + DY[pDir] * 4];
    }
    if (idx === 2) {
      const aheadC = pCol + DX[pDir] * 2;
      const aheadR = pRow + DY[pDir] * 2;
      const nullGs = ghostStates[0];
      return [aheadC * 2 - nullGs.col, aheadR * 2 - nullGs.row];
    }
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
    setPowVisible(true);
    const nl = lives() - 1;
    if (nl <= 0) {
      batch(() => { setLives(0); setPhase("dead"); });
    } else {
      batch(() => { setLives(nl); });
      resetPositions();
      setTimeout(() => { setPowVisible(false); }, 800);
      return;
    }
    setTimeout(() => setPowVisible(false), 1200);
  }

  function activateFrightened() {
    frightActive = true;
    frightTimer = FRIGHT_DURATION;
    for (const gs of ghostStates) {
      if (gs.mode !== "eaten") {
        gs.mode = "frightened";
        gs.dir = (gs.dir + 2) % 4;
      }
    }
  }

  // ── Game loop ──
  const handleUpdate = (_: number, delta: number) => {
    if (phase() !== "play") return;
    const dt = Math.min(delta / 1000, 0.05);

    // ── Mode timer ──
    if (!frightActive) {
      modeTimer += delta;
      const [, duration] = MODE_SEQUENCE[modePhaseIdx];
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
    if (pProgress === 0) {
      const nc = wrapC(pCol + DX[pNextDir]);
      const nr = pRow + DY[pNextDir];
      if (canMove(maze.walls, nc, nr)) {
        pDir = pNextDir;
      }
    }

    const canFwd = canMove(maze.walls, wrapC(pCol + DX[pDir]), pRow + DY[pDir]);
    if (canFwd) {
      pProgress += PLAYER_SPEED * dt;
    }

    if (pProgress >= 1) {
      pProgress -= 1;
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
    setPlayerX(ppx);
    setPlayerY(ppy);
    setPlayerDir(pDir);

    // ── Ghost movement ──
    for (let i = 0; i < ghostStates.length; i++) {
      const gs = ghostStates[i];

      // Start delay
      if (gs.startDelay > 0) {
        gs.startDelay -= delta;
        const [gx, gy] = tileToPixel(gs.col, gs.row);
        ghostSignals[i].x[1](gx);
        ghostSignals[i].y[1](gy);
        ghostSignals[i].dir[1](gs.dir);
        ghostSignals[i].frightened[1](gs.mode === "frightened");
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
          target = [gs.col + DX[gs.dir], gs.row + DY[gs.dir]];
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
      ghostSignals[i].x[1](gx);
      ghostSignals[i].y[1](gy);
      ghostSignals[i].dir[1](gs.dir);
      ghostSignals[i].frightened[1](gs.mode === "frightened");
      if (i === 3) setUndefTime(performance.now());

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
  };

  // ── Build maze wall/dot data for JSX ──
  const wallTiles: { px: number; py: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze.walls[r][c]) {
        const [px, py] = tileToPixel(c, r);
        wallTiles.push({ px, py });
      }
    }
  }

  const dotTiles: { r: number; c: number; px: number; py: number; type: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (maze.dots[r][c] > 0) {
        const [px, py] = tileToPixel(c, r);
        dotTiles.push({ r, c, px, py, type: maze.dots[r][c] });
      }
    }
  }

  // ── Render ──
  return (
    <Game width={W} height={H} backgroundColor={COL_BG} parent="game-container">
      <GameLoop onUpdate={handleUpdate} />
      <KeyboardInput
        onLeft={() => { pNextDir = 2; }}
        onRight={() => { pNextDir = 0; }}
        onUp={() => { pNextDir = 3; }}
        onDown={() => { pNextDir = 1; }}
        onSpace={() => {
          const p = phase();
          if (p === "ready" || p === "dead" || p === "win") startGame();
        }}
      />

      {/* Background */}
      <rectangle x={W / 2} y={H / 2} width={W} height={H} fillColor={COL_BG} origin={0.5} depth={0} />

      {/* Walls */}
      {wallTiles.map(w => (
        <rectangle x={w.px} y={w.py} width={TILE - 1} height={TILE - 1} fillColor={COL_WALL} origin={0.5} depth={1} />
      ))}

      {/* Dots */}
      {dotTiles.map(d => (
        d.type === 1
          ? <ellipse x={d.px} y={d.py} width={4} height={4} fillColor={COL_DOT} origin={0.5} depth={2} visible={dotSignals[d.r][d.c][0]() > 0} />
          : <ellipse x={d.px} y={d.py} width={10} height={10} fillColor={COL_POWER} origin={0.5} depth={2} visible={dotSignals[d.r][d.c][0]() > 0} />
      ))}

      {/* Player */}
      <PtrVisual x={playerX()} y={playerY()} dir={playerDir()} />

      {/* Ghosts */}
      <NullGhost x={ghostSignals[0].x[0]()} y={ghostSignals[0].y[0]()} dir={ghostSignals[0].dir[0]()} frightened={ghostSignals[0].frightened[0]()} visible={ghostSignals[0].visible[0]()} />
      <NilGhost x={ghostSignals[1].x[0]()} y={ghostSignals[1].y[0]()} dir={ghostSignals[1].dir[0]()} frightened={ghostSignals[1].frightened[0]()} visible={ghostSignals[1].visible[0]()} />
      <NoneGhost x={ghostSignals[2].x[0]()} y={ghostSignals[2].y[0]()} dir={ghostSignals[2].dir[0]()} frightened={ghostSignals[2].frightened[0]()} visible={ghostSignals[2].visible[0]()} />
      <UndefGhost x={ghostSignals[3].x[0]()} y={ghostSignals[3].y[0]()} dir={ghostSignals[3].dir[0]()} frightened={ghostSignals[3].frightened[0]()} visible={ghostSignals[3].visible[0]()} time={undefTime()} />

      {/* HUD */}
      <text x={8} y={16} text={`*ptr → ${score()}`} fontSize={16} fontFamily="monospace" color="#00ddaa" originX={0} originY={0.5} depth={10} />
      <text x={W - 8} y={16} text={"ptr ".repeat(lives())} fontSize={16} fontFamily="monospace" color="#00ddaa" originX={1} originY={0.5} depth={10} />
      <text x={W / 2} y={16} text="NULL POW!" fontSize={14} fontFamily="monospace" color="#444444" origin={0.5} depth={10} />

      {/* POW! flash */}
      <text x={W / 2} y={H / 2 - 10} text="ｶﾞｯ!" fontSize={36} fontFamily="monospace" color="#ff3333" origin={0.5} depth={11} visible={powVisible()} />

      {/* Overlay */}
      <Show when={phase() !== "play"}>
        <rectangle x={W / 2} y={H / 2} width={280} height={100} fillColor={0x000000} origin={0.5} depth={9} alpha={0.9} />
        <text x={W / 2} y={H / 2 - 14}
          text={overlayMsg() ? overlayMsg()![0] : ""}
          fontSize={22} fontFamily="monospace"
          color={overlayMsg() ? overlayMsg()![1] : "#ffffff"}
          origin={0.5} depth={10}
        />
        <text x={W / 2} y={H / 2 + 14}
          text={overlayMsg() ? overlayMsg()![2] : ""}
          fontSize={12} fontFamily="monospace" color="#666666"
          origin={0.5} depth={10}
        />
      </Show>
    </Game>
  );
}

// ============================================================
// Mount
// ============================================================

createRoot(() => {
  const el = App();
  if (el instanceof HTMLElement) {
    document.getElementById("game-container")?.appendChild(el);
  }
});
