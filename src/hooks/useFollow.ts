import { createSignal, type Accessor } from "solid-js";
import { useFrame } from "./useFrame";
import { followStep } from "../recs/steps";

export interface FollowConfig {
  target: Accessor<{ x: number; y: number }>;
  /** Follow speed. 0 = no movement, 1 = instant snap. Default 0.1 */
  speed?: number;
  initial?: { x: number; y: number };
}

/**
 * Smooth exponential-decay following hook — N=1 wrapper around followStep.
 * Follows a reactive target with configurable smoothing.
 */
export function useFollow(config: FollowConfig): Accessor<{ x: number; y: number }> {
  const speed = config.speed ?? 0.1;

  const initialTarget = config.target();
  let currentX = config.initial?.x ?? initialTarget.x;
  let currentY = config.initial?.y ?? initialTarget.y;

  const [pos, setPos] = createSignal({ x: currentX, y: currentY });

  useFrame((_time, delta) => {
    const target = config.target();
    const next = followStep(currentX, currentY, {
      targetX: target.x,
      targetY: target.y,
      speed,
    }, delta / 1000);
    currentX = next.x;
    currentY = next.y;
    setPos(next);
  });

  return pos;
}
