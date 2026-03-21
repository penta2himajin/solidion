import { onCleanup } from "solid-js";
import { useFrameManager } from "../contexts";

/**
 * Register a callback to be called every frame during Scene.update.
 * The callback runs inside Solid's batch() for consistent updates.
 */
export function useFrame(callback: (time: number, delta: number) => void): void {
  const fm = useFrameManager();
  const unregister = fm.register(callback);
  onCleanup(unregister);
}
