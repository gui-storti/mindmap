import { test, expect } from "@playwright/test";
import {
  getState,
  createNewMap,
  getCamera,
  waitForApp,
} from "./helpers";

test.describe("Zoom", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("zoom in increases camera zoom", async ({ page }) => {
    await createNewMap(page);
    const before = await getCamera(page);
    expect(before).toBeTruthy();

    // Click zoom in button
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(200);

    const after = await getCamera(page);
    expect(after!.z).toBeGreaterThan(before!.z);
  });

  test("zoom out decreases camera zoom", async ({ page }) => {
    await createNewMap(page);
    const before = await getCamera(page);
    expect(before).toBeTruthy();

    // Click zoom out button
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.waitForTimeout(200);

    const after = await getCamera(page);
    expect(after!.z).toBeLessThan(before!.z);
  });

  test("zoom label displays percentage", async ({ page }) => {
    await createNewMap(page);
    const label = page.locator(".zoom-label");
    await expect(label).toBeVisible();
    const text = await label.textContent();
    expect(text).toMatch(/\d+%/);
  });

  test("zoom label updates after zoom in", async ({ page }) => {
    await createNewMap(page);
    const label = page.locator(".zoom-label");
    const before = await label.textContent();

    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(200);

    const after = await label.textContent();
    expect(after).not.toBe(before);
  });

  test("zoom label updates after zoom out", async ({ page }) => {
    await createNewMap(page);
    const label = page.locator(".zoom-label");
    const before = await label.textContent();

    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.waitForTimeout(200);

    const after = await label.textContent();
    expect(after).not.toBe(before);
  });

  test("fit view resets zoom", async ({ page }) => {
    await createNewMap(page);
    // Zoom in a few times
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.getByRole("button", { name: "Zoom in" }).click();
    await page.waitForTimeout(200);

    // Fit view
    await page.getByRole("button", { name: "Fit view" }).first().click();
    await page.waitForTimeout(300);

    const cam = await getCamera(page);
    expect(cam).toBeTruthy();
    // After fit, zoom should be reasonable (not extreme)
    expect(cam!.z).toBeGreaterThan(0.1);
    expect(cam!.z).toBeLessThan(5);
  });

  test("zoom label is aligned with zoom buttons", async ({ page }) => {
    await createNewMap(page);
    const label = page.locator(".zoom-label");
    const labelBox = await label.boundingBox();
    expect(labelBox).toBeTruthy();

    // The zoom label should be in the top bar area
    expect(labelBox!.y).toBeLessThan(50);
    expect(labelBox!.height).toBeGreaterThan(0);
    expect(labelBox!.width).toBeGreaterThan(0);
  });

  test("zoom in/out buttons are visible", async ({ page }) => {
    await createNewMap(page);
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
  });

  test("zoom via keyboard plus key", async ({ page }) => {
    await createNewMap(page);
    const before = await getCamera(page);

    await page.keyboard.press("=");
    await page.waitForTimeout(200);

    const after = await getCamera(page);
    expect(after!.z).toBeGreaterThan(before!.z);
  });

  test("zoom via keyboard minus key", async ({ page }) => {
    await createNewMap(page);
    const before = await getCamera(page);

    await page.keyboard.press("-");
    await page.waitForTimeout(200);

    const after = await getCamera(page);
    expect(after!.z).toBeLessThan(before!.z);
  });

  test("zoom via keyboard 0 fits view", async ({ page }) => {
    await createNewMap(page);
    // Zoom in first
    await page.keyboard.press("=");
    await page.waitForTimeout(100);

    // Fit view
    await page.keyboard.press("0");
    await page.waitForTimeout(300);

    const cam = await getCamera(page);
    expect(cam).toBeTruthy();
  });
});
