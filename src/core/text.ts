import type { ImageAsset, MindNode, NodeMetrics } from "./types";

export const FONT_UI = "'Inter Variable', system-ui, -apple-system, sans-serif";
export const FONT_DISPLAY = "'Sora Variable', 'Inter Variable', system-ui, sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx2d(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d")!;
  }
  return measureCtx;
}

const cache = new Map<string, { lines: string[]; w: number; h: number }>();
const MAX_CACHE = 8000;

function wrapText(
  c: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontPx: number,
  weight: number,
  maxLines: number
): { lines: string[]; w: number; h: number } {
  c.font = `${weight} ${fontPx}px ${FONT_UI}`;
  const lineHeight = Math.round(fontPx * 1.42);
  const lines: string[] = [];
  let longest = 0;

  const pushLine = (s: string) => {
    lines.push(s);
    longest = Math.max(longest, c.measureText(s).width);
  };

  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      pushLine("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const attempt = line ? line + " " + word : word;
      if (c.measureText(attempt).width <= maxWidth || !line) {
        // if a single word is too wide, hard-break it
        if (c.measureText(attempt).width > maxWidth && line) {
          pushLine(line);
          line = "";
          let piece = "";
          for (const ch of word) {
            const p = piece + ch;
            if (c.measureText(p).width > maxWidth && piece) {
              pushLine(piece);
              piece = ch;
            } else {
              piece = p;
            }
          }
          line = piece;
        } else {
          line = attempt;
        }
      } else {
        pushLine(line);
        line = word;
      }
    }
    if (line) pushLine(line);
    if (lines.length >= maxLines) break;
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    let s = last;
    while (c.measureText(s + "…").width > maxWidth && s.length > 1) {
      s = s.slice(0, -1);
    }
    lines[maxLines - 1] = s + "…";
    longest = Math.max(longest, c.measureText(s + "…").width);
  }

  return { lines, w: Math.ceil(longest), h: lines.length * lineHeight };
}

export function measureNode(
  text: string,
  isRoot: boolean,
  image: ImageAsset | null
): NodeMetrics {
  const fontPx = isRoot ? 17 : 14;
  const weight = isRoot ? 700 : 500;
  const padX = isRoot ? 22 : 16;
  const padY = isRoot ? 16 : 12;
  const maxTextW = isRoot ? 240 : 190;
  const maxLines = isRoot ? 3 : 3;

  const key = `${text}|${isRoot}|${image ? image.w + "x" + image.h : ""}`;
  let hit = cache.get(key);
  if (!hit) {
    if (cache.size > MAX_CACHE) cache.clear();
    hit = wrapText(ctx2d(), text || " ", maxTextW, fontPx, weight, maxLines);
    cache.set(key, hit);
  }

  let w = hit.w + padX * 2;
  let imgH = 0;
  if (image) {
    const minW = isRoot ? 150 : 110;
    w = Math.max(w, minW);
    const innerW = w - padX * 2;
    imgH = Math.min(innerW * (image.h / image.w), isRoot ? 170 : 130);
  }
  const h = hit.h + padY * 2 + (imgH > 0 ? imgH + 10 : 0);

  return { w, h, lines: hit.lines, fontPx, weight, padX, padY, imgH };
}

export function nodeMetrics(
  node: MindNode,
  isRoot: boolean,
  images: Record<string, ImageAsset>
): NodeMetrics {
  const image = node.imageId ? images[node.imageId] ?? null : null;
  return measureNode(node.text, isRoot, image);
}
