import type {
  LayoutMode,
  LayoutResult,
  MindNode,
  NodeMetrics,
  PositionedNode,
} from "./types";

const GAP_X = 46;
const GAP_Y = 16;

type NodesMap = Record<string, MindNode>;

function visibleKids(nodes: NodesMap, id: string): string[] {
  const n = nodes[id];
  return n.collapsed ? [] : n.childIds;
}

function treeLayout(
  nodes: NodesMap,
  rootId: string,
  sizes: Map<string, NodeMetrics>
): LayoutResult {
  const pos = new Map<string, PositionedNode>();
  const edges: [string, string][] = [];
  const subH = new Map<string, number>();

  const kidsOf = (id: string) => visibleKids(nodes, id);

  function measure(id: string): number {
    const kids = kidsOf(id);
    if (kids.length === 0) {
      const h = sizes.get(id)!.h + GAP_Y;
      subH.set(id, h);
      return h;
    }
    let sum = 0;
    for (const k of kids) sum += measure(k);
    const h = Math.max(sum, sizes.get(id)!.h + GAP_Y);
    subH.set(id, h);
    return h;
  }
  measure(rootId);

  const rootSize = sizes.get(rootId)!;
  pos.set(rootId, {
    x: 0,
    y: 0,
    w: rootSize.w,
    h: rootSize.h,
    lines: rootSize.lines,
    fontPx: rootSize.fontPx,
    weight: rootSize.weight,
    padX: rootSize.padX,
    padY: rootSize.padY,
    imgH: rootSize.imgH,
  });

  const rootKids = kidsOf(rootId);
  const split = rootKids.length > 1 ? Math.ceil(rootKids.length / 2) : 0;
  const leftKids = rootKids.slice(0, split);
  const rightKids = rootKids.slice(split);

  function placeSide(kids: string[], dir: 1 | -1, parentW: number) {
    if (kids.length === 0) return;

    // column max widths per depth
    const colW: number[] = [];
    (function scan(id: string, d: number) {
      const s = sizes.get(id)!;
      colW[d] = Math.max(colW[d] ?? 0, s.w);
      for (const k of kidsOf(id)) scan(k, d + 1);
    })(kids[0], 0);
    for (let i = 1; i < kids.length; i++) {
      (function scan(id: string, d: number) {
        const s = sizes.get(id)!;
        colW[d] = Math.max(colW[d] ?? 0, s.w);
        for (const k of kidsOf(id)) scan(k, d + 1);
      })(kids[i], 0);
    }

    const xEdge: number[] = [];
    let acc = parentW / 2;
    for (let d = 0; d < colW.length; d++) {
      xEdge[d] = acc;
      acc += colW[d] + GAP_X;
    }

    function place(id: string, d: number, yTop: number) {
      const s = sizes.get(id)!;
      const kids = kidsOf(id);
      if (kids.length === 0) {
        const band = subH.get(id)!;
        const y = yTop + (band - s.h) / 2;
        const x = dir === 1 ? xEdge[d] + s.w / 2 : -(xEdge[d] + s.w / 2);
        pos.set(id, {
          x, y, w: s.w, h: s.h,
          lines: s.lines, fontPx: s.fontPx, weight: s.weight,
          padX: s.padX, padY: s.padY, imgH: s.imgH,
        });
        return;
      }
      let cy = yTop;
      for (const k of kids) {
        place(k, d + 1, cy);
        cy += subH.get(k)!;
      }
      const first = pos.get(kids[0])!;
      const last = pos.get(kids[kids.length - 1])!;
      const y = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
      const x = dir === 1 ? xEdge[d] + s.w / 2 : -(xEdge[d] + s.w / 2);
      pos.set(id, {
        x, y, w: s.w, h: s.h,
        lines: s.lines, fontPx: s.fontPx, weight: s.weight,
        padX: s.padX, padY: s.padY, imgH: s.imgH,
      });
    }

    let totalH = 0;
    for (const k of kids) totalH += subH.get(k)!;
    let yTop = -totalH / 2;
    for (const k of kids) {
      place(k, 0, yTop);
      yTop += subH.get(k)!;
    }
  }

  placeSide(rightKids, 1, rootSize.w);
  placeSide(leftKids, -1, rootSize.w);

  // edges
  (function walk(id: string) {
    for (const k of kidsOf(id)) {
      edges.push([id, k]);
      walk(k);
    }
  })(rootId);

  return finalize(pos, edges, "tree");
}

