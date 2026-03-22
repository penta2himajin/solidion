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
/**
 * Explicit handlers for props that need special multi-arg setters
 * or non-standard behavior. Everything else is resolved dynamically.
 */
const PROP_OVERRIDES: Record<string, (obj: any, value: any) => void> = {
  // Origin: compound setter (setOrigin takes x, y)
  origin: (obj, v) => obj.setOrigin?.(v),
  originX: (obj, v) => obj.setOrigin?.(v, obj.originY ?? 0.5),
  originY: (obj, v) => obj.setOrigin?.(obj.originX ?? 0.5, v),

  // Size: compound setter (setSize takes w, h)
  width: (obj, v) => obj.setSize ? obj.setSize(v, obj.height) : (obj.width = v),
  height: (obj, v) => obj.setSize ? obj.setSize(obj.width, v) : (obj.height = v),

  // Fill/stroke: compound setters
  fillColor: (obj, v) => obj.setFillStyle?.(v, obj.fillAlpha ?? 1),
  fillAlpha: (obj, v) => obj.setFillStyle?.(obj.fillColor, v),
  strokeColor: (obj, v) => obj.setStrokeStyle?.(obj.lineWidth ?? 1, v, obj.strokeAlpha ?? 1),
  lineWidth: (obj, v) => obj.setStrokeStyle?.(v, obj.strokeColor, obj.strokeAlpha ?? 1),

  // Scale: uses setScale for uniform scaling
  scale: (obj, v) => obj.setScale?.(v),

  // Word wrap: compound object arg
  wordWrap: (obj, v) => v && obj.setWordWrapWidth?.(v.width, v.useAdvancedWrap),

  // Animation: delegates to play()
  animation: (obj, v) => v && obj.play?.(v),

  // Interactive: special toggle behavior
  interactive: (obj, v) => {
    if (v === true) obj.setInteractive?.();
    else if (v === false && obj.input) obj.removeInteractive?.();
    else if (v && typeof v === "object") obj.setInteractive?.(v);
  },

  // Texture: handled by texture system, skip here
  texture: () => {},

  // Internal props: skip
  ref: () => {},
  children: () => {},
};

/**
 * Convert a prop name to its Phaser setter method name.
 * e.g. "fontSize" → "setFontSize", "text" → "setText"
 */
function toSetterName(name: string): string {
  return "set" + name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Low-level setter: sets a property on a Phaser GameObject.
 *
 * Resolution order:
 * 1. PROP_OVERRIDES — explicit handlers for compound/special props
 * 2. obj.set${PascalCase}(value) — Phaser setter methods
 * 3. obj[name] = value — direct property assignment
 */
export function setPhaserProp(
  node: Phaser.GameObjects.GameObject,
  name: string,
  value: any
): void {
  const obj = node as any;

  // 1. Check explicit overrides
  const override = PROP_OVERRIDES[name];
  if (override) {
    override(obj, value);
    return;
  }

  // 2. Try setter method: set${PascalCase}(value)
  const setter = toSetterName(name);
  if (typeof obj[setter] === "function") {
    obj[setter](value);
    return;
  }

  // 3. Direct property assignment
  if (name in obj) {
    obj[name] = value;
  }
}
