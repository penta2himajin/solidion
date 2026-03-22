import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, createSignal, getOwner, runWithOwner } from "solid-js";
import { MockScene, MockTimerEvent } from "./mocks";
import { createFrameManager, type FrameManager } from "../src/core/frame";

/**
 * Comprehensive unit tests for all hooks in src/hooks/.
 * Tests the actual hook implementations using Solid's reactive system
 * with mocked context dependencies (useScene, useFrameManager).
 */

// ---- Shared mock state ----
let mockScene: MockScene;
let mockFm: FrameManager;

// Mock the contexts module to provide our test instances
vi.mock("../src/contexts", () => ({
  useScene: () => mockScene as any,
  useFrameManager: () => mockFm,
}));

// ---- Helper to run hook within Solid reactive root ----
function runInRoot<T>(fn: () => T): { result: T; dispose: () => void } {
  let result!: T;
  let dispose!: () => void;
  createRoot((d) => {
    dispose = d;
    result = fn();
  });
  return { result, dispose };
}

// ============================================================
// useFrame
// ============================================================
describe("useFrame", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("registers a frame callback that receives time and delta", async () => {
    const { useFrame } = await import("../src/hooks/useFrame");
    const cb = vi.fn();

    const { dispose } = runInRoot(() => {
      useFrame(cb);
    });

    mockFm.update(1000, 16.667);
    expect(cb).toHaveBeenCalledWith(1000, 16.667);

    mockFm.update(2000, 16.667);
    expect(cb).toHaveBeenCalledTimes(2);

    dispose();
  });

  it("auto-cleans up the callback on dispose", async () => {
    const { useFrame } = await import("../src/hooks/useFrame");
    const cb = vi.fn();

    const { dispose } = runInRoot(() => {
      useFrame(cb);
    });

    mockFm.update(1000, 16);
    expect(cb).toHaveBeenCalledOnce();

    dispose();

    mockFm.update(2000, 16);
    expect(cb).toHaveBeenCalledOnce(); // Not called again
  });

  it("supports multiple concurrent callbacks", async () => {
    const { useFrame } = await import("../src/hooks/useFrame");
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { dispose } = runInRoot(() => {
      useFrame(cb1);
      useFrame(cb2);
    });

    mockFm.update(1000, 16);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();

    dispose();
  });
});

// ============================================================
// useTime
// ============================================================
describe("useTime", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns a signal that tracks scene time", async () => {
    const { useTime } = await import("../src/hooks/useTime");
    let time!: () => number;

    const { dispose } = runInRoot(() => {
      time = useTime();
    });

    expect(time()).toBe(0);

    mockFm.update(1000, 16);
    expect(time()).toBe(1000);

    mockFm.update(2500, 16);
    expect(time()).toBe(2500);

    dispose();
  });

  it("stops updating after dispose", async () => {
    const { useTime } = await import("../src/hooks/useTime");
    let time!: () => number;

    const { dispose } = runInRoot(() => {
      time = useTime();
    });

    mockFm.update(1000, 16);
    expect(time()).toBe(1000);

    dispose();

    mockFm.update(5000, 16);
    expect(time()).toBe(1000); // Unchanged
  });
});

