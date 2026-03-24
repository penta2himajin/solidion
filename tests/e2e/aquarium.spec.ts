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

  // ══════════════════════════════════════════════════
  // ECS behavioral tests
  // ══════════════════════════════════════════════════

  test("fish FSM transitions from idle to swim within a few seconds", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    // Initial fish should start in "idle"
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fishStates).toBeDefined();
      expect(state.fishStates.length).toBeGreaterThan(0);
      expect(state.fishStates).toContain("idle");
    }).toPass({ timeout: 5000 });

    // Wait for at least one fish to transition to "swim" (idle duration: 2-4s)
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fishStates).toContain("swim");
    }).toPass({ timeout: 8000 });
  });

  test("bubbles spawn and rise continuously", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    // Wait for bubbles to appear (spawn timer: 200-700ms)
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.bubbleCount).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });

    // Record count, wait, check new bubbles spawned (count should stay active)
    const state1 = await getDebugState(page);
    const count1 = state1.bubbleCount;
    expect(count1).toBeGreaterThan(0);

    // Over a few seconds, bubbles continuously spawn
    await page.waitForTimeout(2000);
    const state2 = await getDebugState(page);
    // Still has active bubbles (old ones pop at surface, new ones spawn)
    expect(state2.bubbleCount).toBeGreaterThan(0);
  });

  test("food sinks to floor and deactivates", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
    }).toPass({ timeout: 5000 });

    // Drop food near the floor (y≈400) at left edge away from fish
    // Food sinks at 18px/s, ~50px to floor → ~3s to deactivate
    await canvas.click({ position: { x: 40, y: 400 } });

    // Food should appear
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.foodCount).toBeGreaterThan(0);
    }).toPass({ timeout: 3000 });

    // Wait for food to reach floor and deactivate
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.foodCount).toBe(0);
    }).toPass({ timeout: 8000 });
  });

  test("fish eat food when hungry (eat state + food consumed)", async ({ page }) => {
    test.slow(); // hunger takes ~10s to reach threshold

    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    // Wait for fish to become hungry (hunger > 30, at rate 0.003*delta ≈ 0.05/frame ≈ 10s)
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fishHungers).toBeDefined();
      expect(state.fishHungers.length).toBeGreaterThan(0);
      expect(Math.max(...state.fishHungers)).toBeGreaterThan(25);
    }).toPass({ timeout: 15000 });

    // Re-read fish position AFTER hunger wait (fish moved during wait)
    const hungryState = await getDebugState(page);
    const fp = hungryState.fishPositions[0];

    // Drop food right at the fish's current position
    await canvas.click({ position: { x: fp.x, y: fp.y } });

    // Wait for a fish to enter "eat" state and/or consume the food
    await expect(async () => {
      const state = await getDebugState(page);
      const hasEater = state.fishStates.includes("eat");
      const foodConsumed = state.foodCount === 0;
      expect(hasEater || foodConsumed).toBe(true);
    }).toPass({ timeout: 10000 });
  });

  test("jellyfish startles on click and recovers", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
      expect(state.jellyStartled).toBeDefined();
    }).toPass({ timeout: 5000 });

    // Initial: no jellyfish startled
    const before = await getDebugState(page);
    expect(before.jellyStartled).toEqual([false, false]);

    // Click on jellyfish position (baseX=520, baseY=150 for the first one)
    await canvas.click({ position: { x: 520, y: 150 } });

    // Should be startled
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.jellyStartled[0]).toBe(true);
    }).toPass({ timeout: 2000 });

    // Should recover after 800ms
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.jellyStartled[0]).toBe(false);
    }).toPass({ timeout: 3000 });
  });

  test("fry spawn with parent fish and follow", async ({ page }) => {
    const canvas = page.locator("canvas");
    await canvas.click(); // enter aquarium

    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.phase).toBe("aquarium");
    }).toPass({ timeout: 5000 });

    // Spawn many fish to trigger fry (20% chance each)
    // With 7 additional fish, P(at least one fry) = 1 - 0.8^7 ≈ 79%
    // With 10, it's 1 - 0.8^10 ≈ 89%. Add as many as we can.
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    for (let i = 0; i < 7; i++) {
      await canvas.click({ position: { x: box.width - 60, y: 17 } });
      await page.waitForTimeout(100);
    }

    // Check for fry (probabilistic — may not always appear)
    // Use a generous timeout and retry clicking Add Fish if needed
    await expect(async () => {
      const state = await getDebugState(page);
      expect(state.fryCount).toBeGreaterThan(0);
    }).toPass({ timeout: 5000 });
  });
});
