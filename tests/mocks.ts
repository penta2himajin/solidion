/**
 * Minimal Phaser mocks for Solidion unit tests.
 * These simulate the Phaser API surface that Solidion depends on.
 */

import { vi } from "vitest";

export class MockGameObject {
  x = 0;
  y = 0;
  angle = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
  alpha = 1;
  visible = true;
  depth = 0;
  width = 0;
  height = 0;
  displayWidth = 0;
  displayHeight = 0;
  blendMode = 0;
  originX = 0.5;
  originY = 0.5;
  input: any = null;
  parentContainer: MockContainer | null = null;
  scene: MockScene | null = null;

  private listeners = new Map<string, Set<Function>>();

  setScale(v: number) {
    this.scaleX = v;
    this.scaleY = v;
  }
  setTint(_v: number) {}
  setOrigin(x: number, y?: number) {
    this.originX = x;
    this.originY = y ?? x;
  }
  setDepth(v: number) {
    this.depth = v;
  }
  setInteractive(_config?: any) {
    this.input = { enabled: true };
  }
  removeInteractive() {
    this.input = null;
  }

  on(event: string, fn: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return this;
  }
  off(event: string, fn: Function) {
    this.listeners.get(event)?.delete(fn);
    return this;
  }
  emit(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
  removeAllListeners() {
    this.listeners.clear();
  }
  destroy() {
    this.removeAllListeners();
    this.scene = null;
  }

  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export class MockSprite extends MockGameObject {
  texture = { key: "" };
  frame = { name: "" };

  setTexture(key: string, frame?: string) {
    this.texture.key = key;
    if (frame) this.frame.name = frame;
  }
  setFrame(f: string | number) {
    this.frame.name = String(f);
  }
  play(_anim: any) {}
}

export class MockImage extends MockGameObject {
  texture = { key: "" };
  frame = { name: "" };

  setTexture(key: string, frame?: string) {
    this.texture.key = key;
    if (frame) this.frame.name = frame;
  }
  setFrame(f: string | number) {
    this.frame.name = String(f);
  }
}

export class MockText extends MockGameObject {
  text = "";
  style: any = {};

  setText(v: string) {
    this.text = v;
  }
  setFontSize(v: number | string) {
    this.style.fontSize = v;
  }
  setFontFamily(v: string) {
    this.style.fontFamily = v;
  }
  setColor(v: string) {
    this.style.color = v;
  }
  setAlign(v: string) {
    this.style.align = v;
  }
  setStyle(v: any) {
    this.style = { ...this.style, ...v };
  }
  setWordWrapWidth(w: number, _adv?: boolean) {
    this.style.wordWrapWidth = w;
  }
}

export class MockRectangle extends MockGameObject {
  fillColor = 0;
  fillAlpha = 1;
  strokeColor = 0;
  strokeAlpha = 1;
  lineWidth = 0;

  setFillStyle(color: number, alpha?: number) {
    this.fillColor = color;
    if (alpha !== undefined) this.fillAlpha = alpha;
  }
  setStrokeStyle(width: number, color?: number, alpha?: number) {
    this.lineWidth = width;
    if (color !== undefined) this.strokeColor = color;
    if (alpha !== undefined) this.strokeAlpha = alpha;
  }
  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
}

export class MockContainer extends MockGameObject {
  list: MockGameObject[] = [];

  add(child: MockGameObject | MockGameObject[]) {
    const children = Array.isArray(child) ? child : [child];
    for (const c of children) {
      this.list.push(c);
      c.parentContainer = this;
    }
  }
  remove(child: MockGameObject) {
    const idx = this.list.indexOf(child);
    if (idx >= 0) {
      this.list.splice(idx, 1);
      child.parentContainer = null;
    }
  }
}

export class MockZone extends MockGameObject {
  setSize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
}

export class MockTimerEvent {
  removed = false;
  callback: Function;
  delay: number;

  constructor(config: { delay: number; callback: Function }) {
    this.delay = config.delay;
    this.callback = config.callback;
  }
  remove() {
    this.removed = true;
  }
  /** Test helper: manually fire */
  fire() {
    if (!this.removed) this.callback();
  }
}

export class MockTween {
  targets: any;
  config: any;
  private _playing = false;
  private _removed = false;
  onUpdateFn?: Function;
  onCompleteFn?: Function;

  constructor(config: any) {
    this.config = config;
    this.targets = config.targets;
    this.onUpdateFn = config.onUpdate;
    this.onCompleteFn = config.onComplete;
    if (!config.paused) this._playing = true;
  }

  play() { this._playing = true; }
  pause() { this._playing = false; }
  remove() { this._removed = true; this._playing = false; }
  isPlaying() { return this._playing; }
  isRemoved() { return this._removed; }

  /** Test helper: simulate a frame update */
  simulateUpdate(progress: number) {
    if (this._removed || !this._playing) return;
    // Interpolate targets
    for (const [key, toVal] of Object.entries(this.config)) {
      if (key === "targets" || key === "duration" || key === "ease" ||
          key === "yoyo" || key === "repeat" || key === "delay" ||
          key === "paused" || key === "onUpdate" || key === "onComplete") continue;
      if (typeof toVal === "number" && key in this.targets) {
        const from = this.targets[key];
        this.targets[key] = from + (toVal - from) * progress;
      }
    }
    this.onUpdateFn?.();
  }

  /** Test helper: simulate completion */
  simulateComplete() {
    this.onCompleteFn?.();
  }
}

export class MockTweenManager {
  tweens: MockTween[] = [];

  add(config: any): MockTween {
    const tween = new MockTween(config);
    this.tweens.push(tween);
    return tween;
  }
}

export class MockTimeManager {
  timers: MockTimerEvent[] = [];

  delayedCall(delay: number, callback: Function): MockTimerEvent {
    const timer = new MockTimerEvent({ delay, callback });
    this.timers.push(timer);
    return timer;
  }
}

export class MockTextureManager {
  private textures = new Set<string>(["__DEFAULT"]);

  exists(key: string): boolean {
    return this.textures.has(key);
  }
  addKey(key: string) {
    this.textures.add(key);
  }
}

export class MockLoader {
  private listeners = new Map<string, Function>();

  image(_key: string, _url: string) {}
  atlas(_key: string, _imageUrl: string, _jsonUrl: string) {}
  spritesheet(_key: string, _url: string, _config: any) {}
  start() {}

  once(event: string, fn: Function) {
    this.listeners.set(event, fn);
  }

  /** Test helper: fire a load complete event */
  fireComplete(type: string, key: string) {
    const event = `filecomplete-${type}-${key}`;
    const fn = this.listeners.get(event);
    if (fn) {
      fn();
      this.listeners.delete(event);
    }
  }
}

export class MockDisplayList {
  items: MockGameObject[] = [];

  add(obj: MockGameObject) {
    this.items.push(obj);
  }
  remove(obj: MockGameObject) {
    const idx = this.items.indexOf(obj);
    if (idx >= 0) this.items.splice(idx, 1);
  }
}

export class MockScene {
  tweens = new MockTweenManager();
  time = new MockTimeManager();
  textures = new MockTextureManager();
  load = new MockLoader();
  sys = {
    displayList: new MockDisplayList(),
    settings: { key: "default" },
  };
  cameras = {
    main: { scrollX: 0, scrollY: 0, zoom: 1, centerX: 400, centerY: 300 },
  };
  add = {
    existing: (obj: MockGameObject) => {
      obj.scene = this as any;
      this.sys.displayList.add(obj);
      return obj;
    },
  };
}

/**
 * Create a mock scene and attach a factory-created GameObject to it.
 */
export function createMockGameObjectInScene<T extends MockGameObject>(
  Ctor: new () => T
): { obj: T; scene: MockScene } {
  const scene = new MockScene();
  const obj = new Ctor();
  obj.scene = scene as any;
  return { obj, scene };
}
