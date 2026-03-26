/**
 * Reactive ECS System components and iteration utilities.
 *
 * Each System is a Solid component that:
 * - Returns null (no visual output)
 * - Registers a frame callback to process entities
 * - Reads/writes a createStore via a user-provided update function
 *
 * Systems support three execution phases per frame:
 *   "pre"  — React to store changes from the previous frame (discrete)
 *   "main" — Physics, timers, dt integration (default, continuous)
 *   "post" — React to results of current frame's physics (discrete)
 *
 * Systems are composed by JSX ordering within each phase:
 *   <Game>
 *     <System phase="pre"  update={reactToStateChanges} />
 *     <System              update={physics} />
 *     <System phase="post" update={overlapDetection} />
 *   </Game>
 */

import { createEffect, on, onCleanup, createRoot } from "solid-js";
import { batch } from "solid-js";
import { useFrameManager } from "../contexts";
import type { FramePhase } from "../core/frame";

export interface SystemProps {
  update: (time: number, delta: number) => void;
  /** Optional guard — when provided, update is skipped if it returns false. */
  when?: () => boolean;
  /** Execution phase within a frame. Default: "main". */
  phase?: FramePhase;
}

/**
 * System component that auto-resolves FrameManager from context.
 *
 * Place inside <Game> or <Scene>. Each System registers one frame callback
 * in the specified phase.
 *
 * Usage:
 * ```tsx
 * <Game>
 *   <System phase="pre" update={() => {
 *     // React to state changes from previous frame
 *   }} />
 *   <System update={(time, delta) => {
 *     // Physics (runs in "main" phase by default)
 *     forActive(store.fish, (f, i) => {
 *       const next = springStep(f, config, delta / 1000);
 *       setStore("fish", i, next);
 *     });
 *   }} />
 *   <System phase="post" update={() => {
 *     // React to physics results (overlap detection, etc.)
 *   }} />
 * </Game>
 * ```
 */
export function System(props: SystemProps): null {
  const fm = useFrameManager();
  const unregister = fm.register((time, delta) => {
    if (props.when && !props.when()) return;
    props.update(time, delta);
  }, props.phase);
  onCleanup(unregister);
  return null;
}

/**
 * Create a System component bound to an explicit FrameManager.
 *
 * Use this when Systems run outside <Game>/<Scene> context
 * and the FrameManager must be provided manually.
 */
export function createSystemFactory(
  register: (cb: (time: number, delta: number) => void, phase?: FramePhase) => () => void
) {
  return function BoundSystem(props: SystemProps): null {
    const unregister = register((time, delta) => {
      if (props.when && !props.when()) return;
      props.update(time, delta);
    }, props.phase);
    onCleanup(unregister);
    return null;
  };
}

/**
 * Iterate over active entities in a store array, wrapped in batch().
 *
 * Encapsulates the common ECS pattern:
 *   batch → for-loop → active filter → callback
 *
 * Usage:
 * ```tsx
 * forActive(store.fish, (fish, index) => {
 *   const next = springStep(fish, config, dt);
 *   setStore("fish", index, next);
 * });
 * ```
 */
export function forActive<T extends { active: boolean }>(
  entities: readonly T[],
  fn: (entity: T, index: number) => void,
): void {
  batch(() => {
    for (let i = 0; i < entities.length; i++) {
      if (entities[i].active) fn(entities[i], i);
    }
  });
}

/**
 * Create a reactive index set that tracks which entity indices match a condition.
 *
 * Uses SolidJS's fine-grained reactivity: when an entity's tracked property
 * changes, only that entity's membership in the set is re-evaluated (O(1)).
 * Systems iterate the set instead of scanning all entities (O(set.size)).
 *
 * Call within a reactive root (e.g., inside a component or createRoot).
 *
 * Usage:
 * ```tsx
 * const hungrySet = createIndex(
 *   () => store.fish.length,
 *   (i) => store.fish[i].active && store.fish[i].fsmState === "hungry",
 * );
 *
 * <System phase="pre" update={() => {
 *   for (const i of hungrySet) {
 *     // Only hungry fish — O(hungrySet.size), not O(N)
 *   }
 * }} />
 * ```
 */
export function createIndex(
  length: () => number,
  predicate: (index: number) => boolean,
): ReadonlySet<number> {
  const set = new Set<number>();
  const disposers: (() => void)[] = [];

  let currentLength = 0;

  createEffect(on(length, (len) => {
    // Remove effects for indices that no longer exist
    while (currentLength > len) {
      currentLength--;
      set.delete(currentLength);
      const dispose = disposers.pop();
      if (dispose) dispose();
    }
    // Add effects for new indices
    while (currentLength < len) {
      const idx = currentLength;
      let dispose: (() => void) | undefined;
      createRoot((d) => {
        dispose = d;
        createEffect(on(
          () => predicate(idx),
          (matches) => {
            if (matches) set.add(idx);
            else set.delete(idx);
          },
        ));
      });
      disposers.push(dispose!);
      currentLength++;
    }
  }));

  onCleanup(() => {
    for (const d of disposers) d();
    disposers.length = 0;
    set.clear();
  });

  return set;
}