function radialLayout(
  nodes: NodesMap,
  rootId: string,
  sizes: Map<string, NodeMetrics>
): LayoutResult {
  const pos = new Map<string, PositionedNode>();
  const edges: [string, string][] = [];
  const kidsOf = (id: string) => visibleKids(nodes, id);

  const rootSize = sizes.get(rootId)!;
  pos.set(rootId, {
    x: 0, y: 0, w: rootSize.w, h: rootSize.h,
    lines: rootSize.lines, fontPx: rootSize.fontPx, weight: rootSize.weight,
    padX: rootSize.padX, padY: rootSize.padY, imgH: rootSize.imgH,
  });

  const leafCount = new Map<string, number>();
  function leaves(id: string): number {
    const kids = kidsOf(id);
    if (kids.length === 0) return 1;
    let s = 0;
    for (const k of kids) s += leaves(k);
    leafCount.set(id, s);
    return s;
  }

  const rootKids = kidsOf(rootId);
  const total = rootKids.reduce((s, k) => s + leaves(k), 0) || 1;

  // max node diameter per depth (for ring radii)
  const maxD: number[] = [];
  for (const k of rootKids) {
    (function scan(id: string, d: number) {
      const s = sizes.get(id)!;
      const dia = Math.max(s.w, s.h);
      maxD[d] = Math.max(maxD[d] ?? 0, dia);
      for (const c of kidsOf(id)) scan(c, d + 1);
    })(k, 1);
  }
  const R: number[] = [0];
  for (let d = 1; d <= maxD.length; d++) {
    R[d] = R[d - 1] + (maxD[d - 1] ?? 0) + 90;
  }

  function place(id: string, d: number, a0: number, a1: number) {
    const s = sizes.get(id)!;
    const mid = (a0 + a1) / 2;
    const r = R[d];
    pos.set(id, {
      x: Math.cos(mid) * r,
      y: Math.sin(mid) * r,
      w: s.w, h: s.h,
      lines: s.lines, fontPx: s.fontPx, weight: s.weight,
      padX: s.padX, padY: s.padY, imgH: s.imgH,
    });
    const kids = kidsOf(id);
    if (kids.length > 0) {
      const tot = kids.reduce((s2, k) => s2 + leaves(k), 0) || 1;
      let ca = a0;
      for (const k of kids) {
        const span = ((a1 - a0) * leaves(k)) / tot;
        place(k, d + 1, ca, ca + span);
        ca += span;
      }
    }
  }

  let a = -Math.PI / 2;
  for (const k of rootKids) {
    const span = (2 * Math.PI * leaves(k)) / total;
    place(k, 1, a, a + span);
    a += span;
  }

  (function walk(id: string) {
    for (const k of kidsOf(id)) {
      edges.push([id, k]);
      walk(k);
    }
  })(rootId);

  return finalize(pos, edges, "radial");
}

function finalize(
  pos: Map<string, PositionedNode>,
  edges: [string, string][],
  mode: LayoutMode
): LayoutResult {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x - p.w / 2);
    minY = Math.min(minY, p.y - p.h / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  if (!isFinite(minX)) { minX = minY = 0; maxX = maxY = 0; }
  return {
    positions: pos,
    edges,
    bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    mode,
  };
}

export function computeLayout(
  nodes: Record<string, MindNode>,
  rootId: string,
  sizes: Map<string, NodeMetrics>,
  mode: LayoutMode
): LayoutResult {
  const result =
    mode === "radial"
      ? radialLayout(nodes, rootId, sizes)
      : treeLayout(nodes, rootId, sizes);

  // manual (free) position overrides win over the computed layout
  for (const [id, p] of result.positions) {
    const mp = nodes[id]?.pos;
    if (mp) {
      p.x = mp.x;
      p.y = mp.y;
    }
  }

  // recompute the bounding box to include any manual positions
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of result.positions.values()) {
    minX = Math.min(minX, p.x - p.w / 2);
    minY = Math.min(minY, p.y - p.h / 2);
    maxX = Math.max(maxX, p.x + p.w / 2);
    maxY = Math.max(maxY, p.y + p.h / 2);
  }
  if (!isFinite(minX)) {
    minX = minY = 0;
    maxX = maxY = 0;
  }
  result.bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  return result;
}

export function collectVisible(
  nodes: Record<string, MindNode>,
  rootId: string
): string[] {
  const out: string[] = [];
  (function walk(id: string) {
    out.push(id);
    const n = nodes[id];
    if (!n.collapsed) for (const k of n.childIds) walk(k);
  })(rootId);
  return out;
}
