/**
 * Solidion Example: Aquarium (Reactive ECS — full utilization)
 *
 * Demonstrates every Reactive ECS primitive:
 *  - System + forActive: declarative frame loop with entity iteration
 *  - springStep: fish movement (damped spring)
 *  - oscillationStep: fish idle bob, seaweed sway, jellyfish drift/pulse/tentacles, bubble wobble
 *  - velocityStep: food sinking, bubble rising
 *  - followStep: fry following parent fish
 *  - fsmStep: fish AI, jellyfish startle (timer-based transitions)
 *  - fsmSend: FOOD_NEARBY, SLEEPY, STARTLE events (event-based transitions)
 *  - tweenStep / tweenLerp: fish pop-in animation
 *  - createStore: single source of truth for all entity state
 *
 * Hooks retained only where ECS is not applicable:
 *  - useSpring + SpringBehavior: stats panel slide animation (single unique UI)
 */

import { createSignal, createRoot } from "solid-js";
import { createStore } from "solid-js/store";
import { Game } from "solidion/components/Game";
import { Show } from "solidion/components/Show";
import { Scene } from "solidion/components/Scene";
import { Preload } from "solidion/components/Preload";
import { useSpring } from "solidion/hooks/useSpring";
import { SpringBehavior } from "solidion/behaviors";
import * as debug from "solidion/debug";
import {
  System, forActive,
  springStep, oscillationStep, velocityStep, followStep,
  fsmStep, fsmSend, tweenStep, tweenLerp,
  type FSMStateConfig,
} from "solidion/ecs";
import Phaser from "phaser";

debug.enable();

const ASSETS = [
  "/assets/fish-red.png", "/assets/fish-teal.png", "/assets/fish-yellow.png",
  "/assets/jellyfish.png", "/assets/seaweed.png", "/assets/bubble.png",
  "/assets/food.png", "/assets/background.png",
];
const FISH_TEXTURES = ["/assets/fish-red.png", "/assets/fish-teal.png", "/assets/fish-yellow.png"];

// ── Constants ──
const W = 640, H = 480;
const SURFACE_Y = 30, FLOOR_Y = H - 30;
const TANK_L = 20, TANK_R = W - 20;
const MAX_FISH = 10, MAX_FOOD = 20, MAX_BUBBLES = 30, MAX_FRY = 5;
const FOOD_NEAR_SQ = 150 * 150, FOOD_EAT_SQ = 20 * 20;
const FISH_COLORS = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xc084fc, 0xfb923c];

function easeBackOut(t: number): number {
  const s = 1.70158;
  const t1 = t - 1;
  return t1 * t1 * ((s + 1) * t1 + s) + 1;
}

// ── FSM config (single definition — used by both fsmStep and fsmSend) ──
const FISH_FSM: Record<string, FSMStateConfig> = {
  idle: { onComplete: "swim", on: { FOOD_NEARBY: "eat" } },
  swim: { onComplete: "idle", on: { FOOD_NEARBY: "eat", SLEEPY: "sleep" } },
  eat: { duration: 2500, onComplete: "idle" },
  sleep: { onComplete: "idle", on: { WAKE: "idle" } },
};

const JELLY_FSM: Record<string, FSMStateConfig> = {
  drift: { on: { STARTLE: "startled" } },
  startled: { duration: 800, onComplete: "drift" },
};

// ============================================================
// App
// ============================================================

