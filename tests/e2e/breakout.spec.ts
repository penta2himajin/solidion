import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("breakout example", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("starts in ready phase with score=0 and lives=3", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
      expect(state.alive).toBe(60);
    }).toPass({ timeout: 5000 });
  });

  test("click launches ball and enters play phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    await canvas.click();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });
  });

  test("ball moves after launch", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");

    // Record initial ball position
    const before = await getDebugState(page);
    const initialBy = before.by;

    // Launch
    await canvas.click();
    await page.waitForTimeout(500);

    // Ball should have moved
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.by).not.toBe(initialBy);
    }).toPass({ timeout: 3000 });
  });

  test("blocks break and score increases during gameplay", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    await canvas.click();

    // Wait for some blocks to be broken (ball needs to reach them)
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.score).toBeGreaterThan(0);
      expect(state.alive).toBeLessThan(60);
    }).toPass({ timeout: 10000 });
  });

  test("paddle follows pointer horizontally", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Move pointer to left side
    await canvas.hover({ position: { x: 100, y: box.height / 2 } });
    await page.waitForTimeout(300);

    const state1 = await getDebugState(page);

    // Move pointer to right side
    await canvas.hover({ position: { x: box.width - 100, y: box.height / 2 } });
    await page.waitForTimeout(300);

    // Ball x (parked on paddle in ready) should change — but we check via
    // launching then checking score. Instead, just verify phase is still ready.
    const state2 = await getDebugState(page);
    expect(state2.phase).toBe("ready");
    // The bx tracks paddle in ready phase, so it should differ
    expect(state2.bx).not.toBe(state1.bx);
  });

  test("losing all lives transitions to game over", async ({ page }) => {
    test.setTimeout(60_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Launch and let ball miss repeatedly until game over
    await expect(async () => {
      const state = await getDebugState(page);
      if (state.phase === "ready" || state.phase === "miss") {
        // Move paddle to far edge, launch
        await canvas.click({ position: { x: 4, y: box.height / 2 } });
        await canvas.hover({ position: { x: 4, y: box.height / 2 } });
      }
      expect(state.phase).toBe("over");
    }).toPass({ timeout: 50000 });
  });

  test("click during game over restarts the game", async ({ page }) => {
    test.setTimeout(90_000);

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Same approach as "losing all lives" — keep clicking at far edge to lose
    await expect(async () => {
      const state = await getDebugState(page);
      if (state.phase === "ready" || state.phase === "miss") {
        await canvas.click({ position: { x: 4, y: box.height / 2 } });
        await canvas.hover({ position: { x: 4, y: box.height / 2 } });
      }
      expect(state.phase).toBe("over");
    }).toPass({ timeout: 80000 });

    // Click to restart
    await canvas.click();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
      expect(state.alive).toBe(60);
    }).toPass({ timeout: 5000 });
  });
});
