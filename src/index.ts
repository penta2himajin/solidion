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
  ContainerProps, NineSliceProps, ZoneProps,
} from "./types";

// Renderer
export { render } from "./renderer";

// Components
export { Game, createGame, type GameProps } from "./components/Game";
export { Scene, type SceneProps } from "./components/Scene";
export { Preload, usePreload, type PreloadProps, type AssetSpec } from "./components/Preload";
export { Overlay, type OverlayProps } from "./components/Overlay";

// Contexts & accessors
export { useGame, useScene, useParentNode } from "./contexts";

// Hooks: L1a discrete behaviors
export { useFrame } from "./hooks/useFrame";
export { useTime } from "./hooks/useTime";
export { useTween, type TweenConfig } from "./hooks/useTween";
export { useStateMachine, type StateMachineConfig, type StateConfig, type StateMachineReturn } from "./hooks/useStateMachine";
export { useSequence, type SequenceStep, type SequenceReturn } from "./hooks/useSequence";

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
export { parseTextureRef, ensureTexture, preloadAssets } from "./core/texture";
export { pushScene, popScene, getCurrentScene } from "./core/scene-stack";
export { composeProp, applyProp, reapplyProp, setPhaserProp } from "./core/props";
export { createFrameManager, type FrameManager } from "./core/frame";
export { solidionFrameUpdate } from "./core/sync";
