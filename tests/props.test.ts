import { describe, it, expect } from "vitest";
import { composeProp, applyProp, setPhaserProp } from "../src/core/props";
import { addDelta, getMeta } from "../src/core/meta";
import { MockSprite, MockText, MockRectangle, MockContainer } from "./mocks";

describe("Property Composition", () => {
  describe("composeProp", () => {
    it("adds delta for additive properties (x, y, angle)", () => {
      expect(composeProp("x", 100, 10)).toBe(110);
      expect(composeProp("y", 200, -30)).toBe(170);
      expect(composeProp("angle", 45, 15)).toBe(60);
    });

    it("multiplies delta for multiplicative properties (scale, alpha)", () => {
      expect(composeProp("scale", 1, 0.5)).toBe(1.5);   // 1 * (1 + 0.5)
      expect(composeProp("alpha", 0.8, -0.5)).toBe(0.4); // 0.8 * (1 + -0.5)
    });

    it("returns base for override properties when delta is 0", () => {
      expect(composeProp("tint", 0xff0000, 0)).toBe(0xff0000);
      expect(composeProp("visible", true, 0)).toBe(true);
    });

    it("returns base when delta is 0 (no change)", () => {
      expect(composeProp("x", 100, 0)).toBe(100);
      expect(composeProp("scale", 1, 0)).toBe(1);
    });
  });
});

describe("Property Application", () => {
  describe("setPhaserProp", () => {
    it("sets x and y directly", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "x", 150);
      setPhaserProp(sprite as any, "y", 250);
      expect(sprite.x).toBe(150);
      expect(sprite.y).toBe(250);
    });

    it("sets scale via setScale", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "scale", 2);
      expect(sprite.scaleX).toBe(2);
      expect(sprite.scaleY).toBe(2);
    });

    it("sets alpha and visible", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "alpha", 0.5);
      setPhaserProp(sprite as any, "visible", false);
      expect(sprite.alpha).toBe(0.5);
      expect(sprite.visible).toBe(false);
    });

    it("sets text properties", () => {
      const text = new MockText();
      setPhaserProp(text as any, "text", "Hello");
      setPhaserProp(text as any, "fontSize", 24);
      setPhaserProp(text as any, "color", "#ff0000");
      expect(text.text).toBe("Hello");
      expect(text.style.fontSize).toBe(24);
      expect(text.style.color).toBe("#ff0000");
    });

    it("sets rectangle fill", () => {
      const rect = new MockRectangle();
      setPhaserProp(rect as any, "fillColor", 0xff0000);
      expect(rect.fillColor).toBe(0xff0000);
    });

    it("sets origin", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "origin", 0.5);
      expect(sprite.originX).toBe(0.5);
      expect(sprite.originY).toBe(0.5);
    });

    it("sets depth", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "depth", 10);
      expect(sprite.depth).toBe(10);
    });
  });

  describe("applyProp with deltas", () => {
    it("stores base value and applies with zero delta", () => {
      const sprite = new MockSprite();
      applyProp(sprite as any, "x", 100);
      expect(sprite.x).toBe(100);

      const meta = getMeta(sprite);
      expect(meta.baseValues.get("x")).toBe(100);
    });

    it("composes base value with existing deltas", () => {
      const sprite = new MockSprite();
      // Pre-set a behavior delta
      addDelta(sprite, "spring-1", { x: 25 });

      // Apply base prop - should compose with delta
      applyProp(sprite as any, "x", 100);
      expect(sprite.x).toBe(125); // 100 + 25
    });

    it("composes multiplicative properties correctly", () => {
      const sprite = new MockSprite();
      addDelta(sprite, "jiggle", { scale: 0.2 });

      applyProp(sprite as any, "scale", 1);
      // scale: 1 * (1 + 0.2) = 1.2
      expect(sprite.scaleX).toBe(1.2);
      expect(sprite.scaleY).toBe(1.2);
    });
  });
});
