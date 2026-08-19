import type { MindMap } from "./types";

const KEY = "mindmap:recent";
const MAX = 8;

export interface RecentEntry {
  title: string;
  timestamp: number;
  nodeCount: number;
  data: MindMap;
}

export function getRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Record a map in the recent list (deduped by title, most recent first). */
export function pushRecent(map: MindMap) {
  try {
    if (!map || !map.rootId) return;
    const count = Object.keys(map.nodes).length;
    const entry: RecentEntry = {
      title: map.title || "Untitled",
      timestamp: Date.now(),
      nodeCount: count,
      data: map,
    };
    const rest = getRecent().filter((r) => r.title !== entry.title);
    const next = [entry, ...rest].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — silently drop */
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
