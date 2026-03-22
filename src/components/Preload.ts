/**
 * <Preload> component (L2).
 *
 * Loads assets before showing children. Uses Solidion's <Show> internally
 * to toggle visibility between fallback (loading) and children (loaded).
 *
 * Both fallback and children are rendered at mount time. Children's sprites
 * are created while textures are still loading, but they're hidden via
 * <Show when={loaded()}>. By the time Show reveals them, textures are
 * cached and sprites display correctly.
 *
 * Usage:
 * ```tsx
 * <Preload
 *   assets={["/assets/bg.png", "/assets/fish.png"]}
 *   fallback={<text text="Loading..." x={400} y={300} />}
 * >
 *   <sprite texture="/assets/bg.png" />
 * </Preload>
 * ```
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

  // Render both fallback and children, toggle visibility directly.
  // Avoids createComponent(Show) which has reactivity issues in .ts files.
  const children = props.children;
  const fallback = props.fallback;

  createEffect(() => {
    const isLoaded = loaded();
    setVisibleRecursive(children, isLoaded);
    if (fallback) setVisibleRecursive(fallback, !isLoaded);
  });

  const result: any[] = [];
  if (fallback) result.push(fallback);
  result.push(children);
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
