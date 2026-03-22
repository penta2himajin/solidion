/**
 * Shared visibility utility for Solidion components (Show, For, Index).
 * Toggles both visual visibility AND interactive state so hidden
 * objects don't capture pointer events.
 */

import { hasMeta, getMeta } from "./meta";

const MAX_ACCESSOR_DEPTH = 10;

/**
 * Recursively set visible on a node or array of nodes.
 * Also disables/enables input on interactive objects.
 */
export function setVisibleRecursive(node: any, visible: boolean, depth: number = 0): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const child of node) {
      setVisibleRecursive(child, visible, depth);
    }
    return;
  }

  if (typeof node === "function") {
    if (depth >= MAX_ACCESSOR_DEPTH) return;
    setVisibleRecursive(node(), visible, depth + 1);
    return;
  }

  if (node && typeof node.setVisible === "function") {
    node.setVisible(visible);

    // Toggle interactive state: hidden objects should not capture clicks
    if (node.input) {
      node.input.enabled = visible;
    }

    if (hasMeta(node)) {
      const meta = getMeta(node);
      for (const child of meta.children) {
        setVisibleRecursive(child, visible, depth);
      }
    }
  }
}
