/**
 * Reactive ECS System components and iteration utilities.
 *
 * Each System is a Solid component that:
 * - Returns null (no visual output)
 * - Registers a useFrame callback to process entities each frame
 * - Reads/writes a createStore via a user-provided update function
 *
 * Systems are composed by JSX ordering:
 *   <Game>
 *     <System update={(time, delta) => { ... }} />  ← runs first
 *     <System update={(time, delta) => { ... }} />  ← runs second
 *   </Game>
 *
 * JSX child order = frame execution order.
 */

import { onCleanup } from "solid-js";
import { batch } from "solid-js";
import { useFrameManager } from "../contexts";

export interface SystemProps {
  update: (time: number, delta: number) => void;
  /** Optional guard — when provided, update is skipped if it returns false. */
  when?: () => boolean;
}

/**
 * System component that auto-resolves FrameManager from context.
 *
 * Place inside <Game> or <Scene> — it reads the FrameManager context
 * automatically. Each <System> registers one frame callback.
 *
 * Usage:
 * ```tsx
 * <Game>
 *   <System when={() => phase() === "play"} update={(time, delta) => {
 *     forActive(store.fish, (f, i) => {
 *       const next = springStep(f, config, delta / 1000);
 *       setStore("fish", i, next);
 *     });
 *   }} />
 * </Game>
 * ```
 */
export function System(props: SystemProps): null {
  const fm = useFrameManager();
  const unregister = fm.register((time, delta) => {
    if (props.when && !props.when()) return;
    props.update(time, delta);
  });
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
  register: (cb: (time: number, delta: number) => void) => () => void
) {
  return function BoundSystem(props: SystemProps): null {
    const unregister = register((time, delta) => {
      if (props.when && !props.when()) return;
      props.update(time, delta);
    });
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
