import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockScene, MockTimerEvent } from "./mocks";

/**
 * Since hooks depend on Solid's reactive system (createSignal, onMount, etc.),
 * we test the underlying logic patterns rather than the hooks directly.
 * This validates the state machine transition logic, timer management,
 * and sequence stepping independently of the Solid runtime.
 */

describe("State Machine Logic", () => {
  interface StateConfig {
    on?: Record<string, string>;
    duration?: number;
    onComplete?: string;
    onEnter?: () => void;
    onExit?: () => void;
  }

  /**
   * Minimal state machine implementation (pure logic, no Solid dependency).
   * Mirrors useStateMachine's transition logic.
   */
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

    // Initial state setup
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

    // Initial onEnter was called
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

    // Fire the timer
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

    expect(onEnter).toHaveBeenCalledOnce(); // From init
    sm.send("SELF");
    expect(onEnter).toHaveBeenCalledOnce(); // Not called again
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

describe("Sequence Logic", () => {
  interface SequenceStep {
    action?: string;
    duration?: number;
    delay?: number;
    onStart?: () => void;
  }

  /**
   * Minimal sequence implementation (pure logic, no Solid dependency).
   */
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

    // Advance past first step
    scene.time.timers[0].fire();
    expect(seq.getCurrent()).toBe("pop");
    expect(onStart2).toHaveBeenCalledOnce();

    // Advance past second step
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
    // Instant step should have advanced to "next"
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
    expect(seq.getCurrent()).toBeNull(); // delay step has no action

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

    // Timers should be removed
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
