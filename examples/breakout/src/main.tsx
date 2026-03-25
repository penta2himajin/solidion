/**
 * Solidion Example: Breakout (JSX version, L0 only)
 *
 * A block breaker game written entirely at L0:
 *  - JSX declarative rendering of Phaser GameObjects
 *  - Reactive signals for all game state
 *  - Solidion <Show> for conditional overlay
 *  - Solidion <Index> for block grid
 *  - <GameLoop> for physics (no useFrame import)
 *  - <Game onPointerMove/onPointerDown> for input (no useScene import)
 *
 * No L3 (useFrame) or L4 (useScene) imports needed.
 */

import { createSignal, createMemo, batch, createRoot } from "solid-js";
import { Game, GameLoop, Show, Index } from "solidion";
import * as debug from "solidion/debug";
import Phaser from "phaser";

debug.enable();

// ============================================================
// Constants
// ============================================================

const W = 640, H = 480;
const PADDLE_W = 100, PADDLE_H = 14, PADDLE_Y = H - 40;
const BALL_R = 5, BALL_SPEED = 350;
const COLS = 10, ROWS = 6;
const BW = 54, BH = 18, BPAD = 4;
const BX0 = (W - (COLS * (BW + BPAD) - BPAD)) / 2;
const BY0 = 60;

const COLORS = [0xf07167, 0xe2b93d, 0x4ade80, 0x38bdf8, 0xa855f7, 0xf472b6];
const POINTS = [60, 50, 40, 30, 20, 10];

// ============================================================
// App
// ============================================================

