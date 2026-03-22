/**
 * Solidion Example: Floppy Heads (JSX version, L0 only)
 *
 * A Flappy Bird-style game where a floppy disk navigates through
 * gaps between drive read/write heads.
 *
 * Demonstrates:
 *  - JSX declarative rendering of Phaser GameObjects
 *  - Reactive signals for all game state
 *  - Solidion <Show> for conditional overlay
 *  - <GameLoop> for physics (no useFrame import)
 *  - <Game onPointerDown> for input (no useScene import)
 *
 * No L3 (useFrame) or L4 (useScene) imports needed.
 */

import { createSignal, batch, createRoot, onCleanup } from "solid-js";
import { Game } from "solidion/components/Game";
import { GameLoop } from "solidion/components/GameLoop";
import { Show } from "solidion/components/Show";
import Phaser from "phaser";

// ============================================================
// Constants
// ============================================================

const W = 400, H = 600;

// Floppy disk
const DISK_X = 80;
const DISK_W = 36, DISK_H = 38;

// Physics
const GRAVITY = 900;
const FLAP_VEL = -280;
const MAX_VEL = 500;

// Heads (obstacles)
const HEAD_W = 52;
const GAP = 150;
const SCROLL_SPEED = 160;
const HEAD_SPAWN_X = W + HEAD_W;
const HEAD_SPACING = 200;
const NUM_HEADS = 4; // recycled pool

// Ground
const GROUND_H = 60;
const GROUND_Y = H - GROUND_H;

// Colors
const COL_BG = 0x1a1a2e;
const COL_GROUND = 0x2a2a3e;
const COL_GROUND_LINE = 0x4a4a6e;
const COL_DISK_BODY = 0x8888aa;
const COL_DISK_METAL = 0x555577;
const COL_DISK_LABEL = 0x3366aa;
const COL_DISK_HUB = 0x444466;
const COL_HEAD_ARM = 0x666688;
const COL_HEAD_TIP = 0xaaaacc;

// ============================================================
// Head pair state (mutable object pool)
// ============================================================

interface HeadPair {
  x: number;
  gapY: number;
  scored: boolean;
  active: boolean;
}

// ============================================================
// App
// ============================================================

