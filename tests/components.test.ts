import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRoot, createSignal, createEffect, batch } from "solid-js";
import { solidionFrameUpdate } from "../src/core/sync";
import { createFrameManager } from "../src/core/frame";
import { composeProp, applyProp, reapplyProp } from "../src/core/props";
import { addDelta, removeDelta, getMeta } from "../src/core/meta";
import { MockSprite, MockScene, MockGameObject } from "./mocks";
import { Show } from "../src/components/Show";
import { For, Index } from "../src/components/For";

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

// ── Show component ──

describe("Show", () => {
  it("toggles visibility on a single node", () => {
    let setWhen!: (v: boolean) => void;
    const obj = new MockGameObject();

    const dispose = createRoot((dispose) => {
      const [when, _setWhen] = createSignal(true);
      setWhen = _setWhen;
      Show({ get when() { return when(); }, children: obj });
      return dispose;
    });

    expect(obj.visible).toBe(true);

    setWhen(false);
    expect(obj.visible).toBe(false);

    setWhen(true);
    expect(obj.visible).toBe(true);

    dispose();
  });

  it("toggles visibility on an array of nodes", () => {
    let setWhen!: (v: boolean) => void;
    const a = new MockGameObject();
    const b = new MockGameObject();

    const dispose = createRoot((dispose) => {
      const [when, _setWhen] = createSignal(true);
      setWhen = _setWhen;
      Show({ get when() { return when(); }, children: [a, b] });
      return dispose;
    });

    setWhen(false);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);

    setWhen(true);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);

    dispose();
  });

  it("returns children", () => {
    createRoot((dispose) => {
      const obj = new MockGameObject();
      const result = Show({ when: true, children: obj });
      expect(result).toBe(obj);
      dispose();
    });
  });

  it("hides children when when=false initially", () => {
    const obj = new MockGameObject();

    const dispose = createRoot((dispose) => {
      Show({ when: false, children: obj });
      return dispose;
    });

    expect(obj.visible).toBe(false);
    dispose();
  });
});

// ── For component ──

describe("For", () => {
  it("renders initial items and returns nodes", () => {
    createRoot((dispose) => {
      const items = ["a", "b", "c"];
      const rendered: string[] = [];

      const result = For({
        each: items,
        children: (item, i) => {
          rendered.push(item);
          const obj = new MockGameObject();
          return obj;
        },
      });

      expect(rendered).toEqual(["a", "b", "c"]);
      expect(result).toHaveLength(3);

      dispose();
    });
  });

  it("hides nodes for removed items (identity-based)", () => {
    const itemA = { id: "a" };
    const itemB = { id: "b" };
    const itemC = { id: "c" };
    let setItems!: (v: { id: string }[]) => void;
    const nodes: MockGameObject[] = [];

    const dispose = createRoot((dispose) => {
      const [items, _setItems] = createSignal([itemA, itemB, itemC] as { id: string }[]);
      setItems = _setItems;

      For({
        get each() { return items(); },
        children: (item, i) => {
          const obj = new MockGameObject();
          nodes.push(obj);
          return obj;
        },
      });

      return dispose;
    });

    // All visible initially
    expect(nodes.every(n => n.visible)).toBe(true);

    // Remove itemB
    setItems([itemA, itemC]);
    expect(nodes[0].visible).toBe(true);  // itemA still present
    expect(nodes[1].visible).toBe(false); // itemB removed
    expect(nodes[2].visible).toBe(true);  // itemC still present

    // Remove all
    setItems([]);
    expect(nodes.every(n => !n.visible)).toBe(true);

    // Restore all
    setItems([itemA, itemB, itemC]);
    expect(nodes.every(n => n.visible)).toBe(true);

    dispose();
  });
});

// ── Index component ──

describe("Index", () => {
  it("renders initial items and returns nodes", () => {
    createRoot((dispose) => {
      const items = [10, 20, 30];
      const result = Index({
        each: items,
        children: (item, i) => {
          const obj = new MockGameObject();
          return obj;
        },
      });

      expect(result).toHaveLength(3);
      dispose();
    });
  });

  it("hides excess slots when list shrinks (position-based)", () => {
    let setItems!: (v: number[]) => void;
    const nodes: MockGameObject[] = [];

    const dispose = createRoot((dispose) => {
      const [items, _setItems] = createSignal([1, 2, 3] as number[]);
      setItems = _setItems;

      Index({
        get each() { return items(); },
        children: (item, i) => {
          const obj = new MockGameObject();
          nodes.push(obj);
          return obj;
        },
      });

      return dispose;
    });

    expect(nodes.every(n => n.visible)).toBe(true);

    // Shrink to 1 item
    setItems([1]);
    expect(nodes[0].visible).toBe(true);
    expect(nodes[1].visible).toBe(false);
    expect(nodes[2].visible).toBe(false);

    // Shrink to 0
    setItems([]);
    expect(nodes.every(n => !n.visible)).toBe(true);

    // Grow back to 3
    setItems([1, 2, 3]);
    expect(nodes.every(n => n.visible)).toBe(true);

    dispose();
  });
});

// ── GameLoop component ──

vi.mock("../src/contexts", () => {
  let mockFM: any = null;
  return {
    useFrameManager: () => {
      if (!mockFM) throw new Error("No mock FM set");
      return mockFM;
    },
    __setMockFrameManager: (fm: any) => { mockFM = fm; },
    __clearMockFrameManager: () => { mockFM = null; },
  };
});

describe("GameLoop", () => {
  it("registers a frame callback and auto-cleans on cleanup", async () => {
    const { __setMockFrameManager, __clearMockFrameManager } = await import("../src/contexts") as any;
    const { GameLoop } = await import("../src/components/GameLoop");

    const registered: Function[] = [];
    const unregistered: Function[] = [];
    const mockFM = {
      register: (cb: Function) => {
        registered.push(cb);
        return () => { unregistered.push(cb); };
      },
    };

    __setMockFrameManager(mockFM);

    createRoot((dispose) => {
      const onUpdate = vi.fn();
      const result = GameLoop({ onUpdate });

      expect(result).toBeNull();
      expect(registered).toHaveLength(1);
      expect(registered[0]).toBe(onUpdate);
      expect(unregistered).toHaveLength(0);

      // Cleanup (dispose triggers onCleanup)
      dispose();
      expect(unregistered).toHaveLength(1);
      expect(unregistered[0]).toBe(onUpdate);
    });

    __clearMockFrameManager();
  });
});
