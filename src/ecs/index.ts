/**
 * Reactive ECS — Entity Component System pattern for Solidion.
 *
 * Combines createStore (reactive entity data) with pure step functions
 * (system logic) and System components (frame execution).
 *
 * Use this pattern when:
 * - You have many entities of the same type (10+ fish, 30+ bullets)
 * - Entities share the same behavior definitions
 * - You want all state in a single createStore
 * - You want System execution order to be declarative (JSX ordering)
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

// System component factory
export { createSystemFactory, type SystemProps } from "./systems";
