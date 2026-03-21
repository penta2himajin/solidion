/**
 * Property application: maps normalized prop names to Phaser setters,
 * with support for behavior delta composition.
 */

import { getMeta } from "./meta";

/**
 * Property composition categories.
 */
type PropCategory = "additive" | "multiplicative" | "override";

const PROP_CATEGORIES: Record<string, PropCategory> = {
  x: "additive",
  y: "additive",
  angle: "additive",
  rotation: "additive",
  scale: "multiplicative",
  scaleX: "multiplicative",
  scaleY: "multiplicative",
  alpha: "multiplicative",
  tint: "override",
  visible: "override",
  texture: "override",
  depth: "override",
};

function getPropCategory(name: string): PropCategory {
  return PROP_CATEGORIES[name] ?? "override";
}

/**
 * Compose a base value with a delta according to the property's category.
 */
export function composeProp(name: string, base: any, delta: number): any {
  if (delta === 0 || delta === undefined) return base;

  const category = getPropCategory(name);
  switch (category) {
    case "additive":
      return (base ?? 0) + delta;
    case "multiplicative":
      return (base ?? 1) * (1 + delta);
    case "override":
      return base;
  }
}

/**
 * Apply a property to a Phaser GameObject.
 * Records the base value and composes with any behavior deltas.
 */
export function applyProp(
  node: Phaser.GameObjects.GameObject,
  name: string,
  value: any
): void {
  const meta = getMeta(node);
  meta.baseValues.set(name, value);

  const delta = meta.totalDelta[name] ?? 0;
  const finalValue = composeProp(name, value, delta);

  setPhaserProp(node, name, finalValue);
}

/**
 * Re-apply a property using stored base value and current deltas.
 * Called when behavior deltas change.
 */
export function reapplyProp(
  node: Phaser.GameObjects.GameObject,
  name: string
): void {
  const meta = getMeta(node);
  const base = meta.baseValues.get(name);
  if (base === undefined) return;

  const delta = meta.totalDelta[name] ?? 0;
  const finalValue = composeProp(name, base, delta);
  setPhaserProp(node, name, finalValue);
}

/**
 * Low-level setter: directly sets a property on a Phaser GameObject.
 */
export function setPhaserProp(
  node: Phaser.GameObjects.GameObject,
  name: string,
  value: any
): void {
  const obj = node as any;

  switch (name) {
    // Transform
    case "x":
      obj.x = value;
      break;
    case "y":
      obj.y = value;
      break;
    case "angle":
      obj.angle = value;
      break;
    case "rotation":
      obj.rotation = value;
      break;

    // Scale
    case "scale":
      if (typeof value === "number") {
        obj.setScale(value);
      }
      break;
    case "scaleX":
      obj.scaleX = value;
      break;
    case "scaleY":
      obj.scaleY = value;
      break;

    // Display
    case "alpha":
      obj.alpha = value;
      break;
    case "visible":
      obj.visible = value;
      break;
    case "tint":
      if (typeof obj.setTint === "function") {
        obj.setTint(value);
      }
      break;
    case "blendMode":
      obj.blendMode = value;
      break;
    case "depth":
      obj.depth = value;
      break;

    // Origin
    case "origin":
      if (typeof obj.setOrigin === "function") {
        if (typeof value === "number") {
          obj.setOrigin(value);
        }
      }
      break;
    case "originX":
      if (typeof obj.setOrigin === "function") {
        obj.setOrigin(value, obj.originY ?? 0.5);
      }
      break;
    case "originY":
      if (typeof obj.setOrigin === "function") {
        obj.setOrigin(obj.originX ?? 0.5, value);
      }
      break;

    // Size
    case "width":
      if (typeof obj.setSize === "function") {
        obj.setSize(value, obj.height);
      } else {
        obj.width = value;
      }
      break;
    case "height":
      if (typeof obj.setSize === "function") {
        obj.setSize(obj.width, value);
      } else {
        obj.height = value;
      }
      break;
    case "displayWidth":
      obj.displayWidth = value;
      break;
    case "displayHeight":
      obj.displayHeight = value;
      break;

    // Texture (handled by texture system, but basic setter here)
    case "texture":
      // Texture loading is handled separately in texture.ts
      break;
    case "frame":
      if (typeof obj.setFrame === "function") {
        obj.setFrame(value);
      }
      break;

    // Text-specific
    case "text":
      if (typeof obj.setText === "function") {
        obj.setText(value);
      }
      break;
    case "fontSize":
      if (typeof obj.setFontSize === "function") {
        obj.setFontSize(value);
      }
      break;
    case "fontFamily":
      if (typeof obj.setFontFamily === "function") {
        obj.setFontFamily(value);
      }
      break;
    case "color":
      if (typeof obj.setColor === "function") {
        obj.setColor(value);
      }
      break;
    case "align":
      if (typeof obj.setAlign === "function") {
        obj.setAlign(value);
      }
      break;
    case "style":
      if (typeof obj.setStyle === "function") {
        obj.setStyle(value);
      }
      break;
    case "wordWrap":
      if (typeof obj.setWordWrapWidth === "function" && value) {
        obj.setWordWrapWidth(value.width, value.useAdvancedWrap);
      }
      break;

    // Rectangle-specific
    case "fillColor":
      if (typeof obj.setFillStyle === "function") {
        obj.setFillStyle(value, obj.fillAlpha ?? 1);
      }
      break;
    case "fillAlpha":
      if (typeof obj.setFillStyle === "function") {
        obj.setFillStyle(obj.fillColor, value);
      }
      break;
    case "strokeColor":
      if (typeof obj.setStrokeStyle === "function") {
        obj.setStrokeStyle(obj.lineWidth ?? 1, value, obj.strokeAlpha ?? 1);
      }
      break;
    case "lineWidth":
      if (typeof obj.setStrokeStyle === "function") {
        obj.setStrokeStyle(value, obj.strokeColor, obj.strokeAlpha ?? 1);
      }
      break;

    // Animation
    case "animation":
      if (typeof obj.play === "function") {
        if (typeof value === "string") {
          obj.play(value);
        } else if (value) {
          obj.play(value);
        }
      }
      break;

    // Interactive config
    case "interactive":
      if (value === true) {
        obj.setInteractive();
      } else if (value === false) {
        if (obj.input) obj.removeInteractive();
      } else if (value && typeof value === "object") {
        obj.setInteractive(value);
      }
      break;

    // Skip internal props
    case "ref":
    case "children":
      break;

    default:
      // Fallback: try direct property assignment
      if (name in obj) {
        obj[name] = value;
      }
      break;
  }
}
