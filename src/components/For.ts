/**
 * Solidion's <For> and <Index> components.
 *
 * Unlike solid-js's <For>/<Index> which use memos and dynamic reconciliation,
 * these versions use .map() to produce a static array of GameObjects.
 * Compatible with the universal renderer.
 *
 * For static lists (blocks, enemies, etc.), this is equivalent.
 * For dynamic lists (spawning/removing at runtime), use imperative patterns.
 *
 * Usage:
 * ```tsx
 * import { For, Index } from "solidion";
 *
 * <For each={enemies()}>
 *   {(enemy) => <rectangle x={enemy.x} y={enemy.y} ... />}
 * </For>
 *
 * <Index each={blocks}>
 *   {(block, idx) => <rectangle x={positions[idx].x} ... />}
 * </Index>
 * ```
 */

export interface ForProps<T> {
  each: readonly T[];
  children: (item: T, index: number) => any;
}

export function For<T>(props: ForProps<T>): any {
  const list = props.each;
  const mapFn = props.children;
  return list.map((item, index) => mapFn(item, index));
}

export interface IndexProps<T> {
  each: readonly T[];
  children: (item: T, index: number) => any;
}

export function Index<T>(props: IndexProps<T>): any {
  const list = props.each;
  const mapFn = props.children;
  return list.map((item, index) => mapFn(item, index));
}
