/**
 * Phase 1-2 + 1-4: <Game> component + JSX minimal example
 *
 * Verify that:
 * 1. <Game> boots Phaser, creates canvas, and renders children via JSX
 * 2. Static props bind correctly
 * 3. Dynamic props (signals) update reactively
 * 4. Event handlers work (onClick)
 * 5. <Show> control flow works
 */

import { createSignal, Show } from "solid-js";
import { Game } from "solidion/components/Game";

function App() {
  const [count, setCount] = createSignal(0);
  const isHigh = () => count() >= 5;

  return (
    <Game width={400} height={300} backgroundColor={0x1a1a2e} parent="game-container">
      {/* Static rectangle */}
      <rectangle x={200} y={100} width={80} height={80}
        fillColor={0x7fdbca}
        onClick={() => setCount(c => c + 1)}
      />

      {/* Dynamic text — updates reactively */}
      <text x={200} y={200} text={`Clicks: ${count()}`}
        fontSize={20} color="#ffffff" origin={0.5}
      />

      {/* Conditional rendering with <Show> */}
      <Show when={isHigh()}>
        <text x={200} y={250} text="5+ clicks!"
          fontSize={14} color="#ffcc00" origin={0.5}
        />
      </Show>
    </Game>
  );
}

// Mount into DOM — since <Game> returns a DOM element,
// we need to handle the mounting ourselves
import { createRoot } from "solid-js";

createRoot(() => {
  const el = App();
  if (el instanceof HTMLElement) {
    document.getElementById("game-container")?.appendChild(el);
  }
});
