/**
 * Frame callback management.
 * Manages per-scene frame callbacks that are batched within Solid's batch().
 */

export type FrameCallback = (time: number, delta: number) => void;

export interface FrameManager {
  register(callback: FrameCallback): () => void;
  update(time: number, delta: number): void;
}

export function createFrameManager(): FrameManager {
  const callbacks = new Set<FrameCallback>();

  return {
    register(callback: FrameCallback): () => void {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },

    update(time: number, delta: number): void {
      for (const cb of callbacks) {
        cb(time, delta);
      }
    },
  };
}
