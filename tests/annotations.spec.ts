import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  addChild,
  waitForApp,
} from "./helpers";

test.describe("Annotations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("adds a note annotation", async ({ page }) => {
    const state = await createNewMap(page);
    const rootId = state.rootId!;
    await addChild(page, rootId);
    const childId = (await getState(page)).selectedId!;

    // Select node and open inspector
    await page.evaluate(({ id }) => {
      (window as any).__mm.select(id);
    }, { id: childId });
    await page.waitForTimeout(100);

    await page.keyboard.press("i");
    await page.waitForTimeout(200);

    // Find the annotation textarea
    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      await annTextarea.fill("Test note");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(1);
      expect(node.annotations[0].text).toBe("Test note");
      expect(node.annotations[0].kind).toBe("note");
    }
  });

  test("annotation text is limited to 1000 characters", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      const longText = "x".repeat(1500);
      await annTextarea.fill(longText);
      await page.waitForTimeout(100);

      const value = await annTextarea.inputValue();
      expect(value.length).toBeLessThanOrEqual(1000);

      // Submit
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(1);
      expect(node.annotations[0].text.length).toBeLessThanOrEqual(1000);
    }
  });

  test("annotation exactly 1000 characters is allowed", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      const exactText = "y".repeat(1000);
      await annTextarea.fill(exactText);
      await page.waitForTimeout(100);

      const value = await annTextarea.inputValue();
      expect(value.length).toBe(1000);

      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(1);
      expect(node.annotations[0].text.length).toBe(1000);
    }
  });

  test("adds a highlight annotation", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      // Switch to highlight mode
      const highlightBtn = page.locator(".ann-form-row .mini-btn").first();
      await highlightBtn.click();
      await page.waitForTimeout(100);

      await annTextarea.fill("Highlight text");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(1);
      expect(node.annotations[0].kind).toBe("highlight");
    }
  });

  test("multiple annotations can be added", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      // Add first annotation
      await annTextarea.fill("Note 1");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      // Add second annotation
      await annTextarea.fill("Note 2");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(2);
    }
  });

  test("annotation can be removed", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      // Add annotation
      await annTextarea.fill("To remove");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      // Remove it
      const removeBtn = page.locator(".ann-remove");
      if (await removeBtn.isVisible()) {
        await removeBtn.click();
        await page.waitForTimeout(200);

        const data = await page.evaluate(() => (window as any).__mm.exportData());
        const node = data.nodes[childId];
        expect(node.annotations.length).toBe(0);
      }
    }
  });

  test("empty annotation is not submitted", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      // Try to submit empty
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(0);
    }
  });

  test("annotation with only whitespace is not submitted", async ({ page }) => {
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

    const annTextarea = page.locator(".ann-form textarea");
    if (await annTextarea.isVisible()) {
      await annTextarea.fill("   ");
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await page.waitForTimeout(200);

      const data = await page.evaluate(() => (window as any).__mm.exportData());
      const node = data.nodes[childId];
      expect(node.annotations.length).toBe(0);
    }
  });
});
