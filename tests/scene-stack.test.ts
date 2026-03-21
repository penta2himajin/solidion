import { describe, it, expect, beforeEach } from "vitest";
import { pushScene, popScene, getCurrentScene, resetSceneStack } from "../src/core/scene-stack";
import { MockScene } from "./mocks";

describe("Scene Stack", () => {
  beforeEach(() => {
    resetSceneStack();
  });

  it("starts with no current scene", () => {
    expect(getCurrentScene()).toBeNull();
  });

  it("pushScene sets current scene", () => {
    const scene = new MockScene();
    pushScene(scene as any);
    expect(getCurrentScene()).toBe(scene);
  });

  it("popScene restores previous scene", () => {
    const scene1 = new MockScene();
    const scene2 = new MockScene();
    pushScene(scene1 as any);
    pushScene(scene2 as any);
    expect(getCurrentScene()).toBe(scene2);

    popScene();
    expect(getCurrentScene()).toBe(scene1);
  });

  it("popScene on empty stack sets null", () => {
    const scene = new MockScene();
    pushScene(scene as any);
    popScene();
    expect(getCurrentScene()).toBeNull();
  });

  it("supports deep nesting", () => {
    const scenes = Array.from({ length: 5 }, () => new MockScene());
    for (const s of scenes) pushScene(s as any);
    expect(getCurrentScene()).toBe(scenes[4]);

    for (let i = scenes.length - 1; i >= 0; i--) {
      expect(getCurrentScene()).toBe(scenes[i]);
      popScene();
    }
    expect(getCurrentScene()).toBeNull();
  });
});
