import { create } from "zustand";
import { uid } from "./ids";
import { computeLayout, collectVisible } from "./layout";
import { nodeMetrics } from "./text";
import type {
  Annotation,
  ImageAsset,
  LayoutMode,
  LayoutResult,
  MindMap,
  MindNode,
  NodeMetrics,
} from "./types";
import { NODE_COLORS } from "./types";

export type Op =
  | { type: "add"; id: string; node: MindNode }
  | {
      type: "delete";
      id: string;
      subtree: Record<string, MindNode>;
      parentId: string | null;
      index: number;
    }
  | { type: "rename"; id: string; old: string; new: string }
  | { type: "color"; id: string; old: string; new: string }
  | { type: "collapse"; id: string; old: boolean; new: boolean }
  | {
      type: "reparent";
      id: string;
      oldParent: string | null;
      oldIndex: number;
      newParent: string;
      oldPos: { x: number; y: number } | null;
    }
  | { type: "image"; id: string; old: string | null; new: string | null }
  | { type: "annotations"; id: string; old: Annotation[]; new: Annotation[] }
  | { type: "title"; old: string; new: string }
  | {
      type: "move";
      id: string;
      old: { x: number; y: number } | null;
      new: { x: number; y: number } | null;
    }
  | {
      type: "bulkColor";
      changes: { id: string; old: string; new: string }[];
    }
  | {
      type: "bulkDelete";
      items: {
        id: string;
        subtree: Record<string, MindNode>;
        parentId: string | null;
        index: number;
      }[];
    }
  | {
      type: "paste";
      nodes: Record<string, MindNode>;
      target: string;
      rootIds: string[];
    };

export interface Toast {
  id: number;
  msg: string;
  actionLabel?: string;
  action?: () => void;
}

export interface MindmapStore {
  title: string;
  rootId: string;
  nodes: Record<string, MindNode>;
  images: Record<string, ImageAsset>;
  layoutMode: LayoutMode;
  hasMap: boolean;
  /** Identity of the map currently open ("" when none). */
  mapId: string;
  dataVersion: number;
  searchQuery: string;
  searchMatches: string[];
  theme: "dark" | "light";

  selectedId: string | null;
  selectedIds: string[];
  editingId: string | null;
  inspectorOpen: boolean;
  annFocusSignal: number;
  toast: Toast | null;

  layout: LayoutResult | null;
  layoutVersion: number;

  past: Op[];
  future: Op[];

  newMap(title?: string): void;
  loadMap(map: MindMap, images?: Record<string, ImageAsset>): void;
  closeMap(): void;
  addChild(parentId?: string | null): string;
  addSibling(id: string): string;
  deleteNode(id: string): void;
  renameNode(id: string, text: string): void;
  setNodeColor(id: string, color: string): void;
  toggleCollapse(id: string): void;
  reparentNode(id: string, newParentId: string): void;
  setNodeImage(id: string, imageId: string | null): void;
  moveNode(id: string, x: number, y: number): void;
  addImageAsset(file: File): Promise<string>;
  addAnnotation(id: string, kind: "note" | "highlight", text: string, color: string): void;
  removeAnnotation(id: string, annId: string): void;
  setTitle(t: string): void;
  setLayoutMode(mode: LayoutMode): void;
  setSearchQuery(q: string): void;
  toggleTheme(): void;
  select(id: string | null, opts?: { additive?: boolean }): void;
  selectAll(): void;
  deleteNodes(ids: string[]): void;
  setNodesColor(ids: string[], color: string): void;
  copySelection(): void;
  paste(): void;
  duplicate(): void;
  setEditing(id: string | null): void;
  setInspector(open: boolean): void;
  focusAnnForm(): void;
  undo(): void;
  redo(): void;
  showToast(msg: string, actionLabel?: string, action?: () => void): void;
  clearToast(): void;
}

function freshNode(text: string, parentId: string | null, color: string): MindNode {
  return {
    id: uid(),
    text,
    parentId,
    childIds: [],
    color,
    imageId: null,
    annotations: [],
    collapsed: false,
    pos: null,
  };
}

