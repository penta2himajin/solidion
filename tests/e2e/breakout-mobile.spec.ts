import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("breakout mobile", () => {
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

    // On 390px wide viewport, 640px canvas must be scaled down
    expect(box.width).toBeLessThan(640);
    expect(box.width).toBeGreaterThan(100);
  });

  test("starts in ready phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
    }).toPass({ timeout: 5000 });
  });

  test("tap launches ball and enters play phase", async ({ page }) => {
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

  test("ball moves after tap launch", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    const before = await getDebugState(page);

    await canvas.tap();
    await page.waitForTimeout(500);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.by).not.toBe(before.by);
    }).toPass({ timeout: 3000 });
  });
});
