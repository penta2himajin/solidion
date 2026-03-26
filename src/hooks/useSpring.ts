import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";
import { springStep, type SpringState } from "../recs/steps";

export interface SpringConfig {
  target: Accessor<{ x: number; y: number }>;
  stiffness?: number;
  damping?: number;
  mass?: number;
  /** Initial position. Defaults to target's initial value. */
  initial?: { x: number; y: number };
}

/**
 * Spring physics hook — N=1 wrapper around springStep.
 * Follows a reactive target with spring dynamics.
 * Output is a Signal of {x, y} — the current spring position.
 */
export function useSpring(config: SpringConfig): Accessor<{ x: number; y: number }> {
  const stiffness = config.stiffness ?? 200;
  const damping = config.damping ?? 20;
  const mass = config.mass ?? 1;

  const initialTarget = config.target();
  let state: SpringState = {
    x: config.initial?.x ?? initialTarget.x,
    y: config.initial?.y ?? initialTarget.y,
    vx: 0,
    vy: 0,
  };

  const [pos, setPos] = createSignal({ x: state.x, y: state.y });

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05); // Cap dt to prevent instability
    const target = config.target();

    state = springStep(state, {
      targetX: target.x,
      targetY: target.y,
      stiffness,
      damping,
      mass,
    }, dt);

    setPos({ x: state.x, y: state.y });
  });

  return pos;
}
