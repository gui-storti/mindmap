import { useStore } from "../core/store";
import type { Engine } from "../core/engine/Engine";

interface Props {
  engine: React.RefObject<Engine | null>;
}

export function Breadcrumbs({ engine }: Props) {
  const selectedId = useStore((s) => s.selectedId);
  const nodes = useStore((s) => s.nodes);
  const select = useStore((s) => s.select);
  const hasMap = useStore((s) => s.hasMap);

  if (!hasMap || !selectedId) return null;

  // walk up the parent chain to build the path root -> selected
  const path: string[] = [];
  let cur: string | null = selectedId;
  let guard = 0;
  while (cur && guard < 1000) {
    path.unshift(cur);
    cur = nodes[cur]?.parentId ?? null;
    guard++;
  }

  const go = (id: string) => {
    select(id);
    engine.current?.centerOn(id);
  };

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {path.map((id, i) => {
        const isLast = i === path.length - 1;
        return (
          <span key={id} className="crumb-wrap">
            {i > 0 && <span className="crumb-sep">/</span>}
            <button
              className={isLast ? "crumb active" : "crumb"}
              onClick={() => go(id)}
              title={nodes[id]?.text}
            >
              {nodes[id]?.text || "(untitled)"}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