// ============================================================
// useTween
// ============================================================
describe("useTween", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns initial values signal", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    let values!: () => { x: number };

    const { dispose } = runInRoot(() => {
      values = useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 1000,
      });
    });

    expect(values()).toEqual({ x: 0 });
    dispose();
  });

  it("creates a paused Phaser tween on construction", async () => {
    const { useTween } = await import("../src/hooks/useTween");

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
        ease: "Cubic",
      });
    });

    expect(mockScene.tweens.tweens.length).toBe(1);
    const tween = mockScene.tweens.tweens[0];
    expect(tween.config.duration).toBe(500);
    expect(tween.config.ease).toBe("Cubic");
    expect(tween.config.paused).toBe(true);

    dispose();
  });

  it("defaults ease to Linear, yoyo false, repeat 0, delay 0", async () => {
    const { useTween } = await import("../src/hooks/useTween");

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
      });
    });

    const tween = mockScene.tweens.tweens[0];
    expect(tween.config.ease).toBe("Linear");
    expect(tween.config.yoyo).toBe(false);
    expect(tween.config.repeat).toBe(0);
    expect(tween.config.delay).toBe(0);

    dispose();
  });

  it("flushes pending updates on frame tick", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    let values!: () => { x: number };

    const { dispose } = runInRoot(() => {
      values = useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
      });
    });

    const tween = mockScene.tweens.tweens[0];
    // Must play the tween first (it's created paused)
    tween.play();
    // Simulate tween update (triggers onUpdate which sets pendingUpdate)
    tween.simulateUpdate(0.5);

    // Frame tick should flush pending update from proxy to signal
    mockFm.update(100, 16);
    // After simulateUpdate, the proxy x was interpolated from 0 toward 100 at 50%
    expect(values().x).toBeCloseTo(50, 0);

    dispose();
  });

  it("does not update values when no pending update", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    let values!: () => { x: number };

    const { dispose } = runInRoot(() => {
      values = useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
      });
    });

    // Frame tick without any tween update
    mockFm.update(100, 16);
    expect(values()).toEqual({ x: 0 });

    dispose();
  });

  it("calls onComplete callback when tween completes", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    const onComplete = vi.fn();

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
        onComplete,
      });
    });

    const tween = mockScene.tweens.tweens[0];
    tween.simulateComplete();
    expect(onComplete).toHaveBeenCalledOnce();

    dispose();
  });

  it("removes tween on cleanup", async () => {
    const { useTween } = await import("../src/hooks/useTween");

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
      });
    });

    const tween = mockScene.tweens.tweens[0];
    expect(tween.isRemoved()).toBe(false);

    dispose();
    expect(tween.isRemoved()).toBe(true);
  });

  it("reacts to playing signal - play and pause", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    const [playing, setPlaying] = createSignal(false);

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
        playing,
      });
    });

    // Initially paused (playing = false)
    let tween = mockScene.tweens.tweens[0];
    expect(tween.isPlaying()).toBe(false);

    // Set playing to true -> should rebuild and play
    setPlaying(true);
    tween = mockScene.tweens.tweens[mockScene.tweens.tweens.length - 1];
    expect(tween.isPlaying()).toBe(true);

    // Set playing to false -> should pause
    setPlaying(false);
    expect(tween.isPlaying()).toBe(false);

    dispose();
  });

  it("rebuilds tween when playing signal goes true while not already playing", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    const [playing, setPlaying] = createSignal(true);

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
        playing,
      });
    });

    // Should have built and started a tween
    expect(mockScene.tweens.tweens.length).toBeGreaterThanOrEqual(1);
    const tween = mockScene.tweens.tweens[mockScene.tweens.tweens.length - 1];
    expect(tween.isPlaying()).toBe(true);

    dispose();
  });

  it("supports multi-property tweens", async () => {
    const { useTween } = await import("../src/hooks/useTween");
    let values!: () => { x: number; y: number; alpha: number };

    const { dispose } = runInRoot(() => {
      values = useTween({
        from: { x: 0, y: 0, alpha: 0 },
        to: { x: 100, y: 200, alpha: 1 },
        duration: 1000,
      });
    });

    expect(values()).toEqual({ x: 0, y: 0, alpha: 0 });

    dispose();
  });

  it("applies yoyo, repeat, and delay config", async () => {
    const { useTween } = await import("../src/hooks/useTween");

    const { dispose } = runInRoot(() => {
      useTween({
        from: { x: 0 },
        to: { x: 100 },
        duration: 500,
        yoyo: true,
        repeat: 3,
        delay: 200,
      });
    });

    const tween = mockScene.tweens.tweens[0];
    expect(tween.config.yoyo).toBe(true);
    expect(tween.config.repeat).toBe(3);
    expect(tween.config.delay).toBe(200);

    dispose();
  });
});

// ============================================================
// useStateMachine — frame mode
// ============================================================
describe("useStateMachine (frame mode)", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("starts in initial state", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: "running" } },
          running: {},
        },
      });
    });

    expect(machine.state()).toBe("idle");
    expect(machine.is("idle")).toBe(true);
    expect(machine.is("running")).toBe(false);

    dispose();
  });

  it("transitions on send", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: "running" } },
          running: { on: { STOP: "idle" } },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("running");
    expect(machine.is("running")).toBe(true);

    machine.send("STOP");
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("ignores unknown events", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: "running" } },
          running: {},
        },
      });
    });

    machine.send("UNKNOWN");
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("does not transition to same state", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { SELF: "idle" } },
        },
      });
    });

    machine.send("SELF");
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("calls onEnter and onExit during transitions", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    const onExitIdle = vi.fn();
    const onEnterRunning = vi.fn();
    const onExitRunning = vi.fn();
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: "running" }, onExit: onExitIdle },
          running: { on: { STOP: "idle" }, onEnter: onEnterRunning, onExit: onExitRunning },
        },
      });
    });

    machine.send("GO");
    expect(onExitIdle).toHaveBeenCalledOnce();
    expect(onEnterRunning).toHaveBeenCalledOnce();

    machine.send("STOP");
    expect(onExitRunning).toHaveBeenCalledOnce();

    dispose();
  });

  it("tick advances frame-mode timer and auto-transitions", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "frame",
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 500, onComplete: "idle" },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("acting");

    machine.tick(200);
    expect(machine.state()).toBe("acting");

    machine.tick(200);
    expect(machine.state()).toBe("acting");

    // Tick past the duration (total 550 > 500)
    machine.tick(150);
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("tick does nothing in scene mode", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 500, onComplete: "idle" },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("acting");

    machine.tick(9999);
    expect(machine.state()).toBe("acting"); // tick ignored in scene mode

    dispose();
  });

  it("tick does nothing when no duration is active", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: "running" } },
          running: {},
        },
      });
    });

    machine.tick(100);
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("clears frame timer on manual transition before timeout", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "frame",
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 1000, onComplete: "done", on: { CANCEL: "idle" } },
          done: {},
        },
      });
    });

    machine.send("GO");
    machine.tick(200);
    machine.send("CANCEL"); // Manual transition clears timer

    // Further ticking should not auto-transition to "done"
    machine.tick(5000);
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("animation accessor returns animation string", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { animation: "player-idle", on: { GO: "running" } },
          running: { animation: "player-run" },
        },
      });
    });

    expect(machine.animation()).toBe("player-idle");

    machine.send("GO");
    expect(machine.animation()).toBe("player-run");

    dispose();
  });

  it("animation accessor handles function animation values", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    const [dir, setDir] = createSignal("left");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { animation: () => `player-idle-${dir()}` },
        },
      });
    });

    expect(machine.animation()).toBe("player-idle-left");

    setDir("right");
    expect(machine.animation()).toBe("player-idle-right");

    dispose();
  });

  it("animation accessor returns empty string when no animation defined", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: {},
        },
      });
    });

    expect(machine.animation()).toBe("");

    dispose();
  });

  it("initial state with duration sets up frame timer via onMount", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "timed",
        timerMode: "frame",
        states: {
          timed: { duration: 300, onComplete: "done" },
          done: {},
        },
      });
    });

    // onMount runs synchronously in createRoot, so timer should be set up
    machine.tick(350);
    expect(machine.state()).toBe("done");

    dispose();
  });

  it("onEnter is called for initial state via onMount", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    const onEnter = vi.fn();
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { onEnter },
        },
      });
    });

    expect(onEnter).toHaveBeenCalledOnce();

    dispose();
  });

  it("send with no transitions defined is a no-op", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: {}, // No 'on' transitions
        },
      });
    });

    machine.send("anything");
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("send ignores transition to undefined target (Partial<Record> edge case)", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        states: {
          idle: { on: { GO: undefined as any } },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("idle"); // Should not transition

    dispose();
  });
});

