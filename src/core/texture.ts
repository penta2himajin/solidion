/**
 * Texture auto-loading system.
 * Level 0: automatic on-demand loading.
 * Level 2: explicit Preload.
 */

/** Global registry of in-flight texture loads */
const loadingTextures = new Map<string, Promise<void>>();

/**
 * Parse a texture reference string.
 * "characters:idle-0" → atlas reference
 * "/assets/bg.png" → single image
 */
export function parseTextureRef(ref: string): {
  type: "image" | "atlas";
  key: string;
  frame?: string;
} {
  if (ref.includes(":")) {
    const colonIdx = ref.indexOf(":");
    const atlasKey = ref.substring(0, colonIdx);
    const frameName = ref.substring(colonIdx + 1);
    return { type: "atlas", key: atlasKey, frame: frameName };
  }
  return { type: "image", key: ref };
}

/**
 * Convert a URL to a Phaser texture cache key.
 * For single images, the URL itself is the key.
 */
export function urlToKey(url: string): string {
  return url;
}

/**
 * Ensure a texture is loaded. Returns immediately if cached,
 * otherwise starts loading and returns a promise.
 */
export function ensureTexture(
  scene: Phaser.Scene,
  key: string,
  url: string
): { ready: boolean; promise?: Promise<void> } {
  // Already cached
  if (scene.textures.exists(key)) {
    return { ready: true };
  }

  // Already loading (another component requested this)
  if (loadingTextures.has(key)) {
    return { ready: false, promise: loadingTextures.get(key)! };
  }

  // Start new load
  const promise = new Promise<void>((resolve, reject) => {
    scene.load.image(key, url);
    scene.load.once(`filecomplete-image-${key}`, () => {
      loadingTextures.delete(key);
      resolve();
    });
    scene.load.once("loaderror", (file: any) => {
      if (file.key === key) {
        loadingTextures.delete(key);
        reject(new Error(`Failed to load texture: ${url}`));
      }
    });
    scene.load.start();
  });

  loadingTextures.set(key, promise);
  return { ready: false, promise };
}

/** Metadata key for tracking expected texture on a sprite */
const TEXTURE_KEY = "__solidion_textureKey";

/**
 * Apply a texture to a sprite-like GameObject with auto-loading.
 */
export function applyTexture(
  node: Phaser.GameObjects.GameObject,
  url: string
): void {
  const obj = node as any;
  const parsed = parseTextureRef(url);

  if (parsed.type === "atlas") {
    // Atlas: assume already loaded via Preload
    if (typeof obj.setTexture === "function") {
      obj.setTexture(parsed.key, parsed.frame);
      obj.visible = true;
    }
    return;
  }

  // Single image: auto-load
  const key = urlToKey(url);
  obj[TEXTURE_KEY] = key;

  const scene = obj.scene as Phaser.Scene;
  if (!scene) return;

  const result = ensureTexture(scene, key, url);

  if (result.ready) {
    obj.setTexture(key);
    obj.visible = true;
  } else {
    obj.visible = false;
    result.promise?.then(() => {
      // Check if this node is still alive and still expects this texture
      if (!obj.scene) return;
      if (obj[TEXTURE_KEY] !== key) return;
      obj.setTexture(key);
      obj.visible = true;
    }).catch(() => {
      // Texture load failed - leave invisible
    });
  }
}

/**
 * Preload a list of assets. Returns a promise that resolves when all are loaded.
 */
export function preloadAssets(
  scene: Phaser.Scene,
  assets: (string | { type: string; key: string; [k: string]: any })[]
): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const asset of assets) {
    if (typeof asset === "string") {
      // Simple image URL
      const key = urlToKey(asset);
      const result = ensureTexture(scene, key, asset);
      if (result.promise) {
        promises.push(result.promise);
      }
    } else if (asset.type === "atlas") {
      const { key, image, json } = asset as any;
      if (!scene.textures.exists(key)) {
        const promise = new Promise<void>((resolve) => {
          scene.load.atlas(key, image, json);
          scene.load.once(`filecomplete-atlas-${key}`, () => resolve());
          scene.load.start();
        });
        promises.push(promise);
      }
    } else if (asset.type === "spritesheet") {
      const { key, url, frameWidth, frameHeight } = asset as any;
      if (!scene.textures.exists(key)) {
        const promise = new Promise<void>((resolve) => {
          scene.load.spritesheet(key, url, { frameWidth, frameHeight });
          scene.load.once(`filecomplete-spritesheet-${key}`, () => resolve());
          scene.load.start();
        });
        promises.push(promise);
      }
    }
  }

  return Promise.all(promises).then(() => {});
}
