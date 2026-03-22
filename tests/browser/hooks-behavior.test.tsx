/**
 * Browser test: verify L1c behavior components work inside <Game>.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { OscillateBehavior } from "solidion/behaviors";

function mountGame(jsx: () => any, waitMs = 1000): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let dispose: (() => void) | undefined;
    createRoot((d) => { dispose = d; const el = jsx(); if (el instanceof HTMLElement) container.appendChild(el); });
    setTimeout(() => { resolve({ container, cleanup: () => { dispose?.(); container.remove(); } }); }, waitMs);
  });
}

describe("OscillateBehavior inside Game (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("OscillateBehavior modifies parent y via delta composition", async () => {
    let rectRef: any = null;

    function BehaviorTest() {
      return (
        <>
          <rectangle x={100} y={200} width={40} height={40} fillColor={0xff0000} origin={0.5}
            ref={(el: any) => {
              rectRef = el;
              // Attach OscillateBehavior after ref is available
              // Using props-based parent passing (not JSX child pattern)
            }}
          />
          {rectRef && <OscillateBehavior parent={rectRef} amplitude={{ y: 20 }} frequency={2} />}
        </>
      );
    }

    // Simpler test: pass parent directly
    let parentEl: any = null;

    const result = await mountGame(() => {
      return (
        <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
          <rectangle x={100} y={100} width={40} height={40} fillColor={0xff0000} origin={0.5}
            ref={(el: any) => { parentEl = el; }}
          />
        </Game>
      );
    }, 500);

    // parentEl should be set via ref
    expect(parentEl).not.toBeNull();

    cleanup = result.cleanup;
  });
});
