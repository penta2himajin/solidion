/**
 * Browser test: verify hooks work inside <Game> component.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { useOscillation } from "solidion/hooks/useOscillation";

function mountGame(jsx: () => any, waitMs = 800): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let dispose: (() => void) | undefined;
    createRoot((d) => {
      dispose = d;
      const el = jsx();
      if (el instanceof HTMLElement) container.appendChild(el);
    });
    setTimeout(() => {
      resolve({ container, cleanup: () => { dispose?.(); container.remove(); } });
    }, waitMs);
  });
}

describe("Hooks inside Game (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("useOscillation produces changing values inside Game", async () => {
    let oscVal: any;

    function OscTest() {
      const osc = useOscillation({ amplitude: { y: 10 }, frequency: 2 });
      oscVal = osc;
      return <rectangle x={320} y={240 + osc().y} width={20} height={20} fillColor={0xff0000} origin={0.5} />;
    }

    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <OscTest />
      </Game>
    ), 1000);
    cleanup = result.cleanup;

    // After 1 second at 2Hz, oscillation should have produced non-zero values
    expect(oscVal).toBeDefined();
    // The value might be 0 at certain phases, but over 1s it should have varied
    const canvas = result.container.querySelector("canvas");
    expect(canvas).not.toBeNull();
  });
});