function App() {
  // -- State --
  const [score, setScore] = createSignal(0);
  const [best, setBest] = createSignal(0);
  const [phase, setPhase] = createSignal<"ready" | "play" | "dead">("ready");
  const [diskY, setDiskY] = createSignal(H / 2.5);
  const [diskAngle, setDiskAngle] = createSignal(0);
  let vy = 0;

  // Head pairs (object pool) — mutable data, positions driven by signals
  const heads: HeadPair[] = Array.from({ length: NUM_HEADS }, () => ({
    x: -100, gapY: 300, scored: false, active: false,
  }));

  // Signals for head positions (one per head, each stores {x, gapY, active})
  const headSignals = heads.map(() =>
    createSignal<{ x: number; gapY: number; active: boolean }>({ x: -100, gapY: 300, active: false })
  );

  let nextSpawnX = HEAD_SPAWN_X;

  function syncHeadSignal(i: number) {
    const hp = heads[i];
    headSignals[i][1]({ x: hp.x, gapY: hp.gapY, active: hp.active });
  }

  function resetHeads() {
    for (let i = 0; i < heads.length; i++) {
      heads[i].active = false;
      heads[i].x = -100;
      syncHeadSignal(i);
    }
    nextSpawnX = HEAD_SPAWN_X;
  }

  function spawnHead() {
    const idx = heads.findIndex(h => !h.active);
    if (idx === -1) return;
    const hp = heads[idx];
    const minY = 80 + GAP / 2;
    const maxY = GROUND_Y - 20 - GAP / 2;
    hp.gapY = minY + Math.random() * (maxY - minY);
    hp.x = nextSpawnX;
    hp.scored = false;
    hp.active = true;
    syncHeadSignal(idx);
    nextSpawnX += HEAD_SPACING;
  }

  // -- Disk rotation math --
  function diskPartPos(y: number, angle: number, offsetY: number) {
    const rad = angle * Math.PI / 180;
    return {
      x: DISK_X + offsetY * Math.sin(rad),
      y: y + offsetY * Math.cos(rad),
    };
  }

  // -- Actions --
  const flap = () => {
    if (phase() === "dead") return;
    if (phase() === "ready") {
      setPhase("play");
      resetHeads();
      for (let i = 0; i < NUM_HEADS; i++) spawnHead();
    }
    vy = FLAP_VEL;
  };

  const die = () => {
    batch(() => {
      setPhase("dead");
      if (score() > best()) setBest(score());
    });
  };

  const restart = () => {
    batch(() => {
      setScore(0);
      setDiskY(H / 2.5);
      setDiskAngle(0);
      vy = 0;
      setPhase("ready");
      resetHeads();
    });
  };

  // -- Input handlers --
  const handlePointerDown = () => {
    if (phase() === "dead") restart();
    else flap();
  };

  // Keyboard input (space key) via document listener
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (phase() === "dead") restart();
      else flap();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  // -- Physics (GameLoop) --
  const handleUpdate = (_: number, delta: number) => {
    const p = phase();

    // Idle bobbing animation
    if (p === "ready") {
      const t = performance.now() / 1000;
      setDiskY(H / 2.5 + Math.sin(t * 2.5) * 8);
      setDiskAngle(0);
      return;
    }

    if (p === "dead") return;

    const dt = Math.min(delta / 1000, 0.033);

    // Gravity
    vy = Math.min(vy + GRAVITY * dt, MAX_VEL);
    let y = diskY() + vy * dt;

    // Tilt based on velocity
    const targetAngle = Phaser.Math.Clamp(vy * 0.08, -25, 70);
    const currentAngle = diskAngle();
    const angleLerp = vy > 0 ? 3 : 8;
    const newAngle = currentAngle + (targetAngle - currentAngle) * Math.min(angleLerp * dt, 1);

    // Ceiling
    if (y < DISK_H / 2) {
      y = DISK_H / 2;
      vy = 0;
    }

    // Ground collision
    if (y + DISK_H / 2 >= GROUND_Y) {
      y = GROUND_Y - DISK_H / 2;
      die();
      batch(() => { setDiskY(y); setDiskAngle(newAngle); });
      return;
    }

    // Scroll heads
    const scrollDx = SCROLL_SPEED * dt;
    for (let i = 0; i < heads.length; i++) {
      const hp = heads[i];
      if (!hp.active) continue;
      hp.x -= scrollDx;

      // Off screen left -> deactivate
      if (hp.x < -HEAD_W) {
        hp.active = false;
        hp.x = -100;
        syncHeadSignal(i);
        spawnHead();
        continue;
      }

      // Score: disk passed the head
      if (!hp.scored && hp.x + HEAD_W / 2 < DISK_X) {
        hp.scored = true;
        setScore(s => s + 1);
      }

      // Collision
      const diskLeft = DISK_X - DISK_W / 2 + 4;
      const diskRight = DISK_X + DISK_W / 2 - 4;
      const diskTop = y - DISK_H / 2 + 4;
      const diskBot = y + DISK_H / 2 - 4;
      const headLeft = hp.x - HEAD_W / 2;
      const headRight = hp.x + HEAD_W / 2;
      const topBot = hp.gapY - GAP / 2;
      const botTop = hp.gapY + GAP / 2;

      if (diskRight > headLeft && diskLeft < headRight) {
        if (diskTop < topBot || diskBot > botTop) {
          die();
          batch(() => { setDiskY(y); setDiskAngle(newAngle); });
          return;
        }
      }

      syncHeadSignal(i);
    }

    batch(() => { setDiskY(y); setDiskAngle(newAngle); });
  };

  // -- Overlay helpers --
  const overlayMsg = () => {
    const p = phase();
    if (p === "ready") return ["FLOPPY HEADS", "#e0e0ff", "click or press space to flap"] as const;
    if (p === "dead") return ["EJECT!", "#ff6666", `score: ${score()} \u2014 click to retry`] as const;
    return null;
  };

  const overlayBest = () => {
    const p = phase();
    if (p === "ready") return best() > 0 ? `best: ${best()}` : "";
    if (p === "dead") return `best: ${best()}`;
    return "";
  };

  // -- Render --
  return (
    <Game width={W} height={H} backgroundColor={COL_BG} parent="game-container"
      onPointerDown={handlePointerDown}
    >
      <GameLoop onUpdate={handleUpdate} />

      {/* Background */}
      <rectangle x={W / 2} y={H / 2} width={W} height={H} fillColor={COL_BG} origin={0.5} depth={0} />

      {/* Ground */}
      <rectangle x={W / 2} y={GROUND_Y + GROUND_H / 2} width={W} height={GROUND_H}
        fillColor={COL_GROUND} origin={0.5} depth={6}
      />
      <rectangle x={W / 2} y={GROUND_Y} width={W} height={3}
        fillColor={COL_GROUND_LINE} origin={0.5} depth={7}
      />

      {/* Head pairs (4 recycled) */}
      {headSignals.map(([hs]) => {
        const topY = () => hs().gapY - GAP / 2;
        const botY = () => hs().gapY + GAP / 2;
        return (
          <>
            {/* Top arm */}
            <rectangle x={hs().x} y={topY()} width={HEAD_W} height={H}
              fillColor={COL_HEAD_ARM} originX={0.5} originY={1} depth={3}
            />
            {/* Top tip */}
            <rectangle x={hs().x} y={topY()} width={HEAD_W + 8} height={16}
              fillColor={COL_HEAD_TIP} originX={0.5} originY={1} depth={4}
            />
            {/* Bottom arm */}
            <rectangle x={hs().x} y={botY()} width={HEAD_W} height={H}
              fillColor={COL_HEAD_ARM} originX={0.5} originY={0} depth={3}
            />
            {/* Bottom tip */}
            <rectangle x={hs().x} y={botY()} width={HEAD_W + 8} height={16}
              fillColor={COL_HEAD_TIP} originX={0.5} originY={0} depth={4}
            />
          </>
        );
      })}

      {/* Floppy disk (composite) */}
      {/* Body */}
      <rectangle
        x={diskPartPos(diskY(), diskAngle(), 0).x}
        y={diskPartPos(diskY(), diskAngle(), 0).y}
        width={DISK_W} height={DISK_H}
        fillColor={COL_DISK_BODY} origin={0.5} depth={5}
        angle={diskAngle()}
      />
      {/* Metal slider */}
      <rectangle
        x={diskPartPos(diskY(), diskAngle(), -DISK_H / 2 + 4).x}
        y={diskPartPos(diskY(), diskAngle(), -DISK_H / 2 + 4).y}
        width={DISK_W - 6} height={8}
        fillColor={COL_DISK_METAL} origin={0.5} depth={5}
        angle={diskAngle()}
      />
      {/* Label */}
      <rectangle
        x={diskPartPos(diskY(), diskAngle(), 4).x}
        y={diskPartPos(diskY(), diskAngle(), 4).y}
        width={DISK_W - 8} height={14}
        fillColor={COL_DISK_LABEL} origin={0.5} depth={5}
        angle={diskAngle()}
      />
      {/* Hub window */}
      <rectangle
        x={diskPartPos(diskY(), diskAngle(), DISK_H / 2 - 8).x}
        y={diskPartPos(diskY(), diskAngle(), DISK_H / 2 - 8).y}
        width={8} height={8}
        fillColor={COL_DISK_HUB} origin={0.5} depth={5}
        angle={diskAngle()}
      />

      {/* HUD: score (visible only during play) */}
      <Show when={phase() === "play"}>
        <text x={W / 2} y={50} text={`${score()}`}
          fontSize={48} fontFamily="monospace" color="#e0e0ff"
          origin={0.5} depth={10}
        />
      </Show>

      {/* Overlay (ready / dead) */}
      <Show when={phase() !== "play"}>
        <text x={W / 2} y={H / 2 - 40}
          text={overlayMsg() ? overlayMsg()![0] : ""}
          fontSize={28} fontFamily="monospace"
          color={overlayMsg() ? overlayMsg()![1] : "#ffffff"}
          origin={0.5} depth={10}
        />
        <text x={W / 2} y={H / 2 + 10}
          text={overlayMsg() ? overlayMsg()![2] : ""}
          fontSize={14} fontFamily="monospace" color="#8888aa"
          origin={0.5} depth={10}
        />
        <text x={W / 2} y={H / 2 + 40}
          text={overlayBest()}
          fontSize={14} fontFamily="monospace" color="#6a6a8a"
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
