/**
 * Reactive ECS System components.
 *
 * Each System is a Solid component that:
 * - Returns null (no visual output)
 * - Registers a useFrame callback to process entities each frame
 * - Reads/writes a createStore via a user-provided update function
 *
 * Systems are composed by JSX ordering:
 *   <GameLoop>
 *     <SpringSystem ... />      ← runs first
 *     <OverlapSystem ... />     ← runs second
 *   </GameLoop>
 *
 * JSX child order = frame execution order.
 */

import { onCleanup } from "solid-js";

/**
 * Generic System component.
 *
 * Registers a frame callback that calls the user's `update` function
 * every frame. The update function receives time and delta, and is
 * expected to read/write a createStore via captured closure.
 *
 * Usage:
 * ```tsx
 * <System update={(time, delta) => {
 *   batch(() => {
 *     for (const fish of store.fish) {
 *       if (!fish.active) continue;
 *       const result = springStep(fish, fish.springConfig, delta / 1000);
 *       setStore("fish", store.fish.indexOf(fish), result);
 *     }
 *   });
 * }} />
 * ```
 */
export interface SystemProps {
  update: (time: number, delta: number) => void;
}

/**
 * Create a System component that uses a FrameManager for frame callbacks.
 *
 * Since Systems run outside <Game> context (they're composed at the app level),
 * the FrameManager must be provided explicitly. This factory creates a System
 * bound to a specific FrameManager.
 *
 * Usage:
 * ```tsx
 * const fm = createFrameManager();
 * const System = createSystem(fm);
 *
 * <System update={(t, d) => { ... }} />
 * ```
 */
export function createSystemFactory(
  register: (cb: (time: number, delta: number) => void) => () => void
) {
  return function System(props: SystemProps): null {
    const unregister = register(props.update);
    onCleanup(unregister);
    return null;
  };
}
