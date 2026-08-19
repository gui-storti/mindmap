import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../core/store";
import { buildSampleMap } from "../core/sample";
import { TEMPLATES } from "../core/templates";
import { getRecent, clearRecent, type RecentEntry } from "../core/recent";
import { IconExport, IconImport, IconTrash, LogoMark } from "./icons";

interface Props {
  onImport: () => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function Welcome({ onImport }: Props) {
  const hasMap = useStore((s) => s.hasMap);
  const newMap = useStore((s) => s.newMap);
  const loadMap = useStore((s) => s.loadMap);
  const [recent, setRecent] = useState<RecentEntry[]>(() => getRecent());

  if (hasMap) return null;

  const refreshRecent = () => setRecent(getRecent());

  const loadRecent = (entry: RecentEntry) => {
    loadMap(entry.data);
  };

  const onClearRecent = () => {
    clearRecent();
    refreshRecent();
  };

  return (
    <div className="welcome">
      <motion.div
        className="welcome-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 24 }}
      >
        <div className="welcome-logo">
          <LogoMark />
        </div>
        <h1>Mindmap</h1>
        <p>
          Think in branches. A fast, beautiful mind-mapping canvas for
          complex ideas — with images, notes, and three layout engines.
        </p>
        <div className="welcome-actions">
          <button className="primary-btn" onClick={() => newMap()}>
            <IconExport />
            New map
          </button>
          <div className="welcome-row">
            <button
              className="ghost-btn-lg"
              onClick={() => {
                const { map, images } = buildSampleMap();
                loadMap(map, images);
              }}
            >
              Load sample
            </button>
            <button className="ghost-btn-lg" onClick={onImport}>
              <IconImport />
              Import .mind
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <div className="welcome-section-head">
            <span>Start from a template</span>
          </div>
          <div className="template-grid">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                className="template-card"
                onClick={() => loadMap(t.build())}
              >
                <span className="template-name">{t.name}</span>
                <span className="template-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="welcome-section">
            <div className="welcome-section-head">
              <span>Recent</span>
              <button
                className="welcome-clear"
                onClick={onClearRecent}
                title="Clear recent"
              >
                <IconTrash />
              </button>
            </div>
            <div className="recent-list">
              {recent.map((r, i) => (
                <button
                  key={`${r.title}-${i}`}
                  className="recent-item"
                  onClick={() => loadRecent(r)}
                >
                  <span className="recent-title">{r.title}</span>
                  <span className="recent-meta">
                    {r.nodeCount} nodes · {timeAgo(r.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
