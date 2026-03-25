/**
 * Solidion Example: Aquarium (Hybrid ECS + Hooks)
 *
 * Interactive aquarium demonstrating the hybrid architecture:
 *  - ECS (createStore + System): Fish, Food, Bubbles, Fry — bulk entities with step functions
 *  - Hooks (unchanged): Jellyfish, Seaweed, Stats Panel, SceneEffects — few/unique entities
 *  - L0: JSX, <Show>, <GameLoop>, <Game> input
 *  - L2: <Preload> with fallback loading screen
 *  - L4: useScene (camera shake on fish spawn)
 */

import { createSignal, createRoot, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  Game, GameLoop, Show, Scene, Preload,
  useStateMachine, useSpring, useOscillation,
  SpringBehavior, useScene,
} from "solidion";
import {
  System, forActive,
  springStep, velocityStep, followStep, fsmSend,
  tweenStep, oscillationStep,
} from "solidion/ecs";
import type { FSMStateConfig } from "solidion/ecs";
import * as debug from "solidion/debug";
import Phaser from "phaser";

debug.enable();

const ASSETS = [
  "./assets/fish-red.png",
  "./assets/fish-teal.png",
  "./assets/fish-yellow.png",
  "./assets/jellyfish.png",
  "./assets/seaweed.png",
  "./assets/bubble.png",
  "./assets/food.png",
  "./assets/background.png",
];

const FISH_TEXTURES = ["./assets/fish-red.png", "./assets/fish-teal.png", "./assets/fish-yellow.png"];

// ── Constants ──
const W = 640, H = 480;
const SURFACE_Y = 30, FLOOR_Y = H - 30;
const TANK_L = 20, TANK_R = W - 20;
const MAX_FISH = 10, MAX_FOOD = 20, MAX_BUBBLES = 30, MAX_FRY = 5;
const FOOD_NEAR = 150, FOOD_EAT = 20;
const FISH_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xc084fc, 0xfb923c];

// ══════════════════════════════════════════════════
// ECS Store Types & Initialization
// ══════════════════════════════════════════════════

interface FishEntity {
  active: boolean; id: number;
  x: number; y: number; vx: number; vy: number;
  targetX: number; targetY: number;
  fsmState: string; fsmTimer: number; stateDuration: number;
  hunger: number;
  color: number; texture: string; size: number; dir: number; sleeping: boolean;
  popProgress: number; popActive: boolean;
  feedStep: number; feedTimer: number; eating: boolean;
}

interface FoodEntity {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
}

interface BubbleEntity {
  active: boolean;
  x: number; y: number; vx: number; vy: number;
  dia: number; wobblePhase: number; wobbleFreq: number;
}

interface FryEntity {
  active: boolean; parentSlot: number;
  x: number; y: number; color: number;
  offsetX: number; offsetY: number; speed: number;
}

const [fishStore, setFish] = createStore<FishEntity[]>(
  Array.from({ length: MAX_FISH }, (): FishEntity => ({
    active: false, id: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    targetX: 0, targetY: 0,
    fsmState: "idle", fsmTimer: 0, stateDuration: 3000,
    hunger: 0,
    color: FISH_COLORS[0], texture: FISH_TEXTURES[0], size: 1, dir: 1, sleeping: false,
    popProgress: 0, popActive: false,
    feedStep: 0, feedTimer: 0, eating: false,
  }))
);

const [foodStore, setFood] = createStore<FoodEntity[]>(
  Array.from({ length: MAX_FOOD }, (): FoodEntity => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0,
  }))
);

const [bubbleStore, setBubbles] = createStore<BubbleEntity[]>(
  Array.from({ length: MAX_BUBBLES }, (_, i): BubbleEntity => ({
    active: false, x: 0, y: 0, vx: 0, vy: 0,
    dia: 4, wobblePhase: i * 2.1, wobbleFreq: 1.5 + Math.random() * 0.5,
  }))
);

const [fryStore, setFry] = createStore<FryEntity[]>(
  Array.from({ length: MAX_FRY }, (): FryEntity => ({
    active: false, parentSlot: -1,
    x: W / 2, y: H / 2, color: FISH_COLORS[0],
    offsetX: 0, offsetY: 0, speed: 0.1,
  }))
);

let nextFishId = 1;

// ── Fish FSM Config (event transitions only; durations are per-entity) ──

