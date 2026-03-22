/**
 * createStore + Solidion universal renderer compatibility.
 *
 * Validates that solid-js/store works with Solidion's rendering pipeline.
 * All mutations use microtask separation (matching real game patterns
 * where mutations happen in event handlers / frame callbacks).
 *
 * Key finding: createStore's fine-grained proxy tracking is fully compatible
 * with both Solid's createEffect and Solidion's renderer effect. This means
 * game entity pools can use createStore instead of mutable arrays + Signals,
 * eliminating the dual-state management pattern.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoot, createEffect, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { effect } from "../src/renderer";
import { pushScene, popScene } from "../src/core/scene-stack";

const tick = () => new Promise<void>(r => setTimeout(r, 0));

// Minimal mock scene (renderer needs a scene on the stack)
const mockScene: any = {
  add: { rectangle: () => ({}) },
  sys: { displayList: { add: () => {} } },
};

describe("createStore + universal renderer", () => {

  beforeEach(() => pushScene(mockScene));
  afterEach(() => popScene());

  // ── Basic reactivity ──

  it("createEffect tracks store property reads", async () => {
    const calls: number[] = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore({ x: 0 });
      createEffect(() => calls.push(store.x));
      queueMicrotask(() => setStore("x", 42));
      return d;
    });
    await tick();
    expect(calls).toEqual([0, 42]);
    dispose();
  });

  it("renderer effect tracks store property reads", async () => {
    const calls: number[] = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore({ x: 100 });
      effect(() => calls.push(store.x));
      queueMicrotask(() => setStore("x", 200));
      return d;
    });
    await tick();
    expect(calls).toEqual([100, 200]);
    dispose();
  });

  // ── Batch mutations ──

  it("batch coalesces multiple store mutations into one effect run", async () => {
    const calls: Array<{ x: number; y: number }> = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore({ x: 0, y: 0 });
      effect(() => calls.push({ x: store.x, y: store.y }));
      queueMicrotask(() => {
        batch(() => { setStore("x", 10); setStore("y", 20); });
      });
      return d;
    });
    await tick();
    expect(calls).toEqual([{ x: 0, y: 0 }, { x: 10, y: 20 }]);
    dispose();
  });

  // ── Nested store (entity pool pattern) ──

  it("nested store array tracks individual item mutations", async () => {
    interface Entity { active: boolean; x: number; y: number; }
    const xs: number[] = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore<{ items: Entity[] }>({
        items: [
          { active: false, x: 0, y: 0 },
          { active: false, x: 0, y: 0 },
        ],
      });
      effect(() => xs.push(store.items[0].x));
      queueMicrotask(() => setStore("items", 0, "x", 100));
      return d;
    });
    await tick();
    expect(xs).toEqual([0, 100]);
    dispose();
  });

  it("produce() works for multi-field mutations", async () => {
    interface Entity { active: boolean; x: number; y: number; }
    const actives: boolean[] = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore<{ items: Entity[] }>({
        items: [{ active: false, x: 0, y: 0 }],
      });
      effect(() => actives.push(store.items[0].active));
      queueMicrotask(() => {
        setStore("items", 0, produce(e => { e.active = true; e.x = 50; e.y = 60; }));
      });
      return d;
    });
    await tick();
    expect(actives).toEqual([false, true]);
    dispose();
  });

  // ── Pool spawn/despawn pattern ──

  it("pool spawn/despawn triggers reactive updates", async () => {
    interface Entity { active: boolean; x: number; kind: string; }
    const counts: number[] = [];
    const dispose = createRoot(d => {
      const [pool, setPool] = createStore<{ items: Entity[] }>({
        items: Array.from({ length: 5 }, () => ({ active: false, x: 0, kind: "" })),
      });
      effect(() => counts.push(pool.items.filter(e => e.active).length));

      queueMicrotask(() => {
        setPool("items", 0, { active: true, x: 100, kind: "fish" });
      });
      setTimeout(() => {
        setPool("items", 1, { active: true, x: 200, kind: "bubble" });
      }, 5);
      setTimeout(() => {
        setPool("items", 0, "active", false);
      }, 10);
      return d;
    });
    await new Promise(r => setTimeout(r, 20));
    expect(counts).toEqual([0, 1, 2, 1]);
    dispose();
  });

  // ── GameLoop-style frame mutations ──

  it("batch mutations work in frame callback pattern", () => {
    interface Fish { active: boolean; x: number; hunger: number; }
    let finalX = 0;
    const dispose = createRoot(d => {
      const [pool, setPool] = createStore<{ fish: Fish[] }>({
        fish: [{ active: true, x: 100, hunger: 0 }],
      });

      effect(() => { finalX = pool.fish[0].x; });

      // Simulate 3 frames synchronously (no timer dependency)
      for (let frame = 0; frame < 3; frame++) {
        batch(() => {
          for (let i = 0; i < pool.fish.length; i++) {
            if (pool.fish[i].active) {
              setPool("fish", i, "x", pool.fish[i].x + 1);
              setPool("fish", i, "hunger", pool.fish[i].hunger + 0.1);
            }
          }
        });
      }
      return d;
    });

    expect(finalX).toBe(103);
    dispose();
  });

  // ── Fine-grained tracking (critical for performance) ──

  it("modifying item[1] does NOT re-run effect tracking only item[0]", async () => {
    interface Entity { x: number; }
    const item0Reads: number[] = [];
    const dispose = createRoot(d => {
      const [store, setStore] = createStore<{ items: Entity[] }>({
        items: [{ x: 0 }, { x: 0 }],
      });
      effect(() => item0Reads.push(store.items[0].x));

      queueMicrotask(() => setStore("items", 1, "x", 999));
      setTimeout(() => setStore("items", 0, "x", 42), 5);
      return d;
    });

    await new Promise(r => setTimeout(r, 15));
    // item[1] mutation must NOT trigger item[0] effect
    // Only: initial (0) + item[0] mutation (42)
    expect(item0Reads).toEqual([0, 42]);
    dispose();
  });
});
