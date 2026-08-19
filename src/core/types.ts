export type LayoutMode = "tree" | "radial" | "force";

export interface Annotation {
  id: string;
  kind: "note" | "highlight";
  text: string;
  color: string;
  createdAt: number;
}

export interface MindNode {
  id: string;
  text: string;
  parentId: string | null;
  childIds: string[];
  color: string;
  imageId: string | null;
  annotations: Annotation[];
  collapsed: boolean;
  /** Manual (free) position override in world coords. `null` = use auto layout. */
  pos: { x: number; y: number } | null;
}

export interface ImageAsset {
  url: string;
  w: number;
  h: number;
}

export interface MindMap {
  version: 1;
  title: string;
  rootId: string;
  nodes: Record<string, MindNode>;
  layout: LayoutMode;
}

export interface NodeMetrics {
  w: number;
  h: number;
  lines: string[];
  fontPx: number;
  weight: number;
  padX: number;
  padY: number;
  imgH: number;
}

export interface PositionedNode {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  fontPx: number;
  weight: number;
  padX: number;
  padY: number;
  imgH: number;
}

export interface LayoutResult {
  positions: Map<string, PositionedNode>;
  edges: [string, string][];
  bbox: { x: number; y: number; w: number; h: number };
  mode: LayoutMode;
}

export const NODE_COLORS = [
  "#8b7cff", // violet
  "#5ee7ff", // cyan
  "#f472b6", // pink
  "#fbbf24", // amber
  "#34d399", // green
  "#60a5fa", // blue
  "#fb923c", // orange
  "#f87171", // red
] as const;

export const HIGHLIGHT_COLORS = ["#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#8b7cff"] as const;
