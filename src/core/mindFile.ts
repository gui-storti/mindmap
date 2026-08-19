import JSZip from "jszip";
import type { ImageAsset, MindMap, MindNode } from "./types";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function normalizeNode(raw: unknown, id: string, parentId: string | null): MindNode {
  const n = (raw ?? {}) as Record<string, unknown>;
  return {
    id,
    text: typeof n.text === "string" ? n.text : "Idea",
    parentId,
    childIds: Array.isArray(n.childIds) ? n.childIds.filter((c) => typeof c === "string") : [],
    color: typeof n.color === "string" ? n.color : "#8b7cff",
    imageId: typeof n.imageId === "string" ? n.imageId : null,
    annotations: Array.isArray(n.annotations)
      ? n.annotations
          .filter((a) => a && typeof a === "object")
          .map((a) => ({
            id: String(a.id ?? Math.random().toString(36).slice(2)),
            kind: a.kind === "highlight" ? "highlight" : "note",
            text: String(a.text ?? ""),
            color: typeof a.color === "string" ? a.color : "#fbbf24",
            createdAt: typeof a.createdAt === "number" ? a.createdAt : Date.now(),
          }))
      : [],
    collapsed: !!n.collapsed,
    pos:
      n.pos &&
      typeof (n.pos as Record<string, unknown>).x === "number" &&
      typeof (n.pos as Record<string, unknown>).y === "number"
        ? {
            x: (n.pos as Record<string, unknown>).x as number,
            y: (n.pos as Record<string, unknown>).y as number,
          }
        : null,
  };
}

export function normalizeMap(raw: unknown): MindMap {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object" || !r.nodes) {
    throw new Error("Not a valid mind map");
  }
  const nodes: Record<string, MindNode> = {};
  const rawNodes = r.nodes as Record<string, unknown>;
  for (const [id, rawN] of Object.entries(rawNodes)) {
    const parent =
      typeof (rawN as Record<string, unknown>).parentId === "string"
        ? ((rawN as Record<string, unknown>).parentId as string)
        : null;
    nodes[id] = normalizeNode(rawN, id, parent);
  }
  const rootId =
    typeof r.rootId === "string" && nodes[r.rootId] ? r.rootId : Object.keys(nodes)[0];
  if (!rootId) throw new Error("Empty mind map");
  nodes[rootId].parentId = null;
  return {
    version: 1,
    title: typeof r.title === "string" ? r.title : "Imported map",
    rootId,
    nodes,
    layout: r.layout === "radial" || r.layout === "force" ? r.layout : "tree",
  };
}

export interface ImportResult {
  map: MindMap;
  images: Record<string, ImageAsset>;
}

export async function importMindMap(bytes: Uint8Array): Promise<ImportResult> {
  // 1) plain JSON .mind
  try {
    const text = new TextDecoder().decode(bytes);
    const j = JSON.parse(text);
    const map = normalizeMap(j);
    return { map, images: {} };
  } catch {
    /* not plain json */
  }

  // 2) zip archive
  const zip = await JSZip.loadAsync(bytes);
  const entry = zip.file("mindmap.json");
  if (!entry) throw new Error("Not a valid .mind file (missing mindmap.json)");
  const json = JSON.parse(await entry.async("text"));
  const map = normalizeMap(json);

  const images: Record<string, ImageAsset> = {};
  const rawImages = (json as Record<string, unknown>).images as
    | Record<string, { file?: string }>
    | undefined;
  if (rawImages) {
    for (const [id, meta] of Object.entries(rawImages)) {
      if (!meta?.file) continue;
      const file = zip.file(meta.file);
      if (!file) continue;
      const b64 = await file.async("base64");
      const ext = meta.file.split(".").pop()?.toLowerCase() ?? "png";
      const mime =
        Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)?.[0] ?? "image/png";
      const url = `data:${mime};base64,${b64}`;
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () =>
          res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 1, h: 1 });
        img.src = url;
      });
      images[id] = { url, w: dims.w, h: dims.h };
    }
  }
  return { map, images };
}

export async function exportMindMap(
  map: MindMap,
  images: Record<string, ImageAsset>
): Promise<Blob> {
  const ids = Object.keys(images);
  if (ids.length === 0) {
    return new Blob([JSON.stringify(map, null, 2)], {
      type: "application/json",
    });
  }

  const zip = new JSZip();
  const imageMeta: Record<string, { file: string }> = {};
  for (const id of ids) {
    const img = images[id];
    const m = img.url.match(/^data:(image\/[\w.+-]+);base64,(.*)$/);
    if (!m) continue;
    const mime = m[1];
    const ext = EXT_BY_MIME[mime] ?? "png";
    const file = `images/${id}.${ext}`;
    zip.file(file, m[2], { base64: true });
    imageMeta[id] = { file };
  }
  zip.file(
    "mindmap.json",
    JSON.stringify({ ...map, images: imageMeta }, null, 2)
  );
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
