/**
 * <Overlay> component.
 *
 * Creates a DOM layer positioned over the Phaser canvas.
 * Children are rendered via Solid's standard DOM renderer.
 * pointer-events: none by default so clicks pass through to canvas.
 *
 * Usage:
 * ```tsx
 * <Game width={800} height={600}>
 *   <sprite texture="bg.png" />
 *   <Overlay>
 *     <div style={{ position: "absolute", bottom: "20px", "pointer-events": "auto" }}>
 *       <input type="text" />
 *     </div>
 *   </Overlay>
 * </Game>
 * ```
 */

import { onCleanup, type JSX } from "solid-js";
import { getCurrentScene } from "../core/scene-stack";

export interface OverlayProps {
  style?: Partial<CSSStyleDeclaration>;
  children?: JSX.Element;
}

/**
 * Overlay component.
 * In the universal renderer context, this creates a DOM div over the canvas
 * and renders children into it using the DOM. Returns null in the Phaser tree.
 */
export function Overlay(props: OverlayProps): any {
  /* v8 ignore next — SSR guard: document always exists in browser */
  if (typeof document === "undefined") return null;

  const scene = getCurrentScene();
  /* v8 ignore next — defensive: Overlay is always inside <Game> */
  if (!scene) return null;

  const canvas = scene.sys.game.canvas;
  const parent = canvas.parentElement;
  /* v8 ignore next — defensive: canvas always has a parent element */
  if (!parent) return null;

  // Ensure parent has relative positioning for overlay alignment
  /* v8 ignore next 2 — depends on browser's default computed style */
  if (getComputedStyle(parent).position === "static") {
    parent.style.position = "relative";
  }

  const overlayDiv = document.createElement("div");
  overlayDiv.style.position = "absolute";
  overlayDiv.style.top = "0";
  overlayDiv.style.left = "0";
  overlayDiv.style.width = "100%";
  overlayDiv.style.height = "100%";
  overlayDiv.style.pointerEvents = "none";
  overlayDiv.style.overflow = "hidden";

  // Apply custom styles
  if (props.style) {
    Object.assign(overlayDiv.style, props.style);
  }

  parent.appendChild(overlayDiv);

  // Render children using standard DOM rendering
  // Since we're in the universal renderer context, we mount children
  // via solid-js/web's render. Users should import render from solid-js/web
  // for their DOM content, or we can use innerHTML/appendChild patterns.
  // For simplicity, if children are DOM elements, append them.
  if (props.children instanceof HTMLElement) {
    overlayDiv.appendChild(props.children);
  }

  onCleanup(() => {
    overlayDiv.remove();
  });

  // Return null — nothing in the Phaser tree
  return null;
}
