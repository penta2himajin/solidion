import { onCleanup } from "solid-js";
import { useFrameManager } from "../contexts";
import type { FramePhase } from "../core/frame";

/**
 * Register a callback to be called every frame during Scene.update.
 * The callback runs inside Solid's batch() for consistent updates.
 *
 * @param callback - Called each frame with (time, delta)
 * @param phase - Execution phase: "pre" (before physics), "main" (default), "post" (after physics)
 */
export function useFrame(
  callback: (time: number, delta: number) => void,
  phase?: FramePhase,
): void {
  const fm = useFrameManager();
  const unregister = fm.register(callback, phase);
  onCleanup(unregister);
}
