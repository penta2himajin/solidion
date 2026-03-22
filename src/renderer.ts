/**
 * Solidion Renderer: Custom SolidJS renderer for Phaser 3.
 *
 * Uses solid-js/universal's createRenderer to map JSX elements
 * directly to Phaser GameObjects. No virtual node tree.
 */

import { createRenderer } from "solid-js/universal";
import { getCurrentScene } from "./core/scene-stack";
import { getMeta, deleteMeta } from "./core/meta";
import { isEventProp, resolveEventName } from "./core/events";
import { applyProp } from "./core/props";
import { applyTexture } from "./core/texture";
import * as debugModule from "./debug";

/**
 * Lightweight text node representation.
 * Phaser has no TextNode concept; this is a bridge for Solid's createTextNode.
 */
interface SolidionTextNode {
  __solidion_textNode: true;
  value: string;
  parent: any | null;
}

function isTextNode(node: any): node is SolidionTextNode {
  return node && node.__solidion_textNode === true;
}

/**
 * Explicit overrides for element types that need special construction.
 * Shape types need a default fillColor so isFilled=true.
 * Types not listed here are resolved dynamically via scene.add[type]().
 */
/**
 * Explicit overrides for element types that need special construction.
 * Uses `new Phaser.GameObjects.XXX()` instead of `scene.add.xxx()` so that
 * the object is NOT added to the display list here. Display list insertion
 * is handled by insertNode, which avoids double-add issues (e.g., visible
 * being reset to true when re-added to the display list).
 */
const ELEMENT_OVERRIDES: Record<
  string,
  (scene: Phaser.Scene) => Phaser.GameObjects.GameObject
> = {
  rectangle: (s) => new Phaser.GameObjects.Rectangle(s, 0, 0, 0, 0, 0xffffff),
  ellipse: (s) => new Phaser.GameObjects.Ellipse(s, 0, 0, 0, 0, 0xffffff),
  circle: (s) => new Phaser.GameObjects.Arc(s, 0, 0, 0, 0, 360, false, 0xffffff),
  arc: (s) => new Phaser.GameObjects.Arc(s, 0, 0, 0, 0, 360, false, 0xffffff),
  star: (s) => new Phaser.GameObjects.Star(s, 0, 0, 5, 0, 0, 0xffffff),
  triangle: (s) => new Phaser.GameObjects.Triangle(s, 0, 0, 0, 0, 0, 0, 0, 0, 0xffffff),
  text: (s) => new Phaser.GameObjects.Text(s, 0, 0, "", {}),
};

/**
 * Create a Phaser GameObject from a JSX tag name.
 *
 * Resolution order:
 * 1. ELEMENT_OVERRIDES — explicit factories for types needing special args
 * 2. scene.add[type]() — Phaser's GameObjectFactory (most types)
 * 3. Error if neither works
 */
function _createElement(type: string): Phaser.GameObjects.GameObject {
  const scene = getCurrentScene();
  if (!scene) {
    throw new Error(
      `Solidion: createElement("${type}") called but no Scene is active. ` +
        `Ensure GameObjects are inside a <Game> component.`
    );
  }

  // 1. Check explicit overrides
  const override = ELEMENT_OVERRIDES[type];
  if (override) {
    const node = override(scene);
    getMeta(node);
    return node;
  }

  // 2. Try scene.make[type]() — Phaser's GameObjectCreator (no display list add)
  const maker = (scene.make as any)[type];
  if (typeof maker === "function") {
    const node = maker.call(scene.make, { x: 0, y: 0 }) as Phaser.GameObjects.GameObject;
    getMeta(node);
    return node;
  }

  // 3. Try scene.add[type]() — GameObjectFactory (adds to display list)
  // Remove from display list immediately — insertNode will add it properly.
  const factory = (scene.add as any)[type];
  if (typeof factory === "function") {
    const node = factory.call(scene.add, 0, 0) as Phaser.GameObjects.GameObject;
    scene.sys.displayList?.remove(node);
    getMeta(node);
    return node;
  }

  throw new Error(
    `Solidion: Unknown element type "${type}". ` +
      `Not found in overrides or scene.add.${type}().`
  );
}

/**
 * Create a lightweight text node.
 */
function _createTextNode(value: string): SolidionTextNode {
  return {
    __solidion_textNode: true,
    value,
    parent: null,
  };
}

/**
 * Set a property or event on a node.
 */
