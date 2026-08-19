export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
}

const REST_LENGTH = 130;
const SPRING_K = 0.035;
const CENTER_K = 0.00045;
const REPEL_K = 2600;
const CUTOFF = 240;
const CELL = 120;
const DAMPING = 0.86;

export class ForceSim {
  nodes = new Map<string, ForceNode>();
  edges: [string, string][] = [];
  alpha = 0;

  setGraph(
    ids: string[],
    edges: [string, string][],
    seed: Map<string, { x: number; y: number }>
  ) {
    const prev = this.nodes;
    const next = new Map<string, ForceNode>();
    for (const id of ids) {
      const old = prev.get(id);
      const s = seed.get(id);
      next.set(id, {
        id,
        x: old ? old.x : s ? s.x : (Math.random() - 0.5) * 600,
        y: old ? old.y : s ? s.y : (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
        pinned: false,
      });
    }
    this.nodes = next;
    this.edges = edges;
    this.alpha = 1;
  }

  pin(id: string, x: number, y: number) {
    const n = this.nodes.get(id);
    if (n) {
      n.x = x;
      n.y = y;
      n.vx = 0;
      n.vy = 0;
      n.pinned = true;
    }
  }

  unpin(id: string) {
    const n = this.nodes.get(id);
    if (n) n.pinned = false;
  }

  reheat(a = 0.6) {
    this.alpha = Math.max(this.alpha, a);
  }

  get settled(): boolean {
    return this.alpha < 0.004;
  }

  tick(dt: number) {
    if (this.settled) return;
    const step = Math.min(dt, 32) / 16.7;
    const ns = [...this.nodes.values()];

    // grid binning for repulsion
    const bins = new Map<string, ForceNode[]>();
    for (const n of ns) {
      const key = `${Math.floor(n.x / CELL)},${Math.floor(n.y / CELL)}`;
      const arr = bins.get(key);
      if (arr) arr.push(n);
      else bins.set(key, [n]);
    }

    const fx = new Map<string, number>();
    const fy = new Map<string, number>();
    for (const n of ns) {
      fx.set(n.id, 0);
      fy.set(n.id, 0);
    }

    const cutoff2 = CUTOFF * CUTOFF;
    for (const n of ns) {
      const cx = Math.floor(n.x / CELL);
      const cy = Math.floor(n.y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const arr = bins.get(`${gx},${gy}`);
          if (!arr) continue;
          for (const m of arr) {
            if (m.id === n.id) continue;
            const dx = n.x - m.x;
            const dy = n.y - m.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > cutoff2 || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const f = (REPEL_K / d2) * this.alpha;
            fx.set(n.id, fx.get(n.id)! + (dx / d) * f);
            fy.set(n.id, fy.get(n.id)! + (dy / d) * f);
          }
        }
      }
    }

    // springs
    for (const [a, b] of this.edges) {
      const na = this.nodes.get(a);
      const nb = this.nodes.get(b);
      if (!na || !nb) continue;
      const dx = nb.x - na.x;
      const dy = nb.y - na.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - REST_LENGTH) * SPRING_K * this.alpha;
      const ux = dx / d;
      const uy = dy / d;
      fx.set(a, fx.get(a)! + ux * f);
      fy.set(a, fy.get(a)! + uy * f);
      fx.set(b, fx.get(b)! - ux * f);
      fy.set(b, fy.get(b)! - uy * f);
    }

    // centering + integrate
    for (const n of ns) {
      if (n.pinned) continue;
      const fxc = fx.get(n.id)! - n.x * CENTER_K * this.alpha * 10;
      const fyc = fy.get(n.id)! - n.y * CENTER_K * this.alpha * 10;
      n.vx = (n.vx + fxc * step) * DAMPING;
      n.vy = (n.vy + fyc * step) * DAMPING;
      n.x += n.vx * step;
      n.y += n.vy * step;
    }

    this.alpha *= 0.9965;
  }
}
