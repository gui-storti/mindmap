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
  /** Stable identity used by the local map library. */
  id: string;
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
  "#a3e635", // lime
  "#c084fc", // purple
  "#22d3ee", // teal
  "#e879f9", // fuchsia
  "#facc15", // yellow
  "#4ade80", // emerald
  "#38bdf8", // sky
  "#f43f5e", // rose
] as const;

export const HIGHLIGHT_COLORS = [
  "#fbbf24", // amber
  "#34d399", // green
  "#60a5fa", // blue
  "#f472b6", // pink
  "#8b7cff", // violet
  "#facc15", // yellow
  "#22d3ee", // teal
  "#fb923c", // orange
] as const;
