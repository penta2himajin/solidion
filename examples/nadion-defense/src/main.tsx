/**
 * Solidion Example: Nadion Defense (JSX version)
 *
 * A Space Invaders-style game set in the Star Trek universe.
 * The player controls a phaser array, firing nadion particles
 * at descending hostile formations.
 *
 * Demonstrates:
 *  - 40 reactive enemy entities with individual alive signals
 *  - Dynamic projectile creation/destruction (2-layer nadion bolts + enemy fire)
 *  - Formation movement pattern (shift, step-down, speed-up)
 *  - Multiple game object types managed by signals
 *  - LCARS-inspired visual design
 *  - JSX declarative rendering with <Game>, <GameLoop>, <Show>
 *  - useScene() for keyboard input
 */

import { createSignal, createMemo, batch, createRoot, createEffect } from "solid-js";
import { Game } from "solidion/components/Game";
import { GameLoop } from "solidion/components/GameLoop";
import { Show } from "solidion/components/Show";
import { Index } from "solidion/components/For";
import { useScene } from "solidion/contexts";
import * as debug from "solidion/debug";
import Phaser from "phaser";

debug.enable();

// ============================================================
// Constants
// ============================================================

const W = 640, H = 540;

// LCARS layout
const LCARS_TOP = 42;
const PLAY_TOP = LCARS_TOP + 8;
const SB_W = 20;
const SB_MARGIN = 10;
const PLAY_LEFT = SB_W + SB_MARGIN;
const PLAY_RIGHT = W - SB_W - SB_MARGIN;
const PLAY_W = PLAY_RIGHT - PLAY_LEFT;
const PLAY_CX = (PLAY_LEFT + PLAY_RIGHT) / 2;

// Player (phaser array)
const PLAYER_W = 52, PLAYER_H = 14;
const PLAYER_Y = H - 36;
const PLAYER_SPEED = 300;

// Enemies
const COLS = 8, ROWS = 5;
const EN_W = 32, EN_H = 18, EN_PAD = 12;
const GRID_W = COLS * (EN_W + EN_PAD) - EN_PAD;
const EN_X0 = PLAY_CX - GRID_W / 2;
const EN_Y0 = PLAY_TOP + 30;
const EN_STEP_DOWN = 16;
const EN_SHIFT_INIT = 30;

// Projectiles
const NADION_CORE_W = 2, NADION_CORE_H = 14;
const NADION_GLOW_W = 6, NADION_GLOW_H = 20;
const ENEMY_BOLT_W = 3, ENEMY_BOLT_H = 10;
const BOLT_SPEED = 420;
const ENEMY_BOLT_SPEED = 180;
const FIRE_COOLDOWN = 300;
const ENEMY_FIRE_RATE = 0.008;

// Shields
const SHIELD_COUNT = 4;
const SHIELD_W = 48, SHIELD_H = 20;
const SHIELD_Y = PLAYER_Y - 50;

// LCARS Color Palette
const LCARS = {
  bg:         0x000000,
  panelDark:  0x1a1a2e,
  orange:     0xff9900,
  amber:      0xcc6600,
  gold:       0xffcc66,
  purple:     0x9977aa,
  lavender:   0xcc99cc,
  blue:       0x5599cc,
  blueLight:  0x88bbdd,
  peach:      0xff9966,
  red:        0xcc4444,
  green:      0x44cc88,
  text:       0xffcc99,
};

// Enemy row colors
const COL_ENEMY_ROWS = [
  0xcc99cc,  // row 0 — lavender
  0x9977aa,  // row 1 — purple
  0xff9966,  // row 2 — peach
  0xff9900,  // row 3 — orange
  0xcc6600,  // row 4 — amber
];
const POINTS_ROWS = [50, 40, 30, 20, 10];

// LCARS frame constants
const TB = 10;
const CAP_W = 70;
const CAP_H = LCARS_TOP;
const END_W = 50;
const BOT_H = 14;

const barStartX = PLAY_LEFT + 8;
const barEndX = PLAY_RIGHT - 8;
const barY = CAP_H - TB / 2 - 2;
const botY = H - BOT_H / 2;
const botBarW = barEndX - barStartX;

