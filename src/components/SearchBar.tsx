import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store";
import type { Engine } from "../core/engine/Engine";
import { IconClose, IconNext, IconPrev } from "./icons";

interface Props {
  engine: React.RefObject<Engine | null>;
  open: boolean;
  onClose: () => void;
}

export function SearchBar({ engine, open, onClose }: Props) {
  const searchQuery = useStore((s) => s.searchQuery);
  const searchMatches = useStore((s) => s.searchMatches);
  const setSearchQuery = useStore((s) => s.setSearchQuery);
  const select = useStore((s) => s.select);

  const [matchIndex, setMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // focus input when opened
  useEffect(() => {
    if (open) {
      setMatchIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // reset to first match when the query changes
  useEffect(() => {
    setMatchIndex(0);
    if (open && searchMatches.length) {
      const first = searchMatches[0];
      select(first);
      engine.current?.centerOn(first);
    }
  }, [searchQuery, searchMatches, open, select, engine]);

  if (!open) return null;

  const total = searchMatches.length;
  const current = total ? searchMatches[matchIndex % total] : null;

  const goTo = (idx: number) => {
    if (!total) return;
    const next = (idx + total) % total;
    setMatchIndex(next);
    const id = searchMatches[next];
    select(id);
    engine.current?.centerOn(id);
  };

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            goTo(e.shiftKey ? matchIndex - 1 : matchIndex + 1);
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="Search nodes…"
        aria-label="Search nodes"
      />
      <span className="search-count">
        {total ? `${(matchIndex % total) + 1}/${total}` : "0/0"}
      </span>
      <button
        className="icon-btn"
        onClick={() => goTo(matchIndex - 1)}
        disabled={!total}
        title="Previous match (Shift+Enter)"
      >
        <IconPrev />
      </button>
      <button
        className="icon-btn"
        onClick={() => goTo(matchIndex + 1)}
        disabled={!total}
        title="Next match (Enter)"
      >
        <IconNext />
      </button>
      <button className="icon-btn" onClick={onClose} title="Close (Esc)">
        <IconClose />
      </button>
      {current && <span className="search-current">{useStore.getState().nodes[current]?.text}</span>}
    </div>
  );
}
