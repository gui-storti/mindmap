import { uid } from "./ids";
import type { ImageAsset, MindMap, MindNode } from "./types";
import { NODE_COLORS } from "./types";

function makeSampleImage(): { url: string; w: number; h: number } {
  const w = 480;
  const h = 320;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#8b7cff");
  g.addColorStop(0.5, "#5ee7ff");
  g.addColorStop(1, "#f472b6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft blobs
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 20 + Math.random() * 70;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "rgba(255,255,255,0.35)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { url: c.toDataURL("image/png"), w, h };
}

export function buildSampleMap(): { map: MindMap; images: Record<string, ImageAsset> } {
  const nodes: Record<string, MindNode> = {};
  const images: Record<string, ImageAsset> = {};

  const add = (
    text: string,
    parentId: string | null,
    color: string,
    opts: {
      imageId?: string;
      collapsed?: boolean;
      note?: { text: string; color: string };
      highlight?: string;
    } = {}
  ): string => {
    const id = uid();
    const n: MindNode = {
      id,
      text,
      parentId,
      childIds: [],
      color,
      imageId: opts.imageId ?? null,
      annotations: [],
      collapsed: opts.collapsed ?? false,
      pos: null,
    };
    if (opts.note) {
      n.annotations.push({
        id: uid(),
        kind: "note",
        text: opts.note.text,
        color: opts.note.color,
        createdAt: Date.now(),
      });
    }
    if (opts.highlight) {
      n.annotations.push({
        id: uid(),
        kind: "highlight",
        text: "",
        color: opts.highlight,
        createdAt: Date.now(),
      });
    }
    nodes[id] = n;
    if (parentId && nodes[parentId]) {
      nodes[parentId].childIds.push(id);
    }
    return id;
  };

  const imgId = uid();
  images[imgId] = makeSampleImage();

  const root = add("Product Launch", null, NODE_COLORS[0]);

  const research = add("Research", root, NODE_COLORS[1]);
  add("User interviews", research, NODE_COLORS[1], {
    note: { text: "Talk to 10 users before finalizing the flow.", color: "#5ee7ff" },
  });
  add("Market analysis", research, NODE_COLORS[1]);
  add("Competitor audit", research, NODE_COLORS[1]);

  const design = add("Design", root, NODE_COLORS[2]);
  add("Wireframes", design, NODE_COLORS[2]);
  add("Visual identity", design, NODE_COLORS[2], { imageId: imgId });
  add("Interactive prototype", design, NODE_COLORS[2]);

  const eng = add("Engineering", root, NODE_COLORS[4]);
  add("Architecture", eng, NODE_COLORS[4]);
  add("API design", eng, NODE_COLORS[4]);
  add("Mobile app", eng, NODE_COLORS[4]);

  const mkt = add("Marketing", root, NODE_COLORS[3]);
  add("Landing page", mkt, NODE_COLORS[3]);
  add("Social campaign", mkt, NODE_COLORS[3]);
  add("Press kit", mkt, NODE_COLORS[3]);

  const launch = add("Launch", root, NODE_COLORS[5]);
  add("Closed beta", launch, NODE_COLORS[5]);
  add("Public release", launch, NODE_COLORS[5], { highlight: "#fbbf24" });
  add("Feedback loop", launch, NODE_COLORS[5]);

  return {
    map: {
      version: 1,
      title: "Product Launch",
      rootId: root,
      nodes,
      layout: "tree",
    },
    images,
  };
}
