/**
 * <Preload> component (L2).
 *
 * Loads assets before rendering children. Shows fallback during loading.
 * Children mount only after all assets are cached, so texture references
 * resolve synchronously via the fast path.
 *
 * Usage:
 * ```tsx
 * <Preload
 *   assets={[
 *     "/assets/bg.png",
 *     { type: "atlas", key: "chars", image: "/assets/chars.png", json: "/assets/chars.json" },
 *   ]}
 *   fallback={<text text="Loading..." x={400} y={300} />}
 * >
 *   <sprite texture="chars:idle" />
 * </Preload>
 * ```
 */

import {
  createSignal,
  onMount,
  type JSX,
} from "solid-js";
import { preloadAssets } from "../core/texture";
import { getCurrentScene } from "../core/scene-stack";

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
      setLoaded(true); // Allow children to mount even on failure
    });
  });

  // Return children when loaded, fallback otherwise
  // Note: In the universal renderer context, conditional rendering
  // needs to be handled by the caller using <Show> or similar.
  // This component provides the loaded() signal for that pattern.
  return () => loaded() ? props.children : (props.fallback ?? null);
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
