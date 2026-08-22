import { uid } from "./ids";
import type { MindMap, MindNode } from "./types";

/** Serialize a map to a nested Markdown list (root as `#` heading). */
export function toMarkdown(map: MindMap): string {
  const lines: string[] = [];
  const root = map.nodes[map.rootId];
  if (!root) return "";
  lines.push(`# ${root.text}`);
  lines.push("");
  const walk = (id: string, depth: number) => {
    const node = map.nodes[id];
    if (!node) return;
    for (const childId of node.childIds) {
      const child = map.nodes[childId];
      if (!child) continue;
      lines.push(`${"  ".repeat(depth)}- ${child.text}`);
      walk(childId, depth + 1);
    }
  };
  walk(map.rootId, 0);
  return lines.join("\n");
}

/** Parse a nested Markdown list (or `#` heading) back into a map. */
export function fromMarkdown(md: string): MindMap {
  const nodes: Record<string, MindNode> = {};
  let rootId = "";
  const stack: string[] = [];

  const makeNode = (text: string, parentId: string | null): MindNode => {
    const id = uid();
    const node: MindNode = {
      id,
      text,
      parentId,
      childIds: [],
      color: "#5ee7ff",
      imageId: null,
      annotations: [],
      collapsed: false,
      pos: null,
    };
    nodes[id] = node;
    return node;
  };

  for (const rawLine of md.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const h = line.match(/^#\s+(.*)/);
    if (h) {
      const root = makeNode(h[1].trim() || "Mindmap", null);
      rootId = root.id;
      stack.length = 0;
      continue;
    }

    const m = line.match(/^(\s*)[-*]\s+(.*)/);
    if (m) {
      const depth = Math.floor(m[1].length / 2);
      const text = m[2].trim();
      while (stack.length > depth) stack.pop();
      const parentId = depth > 0 ? stack[depth - 1] : rootId || null;
      const node = makeNode(text, parentId);
      if (parentId && nodes[parentId]) nodes[parentId].childIds.push(node.id);
      stack.push(node.id);
      continue;
    }
  }

  if (!rootId) {
    const root = makeNode("Mindmap", null);
    rootId = root.id;
    for (const n of Object.values(nodes)) {
      if (n.parentId === null && n.id !== rootId) {
        n.parentId = rootId;
        root.childIds.push(n.id);
      }
    }
  }

  return {
    version: 1,
    id: uid(),
    title: nodes[rootId]?.text ?? "Mindmap",
    rootId,
    nodes,
    layout: "tree",
  };
}