// ============================================================
// useStateMachine — scene mode
// ============================================================
describe("useStateMachine (scene mode)", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("uses scene.time.delayedCall for duration-based timers", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 800, onComplete: "idle" },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("acting");
    expect(mockScene.time.timers.length).toBe(1);
    expect(mockScene.time.timers[0].delay).toBe(800);

    // Fire the scene timer
    mockScene.time.timers[0].fire();
    expect(machine.state()).toBe("idle");

    dispose();
  });

  it("clears scene timer on manual transition", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 800, onComplete: "idle", on: { CANCEL: "idle" } },
        },
      });
    });

    machine.send("GO");
    const timer = mockScene.time.timers[0];
    expect(timer.removed).toBe(false);

    machine.send("CANCEL");
    expect(timer.removed).toBe(true);

    dispose();
  });

  it("cleans up scene timer on dispose", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 800, onComplete: "idle" },
        },
      });
    });

    machine.send("GO");
    const timer = mockScene.time.timers[0];
    expect(timer.removed).toBe(false);

    dispose();
    expect(timer.removed).toBe(true);
  });

  it("throws when scene mode is used without scene", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");

    expect(() => {
      runInRoot(() => {
        useStateMachine({
          initial: "idle",
          timerMode: "scene",
          // No scene provided
          states: {
            idle: {},
          },
        });
      });
    }).toThrow('timerMode "scene" requires a `scene` property');
  });

  it("initial state with duration sets up scene timer via onMount", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "timed",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          timed: { duration: 500, onComplete: "done" },
          done: {},
        },
      });
    });

    // onMount should have set up a timer
    expect(mockScene.time.timers.length).toBe(1);
    expect(mockScene.time.timers[0].delay).toBe(500);

    mockScene.time.timers[0].fire();
    expect(machine.state()).toBe("done");

    dispose();
  });

  it("handles chain of auto-transitions in scene mode", async () => {
    const { useStateMachine } = await import("../src/hooks/useStateMachine");
    let machine: any;

    const { dispose } = runInRoot(() => {
      machine = useStateMachine({
        initial: "idle",
        timerMode: "scene",
        scene: mockScene as any,
        states: {
          idle: { on: { GO: "step1" } },
          step1: { duration: 100, onComplete: "step2" },
          step2: { duration: 200, onComplete: "idle" },
        },
      });
    });

    machine.send("GO");
    expect(machine.state()).toBe("step1");

    mockScene.time.timers[0].fire();
    expect(machine.state()).toBe("step2");

    mockScene.time.timers[1].fire();
    expect(machine.state()).toBe("idle");

    dispose();
  });
});

