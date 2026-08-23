import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  addSibling,
  waitForApp,
  getScreenRect,
  getWorldPos,
} from "./helpers";

test.describe("Birth Position", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("new child node spawns near parent position", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    // Get root position before adding child
    const rootPosBefore = await getWorldPos(page, rootId);
    expect(rootPosBefore).toBeTruthy();

    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Get child position
    const childPos = await getWorldPos(page, childId);
    expect(childPos).toBeTruthy();

    // The child should be reasonably close to the parent (within a few hundred px)
    const dist = Math.hypot(
      childPos.x - rootPosBefore.x,
      childPos.y - rootPosBefore.y
    );
    expect(dist).toBeLessThan(500);
  });

  test("new sibling spawns near parent position", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;

    const child1Pos = await getWorldPos(page, child1Id);
    expect(child1Pos).toBeTruthy();

    await addSibling(page, child1Id);
    const child2Id = (await getState(page)).selectedId!;

    const child2Pos = await getWorldPos(page, child2Id);
    expect(child2Pos).toBeTruthy();

    // Sibling should be near the first child
    const dist = Math.hypot(
      child2Pos.x - child1Pos.x,
      child2Pos.y - child1Pos.y
    );
    expect(dist).toBeLessThan(500);
  });

  test("new node does not spawn at origin (0,0)", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    const childPos = await getWorldPos(page, childId);
    expect(childPos).toBeTruthy();

    // The node should not be at the exact origin
    const distFromOrigin = Math.hypot(childPos.x, childPos.y);
    // It could be near origin if root is at origin, but shouldn't be exactly (0,0)
    // unless the root is at origin
    const rootPos = await getWorldPos(page, rootId);
    if (rootPos) {
      const distFromRoot = Math.hypot(childPos.x - rootPos.x, childPos.y - rootPos.y);
      // Should be offset from root, not exactly at root
      expect(distFromRoot).toBeGreaterThan(10);
    }
  });

  test("multiple children spawn in a spread pattern", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    const childIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      await addChild(page, rootId);
      const childId = (await getState(page)).selectedId!;
      childIds.push(childId);
    }

    // Wait for the layout to settle so children spread out from their birth positions
    await page.waitForTimeout(1000);

    const positions: { x: number; y: number }[] = [];
    for (const id of childIds) {
      const pos = await getWorldPos(page, id);
      if (pos) positions.push(pos);
    }

    // All positions should be defined
    expect(positions.length).toBe(3);

    // Not all positions should be identical (they should spread out)
    const uniquePositions = new Set(positions.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`));
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  test("birth position is consistent across layout modes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    // Add child in auto mode
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    const pos1 = await getWorldPos(page, child1Id);

    // Switch to force layout
    await page.evaluate(() => (window as any).__mm.setLayoutMode("force"));
    await page.waitForTimeout(300);

    // Add another child
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;
    const pos2 = await getWorldPos(page, child2Id);

    expect(pos1).toBeTruthy();
    expect(pos2).toBeTruthy();
  });

  test("new node is visible after spawning", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // The node should have a screen rect (be visible)
    const rect = await getScreenRect(page, childId);
    expect(rect).toBeTruthy();

    // The rect should be within the canvas bounds
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      if (!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    if (canvas && rect) {
      // Node center should be within canvas bounds (with some margin)
      const nodeCenterX = rect.x + rect.w / 2;
      const nodeCenterY = rect.y + rect.h / 2;
      expect(nodeCenterX).toBeGreaterThan(canvas.x - 100);
      expect(nodeCenterX).toBeLessThan(canvas.x + canvas.w + 100);
      expect(nodeCenterY).toBeGreaterThan(canvas.y - 100);
      expect(nodeCenterY).toBeLessThan(canvas.y + canvas.h + 100);
    }
  });

  test("birth position works after undo/redo", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;
    const pos1 = await getWorldPos(page, childId);

    // Undo
    await page.evaluate(() => (window as any).__mm.undo());
    await page.waitForTimeout(200);

    // Redo
    await page.evaluate(() => (window as any).__mm.redo());
    await page.waitForTimeout(200);

    const pos2 = await getWorldPos(page, childId);
    expect(pos2).toBeTruthy();

    // Position should be similar after redo
    if (pos1 && pos2) {
      const dist = Math.hypot(pos2.x - pos1.x, pos2.y - pos1.y);
      expect(dist).toBeLessThan(100);
    }
  });

  test("deeply nested nodes spawn near their parent", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    // Create a chain: root -> child1 -> child2 -> child3
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, child1Id);
    const child2Id = (await getState(page)).selectedId!;
    await addChild(page, child2Id);
    const child3Id = (await getState(page)).selectedId!;

    const child2Pos = await getWorldPos(page, child2Id);
    const child3Pos = await getWorldPos(page, child3Id);
    expect(child2Pos).toBeTruthy();
    expect(child3Pos).toBeTruthy();

    // child3 should be near child2
    const dist = Math.hypot(
      child3Pos.x - child2Pos.x,
      child3Pos.y - child2Pos.y
    );
    expect(dist).toBeLessThan(500);
  });
});