// Sidebar segments
const sideTop = CAP_H + 5;
const sideBot = H - BOT_H - 5;

const leftSegments = [
  { y: sideTop,       h: 40,  color: LCARS.orange },
  { y: sideTop + 46,  h: 30,  color: LCARS.lavender },
  { y: sideTop + 82,  h: 50,  color: LCARS.blue },
  { y: sideTop + 140, h: 65,  color: LCARS.purple },
  { y: sideTop + 215, h: 35,  color: LCARS.peach },
  { y: sideTop + 260, h: 55,  color: LCARS.amber },
  { y: sideTop + 325, h: sideBot - (sideTop + 325), color: LCARS.orange },
];

const rightSegments = [
  { y: sideTop,       h: 55,  color: LCARS.purple },
  { y: sideTop + 61,  h: 35,  color: LCARS.peach },
  { y: sideTop + 102, h: 45,  color: LCARS.orange },
  { y: sideTop + 155, h: 60,  color: LCARS.blue },
  { y: sideTop + 225, h: 40,  color: LCARS.lavender },
  { y: sideTop + 275, h: 50,  color: LCARS.amber },
  { y: sideTop + 335, h: sideBot - (sideTop + 335), color: LCARS.purple },
];

// Shield positions
const shieldSpacing = PLAY_W / (SHIELD_COUNT + 1);

// ============================================================
// Pill component (rect + circle on each end)
// ============================================================

function Pill(props: { x: number; y: number; w: number; h: number; color: number; depth: number }) {
  return (
    <>
      <rectangle x={props.x} y={props.y} width={props.w} height={props.h}
        fillColor={props.color} origin={0.5} depth={props.depth} />
      <ellipse x={props.x - props.w / 2} y={props.y} width={props.h} height={props.h}
        fillColor={props.color} origin={0.5} depth={props.depth} />
      <ellipse x={props.x + props.w / 2} y={props.y} width={props.h} height={props.h}
        fillColor={props.color} origin={0.5} depth={props.depth} />
    </>
  );
}

// ============================================================
// Sidebar component
// ============================================================

function Sidebar(props: { centerX: number; segments: typeof leftSegments }) {
  return (
    <>
      {props.segments.map(seg => {
        if (seg.h <= 0) return null;
        const cy = seg.y + seg.h / 2;
        return (
          <>
            <rectangle x={props.centerX} y={cy} width={SB_W} height={seg.h}
              fillColor={seg.color} origin={0.5} depth={1} />
            <ellipse x={props.centerX} y={seg.y} width={SB_W} height={SB_W}
              fillColor={seg.color} origin={0.5} depth={1} />
            <ellipse x={props.centerX} y={seg.y + seg.h} width={SB_W} height={SB_W}
              fillColor={seg.color} origin={0.5} depth={1} />
          </>
        );
      })}
    </>
  );
}

// ============================================================
// App
// ============================================================

