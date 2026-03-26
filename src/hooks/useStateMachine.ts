import { createSignal, createMemo, onMount, onCleanup, type Accessor } from "solid-js";
import { fsmStep, fsmSend } from "../recs/steps";

export interface StateConfig<S extends string> {
  animation?: string | Accessor<string>;
  on?: Partial<Record<string, S>>;
  duration?: number;
  onComplete?: S;
  onEnter?: () => void;
  onExit?: () => void;
}

export interface StateMachineConfig<S extends string> {
  initial: S;
  states: Record<S, StateConfig<S>>;
  /**
   * Timer mode:
   * - "frame" (default): call tick(delta) manually each frame via GameLoop.
   *   Works at L0. Durations are in milliseconds.
   * - "scene": uses Phaser's scene.time.delayedCall for automatic timers.
   *   Requires `scene` to be provided. Integrates with Phaser's pause/timeScale.
   */
  timerMode?: "frame" | "scene";
  /**
   * Phaser Scene instance. Required when timerMode is "scene".
   * Pass the result of useScene() or a direct scene reference.
   */
  scene?: Phaser.Scene;
}

export interface StateMachineReturn<S extends string> {
  state: Accessor<S>;
  animation: Accessor<string>;
  send: (event: string) => void;
  is: (state: S) => boolean;
  /**
   * Advance the state machine's timer by `delta` milliseconds.
   * Only used when timerMode is "frame" (default).
   * Call this inside a <GameLoop onUpdate> or useFrame callback.
   */
  tick: (delta: number) => void;
}

/**
 * Declarative state machine hook.
 *
 * Supports two timer modes:
 * - "frame" (default): manual tick(delta) for frame-driven games (L0)
 * - "scene": Phaser's scene.time for automatic timers (L4)
 *
 * Usage (frame mode — L0):
 * ```tsx
 * const machine = useStateMachine({
 *   initial: "idle",
 *   states: { idle: { duration: 1000, onComplete: "run" }, run: { ... } }
 * });
 * <GameLoop onUpdate={(_, delta) => machine.tick(delta)} />
 * ```
 *
 * Usage (scene mode — L4):
 * ```tsx
 * const scene = useScene();
 * const machine = useStateMachine({
 *   initial: "idle",
 *   timerMode: "scene",
 *   scene,
 *   states: { idle: { duration: 1000, onComplete: "run" }, run: { ... } }
 * });
 * // No tick() needed — timers managed by Phaser
 * ```
 */
export function useStateMachine<S extends string>(
  config: StateMachineConfig<S>
): StateMachineReturn<S> {
  const mode = config.timerMode ?? "frame";
  const [state, setState] = createSignal<S>(config.initial);

  // Timer state for frame mode
  let elapsed = 0;
  let currentDuration = 0;
  let currentOnComplete: S | null = null;

  // Timer state for scene mode
  let sceneTimer: any = null; // Phaser.Time.TimerEvent
  const scene = config.scene ?? null;

  if (mode === "scene" && !scene) {
    throw new Error(
      'useStateMachine: timerMode "scene" requires a `scene` property in the config. ' +
        "Pass useScene() or a direct Phaser.Scene reference."
    );
  }

  const currentConfig = (): StateConfig<S> => config.states[state()];

  const animation = createMemo<string>(() => {
    const anim = currentConfig().animation;
    if (!anim) return "";
    return typeof anim === "function" ? anim() : anim;
  });

  function setupTimer(stateConfig: StateConfig<S>): void {
    if (!stateConfig.duration || !stateConfig.onComplete) return;

    if (mode === "frame") {
      elapsed = 0;
      currentDuration = stateConfig.duration;
      currentOnComplete = stateConfig.onComplete;
    } else {
      sceneTimer = scene!.time.delayedCall(stateConfig.duration, () => {
        transition(stateConfig.onComplete!);
      });
    }
  }

  function clearTimer(): void {
    if (mode === "frame") {
      elapsed = 0;
      currentDuration = 0;
      currentOnComplete = null;
    } else if (sceneTimer) {
      sceneTimer.remove();
      sceneTimer = null;
    }
  }

  function transition(to: S): void {
    const prev = state();
    if (prev === to) return;

    config.states[prev].onExit?.();
    clearTimer();
    setState(() => to);

    const newConfig = config.states[to];
    newConfig.onEnter?.();
    setupTimer(newConfig);
  }

  const send = (event: string): void => {
    const result = fsmSend(state(), config.states as any, event);
    if (result.transitioned) transition(result.state as S);
  };

  const is = (s: S): boolean => state() === s;

  const tick = (delta: number): void => {
    if (mode !== "frame" || !currentOnComplete || currentDuration <= 0) return;
    const result = fsmStep(
      { current: state() as string, timer: elapsed },
      config.states as any,
      delta,
    );
    elapsed = result.timer;
    if (result.transitioned) transition(result.state as S);
  };

  // Initialize
  onMount(() => {
    const initConfig = config.states[config.initial];
    initConfig.onEnter?.();
    setupTimer(initConfig);
  });

  onCleanup(() => {
    clearTimer();
  });

  return { state, animation, send, is, tick };
}
