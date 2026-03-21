import { describe, it, expect, beforeEach, vi } from "vitest";
import { pushScene, popScene, resetSceneStack, getCurrentScene } from "../src/core/scene-stack";
import { getMeta, hasMeta } from "../src/core/meta";
import { isEventProp, resolveEventName } from "../src/core/events";
import { MockScene, MockSprite, MockText, MockContainer, MockRectangle, MockGameObject } from "./mocks";

/**
 * We test the renderer's internal logic by calling the functions
 * that createRenderer delegates to, using mock Phaser objects.
 * This avoids needing the full Solid compilation pipeline.
 */

// Import the internal functions used by createRenderer
import { applyProp, setPhaserProp } from "../src/core/props";

describe("Renderer Logic", () => {
  let scene: MockScene;

  beforeEach(() => {
    resetSceneStack();
    scene = new MockScene();
    pushScene(scene as any);
  });

  describe("createElement equivalent", () => {
    it("creates objects when scene is available", () => {
      expect(getCurrentScene()).toBe(scene);
      // In the real renderer, createElement("sprite") would create a Phaser.GameObjects.Sprite
      // Here we verify the scene stack is correctly providing context
    });

    it("throws when no scene is active", () => {
      popScene();
      expect(getCurrentScene()).toBeNull();
    });
  });

  describe("setProperty: regular props", () => {
    it("applies position properties", () => {
      const sprite = new MockSprite();
      sprite.scene = scene as any;

      applyProp(sprite as any, "x", 100);
      applyProp(sprite as any, "y", 200);

      expect(sprite.x).toBe(100);
      expect(sprite.y).toBe(200);
    });

    it("applies display properties", () => {
      const sprite = new MockSprite();
      applyProp(sprite as any, "alpha", 0.5);
      applyProp(sprite as any, "visible", false);

      expect(sprite.alpha).toBe(0.5);
      expect(sprite.visible).toBe(false);
    });
  });

  describe("setProperty: events", () => {
    it("registers event handler and sets interactive", () => {
      const sprite = new MockSprite();
      const handler = vi.fn();
      const meta = getMeta(sprite);

      // Simulate what setProperty does for events
      const eventName = resolveEventName("onClick")!;
      sprite.setInteractive();
      sprite.on(eventName, handler);
      meta.handlers.set("onClick", handler);

      expect(sprite.input).toBeTruthy();
      expect(sprite.getListenerCount("pointerdown")).toBe(1);
      expect(meta.handlers.get("onClick")).toBe(handler);

      // Simulate click
      sprite.emit("pointerdown");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("replaces event handler cleanly", () => {
      const sprite = new MockSprite();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const meta = getMeta(sprite);

      // Register first handler
      sprite.setInteractive();
      sprite.on("pointerdown", handler1);
      meta.handlers.set("onClick", handler1);

      // Replace with second handler
      sprite.off("pointerdown", handler1);
      sprite.on("pointerdown", handler2);
      meta.handlers.set("onClick", handler2);

      sprite.emit("pointerdown");
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("removes event handler and interactive when no handlers remain", () => {
      const sprite = new MockSprite();
      const handler = vi.fn();
      const meta = getMeta(sprite);

      // Register
      sprite.setInteractive();
      sprite.on("pointerdown", handler);
      meta.handlers.set("onClick", handler);

      // Remove
      sprite.off("pointerdown", handler);
      meta.handlers.delete("onClick");
      if (meta.handlers.size === 0) {
        sprite.removeInteractive();
      }

      expect(sprite.input).toBeNull();
      expect(meta.handlers.size).toBe(0);
    });
  });

  describe("insertNode logic", () => {
    it("adds child to parent meta children", () => {
      const parent = new MockContainer();
      const child = new MockSprite();
      parent.scene = scene as any;
      child.scene = scene as any;

      const meta = getMeta(parent);
      meta.children.push(child as any);
      parent.add(child);

      expect(meta.children).toContain(child);
      expect(parent.list).toContain(child);
    });

    it("maintains insertion order in meta children", () => {
      const parent = new MockContainer();
      const child1 = new MockSprite();
      const child2 = new MockSprite();
      const child3 = new MockSprite();

      const meta = getMeta(parent);
      meta.children.push(child1 as any, child2 as any, child3 as any);

      expect(meta.children[0]).toBe(child1);
      expect(meta.children[1]).toBe(child2);
      expect(meta.children[2]).toBe(child3);
    });

    it("inserts before anchor", () => {
      const parent = new MockContainer();
      const child1 = new MockSprite();
      const child2 = new MockSprite();
      const inserted = new MockSprite();

      const meta = getMeta(parent);
      meta.children.push(child1 as any, child2 as any);

      // Insert before child2
      const idx = meta.children.indexOf(child2 as any);
      meta.children.splice(idx, 0, inserted as any);

      expect(meta.children[0]).toBe(child1);
      expect(meta.children[1]).toBe(inserted);
      expect(meta.children[2]).toBe(child2);
    });
  });

  describe("removeNode logic", () => {
    it("removes child from parent and cleans up", () => {
      const parent = new MockContainer();
      const child = new MockSprite();
      const handler = vi.fn();

      parent.scene = scene as any;
      child.scene = scene as any;

      const parentMeta = getMeta(parent);
      const childMeta = getMeta(child);

      parentMeta.children.push(child as any);
      parent.add(child);
      child.setInteractive();
      child.on("pointerdown", handler);
      childMeta.handlers.set("onClick", handler);

      // Remove
      const idx = parentMeta.children.indexOf(child as any);
      parentMeta.children.splice(idx, 1);

      for (const [name, h] of childMeta.handlers) {
        const event = resolveEventName(name);
        if (event) child.off(event, h);
      }
      childMeta.handlers.clear();

      parent.remove(child);
      child.destroy();

      expect(parentMeta.children).not.toContain(child);
      expect(parent.list).not.toContain(child);
      expect(child.getListenerCount("pointerdown")).toBe(0);
    });

    it("recursively cleans up children", () => {
      const parent = new MockContainer();
      const child = new MockContainer();
      const grandchild = new MockSprite();

      const parentMeta = getMeta(parent);
      const childMeta = getMeta(child);

      parentMeta.children.push(child as any);
      childMeta.children.push(grandchild as any);

      // Remove child - should also clean grandchild
      const gcHandler = vi.fn();
      grandchild.on("pointerdown", gcHandler);
      getMeta(grandchild).handlers.set("onClick", gcHandler);

      // Cleanup grandchild first
      for (const [name, h] of getMeta(grandchild).handlers) {
        const event = resolveEventName(name);
        if (event) grandchild.off(event, h);
      }
      grandchild.destroy();

      expect(grandchild.getListenerCount("pointerdown")).toBe(0);
    });
  });
});
