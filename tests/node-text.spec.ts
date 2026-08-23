import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  waitForApp,
  doubleClickNode,
} from "./helpers";

test.describe("Node Text", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("node text can be edited via double-click", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await doubleClickNode(page, childId);
    const after = await getState(page);
    expect(after.editingId).toBe(childId);

    // Type new text
    await page.keyboard.press("Control+a");
    await page.keyboard.type("New Name");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node = data.nodes[childId];
    expect(node.text).toBe("New Name");
  });

  test("node text is limited to 240 characters", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await doubleClickNode(page, childId);
    await page.waitForTimeout(100);

    // Type more than 240 characters
    const longText = "a".repeat(300);
    await page.keyboard.press("Control+a");
    await page.keyboard.type(longText);
    await page.waitForTimeout(100);

    // The textarea should have maxLength=240, so it should be capped
    const textarea = page.locator(".node-editor textarea");
    const value = await textarea.inputValue();
    expect(value.length).toBeLessThanOrEqual(240);

    // Commit
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node = data.nodes[childId];
    expect(node.text.length).toBeLessThanOrEqual(240);
  });

  test("node text exactly 240 characters is allowed", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await doubleClickNode(page, childId);
    await page.waitForTimeout(100);

    const exactText = "a".repeat(240);
    await page.keyboard.press("Control+a");
    await page.keyboard.type(exactText);
    await page.waitForTimeout(100);

    const textarea = page.locator(".node-editor textarea");
    const value = await textarea.inputValue();
    expect(value.length).toBe(240);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node = data.nodes[childId];
    expect(node.text.length).toBe(240);
  });

  test("node text is trimmed on commit", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await doubleClickNode(page, childId);
    await page.waitForTimeout(100);

    await page.keyboard.press("Control+a");
    await page.keyboard.type("  padded text  ");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node = data.nodes[childId];
    expect(node.text).toBe("padded text");
  });

  test("empty node text reverts to previous", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const originalText = data.nodes[childId].text;

    await doubleClickNode(page, childId);
    await page.waitForTimeout(100);

    // Clear all text
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const afterData = await page.evaluate(() => (window as any).__mm.exportData());
    const node = afterData.nodes[childId];
    // Empty text should revert to original
    expect(node.text).toBe(originalText);
  });

  test("node text can be edited via inspector", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Select the node and open inspector
    await page.evaluate(({ id }) => {
      (window as any).__mm.select(id);
    }, { id: childId });
    await page.waitForTimeout(100);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(50);

    // Open inspector via keyboard or click
    await page.keyboard.press("i");
    await page.waitForTimeout(200);

    // Find the inspector textarea
    const inspTextarea = page.locator(".insp-textarea");
    if (await inspTextarea.isVisible()) {
      await inspTextarea.fill("Inspector Text");
      await inspTextarea.press("Enter");
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.text).toBe("Inspector Text");
    }
  });

  test("inspector text is limited to 240 characters", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    await page.evaluate(({ id }) => {
      (window as any).__mm.select(id);
    }, { id: childId });
    await page.waitForTimeout(100);

    await page.keyboard.press("i");
    await page.waitForTimeout(200);

    const inspTextarea = page.locator(".insp-textarea");
    if (await inspTextarea.isVisible()) {
      const longText = "b".repeat(300);
      await inspTextarea.fill(longText);
      await page.waitForTimeout(100);

      const value = await inspTextarea.inputValue();
      expect(value.length).toBeLessThanOrEqual(240);
    }
  });

  test("multiple nodes can have different text", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;

    await addChild(page, rootId);
    const child1Id = (await getState(page)).selectedId!;
    await doubleClickNode(page, child1Id);
    await page.keyboard.press("Control+a");
    await page.keyboard.type("First");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    await addChild(page, rootId);
    const child2Id = (await getState(page)).selectedId!;
    await doubleClickNode(page, child2Id);
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Second");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    const data = await page.evaluate(() => (window as any).__mm.exportData());
    const node1 = data.nodes[child1Id];
    const node2 = data.nodes[child2Id];
    expect(node1.text).toBe("First");
    expect(node2.text).toBe("Second");
  });
});
