import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("aquarium mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("canvas fits within mobile viewport", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    const vp = page.viewportSize()!;
    expect(box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.height).toBeLessThanOrEqual(vp.height + 1);
  });

  test("canvas is scaled down from original 640x480", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    expect(box.width).toBeLessThan(640);
    expect(box.width).toBeGreaterThan(100);
  });

  test("starts in title phase", async ({ page }) => {
    const state = await getDebugState(page);
    expect(state.phase).toBe("title");
    expect(state.fishCount).toBe(0);
  });

  test("tap transitions to aquarium phase with fish", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.tap();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      expect(state.fishCount).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 5000 });
  });

  test("tap water creates food on mobile", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.tap(); // enter aquarium

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
    }).toPass({ timeout: 5000 });

    // Tap center of canvas to drop food
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await canvas.tap({ position: { x: box.width / 2, y: box.height / 2 } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.foodCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });
  });
});
