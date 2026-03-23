import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("aquarium example", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for Phaser canvas to be present
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("title screen shows phase=title and fishCount=0", async ({ page }) => {
    const state = await getDebugState(page);
    expect(state.phase).toBe("title");
    expect(state.fishCount).toBe(0);
  });

  test("tap title transitions to aquarium phase with fish", async ({ page }) => {
    // Tap the canvas to transition from title to aquarium
    const canvas = page.locator("canvas");
    await canvas.click();

    // Wait for phase to change
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      expect(state.fishCount).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });
  });

  test("Add Fish button increments fishCount", async ({ page }) => {
    // Enter aquarium phase
    const canvas = page.locator("canvas");
    await canvas.click();

    // Wait for initial fish
    let initialCount = 0;
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      initialCount = state.fishCount;
      expect(initialCount).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });

    // Click the Add Fish button (top-right area of canvas)
    // The button is rendered in Phaser at approximately (W-60, 17)
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await canvas.click({ position: { x: box.width - 60, y: 17 } });

    // Wait for fish count to increment
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fishCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 3000 });
  });

  test("tap water creates food", async ({ page }) => {
    // Enter aquarium phase
    const canvas = page.locator("canvas");
    await canvas.click();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
    }).toPass({ timeout: 5000 });

    // Tap in the water area (center of canvas)
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });

    // Check food appeared
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.foodCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });
  });

  test("screenshot smoke test", async ({ page }) => {
    // Enter aquarium phase
    const canvas = page.locator("canvas");
    await canvas.click();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
    }).toPass({ timeout: 5000 });

    // Wait a moment for rendering to settle
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("aquarium.png", {
      maxDiffPixelRatio: 0.1,
    });
  });
});
