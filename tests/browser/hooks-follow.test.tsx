/**
 * Browser test: verify useFollow works inside <Game>.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { useFollow } from "solidion/hooks/useFollow";

function mountGame(jsx: () => any, waitMs = 800): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let dispose: (() => void) | undefined;
    createRoot((d) => { dispose = d; const el = jsx(); if (el instanceof HTMLElement) container.appendChild(el); });
    setTimeout(() => { resolve({ container, cleanup: () => { dispose?.(); container.remove(); } }); }, waitMs);
  });
}

describe("useFollow inside Game (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("follows a moving target with smooth lag", async () => {
    let followVal: any;
    let setTarget!: (v: { x: number; y: number }) => void;

    function FollowTest() {
      const [target, st] = createSignal({ x: 50, y: 50 });
      setTarget = st;
      const pos = useFollow({ target, speed: 0.3 });
      followVal = pos;
      return <rectangle x={pos().x} y={pos().y} width={10} height={10} fillColor={0xff0000} origin={0.5} />;
    }

    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <FollowTest />
      </Game>
    ));
    cleanup = result.cleanup;

    // Move target far away
    setTarget({ x: 150, y: 120 });
    await new Promise((r) => setTimeout(r, 500));

    // After 500ms with speed=0.3, follow should have moved toward target
    expect(followVal().x).toBeGreaterThan(80);
    expect(followVal().y).toBeGreaterThan(70);
  });
});
