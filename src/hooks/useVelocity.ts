import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";

export interface VelocityConfig {
  initial: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration?: { x: number; y: number };
  bounds?: {
    x?: [number, number];
    y?: [number, number];
  };
  /** Bounce coefficient (0-1). Default 0 (no bounce). */
  bounce?: number;
}

/**
 * Velocity-based motion hook.
 * Integrates position from velocity and acceleration each frame.
 */
export function useVelocity(config: VelocityConfig): Accessor<{ x: number; y: number }> {
  let posX = config.initial.x;
  let posY = config.initial.y;
  let velX = config.velocity.x;
  let velY = config.velocity.y;
  const accX = config.acceleration?.x ?? 0;
  const accY = config.acceleration?.y ?? 0;
  const bounceCoeff = config.bounce ?? 0;

  const [pos, setPos] = createSignal({ x: posX, y: posY });

  useFrame((_time, delta) => {
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

  return pos;
}
