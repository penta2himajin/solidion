/**
 * Tests for Reactive ECS pattern.
 *
 * Three levels:
 * 1. Pure step functions (no Solid, no renderer — just math)
 * 2. Step functions + createStore (reactive updates)
 * 3. System composition (multiple systems, execution order, full loop)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, batch } from "solid-js";
import { createStore } from "solid-js/store";
import { effect } from "../src/renderer";
import { pushScene, popScene } from "../src/core/scene-stack";
import { createFrameManager } from "../src/core/frame";

import {
  springStep, type SpringState, type SpringConfig,
  oscillationStep,
  velocityStep,
  followStep,
  fsmStep, fsmSend, type FSMState, type FSMStateConfig,
  tweenStep, tweenLerp, type TweenState,
} from "../src/recs/steps";

import { createSystemFactory } from "../src/recs/systems";

const tick = () => new Promise<void>(r => setTimeout(r, 0));

const mockScene: any = {
  add: { rectangle: () => ({}) },
  sys: { displayList: { add: () => {} } },
};

// ============================================================
// 1. Pure step function tests
// ============================================================

describe("springStep", () => {
  it("moves toward target", () => {
    const state: SpringState = { x: 0, y: 0, vx: 0, vy: 0 };
    const config: SpringConfig = { targetX: 100, targetY: 0, stiffness: 100, damping: 10 };
    const next = springStep(state, config, 0.016);
    expect(next.x).toBeGreaterThan(0);
    expect(next.vx).toBeGreaterThan(0);
  });

  it("decelerates near target", () => {
    const state: SpringState = { x: 99, y: 0, vx: 50, vy: 0 };
    const config: SpringConfig = { targetX: 100, targetY: 0, stiffness: 100, damping: 20 };
    const next = springStep(state, config, 0.016);
    // Damping should slow velocity
    expect(Math.abs(next.vx)).toBeLessThan(50);
  });

  it("converges to target over multiple steps", () => {
    let state: SpringState = { x: 0, y: 0, vx: 0, vy: 0 };
    const config: SpringConfig = { targetX: 100, targetY: 50, stiffness: 60, damping: 12 };
    for (let i = 0; i < 300; i++) {
      state = springStep(state, config, 0.016);
    }
    expect(state.x).toBeCloseTo(100, 0);
    expect(state.y).toBeCloseTo(50, 0);
  });

  it("respects mass parameter", () => {
    const state: SpringState = { x: 0, y: 0, vx: 0, vy: 0 };
    const light = springStep(state, { targetX: 100, targetY: 0, stiffness: 100, damping: 10, mass: 1 }, 0.016);
    const heavy = springStep(state, { targetX: 100, targetY: 0, stiffness: 100, damping: 10, mass: 5 }, 0.016);
    expect(light.x).toBeGreaterThan(heavy.x);
  });
});

describe("oscillationStep", () => {
  it("returns zero at phase 0, frequency 1, time 0", () => {
    const result = oscillationStep(0, { frequency: 1, amplitudeX: 10 });
    expect(result.x).toBeCloseTo(0, 5);
  });

  it("returns peak amplitude at quarter period", () => {
    const result = oscillationStep(0.25, { frequency: 1, amplitudeX: 10, amplitudeY: 5 });
    expect(result.x).toBeCloseTo(10, 0);
    expect(result.y).toBeCloseTo(5, 0);
  });

  it("respects phase offset", () => {
    const a = oscillationStep(0, { frequency: 1, amplitudeX: 10, phase: 0 });
    const b = oscillationStep(0, { frequency: 1, amplitudeX: 10, phase: Math.PI / 2 });
    expect(a.x).toBeCloseTo(0, 5);
    expect(b.x).toBeCloseTo(10, 0);
  });

  it("defaults missing amplitudes to 0", () => {
    const result = oscillationStep(0.25, { frequency: 1 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});

describe("velocityStep", () => {
  it("advances position by velocity", () => {
    const result = velocityStep(
      { x: 0, y: 0, vx: 100, vy: -50 },
      {},
      0.016
    );
    expect(result.x).toBeCloseTo(1.6, 1);
    expect(result.y).toBeCloseTo(-0.8, 1);
  });

  it("applies acceleration", () => {
    const result = velocityStep(
      { x: 0, y: 0, vx: 0, vy: 0 },
      { ax: 0, ay: 500 },  // gravity
      0.016
    );
    expect(result.vy).toBeCloseTo(8, 0);
    expect(result.y).toBeGreaterThan(0);
  });

  it("clamps to bounds", () => {
    const result = velocityStep(
      { x: 0, y: 0, vx: -100, vy: 100 },
      { boundsX: [0, 640], boundsY: [0, 480] },
      1.0 // large dt to exceed bounds
    );
    expect(result.x).toBe(0);
    expect(result.y).toBe(100);
  });

  it("applies drag", () => {
    const result = velocityStep(
      { x: 0, y: 0, vx: 100, vy: 100 },
      { drag: 5 },
      0.016
    );
    expect(result.vx).toBeLessThan(100);
    expect(result.vy).toBeLessThan(100);
  });
});

describe("followStep", () => {
  it("moves toward target", () => {
    const result = followStep(0, 0, { targetX: 100, targetY: 50, speed: 0.1 }, 0.016);
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(100);
  });

  it("converges over time", () => {
    let x = 0, y = 0;
    for (let i = 0; i < 300; i++) {
      const r = followStep(x, y, { targetX: 100, targetY: 50, speed: 0.1 }, 0.016);
      x = r.x; y = r.y;
    }
    expect(x).toBeCloseTo(100, 0);
    expect(y).toBeCloseTo(50, 0);
  });

  it("higher speed converges faster", () => {
    const slow = followStep(0, 0, { targetX: 100, targetY: 0, speed: 0.1 }, 0.016);
    const fast = followStep(0, 0, { targetX: 100, targetY: 0, speed: 0.5 }, 0.016);
    expect(fast.x).toBeGreaterThan(slow.x);
  });

  it("speed >= 1 snaps instantly", () => {
    const result = followStep(0, 0, { targetX: 100, targetY: 50, speed: 1 }, 0.016);
    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
  });
});

describe("fsmStep", () => {
  const states: Record<string, FSMStateConfig> = {
    idle: { duration: 1000, onComplete: "walk", on: { RUN: "run" } },
    walk: { duration: 2000, onComplete: "idle" },
    run: { on: { STOP: "idle" } },
  };

  it("advances timer without transition", () => {
    const result = fsmStep({ current: "idle", timer: 0 }, states, 500);
    expect(result.state).toBe("idle");
    expect(result.timer).toBe(500);
    expect(result.transitioned).toBe(false);
  });

  it("transitions on duration expiry", () => {
    const result = fsmStep({ current: "idle", timer: 900 }, states, 200);
    expect(result.state).toBe("walk");
    expect(result.timer).toBe(0);
    expect(result.transitioned).toBe(true);
    expect(result.previous).toBe("idle");
  });

  it("stays in state without duration", () => {
    const result = fsmStep({ current: "run", timer: 0 }, states, 99999);
    expect(result.state).toBe("run");
    expect(result.transitioned).toBe(false);
  });

  it("handles unknown state gracefully", () => {
    const result = fsmStep({ current: "unknown", timer: 0 }, states, 100);
    expect(result.state).toBe("unknown");
    expect(result.transitioned).toBe(false);
  });
});

describe("fsmSend", () => {
  const states: Record<string, FSMStateConfig> = {
    idle: { on: { RUN: "run", WALK: "walk" } },
    run: { on: { STOP: "idle" } },
    walk: {},
  };

  it("transitions on matching event", () => {
    expect(fsmSend("idle", states, "RUN")).toEqual({ state: "run", transitioned: true });
  });

  it("ignores unmatched event", () => {
    expect(fsmSend("idle", states, "FLY")).toEqual({ state: "idle", transitioned: false });
  });

  it("ignores event in state without transitions", () => {
    expect(fsmSend("walk", states, "RUN")).toEqual({ state: "walk", transitioned: false });
  });
});

describe("tweenStep", () => {
  it("advances progress", () => {
    const result = tweenStep(
      { progress: 0, active: true, direction: 1 },
      { duration: 1000 },
      100
    );
    expect(result.progress).toBeCloseTo(0.1);
    expect(result.active).toBe(true);
    expect(result.completed).toBe(false);
  });

  it("completes at progress 1 (no yoyo)", () => {
    const result = tweenStep(
      { progress: 0.95, active: true, direction: 1 },
      { duration: 1000 },
      100
    );
    expect(result.progress).toBe(1);
    expect(result.completed).toBe(true);
    expect(result.active).toBe(false);
  });

  it("reverses with yoyo", () => {
    const result = tweenStep(
      { progress: 0.95, active: true, direction: 1 },
      { duration: 1000, yoyo: true },
      100
    );
    expect(result.progress).toBeLessThan(1);
    expect(result.direction).toBe(-1);
    expect(result.active).toBe(true);
    expect(result.completed).toBe(false);
  });

  it("completes yoyo at 0", () => {
    const result = tweenStep(
      { progress: 0.05, active: true, direction: -1 },
      { duration: 1000, yoyo: true },
      100
    );
    expect(result.progress).toBe(0);
    expect(result.completed).toBe(true);
  });

  it("does nothing when inactive", () => {
    const result = tweenStep(
      { progress: 0.5, active: false, direction: 1 },
      { duration: 1000 },
      100
    );
    expect(result.progress).toBe(0.5);
    expect(result.completed).toBe(false);
  });
});

describe("tweenLerp", () => {
  it("interpolates linearly", () => {
    expect(tweenLerp(0, 100, 0)).toBe(0);
    expect(tweenLerp(0, 100, 0.5)).toBe(50);
    expect(tweenLerp(0, 100, 1)).toBe(100);
  });

  it("works with negative ranges", () => {
    expect(tweenLerp(100, -100, 0.5)).toBe(0);
  });
});

// ============================================================
// 2. Step functions + createStore integration
// ============================================================

describe("steps + createStore", () => {

  beforeEach(() => pushScene(mockScene));
  afterEach(() => popScene());

  it("spring system updates store reactively", async () => {
    const positions: number[] = [];

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        entities: [
          { x: 0, y: 0, vx: 0, vy: 0, targetX: 100, targetY: 50, active: true },
        ],
      });

      effect(() => positions.push(store.entities[0].x));

      // Simulate one frame
      queueMicrotask(() => {
        batch(() => {
          const e = store.entities[0];
          const config: SpringConfig = {
            targetX: e.targetX, targetY: e.targetY,
            stiffness: 100, damping: 10,
          };
          const next = springStep(e, config, 0.016);
          setStore("entities", 0, { x: next.x, y: next.y, vx: next.vx, vy: next.vy });
        });
      });

      return d;
    });

    await tick();
    expect(positions.length).toBe(2);
    expect(positions[0]).toBe(0);
    expect(positions[1]).toBeGreaterThan(0);
    dispose();
  });

  it("fsm system advances state machine in store", async () => {
    const stateLog: string[] = [];
    const fsmStates: Record<string, FSMStateConfig> = {
      idle: { duration: 100, onComplete: "walk" },
      walk: { duration: 200, onComplete: "idle" },
    };

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        entities: [
          { state: "idle", timer: 0, active: true },
        ],
      });

      effect(() => stateLog.push(store.entities[0].state));

      // Frame 1: advance 50ms (stays idle)
      queueMicrotask(() => {
        const e = store.entities[0];
        const result = fsmStep({ current: e.state, timer: e.timer }, fsmStates, 50);
        setStore("entities", 0, { state: result.state, timer: result.timer });
      });

      // Frame 2: advance 60ms more (total 110 → transitions to walk)
      setTimeout(() => {
        const e = store.entities[0];
        const result = fsmStep({ current: e.state, timer: e.timer }, fsmStates, 60);
        setStore("entities", 0, { state: result.state, timer: result.timer });
      }, 5);

      return d;
    });

    await new Promise(r => setTimeout(r, 15));
    // Note: Frame 1 sets state="idle" (unchanged) so effect does NOT re-fire.
    // createStore correctly skips notification for same-value writes.
    // Only: initial ("idle") + actual transition ("walk")
    expect(stateLog).toEqual(["idle", "walk"]);
    dispose();
  });

  it("multiple entity pool — each entity tracked independently", async () => {
    const entity0Xs: number[] = [];
    const entity1Xs: number[] = [];

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        fish: [
          { active: true, x: 0, y: 0, vx: 0, vy: 0, targetX: 100, targetY: 0 },
          { active: true, x: 0, y: 0, vx: 0, vy: 0, targetX: -50, targetY: 0 },
        ],
      });

      effect(() => entity0Xs.push(store.fish[0].x));
      effect(() => entity1Xs.push(store.fish[1].x));

      queueMicrotask(() => {
        batch(() => {
          for (let i = 0; i < store.fish.length; i++) {
            const f = store.fish[i];
            if (!f.active) continue;
            const next = springStep(f, {
              targetX: f.targetX, targetY: f.targetY,
              stiffness: 100, damping: 10,
            }, 0.016);
            setStore("fish", i, { x: next.x, y: next.y, vx: next.vx, vy: next.vy });
          }
        });
      });

      return d;
    });

    await tick();
    // Both moved, in opposite directions
    expect(entity0Xs[1]).toBeGreaterThan(0);  // toward +100
    expect(entity1Xs[1]).toBeLessThan(0);     // toward -50
    // Each effect ran exactly twice (init + update)
    expect(entity0Xs.length).toBe(2);
    expect(entity1Xs.length).toBe(2);
    dispose();
  });
});

// ============================================================
// 3. System composition
// ============================================================

describe("System composition", () => {

  beforeEach(() => pushScene(mockScene));
  afterEach(() => popScene());

  it("createSystemFactory creates a System that registers frame callback", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);

    const calls: number[] = [];
    createRoot(d => {
      System({ update: (t, d) => calls.push(d) });
      fm.update(0, 16);
      fm.update(16, 16);
      d();
    });

    expect(calls).toEqual([16, 16]);
  });

  it("multiple Systems execute in registration order", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);
    const order: string[] = [];

    createRoot(d => {
      System({ update: () => order.push("spring") });
      System({ update: () => order.push("fsm") });
      System({ update: () => order.push("overlap") });

      fm.update(0, 16);
      d();
    });

    expect(order).toEqual(["spring", "fsm", "overlap"]);
  });

  it("System cleanup removes frame callback", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);
    const calls: string[] = [];

    const dispose = createRoot(d => {
      System({ update: () => calls.push("tick") });
      return d;
    });

    fm.update(0, 16);
    expect(calls).toEqual(["tick"]);

    dispose();
    fm.update(16, 16);
    expect(calls).toEqual(["tick"]); // no second call
  });

  it("full loop: Systems + store + step functions", async () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);

    interface FishEntity {
      active: boolean;
      x: number; y: number; vx: number; vy: number;
      targetX: number; targetY: number;
      state: string; stateTimer: number;
      hunger: number;
    }

    const fsmStates: Record<string, FSMStateConfig> = {
      idle: { duration: 1000, onComplete: "swim" },
      swim: { duration: 2000, onComplete: "idle" },
    };

    const xLog: number[] = [];
    const stateLog: string[] = [];

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        fish: [
          { active: true, x: 0, y: 0, vx: 0, vy: 0,
            targetX: 200, targetY: 100,
            state: "idle", stateTimer: 0, hunger: 0 },
        ] as FishEntity[],
      });

      // System 1: FSM
      System({ update: (_, delta) => {
        batch(() => {
          for (let i = 0; i < store.fish.length; i++) {
            const f = store.fish[i];
            if (!f.active) continue;
            const result = fsmStep(
              { current: f.state, timer: f.stateTimer },
              fsmStates, delta
            );
            setStore("fish", i, "state", result.state);
            setStore("fish", i, "stateTimer", result.timer);
          }
        });
      }});

      // System 2: Spring
      System({ update: (_, delta) => {
        const dt = delta / 1000;
        batch(() => {
          for (let i = 0; i < store.fish.length; i++) {
            const f = store.fish[i];
            if (!f.active) continue;
            const next = springStep(f, {
              targetX: f.targetX, targetY: f.targetY,
              stiffness: 60, damping: 10,
            }, dt);
            setStore("fish", i, "x", next.x);
            setStore("fish", i, "y", next.y);
            setStore("fish", i, "vx", next.vx);
            setStore("fish", i, "vy", next.vy);
          }
        });
      }});

      // System 3: Hunger
      System({ update: (_, delta) => {
        batch(() => {
          for (let i = 0; i < store.fish.length; i++) {
            if (!store.fish[i].active) continue;
            setStore("fish", i, "hunger", store.fish[i].hunger + delta * 0.001);
          }
        });
      }});

      // Reactive tracking
      effect(() => xLog.push(store.fish[0].x));
      effect(() => stateLog.push(store.fish[0].state));

      return d;
    });

    // Simulate 5 frames
    for (let f = 0; f < 5; f++) {
      fm.update(f * 16, 16);
      await tick();
    }

    // x should have moved toward target
    expect(xLog.length).toBeGreaterThan(1);
    expect(xLog[xLog.length - 1]).toBeGreaterThan(0);

    // State should still be idle (duration 1000, only 80ms elapsed)
    expect(stateLog[stateLog.length - 1]).toBe("idle");

    dispose();
  });

  it("Systems compose with fsmSend for event-driven transitions", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);

    const fsmStates: Record<string, FSMStateConfig> = {
      idle: { on: { FOOD: "eat" } },
      eat: { duration: 500, onComplete: "idle" },
    };

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        fish: [{ state: "idle", timer: 0, nearFood: false }],
      });

      // System 1: check proximity (simulated)
      System({ update: () => {
        setStore("fish", 0, "nearFood", true);  // simulate food detected
      }});

      // System 2: FSM with event sending
      System({ update: (_, delta) => {
        batch(() => {
          const f = store.fish[0];
          // Send event if near food
          if (f.nearFood && f.state === "idle") {
            const result = fsmSend(f.state, fsmStates, "FOOD");
            if (result.transitioned) {
              setStore("fish", 0, "state", result.state);
              setStore("fish", 0, "timer", 0);
              setStore("fish", 0, "nearFood", false);
            }
          }
          // Advance timer
          const stepResult = fsmStep(
            { current: store.fish[0].state, timer: store.fish[0].timer },
            fsmStates, delta
          );
          setStore("fish", 0, "state", stepResult.state);
          setStore("fish", 0, "timer", stepResult.timer);
        });
      }});

      // Frame 1: detect food → transition to eat
      fm.update(0, 16);
      expect(store.fish[0].state).toBe("eat");

      // Frame 2-30: advance timer
      for (let i = 1; i <= 30; i++) fm.update(i * 16, 16);
      // 31 * 16 = 496ms, not yet complete
      expect(store.fish[0].state).toBe("eat");

      // Frame 32: timer exceeds 500 → back to idle
      fm.update(31 * 16, 16);
      expect(store.fish[0].state).toBe("idle");

      return d;
    });

    dispose();
  });

  it("Systems respect phase ordering: pre → main → post", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);
    const order: string[] = [];

    createRoot(d => {
      System({ update: () => order.push("main-1") });
      System({ update: () => order.push("post"), phase: "post" });
      System({ update: () => order.push("pre"), phase: "pre" });
      System({ update: () => order.push("main-2") });

      fm.update(0, 16);
      d();
    });

    expect(order).toEqual(["pre", "main-1", "main-2", "post"]);
  });

  it("full loop with phases: pre reacts, main physics, post detects", async () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);

    const log: string[] = [];

    const dispose = createRoot(d => {
      const [store, setStore] = createStore({
        fish: [{ x: 0, vx: 10, state: "idle", nearWall: false }],
      });

      // pre: react to state changes
      System({ update: () => {
        log.push(`pre:state=${store.fish[0].state}`);
      }, phase: "pre" });

      // main: physics
      System({ update: (_, delta) => {
        const dt = delta / 1000;
        const f = store.fish[0];
        setStore("fish", 0, "x", f.x + f.vx * dt);
        log.push(`main:x=${store.fish[0].x.toFixed(2)}`);
      }});

      // post: detect wall collision
      System({ update: () => {
        const f = store.fish[0];
        if (f.x > 0.1 && !f.nearWall) {
          setStore("fish", 0, "nearWall", true);
          setStore("fish", 0, "state", "turning");
          log.push("post:wall!");
        }
      }, phase: "post" });

      return d;
    });

    fm.update(0, 16);
    await tick();

    // pre runs first (sees idle), main moves, post detects
    expect(log[0]).toBe("pre:state=idle");
    expect(log[1]).toContain("main:x=");
    expect(log[2]).toBe("post:wall!");

    dispose();
  });

  it("System when guard works with phases", () => {
    const fm = createFrameManager();
    const System = createSystemFactory(fm.register);
    const calls: string[] = [];
    let enabled = false;

    createRoot(d => {
      System({
        update: () => calls.push("pre"),
        phase: "pre",
        when: () => enabled,
      });
      System({ update: () => calls.push("main") });

      fm.update(0, 16);
      expect(calls).toEqual(["main"]); // pre skipped

      enabled = true;
      fm.update(16, 16);
      expect(calls).toEqual(["main", "pre", "main"]); // pre now runs

      d();
    });
  });
});

// ============================================================
// 4. createIndex
// ============================================================

describe("createIndex", () => {

  it("tracks matching entities", async () => {
    const { createIndex } = await import("../src/recs/systems");

    let indexSet!: ReadonlySet<number>;

    const dispose = createRoot(d => {
      const [store] = createStore({
        items: [
          { active: true, state: "idle" },
          { active: true, state: "hungry" },
          { active: false, state: "hungry" },
        ],
      });

      indexSet = createIndex(
        () => store.items.length,
        (i) => store.items[i].active && store.items[i].state === "hungry",
      );

      return d;
    });

    await tick();

    // Only index 1 matches (active + hungry)
    expect(indexSet.has(0)).toBe(false);
    expect(indexSet.has(1)).toBe(true);
    expect(indexSet.has(2)).toBe(false);
    expect(indexSet.size).toBe(1);

    dispose();
  });

  it("updates reactively when entity state changes", async () => {
    const { createIndex } = await import("../src/recs/systems");

    let indexSet!: ReadonlySet<number>;
    let setStore!: any;

    const dispose = createRoot(d => {
      const [store, _setStore] = createStore({
        items: [
          { active: true, state: "idle" },
          { active: true, state: "idle" },
        ],
      });
      setStore = _setStore;

      indexSet = createIndex(
        () => store.items.length,
        (i) => store.items[i].active && store.items[i].state === "hungry",
      );

      return d;
    });

    await tick();
    expect(indexSet.size).toBe(0);

    // Change item 0 to hungry
    setStore("items", 0, "state", "hungry");
    await tick();
    expect(indexSet.has(0)).toBe(true);
    expect(indexSet.size).toBe(1);

    // Change item 1 to hungry too
    setStore("items", 1, "state", "hungry");
    await tick();
    expect(indexSet.has(1)).toBe(true);
    expect(indexSet.size).toBe(2);

    // Change item 0 back to idle
    setStore("items", 0, "state", "idle");
    await tick();
    expect(indexSet.has(0)).toBe(false);
    expect(indexSet.size).toBe(1);

    dispose();
  });

  it("cleans up on dispose", async () => {
    const { createIndex } = await import("../src/recs/systems");

    let indexSet!: ReadonlySet<number>;

    const dispose = createRoot(d => {
      const [store] = createStore({
        items: [{ active: true, state: "hungry" }],
      });

      indexSet = createIndex(
        () => store.items.length,
        (i) => store.items[i].active && store.items[i].state === "hungry",
      );

      return d;
    });

    await tick();
    expect(indexSet.size).toBe(1);

    dispose();
    expect(indexSet.size).toBe(0);
  });
});
