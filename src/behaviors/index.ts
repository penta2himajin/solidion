/**
 * L1c Behavior Composition Components.
 *
 * These are JSX children of GameObjects that declaratively apply
 * deltas to their parent's properties. Multiple behaviors compose
 * additively.
 *
 * Usage:
 * ```tsx
 * <sprite texture="char.png" x={200} y={300}>
 *   <Spring target={() => targetPos()} stiffness={200} damping={20} />
 *   <Show when={excited()}>
 *     <Oscillate amplitude={{ y: 10 }} frequency={5} />
 *   </Show>
 * </sprite>
 * ```
 */

import { onCleanup, type Accessor } from "solid-js";
import { addDelta, removeDelta } from "../core/meta";
import { reapplyProp } from "../core/props";
import { useFrame } from "../hooks/useFrame";

let _behaviorId = 0;
function nextBehaviorId(): string {
  return `__behavior_${++_behaviorId}`;
}

/**
 * Apply deltas to a parent node and trigger re-composition of affected props.
 */
function applyBehaviorDelta(
  parentNode: any,
  behaviorId: string,
  delta: Record<string, number>
): void {
  addDelta(parentNode, behaviorId, delta);
  // Re-apply affected properties so composition takes effect
  for (const prop of Object.keys(delta)) {
    reapplyProp(parentNode, prop);
  }
}

function removeBehaviorDelta(parentNode: any, behaviorId: string, props: string[]): void {
  removeDelta(parentNode, behaviorId);
  for (const prop of props) {
    reapplyProp(parentNode, prop);
  }
}

// ---- Components ----

export interface SpringBehaviorProps {
  parent: any; // Parent Phaser GameObject
  target: Accessor<{ x: number; y: number }>;
  stiffness?: number;
  damping?: number;
  mass?: number;
}

/**
 * Spring behavior: follows a target with spring dynamics.
 * Outputs delta to parent's x and y.
 */
export function SpringBehavior(props: SpringBehaviorProps): null {
  const id = nextBehaviorId();
  const stiffness = props.stiffness ?? 200;
  const damping = props.damping ?? 20;
  const mass = props.mass ?? 1;

  const initial = props.target();
  let currentX = initial.x;
  let currentY = initial.y;
  let velocityX = 0;
  let velocityY = 0;

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05);
    const target = props.target();

    const forceX = -stiffness * (currentX - target.x) - damping * velocityX;
    const forceY = -stiffness * (currentY - target.y) - damping * velocityY;

    velocityX += (forceX / mass) * dt;
    velocityY += (forceY / mass) * dt;
    currentX += velocityX * dt;
    currentY += velocityY * dt;

    applyBehaviorDelta(props.parent, id, { x: currentX, y: currentY });
  });

  onCleanup(() => removeBehaviorDelta(props.parent, id, ["x", "y"]));
  return null;
}

export interface OscillateBehaviorProps {
  parent: any;
  amplitude: Partial<{ x: number; y: number }>;
  frequency?: number;
  phase?: number;
}

/**
 * Oscillation behavior: periodic sine wave motion.
 * Outputs delta to parent's x and/or y.
 */
export function OscillateBehavior(props: OscillateBehaviorProps): null {
  const id = nextBehaviorId();
  const freq = props.frequency ?? 1;
  const phase = props.phase ?? 0;
  const ampX = props.amplitude.x ?? 0;
  const ampY = props.amplitude.y ?? 0;
  const affectedProps = [
    ...(ampX !== 0 ? ["x"] : []),
    ...(ampY !== 0 ? ["y"] : []),
  ];

  useFrame((time) => {
    const t = time / 1000;
    const angle = t * freq * Math.PI * 2 + phase;
    const delta: Record<string, number> = {};
    if (ampX !== 0) delta.x = Math.sin(angle) * ampX;
    if (ampY !== 0) delta.y = Math.sin(angle) * ampY;
    applyBehaviorDelta(props.parent, id, delta);
  });

  onCleanup(() => removeBehaviorDelta(props.parent, id, affectedProps));
  return null;
}

export interface FollowBehaviorProps {
  parent: any;
  target: Accessor<{ x: number; y: number }>;
  speed?: number;
}

/**
 * Follow behavior: smooth exponential decay following.
 */
export function FollowBehavior(props: FollowBehaviorProps): null {
  const id = nextBehaviorId();
  const speed = props.speed ?? 0.1;

  const initial = props.target();
  let currentX = initial.x;
  let currentY = initial.y;

  useFrame((_time, delta) => {
    const target = props.target();
    const factor = 1 - Math.pow(1 - speed, delta / 16.667);
    currentX += (target.x - currentX) * factor;
    currentY += (target.y - currentY) * factor;
    applyBehaviorDelta(props.parent, id, { x: currentX, y: currentY });
  });

  onCleanup(() => removeBehaviorDelta(props.parent, id, ["x", "y"]));
  return null;
}

export interface VelocityBehaviorProps {
  parent: any;
  velocity: { x: number; y: number };
  acceleration?: { x: number; y: number };
  bounds?: { x?: [number, number]; y?: [number, number] };
  bounce?: number;
}

/**
 * Velocity behavior: integrates position from velocity and acceleration.
 */
export function VelocityBehavior(props: VelocityBehaviorProps): null {
  const id = nextBehaviorId();
  let posX = 0;
  let posY = 0;
  let velX = props.velocity.x;
  let velY = props.velocity.y;
  const accX = props.acceleration?.x ?? 0;
  const accY = props.acceleration?.y ?? 0;
  const bounceCoeff = props.bounce ?? 0;

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05);
    velX += accX * dt;
    velY += accY * dt;
    posX += velX * dt;
    posY += velY * dt;

    if (props.bounds?.x) {
      const [min, max] = props.bounds.x;
      if (posX < min) { posX = min; velX = Math.abs(velX) * bounceCoeff; }
      else if (posX > max) { posX = max; velX = -Math.abs(velX) * bounceCoeff; }
    }
    if (props.bounds?.y) {
      const [min, max] = props.bounds.y;
      if (posY < min) { posY = min; velY = Math.abs(velY) * bounceCoeff; }
      else if (posY > max) { posY = max; velY = -Math.abs(velY) * bounceCoeff; }
    }

    applyBehaviorDelta(props.parent, id, { x: posX, y: posY });
  });

  onCleanup(() => removeBehaviorDelta(props.parent, id, ["x", "y"]));
  return null;
}
