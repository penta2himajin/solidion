/**
 * Browser test: verify useTween works inside <Game>.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { useTween } from "solidion/hooks/useTween";

function mountGame(jsx: () => any, waitMs = 1000): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
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

describe("useTween inside Game (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("useTween animates scale from 0 to 1", async () => {
    let tweenVal: any;
    let setPlay!: (v: boolean) => void;

    function TweenTest() {
      const [playing, sp] = createSignal(false);
      setPlay = sp;

      const tween = useTween({
        from: { scale: 0 },
        to: { scale: 1 },
        duration: 300,
        ease: "Linear",
        playing: () => playing(),
      });
      tweenVal = tween;

      return <rectangle x={100} y={75} width={40} height={40}
        fillColor={0xff0000} origin={0.5} scale={tween().scale} />;
    }

    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <TweenTest />
      </Game>
    ), 500);
    cleanup = result.cleanup;

    // Initially scale should be 0 (from)
    expect(tweenVal().scale).toBe(0);

    // Start tween
    setPlay(true);
    await new Promise((r) => setTimeout(r, 500));

    // After 500ms (tween is 300ms), scale should be 1 (to)
    expect(tweenVal().scale).toBe(1);
  });
});
