/**
 * solidion/core — Frame-aware escape hatch.
 *
 * Using this module means you're thinking about frame loops, performance,
 * and Phaser internals. For most games, the top-level "solidion" entry
 * (L0–L1c) is sufficient.
 *
 * Analogous to solid-js/web: runtime-specific primitives that <Game>
 * normally encapsulates for you.
 */

// Renderer primitives (solid-js/universal createRenderer outputs)
export {
  render, effect, memo, createComponent,
  createElement, createTextNode, insertNode,
  insert, spread, setProp, mergeProps,
} from "../renderer";

// Frame management
export { useFrame } from "../hooks/useFrame";
export { useTime } from "../hooks/useTime";
export { createFrameManager, type FrameManager, type FrameCallback, type FramePhase } from "./frame";

// Sync
export { solidionFrameUpdate } from "./sync";

// Meta & Delta
export { addDelta, removeDelta, getMeta } from "./meta";

// Props
export { composeProp, applyProp, reapplyProp, setPhaserProp } from "./props";

// Scene Stack
export { pushScene, popScene, getCurrentScene } from "./scene-stack";

// Events
export { isEventProp, resolveEventName } from "./events";

// Texture
export { parseTextureRef, ensureTexture, preloadAssets } from "./texture";
