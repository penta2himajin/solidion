/**
 * Solid contexts for Solidion.
 */

import { createContext, useContext } from "solid-js";
import type { FrameManager } from "./core/frame";

export const GameContext = createContext<Phaser.Game>();
export const SceneContext = createContext<Phaser.Scene>();
export const FrameManagerContext = createContext<FrameManager>();
export const ParentNodeContext = createContext<Phaser.GameObjects.GameObject>();

export function useGame(): Phaser.Game {
  const game = useContext(GameContext);
  if (!game) {
    throw new Error("Solidion: useGame() must be used within a <Game> component.");
  }
  return game;
}

export function useScene(): Phaser.Scene {
  const scene = useContext(SceneContext);
  if (!scene) {
    throw new Error("Solidion: useScene() must be used within a <Scene> component.");
  }
  return scene;
}

export function useFrameManager(): FrameManager {
  const fm = useContext(FrameManagerContext);
  if (!fm) {
    throw new Error("Solidion: useFrameManager() must be used within a <Scene> component.");
  }
  return fm;
}

export function useParentNode(): Phaser.GameObjects.GameObject | undefined {
  return useContext(ParentNodeContext);
}