const FISH_FSM_EVENTS: Record<string, FSMStateConfig> = {
  idle:  { on: { FOOD_NEARBY: "eat" } },
  swim:  { on: { FOOD_NEARBY: "eat", SLEEPY: "sleep" } },
  eat:   { },
  sleep: { on: { WAKE: "idle" } },
};

const FSM_NEXT: Record<string, string> = {
  idle: "swim", swim: "idle", eat: "idle", sleep: "idle",
};

const FEED_DURATIONS = [800, 400, 600]; // approach, munch, satisfied

function applyFishTransition(i: number, newState: string, prevState: string) {
  setFish(i, produce((d: FishEntity) => {
    // onExit
    if (prevState === "sleep") d.sleeping = false;
    // transition
    d.fsmState = newState;
    d.fsmTimer = 0;
    // onEnter
    switch (newState) {
      case "idle":
        d.targetX = d.x; d.targetY = d.y;
        d.stateDuration = 2000 + Math.random() * 2000;
        break;
      case "swim": {
        const tx = TANK_L + 40 + Math.random() * (TANK_R - TANK_L - 80);
        const ty = SURFACE_Y + 60 + Math.random() * (FLOOR_Y - SURFACE_Y - 120);
        d.targetX = tx; d.targetY = ty;
        d.dir = tx > d.x ? 1 : -1;
        d.stateDuration = 3000 + Math.random() * 3000;
        break;
      }
      case "eat":
        d.feedStep = 0; d.feedTimer = 0; d.eating = true;
        d.stateDuration = 2500;
        break;
      case "sleep":
        d.sleeping = true;
        d.targetX = d.x; d.targetY = FLOOR_Y - 50;
        d.stateDuration = 5000 + Math.random() * 3000;
        break;
    }
  }));
}

function sendFishEvent(i: number, event: string) {
  const f = fishStore[i];
  const r = fsmSend(f.fsmState, FISH_FSM_EVENTS, event);
  if (r.transitioned) applyFishTransition(i, r.state, f.fsmState);
}

function backEaseOut(t: number): number {
  const s = 1.70158;
  const t1 = t - 1;
  return 1 + (s + 1) * t1 * t1 * t1 + s * t1 * t1;
}

// Jellyfish tick functions and state (set by Jellyfish components)
const jellyTicks: ((d: number) => void)[] = [];
const jellyStartled: (() => boolean)[] = [];
let shakeCamera: (() => void) | null = null;

// ══════════════════════════════════════════════════
// Hooks-based Components (Jellyfish, Seaweed, SceneEffects)
// ══════════════════════════════════════════════════

function Jellyfish(props: { baseX: number; baseY: number }) {
  const [startled, setStartled] = createSignal(false);

  const drift = useOscillation({
    amplitude: { y: 30, x: 6 }, frequency: 0.08, phase: props.baseX * 0.01,
  });

  const pulse = useOscillation({
    amplitude: { x: 4, y: 3 }, frequency: 0.24, phase: props.baseX * 0.03,
  });

  const machine = useStateMachine<"drift" | "startled">({
    initial: "drift",
    states: {
      drift: { on: { STARTLE: "startled" } },
      startled: {
        duration: 800, onComplete: "drift",
        onEnter: () => setStartled(true), onExit: () => setStartled(false),
      },
    },
  });

  const tsway1 = useOscillation({ amplitude: { x: 2 }, frequency: 0.6, phase: 0 });
  const tsway2 = useOscillation({ amplitude: { x: 3 }, frequency: 0.5, phase: 1.2 });
  const tsway3 = useOscillation({ amplitude: { x: 2 }, frequency: 0.7, phase: 2.4 });

  const startle = () => machine.send("STARTLE");
  jellyTicks.push((d) => machine.tick(d));
  jellyStartled.push(startled);

  const jx = () => props.baseX + (startled() ? 0 : drift().x);
  const jy = () => props.baseY + (startled() ? -10 : drift().y);
  const bellW = () => startled() ? 24 : 30 + pulse().x;
  const bellH = () => startled() ? 18 : 24 + pulse().y;

  return (
    <>
      <ellipse x={jx()} y={jy()} width={bellW()} height={bellH()}
        fillColor={0xcc88ff} origin={0.5} depth={8}
        alpha={startled() ? 0.4 : 0.6} onClick={startle} />
      <rectangle x={jx() - 6 + tsway1().x} y={jy() + bellH() / 2 + 2} width={2} height={16}
        fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
      <rectangle x={jx() + tsway2().x} y={jy() + bellH() / 2 + 3} width={2} height={20}
        fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
      <rectangle x={jx() + 6 + tsway3().x} y={jy() + bellH() / 2 + 2} width={2} height={16}
        fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
    </>
  );
}

