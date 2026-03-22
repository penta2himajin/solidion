/**
 * Solidion's <Show> component.
 *
 * Unlike solid-js's <Show> which conditionally mounts/unmounts children,
 * this version always renders children and toggles their `visible` property.
 * This is more efficient for Phaser GameObjects (avoids create/destroy overhead)
 * and compatible with the universal renderer.
 *
 * Usage:
 * ```tsx
 * import { Show } from "solidion";
 *
 * <Show when={isVisible()}>
 *   <rectangle x={100} y={100} width={50} height={50} fillColor={0xff0000} />
 * </Show>
 * ```
 */

import { createEffect } from "solid-js";
import { setVisibleRecursive } from "../core/visibility";

export interface ShowProps {
  when: boolean;
  children?: any;
}

export function Show(props: ShowProps): any {
  const children = props.children;

  createEffect(() => {
    setVisibleRecursive(children, !!props.when);
  });

  return children;
}
