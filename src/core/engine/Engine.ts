import type { LayoutMode, LayoutResult, PositionedNode } from "../types";
import { ForceSim } from "../force";

export interface Camera {
  x: number;
  y: number;
  z: number;
}

export interface EngineEvents {
  onSelect(id: string | null, opts?: { additive?: boolean }): void;
  onEdit(id: string): void;
  onContextMenu(id: string | null, x: number, y: number): void;
  onCamera(cam: Camera): void;
  onDropReparent(dragId: string, targetId: string): void;
  onNodeMoved(id: string, x: number, y: number): void;
}

export interface EngineState {
  rootId: string;
  nodes: Record<string, {
    color: string;
    imageId: string | null;
    annotations: { kind: string; color: string }[];
    collapsed: boolean;
  }>;
  images: Record<string, { url: string; w: number; h: number }>;
  selectedIds: string[];
  searchMatches: string[];
  editingId: string | null;
  layoutMode: LayoutMode;
  theme: "dark" | "light";
}

const THEME_COLORS = {
  dark: {
    text: "#e8ecf5",
    rootText: "#ffffff",
    annBg: "#0c0f17",
    bg: "#07090f",
    glassTop: "rgba(255,255,255,0.07)",
  },
  light: {
    text: "#1a2032",
    rootText: "#111827",
    annBg: "#ffffff",
    bg: "#f5f7fb",
    glassTop: "rgba(255,255,255,0.55)",
  },
} as const;

interface Visual {
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  alpha: number;
  edgeT: number;
}

export interface RenderOpts {
  ctx?: CanvasRenderingContext2D;
  W?: number;
  H?: number;
  dpr?: number;
  cam?: Camera;
  noHighlights?: boolean;
  background?: string;
}

