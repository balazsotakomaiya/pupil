import {
  Background,
  Controls,
  Handle,
  type NodeProps,
  Position,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";
import { Component, type ErrorInfo, type ReactNode, useEffect, useRef } from "react";
import {
  buildExplanationGraph,
  type ExplanationGraphEdge,
  type ExplanationGraphNode,
  type VisualSpec,
} from "../../lib/ai-explanation";
import styles from "./StudyExplainVisual.module.css";
// React Flow ships global base classes required by its canvas internals.
import "@xyflow/react/dist/style.css";

type StudyExplainVisualProps = {
  isExpanded: boolean;
  onToggleExpanded: () => void;
  visual: VisualSpec;
};

export function StudyExplainVisual({
  isExpanded,
  onToggleExpanded,
  visual,
}: StudyExplainVisualProps) {
  return (
    <VisualErrorBoundary>
      <StudyExplainFlow
        isExpanded={isExpanded}
        onToggleExpanded={onToggleExpanded}
        visual={visual}
      />
    </VisualErrorBoundary>
  );
}

function StudyExplainFlow({ isExpanded, onToggleExpanded, visual }: StudyExplainVisualProps) {
  const displayDirection =
    isExpanded && (visual.kind === "sequence" || visual.kind === "timeline")
      ? "LR"
      : visual.direction;
  const { nodes, edges } = buildExplanationGraph(visual, displayDirection);
  const left = Math.min(...nodes.map((node) => node.position.x));
  const top = Math.min(...nodes.map((node) => node.position.y));
  const right = Math.max(...nodes.map((node) => node.position.x + 138));
  const bottom = Math.max(...nodes.map((node) => node.position.y + 58));
  const translateExtent: [[number, number], [number, number]] = [
    [left - 160, top - 120],
    [right + 160, bottom + 120],
  ];
  const flowRef = useRef<ReactFlowInstance<ExplanationGraphNode, ExplanationGraphEdge> | null>(
    null,
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      flowRef.current?.fitView({ duration: 180, padding: 0.16 });
    }, 230);

    return () => window.clearTimeout(timeoutId);
  }, [isExpanded]);

  return (
    <section aria-label={visual.altText} className={styles.visualSection}>
      <div className={styles.visualHeading}>
        <div>
          <h3>{visual.title}</h3>
          <p>{visual.description}</p>
        </div>
        <div className={styles.visualHeadingActions}>
          <span aria-hidden="true">Visual aid</span>
          <button
            aria-label={isExpanded ? "Exit visual fullscreen" : "Expand visual fullscreen"}
            aria-pressed={isExpanded}
            className={styles.visualExpandButton}
            onClick={onToggleExpanded}
            title={isExpanded ? "Exit fullscreen" : "Expand fullscreen"}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              {isExpanded ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
              )}
            </svg>
          </button>
        </div>
      </div>
      <p className={styles.visualAlt}>{visual.altText}</p>
      <div className={`${styles.flowCanvas}${isExpanded ? ` ${styles.expanded}` : ""}`}>
        <ReactFlow
          aria-label={visual.altText}
          elementsSelectable={false}
          fitView
          maxZoom={2}
          minZoom={0.35}
          nodes={nodes}
          edges={edges}
          nodeTypes={{ semantic: SemanticNode }}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => {
            void flowRef.current?.setCenter(node.position.x + 69, node.position.y + 29, {
              duration: 180,
              zoom: 1.25,
            });
          }}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          panOnDrag
          panOnScroll={false}
          zoomOnDoubleClick={false}
          zoomOnPinch={false}
          zoomOnScroll={false}
          preventScrolling
          proOptions={{ hideAttribution: true }}
          translateExtent={translateExtent}
        >
          <Controls showInteractive={false} />
          <Background color="var(--border)" gap={18} size={1} />
        </ReactFlow>
      </div>
    </section>
  );
}

function SemanticNode({ data }: NodeProps) {
  const nodeData = data as ExplanationGraphNode["data"];
  return (
    <div className={`${styles.visualNode} ${styles[nodeData.role]}`}>
      <Handle className={styles.handle} position={Position.Top} type="target" />
      <span className={styles.nodeRole}>{nodeData.role}</span>
      <strong>{nodeData.label}</strong>
      {nodeData.detail ? <small>{nodeData.detail}</small> : null}
      <Handle className={styles.handle} position={Position.Bottom} type="source" />
    </div>
  );
}

class VisualErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn("Explanation visual unavailable", error);
  }

  render() {
    return this.state.failed ? (
      <div className={styles.visualFallback} role="note">
        Visual unavailable. The explanation above remains complete.
      </div>
    ) : (
      this.props.children
    );
  }
}
