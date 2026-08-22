import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../core/store";
import { buildSampleMap } from "../core/sample";
import { TEMPLATES } from "../core/templates";
import {
  getLibrary,
  clearLibrary,
  removeMap,
  timeAgo,
  type MapRecord,
} from "../core/library";
import { IconExport, IconImport, IconTrash, LogoMark } from "./icons";

interface Props {
  onImport: () => void;
}

export function Welcome({ onImport }: Props) {
  const hasMap = useStore((s) => s.hasMap);
  const newMap = useStore((s) => s.newMap);
  const loadMap = useStore((s) => s.loadMap);
  const [maps, setMaps] = useState<MapRecord[]>(() => getLibrary());

  // refresh the list whenever the welcome screen becomes visible
  useEffect(() => {
    if (!hasMap) setMaps(getLibrary());
  }, [hasMap]);

  if (hasMap) return null;

  const refresh = () => setMaps(getLibrary());

  const openMap = (r: MapRecord) => {
    loadMap(r.data, r.images);
  };

  const deleteMap = (id: string) => {
    removeMap(id);
    refresh();
  };

  const onClearAll = () => {
    clearLibrary();
    refresh();
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

        {maps.length > 0 && (
          <div className="welcome-section">
            <div className="welcome-section-head">
              <span>Your maps</span>
              <button
                className="welcome-clear"
                onClick={onClearAll}
                title="Delete all maps"
              >
                <IconTrash />
              </button>
            </div>
            <div className="recent-list">
              {maps.map((r) => (
                <div key={r.id} className="recent-item">
                  <button
                    className="recent-open"
                    onClick={() => openMap(r)}
                  >
                    <span className="recent-title">{r.title}</span>
                    <span className="recent-meta">
                      {r.nodeCount} nodes · {timeAgo(r.updatedAt)}
                    </span>
                  </button>
                  <button
                    className="recent-del"
                    onClick={() => deleteMap(r.id)}
                    title="Delete map"
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
      </motion.div>
    </div>
  );
}
