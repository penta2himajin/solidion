import { describe, it, expect, vi } from "vitest";
import { setVisibleRecursive } from "../src/core/visibility";
import { getMeta } from "../src/core/meta";
import { MockGameObject } from "./mocks";

describe("setVisibleRecursive", () => {
  it("handles null/undefined gracefully", () => {
    // Should not throw
    setVisibleRecursive(null, true);
    setVisibleRecursive(undefined, false);
  });

  it("sets visible on a single GameObject", () => {
    const obj = new MockGameObject();
    expect(obj.visible).toBe(true);

    setVisibleRecursive(obj, false);
    expect(obj.visible).toBe(false);

    setVisibleRecursive(obj, true);
    expect(obj.visible).toBe(true);
  });

  it("toggles input.enabled when setting visible on interactive object", () => {
    const obj = new MockGameObject();
    obj.setInteractive();
    expect(obj.input.enabled).toBe(true);

    setVisibleRecursive(obj, false);
    expect(obj.visible).toBe(false);
    expect(obj.input.enabled).toBe(false);

    setVisibleRecursive(obj, true);
    expect(obj.visible).toBe(true);
    expect(obj.input.enabled).toBe(true);
  });

  it("handles visible toggle on non-interactive object (no input)", () => {
    const obj = new MockGameObject();
    expect(obj.input).toBeNull();
    setVisibleRecursive(obj, false);
    expect(obj.visible).toBe(false);
    // No error
  });

  it("sets visible on an array of GameObjects", () => {
    const a = new MockGameObject();
    const b = new MockGameObject();
    const c = new MockGameObject();

    setVisibleRecursive([a, b, c], false);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
    expect(c.visible).toBe(false);

    setVisibleRecursive([a, b, c], true);
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(true);
    expect(c.visible).toBe(true);
  });

  it("handles nested arrays", () => {
    const a = new MockGameObject();
    const b = new MockGameObject();

    setVisibleRecursive([[a], [b]], false);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
  });

  it("unwraps accessor functions", () => {
    const obj = new MockGameObject();
    const accessor = () => obj;

    setVisibleRecursive(accessor, false);
    expect(obj.visible).toBe(false);
  });

  it("unwraps nested accessor functions", () => {
    const obj = new MockGameObject();
    const nested = () => () => obj;

    setVisibleRecursive(nested, false);
    expect(obj.visible).toBe(false);
  });

  it("stops unwrapping at MAX_ACCESSOR_DEPTH (10)", () => {
    // Build a chain of 11 nested functions — should NOT reach the inner object
    const obj = new MockGameObject();
    let fn: any = obj;
    for (let i = 0; i < 11; i++) {
      const current = fn;
      fn = () => current;
    }

    setVisibleRecursive(fn, false);
    // depth guard should prevent reaching the object
    expect(obj.visible).toBe(true);
  });

  it("recurses into meta.children when hasMeta is true", () => {
    const parent = new MockGameObject();
    const child1 = new MockGameObject();
    const child2 = new MockGameObject();

    // Set up meta with children
    const meta = getMeta(parent);
    meta.children.push(child1 as any, child2 as any);

    setVisibleRecursive(parent, false);
    expect(parent.visible).toBe(false);
    expect(child1.visible).toBe(false);
    expect(child2.visible).toBe(false);

    setVisibleRecursive(parent, true);
    expect(parent.visible).toBe(true);
    expect(child1.visible).toBe(true);
    expect(child2.visible).toBe(true);
  });

  it("does not recurse into children when node has no meta", () => {
    // A plain object with setVisible but no meta — should only set on itself
    const obj = new MockGameObject();
    // No getMeta call, so hasMeta returns false
    // Just verify it doesn't throw
    setVisibleRecursive(obj, false);
    expect(obj.visible).toBe(false);
  });

  it("ignores objects without setVisible", () => {
    // A plain object without setVisible — should be a no-op
    const plain = { x: 1, y: 2 };
    setVisibleRecursive(plain, false);
    // No throw, no change
    expect(plain).toEqual({ x: 1, y: 2 });
  });

  it("handles mixed arrays with null, accessors, and GameObjects", () => {
    const a = new MockGameObject();
    const b = new MockGameObject();
    const accessor = () => b;

    setVisibleRecursive([null, a, accessor, undefined], false);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
  });

  it("handles accessor returning array", () => {
    const a = new MockGameObject();
    const b = new MockGameObject();
    const accessor = () => [a, b];

    setVisibleRecursive(accessor, false);
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(false);
  });

  it("handles accessor returning null", () => {
    const accessor = () => null;
    // Should not throw
    setVisibleRecursive(accessor, false);
  });

  it("depth parameter is passed correctly for nested meta children", () => {
    const grandchild = new MockGameObject();
    const child = new MockGameObject();
    const parent = new MockGameObject();

    const childMeta = getMeta(child);
    childMeta.children.push(grandchild as any);

    const parentMeta = getMeta(parent);
    parentMeta.children.push(child as any);

    setVisibleRecursive(parent, false);
    expect(parent.visible).toBe(false);
    expect(child.visible).toBe(false);
    expect(grandchild.visible).toBe(false);
  });
});
