import { describe, it, expect, beforeEach } from "vitest";
import {
  enable,
  disable,
  isEnabled,
  recordBinding,
  inspectBindings,
  recordSetProperty,
  frameStart,
  frameEnd,
  getFrameProfile,
} from "../src/debug";

describe("Debug Utilities", () => {
  beforeEach(() => {
    disable();
  });

  describe("enable/disable/isEnabled", () => {
    it("is disabled by default", () => {
      expect(isEnabled()).toBe(false);
    });

    it("can be enabled", () => {
      enable();
      expect(isEnabled()).toBe(true);
    });

    it("can be disabled after enabling", () => {
      enable();
      disable();
      expect(isEnabled()).toBe(false);
    });
  });

  describe("recordBinding / inspectBindings", () => {
    it("returns empty object when no bindings recorded", () => {
      const node = {};
      expect(inspectBindings(node)).toEqual({});
    });

    it("does not record bindings when disabled", () => {
      const node = {};
      recordBinding(node, "x", true);
      expect(inspectBindings(node)).toEqual({});
    });

    it("records reactive bindings when enabled", () => {
      enable();
      const node = {};
      recordBinding(node, "x", true);
      recordBinding(node, "y", true);
      expect(inspectBindings(node)).toEqual({
        x: "reactive",
        y: "reactive",
      });
    });

    it("records static bindings when enabled", () => {
      enable();
      const node = {};
      recordBinding(node, "alpha", false);
      expect(inspectBindings(node)).toEqual({
        alpha: "static",
      });
    });

    it("records mix of reactive and static bindings", () => {
      enable();
      const node = {};
      recordBinding(node, "x", true);
      recordBinding(node, "texture", false);
      expect(inspectBindings(node)).toEqual({
        x: "reactive",
        texture: "static",
      });
    });

    it("overwrites binding type on re-record", () => {
      enable();
      const node = {};
      recordBinding(node, "x", false);
      expect(inspectBindings(node).x).toBe("static");
      recordBinding(node, "x", true);
      expect(inspectBindings(node).x).toBe("reactive");
    });
  });

  describe("Frame profiler", () => {
    it("recordSetProperty does nothing when disabled", () => {
      recordSetProperty();
      // getFrameProfile should still return default
      expect(getFrameProfile().setPropertyCalls).toBe(0);
    });

    it("frameStart/frameEnd do nothing when disabled", () => {
      frameStart();
      frameEnd();
      expect(getFrameProfile().setPropertyCalls).toBe(0);
    });

    it("tracks setProperty calls within a frame when enabled", () => {
      enable();
      frameStart();
      recordSetProperty();
      recordSetProperty();
      recordSetProperty();
      frameEnd();

      const profile = getFrameProfile();
      expect(profile.setPropertyCalls).toBe(3);
      expect(profile.frameTimeMs).toBeGreaterThanOrEqual(0);
    });

    it("resets counters on new frame", () => {
      enable();
      frameStart();
      recordSetProperty();
      recordSetProperty();
      frameEnd();

      frameStart();
      recordSetProperty();
      frameEnd();

      const profile = getFrameProfile();
      expect(profile.setPropertyCalls).toBe(1);
    });

    it("getFrameProfile returns last completed frame", () => {
      enable();
      frameStart();
      recordSetProperty();
      frameEnd();

      // Start a new frame but don't end it
      frameStart();
      recordSetProperty();
      recordSetProperty();
      recordSetProperty();

      // Should still return the previous completed frame
      const profile = getFrameProfile();
      expect(profile.setPropertyCalls).toBe(1);
    });
  });
});
