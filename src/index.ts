/**
 * Solidion — SolidJS custom renderer for Phaser 3.
 * Declarative 2D game development with progressive disclosure.
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

// Renderer primitives (for imperative usage and examples)
export {
  render, effect, memo, createComponent,
  createElement, createTextNode, insertNode,
  insert, setProp, mergeProps, spread,
} from "./renderer";

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
export { useFrame } from "./hooks/useFrame";
export { useTime } from "./hooks/useTime";
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

// Core utilities (exposed for L4 advanced usage)
export { addDelta, removeDelta, getMeta } from "./core/meta";
export { isEventProp, resolveEventName } from "./core/events";
export { parseTextureRef, ensureTexture, preloadAssets } from "./core/texture";
export { pushScene, popScene, getCurrentScene } from "./core/scene-stack";
export { composeProp, applyProp, reapplyProp, setPhaserProp } from "./core/props";
export { createFrameManager, type FrameManager } from "./core/frame";
export { solidionFrameUpdate } from "./core/sync";

// Debug utilities
export * as debug from "./debug";
