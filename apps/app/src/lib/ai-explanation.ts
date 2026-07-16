export const EXPLAIN_SCHEMA_VERSION = 1 as const;
export const EXPLAIN_MAX_NODES = 8;
export const EXPLAIN_MAX_EDGES = 10;
export const EXPLAIN_MAX_LABEL_LENGTH = 80;

export type VisualKind = "graph" | "tree" | "sequence" | "state" | "timeline" | "comparison";
export type VisualDirection = "TB" | "LR";
export type VisualNodeRole =
  | "concept"
  | "process"
  | "decision"
  | "state"
  | "actor"
  | "value"
  | "annotation";
export type VisualEdgeStyle = "solid" | "dashed" | "bidirectional";

export type VisualNode = {
  id: string;
  role: VisualNodeRole;
  label: string;
  detail?: string;
  groupId?: string;
  order?: number;
};

export type VisualEdge = {
  id: string;
  source: string;
  target: string;
  relation?: string;
  style?: VisualEdgeStyle;
};

export type VisualSpec = {
  kind: VisualKind;
  title: string;
  description: string;
  direction: VisualDirection;
  nodes: VisualNode[];
  edges: VisualEdge[];
  groups?: { id: string; label: string; nodeIds: string[] }[];
  lanes?: { id: string; label: string; order: number }[];
  altText: string;
};

export type ExplainCardPayload = {
  schemaVersion: typeof EXPLAIN_SCHEMA_VERSION;
  paragraphs: string[];
  visual: VisualSpec | null;
};

export function isExplainCardPayload(value: unknown): value is ExplainCardPayload {
  if (!value || typeof value !== "object") return false;
  if (new TextEncoder().encode(JSON.stringify(value)).length > 32_000) return false;
  const payload = value as Partial<ExplainCardPayload>;
  if (
    payload.schemaVersion !== EXPLAIN_SCHEMA_VERSION ||
    !Array.isArray(payload.paragraphs) ||
    payload.paragraphs.length < 3 ||
    payload.paragraphs.length > 7 ||
    payload.paragraphs.some((paragraph) => !safeText(paragraph))
  ) {
    return false;
  }
  return payload.visual === null || isVisualSpec(payload.visual);
}

export function isVisualSpec(value: unknown): value is VisualSpec {
  if (!value || typeof value !== "object") return false;
  const visual = value as Partial<VisualSpec>;
  const kinds: VisualKind[] = ["graph", "tree", "sequence", "state", "timeline", "comparison"];
  const roles: VisualNodeRole[] = [
    "concept",
    "process",
    "decision",
    "state",
    "actor",
    "value",
    "annotation",
  ];
  if (
    !kinds.includes(visual.kind as VisualKind) ||
    (visual.direction !== "TB" && visual.direction !== "LR") ||
    !safeText(visual.title) ||
    !safeText(visual.description) ||
    !safeText(visual.altText) ||
    !Array.isArray(visual.nodes) ||
    visual.nodes.length === 0 ||
    visual.nodes.length > EXPLAIN_MAX_NODES ||
    !Array.isArray(visual.edges) ||
    visual.edges.length > EXPLAIN_MAX_EDGES
  ) {
    return false;
  }
  const ids = new Set<string>();
  for (const node of visual.nodes) {
    if (
      !node ||
      typeof node !== "object" ||
      typeof node.id !== "string" ||
      ids.has(node.id) ||
      !/^[A-Za-z0-9_-]+$/.test(node.id) ||
      !roles.includes(node.role as VisualNodeRole) ||
      !safeLimitedText(node.label, EXPLAIN_MAX_LABEL_LENGTH) ||
      (node.detail !== undefined && !safeText(node.detail)) ||
      (node.order !== undefined && !Number.isInteger(node.order))
    ) {
      return false;
    }
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of visual.edges) {
    if (
      !edge ||
      typeof edge !== "object" ||
      typeof edge.id !== "string" ||
      edgeIds.has(edge.id) ||
      !ids.has(edge.source) ||
      !ids.has(edge.target) ||
      edge.source === edge.target ||
      (edge.relation !== undefined && !safeLimitedText(edge.relation, EXPLAIN_MAX_LABEL_LENGTH)) ||
      (edge.style !== undefined && !["solid", "dashed", "bidirectional"].includes(edge.style))
    ) {
      return false;
    }
    edgeIds.add(edge.id);
  }
  if (
    visual.groups !== undefined &&
    (!Array.isArray(visual.groups) ||
      visual.groups.some(
        (group) =>
          !group ||
          !safeLimitedText(group.label, EXPLAIN_MAX_LABEL_LENGTH) ||
          !Array.isArray(group.nodeIds) ||
          group.nodeIds.some((id) => !ids.has(id)),
      ))
  ) {
    return false;
  }
  if (visual.lanes !== undefined) {
    const lanes = visual.lanes;
    if (
      !Array.isArray(lanes) ||
      lanes.some((lane) => !lane || !safeLimitedText(lane.label, EXPLAIN_MAX_LABEL_LENGTH)) ||
      lanes.some((lane, index) => index > 0 && lane.order <= lanes[index - 1].order)
    ) {
      return false;
    }
  }
  if (visual.kind === "tree" && hasCycle(visual.nodes, visual.edges)) return false;
  if (visual.kind === "sequence" || visual.kind === "timeline") {
    const orders = visual.nodes.map((node) => node.order);
    if (!orders.every((order): order is number => typeof order === "number")) {
      return false;
    }
    if (orders.some((order, index) => index > 0 && order <= orders[index - 1])) return false;
  }
  return true;
}

