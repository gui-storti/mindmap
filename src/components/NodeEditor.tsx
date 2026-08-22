import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import type { Engine } from "../core/engine/Engine";

interface Props {
  engine: React.RefObject<Engine | null>;
}

export function NodeEditor({ engine }: Props) {
  const editingId = useStore((s) => s.editingId);
  const node = useStore((s) => (s.editingId ? s.nodes[s.editingId] : null));
  const renameNode = useStore((s) => s.renameNode);
  const setEditing = useStore((s) => s.setEditing);

  const [text, setText] = useState(node?.text ?? "");
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const didFocus = useRef(false);

  useEffect(() => {
    didFocus.current = false;
    setText(node?.text ?? "");
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    let raf = 0;
    const update = () => {
      const e = engine.current;
      if (e) {
        const r = e.getScreenRect(editingId);
        if (r) setPos({ x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, h: r.h });
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [editingId, engine]);

  useEffect(() => {
    if (didFocus.current) return;
    if (taRef.current) {
      taRef.current.focus();
      taRef.current.select();
      didFocus.current = true;
    }
  }, [editingId, pos]);

  if (!editingId || !node || !pos) return null;

  const commit = () => {
    const t = text.trim().slice(0, 240);
    if (t) renameNode(editingId, t);
    setEditing(null);
  };

  return (
    <div
      className="node-editor"
      style={{
        left: pos.x,
        top: pos.y,
        width: Math.max(pos.w, 120),
        height: Math.max(pos.h, 34),
      }}
    >
      <textarea
        ref={taRef}
        value={text}
        maxLength={240}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setEditing(null);
          }
        }}
      />
    </div>
  );
}
