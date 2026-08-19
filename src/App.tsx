import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "./core/engine/Engine";
import { useStore } from "./core/store";
import { exportMapData } from "./core/store";
import { exportMindMap, importMindMap, normalizeMap } from "./core/mindFile";
import { openMindFile, openMarkdownFile, saveMindFile, saveBlob } from "./core/bridge";
import { toMarkdown, fromMarkdown } from "./core/markdown";
import { pushRecent, getRecent, clearRecent } from "./core/recent";
import { TEMPLATES } from "./core/templates";
import { TopBar } from "./components/TopBar";
import { Toolbar } from "./components/Toolbar";
import { Inspector } from "./components/Inspector";
import { NodeEditor } from "./components/NodeEditor";
import { ContextMenu, type CtxPoint } from "./components/ContextMenu";
import { Minimap } from "./components/Minimap";
import { Toasts } from "./components/Toasts";
import { Welcome } from "./components/Welcome";
import { HelpDialog } from "./components/HelpDialog";
import { SearchBar } from "./components/SearchBar";
import { Breadcrumbs } from "./components/Breadcrumbs";

const AUTOSAVE_KEY = "mindmap:autosave";

function loadAutosave(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const { data, images } = JSON.parse(raw);
    const map = normalizeMap(data);
    useStore.getState().loadMap(map, images ?? {});
    return true;
  } catch {
    return false;
  }
}