// ============================================================
// useSequence
// ============================================================
describe("useSequence", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("starts in non-playing state", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([{ action: "a", duration: 100 }]);
    });

    expect(seq.playing()).toBe(false);
    expect(seq.current()).toBeNull();
    expect(seq.progress()).toBe(0);

    dispose();
  });

  it("plays through steps in order with timers", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    const onStart1 = vi.fn();
    const onStart2 = vi.fn();
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "shake", duration: 300, onStart: onStart1 },
        { action: "pop", duration: 400, onStart: onStart2 },
      ]);
    });

    seq.play();
    expect(seq.playing()).toBe(true);
    expect(seq.current()).toBe("shake");
    expect(onStart1).toHaveBeenCalledOnce();
    expect(seq.progress()).toBe(0.5); // 1/2

    mockScene.time.timers[0].fire();
    expect(seq.current()).toBe("pop");
    expect(onStart2).toHaveBeenCalledOnce();
    expect(seq.progress()).toBe(1); // 2/2

    mockScene.time.timers[1].fire();
    expect(seq.playing()).toBe(false);
    expect(seq.current()).toBeNull();
    expect(seq.progress()).toBe(0);

    dispose();
  });

  it("handles zero-duration steps (immediate advance)", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    const onStart = vi.fn();
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "instant", onStart },
        { action: "next", duration: 100 },
      ]);
    });

    seq.play();
    expect(onStart).toHaveBeenCalledOnce();
    expect(seq.current()).toBe("next");

    dispose();
  });

  it("handles delay-only steps", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { delay: 200 },
        { action: "after-delay", duration: 100 },
      ]);
    });

    seq.play();
    expect(seq.current()).toBeNull(); // delay step has no action

    mockScene.time.timers[0].fire();
    expect(seq.current()).toBe("after-delay");

    dispose();
  });

  it("handles steps with both delay and duration", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "delayed-action", delay: 100, duration: 200 },
      ]);
    });

    seq.play();
    expect(seq.current()).toBe("delayed-action");
    expect(mockScene.time.timers[0].delay).toBe(300);

    dispose();
  });

  it("resets cleanly", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "a", duration: 300 },
        { action: "b", duration: 400 },
      ]);
    });

    seq.play();
    expect(seq.playing()).toBe(true);

    seq.reset();
    expect(seq.playing()).toBe(false);
    expect(seq.current()).toBeNull();
    expect(mockScene.time.timers[0].removed).toBe(true);

    dispose();
  });

  it("can be replayed after completion", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    const onStart = vi.fn();
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([{ action: "a", duration: 100, onStart }]);
    });

    seq.play();
    mockScene.time.timers[0].fire();
    expect(seq.playing()).toBe(false);

    seq.play();
    expect(seq.playing()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(2);

    dispose();
  });

  it("cleans up timers on dispose", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "a", duration: 300 },
        { action: "b", duration: 400 },
      ]);
    });

    seq.play();
    const timer = mockScene.time.timers[0];
    expect(timer.removed).toBe(false);

    dispose();
    expect(timer.removed).toBe(true);
  });

  it("progress tracks through multi-step sequence", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "a", duration: 100 },
        { action: "b", duration: 100 },
        { action: "c", duration: 100 },
        { action: "d", duration: 100 },
      ]);
    });

    seq.play();
    expect(seq.progress()).toBe(0.25);

    mockScene.time.timers[0].fire();
    expect(seq.progress()).toBe(0.5);

    mockScene.time.timers[1].fire();
    expect(seq.progress()).toBe(0.75);

    mockScene.time.timers[2].fire();
    expect(seq.progress()).toBe(1);

    mockScene.time.timers[3].fire();
    expect(seq.progress()).toBe(0); // completed

    dispose();
  });

  it("handles all zero-duration steps (runs through all immediately)", async () => {
    const { useSequence } = await import("../src/hooks/useSequence");
    const onStart1 = vi.fn();
    const onStart2 = vi.fn();
    let seq: any;

    const { dispose } = runInRoot(() => {
      seq = useSequence([
        { action: "a", onStart: onStart1 },
        { action: "b", onStart: onStart2 },
      ]);
    });

    seq.play();
    // Both should fire immediately
    expect(onStart1).toHaveBeenCalledOnce();
    expect(onStart2).toHaveBeenCalledOnce();
    expect(seq.playing()).toBe(false);

    dispose();
  });
});

// ============================================================
// useSpring
// ============================================================
describe("useSpring", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns initial position matching target", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 100, y: 200 }),
      });
    });

    expect(pos()).toEqual({ x: 100, y: 200 });

    dispose();
  });

  it("uses custom initial position when provided", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 100, y: 200 }),
        initial: { x: 0, y: 0 },
      });
    });

    expect(pos()).toEqual({ x: 0, y: 0 });

    dispose();
  });

  it("moves toward target over frame updates", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 100, y: 0 }),
        initial: { x: 0, y: 0 },
        stiffness: 200,
        damping: 20,
        mass: 1,
      });
    });

    for (let i = 0; i < 100; i++) {
      mockFm.update(i * 16, 16);
    }

    expect(pos().x).toBeCloseTo(100, 0);
    expect(pos().y).toBeCloseTo(0, 0);

    dispose();
  });

  it("caps dt to prevent instability (large delta)", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 100, y: 0 }),
        initial: { x: 0, y: 0 },
      });
    });

    mockFm.update(1000, 5000);
    const afterBigDelta = pos();
    expect(afterBigDelta.x).toBeGreaterThan(0);
    expect(Number.isFinite(afterBigDelta.x)).toBe(true);

    dispose();
  });

  it("follows a changing target", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    const [target, setTarget] = createSignal({ x: 0, y: 0 });
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target,
        stiffness: 200,
        damping: 20,
      });
    });

    expect(pos()).toEqual({ x: 0, y: 0 });

    setTarget({ x: 50, y: 50 });
    for (let i = 0; i < 200; i++) {
      mockFm.update(i * 16, 16);
    }

    expect(pos().x).toBeCloseTo(50, 0);
    expect(pos().y).toBeCloseTo(50, 0);

    dispose();
  });

  it("uses default config values", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 50, y: 50 }),
        initial: { x: 0, y: 0 },
      });
    });

    mockFm.update(16, 16);
    expect(pos().x).toBeGreaterThan(0);

    dispose();
  });

  it("overshoots with low damping (underdamped)", async () => {
    const { useSpring } = await import("../src/hooks/useSpring");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useSpring({
        target: () => ({ x: 100, y: 0 }),
        initial: { x: 0, y: 0 },
        stiffness: 500,
        damping: 5,
        mass: 1,
      });
    });

    let maxX = 0;
    for (let i = 0; i < 200; i++) {
      mockFm.update(i * 16, 16);
      if (pos().x > maxX) maxX = pos().x;
    }

    // With low damping, should overshoot past 100
    expect(maxX).toBeGreaterThan(100);
    // Eventually settles near target
    expect(pos().x).toBeCloseTo(100, 0);

    dispose();
  });
});

