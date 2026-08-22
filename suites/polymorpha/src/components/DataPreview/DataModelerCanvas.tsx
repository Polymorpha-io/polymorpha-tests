import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Dataset, Column, Row } from "@/types";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./DataModelerCanvas.css";
import {
  Database,
  Combine,
  SplitSquareVertical,
  BarChart2,
  Download,
} from "lucide-react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ModelerNodeData extends Record<string, unknown> {
  label?: string;
  sourceId?: string;
  rowCount?: number;
  colCount?: number;
  isTruncated?: boolean;
  previewLimit?: number;
  joinType?: string;
}

type ModelerNode = Node<ModelerNodeData>;

// Custom Node for Data Sources (CSV/Excel)
const DataSourceNode = ({ data, selected }: NodeProps<ModelerNode>) => (
  <div className={`modeler-node source-node ${selected ? "selected" : ""}`}>
    <div className="modeler-node-header">
      <Database size={16} />
      <span>{data.label}</span>
    </div>
    <div className="modeler-node-body">
      {data.rowCount ?? "?"} rows · {data.colCount ?? "?"} cols
    </div>
    <Handle type="source" position={Position.Right} id="out" />
  </div>
);

// Custom Node for Joins
const JoinNode = ({ data, selected }: NodeProps<ModelerNode>) => (
  <div className={`modeler-node join-node ${selected ? "selected" : ""}`}>
    <Handle
      type="target"
      position={Position.Left}
      id="left"
      style={{ top: "30%", background: "rgb(202, 138, 4)" }}
    />
    <div
      style={{
        position: "absolute",
        left: "-25px",
        top: "24%",
        fontSize: "10px",
        color: "rgb(202, 138, 4)",
      }}
    >
      Left
    </div>
    <Handle
      type="target"
      position={Position.Left}
      id="right"
      style={{ top: "70%", background: "rgb(202, 138, 4)" }}
    />
    <div
      style={{
        position: "absolute",
        left: "-30px",
        top: "64%",
        fontSize: "10px",
        color: "rgb(202, 138, 4)",
      }}
    >
      Right
    </div>
    <div className="modeler-node-header">
      <Combine size={16} />
      <span>{data.label || "Inner Join"}</span>
    </div>
    <Handle type="source" position={Position.Right} id="out" />
  </div>
);

// Custom Node for Appends (Unions)
const UnionNode = ({ data, selected }: NodeProps<ModelerNode>) => (
  <div className={`modeler-node union-node ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} id="in" />
    <div className="modeler-node-header">
      <SplitSquareVertical size={16} />
      <span>{data.label || "Union"}</span>
    </div>
    <Handle type="source" position={Position.Right} id="out" />
  </div>
);

// Custom Node for Aggregations
const AggregateNode = ({ data, selected }: NodeProps<ModelerNode>) => (
  <div className={`modeler-node aggregate-node ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} id="in" />
    <div className="modeler-node-header">
      <BarChart2 size={16} />
      <span>{data.label || "Aggregate"}</span>
    </div>
    <Handle type="source" position={Position.Right} id="out" />
  </div>
);

