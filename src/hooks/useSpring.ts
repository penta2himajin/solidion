import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";

export interface SpringConfig {
  target: Accessor<{ x: number; y: number }>;
  stiffness?: number;
  damping?: number;
  mass?: number;
  /** Initial position. Defaults to target's initial value. */
  initial?: { x: number; y: number };
}

/**
 * Spring physics hook.
 * Follows a reactive target with spring dynamics.
 * Output is a Signal of {x, y} — the current spring position.
 */
export function useSpring(config: SpringConfig): Accessor<{ x: number; y: number }> {
  const stiffness = config.stiffness ?? 200;
  const damping = config.damping ?? 20;
  const mass = config.mass ?? 1;

  const initialTarget = config.target();
  let currentX = config.initial?.x ?? initialTarget.x;
  let currentY = config.initial?.y ?? initialTarget.y;
  let velocityX = 0;
  let velocityY = 0;

  const [pos, setPos] = createSignal({ x: currentX, y: currentY });

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05); // Cap dt to prevent instability
    const target = config.target();

    const forceX = -stiffness * (currentX - target.x) - damping * velocityX;
    const forceY = -stiffness * (currentY - target.y) - damping * velocityY;

    velocityX += (forceX / mass) * dt;
    velocityY += (forceY / mass) * dt;
    currentX += velocityX * dt;
    currentY += velocityY * dt;

    setPos({ x: currentX, y: currentY });
  });

  return pos;
}
