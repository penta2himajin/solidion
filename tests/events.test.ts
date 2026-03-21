import { describe, it, expect } from "vitest";
import { isEventProp, resolveEventName, getKnownEventProps } from "../src/core/events";

describe("Event System", () => {
  describe("isEventProp", () => {
    it("recognizes on* props with uppercase third char", () => {
      expect(isEventProp("onClick")).toBe(true);
      expect(isEventProp("onPointerDown")).toBe(true);
      expect(isEventProp("onDrag")).toBe(true);
      expect(isEventProp("onDestroy")).toBe(true);
    });

    it("rejects non-event props", () => {
      expect(isEventProp("origin")).toBe(false);
      expect(isEventProp("x")).toBe(false);
      expect(isEventProp("texture")).toBe(false);
    });

    it("rejects 'on' alone and short strings", () => {
      expect(isEventProp("on")).toBe(false);
      expect(isEventProp("")).toBe(false);
    });
  });

  describe("resolveEventName", () => {
    it("resolves L0 alias onClick to pointerdown", () => {
      expect(resolveEventName("onClick")).toBe("pointerdown");
    });

    it("resolves L1 precise names", () => {
      expect(resolveEventName("onPointerDown")).toBe("pointerdown");
      expect(resolveEventName("onPointerUp")).toBe("pointerup");
      expect(resolveEventName("onPointerOver")).toBe("pointerover");
      expect(resolveEventName("onPointerOut")).toBe("pointerout");
      expect(resolveEventName("onPointerMove")).toBe("pointermove");
    });

    it("resolves drag events", () => {
      expect(resolveEventName("onDragStart")).toBe("dragstart");
      expect(resolveEventName("onDrag")).toBe("drag");
      expect(resolveEventName("onDragEnd")).toBe("dragend");
    });

    it("resolves Phaser-specific events", () => {
      expect(resolveEventName("onAnimationComplete")).toBe("animationcomplete");
      expect(resolveEventName("onDestroy")).toBe("destroy");
    });

    it("returns undefined for unknown event props", () => {
      expect(resolveEventName("onFoo")).toBeUndefined();
      expect(resolveEventName("onCustomEvent")).toBeUndefined();
    });
  });

  describe("getKnownEventProps", () => {
    it("returns all known event prop names", () => {
      const props = getKnownEventProps();
      expect(props).toContain("onClick");
      expect(props).toContain("onPointerDown");
      expect(props).toContain("onDrag");
      expect(props.length).toBeGreaterThan(5);
    });
  });
});