function safeText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !value.includes("```") &&
    !value.includes("<") &&
    !value.includes(">") &&
    !value.includes("http://") &&
    !value.includes("https://")
  );
}

function safeLimitedText(value: unknown, max: number): value is string {
  return safeText(value) && value.length <= max;
}

function hasCycle(nodes: VisualNode[], edges: VisualEdge[]): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    if (edges.filter((edge) => edge.source === id).some((edge) => visit(edge.target))) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}

export type ExplanationGraphNode = {
  id: string;
  type: "semantic";
  position: { x: number; y: number };
  data: { role: VisualNodeRole; label: string; detail?: string };
};

export type ExplanationGraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated: false;
  style?: { strokeDasharray?: string };
};

export function buildExplanationGraph(
  visual: VisualSpec,
  direction: VisualDirection = visual.direction,
): {
  nodes: ExplanationGraphNode[];
  edges: ExplanationGraphEdge[];
} {
  if (!isVisualSpec(visual)) throw new Error("Visual explanation is not supported.");
  const incoming = new Map(visual.nodes.map((node) => [node.id, 0]));
  for (const edge of visual.edges) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  const levels = new Map<string, number>();
  const queue = visual.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  queue.forEach((id) => {
    levels.set(id, 0);
  });
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    const level = levels.get(id) ?? 0;
    for (const edge of visual.edges.filter((item) => item.source === id)) {
      if (!levels.has(edge.target)) {
        levels.set(edge.target, level + 1);
        queue.push(edge.target);
      }
    }
  }
  visual.nodes.forEach((node) => {
    levels.set(node.id, levels.get(node.id) ?? 0);
  });
  const ordered = [...visual.nodes].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id),
  );
  const lanes = new Map<number, number>();
  const nodes = ordered.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const index = lanes.get(level) ?? 0;
    lanes.set(level, index + 1);
    return {
      id: node.id,
      type: "semantic" as const,
      position:
        direction === "LR" ? { x: level * 180, y: index * 92 } : { x: index * 180, y: level * 92 },
      data: { role: node.role, label: node.label, detail: node.detail },
    };
  });
  const edges = visual.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.relation,
    animated: false as const,
    style: edge.style === "dashed" ? { strokeDasharray: "5 4" } : undefined,
  }));
  return { nodes, edges };
}