// ============================================================
// useFollow
// ============================================================
describe("useFollow", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns initial position matching target", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: 200 }),
      });
    });

    expect(pos()).toEqual({ x: 100, y: 200 });

    dispose();
  });

  it("uses custom initial position when provided", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: 200 }),
        initial: { x: 0, y: 0 },
      });
    });

    expect(pos()).toEqual({ x: 0, y: 0 });

    dispose();
  });

  it("exponentially decays toward target", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: 0 }),
        initial: { x: 0, y: 0 },
        speed: 0.1,
      });
    });

    mockFm.update(16, 16.667);
    const first = pos().x;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(100);

    for (let i = 1; i < 300; i++) {
      mockFm.update(i * 16, 16.667);
    }
    expect(pos().x).toBeCloseTo(100, 0);

    dispose();
  });

  it("uses default speed of 0.1", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: 0 }),
        initial: { x: 0, y: 0 },
      });
    });

    mockFm.update(16, 16.667);
    expect(pos().x).toBeGreaterThan(0);
    expect(pos().x).toBeLessThan(100);

    dispose();
  });

  it("follows a changing target", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    const [target, setTarget] = createSignal({ x: 0, y: 0 });
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target,
        speed: 0.5,
      });
    });

    setTarget({ x: 200, y: 0 });
    for (let i = 0; i < 100; i++) {
      mockFm.update(i * 16, 16.667);
    }
    expect(pos().x).toBeCloseTo(200, 0);

    dispose();
  });

  it("high speed approaches instant snapping", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: 50 }),
        initial: { x: 0, y: 0 },
        speed: 0.99,
      });
    });

    mockFm.update(16, 16.667);
    // With speed ~1, should be very close to target after one frame
    expect(pos().x).toBeGreaterThan(95);
    expect(pos().y).toBeGreaterThan(45);

    dispose();
  });

  it("follows in both axes simultaneously", async () => {
    const { useFollow } = await import("../src/hooks/useFollow");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      pos = useFollow({
        target: () => ({ x: 100, y: -50 }),
        initial: { x: 0, y: 0 },
        speed: 0.3,
      });
    });

    for (let i = 0; i < 200; i++) {
      mockFm.update(i * 16, 16.667);
    }

    expect(pos().x).toBeCloseTo(100, 0);
    expect(pos().y).toBeCloseTo(-50, 0);

    dispose();
  });
});

// ============================================================
// useOscillation
// ============================================================
describe("useOscillation", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns zero offset initially", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
      });
    });

    expect(val()).toEqual({ x: 0, y: 0 });

    dispose();
  });

  it("produces sine wave oscillation on Y axis", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
        frequency: 1,
      });
    });

    // At time = 0.25s (quarter period for 1Hz), sin(pi/2) = 1
    mockFm.update(250, 16);
    expect(val().y).toBeCloseTo(10, 0);
    expect(val().x).toBe(0);

    dispose();
  });

  it("produces sine wave oscillation on X axis", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { x: 20 },
        frequency: 1,
      });
    });

    mockFm.update(250, 16);
    expect(val().x).toBeCloseTo(20, 0);
    expect(val().y).toBe(0);

    dispose();
  });

  it("produces oscillation on both axes", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { x: 5, y: 10 },
        frequency: 1,
      });
    });

    mockFm.update(250, 16);
    expect(val().x).toBeCloseTo(5, 0);
    expect(val().y).toBeCloseTo(10, 0);

    dispose();
  });

  it("applies phase offset", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
        frequency: 1,
        phase: Math.PI / 2, // Start at peak
      });
    });

    // At time=0, angle = 0 + pi/2, sin(pi/2) = 1
    mockFm.update(0, 16);
    expect(val().y).toBeCloseTo(10, 0);

    dispose();
  });

  it("uses default frequency of 1 and phase of 0", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
      });
    });

    mockFm.update(250, 16);
    expect(val().y).toBeCloseTo(10, 0);

    dispose();
  });

  it("handles zero amplitude gracefully", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: {},
      });
    });

    mockFm.update(250, 16);
    expect(val().x).toBe(0);
    expect(val().y).toBe(0);

    dispose();
  });

  it("completes a full cycle", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
        frequency: 1,
      });
    });

    mockFm.update(500, 16);
    expect(val().y).toBeCloseTo(0, 1);

    mockFm.update(750, 16);
    expect(val().y).toBeCloseTo(-10, 0);

    mockFm.update(1000, 16);
    expect(val().y).toBeCloseTo(0, 1);

    dispose();
  });

  it("different frequency changes period", async () => {
    const { useOscillation } = await import("../src/hooks/useOscillation");
    let val!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      val = useOscillation({
        amplitude: { y: 10 },
        frequency: 2, // 2Hz = 0.5s period
      });
    });

    // At t=0.125s: sin(2*pi*2*0.125) = sin(pi/2) = 1
    mockFm.update(125, 16);
    expect(val().y).toBeCloseTo(10, 0);

    dispose();
  });
});

