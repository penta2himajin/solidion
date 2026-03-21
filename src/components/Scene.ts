/**
 * <Scene> component (L2).
 *
 * Creates an explicit Phaser Scene, pushes it onto the scene stack,
 * and sets up the frame synchronization loop.
 */

import {
  onCleanup,
  type JSX,
} from "solid-js";
import Phaser from "phaser";
import { createFrameManager } from "../core/frame";
import { solidionFrameUpdate } from "../core/sync";
import { pushScene, popScene, getCurrentScene } from "../core/scene-stack";
import { render } from "../renderer";
import { getMeta } from "../core/meta";

export interface SceneProps {
  name?: string;
  active?: boolean;
  physics?: Phaser.Types.Core.PhysicsConfig;
  children?: JSX.Element;
}

export function Scene(props: SceneProps): any {
  let sceneInstance: Phaser.Scene | null = null;
  let disposeRenderer: (() => void) | undefined;
  const frameManager = createFrameManager();

  const sceneKey = props.name ?? `__solidion_scene_${Math.random().toString(36).slice(2)}`;

  const sceneConfig = {
    key: sceneKey,
    active: props.active ?? true,
    ...(props.physics ? { physics: props.physics } : {}),
    create(this: Phaser.Scene) {
      sceneInstance = this;
      pushScene(this);
      const rootContainer = this.add.container(0, 0);
      getMeta(rootContainer);
      disposeRenderer = render(() => props.children, rootContainer);
    },
    update(this: Phaser.Scene, time: number, delta: number) {
      solidionFrameUpdate(frameManager, time, delta);
    },
  };

  const parentScene = getCurrentScene();
  if (parentScene) {
    parentScene.scene.add(sceneKey, sceneConfig as any, props.active ?? true);
  }

  onCleanup(() => {
    if (disposeRenderer) disposeRenderer();
    if (sceneInstance) {
      popScene();
      try { sceneInstance.scene.remove(sceneKey); } catch {}
    }
  });

  return null;
}