function Seaweed(props: { x: number; height: number; index: number }) {
  const sway = useOscillation({
    amplitude: { x: 8 }, frequency: 0.3 + props.index * 0.08, phase: props.index * 1.2,
  });
  const h = props.height;
  const sx = () => props.x + sway().x;

  return (
    <>
      <rectangle x={sx()} y={FLOOR_Y - h / 2} width={6} height={h}
        fillColor={0x2d8b46} origin={0.5} depth={2} alpha={0.7} />
      <rectangle x={sx() + 8} y={FLOOR_Y - h * 0.3} width={5} height={h * 0.6}
        fillColor={0x3aad5c} origin={0.5} depth={2} alpha={0.5} />
    </>
  );
}

function SceneEffects() {
  const scene = useScene();
  shakeCamera = () => scene.cameras.main.shake(120, 0.005);
  return null;
}

// ══════════════════════════════════════════════════
// ECS Renderers (read from stores)
// ══════════════════════════════════════════════════

function FishRenderer(props: { onSelect: (s: number) => void }) {
  return (
    <>
      {fishStore.map((f, i) => {
        const osc = () => {
          if (f.fsmState !== "idle" && f.fsmState !== "sleep") return 0;
          return oscillationStep(performance.now() / 1000, {
            amplitudeY: 3, frequency: 0.5, phase: i * 1.7,
          }).y;
        };
        const s = () => f.size * backEaseOut(f.popProgress);
        const fy = () => Phaser.Math.Clamp(f.y + osc(), SURFACE_Y + 30, FLOOR_Y - 20);
        const isMunching = () => f.eating && f.feedStep === 1;

        return (
          <Show when={f.active}>
            <rectangle x={f.x} y={fy()} width={40 * f.size} height={28 * f.size}
              fillColor={0x000000} origin={0.5} depth={13} alpha={0.001}
              onClick={() => props.onSelect(i)} />
            <sprite x={f.x} y={fy()} texture={f.texture}
              origin={0.5} depth={10}
              scaleX={f.dir * s() * 2} scaleY={s() * 2}
              alpha={f.sleeping ? 0.5 : 1} />
            <ellipse x={f.x + f.dir * 8 * s()} y={fy() - 2 * s()}
              width={5 * s()}
              height={(f.sleeping || isMunching()) ? 1 * s() : 5 * s()}
              fillColor={0xffffff} origin={0.5} depth={11} />
            <ellipse x={f.x + f.dir * 9 * s()} y={fy() - 2 * s()}
              width={2.5 * s()}
              height={(f.sleeping || isMunching()) ? 0.5 * s() : 2.5 * s()}
              fillColor={0x111111} origin={0.5} depth={12} />
          </Show>
        );
      })}
    </>
  );
}

function FoodRenderer() {
  return (
    <>
      {foodStore.map((f) => (
        <ellipse x={f.x} y={f.y} width={6} height={6}
          fillColor={0xddaa44} origin={0.5} depth={3} visible={f.active} />
      ))}
    </>
  );
}

function BubbleRenderer() {
  return (
    <>
      {bubbleStore.map((b) => {
        const wobbleX = () => oscillationStep(performance.now() / 1000, {
          amplitudeX: 3, frequency: b.wobbleFreq, phase: b.wobblePhase,
        }).x;
        return (
          <ellipse x={b.x + wobbleX()} y={b.y} width={b.dia} height={b.dia}
            fillColor={0x88ccee} origin={0.5} depth={4} alpha={0.6} visible={b.active} />
        );
      })}
    </>
  );
}

