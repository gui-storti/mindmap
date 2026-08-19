import { useLayoutEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { NODE_COLORS } from "../core/types";
import type { Engine } from "../core/engine/Engine";
import {
  IconChild,
  IconCollapse,
  IconExpand,
  IconExport,
  IconFit,
  IconImport,
  IconImage,
  IconNote,
  IconSibling,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from "./icons";

export interface CtxPoint {
  x: number;
  y: number;
  nodeId: string | null;
}

interface Props {
  ctx: CtxPoint;
  onClose: () => void;
  engine: React.RefObject<Engine | null>;
  onImport: () => void;
  onExport: () => void;
  onExportPNG: () => void;
  onExportPDF: () => void;
  onExportMarkdown: () => void;
  onImportMarkdown: () => void;
}

export function ContextMenu({
  ctx,
  onClose,
  engine,
  onImport,
  onExport,
  onExportPNG,
  onExportPDF,
  onExportMarkdown,
  onImportMarkdown,
}: Props) {
  const nid = ctx.nodeId;
  const node = useStore((s) => (nid ? s.nodes[nid] : null));
  const rootId = useStore((s) => s.rootId);
  const addChild = useStore((s) => s.addChild);
  const addSibling = useStore((s) => s.addSibling);
  const setEditing = useStore((s) => s.setEditing);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const setNodeColor = useStore((s) => s.setNodeColor);
  const setNodeImage = useStore((s) => s.setNodeImage);
  const addImageAsset = useStore((s) => s.addImageAsset);
  const focusAnnForm = useStore((s) => s.focusAnnForm);
  const deleteNode = useStore((s) => s.deleteNode);
  const showToast = useStore((s) => s.showToast);

  const ref = useRef<HTMLDivElement>(null);
  const [adj, setAdj] = useState({ dx: 0, dy: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (r.right > window.innerWidth - 8) dx = window.innerWidth - 8 - r.right;
    if (r.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - r.bottom;
    setAdj({ dx, dy });
  }, [ctx]);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const pickImage = async (f: File | null) => {
    if (!f || !ctx.nodeId) return;
    const id = await addImageAsset(f);
    setNodeImage(ctx.nodeId, id);
    showToast("Image attached");
    onClose();
  };

  const isRoot = nid === rootId;

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 45 }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: ctx.x + adj.dx, top: ctx.y + adj.dy }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {nid && node ? (
          <>
            <button className="ctx-item" onClick={run(() => addChild(nid))}>
              <IconChild />
              Add child
              <span className="kbd">Tab</span>
            </button>
            <button className="ctx-item" onClick={run(() => addSibling(nid))}>
              <IconSibling />
              Add sibling
              <span className="kbd">Enter</span>
            </button>
            <button
              className="ctx-item"
              onClick={run(() => setEditing(nid))}
            >
              <IconNote />
              Rename
              <span className="kbd">F2</span>
            </button>
            {node.childIds.length > 0 && (
              <button
                className="ctx-item"
                onClick={run(() => toggleCollapse(nid))}
              >
                {node.collapsed ? <IconExpand /> : <IconCollapse />}
                {node.collapsed ? "Expand" : "Collapse"}
              </button>
            )}
            <div className="ctx-sep" />
            <div className="ctx-swatches">
              {NODE_COLORS.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  style={{
                    background: c,
                    outline: node.color === c ? "2px solid #fff" : "none",
                    outlineOffset: 2,
                  }}
                  onClick={() => setNodeColor(nid, c)}
                />
              ))}
            </div>
            <div className="ctx-sep" />
            <button className="ctx-item" onClick={() => fileRef.current?.click()}>
              <IconImage />
              Attach image
            </button>
            <button
              className="ctx-item"
              onClick={run(() => focusAnnForm())}
            >
              <IconNote />
              Add note
            </button>
            {!isRoot && (
              <button
                className="ctx-item danger"
                onClick={run(() => deleteNode(nid))}
              >
                <IconTrash />
                Delete
                <span className="kbd">Del</span>
              </button>
            )}
          </>
        ) : (
          <>
            <button
              className="ctx-item"
              onClick={run(() => addChild(useStore.getState().selectedId ?? rootId))}
            >
              <IconChild />
              Add idea
            </button>
            <button className="ctx-item" onClick={run(() => engine.current?.fitView())}>
              <IconFit />
              Fit view
              <span className="kbd">0</span>
            </button>
            <button
              className="ctx-item"
              onClick={run(() => engine.current?.zoomBy(1.25))}
            >
              <IconZoomIn />
              Zoom in
            </button>
            <button
              className="ctx-item"
              onClick={run(() => engine.current?.zoomBy(0.8))}
            >
              <IconZoomOut />
              Zoom out
            </button>
            <div className="ctx-sep" />
            <button className="ctx-item" onClick={run(onImport)}>
              <IconImport />
              Import .mind
            </button>
            <button className="ctx-item" onClick={run(onImportMarkdown)}>
              <IconImport />
              Import Markdown
            </button>
            <div className="ctx-sep" />
            <button className="ctx-item" onClick={run(onExport)}>
              <IconExport />
              Export .mind
              <span className="kbd">Ctrl+S</span>
            </button>
            <button className="ctx-item" onClick={run(onExportPNG)}>
              <IconExport />
              Export PNG
            </button>
            <button className="ctx-item" onClick={run(onExportPDF)}>
              <IconExport />
              Export PDF
            </button>
            <button className="ctx-item" onClick={run(onExportMarkdown)}>
              <IconExport />
              Export Markdown
            </button>
          </>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pickImage(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </>
  );
}
