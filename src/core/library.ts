import { uid } from "./ids";
import type { ImageAsset, MindMap } from "./types";

const KEY = "mindmap:library";
const LEGACY_KEY = "mindmap:recent";
const MAX = 50;

export interface MapRecord {
  id: string;
  title: string;
  updatedAt: number;
  nodeCount: number;
  data: MindMap;
  images: Record<string, ImageAsset>;
}

let migrated = false;

/** One-time migration from the old "recent" list into the library. */
function migrate() {
  if (migrated) return;
  migrated = true;
  try {
    if (localStorage.getItem(KEY) !== null) return;
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    localStorage.removeItem(LEGACY_KEY);
    const list = JSON.parse(raw) as {
      title?: string;
      timestamp?: number;
      data?: MindMap;
    }[];
    if (!Array.isArray(list)) return;
    const records: MapRecord[] = [];
    for (const r of list) {
      if (!r?.data?.rootId) continue;
      const id = r.data.id || uid();
      records.push({
        id,
        title: r.title || "Untitled",
        updatedAt: typeof r.timestamp === "number" ? r.timestamp : Date.now(),
        nodeCount: Object.keys(r.data.nodes ?? {}).length,
        data: { ...r.data, id },
        images: {},
      });
    }
    if (records.length) persist(records);
    else localStorage.setItem(KEY, "[]");
  } catch {
    /* ignore */
  }
}

export function getLibrary(): MapRecord[] {
  migrate();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as MapRecord[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.id === "string" && r.data && r.data.rootId)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/** Save (or update) a map in the library. Returns the map id. */
export function upsertMap(map: MindMap, images: Record<string, ImageAsset>): string {
  const record: MapRecord = {
    id: map.id,
    title: map.title || "Untitled",
    updatedAt: Date.now(),
    nodeCount: Object.keys(map.nodes).length,
    data: map,
    images,
  };
  const rest = getLibrary().filter((r) => r.id !== map.id);
  persist([record, ...rest].slice(0, MAX));
  return map.id;
}

/** Remove a map from the library. Returns the removed record (or null). */
export function removeMap(id: string): MapRecord | null {
  const lib = getLibrary();
  const rec = lib.find((r) => r.id === id) ?? null;
  persist(lib.filter((r) => r.id !== id));
  return rec;
}

export function clearLibrary() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

function persist(records: MapRecord[]) {
  const trySet = (list: MapRecord[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };
  if (trySet(records)) return;
  // Quota exceeded: retry without images, then drop oldest entries.
  const noImages = records.map((r) => ({ ...r, images: {} }));
  if (trySet(noImages)) return;
  for (let i = noImages.length - 1; i > 0; i--) {
    if (trySet(noImages.slice(0, i))) return;
  }
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
