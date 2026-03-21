import { describe, it, expect } from "vitest";
import { getMeta, hasMeta, deleteMeta, addDelta, removeDelta, createMeta } from "../src/core/meta";

describe("SolidionMeta", () => {
  describe("getMeta", () => {
    it("creates meta on first access", () => {
      const obj: any = {};
      const meta = getMeta(obj);
      expect(meta).toBeDefined();
      expect(meta.children).toEqual([]);
      expect(meta.handlers).toBeInstanceOf(Map);
      expect(meta.baseValues).toBeInstanceOf(Map);
      expect(meta.behaviorDeltas).toBeInstanceOf(Map);
      expect(meta.totalDelta).toEqual({});
    });

    it("returns same meta on subsequent access", () => {
      const obj: any = {};
      const meta1 = getMeta(obj);
      const meta2 = getMeta(obj);
      expect(meta1).toBe(meta2);
    });
  });

  describe("hasMeta", () => {
    it("returns false for objects without meta", () => {
      expect(hasMeta({})).toBe(false);
    });

    it("returns true after getMeta", () => {
      const obj: any = {};
      getMeta(obj);
      expect(hasMeta(obj)).toBe(true);
    });
  });

  describe("deleteMeta", () => {
    it("removes meta from object", () => {
      const obj: any = {};
      getMeta(obj);
      expect(hasMeta(obj)).toBe(true);
      deleteMeta(obj);
      expect(hasMeta(obj)).toBe(false);
    });
  });

  describe("delta system", () => {
    it("adds a single behavior delta", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10, y: 20 });
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({ x: 10, y: 20 });
    });

    it("aggregates multiple behavior deltas by addition", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10, y: 5 });
      addDelta(obj, "oscillate-1", { x: 3, y: -2 });
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({ x: 13, y: 3 });
    });

    it("updates existing behavior delta", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10 });
      addDelta(obj, "spring-1", { x: 20 });
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({ x: 20 });
    });

    it("removes a behavior delta and recomputes", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10, y: 5 });
      addDelta(obj, "oscillate-1", { x: 3 });
      removeDelta(obj, "spring-1");
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({ x: 3 });
    });

    it("handles removing non-existent behavior gracefully", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10 });
      removeDelta(obj, "nonexistent");
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({ x: 10 });
    });

    it("results in empty delta after removing all behaviors", () => {
      const obj: any = {};
      addDelta(obj, "spring-1", { x: 10 });
      removeDelta(obj, "spring-1");
      const meta = getMeta(obj);
      expect(meta.totalDelta).toEqual({});
    });
  });
});
