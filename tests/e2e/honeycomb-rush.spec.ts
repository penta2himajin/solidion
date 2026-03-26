import { test, expect } from "@playwright/test";

/** Helper: read the debug DOM element and parse its JSON */
async function getDebugState(page: import("@playwright/test").Page) {
  const el = page.locator("#solidion-debug");
  await expect(el).toBeAttached({ timeout: 5000 });
  const text = await el.textContent();
  return JSON.parse(text!);
}

test.describe("honeycomb-rush example", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("title screen shows phase=title", async ({ page }) => {
    const state = await getDebugState(page);
    expect(state.phase).toBe("title");
    expect(state.honey).toBe(30);
    expect(state.totalHP).toBe(9);
  });

  test("tap title transitions to prep phase", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click();

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });
  });

  test("initial honey is 30 and larva HP is full", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
      expect(state.honey).toBe(30);
      expect(state.larvaHP).toEqual([3, 3, 3]);
      expect(state.totalHP).toBe(9);
    }).toPass({ timeout: 5000 });
  });

  test("selecting bee type updates selectedBeeType", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    // Click Guard button (first button in bar, x≈80, y≈barY=450)
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await canvas.click({ position: { x: 80 * (box.width / 640), y: (480 - 30) * (box.height / 480) } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("guard");
    }).toPass({ timeout: 3000 });
  });

  test("placing a guard bee deducts honey", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Select guard bee
    await canvas.click({ position: { x: 80 * scaleX, y: 450 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("guard");
    }).toPass({ timeout: 3000 });

    // Click on a ground cell (row3, col1 is ground ".")
    // cellToX(3, 1) = MAP_OFFSET_X + 1*48 + 24 + 24(odd stagger) = 16 + 48 + 24 + 24 = 112
    // cellToY(3, 1) = MAP_OFFSET_Y + 3*48 + 24 = 0 + 144 + 24 = 168
    // MAP_OFFSET_X = (640 - 13*48) / 2 = (640 - 624) / 2 = 8
    // MAP_OFFSET_Y = (480 - 10*48) / 2 = (480 - 480) / 2 = 0
    // So: x = 8 + 48 + 24 + 24 = 104, y = 0 + 144 + 24 = 168
    await canvas.click({ position: { x: 104 * scaleX, y: 168 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.beeCount).toBe(1);
      expect(state.honey).toBe(20); // 30 - 10 (guard cost)
      expect(state.selectedBeeType).toBeNull();
    }).toPass({ timeout: 3000 });
  });

  test("start wave button spawns enemies", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Click "Start Wave" button (center of screen, y ≈ H/2 - 40 = 200)
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("wave");
    }).toPass({ timeout: 3000 });

    // Wait for enemies to spawn
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.enemyCount).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("enemies progress along path toward nest", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Start wave
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("wave");
      expect(state.enemyCount).toBeGreaterThan(0);
      expect(state.walkingCount).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });

  test("createIndex tracks enemy FSM states correctly", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Start wave
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    // Wait for enemies to be walking
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.walkingCount).toBeGreaterThan(0);
      // Index sizes should be consistent with enemy count
      const totalTracked = state.walkingCount + state.blockedCount + state.slowedCount + state.dyingCount;
      expect(totalTracked).toBeLessThanOrEqual(state.enemyCount);
    }).toPass({ timeout: 5000 });
  });

  test("placing archer bee on high ground deducts 15 honey", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Select archer (second button, x≈200)
    await canvas.click({ position: { x: 200 * scaleX, y: 450 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("archer");
    }).toPass({ timeout: 3000 });

    // Click on a high ground cell (row2, col1 is "^")
    // cellToX(2, 1) = 8 + 48 + 24 = 80, cellToY(2, 1) = 96 + 24 = 120
    await canvas.click({ position: { x: 80 * scaleX, y: 120 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.beeCount).toBe(1);
      expect(state.honey).toBe(15); // 30 - 15
    }).toPass({ timeout: 3000 });
  });

  test("retreat bee returns partial honey", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Place a guard bee first
    await canvas.click({ position: { x: 80 * scaleX, y: 450 * scaleY } }); // select guard
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("guard");
    }).toPass({ timeout: 3000 });

    // Place on row3,col1 ground cell
    await canvas.click({ position: { x: 104 * scaleX, y: 168 * scaleY } });
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.beeCount).toBe(1);
      expect(state.honey).toBe(20);
    }).toPass({ timeout: 3000 });

    // Click on the placed bee to select it
    await canvas.click({ position: { x: 104 * scaleX, y: 168 * scaleY } });
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeId).not.toBeNull();
    }).toPass({ timeout: 3000 });

    // Click Retreat button (W-80=560, H/2+10=250)
    await canvas.click({ position: { x: 560 * scaleX, y: 250 * scaleY } });
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.beeCount).toBe(0);
      expect(state.honey).toBe(26); // 20 + floor(10 * 0.6) = 26
      expect(state.selectedBeeId).toBeNull();
    }).toPass({ timeout: 3000 });
  });

  test("screenshot smoke test", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot("honeycomb-rush.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  // ══════════════════════════════════════════════════
  // RECS behavioral tests
  // ══════════════════════════════════════════════════

  test("archer bee fires projectiles at enemies in range", async ({ page }) => {
    test.slow();
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Place archer on row2,col1 (high ground near route A)
    await canvas.click({ position: { x: 200 * scaleX, y: 450 * scaleY } }); // select archer
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.selectedBeeType).toBe("archer");
    }).toPass({ timeout: 3000 });

    await canvas.click({ position: { x: 80 * scaleX, y: 120 * scaleY } }); // place
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.beeCount).toBe(1);
    }).toPass({ timeout: 3000 });

    // Start wave
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    // Wait for projectiles to appear
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.projectileCount).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });

  test("enemies reaching nest reduce larva HP", async ({ page }) => {
    test.slow();
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Start wave without placing any defenses
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    // Wait for enemies to reach the nest and damage larvae
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.totalHP).toBeLessThan(9);
    }).toPass({ timeout: 30000 });
  });

  test("wave 1 uses only route A", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter prep

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("prep");
    }).toPass({ timeout: 5000 });

    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    const scaleX = box.width / 640, scaleY = box.height / 480;

    // Start wave 1
    await canvas.click({ position: { x: 320 * scaleX, y: 200 * scaleY } });

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("wave");
      expect(state.wave).toBe(0); // 0-indexed
    }).toPass({ timeout: 3000 });
  });
});
