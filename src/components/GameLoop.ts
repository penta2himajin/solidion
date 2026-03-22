/**
 * <GameLoop> component (L0).
 *
 * Declarative frame callback registration. Registers an update function
 * that runs every frame inside Solid's batch(), synchronized with Phaser's
 * Scene.update loop.
 *
 * Usage:
 * ```tsx
 * <Game width={640} height={480}>
 *   <GameLoop onUpdate={(time, delta) => {
 *     // physics, AI, etc.
 *   }} />
 *   <rectangle x={ballX()} y={ballY()} ... />
 * </Game>
 * ```
 */

import { onCleanup } from "solid-js";
import { useFrameManager } from "../contexts";

export interface GameLoopProps {
  onUpdate: (time: number, delta: number) => void;
}

export function GameLoop(props: GameLoopProps): any {
  const fm = useFrameManager();
  const unregister = fm.register(props.onUpdate);
  onCleanup(unregister);
  return null;
}