function recompute(
  nodes: Record<string, MindNode>,
  rootId: string,
  images: Record<string, ImageAsset>,
  layoutMode: LayoutMode,
  prevVersion: number
): { layout: LayoutResult | null; layoutVersion: number } {
  if (!rootId || !nodes[rootId]) return { layout: null, layoutVersion: prevVersion };
  const visible = collectVisible(nodes, rootId);
  const sizes = new Map<string, NodeMetrics>();
  for (const id of visible) {
    sizes.set(id, nodeMetrics(nodes[id], id === rootId, images));
  }
  const layout = computeLayout(nodes, rootId, sizes, layoutMode);
  return { layout, layoutVersion: prevVersion + 1 };
}

function patchNode(
  nodes: Record<string, MindNode>,
  id: string,
  patch: Partial<MindNode>
): Record<string, MindNode> {
  return { ...nodes, [id]: { ...nodes[id], ...patch } };
}

function collectSubtree(
  nodes: Record<string, MindNode>,
  root: string
): Record<string, MindNode> {
  const out: Record<string, MindNode> = {};
  (function walk(id: string) {
    out[id] = nodes[id];
    for (const k of nodes[id].childIds) walk(k);
  })(root);
  return out;
}

function computeSearchMatches(
  nodes: Record<string, MindNode>,
  query: string
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return Object.keys(nodes).filter((id) =>
    nodes[id].text.toLowerCase().includes(q)
  );
}

function isDescendant(
  nodes: Record<string, MindNode>,
  maybeAncestor: string,
  id: string
): boolean {
  let cur: string | null = id;
  while (cur) {
    if (cur === maybeAncestor) return true;
    cur = nodes[cur]?.parentId ?? null;
  }
  return false;
}

let toastSeq = 1;
let clipboard: Record<string, MindNode> | null = null;

