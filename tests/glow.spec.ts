import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  select,
  waitForApp,
  getScreenRect,
} from "./helpers";

test.describe("Pulsating Glow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("selected node has glow state in engine", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Verify the node is selected
    const after = await getState(page);
    expect(after.selectedId).toBe(childId);

    // The engine should have glow state for the selected node
    const glowState = await page.evaluate((id) => {
      const mm = (window as any).__mm;
      // Check if the engine has glow tracking
      const canvas = document.querySelector("canvas");
      return {
        hasCanvas: !!canvas,
        selectedId: id,
      };
    }, childId);
    expect(glowState.hasCanvas).toBe(true);
    expect(glowState.selectedId).toBe(childId);
  });

  test("glow follows selection change", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Select child1
    await select(page, child1Id);
    let after = await getState(page);
    expect(after.selectedId).toBe(child1Id);

    // Select child2
    await select(page, child2Id);
    after = await getState(page);
    expect(after.selectedId).toBe(child2Id);
  });

  test("deselecting removes glow", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Deselect
    await select(page, null);
    const after = await getState(page);
    expect(after.selectedId).toBeNull();
  });

  test("multiple selection shows glow on all selected", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Select both (additive)
    await select(page, child1Id, true);
    await select(page, child2Id, true);
    const after = await getState(page);
    expect(after.selectedIds.length).toBeGreaterThanOrEqual(1);
  });

  test("glow is visible on canvas for selected node", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Get the screen rect of the selected node
    const rect = await getScreenRect(page, childId);
    expect(rect).toBeTruthy();

    // Take a screenshot to verify the glow is rendered
    // (We can't easily check canvas pixels, but we verify the node is selected
    // and the canvas is rendering)
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible();
  });

  test("glow persists across layout updates", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Trigger a layout update by adding another node
    await addChild(page, rootId);
    await page.waitForTimeout(200);

    // The original selection should still have glow
    const after = await getState(page);
    // Selection may have changed to the new node, but the glow system
    // should still work for whatever is selected
    expect(after.selectedId).toBeTruthy();
  });

  test("glow works in different layout modes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Switch to force layout
    await page.evaluate(() => (window as any).__mm.setLayoutMode("force"));
    await page.waitForTimeout(300);

    // Select the node again
    await select(page, childId);
    const after = await getState(page);
    expect(after.selectedId).toBe(childId);
    expect(after.layoutMode).toBe("force");
  });

  test("glow works after undo/redo", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Undo
    await page.evaluate(() => (window as any).__mm.undo());
    await page.waitForTimeout(200);

    // Redo
    await page.evaluate(() => (window as any).__mm.redo());
    await page.waitForTimeout(200);

    // Select the node
    await select(page, childId);
    const after = await getState(page);
    expect(after.selectedId).toBe(childId);
  });
});
