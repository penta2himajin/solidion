/**
 * L1c Behavior Composition Components.
 *
 * These are JSX children of GameObjects that declaratively apply
 * deltas to their parent's properties. Multiple behaviors compose
 * additively.
 *
 * Internally, each behavior delegates to the same pure step functions
 * used by the Reactive ECS Systems — behaviors are N=1 wrappers
 * that output deltas instead of absolute positions.
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
import {
  springStep, type SpringState,
  oscillationStep,
  followStep,
  velocityStep, type VelocityState,
} from "../recs/steps";

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
 * Spring behavior — N=1 wrapper around springStep.
 * Outputs delta to parent's x and y.
 */
export function SpringBehavior(props: SpringBehaviorProps): null {
  const id = nextBehaviorId();
  const stiffness = props.stiffness ?? 200;
  const damping = props.damping ?? 20;
  const mass = props.mass ?? 1;

  const initial = props.target();
  let state: SpringState = { x: initial.x, y: initial.y, vx: 0, vy: 0 };

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05);
    const target = props.target();
    state = springStep(state, {
      targetX: target.x, targetY: target.y,
      stiffness, damping, mass,
    }, dt);
    applyBehaviorDelta(props.parent, id, { x: state.x, y: state.y });
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
 * Oscillation behavior — N=1 wrapper around oscillationStep.
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
    const result = oscillationStep(t, {
      amplitudeX: ampX, amplitudeY: ampY,
      frequency: freq, phase,
    });
    const delta: Record<string, number> = {};
    if (ampX !== 0) delta.x = result.x;
    if (ampY !== 0) delta.y = result.y;
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
 * Follow behavior — N=1 wrapper around followStep.
 */
export function FollowBehavior(props: FollowBehaviorProps): null {
  const id = nextBehaviorId();
  const speed = props.speed ?? 0.1;

  const initial = props.target();
  let currentX = initial.x;
  let currentY = initial.y;

  useFrame((_time, delta) => {
    const target = props.target();
    const next = followStep(currentX, currentY, {
      targetX: target.x, targetY: target.y, speed,
    }, delta / 1000);
    currentX = next.x;
    currentY = next.y;
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
 * Velocity behavior — N=1 wrapper around velocityStep.
 */
export function VelocityBehavior(props: VelocityBehaviorProps): null {
  const id = nextBehaviorId();
  let state: VelocityState = {
    x: 0, y: 0,
    vx: props.velocity.x, vy: props.velocity.y,
  };
  const stepConfig = {
    ax: props.acceleration?.x ?? 0,
    ay: props.acceleration?.y ?? 0,
    bounce: props.bounce ?? 0,
    boundsX: props.bounds?.x,
    boundsY: props.bounds?.y,
  };

  useFrame((_time, delta) => {
    const dt = Math.min(delta / 1000, 0.05);
    state = velocityStep(state, stepConfig, dt);
    applyBehaviorDelta(props.parent, id, { x: state.x, y: state.y });
  });

  onCleanup(() => removeBehaviorDelta(props.parent, id, ["x", "y"]));
  return null;
}
