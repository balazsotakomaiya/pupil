import { describe, expect, it } from "vitest";
import {
  buildExplanationGraph,
  type ExplainCardPayload,
  isExplainCardPayload,
} from "./ai-explanation";

const visual = {
  kind: "sequence" as const,
  title: "A short process",
  description: "The important steps.",
  direction: "LR" as const,
  nodes: [
    { id: "one", role: "process" as const, label: "First", order: 1 },
    { id: "two", role: "process" as const, label: "Second", order: 2 },
  ],
  edges: [{ id: "step", source: "one", target: "two", relation: "then" }],
  altText: "First step leads to second step.",
};

describe("AI explanation contract", () => {
  it("accepts prose-only and each bounded visual contract shape", () => {
    const payload: ExplainCardPayload = {
      schemaVersion: 1,
      paragraphs: ["Explain it.", "Here is the context.", "This completes the explanation."],
      visual,
    };
    expect(isExplainCardPayload(payload)).toBe(true);
    for (const kind of ["graph", "tree", "state", "timeline", "comparison"] as const) {
      const next = {
        ...visual,
        kind,
        ...(kind === "timeline"
          ? {}
          : { nodes: visual.nodes.map((node) => ({ ...node, order: undefined })) }),
      };
      if (kind === "timeline")
        expect(isExplainCardPayload({ ...payload, visual: next })).toBe(true);
      else expect(isExplainCardPayload({ ...payload, visual: next })).toBe(true);
    }
  });

  it("rejects unsupported, oversized, and dangling data", () => {
    expect(isExplainCardPayload({ schemaVersion: 2, paragraphs: ["x"], visual: null })).toBe(false);
    expect(
      isExplainCardPayload({
        schemaVersion: 1,
        paragraphs: ["x".repeat(100), "y".repeat(100), "z".repeat(100)],
        visual: null,
      }),
    ).toBe(true);
    expect(
      isExplainCardPayload({
        schemaVersion: 1,
        paragraphs: ["x"],
        visual: { ...visual, edges: [{ id: "bad", source: "one", target: "missing" }] },
      }),
    ).toBe(false);
    expect(
      isExplainCardPayload({
        schemaVersion: 1,
        paragraphs: ["x"],
        visual: { ...visual, kind: "unknown" },
      }),
    ).toBe(false);
  });

  it("rejects cycles in trees and non-monotonic sequences", () => {
    expect(
      isExplainCardPayload({
        schemaVersion: 1,
        paragraphs: ["x"],
        visual: {
          ...visual,
          kind: "tree",
          edges: [
            { id: "a", source: "one", target: "two" },
            { id: "b", source: "two", target: "one" },
          ],
        },
      }),
    ).toBe(false);
    expect(
      isExplainCardPayload({
        schemaVersion: 1,
        paragraphs: ["x"],
        visual: { ...visual, nodes: visual.nodes.map((node) => ({ ...node, order: 1 })) },
      }),
    ).toBe(false);
  });

  it("creates deterministic positions for the read-only renderer", () => {
    const graph = buildExplanationGraph(visual);
    expect(graph.nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 180, y: 0 },
    ]);
    expect(graph.edges[0].label).toBe("then");
  });

  it("can use a wider display direction without changing the payload contract", () => {
    const graph = buildExplanationGraph({ ...visual, direction: "TB" }, "LR");

    expect(graph.nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 180, y: 0 },
    ]);
  });
});
