import { useRef, useState } from "react";
import { useStore } from "../core/store";
import { NODE_COLORS } from "../core/types";
import type { Engine } from "../core/engine/Engine";
import {
  IconChild,
  IconImage,
  IconNote,
  IconPalette,
  IconSibling,
  IconTrash,
  IconFit,
} from "./icons";

interface Props {
  engine: React.RefObject<Engine | null>;
}

export function Toolbar({ engine }: Props) {
  const hasMap = useStore((s) => s.hasMap);
  const selectedId = useStore((s) => s.selectedId);
  const selectedIds = useStore((s) => s.selectedIds);
  const node = useStore((s) => (s.selectedId ? s.nodes[s.selectedId] : null));
  const addChild = useStore((s) => s.addChild);
  const addSibling = useStore((s) => s.addSibling);
  const deleteNodes = useStore((s) => s.deleteNodes);
  const setNodesColor = useStore((s) => s.setNodesColor);
  const setNodeImage = useStore((s) => s.setNodeImage);
  const addImageAsset = useStore((s) => s.addImageAsset);
  const focusAnnForm = useStore((s) => s.focusAnnForm);
  const showToast = useStore((s) => s.showToast);

  const [colorOpen, setColorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!hasMap) return null;

  const sel = selectedId;

  const pickImage = async (f: File | null) => {
    if (!f || !sel) return;
    const id = await addImageAsset(f);
    setNodeImage(sel, id);
    showToast("Image attached");
  };

  return (
    <>
      <nav className="toolbar" aria-label="Actions">
        <button
          className="icon-btn"
          title="Add child (Tab)"
          onClick={() => sel && addChild(sel)}
        >
          <IconChild />
        </button>
        <button
          className="icon-btn"
          title="Add sibling (Enter)"
          onClick={() => sel && addSibling(sel)}
        >
          <IconSibling />
        </button>
        <div className="sep" />
        <button
          className="icon-btn"
          title="Attach image"
          onClick={() => fileRef.current?.click()}
          disabled={!sel}
        >
          <IconImage />
        </button>
        <button
          className="icon-btn"
          title="Add note"
          onClick={() => sel && focusAnnForm()}
          disabled={!sel}
        >
          <IconNote />
        </button>
        <div className="sep" />
        <div style={{ position: "relative" }}>
          <button
            className="icon-btn"
            title="Color"
            onClick={() => sel && setColorOpen((v) => !v)}
            disabled={!sel}
            style={
              node
                ? {
                    background: `linear-gradient(135deg, ${node.color}55, transparent)`,
                  }
                : undefined
            }
          >
            <IconPalette />
          </button>
          {colorOpen && sel && (
            <div className="color-pop">
              {NODE_COLORS.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  style={{ background: c, borderColor: node?.color === c ? "#fff" : "transparent" }}
                  onClick={() => {
                    setNodesColor(selectedIds.length ? selectedIds : [sel], c);
                    setColorOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="sep" />
        <button
          className="icon-btn"
          title="Delete (Del)"
          onClick={() => sel && deleteNodes(selectedIds.length ? selectedIds : [sel])}
          disabled={!sel}
        >
          <IconTrash />
        </button>
        <button
          className="icon-btn"
          title="Fit view (0)"
          onClick={() => engine.current?.fitView()}
        >
          <IconFit />
        </button>
      </nav>
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
