import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("floppy-heads mobile", () => {
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

  test("canvas maintains aspect ratio on mobile", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Original is 400x600 (2:3 ratio). Scaled aspect ratio should be preserved.
    const ratio = box.width / box.height;
    const expectedRatio = 400 / 600;
    expect(ratio).toBeCloseTo(expectedRatio, 1);
  });

  test("starts in ready phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
      expect(state.score).toBe(0);
    }).toPass({ timeout: 5000 });
  });

  test("tap transitions to play phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    await canvas.tap();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });
  });

  test("disk falls due to gravity without flapping", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    await canvas.tap(); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });

    // Don't flap — disk should fall and hit ground
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("dead");
    }).toPass({ timeout: 8000 });
  });
});
