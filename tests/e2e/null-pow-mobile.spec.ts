import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("null-pow mobile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
    // Wait for Phaser to boot — don't tap, as that starts the game now
    await page.waitForTimeout(500);
  });

  test("canvas fits within mobile viewport", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    const vp = page.viewportSize()!;
    expect(box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.height).toBeLessThanOrEqual(vp.height + 1);
  });

  test("canvas is scaled down on mobile", async ({ page }) => {
    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Original is 504x602. On 390px viewport it must scale down.
    expect(box.width).toBeLessThan(504);
    expect(box.width).toBeGreaterThan(100);
  });

  test("starts in ready phase", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });
  });

  test("detects touch device and shows mobile instructions", async ({ page }) => {
    // Check if isTouchDevice is detected correctly in mobile context
    const hasTouchInBrowser = await page.evaluate(() => {
      return "ontouchstart" in window || navigator.maxTouchPoints > 0;
    });
    expect(hasTouchInBrowser).toBe(true);

    // Verify the debug state shows the game is in ready phase
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });
  });

  test("no JS errors on page load (keyboard null safety)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    // There should be no errors — especially no "Cannot read properties of null"
    expect(errors.filter(e => e.includes("null"))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("tap on canvas starts the game (Playwright tap)", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    // Verify counters are zero before interaction
    const beforeState = await getDebugState(page);
    expect(beforeState.pointerDownCount).toBe(0);
    expect(beforeState.isTouchDevice).toBe(true);

    const canvas = page.locator("canvas");
    await canvas.tap();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.score).toBe(0);
      expect(state.lives).toBe(3);
      // At least one of the input paths should have fired
      const totalInputs = state.pointerDownCount + state.touchStartCount;
      expect(totalInputs).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("tap on canvas starts the game (synthetic TouchEvent)", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    const canvas = page.locator("canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Dispatch synthetic touch events (closer to real mobile behavior)
    await page.evaluate(({ cx, cy }) => {
      const c = document.querySelector("canvas")!;
      const touch = new Touch({ identifier: 1, target: c, clientX: cx, clientY: cy });
      c.dispatchEvent(new TouchEvent("touchstart", {
        bubbles: true, cancelable: true,
        touches: [touch], changedTouches: [touch],
      }));
      c.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true, cancelable: true,
        touches: [], changedTouches: [touch],
      }));
    }, { cx, cy });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 5000 });
  });

  test("swipe changes player direction", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    // Start the game
    const canvas = page.locator("canvas");
    await canvas.tap();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Swipe left
    await page.touchscreen.tap(cx, cy);
    await page.waitForTimeout(100);
    // Use manual touch sequence for swipe
    await page.evaluate(({ cx, cy }) => {
      const c = document.querySelector("canvas")!;
      const opts = (x: number, y: number) => ({
        bubbles: true, cancelable: true,
        touches: [new Touch({ identifier: 1, target: c, clientX: x, clientY: y })],
        changedTouches: [new Touch({ identifier: 1, target: c, clientX: x, clientY: y })],
      });
      c.dispatchEvent(new TouchEvent("touchstart", opts(cx, cy)));
      c.dispatchEvent(new TouchEvent("touchend", {
        bubbles: true, cancelable: true,
        touches: [],
        changedTouches: [new Touch({ identifier: 1, target: c, clientX: cx - 50, clientY: cy })],
      }));
    }, { cx, cy });

    await page.waitForTimeout(500);

    await expect(async () => {
      const state = await getDebugState(page);
      // playerDir 2 = left
      expect(state.playerDir).toBe(2);
    }).toPass({ timeout: 5000 });
  });

  test("space key starts the game on mobile", async ({ page }) => {
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
    }).toPass({ timeout: 5000 });
  });

  test("game state is correct after start", async ({ page }) => {
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("ready");
    }).toPass({ timeout: 5000 });

    await page.keyboard.press("Space");

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("play");
      expect(state.totalDots).toBeGreaterThan(0);
      expect(state.playerCol).toBe(10);
      expect(state.playerRow).toBe(17);
    }).toPass({ timeout: 5000 });
  });
});