function FryRenderer() {
  return (
    <>
      {fryStore.map((f) => (
        <Show when={f.active}>
          <ellipse x={f.x} y={f.y} width={12} height={7}
            fillColor={f.color} origin={0.5} depth={10} alpha={0.7} />
          <ellipse x={f.x + 3} y={f.y - 1} width={2} height={2}
            fillColor={0xffffff} origin={0.5} depth={11} />
        </Show>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════
// App
// ══════════════════════════════════════════════════

function App() {
  const [phase, setPhase] = createSignal<"title" | "aquarium">("title");
  const [fishCount, setFishCount] = createSignal(0);
  const [selIdx, setSelIdx] = createSignal(-1);
  const [showPanel, setShowPanel] = createSignal(false);
  const [debugInfo, setDebugInfo] = createSignal("");
  let initialized = false, debugTimer = 0;

  const isAquarium = () => phase() === "aquarium";

  // ── Spawn / Release / Food ──

  function spawnFish() {
    const s = fishStore.findIndex(f => !f.active);
    if (s < 0) return;
    const ti = Math.floor(Math.random() * FISH_TEXTURES.length);
    const sx = TANK_L + 60 + Math.random() * (TANK_R - TANK_L - 120);
    const sy = SURFACE_Y + 80 + Math.random() * (FLOOR_Y - SURFACE_Y - 160);
    setFish(s, {
      active: true, id: nextFishId++,
      x: sx, y: sy, vx: 0, vy: 0,
      targetX: sx, targetY: sy,
      fsmState: "idle", fsmTimer: 0,
      stateDuration: 2000 + Math.random() * 2000,
      hunger: 0,
      color: FISH_COLORS[ti], texture: FISH_TEXTURES[ti],
      size: 0.8 + Math.random() * 0.4, dir: 1, sleeping: false,
      popProgress: 0, popActive: true,
      feedStep: 0, feedTimer: 0, eating: false,
    });
    setFishCount(c => c + 1);
    shakeCamera?.();

    if (Math.random() < 0.2) {
      const fj = fryStore.findIndex(f => !f.active);
      if (fj >= 0) {
        setFry(fj, {
          active: true, parentSlot: s,
          x: sx, y: sy, color: FISH_COLORS[ti],
          offsetX: (fj % 2 === 0 ? -1 : 1) * (12 + fj * 4),
          offsetY: 8 + fj * 3,
          speed: 0.08 + fj * 0.02,
        });
      }
    }
  }

  const releaseFish = () => {
    const idx = selIdx();
    if (idx < 0) return;
    setFish(idx, "active", false);
    for (let j = 0; j < MAX_FRY; j++) {
      if (fryStore[j].parentSlot === idx) setFry(j, "active", false);
    }
    setSelIdx(-1); setShowPanel(false); setFishCount(c => c - 1);
  };

  const handlePointerDown = (ptr: Phaser.Input.Pointer) => {
    if (phase() === "title") {
      setPhase("aquarium");
      if (!initialized) { initialized = true; spawnFish(); spawnFish(); spawnFish(); }
      return;
    }
    if (ptr.x > W - 120 && ptr.y < 35) return;
    if (selIdx() >= 0 && ptr.x > W - 160 && ptr.y > H / 2 - 100 && ptr.y < H / 2 + 100) return;
    if (ptr.y < SURFACE_Y + 10 || ptr.y > FLOOR_Y) return;
    if (ptr.x < TANK_L || ptr.x > TANK_R) return;

    const s = foodStore.findIndex(f => !f.active);
    if (s >= 0) setFood(s, { active: true, x: ptr.x, y: ptr.y, vx: 0, vy: 18 });
  };

  const selectFish = (s: number) => { setSelIdx(s); setShowPanel(true); };

  // ── System update functions ──

  const fishFSMUpdate = (_t: number, delta: number) => {
    forActive(fishStore, (f, i) => {
      const newTimer = f.fsmTimer + delta;
      if (newTimer >= f.stateDuration) {
        applyFishTransition(i, FSM_NEXT[f.fsmState] ?? "idle", f.fsmState);
      } else {
        setFish(i, "fsmTimer", newTimer);
      }
    });
  };

  const fishHungerUpdate = (_t: number, delta: number) => {
    forActive(fishStore, (f, i) => {
      const newHunger = f.hunger + delta * 0.003;
      setFish(i, "hunger", newHunger);
      if (newHunger > 100 && f.fsmState === "swim" && Math.random() < 0.001) {
        sendFishEvent(i, "SLEEPY");
      }
    });
  };

  const fishFoodOverlapUpdate = () => {
    batch(() => {
      for (let i = 0; i < MAX_FISH; i++) {
        const f = fishStore[i];
        if (!f.active) continue;
        let nearestJ = -1, nearestDist = Infinity;
        for (let j = 0; j < MAX_FOOD; j++) {
          const fd = foodStore[j];
          if (!fd.active) continue;
          const dx = fd.x - f.x, dy = fd.y - f.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < FOOD_NEAR && dist < nearestDist) {
            nearestDist = dist; nearestJ = j;
          }
        }
        if (nearestJ < 0) continue;
        if (f.fsmState === "eat" && nearestDist < FOOD_EAT) {
          setFood(nearestJ, "active", false);
          setFish(i, "hunger", 0);
        } else if ((f.fsmState === "idle" || f.fsmState === "swim") && f.hunger > 30) {
          const fd = foodStore[nearestJ];
          setFish(i, produce((d: FishEntity) => {
            d.targetX = fd.x; d.targetY = fd.y;
            d.dir = fd.x > d.x ? 1 : -1;
          }));
          sendFishEvent(i, "FOOD_NEARBY");
        }
      }
    });
  };

  const fishSpringUpdate = (_t: number, delta: number) => {
    const dt = Math.min(delta / 1000, 0.05);
    forActive(fishStore, (f, i) => {
      const next = springStep(
        { x: f.x, y: f.y, vx: f.vx, vy: f.vy },
        { targetX: f.targetX, targetY: f.targetY, stiffness: 15, damping: 8 },
        dt
      );
      setFish(i, {
        x: Phaser.Math.Clamp(next.x, TANK_L + 20, TANK_R - 20),
        y: Phaser.Math.Clamp(next.y, SURFACE_Y + 30, FLOOR_Y - 20),
        vx: next.vx, vy: next.vy,
      });
    });
  };

  const fishFeedUpdate = (_t: number, delta: number) => {
    forActive(fishStore, (f, i) => {
      if (!f.eating) return;
      const newTimer = f.feedTimer + delta;
      if (newTimer >= FEED_DURATIONS[f.feedStep]) {
        const nextStep = f.feedStep + 1;
        if (nextStep >= 3) {
          setFish(i, { eating: false, feedStep: 0, feedTimer: 0 });
        } else {
          setFish(i, { feedStep: nextStep, feedTimer: 0 });
        }
      } else {
        setFish(i, "feedTimer", newTimer);
      }
    });
  };

  const fishPopUpdate = (_t: number, delta: number) => {
    forActive(fishStore, (f, i) => {
      if (!f.popActive) return;
      const next = tweenStep(
        { progress: f.popProgress, active: true, direction: 1 },
        { duration: 400 },
        delta
      );
      setFish(i, { popProgress: next.progress, popActive: next.active });
    });
  };

  const foodVelocityUpdate = (_t: number, delta: number) => {
    const dt = Math.min(delta / 1000, 0.05);
    forActive(foodStore, (f, i) => {
      const next = velocityStep(
        { x: f.x, y: f.y, vx: f.vx, vy: f.vy },
        { boundsY: [SURFACE_Y, FLOOR_Y] },
        dt
      );
      if (next.y >= FLOOR_Y - 1) {
        setFood(i, "active", false);
      } else {
        setFood(i, { x: next.x, y: next.y, vx: next.vx, vy: next.vy });
      }
    });
  };

  const bubbleVelocityUpdate = (_t: number, delta: number) => {
    const dt = Math.min(delta / 1000, 0.05);
    forActive(bubbleStore, (b, i) => {
      const next = velocityStep(
        { x: b.x, y: b.y, vx: b.vx, vy: b.vy },
        { boundsY: [SURFACE_Y, FLOOR_Y] },
        dt
      );
      if (next.y <= SURFACE_Y + 1) {
        setBubbles(i, "active", false);
      } else {
        setBubbles(i, { x: next.x, y: next.y, vx: next.vx, vy: next.vy });
      }
    });
  };

  let bubbleTimer = 0;
  const bubbleSpawnUpdate = (_t: number, delta: number) => {
    bubbleTimer -= delta;
    if (bubbleTimer <= 0) {
      bubbleTimer = 200 + Math.random() * 500;
      const s = bubbleStore.findIndex(b => !b.active);
      if (s >= 0) {
        setBubbles(s, {
          active: true,
          x: TANK_L + 20 + Math.random() * (TANK_R - TANK_L - 40),
          y: FLOOR_Y - 10,
          vx: 0, vy: -(30 + Math.random() * 60),
          dia: 3 + Math.random() * 4,
        });
      }
    }
  };

  const fryFollowUpdate = (_t: number, delta: number) => {
    const dt = Math.min(delta / 1000, 0.05);
    forActive(fryStore, (f, j) => {
      const pi = f.parentSlot;
      const parent = (pi >= 0 && fishStore[pi].active) ? fishStore[pi] : { x: W / 2, y: H / 2 };
      const next = followStep(
        f.x, f.y,
        { targetX: parent.x + f.offsetX, targetY: parent.y + f.offsetY, speed: f.speed },
        dt
      );
      setFry(j, { x: next.x, y: next.y });
    });
  };

  // ── Minimal GameLoop (jellyfish ticks + debug profiler) ──

  const handleUpdate = (_t: number, delta: number) => {
    if (!isAquarium()) {
      debug.expose({ phase: phase(), fishCount: fishCount(), foodCount: 0 });
      return;
    }

    for (const jt of jellyTicks) jt(delta);

    debugTimer -= delta;
    if (debugTimer <= 0) {
      debugTimer = 500;
      const p = debug.getFrameProfile();
      setDebugInfo(`props/f: ${p.setPropertyCalls}  ${p.frameTimeMs.toFixed(1)}ms`);
      debug.expose({
        phase: phase(),
        fishCount: fishCount(),
        foodCount: foodStore.filter(f => f.active).length,
        bubbleCount: bubbleStore.filter(b => b.active).length,
        fryCount: fryStore.filter(f => f.active).length,
        selIdx: selIdx(),
        showPanel: showPanel(),
        fishPositions: fishStore.filter(f => f.active).map(f => ({ x: f.x, y: f.y })),
        fishStates: fishStore.filter(f => f.active).map(f => f.fsmState),
        fishHungers: fishStore.filter(f => f.active).map(f => f.hunger),
        fishEating: fishStore.filter(f => f.active).map(f => f.eating),
        jellyStartled: jellyStartled.map(s => s()),
      });
    }
  };

  const sel = () => selIdx() >= 0 ? fishStore[selIdx()] : null;

  return (
    <Game width={W} height={H} backgroundColor={0x0a1a2e} parent="game-container"
      onPointerDown={handlePointerDown}>
      <GameLoop onUpdate={handleUpdate} />

      {/* Title Screen */}
      <Show when={phase() === "title"}>
        <rectangle x={W / 2} y={H / 2} width={W} height={H}
          fillColor={0x0a1a2e} origin={0.5} depth={100} />
        <text x={W / 2} y={H / 2 - 40} text="Solidion Aquarium"
          fontSize={36} fontFamily="Georgia, serif" color="#4488cc" origin={0.5} depth={101} />
        <text x={W / 2} y={H / 2 + 20} text="tap to start"
          fontSize={16} fontFamily="monospace" color="#336688" origin={0.5} depth={101} />
        <ellipse x={W / 2} y={H / 2 + 80} width={32} height={18}
          fillColor={0x4ecdc4} origin={0.5} depth={101} alpha={0.6} />
        <rectangle x={W / 2 - 18} y={H / 2 + 80} width={10} height={12}
          fillColor={0x4ecdc4} origin={0.5} depth={101} alpha={0.5} />
      </Show>

      {/* Aquarium scene with Preload */}
      <Show when={isAquarium()}>
        <Scene name="aquarium">
          <Preload
        assets={ASSETS}
        fallback={
          <>
            <rectangle x={W / 2} y={H / 2} width={W} height={H}
              fillColor={0x0a1a2e} origin={0.5} depth={50} />
            <text x={W / 2} y={H / 2 - 10} text="Loading aquarium..."
              fontSize={16} fontFamily="monospace" color="#336688" origin={0.5} depth={51} />
            <ellipse x={W / 2} y={H / 2 + 30} width={20} height={12}
              fillColor={0x4ecdc4} origin={0.5} depth={51} alpha={0.5} />
          </>
        }
      >

      <SceneEffects />

      {/* ── ECS Systems (execution order = JSX order) ── */}
      <System update={fishFSMUpdate} />
      <System update={fishHungerUpdate} />
      <System update={fishFoodOverlapUpdate} />
      <System update={fishSpringUpdate} />
      <System update={fishFeedUpdate} />
      <System update={fishPopUpdate} />
      <System update={foodVelocityUpdate} />
      <System update={bubbleVelocityUpdate} />
      <System update={bubbleSpawnUpdate} />
      <System update={fryFollowUpdate} />

      {/* Tank */}
      <rectangle x={W / 2} y={SURFACE_Y + (FLOOR_Y - SURFACE_Y) / 2}
        width={W - 40} height={FLOOR_Y - SURFACE_Y}
        fillColor={0x0e2040} origin={0.5} depth={0} alpha={0.5} />
      <rectangle x={W / 2} y={FLOOR_Y + 15} width={W - 40} height={30}
        fillColor={0x8b7355} origin={0.5} depth={1} />
      <rectangle x={W / 2} y={SURFACE_Y} width={W - 40} height={2}
        fillColor={0x4488aa} origin={0.5} depth={5} alpha={0.5} />

      {/* Seaweed — hooks */}
      {[{ x: 80, h: 40 }, { x: 200, h: 55 }, { x: 350, h: 70 }, { x: 500, h: 85 }, { x: 580, h: 60 }]
        .map((sw, i) => <Seaweed x={sw.x} height={sw.h} index={i} />)}

      {/* Jellyfish — hooks */}
      <Jellyfish baseX={520} baseY={150} />
      <Jellyfish baseX={120} baseY={200} />

      {/* ECS Renderers */}
      <BubbleRenderer />
      <FoodRenderer />
      <FishRenderer onSelect={selectFish} />
      <FryRenderer />

      {/* HUD */}
      <Show when={isAquarium()}>
        <rectangle x={W - 60} y={16} width={100} height={24}
          fillColor={0x225588} origin={0.5} depth={20} onClick={() => spawnFish()} />
        <text x={W - 60} y={16} text="+ Add Fish"
          fontSize={11} fontFamily="monospace" color="#aaccee" origin={0.5} depth={21} />
        <text x={20} y={16} text={`Fish: ${fishCount()}`}
          fontSize={12} fontFamily="monospace" color="#668899" originX={0} originY={0.5} depth={20} />
        <text x={20} y={H - 10} text={debugInfo()}
          fontSize={9} fontFamily="monospace" color="#334455" originX={0} originY={0.5} depth={20} />
      </Show>

      {/* Stats Panel — hooks-based (useSpring + SpringBehavior) */}
      {(() => {
        const panelTarget = () => ({ x: showPanel() && selIdx() >= 0 ? W - 80 : W + 100, y: H / 2 });
        const panelPos = useSpring({ target: panelTarget, stiffness: 80, damping: 14, initial: { x: W + 100, y: H / 2 } });
        const px = () => panelPos().x;
        const pv = () => px() < W;
        let titleRef: any = null;
        return (
          <>
            <rectangle x={px()} y={H / 2} width={140} height={180}
              fillColor={0x112233} origin={0.5} depth={30} alpha={0.9} visible={pv()} />
            <text x={px()} y={H / 2 - 60} text={`Fish #${sel()?.id ?? ""}`}
              fontSize={14} fontFamily="monospace" color="#88bbdd" origin={0.5} depth={31}
              visible={pv()} ref={(el: any) => { titleRef = el; }} />
            {titleRef && <SpringBehavior parent={titleRef}
              target={() => ({ x: 0, y: 0 })} stiffness={30} damping={3} />}
            <text x={px()} y={H / 2 - 30} text={`State: ${sel()?.fsmState ?? ""}`}
              fontSize={11} fontFamily="monospace" color="#668899" origin={0.5} depth={31} visible={pv()} />
            <text x={px()} y={H / 2 - 10} text={`Hunger: ${Math.floor(sel()?.hunger ?? 0)}`}
              fontSize={11} fontFamily="monospace" color="#668899" origin={0.5} depth={31} visible={pv()} />
            <rectangle x={px()} y={H / 2 + 30} width={80} height={24}
              fillColor={0x884444} origin={0.5} depth={31} onClick={releaseFish} visible={pv()} />
            <text x={px()} y={H / 2 + 30} text="Release"
              fontSize={11} fontFamily="monospace" color="#ffaaaa" origin={0.5} depth={32} visible={pv()} />
            <rectangle x={px()} y={H / 2 + 60} width={80} height={24}
              fillColor={0x444466} origin={0.5} depth={31}
              onClick={() => { setSelIdx(-1); setShowPanel(false); }} visible={pv()} />
            <text x={px()} y={H / 2 + 60} text="Close"
              fontSize={11} fontFamily="monospace" color="#aaaacc" origin={0.5} depth={32} visible={pv()} />
          </>
        );
      })()}

          </Preload>
        </Scene>
      </Show>
    </Game>
  );
}

// ── Mount ──
createRoot(() => {
  const el = App();
  if (el instanceof HTMLElement) document.getElementById("game-container")?.appendChild(el);
});
