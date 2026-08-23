import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  addSibling,
  select,
  selectAll,
  deleteNodes,
  undo,
  redo,
  exportData,
  toMarkdown,
  loadMarkdown,
  toggleTheme,
  getTemplates,
  loadTemplate,
  getLibrary,
  closeMap,
  mapId,
  waitForApp,
  clickNode,
  doubleClickNode,
} from "./helpers";

test.describe("App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("loads and shows welcome screen", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Mindmap");
    const state = await getState(page);
    expect(state.hasMap).toBe(false);
  });

  test("creates a new map via button", async ({ page }) => {
    await page.getByRole("button", { name: "New map" }).click();
    await page.waitForTimeout(300);
    const state = await getState(page);
    expect(state.hasMap).toBe(true);
    expect(state.nodeIds.length).toBeGreaterThan(0);
    expect(state.rootId).toBeTruthy();
  });

  test("creates a new map via test hook", async ({ page }) => {
    const state = await createNewMap(page);
    expect(state.hasMap).toBe(true);
    expect(state.rootId).toBeTruthy();
    expect(state.nodeIds.length).toBeGreaterThanOrEqual(1);
  });

  test("adds child nodes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    const before = state.nodeIds.length;

    await addChild(page, rootId);
    const after = await getState(page);
    expect(after.nodeIds.length).toBe(before + 1);
    expect(after.selectedId).toBeTruthy();
  });

  test("adds sibling nodes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await addSibling(page, childId);
    const after = await getState(page);
    expect(after.nodeIds.length).toBe(state.nodeIds.length + 2);
  });

  test("selects a node", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await select(page, childId);
    const after = await getState(page);
    expect(after.selectedId).toBe(childId);
  });

  test("selects all nodes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    await addChild(page, rootId);

    await selectAll(page);
    const after = await getState(page);
    expect(after.selectedIds.length).toBe(after.nodeIds.length);
  });

  test("deletes nodes", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await deleteNodes(page, [childId]);
    const after = await getState(page);
    expect(after.nodeIds).not.toContain(childId);
  });

  test("undo and redo", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    const before = state.nodeIds.length;

    await addChild(page, rootId);
    const afterAdd = await getState(page);
    expect(afterAdd.nodeIds.length).toBe(before + 1);

    await undo(page);
    const afterUndo = await getState(page);
    expect(afterUndo.nodeIds.length).toBe(before);

    await redo(page);
    const afterRedo = await getState(page);
    expect(afterRedo.nodeIds.length).toBe(before + 1);
  });

  test("exports map data", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);

    const data = await exportData(page);
    expect(data).toBeTruthy();
    expect(data.nodes).toBeDefined();
    expect(Object.keys(data.nodes).length).toBeGreaterThan(0);
  });

  test("converts to markdown", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);

    const md = await toMarkdown(page);
    expect(md).toBeTruthy();
    expect(typeof md).toBe("string");
  });

  test("loads markdown", async ({ page }) => {
    await createNewMap(page);
    await loadMarkdown(page, "# Title\n- Item 1\n- Item 2");
    const state = await getState(page);
    expect(state.hasMap).toBe(true);
    expect(state.nodeIds.length).toBeGreaterThan(0);
  });

  test("toggles theme", async ({ page }) => {
    await createNewMap(page);
    const before = await getState(page);
    await toggleTheme(page);
    const after = await getState(page);
    expect(after.theme).not.toBe(before.theme);
  });

  test("gets templates", async ({ page }) => {
    const templates = await getTemplates(page);
    expect(Array.isArray(templates)).toBe(true);
  });

  test("loads a template", async ({ page }) => {
    const templates = await getTemplates(page);
    if (templates.length > 0) {
      await loadTemplate(page, templates[0]);
      const state = await getState(page);
      expect(state.hasMap).toBe(true);
    }
  });

  test("gets library", async ({ page }) => {
    const lib = await getLibrary(page);
    expect(Array.isArray(lib)).toBe(true);
  });

  test("closes map", async ({ page }) => {
    await createNewMap(page);
    await closeMap(page);
    const state = await getState(page);
    expect(state.hasMap).toBe(false);
  });

  test("map id is set after creating map", async ({ page }) => {
    await createNewMap(page);
    const id = await mapId(page);
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  test("clicks a node on canvas to select it", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Deselect first
    await select(page, null);
    const deselected = await getState(page);
    expect(deselected.selectedId).toBeNull();

    // Click on the child node
    await clickNode(page, childId);
    const after = await getState(page);
    expect(after.selectedId).toBe(childId);
  });

  test("double-clicks a node to edit it", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await doubleClickNode(page, childId);
    const after = await getState(page);
    expect(after.editingId).toBe(childId);
  });

  test("keyboard shortcut Tab adds child", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    const before = state.nodeIds.length;

    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    const after = await getState(page);
    expect(after.nodeIds.length).toBe(before + 1);
  });

  test("keyboard shortcut Enter adds sibling", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;
    const before = (await getState(page)).nodeIds.length;

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const after = await getState(page);
    expect(after.nodeIds.length).toBe(before + 1);
  });

  test("keyboard shortcut Delete removes node", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;
    const before = (await getState(page)).nodeIds.length;

    await page.waitForTimeout(100);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);
    await page.keyboard.press("Delete");
    await page.waitForTimeout(200);
    const after = await getState(page);
    expect(after.nodeIds.length).toBe(before - 1);
  });

  test("layout mode changes", async ({ page }) => {
    const state = await createNewMap(page);
    expect(state.layoutMode).toBe("tree");

    await page.evaluate(() => (window as any).__mm.setLayoutMode("force"));
    await page.waitForTimeout(100);
    const after = await getState(page);
    expect(after.layoutMode).toBe("force");
  });

  test("search functionality", async ({ page }) => {
    await createNewMap(page);
    const rootId = (await getState(page)).rootId!;
    await addChild(page, rootId);

    await page.waitForTimeout(100);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

    // Use the search via keyboard shortcut
    await page.keyboard.press("Control+f");
    await page.waitForTimeout(200);

    // Type a search query
    await page.keyboard.type("test");
    await page.waitForTimeout(200);

    const state = await getState(page);
    expect(state.searchQuery).toBe("test");
  });
});
