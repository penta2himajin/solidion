import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";
import { velocityStep, type VelocityState } from "../recs/steps";

export interface VelocityConfig {
  initial?: { x: number; y: number };
  velocity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
  bounds?: {
    x?: [number, number];
    y?: [number, number];
  };
  /** Bounce coefficient (0-1). Default 0 (no bounce). */
  bounce?: number;
}

export interface VelocityReturn {
  /** Current position (reactive) */
  pos: Accessor<{ x: number; y: number }>;
  /** Reset position and velocity for pool reactivation */
  reset: (position: { x: number; y: number }, velocity: { x: number; y: number }) => void;
  /** Pause/resume integration. When false, position stops updating. */
  setActive: (v: boolean) => void;
}

/**
 * Velocity-based motion hook — N=1 wrapper around velocityStep.
 * Integrates position from velocity and acceleration each frame.
 *
 * Supports object pooling via reset() and setActive():
 * ```tsx
 * const vel = useVelocity({ bounce: 0 });
 * // Activate: vel.reset({ x: 100, y: 400 }, { x: 0, y: -50 }); vel.setActive(true);
 * // Deactivate: vel.setActive(false);
 * ```
 */
export function useVelocity(config: VelocityConfig = {}): VelocityReturn {
  let state: VelocityState = {
    x: config.initial?.x ?? 0,
    y: config.initial?.y ?? 0,
    vx: config.velocity?.x ?? 0,
    vy: config.velocity?.y ?? 0,
  };
  const stepConfig = {
    ax: config.acceleration?.x ?? 0,
    ay: config.acceleration?.y ?? 0,
    bounce: config.bounce ?? 0,
    boundsX: config.bounds?.x,
    boundsY: config.bounds?.y,
  };
  let active = false;

  const [pos, setPos] = createSignal({ x: state.x, y: state.y });

  useFrame((_time, delta) => {
    if (!active) return;
    const dt = Math.min(delta / 1000, 0.05);
    state = velocityStep(state, stepConfig, dt);
    setPos({ x: state.x, y: state.y });
  });

  const reset = (position: { x: number; y: number }, velocity: { x: number; y: number }) => {
    state = { x: position.x, y: position.y, vx: velocity.x, vy: velocity.y };
    setPos({ x: state.x, y: state.y });
  };

  const setActiveFlag = (v: boolean) => {
    active = v;
  };

  return { pos, reset, setActive: setActiveFlag };
}
