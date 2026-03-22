import { useFrame } from "./useFrame";

export interface OverlapConfig<S, T> {
  /** Source entities (re-evaluated each frame) */
  sources: () => S[];
  /** Target entities (re-evaluated each frame) */
  targets: () => T[];
  /** Extract position from an entity */
  getPosition: (item: S | T) => { x: number; y: number };
  /** Distance threshold for overlap detection */
  threshold: number;
  /**
   * Detection mode:
   * - "all": callback fires for every overlapping pair
   * - "nearest": callback fires once per source with its nearest target
   */
  mode?: "all" | "nearest";
  /** Called when overlap is detected */
  onOverlap: (source: S, target: T, distance: number) => void;
}

/**
 * Declarative overlap detection hook (L1a).
 *
 * Checks N×M distance between sources and targets each frame.
 * Runs inside solidionFrameUpdate batch for consistent state updates.
 *
 * Usage:
 * ```tsx
 * useOverlap({
 *   sources: () => fish.filter(f => f.active),
 *   targets: () => food.filter(f => f.active),
 *   getPosition: (item) => ({ x: item.x, y: item.y }),
 *   threshold: 150,
 *   mode: "nearest",
 *   onOverlap: (fish, food, dist) => { ... },
 * });
 * ```
 */
export function useOverlap<S, T>(config: OverlapConfig<S, T>): void {
  const mode = config.mode ?? "all";

  useFrame(() => {
    const sources = config.sources();
    const targets = config.targets();
    if (sources.length === 0 || targets.length === 0) return;

    const threshold = config.threshold;
    const thresholdSq = threshold * threshold;

    if (mode === "nearest") {
      // For each source, find the nearest target within threshold
      for (const src of sources) {
        const sp = config.getPosition(src);
        let nearest: T | null = null;
        let nearestDistSq = Infinity;

        for (const tgt of targets) {
          const tp = config.getPosition(tgt as any);
          const dx = tp.x - sp.x;
          const dy = tp.y - sp.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < thresholdSq && distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = tgt;
          }
        }

        if (nearest !== null) {
          config.onOverlap(src, nearest, Math.sqrt(nearestDistSq));
        }
      }
    } else {
      // "all" mode: fire for every overlapping pair
      for (const src of sources) {
        const sp = config.getPosition(src);
        for (const tgt of targets) {
          const tp = config.getPosition(tgt as any);
          const dx = tp.x - sp.x;
          const dy = tp.y - sp.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < thresholdSq) {
            config.onOverlap(src, tgt, Math.sqrt(distSq));
          }
        }
      }
    }
  });
}
