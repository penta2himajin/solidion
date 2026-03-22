/**
 * Phase 1-3: <Scene> component browser integration test
 *
 * Verify that:
 * 1. <Scene> creates a new Phaser Scene with its own objects
 * 2. Objects in different Scenes are isolated
 * 3. Scene switching via <Show> mounts/unmounts correctly
 * 4. Scene cleanup on unmount (popScene, scene.remove)
 */

import { createSignal, Show } from "solid-js";
import { Game } from "solidion/components/Game";
import { Scene } from "solidion/components/Scene";

function App() {
  const [activeScene, setActiveScene] = createSignal<"game" | "ui">("game");

  return (
    <Game width={500} height={400} backgroundColor={0x1a1a2e} parent="game-container">

      {/* Default scene objects — always visible */}
      <rectangle x={250} y={20} width={500} height={40}
        fillColor={0x333355} depth={0}
      />
      <text x={250} y={20} text="Default Scene (always visible)"
        fontSize={14} color="#888888" origin={0.5} depth={1}
      />

      {/* Toggle buttons */}
      <rectangle x={170} y={370} width={120} height={30}
        fillColor={activeScene() === "game" ? 0x7fdbca : 0x444466}
        onClick={() => setActiveScene("game")}
        depth={10}
      />
      <text x={170} y={370} text="Game Scene"
        fontSize={12} color="#000000" origin={0.5} depth={11}
      />

      <rectangle x={330} y={370} width={120} height={30}
        fillColor={activeScene() === "ui" ? 0xff9944 : 0x444466}
        onClick={() => setActiveScene("ui")}
        depth={10}
      />
      <text x={330} y={370} text="UI Scene"
        fontSize={12} color="#000000" origin={0.5} depth={11}
      />

      {/* Scene A: Game scene with moving objects */}
      <Show when={activeScene() === "game"}>
        <Scene name="game-scene">
          <GameScene />
        </Scene>
      </Show>

      {/* Scene B: UI overlay scene */}
      <Show when={activeScene() === "ui"}>
        <Scene name="ui-scene">
          <UIScene />
        </Scene>
      </Show>
    </Game>
  );
}

function GameScene() {
  const [clicks, setClicks] = createSignal(0);
  const size = () => 60 + clicks() * 5;

  return (
    <>
      <text x={250} y={80} text="Game Scene"
        fontSize={20} color="#7fdbca" origin={0.5}
      />
      {/* Test A: static size + onClick */}
      <rectangle x={150} y={200} width={80} height={80}
        fillColor={0x44aa88}
        onClick={() => { console.log("STATIC CLICK"); setClicks(c => c + 1); }}
      />
      {/* Test B: dynamic size + onClick */}
      <rectangle x={350} y={200} width={size()} height={size()}
        fillColor={0x7fdbca}
        onClick={() => { console.log("DYNAMIC CLICK"); setClicks(c => c + 1); }}
      />
      <text x={250} y={300} text={`Clicks: ${clicks()} size: ${size()}`}
        fontSize={14} color="#aaaaaa" origin={0.5}
      />
    </>
  );
}

function UIScene() {
  const [value, setValue] = createSignal(50);

  return (
    <>
      <text x={250} y={80} text="UI Scene"
        fontSize={20} color="#ff9944" origin={0.5}
      />
      {/* Slider-like: click left/right to adjust */}
      <rectangle x={250} y={200} width={300} height={20}
        fillColor={0x333355}
      />
      <rectangle x={100 + value() * 2} y={200} width={20} height={30}
        fillColor={0xff9944}
      />
      <rectangle x={150} y={260} width={60} height={30}
        fillColor={0x664422}
        onClick={() => setValue(v => Math.max(0, v - 10))}
      />
      <text x={150} y={260} text="<" fontSize={16} color="#ffffff" origin={0.5} />
      <rectangle x={350} y={260} width={60} height={30}
        fillColor={0x664422}
        onClick={() => setValue(v => Math.min(100, v + 10))}
      />
      <text x={350} y={260} text=">" fontSize={16} color="#ffffff" origin={0.5} />
      <text x={250} y={300} text={`Value: ${value()}`}
        fontSize={14} color="#aaaaaa" origin={0.5}
      />
    </>
  );
}

// Mount
import { createRoot } from "solid-js";

createRoot(() => {
  const el = App();
  if (el instanceof HTMLElement) {
    document.getElementById("game-container")?.appendChild(el);
  }
});
import "./vis-check";