function saveAutosave() {
  const s = useStore.getState();
  if (!s.hasMap) return;
  try {
    let payload = JSON.stringify({
      data: exportMapData(),
      images: s.images,
    });
    if (payload.length > 4_000_000) {
      payload = JSON.stringify({ data: exportMapData(), images: {} });
    }
    localStorage.setItem(AUTOSAVE_KEY, payload);
    pushRecent(exportMapData());
  } catch {
    /* quota exceeded — ignore */
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const bgDotsRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef(0);
  const lastZoom = useRef(0);
  const lastCam = useRef(0);

  const [ctx, setCtx] = useState<CtxPoint | null>(null);
  const [zoom, setZoom] = useState(1);
  const [camTick, setCamTick] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const hasMap = useStore((s) => s.hasMap);
  const layout = useStore((s) => s.layout);
  const layoutMode = useStore((s) => s.layoutMode);
  const theme = useStore((s) => s.theme);

  // apply theme to <html> so CSS vars + canvas pick it up
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    engineRef.current?.invalidate();
  }, [theme]);

  const doImport = useCallback(async () => {
    const bytes = await openMindFile();
    if (!bytes) return;
    try {
      const { map, images } = await importMindMap(bytes);
      useStore.getState().loadMap(map, images);
      useStore.getState().showToast("Map imported");
      setTimeout(() => engineRef.current?.fitView(), 80);
    } catch (e) {
      useStore
        .getState()
        .showToast(`Import failed: ${(e as Error).message}`);
    }
  }, []);

  const doExport = useCallback(async () => {
    const s = useStore.getState();
    if (!s.hasMap) return;
    try {
      const blob = await exportMindMap(exportMapData(), s.images);
      const name =
        s.title
          .replace(/[^\w\- ]+/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase() || "mindmap";
      await saveMindFile(new Uint8Array(await blob.arrayBuffer()), `${name}.mind`);
      s.showToast("Map exported");
    } catch (e) {
      s.showToast(`Export failed: ${(e as Error).message}`);
    }
  }, []);

  const safeName = () => {
    const s = useStore.getState();
    return (
      s.title
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .toLowerCase() || "mindmap"
    );
  };

  const doExportPNG = useCallback(async () => {
    const s = useStore.getState();
    if (!s.hasMap) return;
    try {
      const blob = await engineRef.current?.exportPNG();
      if (!blob) throw new Error("No engine");
      saveBlob(blob, `${safeName()}.png`);
      s.showToast("PNG exported");
    } catch (e) {
      s.showToast(`PNG export failed: ${(e as Error).message}`);
    }
  }, []);

  const doExportPDF = useCallback(async () => {
    const s = useStore.getState();
    if (!s.hasMap) return;
    try {
      const blob = await engineRef.current?.exportPNG();
      if (!blob) throw new Error("No engine");
      const { jsPDF } = await import("jspdf");
      const url = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("image load failed"));
        img.src = url;
      });
      const pdf = new jsPDF({
        orientation: img.width >= img.height ? "l" : "p",
        unit: "px",
        format: [img.width, img.height],
      });
      pdf.addImage(url, "PNG", 0, 0, img.width, img.height);
      pdf.save(`${safeName()}.pdf`);
      URL.revokeObjectURL(url);
      s.showToast("PDF exported");
    } catch (e) {
      s.showToast(`PDF export failed: ${(e as Error).message}`);
    }
  }, []);

  const doExportMarkdown = useCallback(async () => {
    const s = useStore.getState();
    if (!s.hasMap) return;
    try {
      const md = toMarkdown(exportMapData());
      saveBlob(new Blob([md], { type: "text/markdown" }), `${safeName()}.md`);
      s.showToast("Markdown exported");
    } catch (e) {
      s.showToast(`Markdown export failed: ${(e as Error).message}`);
    }
  }, []);

  const doImportMarkdown = useCallback(async () => {
    const bytes = await openMarkdownFile();
    if (!bytes) return;
    try {
      const text = new TextDecoder().decode(bytes);
      const map = fromMarkdown(text);
      useStore.getState().loadMap(map, {});
      useStore.getState().showToast("Markdown imported");
      setTimeout(() => engineRef.current?.fitView(), 80);
    } catch (e) {
      useStore
        .getState()
        .showToast(`Import failed: ${(e as Error).message}`);
    }
  }, []);

  // restore previous session
  useEffect(() => {
    loadAutosave();
  }, []);

  // engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(
      canvas,
      {
        onSelect: (id, opts) => useStore.getState().select(id, opts),
        onEdit: (id) => useStore.getState().setEditing(id),
        onContextMenu: (id, x, y) => setCtx({ nodeId: id, x, y }),
        onCamera: (cam) => {
          const z = Math.round(cam.z * 100);
          if (z !== lastZoom.current) {
            lastZoom.current = z;
            setZoom(z / 100);
          }
          const now = performance.now();
          if (now - lastCam.current > 80) {
            lastCam.current = now;
            setCamTick((t) => t + 1);
          }
          const el = bgDotsRef.current;
          if (el) {
            const s = 30 * cam.z;
            if (s < 14) {
              el.style.opacity = "0";
            } else {
              el.style.opacity = "1";
              const W = canvas.clientWidth;
              const H = canvas.clientHeight;
              const ox = (((W / 2 - cam.x * cam.z) % s) + s) % s;
              const oy = (((H / 2 - cam.y * cam.z) % s) + s) % s;
              el.style.backgroundSize = `${s}px ${s}px`;
              el.style.backgroundPosition = `${ox}px ${oy}px`;
            }
          }
        },
        onDropReparent: (a, b) => useStore.getState().reparentNode(a, b),
        onNodeMoved: (id, x, y) => useStore.getState().moveNode(id, x, y),
      },
      () => useStore.getState()
    );
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // dev-only test hooks (used by Playwright e2e)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__mm = {
      getState: () => {
        const s = useStore.getState();
        return {
          hasMap: s.hasMap,
          rootId: s.rootId,
          nodeIds: Object.keys(s.nodes),
          selectedId: s.selectedId,
          selectedIds: s.selectedIds,
          editingId: s.editingId,
          layoutMode: s.layoutMode,
          layoutVersion: s.layoutVersion,
          pastLen: s.past.length,
          futureLen: s.future.length,
          searchQuery: s.searchQuery,
          searchMatches: s.searchMatches,
          theme: s.theme,
        };
      },
      getScreenRect: (id: string) => engineRef.current?.getScreenRect(id) ?? null,
      getCamera: () => engineRef.current?.getCamera() ?? null,
      zoomToSelection: (ids: string[]) => engineRef.current?.zoomToSelection(ids),
      getVisualPos: (id: string) => engineRef.current?.getVisualPos(id) ?? null,
      getWorldPos: (id: string) => {
        const s = useStore.getState();
        const p = s.layout?.positions.get(id);
        return p ? { x: p.x, y: p.y } : null;
      },
      canvasRect: () => {
        const c = canvasRef.current;
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      },
      newMap: () => useStore.getState().newMap(),
      addChild: (id?: string) => useStore.getState().addChild(id ?? undefined),
      addSibling: (id: string) => useStore.getState().addSibling(id),
      select: (id: string | null, additive?: boolean) =>
        useStore.getState().select(id, additive ? { additive: true } : undefined),
      selectAll: () => useStore.getState().selectAll(),
      copySelection: () => useStore.getState().copySelection(),
      paste: () => useStore.getState().paste(),
      duplicate: () => useStore.getState().duplicate(),
      deleteNodes: (ids: string[]) => useStore.getState().deleteNodes(ids),
      setLayoutMode: (m: string) =>
        useStore.getState().setLayoutMode(m as "tree" | "radial" | "force"),
      undo: () => useStore.getState().undo(),
      redo: () => useStore.getState().redo(),
      moveNode: (id: string, x: number, y: number) =>
        useStore.getState().moveNode(id, x, y),
      exportData: () => exportMapData(),
      exportPNGInfo: async () => {
        const blob = await engineRef.current?.exportPNG();
        return blob ? { size: blob.size, type: blob.type } : null;
      },
      toMarkdown: () => toMarkdown(exportMapData()),
      loadMarkdown: (md: string) => {
        const map = fromMarkdown(md);
        useStore.getState().loadMap(map, {});
      },
      toggleTheme: () => useStore.getState().toggleTheme(),
      getTemplates: () => TEMPLATES.map((t) => t.name),
      loadTemplate: (name: string) => {
        const t = TEMPLATES.find((x) => x.name === name);
        if (t) useStore.getState().loadMap(t.build());
      },
      getRecent: () =>
        getRecent().map((r) => ({ title: r.title, nodeCount: r.nodeCount })),
      clearRecent: () => clearRecent(),
    };
    return () => {
      delete (window as unknown as Record<string, unknown>).__mm;
    };
  }, []);

  // push layout to engine
  useEffect(() => {
    if (layout) engineRef.current?.setLayout(layout, layoutMode);
  }, [layout, layoutMode]);

  // fit view when a map appears
  useEffect(() => {
    if (!hasMap) return;
    const t = setTimeout(() => engineRef.current?.fitView(false), 60);
    return () => clearTimeout(t);
  }, [hasMap]);

  // autosave
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.dataVersion !== prev.dataVersion && s.hasMap) {
        clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(saveAutosave, 800);
      }
    });
    return () => {
      unsub();
      clearTimeout(saveTimer.current);
    };
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (inField) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doExport();
        return;
      }
      if (!s.hasMap) return;
      const sel = s.selectedId;
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        s.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        if (sel || s.selectedIds.length) s.copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        s.paste();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        s.duplicate();
        return;
      }
      const nav = (dir: "up" | "down" | "left" | "right") => {
        if (!sel) {
          s.select(s.rootId);
          return;
        }
        const n = s.nodes[sel];
        let target: string | null = null;
        if (dir === "up") {
          target = n.parentId;
        } else if (dir === "down") {
          if (!n.collapsed && n.childIds.length) target = n.childIds[0];
          else if (n.parentId) {
            const p = s.nodes[n.parentId];
            const i = p.childIds.indexOf(sel);
            target = i < p.childIds.length - 1 ? p.childIds[i + 1] : null;
          }
        } else if (dir === "left") {
          if (n.parentId) {
            const p = s.nodes[n.parentId];
            const i = p.childIds.indexOf(sel);
            target = i > 0 ? p.childIds[i - 1] : n.parentId;
          }
        } else if (dir === "right") {
          if (n.parentId) {
            const p = s.nodes[n.parentId];
            const i = p.childIds.indexOf(sel);
            target = i < p.childIds.length - 1 ? p.childIds[i + 1] : null;
          }
          if (!target && !n.collapsed && n.childIds.length) {
            target = n.childIds[0];
          }
        }
        if (target) {
          s.select(target);
          engineRef.current?.centerOn(target);
        }
      };
      switch (e.key) {
        case "Tab":
          e.preventDefault();
          s.addChild(sel);
          break;
        case "Enter":
          if (sel) {
            e.preventDefault();
            s.addSibling(sel);
          }
          break;
        case "Delete":
        case "Backspace":
          if (sel) {
            e.preventDefault();
            s.deleteNodes(s.selectedIds.length ? s.selectedIds : [sel]);
          }
          break;
        case "F2":
          if (sel) {
            e.preventDefault();
            s.setEditing(sel);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          nav("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          nav("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          nav("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          nav("right");
          break;
        case "+":
        case "=":
          engineRef.current?.zoomBy(1.25);
          break;
        case "-":
          engineRef.current?.zoomBy(0.8);
          break;
        case "0":
          engineRef.current?.fitView();
          break;
        case "Escape":
          s.select(null);
          setCtx(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doExport]);

  return (
    <div className="app">
      <div className="bg-dots" ref={bgDotsRef} />
      <div className="canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      <TopBar
        engine={engineRef}
        zoom={zoom}
        onImport={doImport}
        onExport={doExport}
        onExportPNG={doExportPNG}
        onExportPDF={doExportPDF}
        onExportMarkdown={doExportMarkdown}
        onHelp={() => setHelpOpen(true)}
      />
      <Toolbar engine={engineRef} />
      {hasMap && <Breadcrumbs engine={engineRef} />}
      <SearchBar
        engine={engineRef}
        open={searchOpen && hasMap}
        onClose={() => {
          setSearchOpen(false);
          useStore.getState().setSearchQuery("");
        }}
      />
      <Inspector />
      <NodeEditor engine={engineRef} />
      {hasMap && <Minimap engine={engineRef} camTick={camTick} />}
      {ctx && (
        <ContextMenu
          ctx={ctx}
          onClose={() => setCtx(null)}
          engine={engineRef}
          onImport={doImport}
          onExport={doExport}
          onExportPNG={doExportPNG}
          onExportPDF={doExportPDF}
          onExportMarkdown={doExportMarkdown}
          onImportMarkdown={doImportMarkdown}
        />
      )}
      <Toasts />
      <Welcome onImport={doImport} />
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