// ============================================================
// useVelocity
// ============================================================
describe("useVelocity", () => {
  beforeEach(() => {
    mockFm = createFrameManager();
    mockScene = new MockScene();
  });

  it("returns initial position", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 10, y: 20 },
        velocity: { x: 0, y: 0 },
      }); pos = _v.pos; _v.setActive(true);
    });

    expect(pos()).toEqual({ x: 10, y: 20 });

    dispose();
  });

  it("moves with constant velocity over many frames", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 100, y: 50 },
      }); pos = _v.pos; _v.setActive(true);
    });

    for (let i = 0; i < 60; i++) {
      mockFm.update(i * 16.667, 16.667);
    }

    expect(pos().x).toBeCloseTo(100, -1);
    expect(pos().y).toBeCloseTo(50, -1);

    dispose();
  });

  it("applies acceleration", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 500 },
      }); pos = _v.pos; _v.setActive(true);
    });

    for (let i = 0; i < 60; i++) {
      mockFm.update(i * 16.667, 16.667);
    }

    expect(pos().y).toBeGreaterThan(0);
    expect(pos().x).toBeCloseTo(0, 1);

    dispose();
  });

  it("defaults acceleration to zero", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 50, y: 0 },
      }); pos = _v.pos; _v.setActive(true);
    });

    for (let i = 0; i < 60; i++) {
      mockFm.update(i * 16.667, 16.667);
    }

    expect(pos().x).toBeCloseTo(50, -1);

    dispose();
  });

  it("clamps to x upper bound and bounces", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 90, y: 0 },
        velocity: { x: 500, y: 0 },
        bounds: { x: [0, 100] },
        bounce: 0.8,
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(16, 16);
    expect(pos().x).toBeLessThanOrEqual(100);

    dispose();
  });

  it("clamps to x lower bound and bounces", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 10, y: 0 },
        velocity: { x: -500, y: 0 },
        bounds: { x: [0, 100] },
        bounce: 0.5,
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(16, 16);
    expect(pos().x).toBeGreaterThanOrEqual(0);

    dispose();
  });

  it("clamps to y upper bound and bounces", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 90 },
        velocity: { x: 0, y: 500 },
        bounds: { y: [0, 100] },
        bounce: 0.5,
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(16, 16);
    expect(pos().y).toBeLessThanOrEqual(100);

    dispose();
  });

  it("clamps to y lower bound and bounces", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 10 },
        velocity: { x: 0, y: -500 },
        bounds: { y: [0, 100] },
        bounce: 0.5,
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(16, 16);
    expect(pos().y).toBeGreaterThanOrEqual(0);

    dispose();
  });

  it("defaults bounce to 0 (no bounce)", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 95, y: 0 },
        velocity: { x: 1000, y: 0 },
        bounds: { x: [0, 100] },
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(16, 16);
    expect(pos().x).toBe(100);

    mockFm.update(32, 16);
    expect(pos().x).toBe(100); // No bounce, stays

    dispose();
  });

  it("caps dt to prevent instability", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
      }); pos = _v.pos; _v.setActive(true);
    });

    mockFm.update(0, 10000);
    expect(pos().x).toBeCloseTo(5, 1); // dt capped at 0.05
    expect(Number.isFinite(pos().x)).toBe(true);

    dispose();
  });

  it("reset changes position and velocity", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };
    let vel!: any;

    const { dispose } = runInRoot(() => {
      vel = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
      });
      pos = vel.pos;
      vel.setActive(true);
    });

    mockFm.update(0, 1000);
    expect(pos().x).toBeGreaterThan(0);

    // Reset to new position and velocity
    vel.reset({ x: 500, y: 300 }, { x: -50, y: 0 });
    expect(pos()).toEqual({ x: 500, y: 300 });

    mockFm.update(1000, 1000);
    expect(pos().x).toBeLessThan(500); // moving left

    dispose();
  });

  it("setActive(false) pauses integration", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };
    let vel!: any;

    const { dispose } = runInRoot(() => {
      vel = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 100, y: 0 },
      });
      pos = vel.pos;
      vel.setActive(true);
    });

    mockFm.update(0, 1000);
    const x1 = pos().x;
    expect(x1).toBeGreaterThan(0);

    // Pause
    vel.setActive(false);
    mockFm.update(1000, 1000);
    expect(pos().x).toBe(x1); // no change

    // Resume
    vel.setActive(true);
    mockFm.update(2000, 1000);
    expect(pos().x).toBeGreaterThan(x1);

    dispose();
  });

  it("works without bounds", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 0, y: 0 },
        velocity: { x: 100, y: -100 },
      }); pos = _v.pos; _v.setActive(true);
    });

    for (let i = 0; i < 60; i++) {
      mockFm.update(i * 16, 16);
    }

    expect(pos().x).toBeGreaterThan(0);
    expect(pos().y).toBeLessThan(0);

    dispose();
  });

  it("handles combined velocity and acceleration with bounds", async () => {
    const { useVelocity } = await import("../src/hooks/useVelocity");
    let pos!: () => { x: number; y: number };

    const { dispose } = runInRoot(() => {
      const _v = useVelocity({
        initial: { x: 50, y: 50 },
        velocity: { x: 200, y: -200 },
        acceleration: { x: -100, y: 100 },
        bounds: { x: [0, 100], y: [0, 100] },
        bounce: 0.7,
      }); pos = _v.pos; _v.setActive(true);
    });

    // Simulate many frames
    for (let i = 0; i < 300; i++) {
      mockFm.update(i * 16, 16);
    }

    // Should remain within bounds
    expect(pos().x).toBeGreaterThanOrEqual(0);
    expect(pos().x).toBeLessThanOrEqual(100);
    expect(pos().y).toBeGreaterThanOrEqual(0);
    expect(pos().y).toBeLessThanOrEqual(100);

    dispose();
  });
});