function App() {
  // ── State ──

  const [score, setScore] = createSignal(0);
  const [lives, setLives] = createSignal(3);
  const [wave, setWave] = createSignal(1);
  const [phase, setPhase] = createSignal<"ready" | "play" | "win" | "dead">("ready");
  const [playerX, setPlayerX] = createSignal(W / 2);

  let moveLeft = false, moveRight = false;
  let lastFireTime = 0;

  let formOffX = 0;
  let formOffY = 0;
  let formDir = 1;
  let formSpeed = EN_SHIFT_INIT;

  // ── Enemies ──

  const enemies = Array.from({ length: ROWS * COLS }, () => createSignal(true));
  const alive = createMemo(() => enemies.filter(([g]) => g()).length);

  // Enemy position signals — each enemy has [x, y] signals
  const enemyPositions = Array.from({ length: ROWS * COLS }, (_, idx) => {
    const r = Math.floor(idx / COLS);
    const c = idx % COLS;
    const initX = EN_X0 + c * (EN_W + EN_PAD) + EN_W / 2;
    const initY = EN_Y0 + r * (EN_H + EN_PAD) + EN_H / 2;
    return {
      x: createSignal(initX),
      y: createSignal(initY),
    };
  });

  function getEnemyPos(r: number, c: number): [number, number] {
    const x = EN_X0 + c * (EN_W + EN_PAD) + EN_W / 2 + formOffX;
    const y = EN_Y0 + r * (EN_H + EN_PAD) + EN_H / 2 + formOffY;
    return [x, y];
  }

  function updateEnemyPositions() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const [x, y] = getEnemyPos(r, c);
        enemyPositions[idx].x[1](x);
        enemyPositions[idx].y[1](y);
      }
    }
  }

  // ── Shields ──

  const shieldStates = Array.from({ length: SHIELD_COUNT }, () => ({
    hp: 4,
    visible: createSignal(true),
    outerAlpha: createSignal(0.6),
    innerAlpha: createSignal(0.3),
  }));

  function damageShield(idx: number) {
    const s = shieldStates[idx];
    s.hp--;
    if (s.hp <= 0) {
      s.visible[1](false);
    } else {
      s.outerAlpha[1](0.15 * s.hp);
      s.innerAlpha[1](0.08 * s.hp);
    }
  }

  function resetShields() {
    for (const s of shieldStates) {
      s.hp = 4;
      s.visible[1](true);
      s.outerAlpha[1](0.6);
      s.innerAlpha[1](0.3);
    }
  }

  // ── Bolt pool ──

  interface BoltState {
    x: ReturnType<typeof createSignal<number>>;
    y: ReturnType<typeof createSignal<number>>;
    visible: ReturnType<typeof createSignal<boolean>>;
    glowVisible: ReturnType<typeof createSignal<boolean>>;
    coreColor: ReturnType<typeof createSignal<number>>;
    coreW: ReturnType<typeof createSignal<number>>;
    coreH: ReturnType<typeof createSignal<number>>;
    vy: number;
    active: boolean;
    isPlayer: boolean;
    // Raw mutable x/y for collision (avoid signal reads in hot loop)
    rawX: number;
    rawY: number;
  }

  const MAX_BOLTS = 24;
  const bolts: BoltState[] = Array.from({ length: MAX_BOLTS }, () => ({
    x: createSignal(-50),
    y: createSignal(-50),
    visible: createSignal(false),
    glowVisible: createSignal(false),
    coreColor: createSignal(0xffffee),
    coreW: createSignal(NADION_CORE_W),
    coreH: createSignal(NADION_CORE_H),
    vy: 0,
    active: false,
    isPlayer: true,
    rawX: -50,
    rawY: -50,
  }));

  function fireBolt(x: number, y: number, vy: number, isPlayer: boolean) {
    const bolt = bolts.find(b => !b.active);
    if (!bolt) return;
    bolt.rawX = x; bolt.rawY = y; bolt.vy = vy;
    bolt.active = true; bolt.isPlayer = isPlayer;
    bolt.x[1](x); bolt.y[1](y);
    bolt.visible[1](true);

    if (isPlayer) {
      bolt.coreColor[1](0xffffee);
      bolt.coreW[1](NADION_CORE_W);
      bolt.coreH[1](NADION_CORE_H);
      bolt.glowVisible[1](true);
    } else {
      bolt.coreColor[1](LCARS.green);
      bolt.coreW[1](ENEMY_BOLT_W);
      bolt.coreH[1](ENEMY_BOLT_H);
      bolt.glowVisible[1](false);
    }
  }

  function deactivateBolt(bolt: BoltState) {
    bolt.active = false;
    bolt.visible[1](false);
    bolt.glowVisible[1](false);
    bolt.rawX = -50; bolt.rawY = -50;
    bolt.x[1](-50); bolt.y[1](-50);
  }

  function clearBolts() {
    for (const b of bolts) deactivateBolt(b);
  }

  // ── Actions ──

  function resetFormation() {
    formOffX = 0; formOffY = 0; formDir = 1;
    formSpeed = EN_SHIFT_INIT + (wave() - 1) * 8;
    for (const [, setAlive] of enemies) setAlive(true);
    updateEnemyPositions();
  }

  function startGame() {
    batch(() => {
      setScore(0); setLives(3); setWave(1);
      setPlayerX(W / 2);
      resetFormation();
      resetShields();
      clearBolts();
      setPhase("play");
    });
  }

  function nextWave() {
    batch(() => {
      setWave(w => w + 1);
      resetFormation();
      resetShields();
      clearBolts();
      setPhase("play");
    });
  }

  function playerDie() {
    const nl = lives() - 1;
    if (nl <= 0) {
      batch(() => { setLives(0); setPhase("dead"); clearBolts(); });
    } else {
      batch(() => { setLives(nl); clearBolts(); setPlayerX(W / 2); });
    }
  }

  // ── Overlay message ──

  const overlayMsg = () => {
    const p = phase();
    if (p === "ready") return ["NADION DEFENSE", "#ff9900", "\u2190 \u2192 MOVE     SPACE FIRE"] as const;
    if (p === "dead") return ["ARRAY OFFLINE", "#cc4444", `FINAL SCORE ${score()}  \u2014  SPACE TO RETRY`] as const;
    if (p === "win") return ["SECTOR CLEAR", "#44cc88", `SCORE ${score()}  \u2014  SPACE FOR NEXT WAVE`] as const;
    return undefined;
  };

  // ── Keyboard setup (needs useScene) ──

  function KeyboardSetup() {
    const scene = useScene();
    const kb = scene.input.keyboard!;
    kb.on("keydown-LEFT", () => { moveLeft = true; });
    kb.on("keyup-LEFT", () => { moveLeft = false; });
    kb.on("keydown-RIGHT", () => { moveRight = true; });
    kb.on("keyup-RIGHT", () => { moveRight = false; });
    kb.on("keydown-A", () => { moveLeft = true; });
    kb.on("keyup-A", () => { moveLeft = false; });
    kb.on("keydown-D", () => { moveRight = true; });
    kb.on("keyup-D", () => { moveRight = false; });

    kb.on("keydown-SPACE", () => {
      const p = phase();
      if (p === "ready") { startGame(); return; }
      if (p === "dead") { startGame(); return; }
      if (p === "win") { nextWave(); return; }
      const now = performance.now();
      if (now - lastFireTime < FIRE_COOLDOWN) return;
      lastFireTime = now;
      fireBolt(playerX(), PLAYER_Y - PLAYER_H / 2 - 10, -BOLT_SPEED, true);
    });

    return null;
  }

  // ── Pointer down handler ──

  const handlePointerDown = () => {
    const p = phase();
    if (p === "ready") { startGame(); return; }
    if (p === "dead") { startGame(); return; }
    if (p === "win") { nextWave(); return; }
    const now = performance.now();
    if (now - lastFireTime < FIRE_COOLDOWN) return;
    lastFireTime = now;
    fireBolt(playerX(), PLAYER_Y - PLAYER_H / 2 - 10, -BOLT_SPEED, true);
  };

  // ── Debug state export ──
  let debugTimer = 0;
  const exposeDebug = () => {
    debug.expose({
      phase: phase(),
      score: score(),
      lives: lives(),
      wave: wave(),
      alive: alive(),
      playerX: playerX(),
      shieldHps: shieldStates.map(s => s.hp),
      activeBolts: bolts.filter(b => b.active).length,
    });
  };

  // ── Game loop ──

  const handleUpdate = (_: number, delta: number) => {
    debugTimer -= delta;
    if (debugTimer <= 0) { debugTimer = 200; exposeDebug(); }
    if (phase() !== "play") return;
    const dt = Math.min(delta / 1000, 0.033);

    // Player movement
    let px = playerX();
    if (moveLeft) px -= PLAYER_SPEED * dt;
    if (moveRight) px += PLAYER_SPEED * dt;
    px = Phaser.Math.Clamp(px, PLAY_LEFT + PLAYER_W / 2, PLAY_RIGHT - PLAYER_W / 2);
    setPlayerX(px);

    // Formation movement
    let leftCol = COLS, rightCol = -1;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (enemies[r * COLS + c][0]()) {
          if (c < leftCol) leftCol = c;
          if (c > rightCol) rightCol = c;
        }
      }
    }

    if (rightCol >= 0) {
      const leftEdge = EN_X0 + leftCol * (EN_W + EN_PAD) + formOffX;
      const rightEdge = EN_X0 + rightCol * (EN_W + EN_PAD) + EN_W + formOffX;

      formOffX += formDir * formSpeed * dt;

      if (rightEdge + formDir * formSpeed * dt > PLAY_RIGHT - 4) {
        formDir = -1;
        formOffY += EN_STEP_DOWN;
      } else if (leftEdge + formDir * formSpeed * dt < PLAY_LEFT + 4) {
        formDir = 1;
        formOffY += EN_STEP_DOWN;
      }
    }

    const aliveCount = alive();
    formSpeed = EN_SHIFT_INIT + (ROWS * COLS - aliveCount) * 2.5 + (wave() - 1) * 8;

    updateEnemyPositions();

    // Enemies reached player
    for (let r = ROWS - 1; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (!enemies[r * COLS + c][0]()) continue;
        const [, ey] = getEnemyPos(r, c);
        if (ey + EN_H / 2 >= PLAYER_Y - PLAYER_H) {
          batch(() => { setLives(0); setPhase("dead"); clearBolts(); });
          return;
        }
      }
    }

    // Enemy fire
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (!enemies[r * COLS + c][0]()) continue;
        if (Math.random() < ENEMY_FIRE_RATE) {
          const [ex, ey] = getEnemyPos(r, c);
          fireBolt(ex, ey + EN_H / 2, ENEMY_BOLT_SPEED, false);
        }
        break;
      }
    }

    // Update bolts
    for (const bolt of bolts) {
      if (!bolt.active) continue;
      bolt.rawY += bolt.vy * dt;

      if (bolt.rawY < -20 || bolt.rawY > H + 20) {
        deactivateBolt(bolt);
        continue;
      }

      bolt.y[1](bolt.rawY);

      if (bolt.isPlayer) {
        // Nadion vs enemies
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            if (!enemies[idx][0]()) continue;
            const [ex, ey] = getEnemyPos(r, c);
            if (
              bolt.rawX > ex - EN_W / 2 && bolt.rawX < ex + EN_W / 2 &&
              bolt.rawY > ey - EN_H / 2 && bolt.rawY < ey + EN_H / 2
            ) {
              enemies[idx][1](false);
              setScore(s => s + POINTS_ROWS[r]);
              deactivateBolt(bolt);
              break;
            }
          }
          if (!bolt.active) break;
        }
      } else {
        // Enemy bolt vs player
        if (
          bolt.rawX > px - PLAYER_W / 2 && bolt.rawX < px + PLAYER_W / 2 &&
          bolt.rawY > PLAYER_Y - PLAYER_H / 2 && bolt.rawY < PLAYER_Y + PLAYER_H / 2
        ) {
          deactivateBolt(bolt);
          playerDie();
          if (phase() !== "play") return;
          continue;
        }

        // Enemy bolt vs shields
        for (let si = 0; si < shieldStates.length; si++) {
          const s = shieldStates[si];
          if (s.hp <= 0) continue;
          const sx = PLAY_LEFT + shieldSpacing * (si + 1);
          if (
            bolt.rawX > sx - SHIELD_W / 2 && bolt.rawX < sx + SHIELD_W / 2 &&
            bolt.rawY > SHIELD_Y - SHIELD_H / 2 && bolt.rawY < SHIELD_Y + SHIELD_H / 2
          ) {
            deactivateBolt(bolt);
            damageShield(si);
            break;
          }
        }
      }
    }

    // Win
    if (aliveCount === 0) {
      batch(() => { setPhase("win"); clearBolts(); });
    }
  };

  // ── Render ──

  const capY = CAP_H / 2;
  const lSideX = SB_W / 2;
  const rSideX = W - SB_W / 2;

  return (
    <Game width={W} height={H} backgroundColor={LCARS.bg} parent="game-container"
      onPointerDown={handlePointerDown}
      config={{ input: { keyboard: true } }}
    >
      <GameLoop onUpdate={handleUpdate} />
      <KeyboardSetup />

      {/* Background */}
      <rectangle x={W / 2} y={H / 2} width={W} height={H}
        fillColor={LCARS.bg} origin={0.5} depth={0} />

      {/* ── LCARS Frame ── */}

      {/* Left cap */}
      <rectangle x={CAP_W / 2} y={capY} width={CAP_W} height={CAP_H}
        fillColor={LCARS.lavender} origin={0.5} depth={1} />
      <ellipse x={0} y={capY} width={CAP_H} height={CAP_H}
        fillColor={LCARS.lavender} origin={0.5} depth={1} />

      {/* Right cap */}
      <rectangle x={W - CAP_W / 2} y={capY} width={CAP_W} height={CAP_H}
        fillColor={LCARS.amber} origin={0.5} depth={1} />
      <ellipse x={W} y={capY} width={CAP_H} height={CAP_H}
        fillColor={LCARS.amber} origin={0.5} depth={1} />

      {/* Left sidebar */}
      <Sidebar centerX={lSideX} segments={leftSegments} />

      {/* Right sidebar */}
      <Sidebar centerX={rSideX} segments={rightSegments} />

      {/* Top horizontal bars (pill segments) */}
      <Pill x={barStartX + 14} y={barY} w={28} h={TB} color={LCARS.orange} depth={1} />
      <Pill x={290} y={barY} w={14} h={TB} color={LCARS.lavender} depth={1} />
      <Pill x={350} y={barY} w={14} h={TB} color={LCARS.peach} depth={1} />
      <Pill x={barEndX - 14} y={barY} w={28} h={TB} color={LCARS.lavender} depth={1} />

      {/* Bottom left cap */}
      <rectangle x={CAP_W / 2} y={botY} width={CAP_W} height={BOT_H}
        fillColor={LCARS.purple} origin={0.5} depth={1} />
      <ellipse x={0} y={botY} width={BOT_H} height={BOT_H}
        fillColor={LCARS.purple} origin={0.5} depth={1} />

      {/* Bottom right cap */}
      <rectangle x={W - CAP_W / 2} y={botY} width={CAP_W} height={BOT_H}
        fillColor={LCARS.orange} origin={0.5} depth={1} />
      <ellipse x={W} y={botY} width={BOT_H} height={BOT_H}
        fillColor={LCARS.orange} origin={0.5} depth={1} />

      {/* Bottom horizontal bar */}
      <Pill x={barStartX + botBarW / 2} y={botY} w={botBarW} h={TB} color={LCARS.amber} depth={1} />

      {/* ── Enemies ── */}
      <Index each={enemies}>
        {([isAlive], idx) => {
          const r = Math.floor(idx / COLS);
          const ep = enemyPositions[idx];
          return (
            <>
              {/* Main body */}
              <rectangle x={ep.x[0]()} y={ep.y[0]()} width={EN_W} height={EN_H}
                fillColor={COL_ENEMY_ROWS[r]} origin={0.5} depth={3}
                visible={isAlive()} />
              {/* Side notch left */}
              <rectangle x={ep.x[0]() - EN_W / 2 + 2} y={ep.y[0]()} width={4} height={EN_H - 6}
                fillColor={0x000000} origin={0.5} depth={4}
                visible={isAlive()} />
              {/* Side notch right */}
              <rectangle x={ep.x[0]() + EN_W / 2 - 2} y={ep.y[0]()} width={4} height={EN_H - 6}
                fillColor={0x000000} origin={0.5} depth={4}
                visible={isAlive()} />
              {/* Top accent bar */}
              <rectangle x={ep.x[0]()} y={ep.y[0]() - EN_H / 2 + 3} width={EN_W - 10} height={3}
                fillColor={0xffffff} origin={0.5} depth={4} alpha={0.25}
                visible={isAlive()} />
            </>
          );
        }}
      </Index>

      {/* ── Shields ── */}
      {shieldStates.map((s, i) => {
        const sx = PLAY_LEFT + shieldSpacing * (i + 1);
        return (
          <>
            <rectangle x={sx} y={SHIELD_Y} width={SHIELD_W} height={SHIELD_H}
              fillColor={LCARS.blue} origin={0.5} depth={2}
              alpha={s.outerAlpha[0]()} visible={s.visible[0]()} />
            <rectangle x={sx} y={SHIELD_Y} width={SHIELD_W - 6} height={SHIELD_H - 6}
              fillColor={LCARS.blueLight} origin={0.5} depth={2}
              alpha={s.innerAlpha[0]()} visible={s.visible[0]()} />
          </>
        );
      })}

      {/* ── Player (phaser array) ── */}
      {/* Base platform */}
      <rectangle x={playerX()} y={PLAYER_Y} width={PLAYER_W} height={PLAYER_H}
        fillColor={LCARS.orange} origin={0.5} depth={5} />
      {/* Emitter housing */}
      <rectangle x={playerX()} y={PLAYER_Y - PLAYER_H / 2 - 2} width={16} height={6}
        fillColor={LCARS.gold} origin={0.5} depth={5} />
      {/* Emitter tip */}
      <rectangle x={playerX()} y={PLAYER_Y - PLAYER_H / 2 - 5} width={4} height={4}
        fillColor={0xffffff} origin={0.5} depth={6} />
      {/* Side accents */}
      <rectangle x={playerX() - PLAYER_W / 2 + 2} y={PLAYER_Y} width={4} height={PLAYER_H + 4}
        fillColor={LCARS.amber} origin={0.5} depth={5} />
      <rectangle x={playerX() + PLAYER_W / 2 - 2} y={PLAYER_Y} width={4} height={PLAYER_H + 4}
        fillColor={LCARS.amber} origin={0.5} depth={5} />

      {/* ── Bolt pool ── */}
      {bolts.map(bolt => (
        <>
          {/* Glow layer (nadion bolts only) */}
          <rectangle x={bolt.x[0]()} y={bolt.y[0]()} width={NADION_GLOW_W} height={NADION_GLOW_H}
            fillColor={LCARS.orange} origin={0.5} depth={7} alpha={0.45}
            visible={bolt.glowVisible[0]()} />
          {/* Core layer */}
          <rectangle x={bolt.x[0]()} y={bolt.y[0]()} width={bolt.coreW[0]()} height={bolt.coreH[0]()}
            fillColor={bolt.coreColor[0]()} origin={0.5} depth={8}
            visible={bolt.visible[0]()} />
        </>
      ))}

      {/* ── HUD ── */}
      <text x={200} y={barY} text={`SCORE ${String(score()).padStart(6, "0")}`}
        fontSize={14} fontFamily="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
        color="#ff9900" origin={0.5} depth={10} />

      <text x={320} y={barY} text={`SEC ${wave()}`}
        fontSize={12} fontFamily="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
        color="#cc99cc" origin={0.5} depth={10} />

      <text x={440} y={barY} text={`ARRAYS ${"■ ".repeat(lives())}`}
        fontSize={14} fontFamily="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
        color="#ff9900" origin={0.5} depth={10} />

      {/* ── Overlay ── */}
      <Show when={phase() !== "play"}>
        <rectangle x={W / 2} y={H / 2} width={324} height={124}
          fillColor={LCARS.orange} origin={0.5} depth={8} alpha={0.5} />
        <rectangle x={W / 2} y={H / 2} width={320} height={120}
          fillColor={0x000000} origin={0.5} depth={9} alpha={0.85} />
        <text x={W / 2} y={H / 2 - 18}
          text={overlayMsg() ? overlayMsg()![0] : ""}
          fontSize={26} fontFamily="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
          color={overlayMsg() ? overlayMsg()![1] : "#ffffff"}
          origin={0.5} depth={10} />
        <text x={W / 2} y={H / 2 + 18}
          text={overlayMsg() ? overlayMsg()![2] : ""}
          fontSize={13} fontFamily="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif"
          color="#cc99cc" origin={0.5} depth={10} />
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
