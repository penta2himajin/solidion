/**
 * Integration tests: Solid's reactive system + Solidion renderer.
 *
 * Uses the real solid-js client runtime (createSignal, createRoot, createEffect)
 * with a test renderer built via solid-js/universal's createRenderer.
 * Verifies that Solid's reactivity correctly drives the createElement → setProp →
 * insertNode → removeNode pipeline with mock Phaser objects.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRoot, createSignal, createEffect, batch } from "solid-js";
import { createRenderer } from "solid-js/universal";
import { pushScene, popScene, resetSceneStack, getCurrentScene } from "../src/core/scene-stack";
import { getMeta } from "../src/core/meta";
import { isEventProp, resolveEventName } from "../src/core/events";
import { applyProp } from "../src/core/props";
import { MockScene, MockSprite, MockText, MockContainer, MockRectangle, MockGameObject, MockZone } from "./mocks";

// ---- Build a test renderer ----

const FACTORIES: Record<string, (scene: MockScene) => MockGameObject> = {
  sprite: (s) => { const o = new MockSprite(); o.scene = s as any; return o; },
  text: (s) => { const o = new MockText(); o.scene = s as any; return o; },
  container: (s) => { const o = new MockContainer(); o.scene = s as any; return o; },
  rectangle: (s) => { const o = new MockRectangle(); o.scene = s as any; return o; },
  zone: (s) => { const o = new MockZone(); o.scene = s as any; return o; },
};

interface TextNode { __test_textNode: true; value: string; parent: any; }
function isTextNode(n: any): n is TextNode {
  return n && n.__test_textNode === true;
}

const {
  render: solidionRender,
  effect,
  memo,
  createElement,
  createTextNode,
  insertNode,
  insert,
  setProp,
  spread,
  mergeProps,
  createComponent,
} = createRenderer({
  createElement(type: string): any {
    const scene = getCurrentScene() as any as MockScene;
    if (!scene) throw new Error(`No scene for createElement("${type}")`);
    const factory = FACTORIES[type];
    if (!factory) throw new Error(`Unknown type: ${type}`);
    const node = factory(scene);
    getMeta(node);
    return node;
  },
  createTextNode(value: string): any {
    return { __test_textNode: true, value, parent: null };
  },
  replaceText(node: any, value: string): void {
    if (isTextNode(node)) {
      node.value = value;
      if (node.parent && typeof node.parent.setText === "function") {
        node.parent.setText(value);
      }
    }
  },
  setProperty(node: any, name: string, value: any): void {
    if (isTextNode(node)) return;
    if (!node || typeof node !== "object") return;
    if (name === "ref" || name === "children") return;

    if (isEventProp(name)) {
      const event = resolveEventName(name);
      if (!event) return;
      const meta = getMeta(node);
      const prev = meta.handlers.get(name);
      if (prev) node.off(event, prev);
      if (value) {
        if (!node.input) node.setInteractive();
        node.on(event, value);
        meta.handlers.set(name, value);
      } else {
        meta.handlers.delete(name);
        if (meta.handlers.size === 0 && node.input) node.removeInteractive();
      }
      return;
    }
    applyProp(node as any, name, value);
  },
  insertNode(parent: any, node: any, anchor?: any): void {
    if (isTextNode(node)) { node.parent = parent; return; }
    if (!parent || !node) return;
    const meta = getMeta(parent);
    if (anchor) {
      const idx = meta.children.indexOf(anchor);
      if (idx >= 0) meta.children.splice(idx, 0, node);
      else meta.children.push(node);
    } else {
      meta.children.push(node);
    }
    if (parent instanceof MockContainer) parent.add(node);
  },
  removeNode(parent: any, node: any): void {
    if (isTextNode(node)) { node.parent = null; return; }
    if (!parent || !node) return;
    const meta = getMeta(parent);
    const idx = meta.children.indexOf(node);
    if (idx >= 0) meta.children.splice(idx, 1);
    if (parent instanceof MockContainer) parent.remove(node);
    const nodeMeta = getMeta(node);
    for (const [name, handler] of nodeMeta.handlers) {
      const event = resolveEventName(name);
      if (event) node.off(event, handler);
    }
    nodeMeta.handlers.clear();
    node.destroy();
  },
  getParentNode(node: any): any {
    if (isTextNode(node)) return node.parent;
    return node?.parentContainer ?? null;
  },
  getFirstChild(node: any): any {
    if (isTextNode(node)) return null;
    return getMeta(node).children[0] ?? null;
  },
  getNextSibling(node: any): any {
    const parent = isTextNode(node) ? node.parent : node?.parentContainer;
    if (!parent) return null;
    const meta = getMeta(parent);
    const idx = meta.children.indexOf(node);
    return idx >= 0 ? meta.children[idx + 1] ?? null : null;
  },
  isTextNode,
});

// ---- Tests ----

describe("Integration: Solid Reactivity + Solidion Renderer", () => {
  let scene: MockScene;
  let root: MockContainer;

  beforeEach(() => {
    resetSceneStack();
    scene = new MockScene();
    pushScene(scene as any);
    root = new MockContainer();
    root.scene = scene as any;
    getMeta(root);
  });

  describe("createElement + setProp", () => {
    it("creates a sprite and sets properties", () => {
      let sprite: any;
      createRoot((dispose) => {
        sprite = createElement("sprite");
        setProp(sprite, "x", 100);
        setProp(sprite, "y", 200);
        setProp(sprite, "alpha", 0.5);
        insert(root, sprite);
        dispose();
      });
      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
      expect(sprite.alpha).toBe(0.5);
      expect(getMeta(root).children).toContain(sprite);
    });

    it("creates text with properties", () => {
      let text: any;
      createRoot((dispose) => {
        text = createElement("text");
        setProp(text, "text", "Hello");
        setProp(text, "fontSize", 20);
        setProp(text, "color", "#ff0000");
        dispose();
      });
      expect(text.text).toBe("Hello");
      expect(text.style.fontSize).toBe(20);
      expect(text.style.color).toBe("#ff0000");
    });
  });

  describe("Reactive property updates via effect", () => {
    it("updates properties when signals change", () => {
      let sprite: any;
      let setX!: (v: number) => void;

      const dispose = createRoot((dispose) => {
        const [x, _setX] = createSignal(50);
        setX = _setX;

        sprite = createElement("sprite");
        effect(() => setProp(sprite, "x", x()));
        insert(root, sprite);
        return dispose;
      });

      expect(sprite.x).toBe(50);
      setX(150);
      expect(sprite.x).toBe(150);
      setX(999);
      expect(sprite.x).toBe(999);

      dispose();
    });

    it("updates multiple properties reactively", () => {
      let sprite: any;
      let setPos!: (v: { x: number; y: number }) => void;

      const dispose = createRoot((dispose) => {
        const [pos, _setPos] = createSignal({ x: 0, y: 0 });
        setPos = _setPos;
        sprite = createElement("sprite");

        effect(() => {
          const p = pos();
          setProp(sprite, "x", p.x);
          setProp(sprite, "y", p.y);
        });
        return dispose;
      });

      expect(sprite.x).toBe(0);
      expect(sprite.y).toBe(0);

      setPos({ x: 100, y: 200 });
      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);

      dispose();
    });

    it("batch updates are applied atomically", () => {
      let sprite: any;
      let setX!: (v: number) => void;
      let setY!: (v: number) => void;

      const dispose = createRoot((dispose) => {
        const [x, _setX] = createSignal(0);
        const [y, _setY] = createSignal(0);
        setX = _setX;
        setY = _setY;

        sprite = createElement("sprite");
        effect(() => setProp(sprite, "x", x()));
        effect(() => setProp(sprite, "y", y()));
        return dispose;
      });

      batch(() => {
        setX(100);
        setY(200);
      });

      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
      dispose();
    });
  });

  describe("Reactive event handlers", () => {
    it("registers and triggers event handler", () => {
      let sprite: any;
      const handler = vi.fn();

      const dispose = createRoot((dispose) => {
        sprite = createElement("sprite");
        setProp(sprite, "onClick", handler);
        return dispose;
      });

      expect(sprite.input).toBeTruthy();
      sprite.emit("pointerdown");
      expect(handler).toHaveBeenCalledOnce();
      dispose();
    });

    it("swaps event handlers reactively without leaks", () => {
      let sprite: any;
      let setHandler!: (v: () => void) => void;
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const dispose = createRoot((dispose) => {
        const [handler, _setHandler] = createSignal<() => void>(handler1);
        setHandler = _setHandler;

        sprite = createElement("sprite");
        effect(() => setProp(sprite, "onClick", handler()));
        return dispose;
      });

      sprite.emit("pointerdown");
      expect(handler1).toHaveBeenCalledOnce();

      setHandler(() => handler2);  // Wrap in arrow: Solid treats bare functions as updaters
      handler1.mockClear();
      sprite.emit("pointerdown");
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
      expect(sprite.getListenerCount("pointerdown")).toBe(1);

      dispose();
    });
  });

  describe("Container parent-child", () => {
    it("adds children to Container via insertNode", () => {
      createRoot((dispose) => {
        const container = createElement("container") as unknown as MockContainer;
        const child = createElement("sprite");
        insert(root, container as any);
        insertNode(container as any, child);

        expect(container.list).toContain(child);
        expect(getMeta(container).children).toContain(child);
        dispose();
      });
    });
  });

  describe("Scene stack integration", () => {
    it("creates elements in the correct scene", () => {
      const scene2 = new MockScene();
      createRoot((dispose) => {
        const s1 = createElement("sprite");
        expect((s1 as any).scene).toBe(scene);

        pushScene(scene2 as any);
        const s2 = createElement("sprite");
        expect((s2 as any).scene).toBe(scene2);

        popScene();
        const s3 = createElement("sprite");
        expect((s3 as any).scene).toBe(scene);
        dispose();
      });
    });

    it("throws when no scene is active", () => {
      resetSceneStack();
      expect(() => {
        createRoot((dispose) => { createElement("sprite"); dispose(); });
      }).toThrow();
    });
  });

  describe("Cleanup on dispose", () => {
    it("effects stop running after dispose", () => {
      let sprite: any;
      let setX!: (v: number) => void;
      const updateCount = vi.fn();

      const dispose = createRoot((dispose) => {
        const [x, _setX] = createSignal(0);
        setX = _setX;
        sprite = createElement("sprite");
        effect(() => {
          updateCount();
          setProp(sprite, "x", x());
        });
        return dispose;
      });

      expect(updateCount).toHaveBeenCalledOnce();
      expect(sprite.x).toBe(0);

      setX(50);
      expect(sprite.x).toBe(50);
      expect(updateCount).toHaveBeenCalledTimes(2);

      dispose();

      setX(999);
      expect(updateCount).toHaveBeenCalledTimes(2);
      expect(sprite.x).toBe(50);
    });
  });

  describe("Derived signals", () => {
    it("derived computations update properties correctly", () => {
      let sprite: any;
      let textObj: any;
      let setLevel!: (v: number) => void;

      const dispose = createRoot((dispose) => {
        const [level, _setLevel] = createSignal(1);
        setLevel = _setLevel;
        const scale = () => 1 + level() * 0.2;
        const label = () => `Lv.${level()}`;

        sprite = createElement("sprite");
        textObj = createElement("text");

        effect(() => setProp(sprite, "scale", scale()));
        effect(() => setProp(textObj, "text", label()));

        insert(root, sprite);
        insert(root, textObj);
        return dispose;
      });

      expect(sprite.scaleX).toBeCloseTo(1.2);
      expect(textObj.text).toBe("Lv.1");

      setLevel(5);
      expect(sprite.scaleX).toBeCloseTo(2.0);
      expect(sprite.scaleY).toBeCloseTo(2.0);
      expect(textObj.text).toBe("Lv.5");

      dispose();
    });
  });

  describe("Multiple insertions and ordering", () => {
    it("maintains child order", () => {
      createRoot((dispose) => {
        const c1 = createElement("sprite");
        const c2 = createElement("text");
        const c3 = createElement("rectangle");

        insert(root, c1);
        insert(root, c2);
        insert(root, c3);

        const meta = getMeta(root);
        expect(meta.children.length).toBe(3);
        expect(meta.children[0]).toBe(c1);
        expect(meta.children[1]).toBe(c2);
        expect(meta.children[2]).toBe(c3);
        dispose();
      });
    });
  });
});
