/**
 * Browser test: verify useSequence works inside <Game>.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createRoot } from "solid-js";
import { Game } from "solidion/components/Game";
import { useSequence } from "solidion/hooks/useSequence";

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

describe("useSequence inside Game (browser)", () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => { cleanup?.(); cleanup = undefined; });

  it("useSequence executes steps in order", async () => {
    const log: string[] = [];
    let seq: any;

    function SeqTest() {
      seq = useSequence([
        { action: "step1", duration: 100, onStart: () => log.push("s1") },
        { action: "step2", duration: 100, onStart: () => log.push("s2") },
        { action: "step3", duration: 100, onStart: () => log.push("s3") },
      ]);
      return <rectangle x={100} y={75} width={20} height={20} fillColor={0xff0000} origin={0.5} />;
    }

    const result = await mountGame(() => (
      <Game width={200} height={150} backgroundColor={0x000000} parent={undefined}>
        <SeqTest />
      </Game>
    ));
    cleanup = result.cleanup;

    expect(seq.playing()).toBe(false);
    expect(seq.current()).toBeNull();

    // Start sequence
    seq.play();
    expect(seq.playing()).toBe(true);
    expect(log).toContain("s1");

    // Wait for all steps to complete
    await new Promise((r) => setTimeout(r, 500));
    expect(log).toEqual(["s1", "s2", "s3"]);
    expect(seq.playing()).toBe(false);
  });
});
