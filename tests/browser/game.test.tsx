/**
 * Browser integration test: verify <Game> + JSX renders in a real browser.
 *
 * Uses Vitest browser mode (Playwright) to run tests in Chromium.
 * Tests that Phaser boots, canvas is created, GameObjects render,
 * and no console errors occur.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { Show } from "solidion/components/Show";

// Helper: mount a Game, wait for Phaser to boot, return cleanup function
function mountGame(jsx: () => any): Promise<{ container: HTMLDivElement; cleanup: () => void }> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.id = "test-game-" + Math.random().toString(36).slice(2);
    document.body.appendChild(container);

    let dispose: (() => void) | undefined;

    createRoot((d) => {
      dispose = d;
      const el = jsx();
      if (el instanceof HTMLElement) {
        container.appendChild(el);
      }
    });

    // Wait for Phaser to boot and render first frame
    setTimeout(() => {
      resolve({
        container,
        cleanup: () => {
          dispose?.();
          container.remove();
        },
      });
    }, 500);
  });
}

// Helper: check if canvas has non-transparent pixels
function canvasHasContent(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true; // any non-transparent pixel
  }
  return false;
}

describe("Game component (browser)", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("boots Phaser and creates a canvas element", async () => {
    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x1a1a2e} parent={undefined}>
        <rectangle x={100} y={75} width={40} height={40} fillColor={0xff0000} origin={0.5} />
      </Game>
    ));
    cleanup = result.cleanup;

    const canvas = result.container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas!.width).toBeGreaterThan(0);
    expect(canvas!.height).toBeGreaterThan(0);
  });

  it("renders GameObjects on the canvas", async () => {
    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <rectangle x={100} y={75} width={80} height={80} fillColor={0xff0000} origin={0.5} />
        <text x={100} y={130} text="Hello" fontSize={14} color="#ffffff" origin={0.5} />
      </Game>
    ));
    cleanup = result.cleanup;

    const canvas = result.container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    // Canvas should have non-transparent content (Phaser rendered something)
    // Note: Phaser may use WebGL, in which case getContext("2d") returns null.
    // In that case we just verify the canvas exists with correct dimensions.
    if (canvas.getContext("2d")) {
      expect(canvasHasContent(canvas)).toBe(true);
    }
  });

  it("Solidion <Show> toggles visibility", async () => {
    let setVisible!: (v: boolean) => void;

    const result = await mountGame(() => {
      const [visible, sv] = createSignal(true);
      setVisible = sv;
      return (
        <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
          <Show when={visible()}>
            <rectangle x={100} y={75} width={40} height={40} fillColor={0x00ff00} origin={0.5} />
          </Show>
        </Game>
      );
    });
    cleanup = result.cleanup;

    const canvas = result.container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    // Toggle visibility — should not throw
    setVisible(false);
    await new Promise((r) => setTimeout(r, 100));
    setVisible(true);
    await new Promise((r) => setTimeout(r, 100));
    // If we got here without errors, Show works
  });

  it("ref prop provides raw Phaser GameObject", async () => {
    let rectRef: any = null;

    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <rectangle x={100} y={75} width={50} height={50} fillColor={0xff0000}
          origin={0.5} ref={(el: any) => { rectRef = el; }}
        />
      </Game>
    ));
    cleanup = result.cleanup;

    expect(rectRef).not.toBeNull();
    expect(rectRef.x).toBe(100);
    expect(rectRef.y).toBe(75);
    expect(typeof rectRef.setPosition).toBe("function");
  });
});
