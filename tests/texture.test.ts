import { describe, it, expect } from "vitest";
import { parseTextureRef, urlToKey, ensureTexture, preloadAssets, applyTexture } from "../src/core/texture";
import { MockScene, MockSprite, MockImage } from "./mocks";

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

    it("rejects promise on load error", async () => {
      const scene = new MockScene();
      const result = ensureTexture(scene as any, "broken", "/assets/broken.png");

      expect(result.ready).toBe(false);

      // Simulate load error
      const errorListener = (scene.load as any).listeners.get("loaderror");
      errorListener?.({ key: "broken" });

      await expect(result.promise).rejects.toThrow("Failed to load texture: /assets/broken.png");
    });

    it("ignores load error for different key", async () => {
      const scene = new MockScene();
      const result = ensureTexture(scene as any, "mykey", "/assets/mykey.png");

      // Fire error for a different key — should not reject our promise
      const errorListener = (scene.load as any).listeners.get("loaderror");
      errorListener?.({ key: "other-key" });

      // Our promise should still be pending, resolve it normally
      scene.load.fireComplete("image", "mykey");
      await expect(result.promise).resolves.toBeUndefined();
    });
  });

  describe("applyTexture", () => {
    it("applies atlas texture immediately", () => {
      const sprite = new MockSprite();
      sprite.scene = new MockScene() as any;
      sprite.visible = false;

      applyTexture(sprite as any, "characters:idle-0");
      expect(sprite.texture.key).toBe("characters");
      expect(sprite.frame.name).toBe("idle-0");
      expect(sprite.visible).toBe(true);
    });

    it("applies cached single image texture immediately", () => {
      const scene = new MockScene();
      scene.textures.addKey("/assets/bg.png");
      const sprite = new MockSprite();
      sprite.scene = scene as any;
      sprite.visible = false;

      applyTexture(sprite as any, "/assets/bg.png");
      expect(sprite.texture.key).toBe("/assets/bg.png");
      expect(sprite.visible).toBe(true);
    });

    it("hides sprite and loads uncached texture, shows on complete", async () => {
      const scene = new MockScene();
      const sprite = new MockSprite();
      sprite.scene = scene as any;
      sprite.visible = true;

      applyTexture(sprite as any, "/assets/new.png");
      expect(sprite.visible).toBe(false);

      // Simulate load complete
      scene.load.fireComplete("image", "/assets/new.png");

      // Wait for promise microtask
      await new Promise((r) => setTimeout(r, 0));
      expect(sprite.texture.key).toBe("/assets/new.png");
      expect(sprite.visible).toBe(true);
    });

    it("does not apply texture if node scene is gone after load", async () => {
      const scene = new MockScene();
      const sprite = new MockSprite();
      sprite.scene = scene as any;

      applyTexture(sprite as any, "/assets/destroyed.png");
      sprite.scene = null; // Destroyed before load completes

      scene.load.fireComplete("image", "/assets/destroyed.png");
      await new Promise((r) => setTimeout(r, 0));
      // Should not crash; texture key remains empty
      expect(sprite.texture.key).toBe("");
    });

    it("does not apply if texture key changed before load completes", async () => {
      const scene = new MockScene();
      const sprite = new MockSprite();
      sprite.scene = scene as any;

      applyTexture(sprite as any, "/assets/old.png");
      // Switch to a different single image, which updates __solidion_textureKey
      scene.textures.addKey("/assets/new.png");
      applyTexture(sprite as any, "/assets/new.png");
      expect(sprite.texture.key).toBe("/assets/new.png");

      // Now old load completes — should NOT overwrite
      scene.load.fireComplete("image", "/assets/old.png");
      await new Promise((r) => setTimeout(r, 0));
      expect(sprite.texture.key).toBe("/assets/new.png");
    });

    it("does nothing if node has no scene", () => {
      const sprite = new MockSprite();
      sprite.scene = null;
      applyTexture(sprite as any, "/assets/no-scene.png");
      // Should not throw
    });

    it("skips setTexture for atlas when object has no setTexture method (line 91)", () => {
      // Plain object without setTexture — triggers the false branch of typeof obj.setTexture === "function"
      const obj = { scene: new MockScene(), visible: false } as any;
      applyTexture(obj, "atlas:frame");
      // Should not throw, visible should remain false (setTexture was not called)
      expect(obj.visible).toBe(false);
    });

    it("handles load failure gracefully (catch path)", async () => {
      const scene = new MockScene();
      const sprite = new MockSprite();
      sprite.scene = scene as any;

      applyTexture(sprite as any, "/assets/fail.png");
      expect(sprite.visible).toBe(false);

      // Simulate load error for this key
      const errorListener = (scene.load as any).listeners.get("loaderror");
      errorListener?.({ key: "/assets/fail.png" });

      await new Promise((r) => setTimeout(r, 0));
      // Should remain invisible after failure
      expect(sprite.visible).toBe(false);
    });
  });

  describe("preloadAssets", () => {
    it("preloads simple image URLs", async () => {
      const scene = new MockScene();
      const promise = preloadAssets(scene as any, ["/assets/a.png", "/assets/b.png"]);

      scene.load.fireComplete("image", "/assets/a.png");
      scene.load.fireComplete("image", "/assets/b.png");

      await expect(promise).resolves.toBeUndefined();
    });

    it("skips already-cached images", async () => {
      const scene = new MockScene();
      scene.textures.addKey("/assets/cached.png");

      const promise = preloadAssets(scene as any, ["/assets/cached.png"]);
      await expect(promise).resolves.toBeUndefined();
    });

    it("preloads atlas assets", async () => {
      const scene = new MockScene();
      const promise = preloadAssets(scene as any, [
        { type: "atlas", key: "chars", image: "/chars.png", json: "/chars.json" },
      ]);

      scene.load.fireComplete("atlas", "chars");
      await expect(promise).resolves.toBeUndefined();
    });

    it("skips already-cached atlas", async () => {
      const scene = new MockScene();
      scene.textures.addKey("chars");

      const promise = preloadAssets(scene as any, [
        { type: "atlas", key: "chars", image: "/chars.png", json: "/chars.json" },
      ]);
      await expect(promise).resolves.toBeUndefined();
    });

    it("preloads spritesheet assets", async () => {
      const scene = new MockScene();
      const promise = preloadAssets(scene as any, [
        { type: "spritesheet", key: "sheet", url: "/sheet.png", frameWidth: 32, frameHeight: 32 },
      ]);

      scene.load.fireComplete("spritesheet", "sheet");
      await expect(promise).resolves.toBeUndefined();
    });

    it("skips already-cached spritesheet", async () => {
      const scene = new MockScene();
      scene.textures.addKey("sheet");

      const promise = preloadAssets(scene as any, [
        { type: "spritesheet", key: "sheet", url: "/sheet.png", frameWidth: 32, frameHeight: 32 },
      ]);
      await expect(promise).resolves.toBeUndefined();
    });

    it("resolves immediately for empty asset list", async () => {
      const scene = new MockScene();
      const promise = preloadAssets(scene as any, []);
      await expect(promise).resolves.toBeUndefined();
    });

    it("ignores unknown asset types (not string, atlas, or spritesheet)", async () => {
      const scene = new MockScene();
      const promise = preloadAssets(scene as any, [
        { type: "audio", key: "bgm", url: "/bgm.mp3" } as any,
      ]);
      // Unknown type is skipped, resolves immediately
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
