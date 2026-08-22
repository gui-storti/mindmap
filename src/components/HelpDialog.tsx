import { motion } from "framer-motion";

const SHORTCUTS: [string, string][] = [
  ["Tab", "Add child"],
  ["Enter", "Add sibling"],
  ["F2", "Rename node"],
  ["Delete", "Delete node"],
  ["Arrows", "Navigate tree"],
  ["0", "Fit view"],
  ["+ / −", "Zoom"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z", "Redo"],
  ["Ctrl+S", "Export .mind"],
  ["Ctrl+M", "Your maps"],
  ["Esc", "Deselect"],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <motion.div
        className="dialog"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard shortcuts</h2>
        {SHORTCUTS.map(([k, label]) => (
          <div key={k} className="shortcut-row">
            <span>{label}</span>
            <kbd>{k}</kbd>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: 12.5, color: "var(--text-2)" }}>
          Drag empty space to pan · Scroll or pinch to zoom · Drag a node
          onto another to reparent · Double-tap a node to rename
        </div>
      </motion.div>
    </div>
  );
}
