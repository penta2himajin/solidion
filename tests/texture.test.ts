import { describe, it, expect } from "vitest";
import { parseTextureRef, urlToKey, ensureTexture } from "../src/core/texture";
import { MockScene } from "./mocks";

describe("Texture System", () => {
  describe("parseTextureRef", () => {
    it("parses single image URL", () => {
      const result = parseTextureRef("/assets/bg.png");
      expect(result.type).toBe("image");
      expect(result.key).toBe("/assets/bg.png");
      expect(result.frame).toBeUndefined();
    });

    it("parses atlas reference with colon notation", () => {
      const result = parseTextureRef("characters:idle-0");
      expect(result.type).toBe("atlas");
      expect(result.key).toBe("characters");
      expect(result.frame).toBe("idle-0");
    });

    it("handles atlas key with path-like names", () => {
      const result = parseTextureRef("ui-sprites:button-normal");
      expect(result.type).toBe("atlas");
      expect(result.key).toBe("ui-sprites");
      expect(result.frame).toBe("button-normal");
    });

    it("treats URL without colon as single image", () => {
      const result = parseTextureRef("simple-texture");
      expect(result.type).toBe("image");
      expect(result.key).toBe("simple-texture");
    });
  });

  describe("urlToKey", () => {
    it("returns URL as-is for cache key", () => {
      expect(urlToKey("/assets/bg.png")).toBe("/assets/bg.png");
      expect(urlToKey("https://example.com/sprite.png")).toBe("https://example.com/sprite.png");
    });
  });

  describe("ensureTexture", () => {
    it("returns ready:true for cached textures", () => {
      const scene = new MockScene();
      scene.textures.addKey("existing-texture");

      const result = ensureTexture(scene as any, "existing-texture", "/some/url.png");
      expect(result.ready).toBe(true);
      expect(result.promise).toBeUndefined();
    });

    it("returns ready:false with promise for uncached textures", () => {
      const scene = new MockScene();

      const result = ensureTexture(scene as any, "new-texture", "/assets/new.png");
      expect(result.ready).toBe(false);
      expect(result.promise).toBeInstanceOf(Promise);
    });

    it("deduplicates concurrent loads for same key", () => {
      const scene = new MockScene();

      const result1 = ensureTexture(scene as any, "shared", "/assets/shared.png");
      const result2 = ensureTexture(scene as any, "shared", "/assets/shared.png");

      expect(result1.promise).toBe(result2.promise);
    });

    it("resolves promise when load completes", async () => {
      const scene = new MockScene();
      const result = ensureTexture(scene as any, "loading", "/assets/loading.png");

      expect(result.ready).toBe(false);

      // Simulate load completion
      scene.load.fireComplete("image", "loading");

      await expect(result.promise).resolves.toBeUndefined();
    });
  });
});
