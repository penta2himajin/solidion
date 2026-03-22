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
    // Do NOT set obj.visible — visibility is controlled by the component
    // (e.g., <Show>, visible prop). Setting it here would override
    // component-level visibility on inactive/hidden elements.
  } else {
    result.promise?.then(() => {
      if (!obj.scene) return;
      if (obj[TEXTURE_KEY] !== key) return;
      obj.setTexture(key);
    }).catch(() => {
      // Texture load failed
    });
  }
}

/**
 * Preload a list of assets. Returns a promise that resolves when all are loaded.
 * Queues all assets first, then starts the loader once.
 */
export function preloadAssets(
  scene: Phaser.Scene,
  assets: (string | { type: string; key: string; [k: string]: any })[]
): Promise<void> {
  let needsLoad = false;
  const pendingKeys: { key: string; type: string }[] = [];

  for (const asset of assets) {
    if (typeof asset === "string") {
      const key = urlToKey(asset);
      if (!scene.textures.exists(key) && !loadingTextures.has(key)) {
        scene.load.image(key, asset);
        pendingKeys.push({ key, type: "image" });
        needsLoad = true;
      }
    } else if (asset.type === "atlas") {
      const { key, image, json } = asset as any;
      if (!scene.textures.exists(key)) {
        scene.load.atlas(key, image, json);
        pendingKeys.push({ key, type: "atlas" });
        needsLoad = true;
      }
    } else if (asset.type === "spritesheet") {
      const { key, url, frameWidth, frameHeight } = asset as any;
      if (!scene.textures.exists(key)) {
        scene.load.spritesheet(key, url, { frameWidth, frameHeight });
        pendingKeys.push({ key, type: "spritesheet" });
        needsLoad = true;
      }
    }
  }

  // Collect keys for recognized asset types only
  const allKeys: string[] = [];
  for (const asset of assets) {
    if (typeof asset === "string") {
      const key = urlToKey(asset);
      if (!scene.textures.exists(key)) allKeys.push(key);
    } else if (asset.type === "atlas" || asset.type === "spritesheet") {
      const key = (asset as any).key;
      if (!scene.textures.exists(key)) allKeys.push(key);
    }
    // Unknown asset types are silently skipped
  }

  if (allKeys.length === 0) {
    return Promise.resolve();
  }

  // Start loader if we queued new files.
  // Note: start() is a no-op if the loader is already running (LOADING state).
  // Files queued during LOADING will be picked up when the loader restarts.
  if (needsLoad) {
    scene.load.start();
  }

  // Poll for texture cache presence instead of relying on loader events.
  // This avoids race conditions between auto-load (applyTexture) and preload
  // when both call scene.load.start() — Phaser's loader ignores start()
  // if already in LOADING state, causing event listeners to miss completion.
  return new Promise<void>((resolve) => {
    function check() {
      if (allKeys.every(k => scene.textures.exists(k))) {
        for (const key of allKeys) {
          loadingTextures.delete(key);
        }
        resolve();
      } else {
        // Retry starting in case previous batch completed and loader is idle now
        if (needsLoad) {
          scene.load.start();
        }
        setTimeout(check, 50);
      }
    }
    setTimeout(check, 50);
  });
}