function App() {
  // ── State ──
  const [score, setScore] = createSignal(0);
  const [lives, setLives] = createSignal(3);
  const [phase, setPhase] = createSignal<"ready" | "play" | "miss" | "win" | "over">("ready");
  const [padX, setPadX] = createSignal(W / 2);
  const [bx, setBx] = createSignal(W / 2);
  const [by, setBy] = createSignal(PADDLE_Y - BALL_R - 2);
  let vx = 0, vy = 0;

  const blocks = Array.from({ length: ROWS * COLS }, () => createSignal(true));
  const alive = createMemo(() => blocks.filter(([g]) => g()).length);

  // ── Helpers ──
  const launch = () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    vx = Math.cos(a) * BALL_SPEED;
    vy = Math.sin(a) * BALL_SPEED;
    setPhase("play");
  };

  const park = () => {
    setBx(padX()); setBy(PADDLE_Y - BALL_R - 2);
    vx = vy = 0;
  };

  const restart = () => {
    batch(() => {
      setScore(0); setLives(3); setPhase("ready"); park();
      for (const [, s] of blocks) s(true);
    });
  };

  // ── Overlay ──
  const overlayMsg = () => {
    const p = phase();
    const msgs: Record<string, [string, string, string]> = {
      ready: ["BREAKOUT", "#7fdbca", "click to launch"],
      miss:  ["MISS!", "#f07167", "click to continue"],
      over:  ["GAME OVER", "#f07167", `final score: ${score()} — click to restart`],
      win:   ["YOU WIN!", "#4ade80", `score: ${score()} — click to play again`],
    };
    return msgs[p];
  };

  // ── Input handlers (passed to <Game> props) ──
  const handlePointerMove = (ptr: Phaser.Input.Pointer) => {
    const px = Phaser.Math.Clamp(ptr.x, PADDLE_W / 2 + 4, W - PADDLE_W / 2 - 4);
    setPadX(px);
    if (phase() === "ready" || phase() === "miss") setBx(px);
  };

  const handlePointerDown = () => {
    const p = phase();
    if (p === "ready" || p === "miss") launch();
    else if (p === "over" || p === "win") restart();
  };

  // ── Debug state export ──
  let debugTimer = 0;
  const exposeDebug = () => {
    debug.expose({
      phase: phase(),
      score: score(),
      lives: lives(),
      alive: alive(),
      bx: bx(),
      by: by(),
    });
  };

  // ── Physics (passed to <GameLoop>) ──
  const handleUpdate = (_: number, delta: number) => {
    debugTimer -= delta;
    if (debugTimer <= 0) { debugTimer = 200; exposeDebug(); }
    if (phase() !== "play") return;
    const dt = Math.min(delta / 1000, 0.033);
    let x = bx() + vx * dt;
    let y = by() + vy * dt;

    // Walls
    if (x - BALL_R <= 4)     { x = 4 + BALL_R;     vx = Math.abs(vx); }
    if (x + BALL_R >= W - 4) { x = W - 4 - BALL_R; vx = -Math.abs(vx); }
    if (y - BALL_R <= 4)     { y = 4 + BALL_R;      vy = Math.abs(vy); }

    // Paddle
    const px = padX();
    if (
      vy > 0 &&
      y + BALL_R >= PADDLE_Y - PADDLE_H / 2 &&
      y - BALL_R <= PADDLE_Y + PADDLE_H / 2 &&
      x >= px - PADDLE_W / 2 && x <= px + PADDLE_W / 2
    ) {
      y = PADDLE_Y - PADDLE_H / 2 - BALL_R;
      const hit = (x - px) / (PADDLE_W / 2);
      const ang = -Math.PI / 2 + hit * 0.6;
      const spd = Math.sqrt(vx * vx + vy * vy);
      vx = Math.cos(ang) * spd;
      vy = Math.sin(ang) * spd;
    }

    // Blocks
    let hitBlock = false;
    for (let r = 0; r < ROWS && !hitBlock; r++) {
      for (let c = 0; c < COLS && !hitBlock; c++) {
        const idx = r * COLS + c;
        const [isAlive, setAlive] = blocks[idx];
        if (!isAlive()) continue;

        const bkx = BX0 + c * (BW + BPAD) + BW / 2;
        const bky = BY0 + r * (BH + BPAD) + BH / 2;

        if (
          x + BALL_R > bkx - BW / 2 && x - BALL_R < bkx + BW / 2 &&
          y + BALL_R > bky - BH / 2 && y - BALL_R < bky + BH / 2
        ) {
          const ol = (x + BALL_R) - (bkx - BW / 2);
          const or_ = (bkx + BW / 2) - (x - BALL_R);
          const ot = (y + BALL_R) - (bky - BH / 2);
          const ob = (bky + BH / 2) - (y - BALL_R);
          const min = Math.min(ol, or_, ot, ob);
          if (min === ol || min === or_) vx = -vx; else vy = -vy;
          setAlive(false);
          setScore(s => s + POINTS[r]);
          hitBlock = true;
        }
      }
    }

    // Fell below
    if (y > H + 20) {
      const nl = lives() - 1;
      if (nl <= 0) {
        batch(() => { setLives(0); setPhase("over"); park(); });
      } else {
        batch(() => { setLives(nl); setPhase("miss"); park(); });
      }
      return;
    }

    // Win
    if (alive() === 0) {
      batch(() => { setPhase("win"); park(); });
      return;
    }

    batch(() => { setBx(x); setBy(y); });
  };

  // ── Render ──
  return (
    <Game width={W} height={H} backgroundColor={0x0f1729} parent="game-container"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
    >
      <GameLoop onUpdate={handleUpdate} />

      {/* Background + walls */}
      <rectangle x={W / 2} y={H / 2} width={W} height={H} fillColor={0x0f1729} origin={0.5} depth={0} />
      <rectangle x={W / 2} y={0} width={W} height={4} fillColor={0x1e3a5f} origin={0.5} depth={1} />
      <rectangle x={0} y={H / 2} width={4} height={H} fillColor={0x1e3a5f} origin={0.5} depth={1} />
      <rectangle x={W} y={H / 2} width={4} height={H} fillColor={0x1e3a5f} origin={0.5} depth={1} />

      {/* Blocks */}
      <Index each={blocks}>
        {([isAlive], idx) => {
          const r = Math.floor(idx / COLS);
          const c = idx % COLS;
          const bkx = BX0 + c * (BW + BPAD) + BW / 2;
          const bky = BY0 + r * (BH + BPAD) + BH / 2;
          return (
            <rectangle
              x={bkx} y={bky} width={BW} height={BH}
              fillColor={COLORS[r]} origin={0.5} depth={2}
              visible={isAlive()}
            />
          );
        }}
      </Index>

      {/* Paddle */}
      <rectangle x={padX()} y={PADDLE_Y} width={PADDLE_W} height={PADDLE_H}
        fillColor={0xf0f0f0} origin={0.5} depth={3}
      />

      {/* Ball */}
      <rectangle x={bx()} y={by()} width={BALL_R * 2} height={BALL_R * 2}
        fillColor={0xffffff} origin={0.5} depth={4}
      />

      {/* HUD */}
      <text x={16} y={H - 20} text={`SCORE  ${score()}`}
        fontSize={16} fontFamily="monospace" color="#7fdbca"
        originX={0} originY={0.5} depth={5}
      />
      <text x={W - 16} y={H - 20}
        text={"♥".repeat(lives()) + "♡".repeat(Math.max(0, 3 - lives()))}
        fontSize={16} fontFamily="monospace" color="#f07167"
        originX={1} originY={0.5} depth={5}
      />

      {/* Overlay */}
      <Show when={phase() !== "play"}>
        <text x={W / 2} y={H / 2}
          text={overlayMsg() ? overlayMsg()![0] : ""}
          fontSize={24} fontFamily="monospace"
          color={overlayMsg() ? overlayMsg()![1] : "#ffffff"}
          origin={0.5} depth={10}
        />
        <text x={W / 2} y={H / 2 + 36}
          text={overlayMsg() ? overlayMsg()![2] : ""}
          fontSize={14} fontFamily="monospace" color="#666666"
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
