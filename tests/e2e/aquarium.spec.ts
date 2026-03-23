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

  test("tap fish opens panel, Close hides it", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    // Wait for fish to be available
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      expect(state.fishPositions.length).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    // Retry clicking fish — they move, so re-read position each attempt
    await expect(async () => {
      const state = await getDebugState(page);
      const fp = state.fishPositions[0];
      await canvas.click({ position: { x: fp.x, y: fp.y } });
      // Re-read state after click
      await page.waitForTimeout(600); // wait for debug refresh (500ms)
      const after = await getDebugState(page);
      expect(after.showPanel).toBe(true);
      expect(after.selIdx).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 8000 });

    // Click Close button (panel x ≈ W-80=560, Close y ≈ H/2+60=300)
    await canvas.click({ position: { x: 560, y: 300 } });

    // Panel should close
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.showPanel).toBe(false);
      expect(state.selIdx).toBe(-1);
    }).toPass({ timeout: 3000 });
  });

  test("tap fish then Release removes the fish", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    // Wait for fish
    let initialCount = 0;
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      expect(state.fishPositions.length).toBeGreaterThan(0);
      initialCount = state.fishCount;
    }).toPass({ timeout: 5000 });

    // Retry clicking fish — they move, so re-read position each attempt
    await expect(async () => {
      const state = await getDebugState(page);
      const fp = state.fishPositions[0];
      await canvas.click({ position: { x: fp.x, y: fp.y } });
      await page.waitForTimeout(600);
      const after = await getDebugState(page);
      expect(after.showPanel).toBe(true);
    }).toPass({ timeout: 8000 });

    // Click Release button (panel x ≈ W-80=560, Release y ≈ H/2+30=270)
    await canvas.click({ position: { x: 560, y: 270 } });

    // Fish count should decrease and panel should close
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fishCount).toBe(initialCount - 1);
      expect(state.showPanel).toBe(false);
      expect(state.selIdx).toBe(-1);
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
