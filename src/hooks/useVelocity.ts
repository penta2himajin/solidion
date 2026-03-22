import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";

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
 * Velocity-based motion hook.
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
  let posX = config.initial?.x ?? 0;
  let posY = config.initial?.y ?? 0;
  let velX = config.velocity?.x ?? 0;
  let velY = config.velocity?.y ?? 0;
  const accX = config.acceleration?.x ?? 0;
  const accY = config.acceleration?.y ?? 0;
  const bounceCoeff = config.bounce ?? 0;
  let active = false;

  const [pos, setPos] = createSignal({ x: posX, y: posY });

  useFrame((_time, delta) => {
    if (!active) return;

    const dt = Math.min(delta / 1000, 0.05);

    velX += accX * dt;
    velY += accY * dt;
    posX += velX * dt;
    posY += velY * dt;

    // Bounds check with bounce
    if (config.bounds?.x) {
      const [min, max] = config.bounds.x;
      if (posX < min) {
        posX = min;
        velX = Math.abs(velX) * bounceCoeff;
      } else if (posX > max) {
        posX = max;
        velX = -Math.abs(velX) * bounceCoeff;
      }
    }
    if (config.bounds?.y) {
      const [min, max] = config.bounds.y;
      if (posY < min) {
        posY = min;
        velY = Math.abs(velY) * bounceCoeff;
      } else if (posY > max) {
        posY = max;
        velY = -Math.abs(velY) * bounceCoeff;
      }
    }

    setPos({ x: posX, y: posY });
  });

  const reset = (position: { x: number; y: number }, velocity: { x: number; y: number }) => {
    posX = position.x;
    posY = position.y;
    velX = velocity.x;
    velY = velocity.y;
    setPos({ x: posX, y: posY });
  };

  const setActiveFlag = (v: boolean) => {
    active = v;
  };

  return { pos, reset, setActive: setActiveFlag };
}
