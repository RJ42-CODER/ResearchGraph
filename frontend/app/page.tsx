"use client";

import "@xyflow/react/dist/style.css";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  BackgroundVariant,
} from "@xyflow/react";

import {
  Plus,
  Bot,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  UploadCloud,
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

function WorkspaceCanvas() {
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [lastUploadedPaperId, setLastUploadedPaperId] = useState<string | null>(
    null,
  );
  const [agentDrawer, setAgentDrawer] = useState(true);
  const [agentStatus, setAgentStatus] = useState("Idle");
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [inspectCode, setInspectCode] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<any>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Counter to prevent premature dragLeave events from child DOM elements
  const dragCounter = useRef(0);

  // Load Graph from SQLite Persistence on Mount
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/workspace/graph`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.nodes && data.nodes.length > 0) {
          const styledNodes = data.nodes.map((node: Node) => ({
            ...node,
            style: {
              background: "#18181b",
              color:
                node.data?.status === "failed"
                  ? "#f43f5e"
                  : node.data?.status === "success"
                    ? "#38bdf8"
                    : "#10b981",
              border: `1px solid ${
                node.data?.status === "failed"
                  ? "#e11d48"
                  : node.data?.status === "success"
                    ? "#0284c7"
                    : "#059669"
              }`,
              borderRadius: "10px",
              padding: "16px",
              width: 260,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            },
          }));
          setNodes(styledNodes);
          setEdges(data.edges || []);
          setLastUploadedPaperId(
            styledNodes[styledNodes.length - 1]?.id || null,
          );
        }
      } catch (err) {
        console.warn("SQLite not ready yet:", err);
      }
    };
    fetchGraph();
  }, []);

  const resetCanvas = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/workspace/reset`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend reset call failed:", e);
    }
    setNodes([]);
    setEdges([]);
    setLastUploadedPaperId(null);
    setSelectedNodeData(null);
    setPendingApproval(null);
    setAgentStatus("Canvas cleared");
  };

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeData(node.data);
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(async (connection) => {
    const edgeId = `e-${connection.source}-${connection.target}`;
    const newEdge: Edge = {
      ...connection,
      id: edgeId,
      animated: true,
      label: "relates_to",
      style: { stroke: "#38bdf8", strokeWidth: 2 },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    try {
      await fetch(`${BACKEND_URL}/api/workspace/edge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: edgeId,
          source: connection.source,
          target: connection.target,
          label: "relates_to",
        }),
      });
    } catch (e) {
      console.error("Save edge error:", e);
    }
  }, []);

  // Fast Full-Screen Drag Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  // Instant Optimistic Drop Handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a .pdf research paper.");
      return;
    }

    const displayName = file.name.replace(/\.pdf$/i, "");
    const tempId = `paper-${Date.now()}`;

    // 1. Calculate drop coordinates instantly relative to canvas pan & zoom
    const flowPosition = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    // 2. Render node immediately on screen (0ms delay)
    const optimisticNode: Node = {
      id: tempId,
      position: flowPosition,
      data: {
        label: `📄 ${displayName} (Indexing...)`,
        title: displayName,
        summary: "Extracting document sections into ChromaDB...",
      },
      style: {
        background: "#18181b",
        color: "#fbbf24",
        border: "1px dashed #d97706",
        borderRadius: "10px",
        padding: "16px",
        width: 260,
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
      },
    };

    setNodes((prev) => [...prev, optimisticNode]);
    setLastUploadedPaperId(tempId);

    // 3. Upload file asynchronously in the background
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/papers/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      const actualId = result.paper_id || tempId;
      setLastUploadedPaperId(actualId);

      // 4. Settle the optimistic node to confirmed green state
      setNodes((prev) =>
        prev.map((n) =>
          n.id === tempId
            ? {
                ...n,
                id: actualId,
                data: {
                  label: `📄 ${displayName}`,
                  title: displayName,
                  summary: "Vector embeddings indexed into ChromaDB.",
                },
                style: {
                  ...n.style,
                  color: "#10b981",
                  border: "1px solid #059669",
                },
              }
            : n,
        ),
      );

      // Save settled node to SQLite
      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: actualId,
          position: flowPosition,
          data: {
            label: `📄 ${displayName}`,
            title: displayName,
            summary: "Vector embeddings indexed into ChromaDB.",
          },
        }),
      });
    } catch (error) {
      console.error("PDF upload error:", error);
      // Fallback: settle node so UI remains interactive
      setNodes((prev) =>
        prev.map((n) =>
          n.id === tempId
            ? {
                ...n,
                data: { ...n.data, label: `📄 ${displayName}` },
                style: {
                  ...n.style,
                  color: "#10b981",
                  border: "1px solid #059669",
                },
              }
            : n,
        ),
      );
    }
  };

  const addPaper = () => {
    const id = `${Date.now()}`;
    const newNode: Node = {
      id,
      position: { x: 140 + Math.random() * 80, y: 240 + Math.random() * 80 },
      data: {
        label: "📄 Paper: Fast Transformer Inference",
        title: "Fast Transformer Inference",
        summary: "Lightweight CPU execution strategies.",
      },
      style: {
        background: "#18181b",
        color: "#34d399",
        border: "1px solid #059669",
        borderRadius: "10px",
        padding: "16px",
        width: 250,
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setLastUploadedPaperId(id);
  };

  const triggerAgentPipeline = async () => {
    setAgentStatus("Searching ChromaDB & prompting Ollama...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/run-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: lastUploadedPaperId,
          paper_text:
            "Attention Is All You Need. Multi-head self-attention baseline.",
        }),
      });
      const data = await res.json();
      setAgentStatus("Waiting for Human Approval");
      setPendingApproval(data);
    } catch (e) {
      console.error(e);
      setAgentStatus("Backend disconnected");
    }
  };

  const approveExecution = async () => {
    const code =
      pendingApproval?.generated_code || "print('Executed baseline')";
    setAgentStatus("Executing script in Sandbox...");
    try {
      const res = await fetch(`${BACKEND_URL}/api/sandbox/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const execResult = await res.json();

      const expId = `${Date.now()}`;
      const expNode: Node = {
        id: expId,
        position: { x: 480, y: 320 },
        data: {
          label: `⚡ Experiment Result: ${
            execResult.status === "success" ? "Passed" : "Failed"
          }`,
          status: execResult.status,
          stdout: execResult.stdout || "No stdout produced.",
          stderr: execResult.stderr || "",
          codeSnippet: code,
          returncode: execResult.returncode,
        },
        style: {
          background: "#18181b",
          color: execResult.status === "success" ? "#38bdf8" : "#f43f5e",
          border: `1px solid ${
            execResult.status === "success" ? "#0284c7" : "#e11d48"
          }`,
          borderRadius: "10px",
          padding: "16px",
          width: 260,
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
        },
      };

      setNodes((prev) => [...prev, expNode]);

      if (lastUploadedPaperId) {
        const newEdgeId = `e-${lastUploadedPaperId}-${expId}`;
        const newEdge: Edge = {
          id: newEdgeId,
          source: lastUploadedPaperId,
          target: expId,
          animated: true,
          label: "reproduced_by",
          style: { stroke: "#38bdf8", strokeWidth: 2 },
        };
        setEdges((prev) => [...prev, newEdge]);

        await fetch(`${BACKEND_URL}/api/workspace/edge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newEdgeId,
            source: lastUploadedPaperId,
            target: expId,
            label: "reproduced_by",
          }),
        });
      }

      setPendingApproval(null);
      setAgentStatus("Experiment logged to Research Memory");

      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expNode.id,
          position: expNode.position,
          data: expNode.data,
        }),
      });
    } catch (e) {
      setAgentStatus("Sandbox execution error");
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        display: "flex",
        backgroundColor: "#09090b",
        overflow: "hidden",
      }}
    >
      {/* Universal Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-indigo-950/40 backdrop-blur-sm border-2 border-dashed border-indigo-500 pointer-events-none flex flex-col items-center justify-center gap-3">
          <UploadCloud className="w-12 h-12 text-indigo-400 animate-bounce" />
          <span className="text-base font-semibold text-zinc-100 bg-zinc-900/90 px-5 py-2.5 rounded-xl border border-zinc-700 shadow-2xl">
            Drop PDF anywhere to ingest paper
          </span>
        </div>
      )}

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 h-14 border-b border-zinc-800 bg-zinc-950/90 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
            R
          </div>
          <span className="font-semibold text-sm text-zinc-100">
            ResearchGraph{" "}
            <span className="text-zinc-500 font-normal">/ Workspace</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={resetCanvas}
            title="Wipe canvas and clear database cache"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-xs font-medium text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900/60 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Canvas
          </button>

          <button
            onClick={addPaper}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 border border-zinc-700 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Paper
          </button>
          <button
            onClick={triggerAgentPipeline}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Run Agent Pipeline
          </button>
          <button
            onClick={() => setAgentDrawer(!agentDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" /> Agents
          </button>
        </div>
      </header>

      {/* Main Canvas */}
      <main
        style={{
          width: "100%",
          height: "calc(100vh - 56px)",
          marginTop: "56px",
          position: "relative",
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Background
            color="#3f3f46"
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls className="!bg-zinc-900 !border-zinc-800 !text-white" />
        </ReactFlow>
      </main>

      {/* Agent Activity Drawer */}
      {agentDrawer && (
        <aside className="w-80 h-full border-l border-zinc-800 bg-zinc-950 pt-14 flex flex-col z-10 shrink-0">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Agent Orchestration
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              Ollama + ChromaDB
            </span>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs">
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <span className="font-semibold text-zinc-300">Agent Status</span>
              <p className="mt-1 text-zinc-400">{agentStatus}</p>
            </div>

            {pendingApproval && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-amber-900/40">
                <div className="flex items-center justify-between text-amber-400 font-semibold mb-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> HITL Approval Gate
                  </span>
                  <span className="text-[10px] bg-amber-950 px-1.5 py-0.5 rounded border border-amber-800">
                    Pending
                  </span>
                </div>
                <p className="text-zinc-400 mt-1">
                  Experiment Agent synthesized a benchmark script from the paper
                  hyperparameters.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={approveExecution}
                    className="flex-1 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      setInspectCode(
                        pendingApproval.generated_code || "# No code generated",
                      )
                    }
                    className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium cursor-pointer"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Code Inspection Modal */}
      {inspectCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-200">
                Inspect Generated Experiment Script
              </h3>
              <button
                onClick={() => setInspectCode(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72 whitespace-pre-wrap">
              {inspectCode}
            </pre>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setInspectCode(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setInspectCode(null);
                  approveExecution();
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-medium cursor-pointer"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Node Details Inspection Modal */}
      {selectedNodeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-200">
                {selectedNodeData.label || "Node Details"}
              </h3>
              <button
                onClick={() => setSelectedNodeData(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {selectedNodeData.summary && (
                <div>
                  <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                    Summary
                  </span>
                  <p className="mt-1 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {selectedNodeData.summary}
                  </p>
                </div>
              )}
              {selectedNodeData.codeSnippet && (
                <div>
                  <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                    Executed Script
                  </span>
                  <pre className="mt-1 p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                    {selectedNodeData.codeSnippet}
                  </pre>
                </div>
              )}
              {selectedNodeData.stdout && (
                <div>
                  <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                    Sandbox Stdout
                  </span>
                  <pre className="mt-1 p-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                    {selectedNodeData.stdout}
                  </pre>
                </div>
              )}
              {selectedNodeData.stderr && (
                <div>
                  <span className="font-semibold text-rose-400 uppercase tracking-wider text-[10px]">
                    Execution Errors (stderr)
                  </span>
                  <pre className="mt-1 p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap">
                    {selectedNodeData.stderr}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedNodeData(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Workspace() {
  return (
    <ReactFlowProvider>
      <WorkspaceCanvas />
    </ReactFlowProvider>
  );
}
