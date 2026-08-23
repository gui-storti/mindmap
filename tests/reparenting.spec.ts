import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  select,
  waitForApp,
  getScreenRect,
  dragNodeOnto,
} from "./helpers";

test.describe("Reparenting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("node can be reparented via drag and drop", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    // Create a tree: root -> child1, child2
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Verify initial structure
    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const child1 = data.nodes[child1Id];
    const child2 = data.nodes[child2Id];
    expect(child1.parentId).toBe(rootId);
    expect(child2.parentId).toBe(rootId);

    // Drag child2 onto child1 to reparent
    await dragNodeOnto(page, child2Id, child1Id);

    const afterData = await page.evaluate(() => (window as any).__mm.exportData());
    const child2After = afterData.nodes[child2Id];
    // child2 should now be a child of child1
    expect(child2After.parentId).toBe(child1Id);
  });

  test("reparenting updates node hierarchy", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Reparent child2 under child1
    await dragNodeOnto(page, child2Id, child1Id);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const child1 = data.nodes[child1Id];
    expect(child1.childIds).toContain(child2Id);
  });

  test("reparenting can be undone", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Reparent child2 under child1
    await dragNodeOnto(page, child2Id, child1Id);

    // Verify reparented
    let data = await page.evaluate(() => (window as any).__mm.exportData());
    let child2 = data.nodes[child2Id];
    expect(child2.parentId).toBe(child1Id);

    // Undo
    await page.evaluate(() => (window as any).__mm.undo());
    await page.waitForTimeout(200);

    data = await page.evaluate(() => (window as any).__mm.exportData());
    child2 = data.nodes[child2Id];
    expect(child2.parentId).toBe(rootId);
  });

  test("cannot reparent a node onto itself", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Try to drag node onto itself (small movement)
    const rect = await getScreenRect(page, childId);
    if (rect) {
      await page.evaluate(
        ({ x, y }) => {
          const canvas = document.querySelector("canvas");
          if (!canvas) return;
          const dispatch = (type: string, cx: number, cy: number) => {
            canvas.dispatchEvent(
              new PointerEvent(type, {
                clientX: cx,
                clientY: cy,
                pointerId: 1,
                pointerType: "mouse",
                isPrimary: true,
                bubbles: true,
                cancelable: true,
              })
            );
          };
          dispatch("pointerdown", x, y);
          dispatch("pointermove", x + 5, y + 5);
          dispatch("pointerup", x + 5, y + 5);
        },
        { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
      );
      await page.waitForTimeout(200);
    }

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node = data.nodes[childId];
    // Should still be a child of root
    expect(node.parentId).toBe(rootId);
  });

  test("cannot reparent root node", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Try to drag root onto child
    await dragNodeOnto(page, rootId, childId);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const root = data.nodes[rootId];
    // Root should still have no parent
    expect(root.parentId).toBeNull();
  });

  test("reparenting preserves node text and annotations", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;

    // Set text on child2
    await page.evaluate(({ id, text }) => {
      (window as any).__mm.renameNode(id, text);
    }, { id: child2Id, text: "Important Node" });
    await page.waitForTimeout(100);

    // Reparent child2 under child1
    await dragNodeOnto(page, child2Id, child1Id);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const child2 = data.nodes[child2Id];
    expect(child2.text).toBe("Important Node");
    expect(child2.parentId).toBe(child1Id);
  });

  test("reparenting with multiple children", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    // Create: root -> child1, child2, child3
    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;
    await addChild(page, rootId);
    const child3Id = (await getState(page)).selectedId!;

    // Reparent child3 under child1
    await dragNodeOnto(page, child3Id, child1Id);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const child1 = data.nodes[child1Id];
    const child3 = data.nodes[child3Id];
    expect(child1.childIds).toContain(child3Id);
    expect(child3.parentId).toBe(child1Id);
  });
});