// Custom Node for Export
const ExportNode = ({ data, selected }: NodeProps<ModelerNode>) => (
  <div className={`modeler-node export-node ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Left} id="in" />
    <div className="modeler-node-header">
      <Download size={16} />
      <span>{data.label || "Export"}</span>
    </div>
  </div>
);

const nodeTypes = {
  dataSource: DataSourceNode,
  join: JoinNode,
  union: UnionNode,
  aggregate: AggregateNode,
  export: ExportNode,
};

const initialNodes: ModelerNode[] = [];
const initialEdges: Edge[] = [];

interface DataModelerCanvasProps {
  datasets?: Dataset[];
  totalRowCount?: number | null;
  previewLimit?: number;
  onModelChange?: (dataset: Dataset | null) => void;
  onPreviewChange?: (dataset: Dataset | null) => void;
  onExportNodeClick?: (dataset: Dataset) => void;
}

function CanvasInner({
  datasets = [],
  totalRowCount,
  previewLimit = 100,
  onModelChange,
  onPreviewChange,
  onExportNodeClick,
}: DataModelerCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const computedMapRef = useRef<Map<string, Dataset>>(new Map());
  const finalDatasetRef = useRef<Dataset | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onConnect = useCallback(
    (params: Connection | Edge) =>
      setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges],
  );

  // Auto-initialize the canvas with the primary dataset
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && nodes.length === 0 && datasets.length > 0) {
      hasInitialized.current = true;
      const primaryDataset = datasets[0];
      const effectiveRows =
        totalRowCount != null &&
        datasets[0].fileName === primaryDataset.fileName
          ? totalRowCount
          : primaryDataset.rows.length;
      const isTrunc = effectiveRows > previewLimit;
      setNodes([
        {
          id: crypto.randomUUID(),
          type: "dataSource",
          position: { x: 50, y: 150 },
          data: {
            label: `${primaryDataset.fileName} (Current)`,
            sourceId: primaryDataset.fileName,
            rowCount: effectiveRows,
            colCount: primaryDataset.columns.length,
            isTruncated: isTrunc,
            previewLimit,
          },
        },
      ]);
    }
  }, [datasets, nodes.length, setNodes, totalRowCount, previewLimit]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      try {
        const parsed: unknown = JSON.parse(type);
        if (!isRecord(parsed)) return;
        const parsedData = parsed as Record<string, unknown>;
        const nodeTypeRaw = parsedData["nodeType"];
        const nodeType =
          typeof nodeTypeRaw === "string" ? nodeTypeRaw : "dataSource";
        const labelRaw = parsedData["label"];
        const label = typeof labelRaw === "string" ? labelRaw : undefined;
        const joinTypeRaw = parsedData["joinType"];
        const joinType =
          typeof joinTypeRaw === "string" ? joinTypeRaw : undefined;
        const rowCountRaw = parsedData["rowCount"];
        const rowCount =
          typeof rowCountRaw === "number" ? rowCountRaw : undefined;
        const colCountRaw = parsedData["colCount"];
        const colCount =
          typeof colCountRaw === "number" ? colCountRaw : undefined;
        const newNode: ModelerNode = {
          id: crypto.randomUUID(),
          type: nodeType,
          position,
          data: {
            label,
            joinType,
            rowCount,
            colCount,
          },
        };
        setNodes((nds) => nds.concat(newNode));
      } catch (err) {
        console.error("Failed to parse drop payload", err);
      }
    },
    [screenToFlowPosition, setNodes],
  );

  // Evaluate the DAG visually
  useEffect(() => {
    if (!onModelChange || !onPreviewChange) return;

    const computedDatasets = new Map<string, Dataset>();

    // First, populate all dataSource nodes
    nodes
      .filter((n) => n.type === "dataSource")
      .forEach((n) => {
        const sourceIdRaw = n.data.sourceId;
        const labelRaw = n.data.label;
        const sourceId =
          typeof sourceIdRaw === "string"
            ? sourceIdRaw
            : typeof labelRaw === "string"
              ? labelRaw
              : undefined;
        if (!sourceId) return;
        const ds = datasets.find((d) => d.fileName === sourceId);
        if (ds) {
          computedDatasets.set(n.id, ds);
        }
      });

    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      iterations++;

      for (const node of nodes) {
        if (node.type === "dataSource" || computedDatasets.has(node.id))
          continue;

        // For Join Nodes, require exactly left and right handles
        if (node.type === "join") {
          const leftEdge = edges.find(
            (e) => e.target === node.id && e.targetHandle === "left",
          );
          const rightEdge = edges.find(
            (e) => e.target === node.id && e.targetHandle === "right",
          );

          if (
            leftEdge &&
            rightEdge &&
            computedDatasets.has(leftEdge.source) &&
            computedDatasets.has(rightEdge.source)
          ) {
            const left = computedDatasets.get(leftEdge.source)!;
            const right = computedDatasets.get(rightEdge.source)!;

            const commonCols = left.columns.filter((lc) =>
              right.columns.some((rc) => rc.name === lc.name),
            );
            const joinKey = commonCols.length > 0 ? commonCols[0].name : null;

            // Generate prefix for right columns to avoid collisions
            const rightPrefix = right.fileName
              ? right.fileName.split(".")[0] + "_"
              : "R_";

            const newColumns: Column[] = [
              ...left.columns,
              ...right.columns
                .filter((rc) => rc.name !== joinKey)
                .map((rc) => ({ ...rc, name: `${rightPrefix}${rc.name}` })),
            ];

            const joinTypeRaw = node.data?.joinType;
            const joinType =
              typeof joinTypeRaw === "string" ? joinTypeRaw : "inner";
            const newRows: Row[] = [];
            if (joinKey) {
              const matchedRightIndices = new Set<number>();
              for (const lRow of left.rows) {
                const rightRowsTyped = right.rows as Row[];
                const rRowsWithIndex: { r: Row; i: number }[] = rightRowsTyped
                  .map((r, i) => ({ r, i }))
                  .filter(({ r }) => r[joinKey] === lRow[joinKey]);
                if (rRowsWithIndex.length === 0) {
                  if (joinType === "left" || joinType === "full") {
                    newRows.push({ ...lRow });
                  }
                } else {
                  for (const { r: rRow, i: rIndex } of rRowsWithIndex) {
                    matchedRightIndices.add(rIndex);
                    const merged: Row = { ...lRow };
                    for (const key of Object.keys(rRow)) {
                      if (key !== joinKey)
                        merged[`${rightPrefix}${key}`] = rRow[key];
                    }
                    newRows.push(merged);
                  }
                }
              }
              if (joinType === "full") {
                for (let i = 0; i < right.rows.length; i++) {
                  if (!matchedRightIndices.has(i)) {
                    const rRow = right.rows[i] as Row;
                    const merged: Row = {};
                    merged[joinKey] = rRow[joinKey];
                    for (const key of Object.keys(rRow)) {
                      if (key !== joinKey)
                        merged[`${rightPrefix}${key}`] = rRow[key];
                    }
                    newRows.push(merged);
                  }
                }
              }
            } else {
              const maxLen = Math.max(left.rows.length, right.rows.length);
              for (let i = 0; i < maxLen; i++) {
                const lRow: Row = (left.rows[i] as Row | undefined) ?? {};
                const rRow: Row = (right.rows[i] as Row | undefined) ?? {};
                const merged: Row = { ...lRow };
                for (const key of Object.keys(rRow)) {
                  merged[`${rightPrefix}${key}`] = rRow[key];
                }
                newRows.push(merged);
              }
            }

            computedDatasets.set(node.id, {
              fileName: `Joined_${left.fileName}_${right.fileName}`,
              columns: newColumns,
              rows: newRows,
              uploadedAt: new Date(),
            } as Dataset);
            changed = true;
          }
        } else {
          // For other nodes (union, aggregate, export)
          const incomingEdges = edges.filter((e) => e.target === node.id);
          if (incomingEdges.length === 0) continue;

          const incomingDatasets = incomingEdges
            .map((e) => computedDatasets.get(e.source))
            .filter(Boolean) as Dataset[];

          if (
            incomingDatasets.length === incomingEdges.length &&
            incomingDatasets.length > 0
          ) {
            if (node.type === "union" && incomingDatasets.length >= 2) {
              const left = incomingDatasets[0];
              const right = incomingDatasets[1];

              const colMap = new Map<string, Column>();
              left.columns.forEach((c) => colMap.set(c.name, c));
              right.columns.forEach((c) => {
                if (!colMap.has(c.name)) colMap.set(c.name, c);
              });

              computedDatasets.set(node.id, {
                fileName: `Union_${left.fileName}_${right.fileName}`,
                columns: Array.from(colMap.values()),
                rows: [...left.rows, ...right.rows],
                uploadedAt: new Date(),
              } as Dataset);
              changed = true;
            } else if (
              node.type === "aggregate" &&
              incomingDatasets.length >= 1
            ) {
              // Basic pass-through for now
              computedDatasets.set(node.id, incomingDatasets[0]);
              changed = true;
            } else if (node.type === "export" && incomingDatasets.length >= 1) {
              computedDatasets.set(node.id, incomingDatasets[0]);
              changed = true;
            }
          }
        }
      }
    }

    // Now find terminal nodes (nodes with NO outgoing edges) that have computed datasets
    const terminalNodes = nodes.filter(
      (n) =>
        !edges.some((e) => e.source === n.id) && computedDatasets.has(n.id),
    );

    // Determine the final model output (always the terminal node)
    let finalDataset: Dataset | null = null;
    if (terminalNodes.length > 0) {
      const lastTerminal = terminalNodes[terminalNodes.length - 1];
      finalDataset = computedDatasets.get(lastTerminal.id) || null;
    } else {
      const singleSource = nodes.find(
        (n) => n.type === "dataSource" && computedDatasets.has(n.id),
      );
      if (singleSource) {
        finalDataset = computedDatasets.get(singleSource.id) || null;
      }
    }

    computedMapRef.current = computedDatasets;
    finalDatasetRef.current = finalDataset;
    onModelChange(finalDataset);

    // Determine the preview output (selected node, or fallback to finalDataset)
    if (selectedNodeId && computedDatasets.has(selectedNodeId)) {
      onPreviewChange(computedDatasets.get(selectedNodeId) || null);
    } else {
      onPreviewChange(finalDataset);
    }
  }, [nodes, edges, datasets, onModelChange, onPreviewChange, selectedNodeId]);

  const onSelectionChange = useCallback(
    (params: { nodes: Node[]; edges: Edge[] }) => {
      const selected = params.nodes.find((n) => n.selected);
      const selId = selected ? selected.id : null;
      setSelectedNodeId(selId);

      if (onPreviewChange) {
        if (selId) {
          if (computedMapRef.current.has(selId)) {
            onPreviewChange(computedMapRef.current.get(selId) || null);
          } else {
            // Node exists but failed to compute (e.g. missing inputs)
            onPreviewChange({
              columns: [],
              rows: [],
              fileName: "Incomplete Operation",
              uploadedAt: new Date(),
            } as Dataset);
          }
        } else {
          onPreviewChange(finalDatasetRef.current);
        }
      }
    },
    [onPreviewChange],
  );

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onPreviewChange) {
        if (computedMapRef.current.has(node.id)) {
          onPreviewChange(computedMapRef.current.get(node.id) || null);
        } else {
          onPreviewChange({
            columns: [],
            rows: [],
            fileName: "Incomplete Operation",
            uploadedAt: new Date(),
          } as Dataset);
        }
      }
    },
    [onPreviewChange],
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "export" && onExportNodeClick) {
        const ds = computedMapRef.current.get(node.id);
        if (ds) onExportNodeClick(ds);
      }
    },
    [onExportNodeClick],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onSelectionChange={onSelectionChange}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: true }}
      fitView
    >
      <Controls />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
    </ReactFlow>
  );
}

export function DataModelerCanvas(props: DataModelerCanvasProps) {
  return (
    <div
      className="data-modeler-canvas"
      style={{ width: "100%", height: "100%" }}
    >
      <ReactFlowProvider>
        <CanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
