import { useEffect, useRef } from "react";
import { useStore } from "../core/store";
import type { Engine } from "../core/engine/Engine";

interface Props {
  engine: React.RefObject<Engine | null>;
  camTick: number;
}

export function Minimap({ engine, camTick }: Props) {
  const layout = useStore((s) => s.layout);
  const layoutVersion = useStore((s) => s.layoutVersion);
  const nodes = useStore((s) => s.nodes);
  const rootId = useStore((s) => s.rootId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const e = engine.current;
    if (!canvas || !e || !layout) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const bb = layout.bbox;
    const pad = 10;
    const scale = Math.min((W - pad * 2) / bb.w, (H - pad * 2) / bb.h);
    const ox = (W - bb.w * scale) / 2 - bb.x * scale;
    const oy = (H - bb.h * scale) / 2 - bb.y * scale;
    const tx = (x: number) => x * scale + ox;
    const ty = (y: number) => y * scale + oy;

    for (const [id, p] of layout.positions) {
      const n = nodes[id];
      if (!n) continue;
      ctx.globalAlpha = id === rootId ? 1 : 0.8;
      ctx.fillStyle = n.color;
      const w = Math.max(2.5, p.w * scale);
      const h = Math.max(2.5, p.h * scale);
      ctx.beginPath();
      ctx.roundRect(tx(p.x), ty(p.y), w, h, 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const cam = e.getCamera();
    const { w: vw, h: vh } = e.getViewSize();
    const vx0 = cam.x - vw / 2 / cam.z;
    const vy0 = cam.y - vh / 2 / cam.z;
    const vw2 = (vw / cam.z) * scale;
    const vh2 = (vh / cam.z) * scale;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx(vx0), ty(vy0), vw2, vh2);
  }, [layout, layoutVersion, camTick, nodes, rootId, engine]);

  const navigate = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const e = engine.current;
    if (!canvas || !e || !layout) return;
    const r = canvas.getBoundingClientRect();
    const W = r.width;
    const H = r.height;
    const bb = layout.bbox;
    const pad = 10;
    const scale = Math.min((W - pad * 2) / bb.w, (H - pad * 2) / bb.h);
    const ox = (W - bb.w * scale) / 2 - bb.x * scale;
    const oy = (H - bb.h * scale) / 2 - bb.y * scale;
    const wx = (clientX - r.left - ox) / scale;
    const wy = (clientY - r.top - oy) / scale;
    e.setCameraTarget(wx, wy);
  };

  return (
    <div className="minimap">
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          dragRef.current = true;
          (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
          navigate(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragRef.current) navigate(e.clientX, e.clientY);
        }}
        onPointerUp={() => (dragRef.current = false)}
      />
    </div>
  );
}
