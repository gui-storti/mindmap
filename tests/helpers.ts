import { Page, expect } from "@playwright/test";

export interface MMState {
  hasMap: boolean;
  rootId: string | null;
  nodeIds: string[];
  selectedId: string | null;
  selectedIds: string[];
  editingId: string | null;
  layoutMode: string;
  layoutVersion: number;
  pastLen: number;
  futureLen: number;
  searchQuery: string;
  searchMatches: string[];
  theme: string;
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export async function getState(page: Page): Promise<MMState> {
  return page.evaluate(() => (window as any).__mm.getState());
}

export async function getScreenRect(page: Page, id: string): Promise<ScreenRect | null> {
  return page.evaluate((nodeId) => (window as any).__mm.getScreenRect(nodeId), id);
}

export async function getCamera(page: Page): Promise<Camera | null> {
  return page.evaluate(() => (window as any).__mm.getCamera());
}

export async function getWorldPos(page: Page, id: string) {
  return page.evaluate((nodeId) => (window as any).__mm.getWorldPos(nodeId), id);
}

export async function canvasRect(page: Page) {
  return page.evaluate(() => (window as any).__mm.canvasRect());
}

export async function newMap(page: Page) {
  await page.evaluate(() => (window as any).__mm.newMap());
  await page.waitForTimeout(100);
}

export async function addChild(page: Page, id?: string) {
  await page.evaluate((nodeId) => (window as any).__mm.addChild(nodeId), id);
  await page.waitForTimeout(100);
}

export async function addSibling(page: Page, id: string) {
  await page.evaluate((nodeId) => (window as any).__mm.addSibling(nodeId), id);
  await page.waitForTimeout(100);
}

export async function select(page: Page, id: string | null, additive = false) {
  await page.evaluate(
    ({ nodeId, add }) => (window as any).__mm.select(nodeId, add),
    { nodeId: id, add: additive }
  );
  await page.waitForTimeout(50);
}

export async function selectAll(page: Page) {
  await page.evaluate(() => (window as any).__mm.selectAll());
  await page.waitForTimeout(50);
}

export async function deleteNodes(page: Page, ids: string[]) {
  await page.evaluate((nodeIds) => (window as any).__mm.deleteNodes(nodeIds), ids);
  await page.waitForTimeout(100);
}

export async function setLayoutMode(page: Page, mode: string) {
  await page.evaluate((m) => (window as any).__mm.setLayoutMode(m), mode);
  await page.waitForTimeout(100);
}

export async function undo(page: Page) {
  await page.evaluate(() => (window as any).__mm.undo());
  await page.waitForTimeout(50);
}

export async function redo(page: Page) {
  await page.evaluate(() => (window as any).__mm.redo());
  await page.waitForTimeout(50);
}

export async function moveNode(page: Page, id: string, x: number, y: number) {
  await page.evaluate(({ nodeId, x, y }) => (window as any).__mm.moveNode(nodeId, x, y), {
    nodeId: id,
    x,
    y,
  });
  await page.waitForTimeout(100);
}

export async function exportData(page: Page) {
  return page.evaluate(() => (window as any).__mm.exportData());
}

export async function toMarkdown(page: Page) {
  return page.evaluate(() => (window as any).__mm.toMarkdown());
}

export async function loadMarkdown(page: Page, md: string) {
  await page.evaluate((markdown) => (window as any).__mm.loadMarkdown(markdown), md);
  await page.waitForTimeout(100);
}

export async function toggleTheme(page: Page) {
  await page.evaluate(() => (window as any).__mm.toggleTheme());
  await page.waitForTimeout(100);
}

export async function getTemplates(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as any).__mm.getTemplates());
}

export async function loadTemplate(page: Page, name: string) {
  await page.evaluate((t) => (window as any).__mm.loadTemplate(t), name);
  await page.waitForTimeout(100);
}

export async function getLibrary(page: Page) {
  return page.evaluate(() => (window as any).__mm.getLibrary());
}

