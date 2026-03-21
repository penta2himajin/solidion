/**
 * SolidionMeta: Lightweight metadata attached to Phaser GameObjects.
 * Replaces the need for a virtual node tree.
 */

const META_KEY = "__solidion";

export interface SolidionMeta {
  /** Child GameObjects in insertion order */
  children: Phaser.GameObjects.GameObject[];
  /** Event handler tracking: propName -> handler function */
  handlers: Map<string, Function>;
  /** Base values from setProperty (before behavior deltas) */
  baseValues: Map<string, any>;
  /** Per-behavior deltas: behaviorId -> { propName: deltaValue } */
  behaviorDeltas: Map<string, Record<string, number>>;
  /** Aggregated deltas (cache) */
  totalDelta: Record<string, number>;
}

export function createMeta(): SolidionMeta {
  return {
    children: [],
    handlers: new Map(),
    baseValues: new Map(),
    behaviorDeltas: new Map(),
    totalDelta: {},
  };
}

export function getMeta(node: any): SolidionMeta {
  if (!node[META_KEY]) {
    node[META_KEY] = createMeta();
  }
  return node[META_KEY] as SolidionMeta;
}

export function hasMeta(node: any): boolean {
  return !!node[META_KEY];
}

export function deleteMeta(node: any): void {
  delete node[META_KEY];
}

/**
 * Add a behavior's delta to a node and recompute totalDelta.
 */
export function addDelta(
  node: any,
  behaviorId: string,
  delta: Record<string, number>
): void {
  const meta = getMeta(node);
  meta.behaviorDeltas.set(behaviorId, delta);
  recomputeTotalDelta(meta);
}

/**
 * Remove a behavior's delta from a node and recompute totalDelta.
 */
export function removeDelta(node: any, behaviorId: string): void {
  const meta = getMeta(node);
  meta.behaviorDeltas.delete(behaviorId);
  recomputeTotalDelta(meta);
}

/**
 * Recompute the aggregated totalDelta from all behavior deltas.
 */
function recomputeTotalDelta(meta: SolidionMeta): void {
  const result: Record<string, number> = {};
  for (const delta of meta.behaviorDeltas.values()) {
    for (const [prop, value] of Object.entries(delta)) {
      result[prop] = (result[prop] ?? 0) + value;
    }
  }
  meta.totalDelta = result;
}
