import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot, createSignal, batch } from "solid-js";
import { solidionFrameUpdate } from "../src/core/sync";
import { createFrameManager } from "../src/core/frame";
import { composeProp, applyProp, reapplyProp } from "../src/core/props";
import { addDelta, removeDelta, getMeta } from "../src/core/meta";
import { MockSprite, MockScene } from "./mocks";

describe("solidionFrameUpdate", () => {
  it("wraps frame callbacks in batch", () => {
    const fm = createFrameManager();
    const updates: string[] = [];

    createRoot((dispose) => {
      const [x, setX] = createSignal(0);
      const [y, setY] = createSignal(0);

      // Track when signals are read (effects would fire)
      fm.register((time, delta) => {
        setX(time);
        setY(delta);
        updates.push(`cb:${time}:${delta}`);
      });

      solidionFrameUpdate(fm, 1000, 16);
      expect(updates).toEqual(["cb:1000:16"]);

      dispose();
    });
  });

  it("batches multiple signal updates atomically", () => {
    const fm = createFrameManager();
    const effectRuns: number[] = [];

    createRoot((dispose) => {
      const [a, setA] = createSignal(0);
      const [b, setB] = createSignal(0);

      fm.register(() => {
        setA(1);
        setB(2);
      });

      solidionFrameUpdate(fm, 0, 16);
      expect(a()).toBe(1);
      expect(b()).toBe(2);

      dispose();
    });
  });
});

describe("reapplyProp with delta composition", () => {
  it("reapplies additive property with delta", () => {
    const sprite = new MockSprite();

    // Set base value
    applyProp(sprite as any, "x", 100);
    expect(sprite.x).toBe(100);

    // Add behavior delta
    addDelta(sprite, "spring-1", { x: 50 });

    // Reapply — should compose base + delta
    reapplyProp(sprite as any, "x");
    expect(sprite.x).toBe(150); // 100 + 50
  });

  it("reapplies multiplicative property with delta", () => {
    const sprite = new MockSprite();

    applyProp(sprite as any, "scale", 2);
    expect(sprite.scaleX).toBe(2);

    addDelta(sprite, "jiggle", { scale: 0.5 });
    reapplyProp(sprite as any, "scale");
    expect(sprite.scaleX).toBe(3); // 2 * (1 + 0.5)
  });

  it("handles multiple deltas on same property", () => {
    const sprite = new MockSprite();

    applyProp(sprite as any, "x", 100);
    addDelta(sprite, "spring", { x: 20 });
    addDelta(sprite, "oscillate", { x: 5 });

    reapplyProp(sprite as any, "x");
    expect(sprite.x).toBe(125); // 100 + 20 + 5
  });

  it("removes delta and reapplies to base", () => {
    const sprite = new MockSprite();

    applyProp(sprite as any, "x", 100);
    addDelta(sprite, "spring", { x: 50 });
    reapplyProp(sprite as any, "x");
    expect(sprite.x).toBe(150);

    removeDelta(sprite, "spring");
    reapplyProp(sprite as any, "x");
    expect(sprite.x).toBe(100); // Back to base
  });

  it("does nothing for property without base value", () => {
    const sprite = new MockSprite();
    sprite.x = 42;

    addDelta(sprite, "spring", { x: 10 });
    reapplyProp(sprite as any, "x");
    // No base value stored, so reapplyProp returns without action
    expect(sprite.x).toBe(42);
  });
});

describe("Preload logic", () => {
  it("preloadAssets resolves for cached textures", async () => {
    const { preloadAssets } = await import("../src/core/texture");
    const scene = new MockScene();
    scene.textures.addKey("/assets/cached.png");

    await preloadAssets(scene as any, ["/assets/cached.png"]);
    // Should resolve immediately without loading
  });
});

describe("AssetSpec parsing", () => {
  it("parseTextureRef handles all formats", async () => {
    const { parseTextureRef } = await import("../src/core/texture");

    const img = parseTextureRef("/assets/bg.png");
    expect(img.type).toBe("image");
    expect(img.key).toBe("/assets/bg.png");

    const atlas = parseTextureRef("chars:idle-0");
    expect(atlas.type).toBe("atlas");
    expect(atlas.key).toBe("chars");
    expect(atlas.frame).toBe("idle-0");
  });
});
