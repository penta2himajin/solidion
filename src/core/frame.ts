/**
 * Frame callback management.
 * Manages per-scene frame callbacks that are batched within Solid's batch().
 *
 * Execution order within a frame:
 *   1. "pre"  — Discrete systems: react to store changes from the previous frame
 *   2. "main" — Continuous systems: physics, timers, dt integration (default)
 *   3. "post" — Discrete systems: react to results of the current frame's physics
 */

export type FrameCallback = (time: number, delta: number) => void;
export type FramePhase = "pre" | "main" | "post";

export interface FrameManager {
  register(callback: FrameCallback, phase?: FramePhase): () => void;
  update(time: number, delta: number): void;
}

export function createFrameManager(): FrameManager {
  const phases = {
    pre:  new Set<FrameCallback>(),
    main: new Set<FrameCallback>(),
    post: new Set<FrameCallback>(),
  };

  return {
    register(callback: FrameCallback, phase: FramePhase = "main"): () => void {
      phases[phase].add(callback);
      return () => phases[phase].delete(callback);
    },

    update(time: number, delta: number): void {
      for (const cb of phases.pre)  cb(time, delta);
      for (const cb of phases.main) cb(time, delta);
      for (const cb of phases.post) cb(time, delta);
    },
  };
}
