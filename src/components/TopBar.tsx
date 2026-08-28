import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import type { Engine } from "../core/engine/Engine";
import {
  IconClose,
  IconExport,
  IconFit,
  IconGrid,
  IconHelp,
  IconImport,
  IconMoon,
  IconRedo,
  IconSun,
  IconTarget,
  IconUndo,
  IconZoomIn,
  IconZoomOut,
  LogoMark,
} from "./icons";

interface Props {
  engine: React.RefObject<Engine | null>;
  zoom: number;
  onImport: () => void;
  onExport: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onExportMarkdown: () => void;
  onMaps: () => void;
  onCloseMap: () => void;
  onHelp: () => void;
}

export function TopBar({
  engine,
  zoom,
  onImport,
  onExport,
  onExportPNG,
  onExportPDF,
  onExportMarkdown,
  onMaps,
  onCloseMap,
  onHelp,
}: Props) {
  const title = useStore((s) => s.title);
  const hasMap = useStore((s) => s.hasMap);
  const layoutMode = useStore((s) => s.layoutMode);
  const setLayoutMode = useStore((s) => s.setLayoutMode);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const selectedIds = useStore((s) => s.selectedIds);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setTitle = useStore((s) => s.setTitle);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [exportOpen]);

  const startEdit = () => {
    if (!hasMap) return;
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== title) setTitle(t);
  };

  return (
    <header className="topbar">
      <div className="topbar-row topbar-main">
        <div className="logo">
          <LogoMark />
          <span className="logo-name">Mindmap</span>
        </div>

        <div className="map-title">
          {hasMap &&
            (editing ? (
              <input
                key="edit"
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditing(false);
                }}
                autoFocus
              />
            ) : (
              <input
                key="display"
                value={title}
                readOnly
                onFocus={startEdit}
                onClick={startEdit}
                aria-label="Map title"
              />
            ))}
        </div>

        <div className="btn-row topbar-actions">
          <button className="icon-btn" onClick={onMaps} title="Your maps (Ctrl+M)">
            <IconGrid />
          </button>
          <button
            className="icon-btn"
            onClick={onCloseMap}
            disabled={!hasMap}
            title="Close map"
          >
            <IconClose />
          </button>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button className="icon-btn" onClick={onHelp} title="Shortcuts">
            <IconHelp />
          </button>
        </div>
      </div>

      <div className="topbar-row topbar-sub">
        <div className="seg" role="tablist" aria-label="Layout">
          <button
            className={layoutMode === "tree" ? "active" : ""}
            onClick={() => hasMap && setLayoutMode("tree")}
          >
            Tree
          </button>
          <button
            className={layoutMode === "radial" ? "active" : ""}
            onClick={() => hasMap && setLayoutMode("radial")}
          >
            Radial
          </button>
          <button
            className={layoutMode === "force" ? "active" : ""}
            onClick={() => hasMap && setLayoutMode("force")}
          >
            Force
          </button>
        </div>

        <div className="btn-row topbar-edit">
          <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            <IconUndo />
          </button>
          <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
            <IconRedo />
          </button>
          <button
            className="icon-btn tb-hide"
            onClick={() => engine.current?.fitView()}
            disabled={!hasMap}
            title="Fit view (0)"
          >
            <IconFit />
          </button>
          <button
            className="icon-btn tb-hide"
            onClick={() => engine.current?.zoomToSelection(selectedIds)}
            disabled={!hasMap || !selectedIds.length}
            title="Zoom to selection"
          >
            <IconTarget />
          </button>
          <button
            className="icon-btn tb-hide"
            onClick={() => engine.current?.zoomBy(0.8)}
            disabled={!hasMap}
            title="Zoom out (-)"
          >
            <IconZoomOut />
          </button>
          <span className="zoom-label tb-hide">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-btn tb-hide"
            onClick={() => engine.current?.zoomBy(1.25)}
            disabled={!hasMap}
            title="Zoom in (+)"
          >
            <IconZoomIn />
          </button>
          <button className="icon-btn tb-hide" onClick={onImport} title="Import .mind">
            <IconImport />
          </button>
          <div className="export-wrap" ref={exportRef}>
            <button
              className="icon-btn"
              onClick={() => hasMap && setExportOpen((o) => !o)}
              disabled={!hasMap}
              title="Export (Ctrl+S)"
              aria-expanded={exportOpen}
            >
              <IconExport />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => { onExport(); setExportOpen(false); }}>
                  .mind file
                </button>
                <button onClick={() => { onExportPNG(); setExportOpen(false); }}>
                  PNG image
                </button>
                <button onClick={() => { onExportPDF(); setExportOpen(false); }}>
                  PDF
                </button>
                <button onClick={() => { onExportMarkdown(); setExportOpen(false); }}>
                  Markdown
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
