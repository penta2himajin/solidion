import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("honeycomb-rush mobile", () => {
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
    expect(state.honey).toBe(30);
  });

  test("tap transitions to prep phase", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.tap();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });
  });

  test("tap bee selection bar on mobile", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.tap(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    // Tap Guard button area (first in bar)
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;
    await canvas.tap({ position: { x: 80 * scaleX, y: 450 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("guard");
    }).toPass({ timeout: 3000 });
  });
});
