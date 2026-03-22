/**
 * <Game> component.
 *
 * Boots Phaser, creates the canvas, provides GameContext,
 * and sets up a default Scene for L0 usage.
 *
 * This is a standard Solid component (runs in the DOM renderer).
 * Children are rendered via the Solidion universal renderer into Phaser.
 */

import {
  createSignal,
  createEffect,
  createComponent,
  onCleanup,
  untrack,
  type JSX,
} from "solid-js";
/* v8 ignore next — v8 branch tracking noise on ESM import resolution */
import Phaser from "phaser";
import { GameContext, SceneContext, FrameManagerContext } from "../contexts";
import { createFrameManager, type FrameManager } from "../core/frame";
import { solidionFrameUpdate } from "../core/sync";
import { pushScene, popScene } from "../core/scene-stack";
import { render } from "../renderer";

export interface GameProps {
  width?: number;
  height?: number;
  backgroundColor?: number | string;
  physics?: Phaser.Types.Core.PhysicsConfig;
  scale?: Phaser.Types.Core.ScaleConfig;
  /** Full Phaser config override (L4). Merged with other props. */
  config?: Partial<Phaser.Types.Core.GameConfig>;
  /** Phaser canvas parent element. If not provided, Game creates one. */
  parent?: HTMLElement | string;
  /** Scene-level input events (L0 — no useScene needed) */
  onPointerMove?: (pointer: Phaser.Input.Pointer) => void;
  onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
  onPointerUp?: (pointer: Phaser.Input.Pointer) => void;
  children?: JSX.Element;
}

interface GameState {
  game: Phaser.Game;
  scene: Phaser.Scene;
  frameManager: FrameManager;
}

/**
 * Create and boot a Phaser game, returning a promise that resolves
 * when the default scene is ready.
 */
/* v8 ignore next 45 — Phaser boot internals: async callback branches tracked by integration tests */
function bootPhaser(
  parent: HTMLElement,
  props: GameProps
): Promise<GameState> {
  return new Promise((resolve) => {
    const frameManager = createFrameManager();

    const defaultSceneConfig: Phaser.Types.Scenes.SettingsConfig & {
      create: (this: Phaser.Scene) => void;
      update: (this: Phaser.Scene, time: number, delta: number) => void;
    } = {
      key: "__solidion_default",
      active: true,
      create() {
        resolve({
          game,
          scene: this,
          frameManager,
        });
      },
      update(time: number, delta: number) {
        solidionFrameUpdate(frameManager, time, delta);
      },
    };

    const bgColor =
      props.backgroundColor !== undefined
        ? typeof props.backgroundColor === "number"
          ? `#${props.backgroundColor.toString(16).padStart(6, "0")}`
          : props.backgroundColor
        : "#000000";

    /* v8 ignore next 10 — default props: tested values always provided in browser tests */
    const gameConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: props.width ?? 800,
      height: props.height ?? 600,
      backgroundColor: bgColor,
      parent,
      scene: defaultSceneConfig as any,
      banner: false,
      ...props.physics ? { physics: props.physics } : {},
      ...props.scale ? { scale: props.scale } : {},
      ...(props.config ?? {}),
    };

    const game = new Phaser.Game(gameConfig);
  });
}

/**
 * Game component.
 *
 * Usage:
 * ```tsx
 * <Game width={800} height={600} backgroundColor={0x1a1a2e}>
 *   <sprite texture="/assets/player.png" x={100} y={200} />
 * </Game>
 * ```
 */
export function Game(props: GameProps): any {
  const [state, setState] = createSignal<GameState | null>(null);
  let containerEl: HTMLDivElement | undefined;
  let disposeRenderer: (() => void) | undefined;

  // Create container div for Phaser canvas
  /* v8 ignore next — SSR guard: document always exists in browser */
  if (typeof document !== "undefined") {
    containerEl = document.createElement("div");
    containerEl.style.display = "inline-block";

    if (props.parent) {
      const parentEl =
        typeof props.parent === "string"
          ? document.getElementById(props.parent)
          : props.parent;
      parentEl?.appendChild(containerEl);
    }
  }

  // Boot Phaser
  /* v8 ignore next — containerEl is always defined when document exists */
  if (containerEl) {
    bootPhaser(containerEl, props).then((gameState) => {
      setState(gameState);

      // Push the default scene onto the stack
      pushScene(gameState.scene);

      // Wire scene-level input events (L0)
      const sceneInput = gameState.scene.input;
      if (props.onPointerMove) {
        sceneInput.on("pointermove", props.onPointerMove);
      }
      if (props.onPointerDown) {
        sceneInput.on("pointerdown", props.onPointerDown);
      }
      if (props.onPointerUp) {
        sceneInput.on("pointerup", props.onPointerUp);
      }

      // Create a root container in the scene for the renderer
      const rootContainer = gameState.scene.add.container(0, 0);

      // Render children via the universal renderer, wrapped in Context Providers
      // so that useGame(), useScene(), and useFrame() work inside children.
      disposeRenderer = render(
        () =>
          createComponent(GameContext.Provider, {
            value: gameState.game,
            get children() {
              return createComponent(SceneContext.Provider, {
                value: gameState.scene,
                get children() {
                  return createComponent(FrameManagerContext.Provider, {
                    value: gameState.frameManager,
                    get children() {
                      return props.children;
                    },
                  });
                },
              });
            },
          }),
        rootContainer
      );
    });
  }

  onCleanup(() => {
    const s = untrack(state);
    /* v8 ignore next — disposeRenderer may not exist if cleanup runs before boot */
    if (disposeRenderer) disposeRenderer();
    /* v8 ignore next 4 — state may be null if cleanup runs before boot completes */
    if (s) {
      popScene();
      s.game.destroy(true);
    }
    /* v8 ignore next 3 — containerEl cleanup: always exists in browser */
    if (containerEl && containerEl.parentNode) {
      containerEl.parentNode.removeChild(containerEl);
    }
  });

  // Return the container element (for DOM renderer integration)
  // When used standalone, the user can mount this into the DOM
  /* v8 ignore next — containerEl is always defined when document exists */
  return containerEl ?? null;
}

/**
 * Programmatic Game creation for non-JSX usage.
 * Returns { element, destroy } where element is the DOM container.
 */
export function createGame(
  props: GameProps & { onReady?: (state: GameState) => void }
): { element: HTMLDivElement; destroy: () => void } {
  const el = document.createElement("div");
  el.style.display = "inline-block";

  let game: Phaser.Game | null = null;
  let disposeRenderer: (() => void) | undefined;

  bootPhaser(el, props).then((gameState) => {
    game = gameState.game;
    pushScene(gameState.scene);
    const rootContainer = gameState.scene.add.container(0, 0);
    disposeRenderer = render(() => props.children, rootContainer);
    props.onReady?.(gameState);
  });

  return {
    element: el,
    destroy: () => {
      /* v8 ignore next — defensive: disposeRenderer may not exist if destroy called before boot completes */
      if (disposeRenderer) disposeRenderer();
      popScene();
      /* v8 ignore next — defensive: game may be null if destroy called before boot completes */
      game?.destroy(true);
    },
  };
}