function setProperty(node: any, name: string, value: any): void {
  debugModule.recordSetProperty();

  if (isTextNode(node)) {
    // Text nodes only store their value
    node.value = value;
    return;
  }

  // Skip non-GameObject nodes
  if (!node || typeof node !== "object") return;

  // Ref callback
  if (name === "ref") {
    if (typeof value === "function") {
      value(node);
    } else if (value && typeof value === "object" && "current" in value) {
      value.current = node;
    }
    return;
  }

  // Children are handled by insertNode
  if (name === "children") return;

  // Event handlers
  if (isEventProp(name)) {
    const event = resolveEventName(name);
    if (!event) return;

    const meta = getMeta(node);
    const prev = meta.handlers.get(name);
    if (prev) {
      node.off(event, prev);
    }

    if (value) {
      if (!node.input && typeof node.setInteractive === "function") {
        // Defer setInteractive() to after all synchronous props (including
        // width/height in effects) are applied. Without this, setInteractive()
        // on a 0x0 shape creates a hit area that rejects all clicks.
        if (!meta.interactivePending) {
          meta.interactivePending = true;
          queueMicrotask(() => {
            if (meta.interactivePending && !node.input && typeof node.setInteractive === "function") {
              node.setInteractive();
              // Phaser's CreateInteractiveObject hardcodes enabled:true.
              // Sync with current visible state so hidden objects don't capture clicks.
              if (node.input && !node.visible) {
                node.input.enabled = false;
              }
            }
            meta.interactivePending = false;
          });
        }
      }
      node.on(event, value);
      meta.handlers.set(name, value);
    } else {
      meta.handlers.delete(name);
      if (meta.handlers.size === 0 && node.input && typeof node.removeInteractive === "function") {
        node.removeInteractive();
      }
    }
    return;
  }

  // Texture (special handling for auto-load)
  if (name === "texture" && typeof node.setTexture === "function") {
    applyTexture(node, value);
    return;
  }

  // Regular properties
  applyProp(node, name, value);
}

/**
 * Insert a child node into a parent.
 */
function _insertNode(
  parent: any,
  node: any,
  anchor?: any
): void {
  if (isTextNode(node)) {
    node.parent = parent;
    // If parent is a Phaser Text, update its text content
    if (parent && typeof parent.setText === "function") {
      updateTextContent(parent);
    }
    return;
  }

  if (!parent || !node) return;

  const meta = getMeta(parent);

  if (anchor) {
    const idx = meta.children.indexOf(anchor);
    if (idx >= 0) {
      meta.children.splice(idx, 0, node);
    } else {
      meta.children.push(node);
    }
  } else {
    meta.children.push(node);
  }

  // Add to Phaser's scene/container
  if (typeof parent.add === "function" && parent instanceof Phaser.GameObjects.Container) {
    parent.add(node);
  } else if (node.scene) {
    const scene = node.scene as Phaser.Scene;
    scene.sys.displayList?.add(node);
  }

  // Note: depth is NOT auto-synced here. Users set depth explicitly
  // via setProp(node, "depth", n). Auto-syncing would override those values.
}

/**
 * Remove a child node from its parent.
 */
function removeNode(parent: any, node: any): void {
  if (isTextNode(node)) {
    node.parent = null;
    if (parent && typeof parent.setText === "function") {
      updateTextContent(parent);
    }
    return;
  }

  if (!parent || !node) return;

  const meta = getMeta(parent);
  const idx = meta.children.indexOf(node);
  if (idx >= 0) {
    meta.children.splice(idx, 1);
  }

  // Clean up the removed node recursively
  cleanupNode(node);
}

/**
 * Replace text content in a text node.
 */
function replaceText(textNode: SolidionTextNode, value: string): void {
  textNode.value = value;
  if (textNode.parent && typeof textNode.parent.setText === "function") {
    updateTextContent(textNode.parent);
  }
}

/**
 * Get the parent of a node.
 */
function getParentNode(node: any): any {
  if (isTextNode(node)) return node.parent;
  return node?.parentContainer ?? null;
}

/**
 * Get the first child of a node.
 */
function getFirstChild(node: any): any {
  if (isTextNode(node)) return null;
  const meta = getMeta(node);
  return meta.children[0] ?? null;
}

/**
 * Get the next sibling of a node.
 */
function getNextSibling(node: any): any {
  const parent = getParentNode(node);
  if (!parent) return null;
  const meta = getMeta(parent);
  const idx = meta.children.indexOf(node);
  return idx >= 0 ? meta.children[idx + 1] ?? null : null;
}

// ---- Helpers ----

function cleanupNode(node: any): void {
  if (isTextNode(node)) return;
  if (!node) return;

  const meta = getMeta(node);

  // Cancel any pending setInteractive microtask
  meta.interactivePending = false;

  // Remove all event listeners
  for (const [name, handler] of meta.handlers) {
    const event = resolveEventName(name);
    if (event) node.off(event, handler);
  }
  meta.handlers.clear();

  // Recursively clean up children
  for (const child of [...meta.children]) {
    cleanupNode(child);
  }
  meta.children.length = 0;

  // Remove from Phaser container/display list
  if (node.parentContainer) {
    node.parentContainer.remove(node);
  }

  // Destroy the Phaser object
  if (typeof node.destroy === "function") {
    node.destroy();
  }

  deleteMeta(node);
}

function updateTextContent(textObj: any): void {
  // Collect text from child text nodes
  // For simplicity, just use the first text node's value
  const meta = getMeta(textObj);
  // Text nodes aren't in meta.children (they're not GameObjects)
  // This is handled by replaceText directly
}

/** @internal Exported for testing only */
export const _internal = {
  setProperty,
  removeNode,
  replaceText,
  getParentNode,
  getFirstChild,
  getNextSibling,
  cleanupNode,
  isTextNode,
  _insertNode,
};

// ---- Export the renderer ----

export const {
  render,
  effect,
  memo,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
  use,
} = createRenderer({
  createElement: _createElement,
  createTextNode: _createTextNode,
  replaceText,
  setProperty,
  insertNode: _insertNode,
  removeNode,
  getParentNode,
  getFirstChild,
  getNextSibling,
  isTextNode,
});
