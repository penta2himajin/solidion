/**
 * Phase 1-1: JSX compilation test
 *
 * Verify that vite-plugin-solid with generate:"universal" and
 * moduleName:"solidion/renderer" correctly transforms JSX into
 * solidion/renderer's createElement/insert/setProp calls.
 */

import Phaser from "phaser";
import { createSignal } from "solid-js";
import { pushScene } from "solidion/core/scene-stack";
import { createFrameManager } from "solidion/core/frame";
import { solidionFrameUpdate } from "solidion/core/sync";
import { getMeta } from "solidion/core/meta";

// Minimal JSX component — the goal is to see the compiled output
function ClickCounter() {
  const [count, setCount] = createSignal(0);
  return (
    <container x={200} y={150}>
      <rectangle
        x={0} y={0} width={80} height={80}
        fillColor={0x7fdbca}
        onClick={() => setCount(c => c + 1)}
      />
      <text
        x={0} y={60}
        text={`Clicks: ${count()}`}
        fontSize={20}
        color="#ffffff"
        origin={0.5}
      />
    </container>
  );
}

// Boot Phaser and render the component
class TestScene extends Phaser.Scene {
  constructor() { super("test"); }

  create() {
    pushScene(this);
    const fm = createFrameManager();
    const root = this.add.container(0, 0);
    getMeta(root);

    this.events.on("update", (time: number, delta: number) => {
      solidionFrameUpdate(fm, time, delta);
    });

    // This is where JSX rendering would happen
    // For now, just log to verify compilation works
    console.log("Scene created, JSX component:", ClickCounter);
    console.log("Component output:", ClickCounter());
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 400,
  height: 300,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  scene: TestScene,
  banner: false,
});
