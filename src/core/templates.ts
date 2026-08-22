import { uid } from "./ids";
import { NODE_COLORS } from "./types";
import type { MindMap, MindNode } from "./types";

function node(text: string, parentId: string | null, color: string): MindNode {
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

function build(
  rootText: string,
  branches: { text: string; children?: string[] }[]
): MindMap {
  const nodes: Record<string, MindNode> = {};
  const root = node(rootText, null, NODE_COLORS[0]);
  nodes[root.id] = root;
  branches.forEach((b, i) => {
    const c = node(b.text, root.id, NODE_COLORS[(i + 1) % NODE_COLORS.length]);
    nodes[c.id] = c;
    root.childIds.push(c.id);
    (b.children ?? []).forEach((gc, j) => {
      const g = node(gc, c.id, NODE_COLORS[(i + j + 2) % NODE_COLORS.length]);
      nodes[g.id] = g;
      c.childIds.push(g.id);
    });
  });
  return { version: 1, id: uid(), title: rootText, rootId: root.id, nodes, layout: "tree" };
}

export interface Template {
  name: string;
  desc: string;
  build: () => MindMap;
}

export const TEMPLATES: Template[] = [
  {
    name: "Project plan",
    desc: "Goals, tasks, timeline, risks and team.",
    build: () =>
      build("Project", [
        { text: "Goals", children: ["Outcome", "KPIs"] },
        { text: "Tasks", children: ["Backlog", "In progress", "Done"] },
        { text: "Timeline", children: ["Milestones", "Deadlines"] },
        { text: "Risks" },
        { text: "Team", children: ["Roles", "Owners"] },
      ]),
  },
  {
    name: "SWOT",
    desc: "Strengths, weaknesses, opportunities, threats.",
    build: () =>
      build("SWOT", [
        { text: "Strengths" },
        { text: "Weaknesses" },
        { text: "Opportunities" },
        { text: "Threats" },
      ]),
  },
  {
    name: "Meeting notes",
    desc: "Agenda, decisions and action items.",
    build: () =>
      build("Meeting", [
        { text: "Agenda" },
        { text: "Decisions" },
        { text: "Action items", children: ["Owner", "Due"] },
        { text: "Notes" },
      ]),
  },
  {
    name: "Decision",
    desc: "Compare options and pick a path.",
    build: () =>
      build("Decision", [
        { text: "Option A", children: ["Pros", "Cons"] },
        { text: "Option B", children: ["Pros", "Cons"] },
        { text: "Option C", children: ["Pros", "Cons"] },
      ]),
  },
  {
    name: "Brainstorm",
    desc: "A blank canvas with starter branches.",
    build: () =>
      build("Idea", [
        { text: "Angle 1" },
        { text: "Angle 2" },
        { text: "Angle 3" },
      ]),
  },
];
