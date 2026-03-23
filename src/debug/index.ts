/**
 * Solidion debug utilities.
 *
 * Usage:
 * ```ts
 * import { debug } from "solidion";
 *
 * // Inspect which props are reactive vs static on a GameObject
 * debug.inspectBindings(sprite)
 * // → { x: "reactive", y: "reactive", texture: "static", fillColor: "static" }
 *
 * // Profile a frame's performance
 * debug.enableProfiling();
 * // ... after a frame ...
 * debug.getFrameProfile()
 * // → { setPropertyCalls: 48, frameTimeMs: 0.31 }
 * ```
 */

import { hasMeta, getMeta } from "../core/meta";

// ============================================================
// 4-2: inspectBindings
// ============================================================

/**
 * Tracks whether each prop was set inside an effect (reactive)
 * or during initial synchronous setup (static).
 *
 * Stored per-node in a WeakMap to avoid polluting GameObjects.
 */
const bindingMap = new WeakMap<object, Record<string, "reactive" | "static">>();

/**
 * Record a prop binding type. Called from applyProp.
 * @internal
 */
export function recordBinding(node: any, name: string, isReactive: boolean): void {
  if (!profilingEnabled && !inspectEnabled) return;
  let bindings = bindingMap.get(node);
  if (!bindings) {
    bindings = {};
    bindingMap.set(node, bindings);
  }
  bindings[name] = isReactive ? "reactive" : "static";
}

let inspectEnabled = false;

/**
 * Inspect which props on a GameObject are reactive (set inside effects)
 * vs static (set during initial render).
 *
 * Must call `debug.enable()` before rendering for bindings to be tracked.
 */
export function inspectBindings(node: any): Record<string, "reactive" | "static"> {
  return bindingMap.get(node) ?? {};
}

// ============================================================
// 4-3: Frame profiler
// ============================================================

let profilingEnabled = false;

interface FrameProfile {
  setPropertyCalls: number;
  frameTimeMs: number;
}

let currentProfile: FrameProfile = { setPropertyCalls: 0, frameTimeMs: 0 };
let lastProfile: FrameProfile = { setPropertyCalls: 0, frameTimeMs: 0 };

/**
 * Record a setProperty call. Called from renderer's setProperty.
 * @internal
 */
export function recordSetProperty(): void {
  if (!profilingEnabled) return;
  currentProfile.setPropertyCalls++;
}

/**
 * Called at the start of solidionFrameUpdate.
 * @internal
 */
export function frameStart(): void {
  if (!profilingEnabled) return;
  currentProfile = { setPropertyCalls: 0, frameTimeMs: performance.now() };
}

/**
 * Called at the end of solidionFrameUpdate.
 * @internal
 */
export function frameEnd(): void {
  if (!profilingEnabled) return;
  currentProfile.frameTimeMs = performance.now() - currentProfile.frameTimeMs;
  lastProfile = { ...currentProfile };
}

/**
 * Get the profile data from the last completed frame.
 */
export function getFrameProfile(): FrameProfile {
  return lastProfile;
}

// ============================================================
// Enable/disable
// ============================================================

/**
 * Enable debug features (inspectBindings + frame profiling).
 * Call before rendering. Has minimal overhead when enabled.
 */
export function enable(): void {
  inspectEnabled = true;
  profilingEnabled = true;
}

/**
 * Disable debug features.
 */
export function disable(): void {
  inspectEnabled = false;
  profilingEnabled = false;
}

/**
 * Check if debug features are enabled.
 */
export function isEnabled(): boolean {
  return inspectEnabled || profilingEnabled;
}

/**
 * Expose application state to the DOM for E2E test inspection.
 *
 * When debug is enabled, writes `data` as JSON into a hidden
 * `<div id="solidion-debug">` element. No-op when disabled.
 */
export function expose(data: Record<string, unknown>): void {
  if (!isEnabled()) return;
  if (typeof document === "undefined") return;
  let el = document.getElementById("solidion-debug");
  if (!el) {
    el = document.createElement("div");
    el.id = "solidion-debug";
    el.style.display = "none";
    document.body.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}
