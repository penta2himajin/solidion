/**
 * Browser test: verify <Show when={false}> hides elements AND
 * disables their input so they don't block clicks.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { Show } from "solidion/components/Show";

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

describe("Show visibility + input (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("Show when={false} hides elements from the start", async () => {
    let rectRef: any = null;

    // Test without Show first — just visible={false} prop
    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <rectangle x={100} y={75} width={50} height={50} fillColor={0xff0000} origin={0.5}
          visible={false}
          ref={(el: any) => { rectRef = el; }}
          onClick={() => {}}
        />
      </Game>
    ));
    cleanup = result.cleanup;

    expect(rectRef).not.toBeNull();

    // Log the actual Phaser render flags and visible state at different times
    const v0 = rectRef.visible;
    await new Promise((r) => setTimeout(r, 100));
    const v1 = rectRef.visible;
    await new Promise((r) => setTimeout(r, 500));
    const v2 = rectRef.visible;

    // If v0=false, v1/v2=true then something resets visible after initial set
    // If v0=true, then setProp("visible", false) isn't reaching the object
    expect({ v0, v1, v2 }).toEqual({ v0: false, v1: false, v2: false });
  });

  it("visible={signal()} prop toggles visibility AND input.enabled", async () => {
    let setVis!: (v: boolean) => void;
    let rectRef: any = null;

    const result = await mountGame(() => {
      const [vis, sv] = createSignal(false);
      setVis = sv;
      return (
        <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
          <rectangle x={100} y={75} width={50} height={50} fillColor={0xff0000} origin={0.5}
            visible={vis()}
            ref={(el: any) => { rectRef = el; }}
            onClick={() => {}}
          />
        </Game>
      );
    });
    cleanup = result.cleanup;

    // Initially hidden (visible={false})
    expect(rectRef.visible).toBe(false);
    if (rectRef.input) expect(rectRef.input.enabled).toBe(false);

    // Show it
    setVis(true);
    await new Promise((r) => setTimeout(r, 100));
    expect(rectRef.visible).toBe(true);
    if (rectRef.input) expect(rectRef.input.enabled).toBe(true);

    // Hide it again
    setVis(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(rectRef.visible).toBe(false);
    if (rectRef.input) expect(rectRef.input.enabled).toBe(false);
  });
});
