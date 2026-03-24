import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("nadion-defense example", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("starts in ready phase with score=0, lives=3, wave=1", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    // After starting, check initial values
    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
      expect(state.wave).toBe(1);
      expect(state.alive).toBe(40);
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
    }).toPass({ timeout: 3000 });
  });

  test("click also starts the game", async ({ page }) => {
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

  test("firing creates bolts", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space"); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });

    // Fire several times
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Space");
      await page.waitForTimeout(350); // cooldown is 300ms
    }

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.activeBolts).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });
  });

  test("hitting enemies increases score and reduces alive count", async ({ page }) => {
    test.setTimeout(30_000);

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space"); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });

    // Fire continuously to hit enemies above
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      const state = await getDebugState(page);
      if (state.phase !== "play" || state.score > 0) break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(350);
    }

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.score).toBeGreaterThan(0);
      expect(state.alive).toBeLessThan(40);
    }).toPass({ timeout: 5000 });
  });

  test("player can move left and right", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space"); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });

    const state1 = await getDebugState(page);
    const initialX = state1.playerX;

    // Hold left arrow
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(500);
    await page.keyboard.up("ArrowLeft");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.playerX).toBeLessThan(initialX);
    }).toPass({ timeout: 3000 });
  });

  test("shields start with full HP", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space"); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.shieldHps).toEqual([4, 4, 4, 4]);
    }).toPass({ timeout: 5000 });
  });

  test("enemy fire can damage shields over time", async ({ page }) => {
    test.slow(); // enemy fire is random, may take a while

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space"); // start

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 3000 });

    // Wait for enemy fire to damage at least one shield
    await expect(async () => {
      const state = await getDebugState(page);
      const totalHp = state.shieldHps.reduce((a: number, b: number) => a + b, 0);
      expect(totalHp).toBeLessThan(16); // 4 shields × 4 HP = 16
    }).toPass({ timeout: 30000 });
  });
});
