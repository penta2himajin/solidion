/**
 * Solidion's <For> and <Index> components.
 *
 * Both render the initial list into GameObjects and support reactive
 * list changes by toggling visibility. They differ in HOW they track
 * items when the list changes:
 *
 * - **<For>**: identity-based — an item is "present" if it still exists
 *   in the list by reference equality. When an item is removed from
 *   the list, its GameObjects are hidden. Useful for entity collections
 *   (enemies, projectiles) where items have stable identities.
 *
 * - **<Index>**: position-based — slot N is "present" if the list has
 *   at least N+1 items. When the list shrinks, excess slots are hidden.
 *   Useful for fixed grids (blocks, inventory slots) where position matters.
 *
 * ## Reactive list example
 *
 * ```tsx
 * const [enemies, setEnemies] = createSignal([enemy1, enemy2, enemy3]);
 *
 * // For: enemy2's GameObjects hide when removed by identity
 * <For each={enemies()}>
 *   {(enemy, i) => <rectangle x={enemy.x} y={enemy.y} ... />}
 * </For>
 *
 * // Remove enemy2 — its node hides, others stay
 * setEnemies(prev => prev.filter(e => e !== enemy2));
 * ```
 *
 * ## Limitations
 *
 * GameObjects are created at initial render time only. Items added
 * beyond the initial list size cannot be rendered (pool is fixed).
 * For truly dynamic spawning, use object pools with visibility toggling
 * or imperative create/destroy via useScene() (L4).
 */

import { createEffect } from "solid-js";
import { setVisibleRecursive } from "../core/visibility";

// ── For: identity-based ──

export interface ForProps<T> {
  each: readonly T[];
  children: (item: T, index: number) => any;
}

/**
 * Render a list of items tracked by identity (reference equality).
 * When the list changes, items no longer in it are hidden.
 */
export function For<T>(props: ForProps<T>): any {
  const initialItems = props.each;
  const entries = initialItems.map((item, i) => ({
    item,
    node: props.children(item, i),
  }));

  // Watch for list changes — hide nodes whose items are no longer present
  createEffect(() => {
    const currentItems = new Set(props.each);
    for (const entry of entries) {
      setVisibleRecursive(entry.node, currentItems.has(entry.item));
    }
  });

  return entries.map(e => e.node);
}

// ── Index: position-based ──

export interface IndexProps<T> {
  each: readonly T[];
  children: (item: T, index: number) => any;
}

/**
 * Render a list of items tracked by position (index).
 * When the list shrinks, excess slots are hidden.
 */
export function Index<T>(props: IndexProps<T>): any {
  const initialItems = props.each;
  const nodes = initialItems.map((item, i) => props.children(item, i));

  // Watch for list changes — hide slots beyond current length
  createEffect(() => {
    const currentLength = props.each.length;
    for (let i = 0; i < nodes.length; i++) {
      setVisibleRecursive(nodes[i], i < currentLength);
    }
  });

  return nodes;
}
