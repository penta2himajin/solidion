/**
 * Solidion's <Show> component.
 *
 * Unlike solid-js's <Show> which conditionally mounts/unmounts children,
 * this version always renders children and toggles their `visible` property.
 * Also toggles interactive state so hidden objects don't capture clicks.
 *
 * Uses createRenderEffect (synchronous) to ensure initial visibility is
 * set before the first frame renders — prevents flash of hidden content.
 */

import { createRenderEffect } from "solid-js";
import { setVisibleRecursive } from "../core/visibility";

export interface ShowProps {
  when: boolean;
  children?: any;
}

export function Show(props: ShowProps): any {
  const children = props.children;

  // createRenderEffect runs synchronously, setting initial visibility
  // before children are painted. createEffect (deferred) would cause
  // a one-frame flash of hidden elements.
  createRenderEffect(() => {
    setVisibleRecursive(children, !!props.when);
  });

  return children;
}
