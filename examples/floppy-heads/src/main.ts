/**
 * Solidion Example: Floppy Heads
 *
 * A Flappy Bird-style game where a floppy disk navigates through
 * gaps between drive read/write heads.
 *
 * Demonstrates:
 *  - Gravity physics via frame callback + velocity signal
 *  - Dynamic obstacle spawning/recycling with reactive signals
 *  - Scroll-based world movement (heads scroll left)
 *  - Multi-rectangle composite visuals (floppy disk, drive heads)
 *  - State machine: ready → play → dead → ready
 */

import Phaser from "phaser";
import { createRoot, createSignal, batch } from "solid-js";
import { createElement, insert, setProp, effect } from "solidion/renderer";
import { getMeta } from "solidion/core/meta";
import { pushScene } from "solidion/core/scene-stack";
import { createFrameManager } from "solidion/core/frame";
import { solidionFrameUpdate } from "solidion/core/sync";

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
// Helpers
// ============================================================

function rect(
  root: any,
  x: number, y: number, w: number, h: number,
  color: number, depth: number, originX = 0.5, originY = 0.5
) {
  const r = createElement("rectangle");
  setProp(r, "x", x); setProp(r, "y", y);
  setProp(r, "width", w); setProp(r, "height", h);
  setProp(r, "fillColor", color);
  setProp(r, "originX", originX); setProp(r, "originY", originY);
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
// Head pair (top + bottom obstacle)
// ============================================================

interface HeadPair {
  topArm: any;
  topTip: any;
  botArm: any;
  botTip: any;
  x: number;       // current x position (mutable)
  gapY: number;    // center of gap
  scored: boolean;  // already counted
  active: boolean;  // on screen
}

function createHeadPair(root: any): HeadPair {
  const topArm = rect(root, 0, 0, HEAD_W, H, COL_HEAD_ARM, 3, 0.5, 1);
  const topTip = rect(root, 0, 0, HEAD_W + 8, 16, COL_HEAD_TIP, 4, 0.5, 1);
  const botArm = rect(root, 0, 0, HEAD_W, H, COL_HEAD_ARM, 3, 0.5, 0);
  const botTip = rect(root, 0, 0, HEAD_W + 8, 16, COL_HEAD_TIP, 4, 0.5, 0);
  return { topArm, topTip, botArm, botTip, x: -100, gapY: 300, scored: false, active: false };
}

function positionHeadPair(hp: HeadPair) {
  const topY = hp.gapY - GAP / 2;
  const botY = hp.gapY + GAP / 2;
  setProp(hp.topArm, "x", hp.x); setProp(hp.topArm, "y", topY);
  setProp(hp.topTip, "x", hp.x); setProp(hp.topTip, "y", topY);
  setProp(hp.botArm, "x", hp.x); setProp(hp.botArm, "y", botY);
  setProp(hp.botTip, "x", hp.x); setProp(hp.botTip, "y", botY);
}

function hideHeadPair(hp: HeadPair) {
  hp.active = false;
  hp.x = -100;
  positionHeadPair(hp);
}

// ============================================================
// Scene
// ============================================================

class FloppyHeadsScene extends Phaser.Scene {
  constructor() { super("floppy-heads"); }

  create() {
    pushScene(this);
    const fm = createFrameManager();
    const root = this.add.container(0, 0);
    getMeta(root);

    this.events.on("update", (time: number, delta: number) => {
      solidionFrameUpdate(fm, time, delta);
    });

    createRoot(() => {

      // ── State ──

      const [score, setScore] = createSignal(0);
      const [best, setBest] = createSignal(0);
      const [phase, setPhase] = createSignal<"ready" | "play" | "dead">("ready");
      const [diskY, setDiskY] = createSignal(H / 2.5);
      const [diskAngle, setDiskAngle] = createSignal(0);
      let vy = 0;

      // ── Background ──

      rect(root, W / 2, H / 2, W, H, COL_BG, 0);

      // Scrolling ground dots (decorative)
      const groundBg = rect(root, W / 2, GROUND_Y + GROUND_H / 2, W, GROUND_H, COL_GROUND, 6);
      const groundLine = rect(root, W / 2, GROUND_Y, W, 3, COL_GROUND_LINE, 7);

      // ── Head pairs (object pool) ──

      const heads: HeadPair[] = [];
      for (let i = 0; i < NUM_HEADS; i++) {
        const hp = createHeadPair(root);
        hideHeadPair(hp);
        heads.push(hp);
      }
      let nextSpawnX = HEAD_SPAWN_X;

      function resetHeads() {
        for (const hp of heads) hideHeadPair(hp);
        nextSpawnX = HEAD_SPAWN_X;
      }

      function spawnHead() {
        const inactive = heads.find(h => !h.active);
        if (!inactive) return;
        const minY = 80 + GAP / 2;
        const maxY = GROUND_Y - 20 - GAP / 2;
        inactive.gapY = minY + Math.random() * (maxY - minY);
        inactive.x = nextSpawnX;
        inactive.scored = false;
        inactive.active = true;
        positionHeadPair(inactive);
        nextSpawnX += HEAD_SPACING;
      }

      // ── Floppy disk (composite visual) ──

      // Body
      const diskBody = rect(root, DISK_X, 0, DISK_W, DISK_H, COL_DISK_BODY, 5);
      // Metal slider at top
      const diskMetal = rect(root, DISK_X, 0, DISK_W - 6, 8, COL_DISK_METAL, 5);
      // Label
      const diskLabel = rect(root, DISK_X, 0, DISK_W - 8, 14, COL_DISK_LABEL, 5);
      // Hub window
      const diskHub = rect(root, DISK_X, 0, 8, 8, COL_DISK_HUB, 5);

      function updateDiskVisuals(y: number, angle: number) {
        const rad = angle * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        setProp(diskBody, "x", DISK_X); setProp(diskBody, "y", y);
        setProp(diskBody, "angle", angle);

        // Offsets relative to disk center, rotated
        const metalOffy = -DISK_H / 2 + 4;
        setProp(diskMetal, "x", DISK_X + metalOffy * sin);
        setProp(diskMetal, "y", y + metalOffy * cos);
        setProp(diskMetal, "angle", angle);

        const labelOffy = 4;
        setProp(diskLabel, "x", DISK_X + labelOffy * sin);
        setProp(diskLabel, "y", y + labelOffy * cos);
        setProp(diskLabel, "angle", angle);

        const hubOffy = DISK_H / 2 - 8;
        setProp(diskHub, "x", DISK_X + hubOffy * sin);
        setProp(diskHub, "y", y + hubOffy * cos);
        setProp(diskHub, "angle", angle);
      }

      effect(() => updateDiskVisuals(diskY(), diskAngle()));

      // ── HUD ──

      const scoreTxt = label(root, W / 2, 50, "0", 48, "#e0e0ff", 10);
      effect(() => setProp(scoreTxt, "text", `${score()}`));
      effect(() => setProp(scoreTxt, "visible", phase() === "play"));

      // Overlay messages
      const msg = label(root, W / 2, H / 2 - 40, "", 28, "#e0e0ff", 10);
      const sub = label(root, W / 2, H / 2 + 10, "", 14, "#8888aa", 10);
      const bestTxt = label(root, W / 2, H / 2 + 40, "", 14, "#6a6a8a", 10);

      effect(() => {
        const p = phase();
        if (p === "ready") {
          setProp(msg, "text", "FLOPPY HEADS");
          setProp(msg, "color", "#e0e0ff");
          setProp(sub, "text", "click or press space to flap");
          setProp(bestTxt, "text", best() > 0 ? `best: ${best()}` : "");
          setProp(msg, "visible", true);
          setProp(sub, "visible", true);
          setProp(bestTxt, "visible", true);
        } else if (p === "dead") {
          setProp(msg, "text", "EJECT!");
          setProp(msg, "color", "#ff6666");
          setProp(sub, "text", `score: ${score()} — click to retry`);
          setProp(bestTxt, "text", `best: ${best()}`);
          setProp(msg, "visible", true);
          setProp(sub, "visible", true);
          setProp(bestTxt, "visible", true);
        } else {
          setProp(msg, "visible", false);
          setProp(sub, "visible", false);
          setProp(bestTxt, "visible", false);
        }
      });

      // ── Actions ──

      const flap = () => {
        if (phase() === "dead") return;
        if (phase() === "ready") {
          setPhase("play");
          resetHeads();
          // Spawn initial heads
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

      // ── Input ──

      this.input.on("pointerdown", () => {
        if (phase() === "dead") restart();
        else flap();
      });

      this.input.keyboard!.on("keydown-SPACE", () => {
        if (phase() === "dead") restart();
        else flap();
      });

      // ── Physics (frame callback) ──

      fm.register((_, delta) => {
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
        const angleLerp = vy > 0 ? 3 : 8; // tilt down slower, tilt up faster
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
        for (const hp of heads) {
          if (!hp.active) continue;
          hp.x -= scrollDx;
          positionHeadPair(hp);

          // Off screen left → deactivate
          if (hp.x < -HEAD_W) {
            hp.active = false;
            hp.x = -100;
            positionHeadPair(hp);
            // Spawn a new one
            spawnHead();
          }

          // Score: disk passed the head
          if (!hp.scored && hp.x + HEAD_W / 2 < DISK_X) {
            hp.scored = true;
            setScore(s => s + 1);
          }

          // Collision
          if (hp.active) {
            const diskLeft = DISK_X - DISK_W / 2 + 4; // small margin
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
          }
        }

        batch(() => { setDiskY(y); setDiskAngle(newAngle); });
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
  backgroundColor: "#1a1a2e",
  scene: FloppyHeadsScene,
  banner: false,
  input: {
    keyboard: true,
  },
});
