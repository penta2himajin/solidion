/**
 * solidionFrameUpdate: The core frame synchronization mechanism.
 *
 * Called from Scene.update(), wraps all frame callbacks in Solid's batch()
 * to ensure GameObjects are updated atomically before Phaser renders.
 *
 * Processing order within a frame:
 *   Phaser TweenManager.update() → Physics.update()
 *   → Scene.update() → solidionFrameUpdate()
 *       → batch(() => {
 *           tween buffer flush (via registered callbacks)
 *           useFrame callbacks
 *           behavior delta calculations
 *         })
 *       → batch ends: Solid flushes all Signal changes
 *       → setProp calls execute → GameObjects updated
 *   → Phaser Renderer.render() ← consistent state guaranteed
 */

import { batch } from "solid-js";
import type { FrameManager } from "./frame";
import { frameStart, frameEnd } from "../debug";

export function solidionFrameUpdate(
  frameManager: FrameManager,
  time: number,
  delta: number
): void {
  frameStart();
  batch(() => {
    frameManager.update(time, delta);
  });
  frameEnd();
}