// ============================================================
// Keep original pure-logic tests for reference/compatibility
// ============================================================

describe("State Machine Logic (pure)", () => {
  interface StateConfig {
    on?: Record<string, string>;
    duration?: number;
    onComplete?: string;
    onEnter?: () => void;
    onExit?: () => void;
  }

  function createStateMachine(
    config: { initial: string; states: Record<string, StateConfig> },
    timerFn: (delay: number, cb: () => void) => { remove: () => void }
  ) {
    let current = config.initial;
    let timer: { remove: () => void } | null = null;

    const transition = (to: string) => {
      if (current === to) return;
      config.states[current]?.onExit?.();
      if (timer) { timer.remove(); timer = null; }
      current = to;
      const newConfig = config.states[to];
      newConfig?.onEnter?.();
      if (newConfig?.duration && newConfig.onComplete) {
        timer = timerFn(newConfig.duration, () => transition(newConfig.onComplete!));
      }
    };

    const send = (event: string) => {
      const transitions = config.states[current]?.on;
      if (transitions && event in transitions) {
        transition(transitions[event]);
      }
    };

    const initConfig = config.states[config.initial];
    initConfig?.onEnter?.();
    if (initConfig?.duration && initConfig.onComplete) {
      timer = timerFn(initConfig.duration, () => transition(initConfig.onComplete!));
    }

    return {
      getState: () => current,
      send,
      cleanup: () => { if (timer) { timer.remove(); timer = null; } },
    };
  }

  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  it("starts in initial state and calls onEnter", () => {
    const onEnter = vi.fn();
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { onEnter, on: { CLICK: "active" } },
          active: {},
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    expect(sm.getState()).toBe("idle");
    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("transitions on send", () => {
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { CLICK: "active" } },
          active: { on: { DONE: "idle" } },
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    sm.send("CLICK");
    expect(sm.getState()).toBe("active");

    sm.send("DONE");
    expect(sm.getState()).toBe("idle");
  });

  it("ignores unknown events", () => {
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { CLICK: "active" } },
          active: {},
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    sm.send("UNKNOWN");
    expect(sm.getState()).toBe("idle");
  });

  it("calls onExit and onEnter during transitions", () => {
    const onExitIdle = vi.fn();
    const onEnterActive = vi.fn();
    const onExitActive = vi.fn();
    const onEnterIdle = vi.fn();

    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { GO: "active" }, onExit: onExitIdle, onEnter: onEnterIdle },
          active: { on: { BACK: "idle" }, onExit: onExitActive, onEnter: onEnterActive },
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    expect(onEnterIdle).toHaveBeenCalledOnce();

    sm.send("GO");
    expect(onExitIdle).toHaveBeenCalledOnce();
    expect(onEnterActive).toHaveBeenCalledOnce();

    sm.send("BACK");
    expect(onExitActive).toHaveBeenCalledOnce();
    expect(onEnterIdle).toHaveBeenCalledTimes(2);
  });

  it("sets up timer for duration-based auto-transition", () => {
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 800, onComplete: "idle" },
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    sm.send("GO");
    expect(sm.getState()).toBe("acting");
    expect(scene.time.timers.length).toBe(1);
    expect(scene.time.timers[0].delay).toBe(800);

    scene.time.timers[0].fire();
    expect(sm.getState()).toBe("idle");
  });

  it("clears timer on manual transition before timeout", () => {
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { GO: "acting" } },
          acting: { duration: 800, onComplete: "idle", on: { CANCEL: "idle" } },
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    sm.send("GO");
    const timer = scene.time.timers[0];
    expect(timer.removed).toBe(false);

    sm.send("CANCEL");
    expect(timer.removed).toBe(true);
    expect(sm.getState()).toBe("idle");
  });

  it("does not transition to same state", () => {
    const onEnter = vi.fn();
    const sm = createStateMachine(
      {
        initial: "idle",
        states: {
          idle: { on: { SELF: "idle" }, onEnter },
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    expect(onEnter).toHaveBeenCalledOnce();
    sm.send("SELF");
    expect(onEnter).toHaveBeenCalledOnce();
    expect(sm.getState()).toBe("idle");
  });

  it("cleans up timer on cleanup", () => {
    const sm = createStateMachine(
      {
        initial: "timed",
        states: {
          timed: { duration: 1000, onComplete: "done" },
          done: {},
        },
      },
      (delay, cb) => scene.time.delayedCall(delay, cb)
    );

    const timer = scene.time.timers[0];
    expect(timer.removed).toBe(false);

    sm.cleanup();
    expect(timer.removed).toBe(true);
  });
});

describe("Sequence Logic (pure)", () => {
  interface SequenceStep {
    action?: string;
    duration?: number;
    delay?: number;
    onStart?: () => void;
  }

  function createSequence(
    steps: SequenceStep[],
    timerFn: (delay: number, cb: () => void) => { remove: () => void }
  ) {
    let currentIndex = -1;
    let playing = false;
    const timers: { remove: () => void }[] = [];

    const clearTimers = () => {
      for (const t of timers) t.remove();
      timers.length = 0;
    };

    const advance = (idx: number) => {
      if (idx >= steps.length) {
        playing = false;
        currentIndex = -1;
        return;
      }

      currentIndex = idx;
      const step = steps[idx];
      step.onStart?.();

      const totalDuration = (step.delay ?? 0) + (step.duration ?? 0);
      if (totalDuration > 0) {
        const timer = timerFn(totalDuration, () => advance(idx + 1));
        timers.push(timer);
      } else {
        advance(idx + 1);
      }
    };

    return {
      getCurrent: () => (currentIndex >= 0 && currentIndex < steps.length) ? steps[currentIndex].action ?? null : null,
      getIndex: () => currentIndex,
      isPlaying: () => playing,
      play: () => { clearTimers(); playing = true; advance(0); },
      reset: () => { clearTimers(); playing = false; currentIndex = -1; },
      cleanup: () => clearTimers(),
    };
  }

  let scene: MockScene;

  beforeEach(() => {
    scene = new MockScene();
  });

  it("starts in non-playing state", () => {
    const seq = createSequence(
      [{ action: "a", duration: 100 }],
      (d, cb) => scene.time.delayedCall(d, cb)
    );
    expect(seq.isPlaying()).toBe(false);
    expect(seq.getCurrent()).toBeNull();
  });

  it("plays through steps in order", () => {
    const onStart1 = vi.fn();
    const onStart2 = vi.fn();

    const seq = createSequence(
      [
        { action: "shake", duration: 300, onStart: onStart1 },
        { action: "pop", duration: 400, onStart: onStart2 },
      ],
      (d, cb) => scene.time.delayedCall(d, cb)
    );

    seq.play();
    expect(seq.getCurrent()).toBe("shake");
    expect(onStart1).toHaveBeenCalledOnce();

    scene.time.timers[0].fire();
    expect(seq.getCurrent()).toBe("pop");
    expect(onStart2).toHaveBeenCalledOnce();

    scene.time.timers[1].fire();
    expect(seq.isPlaying()).toBe(false);
    expect(seq.getCurrent()).toBeNull();
  });

  it("handles zero-duration steps (immediate advance)", () => {
    const onStart = vi.fn();

    const seq = createSequence(
      [
        { action: "instant", onStart },
        { action: "next", duration: 100 },
      ],
      (d, cb) => scene.time.delayedCall(d, cb)
    );

    seq.play();
    expect(onStart).toHaveBeenCalledOnce();
    expect(seq.getCurrent()).toBe("next");
  });

  it("handles delay-only steps", () => {
    const seq = createSequence(
      [
        { delay: 200 },
        { action: "after-delay", duration: 100 },
      ],
      (d, cb) => scene.time.delayedCall(d, cb)
    );

    seq.play();
    expect(seq.getCurrent()).toBeNull();

    scene.time.timers[0].fire();
    expect(seq.getCurrent()).toBe("after-delay");
  });

  it("resets cleanly", () => {
    const seq = createSequence(
      [
        { action: "a", duration: 300 },
        { action: "b", duration: 400 },
      ],
      (d, cb) => scene.time.delayedCall(d, cb)
    );

    seq.play();
    expect(seq.isPlaying()).toBe(true);

    seq.reset();
    expect(seq.isPlaying()).toBe(false);
    expect(seq.getCurrent()).toBeNull();

    expect(scene.time.timers[0].removed).toBe(true);
  });

  it("can be replayed after completion", () => {
    const onStart = vi.fn();

    const seq = createSequence(
      [{ action: "a", duration: 100, onStart }],
      (d, cb) => scene.time.delayedCall(d, cb)
    );

    seq.play();
    scene.time.timers[0].fire();
    expect(seq.isPlaying()).toBe(false);

    seq.play();
    expect(seq.isPlaying()).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
