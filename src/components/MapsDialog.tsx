import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../core/store";
import { getLibrary, timeAgo, type MapRecord } from "../core/library";
import { IconClose, IconImport, IconPlus, IconTrash } from "./icons";

interface Props {
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
}

export function MapsDialog({ onClose, onNew, onOpen, onDelete, onImport }: Props) {
  const mapId = useStore((s) => s.mapId);
  const [maps, setMaps] = useState<MapRecord[]>(() => getLibrary());

  useEffect(() => {
    setMaps(getLibrary());
  }, [mapId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDelete = (id: string) => {
    onDelete(id);
    setMaps(getLibrary());
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <motion.div
        className="dialog maps-dialog"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="maps-head">
          <h2>Your maps</h2>
          <button className="icon-btn" onClick={onClose} title="Close">
            <IconClose />
          </button>
        </div>

        <div className="maps-actions">
          <button className="primary-btn" onClick={onNew}>
            <IconPlus />
            New map
          </button>
          <button className="ghost-btn-lg" onClick={onImport}>
            <IconImport />
            Import .mind
          </button>
        </div>

        {maps.length === 0 ? (
          <div className="maps-empty">
            <p>No maps yet.</p>
            <span>Create a map and it will show up here.</span>
          </div>
        ) : (
          <div className="map-list">
            {maps.map((r) => (
              <div
                key={r.id}
                className={r.id === mapId ? "map-item active" : "map-item"}
                onClick={() => onOpen(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(r.id);
                }}
              >
                <div className="map-item-body">
                  <span className="map-item-title">{r.title}</span>
                  <span className="map-item-meta">
                    {r.nodeCount} nodes · {timeAgo(r.updatedAt)}
                  </span>
                </div>
                {r.id === mapId && <span className="map-item-badge">Open</span>}
                <button
                  className="map-item-del"
                  title="Delete map"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(r.id);
                  }}
                >
                  <IconTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