const MIN_ZOOM = 0.04;
const MAX_ZOOM = 3.5;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
const rgbCache = new Map<string, [number, number, number]>();
export function rgba(hex: string, a: number): string {
  let c = rgbCache.get(hex);
  if (!c) {
    c = hexToRgb(hex);
    rgbCache.set(hex, c);
  }
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// de Casteljau split of a cubic at t -> first segment control points
function splitCubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [[number, number], [number, number], [number, number], [number, number]] {
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const L = (
    a: [number, number],
    b: [number, number]
  ): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const a = L(p0, p1);
  const b = L(p1, p2);
  const c = L(p2, p3);
  const d = L(a, b);
  const e = L(b, c);
  const f = L(d, e);
  return [p0, d, e, f];
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private events: EngineEvents;
  private getState: () => EngineState;

  private W = 0;
  private H = 0;
  private dpr = 1;

  private cam: Camera = { x: 0, y: 0, z: 1 };
  private camT: Camera = { x: 0, y: 0, z: 1 };
  private direct = false;

  private layout: LayoutResult | null = null;
  private visuals = new Map<string, Visual>();
  private sim = new ForceSim();
  private simActive = false;

  private selectedSet = new Set<string>();
  private searchSet = new Set<string>();
  private hoverId: string | null = null;
  private dropTargetId: string | null = null;
  private dragId: string | null = null;

  private images = new Map<string, HTMLImageElement>();
  private imageKeys = "";

  private raf = 0;
  private running = false;
  private lastT = 0;
  private destroyed = false;

  private pointers = new Map<number, { x: number; y: number }>();
  private gesture:
    | { kind: "none" }
    | { kind: "maybe-node"; id: string; sx: number; sy: number; ox: number; oy: number }
    | { kind: "node-drag"; id: string; ox: number; oy: number }
    | { kind: "maybe-pan"; sx: number; sy: number }
    | { kind: "pan"; sx: number; sy: number }
    | { kind: "pinch"; dist: number; mx: number; my: number } = { kind: "none" };

  private lastTap = { t: 0, x: 0, y: 0, id: "" };
  private longPressTimer = 0;
  private longPressFired = false;

  private ro: ResizeObserver;

  constructor(
    canvas: HTMLCanvasElement,
    events: EngineEvents,
    getState: () => EngineState
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.events = events;
    this.getState = getState;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.bindInput();
    this.kick();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }

  // ---------- camera ----------

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.kick();
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [
      (sx - this.W / 2) / this.cam.z + this.cam.x,
      (sy - this.H / 2) / this.cam.z + this.cam.y,
    ];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [
      (wx - this.cam.x) * this.cam.z + this.W / 2,
      (wy - this.cam.y) * this.cam.z + this.H / 2,
    ];
  }

  getCamera(): Camera {
    return { ...this.cam };
  }

  setLayout(layout: LayoutResult, mode: LayoutMode) {
    this.layout = layout;
    const ids = new Set<string>();
    for (const id of layout.positions.keys()) {
      ids.add(id);
      if (!this.visuals.has(id)) {
        const p = layout.positions.get(id)!;
        this.visuals.set(id, {
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          scale: 0.6,
          alpha: 0,
          edgeT: 0,
        });
      }
    }
    for (const id of [...this.visuals.keys()]) {
      if (!ids.has(id)) this.visuals.delete(id);
    }
    if (mode === "force") {
      const seed = new Map<string, { x: number; y: number }>();
      for (const [id, v] of this.visuals) seed.set(id, { x: v.x, y: v.y });
      this.sim.setGraph(
        [...layout.positions.keys()],
        layout.edges,
        seed
      );
      this.simActive = true;
    } else {
      this.simActive = false;
    }
    this.kick();
  }

  fitView(animate = true) {
    if (!this.layout) return;
    const b = this.layout.bbox;
    const pad = 60;
    const z = Math.min(
      (this.W - pad * 2) / Math.max(b.w, 1),
      (this.H - pad * 2) / Math.max(b.h, 1),
      1.6
    );
    this.camT = { x: b.x + b.w / 2, y: b.y + b.h / 2, z: Math.max(z, MIN_ZOOM) };
    if (!animate) this.cam = { ...this.camT };
    this.kick();
  }

  centerOn(id: string) {
    const v = this.visuals.get(id);
    if (!v) return;
    this.camT = { x: v.x, y: v.y, z: Math.max(this.camT.z, 0.8) };
    this.kick();
  }

  zoomToSelection(ids: string[]) {
    if (!this.layout || !ids.length) return;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const id of ids) {
      const v = this.visuals.get(id);
      const p = this.layout.positions.get(id);
      if (!v || !p) continue;
      const hw = (p.w * v.scale) / 2;
      const hh = (p.h * v.scale) / 2;
      x0 = Math.min(x0, v.x - hw);
      y0 = Math.min(y0, v.y - hh);
      x1 = Math.max(x1, v.x + hw);
      y1 = Math.max(y1, v.y + hh);
    }
    if (!isFinite(x0)) return;
    const w = Math.max(x1 - x0, 1);
    const h = Math.max(y1 - y0, 1);
    const pad = 80;
    const z = Math.min(
      (this.W - pad * 2) / w,
      (this.H - pad * 2) / h,
      1.6
    );
    this.camT = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.max(z, MIN_ZOOM) };
    this.kick();
  }

  /** Render the whole map to an offscreen canvas and return a PNG blob. */
  exportPNG(scale = 2): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const layout = this.layout;
      if (!layout) {
        reject(new Error("No layout to export"));
        return;
      }
      const bb = layout.bbox;
      const pad = 60;
      const W = Math.ceil(bb.w + pad * 2);
      const H = Math.ceil(bb.h + pad * 2);
      // cap output size for very large maps
      const maxDim = 16000;
      let s = scale;
      if (Math.max(W, H) * s > maxDim) {
        s = maxDim / Math.max(W, H);
      }
      const cam: Camera = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2, z: 1 };
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(W * s);
      canvas.height = Math.ceil(H * s);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("No 2d context"));
        return;
      }
      const savedSel = this.selectedSet;
      const savedSearch = this.searchSet;
      this.selectedSet = new Set();
      this.searchSet = new Set();
      try {
        const bg = THEME_COLORS[this.getState().theme].bg;
        this.render({ ctx, W, H, dpr: s, cam, noHighlights: true, background: bg });
      } finally {
        this.selectedSet = savedSel;
        this.searchSet = savedSearch;
      }
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png"
      );
    });
  }

  zoomBy(f: number) {
    this.camT.z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camT.z * f));
    this.kick();
  }

  setZoom(z: number) {
    this.camT.z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    this.kick();
  }

  getZoom(): number {
    return this.cam.z;
  }

  getViewSize(): { w: number; h: number } {
    return { w: this.W, h: this.H };
  }

  setCameraTarget(x: number, y: number, z?: number) {
    this.camT = { x, y, z: z ?? this.camT.z };
    this.kick();
  }

  getVisualPos(id: string): { x: number; y: number } | null {
    const v = this.visuals.get(id);
    return v ? { x: v.x, y: v.y } : null;
  }

  getScreenRect(id: string): { x: number; y: number; w: number; h: number } | null {
    const v = this.visuals.get(id);
    if (!v || !this.layout) return null;
    const p = this.layout.positions.get(id);
    if (!p) return null;
    const [sx, sy] = this.worldToScreen(v.x, v.y);
    return {
      x: sx - (p.w * this.cam.z * v.scale) / 2,
      y: sy - (p.h * this.cam.z * v.scale) / 2,
      w: p.w * this.cam.z * v.scale,
      h: p.h * this.cam.z * v.scale,
    };
  }

  // ---------- input ----------

  private bindInput() {
    const c = this.canvas;
    c.addEventListener("pointerdown", this.onPointerDown);
    c.addEventListener("pointermove", this.onPointerMove);
    c.addEventListener("pointerup", this.onPointerUp);
    c.addEventListener("pointercancel", this.onPointerUp);
    c.addEventListener("wheel", this.onWheel, { passive: false });
    c.addEventListener("contextmenu", this.onContextMenu);
  }

  private pos(e: PointerEvent | WheelEvent | MouseEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private hitTest(wx: number, wy: number, exclude?: string): string | null {
    if (!this.layout) return null;
    const order: string[] = [];
    for (const [id, v] of this.visuals) {
      if (id === exclude) continue;
      const p = this.layout.positions.get(id);
      if (!p) continue;
      const m = 6;
      if (
        wx > v.x - p.w / 2 - m &&
        wx < v.x + p.w / 2 + m &&
        wy > v.y - p.h / 2 - m &&
        wy < v.y + p.h / 2 + m
      ) {
        order.push(id);
      }
    }
    return order.length ? order[order.length - 1] : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = this.pos(e);
    this.pointers.set(e.pointerId, { x: sx, y: sy });
    this.longPressFired = false;

    if (this.pointers.size === 1) {
      const [wx, wy] = this.screenToWorld(sx, sy);
      const hit = this.hitTest(wx, wy);
      if (hit) {
        const v = this.visuals.get(hit)!;
        this.gesture = {
          kind: "maybe-node",
          id: hit,
          sx,
          sy,
          ox: wx - v.x,
          oy: wy - v.y,
        };
        if (e.pointerType === "touch") {
          this.longPressTimer = window.setTimeout(() => {
            if (this.gesture.kind === "maybe-node" && !this.longPressFired) {
              this.longPressFired = true;
              this.events.onContextMenu(hit, sx, sy);
            }
          }, 500);
        }
      } else {
        this.gesture = { kind: "maybe-pan", sx, sy };
      }
      this.kick();
    } else if (this.pointers.size === 2) {
      clearTimeout(this.longPressTimer);
      const pts = [...this.pointers.values()];
      this.gesture = {
        kind: "pinch",
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mx: (pts[0].x + pts[1].x) / 2,
        my: (pts[0].y + pts[1].y) / 2,
      };
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const [sx, sy] = this.pos(e);
    const prev = this.pointers.get(e.pointerId);
    if (prev) this.pointers.set(e.pointerId, { x: sx, y: sy });

    if (this.pointers.size === 0) {
      // hover (mouse)
      const [wx, wy] = this.screenToWorld(sx, sy);
      const hit = this.hitTest(wx, wy);
      if (hit !== this.hoverId) {
        this.hoverId = hit;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
        this.kick();
      }
      return;
    }

    if (this.gesture.kind === "pinch" && this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2;
      const my = (pts[0].y + pts[1].y) / 2;
      const g = this.gesture as Extract<typeof this.gesture, { kind: "pinch" }>;
      const scale = g.dist > 0 ? dist / g.dist : 1;
      const worldMid = this.screenToWorld(g.mx, g.my);
      const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camT.z * scale));
      this.camT = {
        x: worldMid[0] - (mx - this.W / 2) / nz,
        y: worldMid[1] - (my - this.H / 2) / nz,
        z: nz,
      };
      g.dist = dist;
      g.mx = mx;
      g.my = my;
      this.direct = true;
      this.kick();
      return;
    }

    if (this.gesture.kind === "maybe-node") {
      const g = this.gesture;
      if (Math.hypot(sx - g.sx, sy - g.sy) > 5) {
        clearTimeout(this.longPressTimer);
        this.gesture = { kind: "node-drag", id: g.id, ox: g.ox, oy: g.oy };
        this.dragId = g.id;
        this.canvas.style.cursor = "grabbing";
      }
      return;
    }

    if (this.gesture.kind === "node-drag") {
      const g = this.gesture;
      const [wx, wy] = this.screenToWorld(sx, sy);
      const v = this.visuals.get(g.id);
      if (v) {
        v.x = wx - g.ox;
        v.y = wy - g.oy;
        v.vx = 0;
        v.vy = 0;
        if (this.simActive) this.sim.pin(g.id, v.x, v.y);
        const hit = this.hitTest(wx - g.ox, wy - g.oy, g.id);
        this.dropTargetId = hit && hit !== g.id ? hit : null;
      }
      this.kick();
      return;
    }

    if (this.gesture.kind === "maybe-pan") {
      const g = this.gesture;
      if (Math.hypot(sx - g.sx, sy - g.sy) > 4) {
        this.gesture = { kind: "pan", sx, sy };
        this.canvas.style.cursor = "grabbing";
      }
      return;
    }

    if (this.gesture.kind === "pan") {
      const g = this.gesture;
      const dx = sx - g.sx;
      const dy = sy - g.sy;
      this.camT.x -= dx / this.camT.z;
      this.camT.y -= dy / this.camT.z;
      g.sx = sx;
      g.sy = sy;
      this.direct = true;
      this.kick();
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const [sx, sy] = this.pos(e);
    this.pointers.delete(e.pointerId);
    clearTimeout(this.longPressTimer);

    const g = this.gesture;
    if (g.kind === "maybe-node" && !this.longPressFired) {
      const now = performance.now();
      const lt = this.lastTap;
      const isDouble =
        now - lt.t < 350 && Math.hypot(sx - lt.x, sy - lt.y) < 24 && lt.id === g.id;
      this.events.onSelect(g.id, { additive: e.shiftKey });
      if (isDouble) {
        this.events.onEdit(g.id);
        this.lastTap = { t: 0, x: 0, y: 0, id: "" };
      } else {
        this.lastTap = { t: now, x: sx, y: sy, id: g.id };
      }
    }

    if (g.kind === "node-drag") {
      const target = this.dropTargetId;
      this.dropTargetId = null;
      this.dragId = null;
      const v = this.visuals.get(g.id);
      if (target) {
        this.events.onDropReparent(g.id, target);
      } else if (this.simActive) {
        this.sim.unpin(g.id);
        this.sim.reheat(0.3);
      } else if (v) {
        // tree/radial: persist the free position so the node stays where dropped
        this.events.onNodeMoved(g.id, v.x, v.y);
      }
      if (v && !this.simActive) {
        v.vx = 0;
        v.vy = 0;
      }
    }

    if (this.pointers.size === 0) {
      this.gesture = { kind: "none" };
      this.direct = false;
      this.canvas.style.cursor = this.hoverId ? "pointer" : "grab";
    }
    this.kick();
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const [sx, sy] = this.pos(e);
    const factor = Math.exp(-e.deltaY * 0.0012);
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.camT.z * factor));
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.camT = {
      x: wx - (sx - this.W / 2) / nz,
      y: wy - (sy - this.H / 2) / nz,
      z: nz,
    };
    this.kick();
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const [sx, sy] = this.pos(e);
    const [wx, wy] = this.screenToWorld(sx, sy);
    const hit = this.hitTest(wx, wy);
    this.events.onContextMenu(hit, sx, sy);
  };

  // ---------- loop ----------

  private kick() {
    if (this.destroyed || this.running) return;
    this.running = true;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** Force a re-render (e.g. after a theme change). */
  invalidate() {
    this.kick();
  }

  private tick = (t: number) => {
    if (this.destroyed) return;
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    let active = false;

    // camera
    if (this.direct) {
      this.cam = { ...this.camT };
    } else {
      const k = 1 - Math.exp(-dt * 12);
      this.cam.x += (this.camT.x - this.cam.x) * k;
      this.cam.y += (this.camT.y - this.cam.y) * k;
      this.cam.z += (this.camT.z - this.cam.z) * k;
      if (
        Math.abs(this.camT.x - this.cam.x) > 0.05 ||
        Math.abs(this.camT.y - this.cam.y) > 0.05 ||
        Math.abs(this.camT.z - this.cam.z) > 0.0005
      ) {
        active = true;
      } else {
        this.cam = { ...this.camT };
      }
    }

    // node springs
    if (this.layout) {
      const stiff = 220;
      const damp = 24;
      for (const [id, v] of this.visuals) {
        const p = this.layout.positions.get(id);
        if (!p) continue;
        if (this.simActive) {
          const sn = this.sim.nodes.get(id);
          if (sn) {
            v.x = sn.x;
            v.y = sn.y;
          }
        } else if (this.dragId !== id) {
          const ax = (p.x - v.x) * stiff - v.vx * damp;
          const ay = (p.y - v.y) * stiff - v.vy * damp;
          v.vx += ax * dt;
          v.vy += ay * dt;
          v.x += v.vx * dt;
          v.y += v.vy * dt;
        }
        if (v.scale < 1) {
          v.scale = Math.min(1, v.scale + dt * 5);
          active = true;
        }
        if (v.alpha < 1) {
          v.alpha = Math.min(1, v.alpha + dt * 6);
          active = true;
        }
        if (v.edgeT < 1) {
          v.edgeT = Math.min(1, v.edgeT + dt * 3.2);
          active = true;
        }
        if (
          Math.abs(p.x - v.x) > 0.05 ||
          Math.abs(p.y - v.y) > 0.05 ||
          Math.abs(v.vx) > 0.05 ||
          Math.abs(v.vy) > 0.05
        ) {
          active = true;
        }
      }
      if (this.simActive) {
        this.sim.tick(dt * 1000);
        if (!this.sim.settled) active = true;
      }
    }

    this.syncImages();
    this.render();
    this.events.onCamera({ ...this.cam });

    if (active) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.running = false;
    }
  };

  private syncImages() {
    const st = this.getState();
    const key = Object.keys(st.images).join(",");
    if (key === this.imageKeys) return;
    this.imageKeys = key;
    const next = new Map<string, HTMLImageElement>();
    for (const [id, img] of Object.entries(st.images)) {
      const el = document.createElement("img");
      el.src = img.url;
      next.set(id, el);
    }
    this.images = next;
    this.kick();
  }

  // ---------- render ----------

  private render(opts?: RenderOpts) {
    const ctx = opts?.ctx ?? this.ctx;
    const W = opts?.W ?? this.W;
    const H = opts?.H ?? this.H;
    const dpr = opts?.dpr ?? this.dpr;
    const st = this.getState();
    const layout = this.layout;
    if (!opts?.noHighlights) {
      this.selectedSet = new Set(st.selectedIds);
      this.searchSet = new Set(st.searchMatches);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (opts?.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
    if (!layout) return;

    const { x: cx, y: cy, z } = opts?.cam ?? this.cam;
    const toSX = (wx: number) => (wx - cx) * z + W / 2;
    const toSY = (wy: number) => (wy - cy) * z + H / 2;

    // visible world rect (with margin)
    const m = 80;
    const wx0 = cx - (W / 2) / z - m / z;
    const wx1 = cx + (W / 2) / z + m / z;
    const wy0 = cy - (H / 2) / z - m / z;
    const wy1 = cy + (H / 2) / z + m / z;

    const inView = (p: PositionedNode, v: Visual) => {
      const hw = p.w / 2 + 40 / z;
      const hh = p.h / 2 + 40 / z;
      return v.x + hw > wx0 && v.x - hw < wx1 && v.y + hh > wy0 && v.y - hh < wy1;
    };

    // edges
    ctx.lineCap = "round";
    for (const [a, b] of layout.edges) {
      const va = this.visuals.get(a);
      const vb = this.visuals.get(b);
      const pa = layout.positions.get(a);
      const pb = layout.positions.get(b);
      if (!va || !vb || !pa || !pb) continue;
      if (!inView(pa, va) && !inView(pb, vb)) continue;
      const na = st.nodes[a];
      const nb = st.nodes[b];
      if (!na || !nb) continue;
      const t = Math.min(va.edgeT, vb.edgeT);
      if (t <= 0.01) continue;

      const colA = na.color;
      const colB = nb.color;
      const grad = ctx.createLinearGradient(
        toSX(va.x), toSY(va.y), toSX(vb.x), toSY(vb.y)
      );
      grad.addColorStop(0, rgba(colA, 0.55));
      grad.addColorStop(1, rgba(colB, 0.55));
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, 2 * z);

      if (layout.mode === "tree") {
        const dir = vb.x >= va.x ? 1 : -1;
        const p0: [number, number] = [
          toSX(va.x + (dir * pa.w) / 2),
          toSY(va.y),
        ];
        const p3: [number, number] = [
          toSX(vb.x - (dir * pb.w) / 2),
          toSY(vb.y),
        ];
        const dxm = Math.abs(p3[0] - p0[0]) * 0.5;
        const p1: [number, number] = [p0[0] + dir * dxm, p0[1]];
        const p2: [number, number] = [p3[0] - dir * dxm, p3[1]];
        const [q0, q1, q2, q3] = t < 1 ? splitCubic(p0, p1, p2, p3, t) : [p0, p1, p2, p3];
        ctx.beginPath();
        ctx.moveTo(q0[0], q0[1]);
        ctx.bezierCurveTo(q1[0], q1[1], q2[0], q2[1], q3[0], q3[1]);
        ctx.stroke();
      } else {
        const x1 = toSX(va.x);
        const y1 = toSY(va.y);
        const x2 = toSX(vb.x) - ((toSX(vb.x) - x1) * (1 - t));
        const y2 = toSY(vb.y) - ((toSY(vb.y) - y1) * (1 - t));
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    // nodes
    for (const [id, v] of this.visuals) {
      const p = layout.positions.get(id);
      if (!p) continue;
      if (!inView(p, v)) continue;
      const node = st.nodes[id];
      if (!node) continue;
      this.drawNode(ctx, id, node.color, p, v, toSX, toSY, st, z);
    }
  }

  private drawNode(
    ctx: CanvasRenderingContext2D,
    id: string,
    color: string,
    p: PositionedNode,
    v: Visual,
    toSX: (x: number) => number,
    toSY: (y: number) => number,
    st: EngineState,
    z: number
  ) {
    const sx = toSX(v.x);
    const sy = toSY(v.y);
    const sw = p.w * z * v.scale;
    const sh = p.h * z * v.scale;
    const x = sx - sw / 2;
    const y = sy - sh / 2;
    const r = 11 * z * v.scale;
    const selected = this.selectedSet.has(id);
    const hovered = this.hoverId === id;
    const isDrop = this.dropTargetId === id;
    const isMatch = this.searchSet.has(id);
    const isRoot = id === st.rootId;
    const lod: 0 | 1 | 2 = z < 0.2 ? 0 : z < 0.5 ? 1 : 2;
    const tc = THEME_COLORS[st.theme];

    const highlight = node_highlight(st.nodes[id]?.annotations ?? []);
    const fillBase = highlight ?? rgba(color, 0.13);

    ctx.globalAlpha = v.alpha;

    if (lod === 0) {
      roundRect(ctx, x, y, sw, sh, r);
      ctx.fillStyle = rgba(color, 0.4);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const glowColor = isDrop ? "#5ee7ff" : isMatch ? "#fbbf24" : color;
    if (selected || isDrop || isMatch) {
      ctx.shadowColor = rgba(glowColor, 0.8);
      ctx.shadowBlur = 26 * z;
    }
    roundRect(ctx, x, y, sw, sh, r);
    ctx.fillStyle = fillBase;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.lineWidth = (selected || isDrop || isMatch ? 2 : 1.2) * z;
    ctx.strokeStyle = rgba(
      glowColor,
      selected || isDrop ? 0.95 : isMatch ? 0.9 : hovered ? 0.75 : 0.4
    );
    ctx.stroke();

    // inner top highlight (glass)
    if (lod === 2) {
      ctx.save();
      roundRect(ctx, x, y, sw, sh, r);
      ctx.clip();
      const g = ctx.createLinearGradient(0, y, 0, y + sh);
      g.addColorStop(0, tc.glassTop);
      g.addColorStop(0.5, "rgba(255,255,255,0.015)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, sw, sh);
      ctx.restore();
    }

    const img = st.nodes[id]?.imageId
      ? this.images.get(st.nodes[id].imageId!)
      : undefined;

    if (lod === 2 && img && p.imgH > 0 && img.complete) {
      const pad = p.padX * z * v.scale;
      const iw = sw - pad * 2;
      const ih = p.imgH * z * v.scale;
      const ix = x + pad;
      const iy = y + pad;
      ctx.save();
      roundRect(ctx, ix, iy, iw, ih, 8 * z);
      ctx.clip();
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.restore();
    }

    if (lod >= 1 && st.editingId !== id) {
      const textY0 = y + (p.imgH > 0 ? (p.imgH + 10) * z * v.scale : 0);
      const lh = p.fontPx * 1.42 * z * v.scale;
      ctx.font = `${p.weight} ${p.fontPx * z * v.scale}px 'Inter Variable', system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isRoot ? tc.rootText : tc.text;
      const totalH = p.lines.length * lh;
      let ty = textY0 + (sh - (p.imgH > 0 ? (p.imgH + 10) * z * v.scale : 0)) / 2 + totalH / 2 - lh / 2;
      for (const line of p.lines) {
        ctx.fillText(line, sx, ty);
        ty += lh;
      }
    }

    // annotation badge
    const anns = st.nodes[id]?.annotations ?? [];
    if (anns.length > 0 && lod === 2) {
      const bx = x + sw - 2 * z;
      const by = y + 2 * z;
      ctx.beginPath();
      ctx.arc(bx, by, 7.5 * z, 0, Math.PI * 2);
      ctx.fillStyle = tc.annBg;
      ctx.fill();
      ctx.strokeStyle = rgba(anns[0].color, 0.9);
      ctx.lineWidth = 1.5 * z;
      ctx.stroke();
      ctx.font = `600 ${9 * z}px 'Inter Variable', system-ui, sans-serif`;
      ctx.fillStyle = anns[0].color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(anns.length), bx, by + 0.5 * z);
    }

    // collapsed indicator
    if (st.nodes[id]?.collapsed && lod === 2) {
      const bx = x + sw + 10 * z;
      ctx.beginPath();
      ctx.arc(bx, sy, 5 * z, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.9);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

function node_highlight(
  anns: { kind: string; color: string }[]
): string | null {
  for (const a of anns) {
    if (a.kind === "highlight") return rgba(a.color, 0.16);
  }
  return null;
}
