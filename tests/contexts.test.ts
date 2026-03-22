import { describe, it, expect } from "vitest";
import { createRoot, createComponent } from "solid-js";
import {
  GameContext,
  SceneContext,
  FrameManagerContext,
  ParentNodeContext,
  useGame,
  useScene,
  useFrameManager,
  useParentNode,
} from "../src/contexts";
import { MockScene, MockGameObject } from "./mocks";

describe("Contexts", () => {
  describe("useGame", () => {
    it("throws when called without a Game provider", () => {
      expect(() => {
        createRoot(() => {
          useGame();
        });
      }).toThrow("Solidion: useGame() must be used within a <Game> component.");
    });

    it("returns game when provided", () => {
      let result: any;
      createRoot(() => {
        createComponent(GameContext.Provider, {
          value: { isGame: true } as any,
          get children() {
            result = useGame();
            return null;
          },
        });
      });
      expect(result).toEqual({ isGame: true });
    });
  });

  describe("useScene", () => {
    it("throws when called without a Scene provider", () => {
      expect(() => {
        createRoot(() => {
          useScene();
        });
      }).toThrow("Solidion: useScene() must be used within a <Scene> component.");
    });

    it("returns scene when provided", () => {
      let result: any;
      const mockScene = new MockScene();
      createRoot(() => {
        createComponent(SceneContext.Provider, {
          value: mockScene as any,
          get children() {
            result = useScene();
            return null;
          },
        });
      });
      expect(result).toBe(mockScene);
    });
  });

  describe("useFrameManager", () => {
    it("throws when called without a Scene provider", () => {
      expect(() => {
        createRoot(() => {
          useFrameManager();
        });
      }).toThrow("Solidion: useFrameManager() must be used within a <Scene> component.");
    });

    it("returns frame manager when provided", () => {
      let result: any;
      const mockFM = { register: () => () => {}, update: () => {} };
      createRoot(() => {
        createComponent(FrameManagerContext.Provider, {
          value: mockFM as any,
          get children() {
            result = useFrameManager();
            return null;
          },
        });
      });
      expect(result).toBe(mockFM);
    });
  });

  describe("useParentNode", () => {
    it("returns undefined when called without a ParentNode provider", () => {
      let result: any = "sentinel";
      createRoot(() => {
        result = useParentNode();
      });
      expect(result).toBeUndefined();
    });

    it("returns parent node when provided", () => {
      let result: any;
      const mockNode = new MockGameObject();
      createRoot(() => {
        createComponent(ParentNodeContext.Provider, {
          value: mockNode as any,
          get children() {
            result = useParentNode();
            return null;
          },
        });
      });
      expect(result).toBe(mockNode);
    });
  });

  describe("Context objects are exported", () => {
    it("GameContext is a valid context", () => {
      expect(GameContext).toBeDefined();
      expect(GameContext.id).toBeDefined();
    });

    it("SceneContext is a valid context", () => {
      expect(SceneContext).toBeDefined();
      expect(SceneContext.id).toBeDefined();
    });

    it("FrameManagerContext is a valid context", () => {
      expect(FrameManagerContext).toBeDefined();
      expect(FrameManagerContext.id).toBeDefined();
    });

    it("ParentNodeContext is a valid context", () => {
      expect(ParentNodeContext).toBeDefined();
      expect(ParentNodeContext.id).toBeDefined();
    });
  });
});
