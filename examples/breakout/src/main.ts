/**
 * Solidion Example: Breakout
 *
 * A block breaker game demonstrating:
 *  - Solidion's createRenderer driving Phaser 3 GameObjects
 *  - Reactive signals for all game state (score, lives, positions, block visibility)
 *  - solidionFrameUpdate for batch-synchronized frame processing
 *  - Event handling via the on* prop convention
 *  - Derived computations (memo) for win condition
 *
 * Architecture:
 *  - 60 blocks are each backed by an individual Signal (alive/dead)
 *  - Ball physics runs inside a frame callback, updating position Signals
 *  - All Phaser property mutations flow through Solid's effect → setProp
 *  - batch() ensures atomic updates (e.g. ball position x+y together)
 */

import Phaser from "phaser";
import { createRoot, createSignal, createMemo, batch } from "solid-js";
import { _createElement as createElement, insert, setProp, effect } from "solidion/renderer";
import { getMeta } from "solidion/core/meta";
import { pushScene } from "solidion/core/scene-stack";
import { createFrameManager } from "solidion/core/frame";
import { solidionFrameUpdate } from "solidion/core/sync";

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
// Helper: create + configure a rectangle
// ============================================================

function rect(
  root: any,
  x: number, y: number, w: number, h: number,
  color: number, depth: number
) {
  const r = createElement("rectangle");
  setProp(r, "x", x); setProp(r, "y", y);
  setProp(r, "width", w); setProp(r, "height", h);
  setProp(r, "fillColor", color);
  setProp(r, "origin", 0.5);
  setProp(r, "depth", depth);
  insert(root, r);
  return r;
}

function label(
  root: any,
  x: number, y: number,
  text: string, size: number, color: string, depth: number
) {
  const t = createElement("text");
  setProp(t, "x", x); setProp(t, "y", y);
  setProp(t, "text", text);
  setProp(t, "fontSize", size);
  setProp(t, "fontFamily", "monospace");
  setProp(t, "color", color);
  setProp(t, "origin", 0.5);
  setProp(t, "depth", depth);
  insert(root, t);
  return t;
}

// ============================================================
// Scene
// ============================================================

class BreakoutScene extends Phaser.Scene {
  constructor() { super("breakout"); }

  create() {
    pushScene(this);
    const fm = createFrameManager();
    const root = this.add.container(0, 0);
    getMeta(root);

    // Wire Solidion's batch-synchronized frame update
    this.events.on("update", (time: number, delta: number) => {
      solidionFrameUpdate(fm, time, delta);
    });

    createRoot(() => {

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

      // ── Static visuals ──

      rect(root, W / 2, H / 2, W, H, 0x0f1729, 0);          // bg
      rect(root, W / 2, 0, W, 4, 0x1e3a5f, 1);               // top wall
      rect(root, 0, H / 2, 4, H, 0x1e3a5f, 1);               // left wall
      rect(root, W, H / 2, 4, H, 0x1e3a5f, 1);               // right wall

      // ── Blocks ──

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          const bkx = BX0 + c * (BW + BPAD) + BW / 2;
          const bky = BY0 + r * (BH + BPAD) + BH / 2;
          const blk = rect(root, bkx, bky, BW, BH, COLORS[r], 2);
          const [isAlive] = blocks[idx];
          effect(() => setProp(blk, "visible", isAlive()));
        }
      }

      // ── Paddle ──

      const pad = rect(root, 0, PADDLE_Y, PADDLE_W, PADDLE_H, 0xf0f0f0, 3);
      effect(() => setProp(pad, "x", padX()));

      // ── Ball ──

      const ball = rect(root, 0, 0, BALL_R * 2, BALL_R * 2, 0xffffff, 4);
      effect(() => { setProp(ball, "x", bx()); setProp(ball, "y", by()); });

      // ── HUD ──

      const scoreTxt = label(root, 16, H - 20, "", 16, "#7fdbca", 5);
      setProp(scoreTxt, "origin", 0);
      effect(() => setProp(scoreTxt, "text", `SCORE  ${score()}`));

      const livesTxt = label(root, W - 16, H - 20, "", 16, "#f07167", 5);
      effect(() => {
        const txt = "♥".repeat(lives()) + "♡".repeat(Math.max(0, 3 - lives()));
        setProp(livesTxt, "text", txt);
        // Right-align
        const obj = livesTxt as Phaser.GameObjects.Text;
        setProp(livesTxt, "x", W - 16 - (obj.width || 0));
      });

      // ── Overlay ──

      const msg = label(root, W / 2, H / 2, "", 24, "#7fdbca", 10);
      const sub = label(root, W / 2, H / 2 + 36, "", 14, "#666", 10);

      effect(() => {
        const p = phase();
        const msgs: Record<string, [string, string, string]> = {
          ready: ["BREAKOUT", "#7fdbca", "click to launch"],
          miss:  ["MISS!", "#f07167", "click to continue"],
          over:  ["GAME OVER", "#f07167", `final score: ${score()} — click to restart`],
          win:   ["YOU WIN!", "#4ade80", `score: ${score()} — click to play again`],
          play:  ["", "", ""],
        };
        const [m, c, s] = msgs[p] ?? msgs.play;
        setProp(msg, "text", m); setProp(msg, "color", c);
        setProp(msg, "visible", p !== "play");
        setProp(sub, "text", s); setProp(sub, "visible", p !== "play");
      });

      // ── Input ──

      this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
        const px = Phaser.Math.Clamp(ptr.x, PADDLE_W / 2 + 4, W - PADDLE_W / 2 - 4);
        setPadX(px);
        if (phase() === "ready" || phase() === "miss") setBx(px);
      });

      this.input.on("pointerdown", () => {
        const p = phase();
        if (p === "ready" || p === "miss") launch();
        else if (p === "over" || p === "win") restart();
      });

      // ── Physics (registered as a frame callback → batch-synchronized) ──

      fm.register((_, delta) => {
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

        // Commit position
        batch(() => { setBx(x); setBy(y); });
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
  backgroundColor: "#0f1729",
  scene: BreakoutScene,
  banner: false,
});
