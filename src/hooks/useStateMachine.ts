import { createSignal, createMemo, onMount, onCleanup, type Accessor } from "solid-js";
import { useScene } from "../contexts";

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
}

export interface StateMachineReturn<S extends string> {
  state: Accessor<S>;
  animation: Accessor<string>;
  send: (event: string) => void;
  is: (state: S) => boolean;
}

/**
 * Declarative state machine hook.
 * State machine logic is pure Solid. Timers use Phaser's scene.time
 * for proper pause/resume/timeScale integration.
 */
export function useStateMachine<S extends string>(
  config: StateMachineConfig<S>
): StateMachineReturn<S> {
  const scene = useScene();
  const [state, setState] = createSignal<S>(config.initial);
  let timer: Phaser.Time.TimerEvent | null = null;

  const currentConfig = (): StateConfig<S> => config.states[state()];

  const animation = createMemo<string>(() => {
    const anim = currentConfig().animation;
    if (!anim) return "";
    return typeof anim === "function" ? anim() : anim;
  });

  const transition = (to: S): void => {
    const prev = state();
    if (prev === to) return;

    // Exit previous state
    config.states[prev].onExit?.();

    // Clear timer
    if (timer) {
      timer.remove();
      timer = null;
    }

    // Update state
    setState(() => to);

    // Enter new state
    const newConfig = config.states[to];
    newConfig.onEnter?.();

    // Set up auto-transition timer
    if (newConfig.duration && newConfig.onComplete) {
      timer = scene.time.delayedCall(newConfig.duration, () => {
        transition(newConfig.onComplete!);
      });
    }
  };

  const send = (event: string): void => {
    const transitions = currentConfig().on;
    if (transitions && event in transitions) {
      const target = transitions[event as keyof typeof transitions];
      if (target) {
        transition(target);
      }
    }
  };

  const is = (s: S): boolean => state() === s;

  // Initialize: run onEnter for initial state and set up timer
  onMount(() => {
    const initConfig = config.states[config.initial];
    initConfig.onEnter?.();

    if (initConfig.duration && initConfig.onComplete) {
      timer = scene.time.delayedCall(initConfig.duration, () => {
        transition(initConfig.onComplete!);
      });
    }
  });

  onCleanup(() => {
    if (timer) {
      timer.remove();
      timer = null;
    }
  });

  return { state, animation, send, is };
}
