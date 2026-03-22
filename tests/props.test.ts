import { describe, it, expect } from "vitest";
import { composeProp, applyProp, reapplyProp, setPhaserProp } from "../src/core/props";
import { addDelta, getMeta } from "../src/core/meta";
import { MockSprite, MockText, MockRectangle, MockContainer, MockGameObject } from "./mocks";

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

    it("returns base when delta is undefined", () => {
      expect(composeProp("x", 100, undefined as any)).toBe(100);
    });

    it("returns base for override properties even with non-zero delta", () => {
      expect(composeProp("tint", 0xff0000, 5)).toBe(0xff0000);
      expect(composeProp("visible", true, 1)).toBe(true);
      expect(composeProp("texture", "foo", 1)).toBe("foo");
      expect(composeProp("depth", 3, 1)).toBe(3);
    });

    it("defaults base to 0 for additive when base is nullish", () => {
      expect(composeProp("x", undefined, 10)).toBe(10);
      expect(composeProp("x", null, 10)).toBe(10);
    });

    it("defaults base to 1 for multiplicative when base is nullish", () => {
      expect(composeProp("scale", undefined, 0.5)).toBe(1.5);
      expect(composeProp("alpha", null, 0.5)).toBe(1.5);
    });

    it("handles rotation as additive", () => {
      expect(composeProp("rotation", 1.0, 0.5)).toBe(1.5);
    });

    it("handles scaleX and scaleY as multiplicative", () => {
      expect(composeProp("scaleX", 2, 0.5)).toBe(3.0); // 2 * (1 + 0.5)
      expect(composeProp("scaleY", 2, -0.5)).toBe(1.0); // 2 * (1 + -0.5)
    });

    it("treats unknown properties as override", () => {
      expect(composeProp("customProp", "hello", 5)).toBe("hello");
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

    it("sets originX and originY individually", () => {
      const sprite = new MockSprite();
      sprite.originX = 0.5;
      sprite.originY = 0.5;
      setPhaserProp(sprite as any, "originX", 0.0);
      expect(sprite.originX).toBe(0.0);
      expect(sprite.originY).toBe(0.5);

      setPhaserProp(sprite as any, "originY", 1.0);
      expect(sprite.originX).toBe(0.0);
      expect(sprite.originY).toBe(1.0);
    });

    it("sets width/height via setSize when available", () => {
      const rect = new MockRectangle();
      rect.width = 10;
      rect.height = 20;
      setPhaserProp(rect as any, "width", 100);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(20);

      setPhaserProp(rect as any, "height", 200);
      expect(rect.width).toBe(100);
      expect(rect.height).toBe(200);
    });

    it("sets width/height via direct assignment when no setSize", () => {
      const obj = new MockGameObject();
      obj.width = 10;
      obj.height = 20;
      setPhaserProp(obj as any, "width", 100);
      expect(obj.width).toBe(100);
      setPhaserProp(obj as any, "height", 200);
      expect(obj.height).toBe(200);
    });

    it("sets fillColor and fillAlpha", () => {
      const rect = new MockRectangle();
      rect.fillColor = 0x000000;
      rect.fillAlpha = 1;
      setPhaserProp(rect as any, "fillColor", 0xff0000);
      expect(rect.fillColor).toBe(0xff0000);
      expect(rect.fillAlpha).toBe(1);

      setPhaserProp(rect as any, "fillAlpha", 0.5);
      expect(rect.fillAlpha).toBe(0.5);
    });

    it("sets strokeColor and lineWidth", () => {
      const rect = new MockRectangle();
      setPhaserProp(rect as any, "strokeColor", 0x00ff00);
      expect(rect.strokeColor).toBe(0x00ff00);

      setPhaserProp(rect as any, "lineWidth", 3);
      expect(rect.lineWidth).toBe(3);
    });

    it("sets wordWrap", () => {
      const text = new MockText();
      setPhaserProp(text as any, "wordWrap", { width: 200, useAdvancedWrap: false });
      expect(text.style.wordWrapWidth).toBe(200);
    });

    it("wordWrap does nothing for falsy value", () => {
      const text = new MockText();
      setPhaserProp(text as any, "wordWrap", null);
      expect(text.style.wordWrapWidth).toBeUndefined();
    });

    it("sets animation via play", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "animation", "walk");
      // play is called — MockSprite has play() which is a no-op
    });

    it("animation does nothing for falsy value", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "animation", null);
      // Should not throw
    });

    it("sets interactive true/false/object", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "interactive", true);
      expect(sprite.input).toEqual({ enabled: true });

      setPhaserProp(sprite as any, "interactive", false);
      expect(sprite.input).toBeNull();

      setPhaserProp(sprite as any, "interactive", { draggable: true });
      expect(sprite.input).toEqual({ enabled: true });
    });

    it("interactive false does nothing when input is already null", () => {
      const sprite = new MockSprite();
      sprite.input = null;
      setPhaserProp(sprite as any, "interactive", false);
      expect(sprite.input).toBeNull();
    });

    it("texture prop is a no-op (handled by texture system)", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "texture", "foo.png");
      // Should not throw, texture key unchanged
    });

    it("ref and children are no-ops", () => {
      const sprite = new MockSprite();
      setPhaserProp(sprite as any, "ref", () => {});
      setPhaserProp(sprite as any, "children", []);
      // Should not throw
    });

    it("uses setter method when available (dynamic resolution)", () => {
      const text = new MockText();
      setPhaserProp(text as any, "text", "hello");
      expect(text.text).toBe("hello");
      // setText is the setter used
    });

    it("falls back to direct assignment when no setter exists", () => {
      const obj = new MockGameObject();
      (obj as any).customField = "old";
      setPhaserProp(obj as any, "customField", "new");
      expect((obj as any).customField).toBe("new");
    });

    it("does nothing for unknown property not on object", () => {
      const obj = new MockGameObject();
      setPhaserProp(obj as any, "nonExistentProp", 42);
      expect((obj as any).nonExistentProp).toBeUndefined();
    });

    // ---- Cover ?. null branches for PROP_OVERRIDES (lines 99-100, 107-110) ----

    it("originX/originY do nothing on object without setOrigin", () => {
      const obj = { originX: 0.5, originY: 0.5 } as any;
      setPhaserProp(obj, "originX", 0.0);
      expect(obj.originX).toBe(0.5);

      setPhaserProp(obj, "originY", 1.0);
      expect(obj.originY).toBe(0.5);
    });

    it("originX/originY uses ?? default when originY/originX is undefined", () => {
      // Object WITH setOrigin but WITHOUT originY/originX properties
      const obj1 = {
        setOrigin(x: number, y: number) { this._ox = x; this._oy = y; },
        _ox: 0, _oy: 0,
        // originY is undefined — triggers ?? 0.5 fallback
      } as any;
      setPhaserProp(obj1, "originX", 0.3);
      expect(obj1._ox).toBe(0.3);
      expect(obj1._oy).toBe(0.5); // fallback

      const obj2 = {
        setOrigin(x: number, y: number) { this._ox = x; this._oy = y; },
        _ox: 0, _oy: 0,
        // originX is undefined — triggers ?? 0.5 fallback
      } as any;
      setPhaserProp(obj2, "originY", 0.7);
      expect(obj2._ox).toBe(0.5); // fallback
      expect(obj2._oy).toBe(0.7);
    });

    it("fillColor/fillAlpha do nothing on object without setFillStyle", () => {
      const obj = { fillColor: 0x000000, fillAlpha: 1 } as any;
      setPhaserProp(obj, "fillColor", 0xff0000);
      expect(obj.fillColor).toBe(0x000000);

      setPhaserProp(obj, "fillAlpha", 0.5);
      expect(obj.fillAlpha).toBe(1);
    });

    it("fillColor/fillAlpha uses ?? default when fillAlpha/fillColor is undefined", () => {
      const obj1 = {
        setFillStyle(color: number, alpha: number) { this._fc = color; this._fa = alpha; },
        _fc: 0, _fa: 0,
        // fillAlpha is undefined — triggers ?? 1 fallback
      } as any;
      setPhaserProp(obj1, "fillColor", 0xff0000);
      expect(obj1._fc).toBe(0xff0000);
      expect(obj1._fa).toBe(1); // fallback

      const obj2 = {
        setFillStyle(color: number, alpha: number) { this._fc = color; this._fa = alpha; },
        _fc: 0, _fa: 0,
        fillColor: 0xaabbcc,
        // fillColor exists, fillAlpha prop tested via fillAlpha override
      } as any;
      setPhaserProp(obj2, "fillAlpha", 0.5);
      expect(obj2._fc).toBe(0xaabbcc);
      expect(obj2._fa).toBe(0.5);
    });

    it("strokeColor/lineWidth do nothing on object without setStrokeStyle", () => {
      const obj = { strokeColor: 0, lineWidth: 1, strokeAlpha: 1 } as any;
      setPhaserProp(obj, "strokeColor", 0x00ff00);
      expect(obj.strokeColor).toBe(0);

      setPhaserProp(obj, "lineWidth", 5);
      expect(obj.lineWidth).toBe(1);
    });

    it("strokeColor/lineWidth uses ?? defaults when properties are undefined", () => {
      const obj1 = {
        setStrokeStyle(w: number, c: number, a: number) { this._lw = w; this._sc = c; this._sa = a; },
        _lw: 0, _sc: 0, _sa: 0,
        // lineWidth and strokeAlpha undefined — triggers ?? 1 fallbacks
      } as any;
      setPhaserProp(obj1, "strokeColor", 0x00ff00);
      expect(obj1._lw).toBe(1); // lineWidth ?? 1
      expect(obj1._sc).toBe(0x00ff00);
      expect(obj1._sa).toBe(1); // strokeAlpha ?? 1

      const obj2 = {
        setStrokeStyle(w: number, c: number, a: number) { this._lw = w; this._sc = c; this._sa = a; },
        _lw: 0, _sc: 0, _sa: 0,
        // strokeColor and strokeAlpha undefined
      } as any;
      setPhaserProp(obj2, "lineWidth", 3);
      expect(obj2._lw).toBe(3);
      expect(obj2._sa).toBe(1); // strokeAlpha ?? 1
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

  describe("reapplyProp", () => {
    it("re-applies a stored base value with current deltas", () => {
      const sprite = new MockSprite();
      applyProp(sprite as any, "x", 100);
      expect(sprite.x).toBe(100);

      // Add a delta after initial apply
      addDelta(sprite, "behavior-1", { x: 50 });
      reapplyProp(sprite as any, "x");
      expect(sprite.x).toBe(150); // 100 + 50
    });

    it("does nothing if base value was never set", () => {
      const sprite = new MockSprite();
      sprite.x = 999;
      reapplyProp(sprite as any, "x");
      // x should remain unchanged since no base was stored
      expect(sprite.x).toBe(999);
    });

    it("re-applies with zero delta when no deltas exist", () => {
      const sprite = new MockSprite();
      applyProp(sprite as any, "x", 200);
      reapplyProp(sprite as any, "x");
      expect(sprite.x).toBe(200);
    });
  });
});
