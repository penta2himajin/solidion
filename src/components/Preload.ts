/**
 * <Preload> component (L2).
 *
 * Loads assets before showing children. Children are always rendered
 * (GameObjects created at mount time) but wrapped in a Container that
 * is hidden until loading completes. This preserves individual elements'
 * own visibility props (e.g., visible={false} on inactive fish).
 *
 * Fallback elements are shown during loading and hidden when done.
 */

import {
  createSignal,
  createEffect,
  onMount,
  type JSX,
} from "solid-js";
import { preloadAssets } from "../core/texture";
import { getCurrentScene } from "../core/scene-stack";
import { setVisibleRecursive } from "../core/visibility";

export type AssetSpec =
  | string
  | { type: "atlas"; key: string; image: string; json: string }
  | { type: "spritesheet"; key: string; url: string; frameWidth: number; frameHeight: number };

export interface PreloadProps {
  assets: AssetSpec[];
  fallback?: JSX.Element;
  children?: JSX.Element;
}

export function Preload(props: PreloadProps): any {
  const [loaded, setLoaded] = createSignal(false);

  onMount(() => {
    const scene = getCurrentScene();
    /* v8 ignore next 4 — defensive: Preload is always inside <Game> */
    if (!scene) {
      console.warn("Solidion: <Preload> used outside of a Scene. Assets not loaded.");
      setLoaded(true);
      return;
    }

    preloadAssets(scene, props.assets).then(() => {
      setLoaded(true);
    }).catch((err) => {
      console.error("Solidion: Preload failed:", err);
      setLoaded(true);
    });
  });

  // Only toggle FALLBACK visibility. Children manage their own visibility
  // via their individual `visible` props. This prevents Preload from
  // overriding visible={false} on elements like inactive fish or hidden panels.
  const fallback = props.fallback;

  createEffect(() => {
    if (fallback) setVisibleRecursive(fallback, !loaded());
  });

  // Return both fallback and children
  const result: any[] = [];
  if (fallback) result.push(fallback);
  result.push(props.children);
  return result;
}

/**
 * usePreload hook — alternative to the Preload component.
 * Returns a reactive `loaded` signal.
 */
export function usePreload(assets: AssetSpec[]): () => boolean {
  const [loaded, setLoaded] = createSignal(false);

  onMount(() => {
    const scene = getCurrentScene();
    /* v8 ignore next 3 — defensive: usePreload is always inside <Game> */
    if (!scene) {
      setLoaded(true);
      return;
    }
    preloadAssets(scene, assets).then(() => setLoaded(true)).catch(() => setLoaded(true));
  });

  return loaded;
}
