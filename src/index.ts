/**
 * Solidion — SolidJS custom renderer for Phaser 3.
 * Declarative 2D game development with progressive disclosure.
 *
 * This is the main entry point (L0–L1c). Most games need only this.
 * For frame-aware escape hatches, see "solidion/core".
 * For reactive ECS, see "solidion/ecs".
 * For debug utilities, see "solidion/debug".
 */

// Types (JSX IntrinsicElements declaration)
import "./types";
export type {
  TransformProps, DisplayProps, OriginProps, SizeProps,
  EventProps, InteractiveProps, RefProps, BaseProps,
  SpriteProps, ImageProps, TextProps, RectangleProps,
  EllipseProps, ArcProps, StarProps, GraphicsProps,
  ContainerProps, NineSliceProps, ZoneProps,
} from "./types";

// Components
export { Game, createGame, type GameProps } from "./components/Game";
export { Scene, type SceneProps } from "./components/Scene";
export { Preload, usePreload, type PreloadProps, type AssetSpec } from "./components/Preload";
export { Overlay, type OverlayProps } from "./components/Overlay";
export { GameLoop, type GameLoopProps } from "./components/GameLoop";

// Control flow (Solidion versions — compatible with universal renderer)
export { Show, type ShowProps } from "./components/Show";
export { For, Index, type ForProps, type IndexProps } from "./components/For";

// Contexts & accessors
export { useGame, useScene, useParentNode } from "./contexts";

// Hooks: L1a discrete behaviors
export { useTween, type TweenConfig } from "./hooks/useTween";
export { useStateMachine, type StateMachineConfig, type StateConfig, type StateMachineReturn } from "./hooks/useStateMachine";
export { useSequence, type SequenceStep, type SequenceReturn } from "./hooks/useSequence";
export { useOverlap, type OverlapConfig } from "./hooks/useOverlap";

// Hooks: L1b continuous behaviors
export { useSpring, type SpringConfig } from "./hooks/useSpring";
export { useFollow, type FollowConfig } from "./hooks/useFollow";
export { useOscillation, type OscillationConfig } from "./hooks/useOscillation";
export { useVelocity, type VelocityConfig } from "./hooks/useVelocity";

// L1c behavior composition components
export {
  SpringBehavior, type SpringBehaviorProps,
  OscillateBehavior, type OscillateBehaviorProps,
  FollowBehavior, type FollowBehaviorProps,
  VelocityBehavior, type VelocityBehaviorProps,
} from "./behaviors";