export async function openMap(page: Page, id: string) {
  await page.evaluate((mapId) => (window as any).__mm.openMap(mapId), id);
  await page.waitForTimeout(100);
}

export async function closeMap(page: Page) {
  await page.evaluate(() => (window as any).__mm.closeMap());
  await page.waitForTimeout(100);
}

export async function deleteMap(page: Page, id: string) {
  await page.evaluate((mapId) => (window as any).__mm.deleteMap(mapId), id);
  await page.waitForTimeout(100);
}

export async function mapId(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__mm.mapId());
}

export async function zoomToSelection(page: Page, ids: string[]) {
  await page.evaluate((nodeIds) => (window as any).__mm.zoomToSelection(nodeIds), ids);
  await page.waitForTimeout(100);
}

export async function getVisualPos(page: Page, id: string) {
  return page.evaluate((nodeId) => (window as any).__mm.getVisualPos(nodeId), id);
}

/** Click on a node by its ID (dispatches Pointer Events on the canvas) */
export async function clickNode(page: Page, id: string) {
  const rect = await getScreenRect(page, id);
  if (!rect) throw new Error(`Node ${id} not found on screen`);
  const x = rect.x + rect.w / 2;
  const y = rect.y + rect.h / 2;
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Canvas not found");
    const dispatch = (type: string) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          bubbles: true,
          cancelable: true,
        })
      );
    };
    dispatch("pointerdown");
    dispatch("pointerup");
  }, { x, y });
  await page.waitForTimeout(100);
}

/** Drag a node from one screen position to another using Pointer Events */
export async function dragNode(
  page: Page,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps = 10
) {
  await page.evaluate(
    ({ fromX, fromY, toX, toY, steps }) => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("Canvas not found");
      const rect = canvas.getBoundingClientRect();
      const toLocal = (x: number, y: number) => ({
        clientX: x,
        clientY: y,
      });
      const dispatch = (type: string, x: number, y: number) => {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            ...toLocal(x, y),
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            bubbles: true,
            cancelable: true,
          })
        );
      };
      dispatch("pointerdown", fromX, fromY);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;
        dispatch("pointermove", x, y);
      }
      dispatch("pointerup", toX, toY);
    },
    { fromX, fromY, toX, toY, steps }
  );
  await page.waitForTimeout(200);
}

/** Drag a node by ID onto another node by ID */
export async function dragNodeOnto(page: Page, sourceId: string, targetId: string) {
  const srcRect = await getScreenRect(page, sourceId);
  const tgtRect = await getScreenRect(page, targetId);
  if (!srcRect || !tgtRect) throw new Error("Node not found on screen");
  await dragNode(
    page,
    srcRect.x + srcRect.w / 2,
    srcRect.y + srcRect.h / 2,
    tgtRect.x + tgtRect.w / 2,
    tgtRect.y + tgtRect.h / 2
  );
}

/** Double-click on a node by its ID (dispatches Pointer Events on the canvas) */
export async function doubleClickNode(page: Page, id: string) {
  const rect = await getScreenRect(page, id);
  if (!rect) throw new Error(`Node ${id} not found on screen`);
  const x = rect.x + rect.w / 2;
  const y = rect.y + rect.h / 2;
  await page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Canvas not found");
    const dispatch = (type: string) => {
      canvas.dispatchEvent(
        new PointerEvent(type, {
          clientX: x,
          clientY: y,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          bubbles: true,
          cancelable: true,
        })
      );
    };
    dispatch("pointerdown");
    dispatch("pointerup");
    dispatch("pointerdown");
    dispatch("pointerup");
  }, { x, y });
  await page.waitForTimeout(100);
}

/** Wait for the app to be ready (canvas visible) */
export async function waitForApp(page: Page) {
  await page.waitForSelector("canvas");
  await page.waitForTimeout(200);
}

/** Create a new map and wait for it to be ready */
export async function createNewMap(page: Page) {
  await page.evaluate(() => (window as any).__mm.newMap());
  await page.waitForTimeout(300);
  const state = await getState(page);
  expect(state.hasMap).toBe(true);
  return state;
}