function App() {
  const [phase, setPhase] = createSignal<"title" | "aquarium">("title");
  const [fishCount, setFishCount] = createSignal(0);
  const [selIdx, setSelIdx] = createSignal(-1);
  const [showPanel, setShowPanel] = createSignal(false);
  const [debugInfo, setDebugInfo] = createSignal("");
  let bubbleTimer = 0, initialized = false, debugTimer = 0, nextFishId = 1;

  // ── Store: single source of truth ──
  const [store, setStore] = createStore({
    time: 0,
    fish: Array.from({ length: MAX_FISH }, () => ({
      active: false, id: 0,
      springX: 0, springY: 0, vx: 0, vy: 0,
      targetX: W / 2, targetY: H / 2,
      x: 0, y: 0,
      state: "idle" as "idle" | "swim" | "eat" | "sleep",
      stateTimer: 0,
      idleDur: 3000, swimDur: 4500, sleepDur: 6500,
      hunger: 0, dir: 1,
      color: FISH_COLORS[0], tex: FISH_TEXTURES[0], sz: 1,
      popProgress: 1, popActive: false,
    })),
    food: Array.from({ length: MAX_FOOD }, () => ({
      active: false, x: 0, y: 0, vy: 18,
    })),
    bubbles: Array.from({ length: MAX_BUBBLES }, () => ({
      active: false, x: 0, y: 0, vy: 0, dia: 4, displayX: 0,
    })),
    fry: Array.from({ length: MAX_FRY }, () => ({
      active: false, parentIdx: -1, color: FISH_COLORS[0], x: W / 2, y: H / 2,
    })),
    jellyfish: [
      { active: true as const, baseX: 520, baseY: 150, state: "drift", stateTimer: 0, startled: false, pendingEvent: null as string | null },
      { active: true as const, baseX: 120, baseY: 200, state: "drift", stateTimer: 0, startled: false, pendingEvent: null as string | null },
    ],
  });

  // ── System update functions ──

  const playing = () => phase() === "aquarium";

  const fishPhysicsSystem = (time: number, delta: number) => {
    const dt = delta / 1000;
    const t = time / 1000;
    setStore("time", t);
    forActive(store.fish, (f, i) => {
      // Spring
      const next = springStep(
        { x: f.springX, y: f.springY, vx: f.vx, vy: f.vy },
        { targetX: f.targetX, targetY: f.targetY, stiffness: 15, damping: 8 }, dt,
      );
      const oscY = (f.state === "idle" || f.state === "sleep")
        ? oscillationStep(t, { amplitudeY: 3, frequency: 0.5, phase: i * 1.7 }).y : 0;
      // Pop-in tween
      let pop = f.popProgress;
      let popActive = f.popActive;
      if (popActive) {
        const tw = tweenStep({ progress: pop, active: true, direction: 1 }, { duration: 400 }, delta);
        pop = tw.progress; popActive = tw.active;
      }
      setStore("fish", i, {
        springX: next.x, springY: next.y, vx: next.vx, vy: next.vy,
        x: Phaser.Math.Clamp(next.x, TANK_L + 20, TANK_R - 20),
        y: Phaser.Math.Clamp(next.y + oscY, SURFACE_Y + 30, FLOOR_Y - 20),
        popProgress: pop, popActive,
      });
    });
  };

  const fishFSMSystem = (_t: number, delta: number) => {
    forActive(store.fish, (f, i) => {
      const cfg: Record<string, FSMStateConfig> = {
        ...FISH_FSM,
        idle: { ...FISH_FSM.idle, duration: f.idleDur },
        swim: { ...FISH_FSM.swim, duration: f.swimDur },
        sleep: { ...FISH_FSM.sleep, duration: f.sleepDur },
      };
      const result = fsmStep({ current: f.state, timer: f.stateTimer }, cfg, delta);
      if (result.transitioned) {
        const u: Record<string, any> = { state: result.state, stateTimer: 0 };
        if (result.state === "idle") {
          u.targetX = f.x; u.targetY = f.y;
        } else if (result.state === "swim") {
          const tx = TANK_L + 40 + Math.random() * (TANK_R - TANK_L - 80);
          const ty = SURFACE_Y + 60 + Math.random() * (FLOOR_Y - SURFACE_Y - 120);
          u.targetX = tx; u.targetY = ty; u.dir = tx > f.x ? 1 : -1;
        } else if (result.state === "sleep") {
          u.targetX = f.x; u.targetY = FLOOR_Y - 50;
        }
        setStore("fish", i, u);
      } else {
        setStore("fish", i, "stateTimer", result.timer);
      }
    });
  };

  const fishHungerSystem = (_t: number, delta: number) => {
    forActive(store.fish, (f, i) => {
      setStore("fish", i, "hunger", f.hunger + delta * 0.003);
      if (f.hunger > 100 && f.state === "swim" && Math.random() < 0.001) {
        const ev = fsmSend(f.state, FISH_FSM, "SLEEPY");
        if (ev.transitioned) {
          setStore("fish", i, {
            state: ev.state as any, stateTimer: 0,
            targetX: f.x, targetY: FLOOR_Y - 50,
          });
        }
      }
    });
  };

  const foodSystem = (_t: number, delta: number) => {
    const dt = delta / 1000;
    forActive(store.food, (f, i) => {
      const next = velocityStep(
        { x: f.x, y: f.y, vx: 0, vy: f.vy },
        { boundsY: [SURFACE_Y, FLOOR_Y] }, dt,
      );
      if (next.y >= FLOOR_Y - 1) setStore("food", i, "active", false);
      else setStore("food", i, { x: next.x, y: next.y });
    });
  };

  const bubbleSystem = (_t: number, delta: number) => {
    const dt = delta / 1000;
    const t = store.time;
    forActive(store.bubbles, (b, i) => {
      const next = velocityStep(
        { x: b.x, y: b.y, vx: 0, vy: b.vy },
        { boundsY: [SURFACE_Y, FLOOR_Y] }, dt,
      );
      if (next.y <= SURFACE_Y + 1) {
        setStore("bubbles", i, "active", false);
      } else {
        const wobble = oscillationStep(t, {
          amplitudeX: 3, frequency: 1.5 + (i % 5) * 0.1, phase: i * 2.1,
        });
        setStore("bubbles", i, { x: next.x, y: next.y, displayX: next.x + wobble.x });
      }
    });
  };

  const fryFollowSystem = (_t: number, delta: number) => {
    const dt = delta / 1000;
    forActive(store.fry, (fr, j) => {
      const pi = fr.parentIdx;
      const parent = (pi >= 0 && store.fish[pi].active)
        ? store.fish[pi] : { x: W / 2, y: H / 2 };
      const next = followStep(fr.x, fr.y, {
        targetX: parent.x + (j % 2 === 0 ? -1 : 1) * (12 + j * 4),
        targetY: parent.y + 8 + j * 3,
        speed: 0.08 + j * 0.02,
      }, dt);
      setStore("fry", j, { x: next.x, y: next.y });
    });
  };

  const fishFoodOverlapSystem = () => {
    forActive(store.fish, (f, fi) => {
      let nearestSq = FOOD_NEAR_SQ, nearestFd = -1;
      for (let fdi = 0; fdi < MAX_FOOD; fdi++) {
        const fd = store.food[fdi];
        if (!fd.active) continue;
        const sq = (f.x - fd.x) ** 2 + (f.y - fd.y) ** 2;
        if (sq < nearestSq) { nearestSq = sq; nearestFd = fdi; }
      }
      if (nearestFd < 0) return;
      if (f.state === "eat" && nearestSq < FOOD_EAT_SQ) {
        setStore("food", nearestFd, "active", false);
        setStore("fish", fi, "hunger", 0);
      } else if ((f.state === "idle" || f.state === "swim") && f.hunger > 30) {
        const ev = fsmSend(f.state, FISH_FSM, "FOOD_NEARBY");
        if (ev.transitioned) {
          const fd = store.food[nearestFd];
          setStore("fish", fi, {
            targetX: fd.x, targetY: fd.y, dir: fd.x > f.x ? 1 : -1,
            state: ev.state as any, stateTimer: 0,
          });
        }
      }
    });
  };

  const jellyfishFSMSystem = (_t: number, delta: number) => {
    forActive(store.jellyfish, (jf, i) => {
      if (jf.pendingEvent) {
        const ev = fsmSend(jf.state, JELLY_FSM, jf.pendingEvent);
        setStore("jellyfish", i, "pendingEvent", null);
        if (ev.transitioned) {
          setStore("jellyfish", i, { state: ev.state, stateTimer: 0, startled: true });
          return;
        }
      }
      const result = fsmStep({ current: jf.state, timer: jf.stateTimer }, JELLY_FSM, delta);
      if (result.transitioned) {
        setStore("jellyfish", i, { state: result.state, stateTimer: 0 });
        if (result.previous === "startled") setStore("jellyfish", i, "startled", false);
      } else {
        setStore("jellyfish", i, "stateTimer", result.timer);
      }
    });
  };

  const miscSystem = (_t: number, delta: number) => {
    bubbleTimer -= delta;
    if (bubbleTimer <= 0) {
      bubbleTimer = 200 + Math.random() * 500;
      const s = store.bubbles.findIndex(b => !b.active);
      if (s >= 0) {
        setStore("bubbles", s, {
          active: true,
          x: TANK_L + 20 + Math.random() * (TANK_R - TANK_L - 40),
          y: FLOOR_Y - 10, displayX: 0,
          vy: -(30 + Math.random() * 60),
          dia: 3 + Math.random() * 4,
        });
      }
    }
    debugTimer -= delta;
    if (debugTimer <= 0) {
      debugTimer = 500;
      const p = debug.getFrameProfile();
      setDebugInfo(`props/f: ${p.setPropertyCalls}  ${p.frameTimeMs.toFixed(1)}ms`);
    }
  };

  // ── Thin Renderers ──

  function Fish(props: { index: number; onSelect: (s: number) => void }) {
    const i = props.index;
    const f = () => store.fish[i];
    const s = () => f().sz * easeBackOut(tweenLerp(0, 1, f().popProgress));
    const asleep = () => f().state === "sleep";
    const munching = () => f().state === "eat" && f().stateTimer >= 800 && f().stateTimer < 1200;

    return (
      <Show when={f().active}>
        <rectangle x={f().x} y={f().y} width={40 * f().sz} height={28 * f().sz}
          fillColor={0x000000} origin={0.5} depth={13} alpha={0.001}
          onClick={() => props.onSelect(i)} />
        <sprite x={f().x} y={f().y} texture={f().tex}
          origin={0.5} depth={10}
          scaleX={f().dir * s() * 2} scaleY={s() * 2}
          alpha={asleep() ? 0.5 : 1} />
        <ellipse x={f().x + f().dir * 8 * s()} y={f().y - 2 * s()}
          width={5 * s()}
          height={(asleep() || munching()) ? 1 * s() : 5 * s()}
          fillColor={0xffffff} origin={0.5} depth={11} />
        <ellipse x={f().x + f().dir * 9 * s()} y={f().y - 2 * s()}
          width={2.5 * s()}
          height={(asleep() || munching()) ? 0.5 * s() : 2.5 * s()}
          fillColor={0x111111} origin={0.5} depth={12} />
      </Show>
    );
  }

  function FryRenderer(props: { index: number }) {
    const fr = () => store.fry[props.index];
    return (
      <Show when={fr().active}>
        <ellipse x={fr().x} y={fr().y} width={12} height={7}
          fillColor={fr().color} origin={0.5} depth={10} alpha={0.7} />
        <ellipse x={fr().x + 3} y={fr().y - 1} width={2} height={2}
          fillColor={0xffffff} origin={0.5} depth={11} />
      </Show>
    );
  }

  function JellyfishRenderer(props: { index: number }) {
    const jf = () => store.jellyfish[props.index];
    const t = () => store.time;
    const drift = () => oscillationStep(t(), {
      amplitudeY: 30, amplitudeX: 6, frequency: 0.08, phase: jf().baseX * 0.01,
    });
    const pulse = () => oscillationStep(t(), {
      amplitudeX: 4, amplitudeY: 3, frequency: 0.24, phase: jf().baseX * 0.03,
    });
    const tsway = (amp: number, freq: number, ph: number) =>
      oscillationStep(t(), { amplitudeX: amp, frequency: freq, phase: ph }).x;

    const jx = () => jf().baseX + (jf().startled ? 0 : drift().x);
    const jy = () => jf().baseY + (jf().startled ? -10 : drift().y);
    const bellW = () => jf().startled ? 24 : 30 + pulse().x;
    const bellH = () => jf().startled ? 18 : 24 + pulse().y;
    const startle = () => setStore("jellyfish", props.index, "pendingEvent", "STARTLE");

    return (
      <>
        <ellipse x={jx()} y={jy()} width={bellW()} height={bellH()}
          fillColor={0xcc88ff} origin={0.5} depth={8}
          alpha={jf().startled ? 0.4 : 0.6} onClick={startle} />
        <rectangle x={jx() - 6 + tsway(2, 0.6, 0)} y={jy() + bellH() / 2 + 2}
          width={2} height={16} fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
        <rectangle x={jx() + tsway(3, 0.5, 1.2)} y={jy() + bellH() / 2 + 3}
          width={2} height={20} fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
        <rectangle x={jx() + 6 + tsway(2, 0.7, 2.4)} y={jy() + bellH() / 2 + 2}
          width={2} height={16} fillColor={0xbb77ee} origin={0.5} depth={7} alpha={0.4} />
      </>
    );
  }

  function SeaweedRenderer(props: { x: number; height: number; index: number }) {
    const h = props.height;
    const sx = () => props.x + oscillationStep(store.time, {
      amplitudeX: 8, frequency: 0.3 + props.index * 0.08, phase: props.index * 1.2,
    }).x;

    return (
      <>
        <rectangle x={sx()} y={FLOOR_Y - h / 2} width={6} height={h}
          fillColor={0x2d8b46} origin={0.5} depth={2} alpha={0.7} />
        <rectangle x={sx() + 8} y={FLOOR_Y - h * 0.3} width={5} height={h * 0.6}
          fillColor={0x3aad5c} origin={0.5} depth={2} alpha={0.5} />
      </>
    );
  }

  function BubbleRenderer(props: { index: number }) {
    const b = () => store.bubbles[props.index];
    return (
      <ellipse x={b().displayX} y={b().y} width={b().dia} height={b().dia}
        fillColor={0x88ccee} origin={0.5} depth={4} alpha={0.6} visible={b().active} />
    );
  }

  function FoodRenderer(props: { index: number }) {
    const f = () => store.food[props.index];
    return (
      <ellipse x={f().x} y={f().y} width={6} height={6}
        fillColor={0xddaa44} origin={0.5} depth={3} visible={f().active} />
    );
  }

  // ── Actions ──

  function spawnFish() {
    const s = store.fish.findIndex(f => !f.active);
    if (s < 0) return;
    const ti = Math.floor(Math.random() * FISH_TEXTURES.length);
    const sx = TANK_L + 60 + Math.random() * (TANK_R - TANK_L - 120);
    const sy = SURFACE_Y + 80 + Math.random() * (FLOOR_Y - SURFACE_Y - 160);
    setStore("fish", s, {
      active: true, id: nextFishId++,
      springX: sx, springY: sy, vx: 0, vy: 0,
      targetX: sx, targetY: sy, x: sx, y: sy,
      state: "idle" as const, stateTimer: 0,
      idleDur: 2000 + Math.random() * 2000,
      swimDur: 3000 + Math.random() * 3000,
      sleepDur: 5000 + Math.random() * 3000,
      hunger: 0, dir: 1,
      color: FISH_COLORS[ti], tex: FISH_TEXTURES[ti],
      sz: 0.8 + Math.random() * 0.4,
      popProgress: 0, popActive: true,
    });
    setFishCount(c => c + 1);
    if (Math.random() < 0.2) {
      const fj = store.fry.findIndex(f => !f.active);
      if (fj >= 0) setStore("fry", fj, { active: true, parentIdx: s, color: FISH_COLORS[ti], x: sx, y: sy });
    }
  }

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
    const s = store.food.findIndex(f => !f.active);
    if (s >= 0) setStore("food", s, { active: true, x: ptr.x, y: ptr.y, vy: 18 });
  };

  const releaseFish = () => {
    const idx = selIdx();
    if (idx < 0) return;
    setStore("fish", idx, "active", false);
    for (let j = 0; j < MAX_FRY; j++) {
      if (store.fry[j].parentIdx === idx) setStore("fry", j, { active: false, parentIdx: -1 });
    }
    setSelIdx(-1); setShowPanel(false); setFishCount(c => c - 1);
  };

  const selectFish = (s: number) => { setSelIdx(s); setShowPanel(true); };
  const sel = () => selIdx() >= 0 ? store.fish[selIdx()] : null;

  // ── Render ──
  return (
    <Game width={W} height={H} backgroundColor={0x0a1a2e} parent="game-container"
      onPointerDown={handlePointerDown}>
      {/* Systems: JSX order = execution order */}
      <System update={fishPhysicsSystem} when={playing} />
      <System update={fishFSMSystem} when={playing} />
      <System update={fishHungerSystem} when={playing} />
      <System update={foodSystem} when={playing} />
      <System update={bubbleSystem} when={playing} />
      <System update={fryFollowSystem} when={playing} />
      <System update={fishFoodOverlapSystem} when={playing} />
      <System update={jellyfishFSMSystem} when={playing} />
      <System update={miscSystem} when={playing} />

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
      <Show when={phase() === "aquarium"}>
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

      {/* Tank */}
      <rectangle x={W / 2} y={SURFACE_Y + (FLOOR_Y - SURFACE_Y) / 2}
        width={W - 40} height={FLOOR_Y - SURFACE_Y}
        fillColor={0x0e2040} origin={0.5} depth={0} alpha={0.5} />
      <rectangle x={W / 2} y={FLOOR_Y + 15} width={W - 40} height={30}
        fillColor={0x8b7355} origin={0.5} depth={1} />
      <rectangle x={W / 2} y={SURFACE_Y} width={W - 40} height={2}
        fillColor={0x4488aa} origin={0.5} depth={5} alpha={0.5} />

      {/* Seaweed */}
      {[{ x: 80, h: 40 }, { x: 200, h: 55 }, { x: 350, h: 70 }, { x: 500, h: 85 }, { x: 580, h: 60 }]
        .map((sw, i) => <SeaweedRenderer x={sw.x} height={sw.h} index={i} />)}

      {/* Jellyfish */}
      {store.jellyfish.map((_, i) => <JellyfishRenderer index={i} />)}

      {/* Bubbles pool */}
      {Array.from({ length: MAX_BUBBLES }, (_, i) => <BubbleRenderer index={i} />)}

      {/* Food pool */}
      {Array.from({ length: MAX_FOOD }, (_, i) => <FoodRenderer index={i} />)}

      {/* Fish pool */}
      {Array.from({ length: MAX_FISH }, (_, i) => <Fish index={i} onSelect={selectFish} />)}

      {/* Fry pool */}
      {Array.from({ length: MAX_FRY }, (_, j) => <FryRenderer index={j} />)}

      {/* HUD */}
      <Show when={phase() === "aquarium"}>
        <rectangle x={W - 60} y={16} width={100} height={24}
          fillColor={0x225588} origin={0.5} depth={20} onClick={() => spawnFish()} />
        <text x={W - 60} y={16} text="+ Add Fish"
          fontSize={11} fontFamily="monospace" color="#aaccee" origin={0.5} depth={21} />
        <text x={20} y={16} text={`Fish: ${fishCount()}`}
          fontSize={12} fontFamily="monospace" color="#668899" originX={0} originY={0.5} depth={20} />
        <text x={20} y={H - 10} text={debugInfo()}
          fontSize={9} fontFamily="monospace" color="#334455" originX={0} originY={0.5} depth={20} />
      </Show>

      {/* Stats Panel (useSpring + SpringBehavior — single unique UI, hooks appropriate) */}
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
            <text x={px()} y={H / 2 - 30} text={`State: ${sel()?.state ?? ""}`}
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