export const useStore = create<MindmapStore>((set, get) => {
  const commit = (
    mutator: (s: MindmapStore) => Partial<MindmapStore>,
    op?: Op
  ) => {
    const s = get();
    const next = mutator(s);
    const merged: Partial<MindmapStore> = { ...next };
    if (
      next.nodes !== undefined ||
      next.rootId !== undefined ||
      next.layoutMode !== undefined
    ) {
      const nodes = (next.nodes ?? s.nodes) as Record<string, MindNode>;
      const rootId = (next.rootId ?? s.rootId) as string;
      const images = (next.images ?? s.images) as Record<string, ImageAsset>;
      const layoutMode = (next.layoutMode ?? s.layoutMode) as LayoutMode;
      const rc = recompute(nodes, rootId, images, layoutMode, s.layoutVersion);
      merged.layout = rc.layout;
      merged.layoutVersion = rc.layoutVersion;
    }
    merged.searchMatches = computeSearchMatches(
      (next.nodes ?? s.nodes) as Record<string, MindNode>,
      s.searchQuery
    );
    merged.dataVersion = s.dataVersion + 1;
    if (op) {
      merged.past = [...s.past.slice(-99), op];
      merged.future = [];
    }
    set(merged as MindmapStore);
  };

  const applyOp = (op: Op, inverse: boolean) => {
    const s = get();
    switch (op.type) {
      case "add": {
        if (inverse) {
          const nodes = { ...s.nodes };
          delete nodes[op.id];
          const parent = op.node.parentId ? s.nodes[op.node.parentId] : null;
          if (parent) {
            nodes[parent.id] = {
              ...parent,
              childIds: parent.childIds.filter((c) => c !== op.id),
            };
          }
          set({
            nodes,
            ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
            dataVersion: s.dataVersion + 1,
          });
        } else {
          const nodes = { ...s.nodes, [op.id]: op.node };
          const parent = op.node.parentId ? s.nodes[op.node.parentId] : null;
          if (parent && !parent.childIds.includes(op.id)) {
            nodes[parent.id] = {
              ...parent,
              childIds: [...parent.childIds, op.id],
            };
          }
          set({
            nodes,
            ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
            dataVersion: s.dataVersion + 1,
          });
        }
        break;
      }
      case "delete": {
        if (inverse) {
          const nodes = { ...s.nodes, ...op.subtree };
          if (op.parentId && nodes[op.parentId]) {
            const p = nodes[op.parentId];
            const childIds = [...p.childIds];
            childIds.splice(Math.min(op.index, childIds.length), 0, op.id);
            nodes[op.parentId] = { ...p, childIds };
          }
          set({
            nodes,
            ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
            dataVersion: s.dataVersion + 1,
          });
        } else {
          const nodes = { ...s.nodes };
          for (const id of Object.keys(op.subtree)) delete nodes[id];
          if (op.parentId && nodes[op.parentId]) {
            const p = nodes[op.parentId];
            nodes[op.parentId] = {
              ...p,
              childIds: p.childIds.filter((c) => c !== op.id),
            };
          }
          set({
            nodes,
            ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
            dataVersion: s.dataVersion + 1,
          });
        }
        break;
      }
      case "rename":
        set({
          nodes: patchNode(s.nodes, op.id, { text: inverse ? op.old : op.new }),
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "color":
        set({
          nodes: patchNode(s.nodes, op.id, { color: inverse ? op.old : op.new }),
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "collapse":
        set({
          nodes: patchNode(s.nodes, op.id, {
            collapsed: inverse ? op.old : op.new,
          }),
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "reparent": {
        const targetParent = inverse ? op.oldParent : op.newParent;
        const sourceParent = inverse ? op.newParent : op.oldParent;
        let nodes = { ...s.nodes };
        if (sourceParent && nodes[sourceParent]) {
          const p = nodes[sourceParent];
          nodes[sourceParent] = {
            ...p,
            childIds: p.childIds.filter((c) => c !== op.id),
          };
        }
        if (targetParent && nodes[targetParent]) {
          const p = nodes[targetParent];
          const childIds = [...p.childIds];
          if (inverse) {
            childIds.splice(Math.min(op.oldIndex, childIds.length), 0, op.id);
          } else {
            childIds.push(op.id);
          }
          nodes[targetParent] = { ...p, childIds };
        }
        nodes[op.id] = {
          ...nodes[op.id],
          parentId: targetParent,
          pos: inverse ? op.oldPos : null,
        };
        set({
          nodes,
          ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
          dataVersion: s.dataVersion + 1,
        });
        break;
      }
      case "image":
        set({
          nodes: patchNode(s.nodes, op.id, {
            imageId: inverse ? op.old : op.new,
          }),
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "annotations":
        set({
          nodes: patchNode(s.nodes, op.id, {
            annotations: inverse ? op.old : op.new,
          }),
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "title":
        set({
          title: inverse ? op.old : op.new,
          dataVersion: s.dataVersion + 1,
        });
        break;
      case "move": {
        const nextPos = inverse ? op.old : op.new;
        set({
          nodes: patchNode(s.nodes, op.id, { pos: nextPos }),
          ...recompute(
            { ...s.nodes, [op.id]: { ...s.nodes[op.id], pos: nextPos } },
            s.rootId,
            s.images,
            s.layoutMode,
            s.layoutVersion
          ),
          dataVersion: s.dataVersion + 1,
        });
        break;
      }
      case "bulkColor": {
        const nodes = { ...s.nodes };
        for (const c of op.changes) {
          if (nodes[c.id]) nodes[c.id] = { ...nodes[c.id], color: inverse ? c.old : c.new };
        }
        set({ nodes, dataVersion: s.dataVersion + 1 });
        break;
      }
      case "bulkDelete": {
        const nodes = { ...s.nodes };
        if (inverse) {
          for (const item of op.items) {
            Object.assign(nodes, item.subtree);
            if (item.parentId && nodes[item.parentId]) {
              const p = nodes[item.parentId];
              const childIds = [...p.childIds];
              childIds.splice(Math.min(item.index, childIds.length), 0, item.id);
              nodes[item.parentId] = { ...p, childIds };
            }
          }
        } else {
          for (const item of op.items) {
            for (const k of Object.keys(item.subtree)) delete nodes[k];
            if (item.parentId && nodes[item.parentId]) {
              const p = nodes[item.parentId];
              nodes[item.parentId] = {
                ...p,
                childIds: p.childIds.filter((c) => c !== item.id),
              };
            }
          }
        }
        set({
          nodes,
          ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
          dataVersion: s.dataVersion + 1,
        });
        break;
      }
      case "paste": {
        const nodes = { ...s.nodes };
        if (inverse) {
          for (const id of op.rootIds) {
            const sub = collectSubtree(nodes, id);
            for (const k of Object.keys(sub)) delete nodes[k];
          }
          if (nodes[op.target]) {
            const t = nodes[op.target];
            nodes[op.target] = {
              ...t,
              childIds: t.childIds.filter((c) => !op.rootIds.includes(c)),
            };
          }
        } else {
          Object.assign(nodes, op.nodes);
          if (nodes[op.target]) {
            const t = nodes[op.target];
            const childIds = [...t.childIds];
            for (const r of op.rootIds) if (!childIds.includes(r)) childIds.push(r);
            nodes[op.target] = { ...t, childIds };
          }
        }
        set({
          nodes,
          ...recompute(nodes, s.rootId, s.images, s.layoutMode, s.layoutVersion),
          dataVersion: s.dataVersion + 1,
        });
        break;
      }
    }
  };

  return {
    title: "Untitled map",
    rootId: "",
    nodes: {},
    images: {},
    layoutMode: "tree",
    hasMap: false,
    mapId: "",
    dataVersion: 0,
    searchQuery: "",
    searchMatches: [],
    theme: (typeof localStorage !== "undefined" && localStorage.getItem("mindmap:theme") === "light")
      ? "light"
      : "dark",
    selectedId: null,
    selectedIds: [],
    editingId: null,
    inspectorOpen: false,
    annFocusSignal: 0,
    toast: null,
    layout: null,
    layoutVersion: 0,
    past: [],
    future: [],

    newMap: (title = "Untitled map") => {
      const root = freshNode("Central idea", null, NODE_COLORS[0]);
      const nodes = { [root.id]: root };
      const rc = recompute(nodes, root.id, {}, "tree", get().layoutVersion);
      set({
        title,
        rootId: root.id,
        nodes,
        images: {},
        layoutMode: "tree",
        hasMap: true,
        mapId: uid(),
        selectedId: root.id,
        selectedIds: [root.id],
        editingId: null,
        past: [],
        future: [],
        ...rc,
        dataVersion: get().dataVersion + 1,
      });
    },

    loadMap: (map, images = {}) => {
      const rc = recompute(map.nodes, map.rootId, images, map.layout, get().layoutVersion);
      set({
        title: map.title,
        rootId: map.rootId,
        nodes: map.nodes,
        images,
        layoutMode: map.layout,
        hasMap: true,
        mapId: map.id,
        selectedId: map.rootId,
        selectedIds: [map.rootId],
        editingId: null,
        past: [],
        future: [],
        ...rc,
        dataVersion: get().dataVersion + 1,
      });
    },

    closeMap: () => {
      set({
        title: "Untitled map",
        rootId: "",
        nodes: {},
        images: {},
        layoutMode: "tree",
        hasMap: false,
        mapId: "",
        selectedId: null,
        selectedIds: [],
        editingId: null,
        inspectorOpen: false,
        searchQuery: "",
        searchMatches: [],
        layout: null,
        past: [],
        future: [],
        dataVersion: get().dataVersion + 1,
      });
    },

    addChild: (parentId) => {
      const s = get();
      const parent = parentId ?? s.selectedId ?? s.rootId;
      const p = s.nodes[parent];
      if (!p) return "";
      const color =
        NODE_COLORS[
          (s.past.length + Object.keys(s.nodes).length) % NODE_COLORS.length
        ];
      const n = freshNode("New idea", parent, color);
      const nodes = {
        ...s.nodes,
        [n.id]: n,
        [parent]: { ...p, childIds: [...p.childIds, n.id], collapsed: false },
      };
      commit(() => ({ nodes }), { type: "add", id: n.id, node: n });
      set({ selectedId: n.id, selectedIds: [n.id], editingId: n.id, inspectorOpen: false });
      return n.id;
    },

    addSibling: (id) => {
      const s = get();
      const n = s.nodes[id];
      if (!n) return "";
      if (!n.parentId) return s.addChild(s.rootId);
      const parent = s.nodes[n.parentId];
      const idx = parent.childIds.indexOf(id);
      const color = NODE_COLORS[(idx + 1) % NODE_COLORS.length];
      const sib = freshNode("New idea", n.parentId, color);
      const childIds = [...parent.childIds];
      childIds.splice(idx + 1, 0, sib.id);
      const nodes = {
        ...s.nodes,
        [sib.id]: sib,
        [n.parentId]: { ...parent, childIds, collapsed: false },
      };
      commit(() => ({ nodes }), { type: "add", id: sib.id, node: sib });
      set({ selectedId: sib.id, selectedIds: [sib.id], editingId: sib.id });
      return sib.id;
    },

    deleteNode: (id) => {
      const s = get();
      const n = s.nodes[id];
      if (!n || id === s.rootId) return;
      const subtree = collectSubtree(s.nodes, id);
      const parent = n.parentId ? s.nodes[n.parentId] : null;
      const index = parent ? parent.childIds.indexOf(id) : 0;
      let nodes = { ...s.nodes };
      for (const k of Object.keys(subtree)) delete nodes[k];
      if (parent) {
        nodes[parent.id] = {
          ...parent,
          childIds: parent.childIds.filter((c) => c !== id),
        };
      }
      commit(
        () => ({ nodes }),
        { type: "delete", id, subtree, parentId: n.parentId, index }
      );
      if (s.selectedId === id) set({ selectedId: n.parentId ?? null, editingId: null });
      get().showToast(
        `Deleted ${Object.keys(subtree).length > 1 ? `${Object.keys(subtree).length} nodes` : "node"}`,
        "Undo",
        () => get().undo()
      );
    },

    renameNode: (id, text) => {
      const s = get();
      const n = s.nodes[id];
      if (!n || n.text === text) return;
      commit(
        () => ({ nodes: patchNode(s.nodes, id, { text }) }),
        { type: "rename", id, old: n.text, new: text }
      );
    },

    setNodeColor: (id, color) => {
      const s = get();
      const n = s.nodes[id];
      if (!n || n.color === color) return;
      commit(
        () => ({ nodes: patchNode(s.nodes, id, { color }) }),
        { type: "color", id, old: n.color, new: color }
      );
    },

    toggleCollapse: (id) => {
      const s = get();
      const n = s.nodes[id];
      if (!n) return;
      commit(
        () => ({ nodes: patchNode(s.nodes, id, { collapsed: !n.collapsed }) }),
        { type: "collapse", id, old: n.collapsed, new: !n.collapsed }
      );
    },

    reparentNode: (id, newParentId) => {
      const s = get();
      if (id === newParentId) return;
      const n = s.nodes[id];
      const target = s.nodes[newParentId];
      if (!n || !target) return;
      if (isDescendant(s.nodes, id, newParentId)) return;
      const oldParent = n.parentId;
      if (oldParent === newParentId) return;
      const oldIndex = oldParent
        ? s.nodes[oldParent].childIds.indexOf(id)
        : 0;
      let nodes = { ...s.nodes };
      if (oldParent) {
        nodes[oldParent] = {
          ...nodes[oldParent],
          childIds: nodes[oldParent].childIds.filter((c) => c !== id),
        };
      }
      nodes[newParentId] = {
        ...nodes[newParentId],
        childIds: [...nodes[newParentId].childIds, id],
        collapsed: false,
      };
      nodes[id] = { ...nodes[id], parentId: newParentId, pos: null };
      commit(
        () => ({ nodes }),
        {
          type: "reparent",
          id,
          oldParent,
          oldIndex,
          newParent: newParentId,
          oldPos: n.pos,
        }
      );
    },

    setNodeImage: (id, imageId) => {
      const s = get();
      const n = s.nodes[id];
      if (!n) return;
      commit(
        () => ({ nodes: patchNode(s.nodes, id, { imageId }) }),
        { type: "image", id, old: n.imageId, new: imageId }
      );
    },

    moveNode: (id, x, y) => {
      const s = get();
      const n = s.nodes[id];
      if (!n || id === s.rootId) return;
      const old = n.pos;
      const nx = Math.round(x);
      const ny = Math.round(y);
      if (old && Math.abs(old.x - nx) < 1 && Math.abs(old.y - ny) < 1) return;
      commit(
        () => ({ nodes: patchNode(s.nodes, id, { pos: { x: nx, y: ny } }) }),
        { type: "move", id, old, new: { x: nx, y: ny } }
      );
    },

    addImageAsset: async (file) => {
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const dims = await new Promise<{ w: number; h: number }>((res) => {
        const img = new Image();
        img.onload = () =>
          res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 1, h: 1 });
        img.src = url;
      });
      const id = uid();
      set({
        images: { ...get().images, [id]: { url, w: dims.w, h: dims.h } },
        dataVersion: get().dataVersion + 1,
      });
      return id;
    },

    addAnnotation: (id, kind, text, color) => {
      const s = get();
      const n = s.nodes[id];
      if (!n) return;
      const ann: Annotation = {
        id: uid(),
        kind,
        text,
        color,
        createdAt: Date.now(),
      };
      commit(
        () => ({
          nodes: patchNode(s.nodes, id, {
            annotations: [...n.annotations, ann],
          }),
        }),
        { type: "annotations", id, old: n.annotations, new: [...n.annotations, ann] }
      );
    },

    removeAnnotation: (id, annId) => {
      const s = get();
      const n = s.nodes[id];
      if (!n) return;
      commit(
        () => ({
          nodes: patchNode(s.nodes, id, {
            annotations: n.annotations.filter((a) => a.id !== annId),
          }),
        }),
        {
          type: "annotations",
          id,
          old: n.annotations,
          new: n.annotations.filter((a) => a.id !== annId),
        }
      );
    },

    setTitle: (t) => {
      const s = get();
      if (s.title === t) return;
      commit(() => ({ title: t }), { type: "title", old: s.title, new: t });
    },

    setLayoutMode: (mode) => {
      const s = get();
      if (s.layoutMode === mode) return;
      commit(() => ({ layoutMode: mode }));
    },

    setSearchQuery: (q) => {
      set({ searchQuery: q, searchMatches: computeSearchMatches(get().nodes, q) });
    },

    toggleTheme: () => {
      const next = get().theme === "dark" ? "light" : "dark";
      set({ theme: next });
      try {
        localStorage.setItem("mindmap:theme", next);
      } catch {
        /* ignore */
      }
    },

    select: (id, opts) => {
      if (id === null) {
        set({ selectedId: null, selectedIds: [], inspectorOpen: false });
        return;
      }
      const s = get();
      if (opts?.additive) {
        const has = s.selectedIds.includes(id);
        if (has) {
          const next = s.selectedIds.filter((x) => x !== id);
          set({
            selectedIds: next,
            selectedId: next.length ? next[next.length - 1] : null,
            inspectorOpen: next.length > 0,
          });
        } else {
          set({
            selectedIds: [...s.selectedIds, id],
            selectedId: id,
            inspectorOpen: true,
          });
        }
      } else {
        set({ selectedIds: [id], selectedId: id, inspectorOpen: true });
      }
    },
    selectAll: () => {
      const s = get();
      if (!s.hasMap) return;
      const ids = collectVisible(s.nodes, s.rootId);
      set({
        selectedIds: ids,
        selectedId: s.selectedId ?? s.rootId,
        inspectorOpen: true,
      });
    },
    deleteNodes: (ids) => {
      const s = get();
      const top = ids.filter(
        (id) =>
          id !== s.rootId &&
          !ids.some(
            (other) =>
              other !== id &&
              other !== s.rootId &&
              isDescendant(s.nodes, other, id)
          )
      );
      if (!top.length) return;
      const items = top.map((id) => {
        const n = s.nodes[id];
        const subtree = collectSubtree(s.nodes, id);
        const parent = n.parentId ? s.nodes[n.parentId] : null;
        const index = parent ? parent.childIds.indexOf(id) : 0;
        return { id, subtree, parentId: n.parentId, index };
      });
      let nodes = { ...s.nodes };
      for (const item of items) {
        for (const k of Object.keys(item.subtree)) delete nodes[k];
        if (item.parentId && nodes[item.parentId]) {
          const p = nodes[item.parentId];
          nodes[item.parentId] = {
            ...p,
            childIds: p.childIds.filter((c) => c !== item.id),
          };
        }
      }
      commit(() => ({ nodes }), { type: "bulkDelete", items });
      set({ selectedId: null, selectedIds: [], editingId: null });
      get().showToast(
        `Deleted ${items.length} node${items.length > 1 ? "s" : ""}`,
        "Undo",
        () => get().undo()
      );
    },
    setNodesColor: (ids, color) => {
      const s = get();
      const changes = ids
        .filter((id) => s.nodes[id] && s.nodes[id].color !== color)
        .map((id) => ({ id, old: s.nodes[id].color, new: color }));
      if (!changes.length) return;
      const nodes = { ...s.nodes };
      for (const c of changes) nodes[c.id] = { ...nodes[c.id], color: c.new };
      commit(() => ({ nodes }), { type: "bulkColor", changes });
    },
    copySelection: () => {
      const s = get();
      const ids = s.selectedIds.length
        ? s.selectedIds
        : s.selectedId
          ? [s.selectedId]
          : [];
      if (!ids.length) return;
      const collected: Record<string, MindNode> = {};
      for (const id of ids) {
        if (id === s.rootId) continue;
        const sub = collectSubtree(s.nodes, id);
        Object.assign(collected, sub);
      }
      if (!Object.keys(collected).length) return;
      clipboard = collected;
      get().showToast(
        `Copied ${Object.keys(collected).length} node${Object.keys(collected).length > 1 ? "s" : ""}`
      );
    },
    paste: () => {
      const clip = clipboard;
      if (!clip) return;
      const s = get();
      const target = s.selectedId ?? s.rootId;
      if (!s.nodes[target]) return;
      const idMap = new Map<string, string>();
      for (const id of Object.keys(clip)) idMap.set(id, uid());
      const newNodes: Record<string, MindNode> = {};
      for (const [oldId, node] of Object.entries(clip)) {
        newNodes[idMap.get(oldId)!] = {
          ...node,
          id: idMap.get(oldId)!,
          parentId: null,
          childIds: node.childIds.map((c) => idMap.get(c)!),
          pos: null,
          annotations: node.annotations.map((a) => ({ ...a, id: uid() })),
        };
      }
      const roots = Object.keys(clip).filter(
        (id) => !clip[id].parentId || !idMap.has(clip[id].parentId!)
      );
      for (const r of roots) newNodes[idMap.get(r)!].parentId = target;
      const rootIds = roots.map((r) => idMap.get(r)!);
      const targetNode = s.nodes[target];
      const nodes = {
        ...s.nodes,
        ...newNodes,
        [target]: {
          ...targetNode,
          childIds: [...targetNode.childIds, ...rootIds],
          collapsed: false,
        },
      };
      commit(() => ({ nodes }), { type: "paste", nodes: newNodes, target, rootIds });
      set({ selectedId: rootIds[0], selectedIds: rootIds, editingId: null });
    },
    duplicate: () => {
      const s = get();
      const id = s.selectedId;
      if (!id || id === s.rootId) return;
      const n = s.nodes[id];
      const parent = n.parentId ? s.nodes[n.parentId] : null;
      if (!parent) return;
      const sub = collectSubtree(s.nodes, id);
      const idMap = new Map<string, string>();
      for (const k of Object.keys(sub)) idMap.set(k, uid());
      const newNodes: Record<string, MindNode> = {};
      for (const [oldId, node] of Object.entries(sub)) {
        newNodes[idMap.get(oldId)!] = {
          ...node,
          id: idMap.get(oldId)!,
          parentId: null,
          childIds: node.childIds.map((c) => idMap.get(c)!),
          pos: null,
          annotations: node.annotations.map((a) => ({ ...a, id: uid() })),
        };
      }
      const newRoot = idMap.get(id)!;
      newNodes[newRoot].parentId = parent.id;
      const idx = parent.childIds.indexOf(id);
      const childIds = [...parent.childIds];
      childIds.splice(idx + 1, 0, newRoot);
      const nodes = {
        ...s.nodes,
        ...newNodes,
        [parent.id]: { ...parent, childIds, collapsed: false },
      };
      commit(() => ({ nodes }), {
        type: "paste",
        nodes: newNodes,
        target: parent.id,
        rootIds: [newRoot],
      });
      set({ selectedId: newRoot, selectedIds: [newRoot], editingId: null });
    },
    setEditing: (id) => set({ editingId: id }),
    setInspector: (open) => set({ inspectorOpen: open }),
    focusAnnForm: () =>
      set({
        annFocusSignal: get().annFocusSignal + 1,
        inspectorOpen: true,
      }),

    undo: () => {
      const s = get();
      const op = s.past[s.past.length - 1];
      if (!op) return;
      set({ past: s.past.slice(0, -1), future: [...s.future, op] });
      applyOp(op, true);
    },

    redo: () => {
      const s = get();
      const op = s.future[s.future.length - 1];
      if (!op) return;
      set({ future: s.future.slice(0, -1), past: [...s.past, op] });
      applyOp(op, false);
    },

    showToast: (msg, actionLabel, action) =>
      set({ toast: { id: toastSeq++, msg, actionLabel, action } }),
    clearToast: () => set({ toast: null }),
  };
});

export function exportMapData(): MindMap {
  const s = useStore.getState();
  return {
    version: 1,
    id: s.mapId,
    title: s.title,
    rootId: s.rootId,
    nodes: s.nodes,
    layout: s.layoutMode,
  };
}
