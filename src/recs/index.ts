/**
 * RECS — Reactive Entity Component System for Solidion.
 *
 * Unlike traditional ECS where systems imperatively scan all entities
 * every frame, RECS leverages SolidJS's fine-grained reactivity:
 * - Store changes propagate automatically to rendering (reactive data → display)
 * - createIndex tracks entity state changes at O(1) per change (reactive index)
 * - Phased Systems (pre/main/post) separate discrete reactions from continuous physics
 *
 * Three execution phases per frame:
 *   "pre"  — React to store changes from the previous frame
 *   "main" — Physics, timers, dt integration (default)
 *   "post" — React to current frame's physics results
 *
 * Use this pattern when:
 * - You have many entities of the same type (10+ fish, 30+ bullets)
 * - Entities share the same behavior definitions
 * - You want all state in a single createStore
 *
 * Use hooks (useSpring, useStateMachine, etc.) when:
 * - You have few entities (1-5 characters)
 * - Each entity has unique, complex behavior
 * - Behavior is tightly coupled to the component's visual structure
 */

// Pure step functions — no Signals, no effects, just math
export {
  springStep, type SpringState, type SpringConfig,
  oscillationStep, type OscillationConfig,
  velocityStep, type VelocityState, type VelocityConfig,
  followStep, type FollowConfig,
  fsmStep, fsmSend, type FSMState, type FSMStateConfig, type FSMStepResult,
  tweenStep, tweenLerp, type TweenState, type TweenConfig, type TweenStepResult,
} from "./steps";

// System components + iteration utilities + reactive index
export {
  System, createSystemFactory, forActive, createIndex,
  type SystemProps,
} from "./systems";

// Re-export FramePhase for convenience
export type { FramePhase } from "../core/frame";
