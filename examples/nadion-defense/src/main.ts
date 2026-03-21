/**
 * Solidion Example: Nadion Defense
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
 */

import Phaser from "phaser";
import { createRoot, createSignal, createMemo, batch } from "solid-js";
import { createRenderer } from "solid-js/universal";

// Solidion core
import { getMeta } from "solidion/core/meta";
import { isEventProp, resolveEventName } from "solidion/core/events";
import { applyProp } from "solidion/core/props";
import { createFrameManager } from "solidion/core/frame";
import { solidionFrameUpdate } from "solidion/core/sync";

// ============================================================
// Renderer
// ============================================================

let _scene: Phaser.Scene | null = null;

interface TN { __tn: true; value: string; parent: any }
function isTN(n: any): n is TN { return n?.__tn === true; }

const FAC: Record<string, (s: Phaser.Scene) => Phaser.GameObjects.GameObject> = {
  rectangle: (s) => new Phaser.GameObjects.Rectangle(s, 0, 0, 0, 0, 0xffffff),
  ellipse: (s) => new Phaser.GameObjects.Ellipse(s, 0, 0, 0, 0, 0xffffff),
  text: (s) => new Phaser.GameObjects.Text(s, 0, 0, "", {}),
  container: (s) => new Phaser.GameObjects.Container(s, 0, 0),
};

const { effect, createElement, insert, setProp } = createRenderer({
  createElement(type: string) {
    const f = FAC[type];
    if (!f) throw new Error(`Unknown element: ${type}`);
    const o = f(_scene!);
    getMeta(o);
    return o;
  },
  createTextNode(v: string) {
    return { __tn: true, value: v, parent: null } as any;
  },
  replaceText(n: any, v: string) {
    if (isTN(n)) { n.value = v; if (n.parent?.setText) n.parent.setText(v); }
  },
  setProperty(node: any, name: string, value: any) {
    if (isTN(node) || !node) return;
    if (name === "ref" || name === "children") return;
    if (isEventProp(name)) {
      const evt = resolveEventName(name);
      if (!evt) return;
      const m = getMeta(node);
      const prev = m.handlers.get(name);
      if (prev) node.off(evt, prev);
      if (value) {
        if (!node.input) node.setInteractive();
        node.on(evt, value);
        m.handlers.set(name, value);
      }
      return;
    }
    if (name === "texture" && typeof node.setTexture === "function") {
      node.setTexture(value);
      return;
    }
    applyProp(node, name, value);
  },
  insertNode(parent: any, node: any) {
    if (isTN(node)) { node.parent = parent; return; }
    if (!parent || !node) return;
    getMeta(parent).children.push(node);
    if (parent instanceof Phaser.GameObjects.Container) parent.add(node);
    else node.scene?.sys.displayList?.add(node);
  },
  removeNode(parent: any, node: any) {
    if (isTN(node)) { node.parent = null; return; }
    if (!parent || !node) return;
    const m = getMeta(parent);
    const i = m.children.indexOf(node);
    if (i >= 0) m.children.splice(i, 1);
    if (parent instanceof Phaser.GameObjects.Container) parent.remove(node);
    node.destroy();
  },
  getParentNode(n: any) { return isTN(n) ? n.parent : n?.parentContainer ?? null; },
  getFirstChild(n: any) { return isTN(n) ? null : getMeta(n).children[0] ?? null; },
  getNextSibling() { return null; },
  isTextNode: isTN,
});

// ============================================================
// Constants
// ============================================================

const W = 640, H = 540;

// LCARS layout
const LCARS_TOP = 42;     // height of top LCARS bar area
const PLAY_TOP = LCARS_TOP + 8;
const SB_W = 20;           // sidebar width
const SB_MARGIN = 10;      // gap between sidebar and play area
const PLAY_LEFT = SB_W + SB_MARGIN;               // left edge of play area (~30)
const PLAY_RIGHT = W - SB_W - SB_MARGIN;           // right edge of play area (~610)
const PLAY_W = PLAY_RIGHT - PLAY_LEFT;             // play area width
const PLAY_CX = (PLAY_LEFT + PLAY_RIGHT) / 2;     // play area center x

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

// ── LCARS Color Palette ──
// Based on the distinctive Star Trek computer interface
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

