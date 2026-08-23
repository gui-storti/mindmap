import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import { HIGHLIGHT_COLORS, NODE_COLORS } from "../core/types";
import { IconClose, IconImage, IconNote, IconTrash } from "./icons";

export function Inspector() {
  const hasMap = useStore((s) => s.hasMap);
  const inspectorOpen = useStore((s) => s.inspectorOpen);
  const node = useStore((s) => (s.selectedId ? s.nodes[s.selectedId] : null));
  const images = useStore((s) => s.images);
  const rootId = useStore((s) => s.rootId);
  const annFocusSignal = useStore((s) => s.annFocusSignal);

  const renameNode = useStore((s) => s.renameNode);
  const setNodeColor = useStore((s) => s.setNodeColor);
  const setNodeImage = useStore((s) => s.setNodeImage);
  const addImageAsset = useStore((s) => s.addImageAsset);
  const addAnnotation = useStore((s) => s.addAnnotation);
  const removeAnnotation = useStore((s) => s.removeAnnotation);
  const toggleCollapse = useStore((s) => s.toggleCollapse);
  const deleteNode = useStore((s) => s.deleteNode);
  const setInspector = useStore((s) => s.setInspector);

  const [text, setText] = useState(node?.text ?? "");
  const [annKind, setAnnKind] = useState<"note" | "highlight">("note");
  const [annColor, setAnnColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  const [annText, setAnnText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const annRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(node?.text ?? "");
  }, [node?.id, node?.text]);

  useEffect(() => {
    if (annFocusSignal > 0) {
      setAnnKind("note");
      annRef.current?.focus();
    }
  }, [annFocusSignal]);

  if (!hasMap || !inspectorOpen || !node) return null;

  const isRoot = node.id === rootId;
  const img = node.imageId ? images[node.imageId] : null;

  const commitText = () => {
    const t = text.trim().slice(0, 240);
    if (t && t !== node.text) renameNode(node.id, t);
    else setText(node.text);
  };

  const pickImage = async (f: File | null) => {
    if (!f) return;
    const id = await addImageAsset(f);
    setNodeImage(node.id, id);
  };

  const submitAnn = () => {
    const t = annText.trim().slice(0, 1000);
    if (!t) return;
    addAnnotation(node.id, annKind, t, annColor);
    setAnnText("");
  };

  return (
    <aside className="inspector">
      <div className="inspector-inner">
        <section className="insp-section">
          <span className="insp-label">Text</span>
          <textarea
            className="insp-textarea"
            value={text}
            maxLength={240}
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
          />
        </section>

        <section className="insp-section">
          <span className="insp-label">Color</span>
          <div className="swatches">
            {NODE_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${node.color === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => setNodeColor(node.id, c)}
              />
            ))}
          </div>
        </section>

        <section className="insp-section">
          <span className="insp-label">Image</span>
          {img ? (
            <div className="img-preview">
              <img src={img.url} alt="" />
              <button
                className="img-remove"
                title="Remove image"
                onClick={() => setNodeImage(node.id, null)}
              >
                <IconClose />
              </button>
            </div>
          ) : (
            <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
              <IconImage />
              Attach image
            </button>
          )}
          {img && (
            <button className="ghost-btn" onClick={() => fileRef.current?.click()}>
              <IconImage />
              Replace image
            </button>
          )}
        </section>

        <section className="insp-section">
          <span className="insp-label">Annotations</span>
          <div className="ann-list">
            {node.annotations.map((a) => (
              <div key={a.id} className="ann-item">
                <span className="ann-dot" style={{ background: a.color }} />
                <div className="ann-body">
                  <span className="ann-kind">{a.kind}</span>
                  {a.text && <div className="ann-text">{a.text}</div>}
                </div>
                <button
                  className="ann-remove"
                  onClick={() => removeAnnotation(node.id, a.id)}
                >
                  <IconClose />
                </button>
              </div>
            ))}
            {node.annotations.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>
                No annotations yet
              </div>
            )}
          </div>
          <div className="ann-form">
            <textarea
              ref={annRef}
              placeholder="Add a note…"
              value={annText}
              maxLength={1000}
              onChange={(e) => setAnnText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnn();
                }
              }}
            />
            <div className="ann-form-row">
              <button
                className="mini-btn"
                style={
                  annKind === "note"
                    ? { color: "#fff", borderColor: "rgba(139,124,255,0.6)" }
                    : undefined
                }
                onClick={() => setAnnKind(annKind === "note" ? "highlight" : "note")}
              >
                <IconNote style={{ width: 13, height: 13 }} />
              </button>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                {annKind === "note" ? "Note" : "Highlight"}
              </span>
              <span className="spacer" />
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  style={{
                    background: c,
                    outline: annColor === c ? "2px solid #fff" : "none",
                    outlineOffset: 2,
                  }}
                  onClick={() => setAnnColor(c)}
                />
              ))}
              <button className="mini-btn primary" onClick={submitAnn}>
                Add
              </button>
            </div>
          </div>
        </section>

        {node.childIds.length > 0 && (
          <section className="insp-section">
            <button
              className="ghost-btn"
              onClick={() => toggleCollapse(node.id)}
            >
              {node.collapsed ? "Expand children" : "Collapse children"}
            </button>
          </section>
        )}

        {!isRoot && (
          <section className="insp-section">
            <button className="danger-btn" onClick={() => deleteNode(node.id)}>
              <IconTrash />
              Delete node
            </button>
          </section>
        )}

        <button
          className="ghost-btn"
          style={{ marginTop: "auto" }}
          onClick={() => setInspector(false)}
        >
          Close
        </button>
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
    </aside>
  );
}
