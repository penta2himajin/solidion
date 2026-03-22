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
import { getMeta } from "../core/meta";

export interface ShowProps {
  when: boolean;
  children?: any;
}

export function Show(props: ShowProps): any {
  const children = props.children;

  // After children are rendered, toggle visibility reactively
  createEffect(() => {
    const visible = !!props.when;
    setVisibleRecursive(children, visible);
  });

  return children;
}

/**
 * Recursively set visible on a node or array of nodes.
 */
function setVisibleRecursive(node: any, visible: boolean): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const child of node) {
      setVisibleRecursive(child, visible);
    }
    return;
  }

  if (typeof node === "function") {
    // Accessor — evaluate and recurse
    setVisibleRecursive(node(), visible);
    return;
  }

  // Phaser GameObject
  if (node && typeof node.setVisible === "function") {
    node.setVisible(visible);
    // Also set on children in meta
    const meta = getMeta(node);
    for (const child of meta.children) {
      setVisibleRecursive(child, visible);
    }
  }
}