// Enemy row colors (LCARS palette)
const COL_ENEMY_ROWS = [
  0xcc99cc,  // row 0 — lavender
  0x9977aa,  // row 1 — purple
  0xff9966,  // row 2 — peach
  0xff9900,  // row 3 — orange
  0xcc6600,  // row 4 — amber
];
const POINTS_ROWS = [50, 40, 30, 20, 10];

// ============================================================
// Helpers
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

function circle(
  root: any,
  x: number, y: number, diameter: number,
  color: number, depth: number
) {
  const c = createElement("ellipse");
  setProp(c, "x", x); setProp(c, "y", y);
  setProp(c, "width", diameter); setProp(c, "height", diameter);
  setProp(c, "fillColor", color);
  setProp(c, "origin", 0.5);
  setProp(c, "depth", depth);
  insert(root, c);
  return c;
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
  setProp(t, "fontFamily", "'Arial Narrow', 'Helvetica Neue', Arial, sans-serif");
  setProp(t, "color", color);
  setProp(t, "origin", 0.5);
  setProp(t, "depth", depth);
  insert(root, t);
  return t;
}

// ============================================================
// Scene
// ============================================================

class NadionDefenseScene extends Phaser.Scene {
  constructor() { super("nadion-defense"); }

  create() {
    _scene = this;
    const fm = createFrameManager();
    const root = this.add.container(0, 0);
    getMeta(root);

    this.events.on("update", (time: number, delta: number) => {
      solidionFrameUpdate(fm, time, delta);
    });

    createRoot(() => {

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

      // ── Background ──

      rect(root, W / 2, H / 2, W, H, LCARS.bg, 0);

      // ── LCARS Frame ──
      // Built with pill shapes (rect + circle on each end) and clean rectangles.
      // No subtractive geometry — all additive.
      //
      // Layout:
      //   (●━━━━━━━━●)━ pill ━ text ━ pill ━ text ━ pill ━(●━━━━●)
      //        ┃
      //        ┃ sidebar (pill segments stacked vertically)
      //        ┃
      //   (●━━━━━━━━●)━━━━━━━━ bottom bar ━━━━━━━━━━━━━━━(●━━━━●)

      const SB_W = 20;       // sidebar width
      const TB = 10;          // thin bar height
      const CAP_W = 70;      // left cap width
      const CAP_H = LCARS_TOP;
      const END_W = 50;      // right end cap width
      const BOT_H = 14;      // bottom bar height

      // Helper: pill shape (horizontal bar with rounded ends)
      function pill(x: number, y: number, w: number, h: number, color: number, depth: number) {
        rect(root, x, y, w, h, color, depth);
        circle(root, x - w / 2, y, h, color, depth);
        circle(root, x + w / 2, y, h, color, depth);
      }

      // ── Left cap (tall, left edge off-screen for flush look) ──
      const capY = CAP_H / 2;
      // Cap sits at x=0..CAP_W, left circle extends off-screen
      rect(root, CAP_W / 2, capY, CAP_W, CAP_H, LCARS.lavender, 1);
      circle(root, 0, capY, CAP_H, LCARS.lavender, 1);

      // ── Right cap (tall, right edge off-screen) ──
      rect(root, W - CAP_W / 2, capY, CAP_W, CAP_H, LCARS.amber, 1);
      circle(root, W, capY, CAP_H, LCARS.amber, 1);

      // ── Left sidebar (flush to left edge, below cap) ──
      const lSideX = SB_W / 2;
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

      function drawSidebar(centerX: number, segments: typeof leftSegments) {
        for (const seg of segments) {
          if (seg.h > 0) {
            const cy = seg.y + seg.h / 2;
            rect(root, centerX, cy, SB_W, seg.h, seg.color, 1);
            circle(root, centerX, seg.y, SB_W, seg.color, 1);
            circle(root, centerX, seg.y + seg.h, SB_W, seg.color, 1);
          }
        }
      }

      drawSidebar(lSideX, leftSegments);

      // ── Right sidebar (flush to right edge) ──
      const rSideX = W - SB_W / 2;
      const rightSegments = [
        { y: sideTop,       h: 55,  color: LCARS.purple },
        { y: sideTop + 61,  h: 35,  color: LCARS.peach },
        { y: sideTop + 102, h: 45,  color: LCARS.orange },
        { y: sideTop + 155, h: 60,  color: LCARS.blue },
        { y: sideTop + 225, h: 40,  color: LCARS.lavender },
        { y: sideTop + 275, h: 50,  color: LCARS.amber },
        { y: sideTop + 335, h: sideBot - (sideTop + 335), color: LCARS.purple },
      ];
      drawSidebar(rSideX, rightSegments);

      // ── Top horizontal bars (pill segments with text gaps) ──
      const barStartX = PLAY_LEFT + 8;
      const barEndX = PLAY_RIGHT - 8;
      const barY = CAP_H - TB / 2 - 2;

      pill(barStartX + 14, barY, 28, TB, LCARS.orange, 1);
      pill(290, barY, 14, TB, LCARS.lavender, 1);
      pill(350, barY, 14, TB, LCARS.peach, 1);
      pill(barEndX - 14, barY, 28, TB, LCARS.lavender, 1);

      // ── Bottom left cap ──
      const botY = H - BOT_H / 2;
      rect(root, CAP_W / 2, botY, CAP_W, BOT_H, LCARS.purple, 1);
      circle(root, 0, botY, BOT_H, LCARS.purple, 1);

      // ── Bottom right cap ──
      rect(root, W - CAP_W / 2, botY, CAP_W, BOT_H, LCARS.orange, 1);
      circle(root, W, botY, BOT_H, LCARS.orange, 1);

      // ── Bottom horizontal bar ──
      const botBarW = barEndX - barStartX;
      pill(barStartX + botBarW / 2, botY, botBarW, TB, LCARS.amber, 1);

      // ── Enemies ──

      const enemies = Array.from({ length: ROWS * COLS }, () => createSignal(true));
      const enemyNodes: any[] = [];
      const alive = createMemo(() => enemies.filter(([g]) => g()).length);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          // Main body
          const body = rect(root, 0, 0, EN_W, EN_H, COL_ENEMY_ROWS[r], 3);
          // Side notch (LCARS-style cutout simulation)
          const notchL = rect(root, 0, 0, 4, EN_H - 6, 0x000000, 4);
          const notchR = rect(root, 0, 0, 4, EN_H - 6, 0x000000, 4);
          // Top accent bar
          const accent = rect(root, 0, 0, EN_W - 10, 3, 0xffffff, 4);
          setProp(accent, "alpha", 0.25);
          enemyNodes.push({ body, notchL, notchR, accent, row: r, col: c });
          const [isAlive] = enemies[idx];
          effect(() => {
            const v = isAlive();
            setProp(body, "visible", v);
            setProp(notchL, "visible", v);
            setProp(notchR, "visible", v);
            setProp(accent, "visible", v);
          });
        }
      }

      function getEnemyPos(r: number, c: number): [number, number] {
        const x = EN_X0 + c * (EN_W + EN_PAD) + EN_W / 2 + formOffX;
        const y = EN_Y0 + r * (EN_H + EN_PAD) + EN_H / 2 + formOffY;
        return [x, y];
      }

      function updateEnemyPositions() {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            const { body, notchL, notchR, accent } = enemyNodes[idx];
            const [x, y] = getEnemyPos(r, c);
            setProp(body, "x", x); setProp(body, "y", y);
            setProp(notchL, "x", x - EN_W / 2 + 2); setProp(notchL, "y", y);
            setProp(notchR, "x", x + EN_W / 2 - 2); setProp(notchR, "y", y);
            setProp(accent, "x", x); setProp(accent, "y", y - EN_H / 2 + 3);
          }
        }
      }

      updateEnemyPositions();

      // ── Player (phaser array) ──

      // Base platform
      const playerBase = rect(root, 0, PLAYER_Y, PLAYER_W, PLAYER_H, LCARS.orange, 5);
      // Emitter housing
      const playerHousing = rect(root, 0, PLAYER_Y - PLAYER_H / 2 - 2, 16, 6, LCARS.gold, 5);
      // Emitter tip
      const playerTip = rect(root, 0, PLAYER_Y - PLAYER_H / 2 - 5, 4, 4, 0xffffff, 6);
      // Side accents
      const playerAccL = rect(root, 0, PLAYER_Y, 4, PLAYER_H + 4, LCARS.amber, 5);
      const playerAccR = rect(root, 0, PLAYER_Y, 4, PLAYER_H + 4, LCARS.amber, 5);

      effect(() => {
        const x = playerX();
        setProp(playerBase, "x", x);
        setProp(playerHousing, "x", x);
        setProp(playerTip, "x", x);
        setProp(playerAccL, "x", x - PLAYER_W / 2 + 2);
        setProp(playerAccR, "x", x + PLAYER_W / 2 - 2);
      });

      // ── Shields (deflector fields) ──

      const shields: { outer: any; inner: any; hp: number }[] = [];
      const shieldSpacing = PLAY_W / (SHIELD_COUNT + 1);
      for (let i = 0; i < SHIELD_COUNT; i++) {
        const sx = PLAY_LEFT + shieldSpacing * (i + 1);
        const outer = rect(root, sx, SHIELD_Y, SHIELD_W, SHIELD_H, LCARS.blue, 2);
        setProp(outer, "alpha", 0.6);
        const inner = rect(root, sx, SHIELD_Y, SHIELD_W - 6, SHIELD_H - 6, LCARS.blueLight, 2);
        setProp(inner, "alpha", 0.3);
        shields.push({ outer, inner, hp: 4 });
      }

      function damageShield(idx: number) {
        const s = shields[idx];
        s.hp--;
        if (s.hp <= 0) {
          setProp(s.outer, "visible", false);
          setProp(s.inner, "visible", false);
        } else {
          setProp(s.outer, "alpha", 0.15 * s.hp);
          setProp(s.inner, "alpha", 0.08 * s.hp);
        }
      }

      function resetShields() {
        for (const s of shields) {
          s.hp = 4;
          setProp(s.outer, "visible", true);
          setProp(s.outer, "alpha", 0.6);
          setProp(s.inner, "visible", true);
          setProp(s.inner, "alpha", 0.3);
        }
      }

      // ── Projectiles ──

      interface Bolt {
        core: any;
        glow: any | null;   // only nadion bolts have glow
        x: number;
        y: number;
        vy: number;
        active: boolean;
        isPlayer: boolean;
      }

      const bolts: Bolt[] = [];
      const MAX_BOLTS = 24;

      for (let i = 0; i < MAX_BOLTS; i++) {
        // Glow layer (outer, semi-transparent orange)
        const glow = rect(root, -50, -50, NADION_GLOW_W, NADION_GLOW_H, LCARS.orange, 7);
        setProp(glow, "alpha", 0.45);
        setProp(glow, "visible", false);
        // Core layer (inner, bright white-yellow)
        const core = rect(root, -50, -50, NADION_CORE_W, NADION_CORE_H, 0xffffee, 8);
        setProp(core, "visible", false);
        bolts.push({ core, glow, x: -50, y: -50, vy: 0, active: false, isPlayer: true });
      }

      function fireBolt(x: number, y: number, vy: number, isPlayer: boolean) {
        const bolt = bolts.find(b => !b.active);
        if (!bolt) return;
        bolt.x = x; bolt.y = y; bolt.vy = vy;
        bolt.active = true; bolt.isPlayer = isPlayer;
        setProp(bolt.core, "x", x); setProp(bolt.core, "y", y);
        setProp(bolt.core, "visible", true);

        if (isPlayer) {
          // Nadion: 2-layer glow
          setProp(bolt.core, "fillColor", 0xffffee);
          setProp(bolt.core, "width", NADION_CORE_W);
          setProp(bolt.core, "height", NADION_CORE_H);
          setProp(bolt.glow!, "x", x); setProp(bolt.glow!, "y", y);
          setProp(bolt.glow!, "visible", true);
        } else {
          // Enemy bolt: single green rectangle, no glow
          setProp(bolt.core, "fillColor", LCARS.green);
          setProp(bolt.core, "width", ENEMY_BOLT_W);
          setProp(bolt.core, "height", ENEMY_BOLT_H);
          setProp(bolt.glow!, "visible", false);
        }
      }

      function deactivateBolt(bolt: Bolt) {
        bolt.active = false;
        setProp(bolt.core, "visible", false);
        if (bolt.glow) setProp(bolt.glow, "visible", false);
        bolt.x = -50; bolt.y = -50;
      }

      function clearBolts() {
        for (const b of bolts) deactivateBolt(b);
      }

      // ── HUD (LCARS style) ──

      // Score — positioned in the top bar gap
      // HUD text sits in the gaps between top bar pill segments
      const hudY = barY;

      const scoreLbl = label(root, 200, hudY, "", 14, "#ff9900", 10);
      effect(() => setProp(scoreLbl, "text", `SCORE ${String(score()).padStart(6, "0")}`));

      // Wave indicator — center gap
      const waveLbl = label(root, 320, hudY, "", 12, "#cc99cc", 10);
      effect(() => setProp(waveLbl, "text", `SEC ${wave()}`));

      // Lives — right gap
      const livesLbl = label(root, 440, hudY, "", 14, "#ff9900", 10);
      effect(() => setProp(livesLbl, "text", `ARRAYS ${"■ ".repeat(lives())}`));

      // ── Overlay ──

      const overlayBg = rect(root, W / 2, H / 2, 320, 120, 0x000000, 9);
      setProp(overlayBg, "alpha", 0.85);
      const overlayBorder = rect(root, W / 2, H / 2, 324, 124, LCARS.orange, 8);
      setProp(overlayBorder, "alpha", 0.5);

      const msg = label(root, W / 2, H / 2 - 18, "", 26, "#ff9900", 10);
      const sub = label(root, W / 2, H / 2 + 18, "", 13, "#cc99cc", 10);

      effect(() => {
        const p = phase();
        const show = p !== "play";
        setProp(overlayBg, "visible", show);
        setProp(overlayBorder, "visible", show);
        setProp(msg, "visible", show);
        setProp(sub, "visible", show);

        if (p === "ready") {
          setProp(msg, "text", "NADION DEFENSE");
          setProp(msg, "color", "#ff9900");
          setProp(sub, "text", "← → MOVE     SPACE FIRE");
        } else if (p === "dead") {
          setProp(msg, "text", "ARRAY OFFLINE");
          setProp(msg, "color", "#cc4444");
          setProp(sub, "text", `FINAL SCORE ${score()}  —  SPACE TO RETRY`);
        } else if (p === "win") {
          setProp(msg, "text", "SECTOR CLEAR");
          setProp(msg, "color", "#44cc88");
          setProp(sub, "text", `SCORE ${score()}  —  SPACE FOR NEXT WAVE`);
        }
      });

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

      // ── Input ──

      const kb = this.input.keyboard!;
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

      this.input.on("pointerdown", () => {
        const p = phase();
        if (p === "ready") { startGame(); return; }
        if (p === "dead") { startGame(); return; }
        if (p === "win") { nextWave(); return; }
        const now = performance.now();
        if (now - lastFireTime < FIRE_COOLDOWN) return;
        lastFireTime = now;
        fireBolt(playerX(), PLAYER_Y - PLAYER_H / 2 - 10, -BOLT_SPEED, true);
      });

      // ── Game loop ──

      fm.register((_, delta) => {
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
          bolt.y += bolt.vy * dt;

          if (bolt.y < -20 || bolt.y > H + 20) {
            deactivateBolt(bolt);
            continue;
          }

          setProp(bolt.core, "y", bolt.y);
          if (bolt.isPlayer && bolt.glow) {
            setProp(bolt.glow, "y", bolt.y);
          }

          if (bolt.isPlayer) {
            // Nadion vs enemies
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                const idx = r * COLS + c;
                if (!enemies[idx][0]()) continue;
                const [ex, ey] = getEnemyPos(r, c);
                if (
                  bolt.x > ex - EN_W / 2 && bolt.x < ex + EN_W / 2 &&
                  bolt.y > ey - EN_H / 2 && bolt.y < ey + EN_H / 2
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
              bolt.x > px - PLAYER_W / 2 && bolt.x < px + PLAYER_W / 2 &&
              bolt.y > PLAYER_Y - PLAYER_H / 2 && bolt.y < PLAYER_Y + PLAYER_H / 2
            ) {
              deactivateBolt(bolt);
              playerDie();
              if (phase() !== "play") return;
              continue;
            }

            // Enemy bolt vs shields
            for (let si = 0; si < shields.length; si++) {
              const s = shields[si];
              if (s.hp <= 0) continue;
              const sx = PLAY_LEFT + shieldSpacing * (si + 1);
              if (
                bolt.x > sx - SHIELD_W / 2 && bolt.x < sx + SHIELD_W / 2 &&
                bolt.y > SHIELD_Y - SHIELD_H / 2 && bolt.y < SHIELD_Y + SHIELD_H / 2
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
  scene: NadionDefenseScene,
  banner: false,
  input: {
    keyboard: true,
  },
});
