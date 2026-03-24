import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("null-pow example", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
    // Click canvas to ensure Phaser keyboard input has focus
    await page.locator("canvas").click();
    await page.waitForTimeout(200);
  });

  test("starts in ready phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });
  });

  test("space key starts the game", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
      expect(state.totalDots).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("player starts at maze start position", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      // Player start is col=10, row=17 (from maze definition "P" position)
      expect(state.playerCol).toBe(10);
      expect(state.playerRow).toBe(17);
    }).toPass({ timeout: 5000 });
  });

  test("arrow keys move the player and collect dots", async ({ page }) => {
    test.setTimeout(30_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 5000 });

    const initialState = await getDebugState(page);
    const initialDots = initialState.totalDots;

    // Move left to collect dots (there are dots to the left of start position)
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(2000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.totalDots).toBeLessThan(initialDots);
      expect(state.score).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("ghosts start in scatter mode", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      // All ghosts should start in scatter mode
      expect(state.ghostModes).toEqual(["scatter", "scatter", "scatter", "scatter"]);
      expect(state.frightActive).toBe(false);
    }).toPass({ timeout: 5000 });
  });

  test("ghosts transition from scatter to chase", async ({ page }) => {
    test.setTimeout(30_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    // Keep moving to stay alive while waiting for mode transition
    // scatter→chase happens at 7000ms
    const pressDir = async () => {
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(1500);
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(1500);
    };

    // Wait for chase mode (7s scatter + some margin)
    await expect(async () => {
      await pressDir();
      const state = await getDebugState(page);
      if (state.phase !== "play") throw new Error("Game ended");
      // At least one non-eaten ghost should be in chase mode
      expect(state.ghostModes).toContain("chase");
    }).toPass({ timeout: 15000 });
  });

  test("collecting power pellet activates frightened mode", async ({ page }) => {
    test.setTimeout(30_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 5000 });

    // Power pellet at (1,17). Player starts at (10,17).
    // Path: Left to (5,17), Up to (5,15), Left to (1,15), Down to (1,17).
    // Player speed is 3 tiles/s ≈ 333ms per tile.

    // Left 5 tiles: 10→5
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(2500);

    // Up 2 tiles: 17→15
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(1200);

    // Left 4 tiles: 5→1
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(2200);

    // Down 2 tiles: 15→17 (picks up power pellet)
    await page.keyboard.press("ArrowDown");

    // Wait for frightened mode to activate (power pellet collected)
    await expect(async () => {
      const state = await getDebugState(page);
      if (state.phase !== "play") throw new Error("Game ended — ghost caught player before reaching pellet");
      expect(state.frightActive).toBe(true);
    }).toPass({ timeout: 10000 });
  });

  test("player death reduces lives", async ({ page }) => {
    test.setTimeout(30_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.lives).toBe(3);
    }).toPass({ timeout: 5000 });

    // Wait for a ghost to catch the player (ghosts start with delay, should catch up)
    // Just wait — if player doesn't move much, ghosts will eventually reach them
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.lives).toBeLessThan(3);
    }).toPass({ timeout: 20000 });
  });

  test("game over after losing all lives and space restarts", async ({ page }) => {
    test.setTimeout(90_000);
    test.slow();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    // Wait for dead phase (player stays still, ghosts will catch them repeatedly)
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("dead");
    }).toPass({ timeout: 60000 });

    // Press space to restart
    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
    }).toPass({ timeout: 5000 });
  });
});
