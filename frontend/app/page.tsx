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
  Bot,
  RotateCcw,
  UploadCloud,
  StickyNote,
  GitFork,
  Trash2,
  MessageSquare,
  Sparkles,
  Send,
  X,
  Plus,
  CheckCircle2,
  Edit3,
} from "lucide-react";

const BACKEND_URL = "http://localhost:8000";

function WorkspaceCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [agentDrawer, setAgentDrawer] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  // Resizable Drawer Width State (default 380px, clamped between 300px and 850px)
  const [drawerWidth, setDrawerWidth] = useState(380);
  const isResizing = useRef(false);

  // Edit Node Title State
  const [editingNode, setEditingNode] = useState<{
    id: string;
    currentTitle: string;
  } | null>(null);
  const [newTitleInput, setNewTitleInput] = useState("");

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 300 && newWidth <= 850) {
      setDrawerWidth(newWidth);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Context Menu State
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
    nodeData: any;
  } | null>(null);

  // Active Focused Paper for Chat
  const [activePaper, setActivePaper] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "agent"; text: string }>
  >([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false);

  const onPaneClick = useCallback(() => setMenu(null), []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        nodeData: node.data,
      });
    },
    [],
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const currentTitle =
      (node.data?.title as string) ||
      (typeof node.data?.label === "string" ? node.data.label : "") ||
      "";
    setEditingNode({ id: node.id, currentTitle });
    setNewTitleInput(currentTitle);
  }, []);

  // Load Graph from SQLite Persistence
  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/workspace/graph`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.nodes) {
          const styledNodes = data.nodes.map((node: Node) => {
            const isNote =
              node.id.startsWith("note") || node.data?.type === "note";
            const isSynth = node.id.startsWith("synth");
            const isResult = node.id.startsWith("result") || node.data?.summary;
            const isExp = node.id.startsWith("exp") || node.data?.status;

            return {
              ...node,
              style: {
                background: "#18181b",
                color: isNote
                  ? "#fef08a"
                  : isSynth
                    ? "#c084fc"
                    : isResult
                      ? "#818cf8"
                      : isExp
                        ? node.data?.status === "failed"
                          ? "#f87171"
                          : "#38bdf8"
                        : "#34d399",
                border: isNote
                  ? "1px solid #ca8a04"
                  : isSynth
                    ? "1px dashed #9333ea"
                    : isResult
                      ? "1px solid #4f46e5"
                      : isExp
                        ? "1px solid #0284c7"
                        : "1px solid #059669",
                borderRadius: "10px",
                padding: "16px",
                width: isNote ? 240 : isResult ? 380 : 270,
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              },
            };
          });

          setNodes(styledNodes);
          setEdges(data.edges || []);
        }
      } catch (err) {
        console.warn("Database load warning:", err);
      }
    };
    fetchGraph();
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      try {
        await fetch(`${BACKEND_URL}/api/workspace/node/${node.id}`, {
          method: "DELETE",
        });
      } catch (e) {
        console.error("Failed to delete node from DB:", e);
      }
    }
  }, []);

  const onConnect: OnConnect = useCallback(async (connection) => {
    const edgeId = `e-${connection.source}-${connection.target}`;
    const newEdge: Edge = {
      ...connection,
      id: edgeId,
      animated: true,
      label: "references",
      style: { stroke: "#818cf8", strokeWidth: 2 },
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
          label: "references",
        }),
      });
    } catch (e) {
      console.error("Save edge error:", e);
    }
  }, []);

  const resetCanvas = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/workspace/reset`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend reset error:", e);
    }
    setNodes([]);
    setEdges([]);
    setActivePaper(null);
    setChatMessages([]);
  };

  const handleSaveNodeTitle = async () => {
    if (!editingNode || !newTitleInput.trim()) {
      setEditingNode(null);
      return;
    }

    const { id } = editingNode;
    const targetNode = nodes.find((n) => n.id === id);
    if (!targetNode) return;

    const isPaper = targetNode.id.startsWith("paper");
    const isNote = targetNode.id.startsWith("note");

    let formattedLabel: React.ReactNode | string = newTitleInput;
    if (isPaper && !newTitleInput.startsWith("📄")) {
      formattedLabel = `📄 ${newTitleInput}`;
    } else if (isNote && !newTitleInput.startsWith("📝")) {
      formattedLabel = `📝 ${newTitleInput}`;
    }

    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                title: newTitleInput,
                label: formattedLabel,
              },
            }
          : n,
      ),
    );

    if (
      activePaper?.id === id ||
      activePaper?.id === targetNode.data?.paper_id
    ) {
      setActivePaper((prev) =>
        prev ? { ...prev, title: newTitleInput } : null,
      );
    }

    try {
      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetNode.id,
          position: targetNode.position,
          data: {
            ...targetNode.data,
            title: newTitleInput,
            label: formattedLabel,
          },
        }),
      });
    } catch (err) {
      console.error("Failed to persist updated title:", err);
    }

    setEditingNode(null);
  };

  const handleAddNoteToNode = (targetNodeId: string) => {
    const targetNode = nodes.find((n) => n.id === targetNodeId);
    const noteId = `note-${Date.now()}`;
    const newPos = targetNode
      ? { x: targetNode.position.x + 300, y: targetNode.position.y }
      : { x: 200, y: 200 };

    const noteNode: Node = {
      id: noteId,
      position: newPos,
      data: {
        title: "Note",
        label: "📝 Note: Double-click to edit your thoughts...",
        type: "note",
      },
      style: {
        background: "#27272a",
        color: "#fef08a",
        border: "1px solid #ca8a04",
        borderRadius: "8px",
        padding: "14px",
        width: 240,
        fontSize: "12px",
      },
    };

    const edgeId = `e-${targetNodeId}-${noteId}`;
    const newEdge: Edge = {
      id: edgeId,
      source: targetNodeId,
      target: noteId,
      animated: false,
      style: { stroke: "#eab308", strokeDasharray: "4 4" },
    };

    setNodes((prev) => [...prev, noteNode]);
    setEdges((prev) => [...prev, newEdge]);
    setMenu(null);
  };

  const handleDeleteNode = async (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) =>
      prev.filter((e) => e.source !== nodeId && e.target !== nodeId),
    );
    setMenu(null);
    try {
      await fetch(`${BACKEND_URL}/api/workspace/node/${nodeId}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenChatForNode = (node: Node) => {
    const paperKey =
      (node.data?.paper_id as string) || (node.id as string) || "";
    const title = (node.data?.title || node.data?.label || "Paper") as string;
    setActivePaper({ id: paperKey, title });
    setAgentDrawer(true);
    setHasUnreadNotification(false);
    setChatMessages([
      {
        sender: "agent",
        text: `Ask me anything about "${title}". You can ask about sample sizes, participant criteria, or conclusions.`,
      },
    ]);
    setMenu(null);
  };

  const handleAddSynthesisNode = () => {
    const synthId = `synth-${Date.now()}`;
    const newNode: Node = {
      id: synthId,
      position: { x: 380, y: 220 },
      data: {
        title: "Cross-Reference Task",
        label: (
          <div className="space-y-1.5 text-left">
            <div className="font-semibold text-purple-300 flex items-center gap-1.5">
              <span>🔍 Cross-Reference Task</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-normal leading-snug">
              Connect 2 or more papers into this node, right-click, and select
              &quot;Run Cross-Reference&quot;.
            </div>
          </div>
        ),
      },
      style: {
        background: "#18181b",
        color: "#c084fc",
        border: "1px dashed #9333ea",
        borderRadius: "10px",
        padding: "14px",
        width: 290,
        fontSize: "12px",
        cursor: "pointer",
      },
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleRunSynthesis = async (synthNodeId: string) => {
    const incomingEdges = edges.filter((e) => e.target === synthNodeId);

    const connectedPaperIds = incomingEdges
      .map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        return (sourceNode?.data?.paper_id as string) || edge.source;
      })
      .filter((id) => !id.startsWith("synth") && !id.startsWith("note"));

    if (connectedPaperIds.length < 2) {
      alert(
        "Please connect at least 2 papers as sources into this Cross-Reference Task node.",
      );
      setMenu(null);
      return;
    }

    setMenu(null);

    const synthNode = nodes.find((n) => n.id === synthNodeId);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === synthNodeId
          ? {
              ...n,
              data: {
                ...n.data,
                label: (
                  <div className="flex items-center gap-2 text-purple-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    <span>Analyzing {connectedPaperIds.length} papers...</span>
                  </div>
                ),
              },
            }
          : n,
      ),
    );

    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/cross-reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper_ids: connectedPaperIds }),
      });
      const data = await res.json();

      setNodes((prev) =>
        prev.map((n) =>
          n.id === synthNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: "🔍 Cross-Reference Task",
                },
              }
            : n,
        ),
      );

      const resultNodeId = `result-${Date.now()}`;
      const posX = synthNode ? synthNode.position.x + 360 : 720;
      const posY = synthNode ? synthNode.position.y - 40 : 200;

      const resultNode: Node = {
        id: resultNodeId,
        position: { x: posX, y: posY },
        data: {
          title: "Synthesis Results",
          label: (
            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
                <span className="font-bold text-xs text-indigo-300">
                  ⚡ Synthesis Results
                </span>
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  {connectedPaperIds.length} Papers Compared
                </span>
              </div>
              <div className="text-[11px] text-zinc-200 font-normal leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto select-text pr-1">
                {data.comparison_summary}
              </div>
            </div>
          ),
          summary: data.comparison_summary,
        },
        style: {
          background: "#18181b",
          color: "#818cf8",
          border: "1px solid #4f46e5",
          borderRadius: "10px",
          padding: "16px",
          width: 380,
          boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
          cursor: "default",
        },
      };

      const resultEdge: Edge = {
        id: `e-${synthNodeId}-${resultNodeId}`,
        source: synthNodeId,
        target: resultNodeId,
        animated: true,
        label: "synthesized_into",
        style: { stroke: "#818cf8", strokeWidth: 2 },
      };

      setNodes((prev) => [...prev, resultNode]);
      setEdges((prev) => [...prev, resultEdge]);

      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resultNodeId,
          position: { x: posX, y: posY },
          data: {
            label: "⚡ Synthesis Results",
            summary: data.comparison_summary,
          },
        }),
      });

      await fetch(`${BACKEND_URL}/api/workspace/edge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resultEdge.id,
          source: synthNodeId,
          target: resultNodeId,
          label: "synthesized_into",
        }),
      });
    } catch (e) {
      console.error("Synthesis execution error:", e);
      alert(
        "Failed to synthesize papers. Ensure Ollama and the backend are active.",
      );
      setNodes((prev) =>
        prev.map((n) =>
          n.id === synthNodeId
            ? { ...n, data: { ...n.data, label: "🔍 Cross-Reference Task" } }
            : n,
        ),
      );
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activePaper) return;
    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setIsAgentThinking(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: activePaper.id,
          query: userText,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { sender: "agent", text: data.reply },
      ]);
      setHasUnreadNotification(true);
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "agent",
          text: "Could not retrieve answer. Check if Ollama is running.",
        },
      ]);
    } finally {
      setIsAgentThinking(false);
    }
  };

  const processUploadedFile = async (
    file: File,
    clientPosition?: { x: number; y: number },
  ) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a .pdf research paper.");
      return;
    }

    const displayName = file.name.replace(/\.pdf$/i, "");
    const tempId = `paper-${Date.now()}`;
    const flowPosition = clientPosition
      ? screenToFlowPosition(clientPosition)
      : { x: 150 + Math.random() * 60, y: 150 + Math.random() * 60 };

    const optimisticNode: Node = {
      id: tempId,
      position: flowPosition,
      data: {
        label: `📄 ${displayName}`,
        title: displayName,
        paper_id: tempId,
        summary:
          "Paper indexed into ChromaDB. Right-click to query or annotate.",
      },
      style: {
        background: "#18181b",
        color: "#10b981",
        border: "1px solid #059669",
        borderRadius: "10px",
        padding: "16px",
        width: 260,
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
      },
    };

    setNodes((prev) => [...prev, optimisticNode]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${BACKEND_URL}/api/papers/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      const actualId = data.paper_id || tempId;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === tempId
            ? {
                ...n,
                id: actualId,
                data: {
                  ...n.data,
                  paper_id: actualId,
                },
              }
            : n,
        ),
      );

      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: actualId,
          position: flowPosition,
          data: {
            label: `📄 ${displayName}`,
            title: displayName,
            paper_id: actualId,
            summary: "Paper indexed into ChromaDB.",
          },
        }),
      });
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items?.length > 0) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) processUploadedFile(file, { x: e.clientX, y: e.clientY });
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
        display: "flex",
        backgroundColor: "#09090b",
        overflow: "hidden",
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processUploadedFile(file);
        }}
      />

      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-indigo-950/40 backdrop-blur-sm border-2 border-dashed border-indigo-500 pointer-events-none flex flex-col items-center justify-center gap-3">
          <UploadCloud className="w-12 h-12 text-indigo-400 animate-bounce" />
          <span className="text-base font-semibold text-zinc-100 bg-zinc-900/90 px-5 py-2.5 rounded-xl border border-zinc-700 shadow-2xl">
            Drop PDF to add paper to workspace
          </span>
        </div>
      )}

      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 z-20 h-14 border-b border-zinc-800 bg-zinc-950/90 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
            R
          </div>
          <span className="font-semibold text-sm text-zinc-100">
            ResearchGraph{" "}
            <span className="text-zinc-500 font-normal">
              / Multi-Paper Workspace
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={resetCanvas}
            title="Clear workspace"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-xs font-medium text-zinc-400 hover:text-rose-400 border border-zinc-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Paper
          </button>

          <button
            onClick={handleAddSynthesisNode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/60 text-xs font-medium text-purple-300 border border-purple-800/60 transition cursor-pointer"
          >
            <GitFork className="w-3.5 h-3.5" /> + Cross-Reference Task
          </button>

          <button
            onClick={() => {
              const noteId = `note-${Date.now()}`;
              setNodes((prev) => [
                ...prev,
                {
                  id: noteId,
                  position: { x: 250, y: 150 },
                  data: {
                    title: "Note",
                    label: "📝 Note: Double-click to edit your thoughts...",
                  },
                  style: {
                    background: "#27272a",
                    color: "#fef08a",
                    border: "1px solid #ca8a04",
                    borderRadius: "8px",
                    padding: "14px",
                    width: 240,
                    fontSize: "12px",
                  },
                },
              ]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-amber-300 border border-amber-900/40 transition cursor-pointer"
          >
            <StickyNote className="w-3.5 h-3.5" /> + Add Note
          </button>

          <button
            onClick={() => {
              setAgentDrawer(!agentDrawer);
              setHasUnreadNotification(false);
            }}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition cursor-pointer ${
              hasUnreadNotification
                ? "bg-amber-600 hover:bg-amber-500 animate-pulse"
                : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            {activePaper
              ? `Chat (${activePaper.title.slice(0, 10)}...)`
              : "Assistant"}
            {hasUnreadNotification && (
              <span className="w-2 h-2 rounded-full bg-amber-200 animate-ping absolute -top-0.5 -right-0.5" />
            )}
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
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
        >
          <Background
            color="#27272a"
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls className="!bg-zinc-900 !border-zinc-800 !text-white" />
        </ReactFlow>

        {/* Floating Notification Pill */}
        {!agentDrawer && (isAgentThinking || hasUnreadNotification) && (
          <div
            onClick={() => {
              setAgentDrawer(true);
              setHasUnreadNotification(false);
            }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-zinc-900 border border-indigo-500 shadow-2xl cursor-pointer hover:bg-zinc-800 transition"
          >
            {isAgentThinking ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-xs font-medium text-indigo-300">
                  Assistant reading paper in background...
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-300">
                  Response ready! Click to open
                </span>
              </>
            )}
          </div>
        )}

        {/* Right-Click Context Menu */}
        {menu && (
          <div
            style={{ top: menu.top, left: menu.left }}
            className="fixed z-50 w-52 rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 shadow-2xl text-xs space-y-1"
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase border-b border-zinc-800">
              Actions
            </div>

            <button
              onClick={() => {
                const targetNode = nodes.find((n) => n.id === menu.id);
                if (targetNode) {
                  const currTitle =
                    (targetNode.data?.title as string) ||
                    (typeof targetNode.data?.label === "string"
                      ? targetNode.data.label
                      : "") ||
                    "";
                  setEditingNode({
                    id: targetNode.id,
                    currentTitle: currTitle,
                  });
                  setNewTitleInput(currTitle);
                }
                setMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition text-left cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> Rename / Edit
              Title
            </button>

            <button
              onClick={() => {
                const targetNode = nodes.find((n) => n.id === menu.id);
                if (targetNode) handleOpenChatForNode(targetNode);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition text-left cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Ask
              Agent About Paper
            </button>

            <button
              onClick={() => handleAddNoteToNode(menu.id)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition text-left cursor-pointer"
            >
              <StickyNote className="w-3.5 h-3.5 text-amber-400" /> Attach
              Sticky Note
            </button>

            {menu.id.startsWith("synth") && (
              <button
                onClick={() => handleRunSynthesis(menu.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-purple-300 hover:text-purple-200 hover:bg-purple-950/40 transition text-left cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Run
                Cross-Reference
              </button>
            )}

            <button
              onClick={() => handleDeleteNode(menu.id)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition text-left cursor-pointer border-t border-zinc-800/80"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Node
            </button>
          </div>
        )}
      </main>

      {/* Edit Title Modal */}
      {editingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                <Edit3 className="w-3.5 h-3.5 text-cyan-400" /> Edit Title
              </span>
              <button
                onClick={() => setEditingNode(null)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                Enter title or text:
              </label>
              <textarea
                rows={3}
                value={newTitleInput}
                onChange={(e) => setNewTitleInput(e.target.value)}
                placeholder="Type here..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                autoFocus
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditingNode(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNodeTitle}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resizable Contextual Assistant Drawer */}
      {agentDrawer && (
        <aside
          style={{ width: `${drawerWidth}px` }}
          className="relative h-full border-l border-zinc-800 bg-zinc-950 pt-14 flex flex-col z-20 shrink-0 select-text"
        >
          {/* Draggable Handle on Left Edge */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 bottom-0 left-0 w-2 -ml-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-30"
            title="Drag to resize panel"
          />

          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">
                {activePaper
                  ? `Paper: ${activePaper.title}`
                  : "Research Assistant"}
              </span>
              <span className="text-[10px] text-zinc-500">
                {activePaper
                  ? "Answering from paper text"
                  : "Right-click any paper to begin chat"}
              </span>
            </div>
            <button
              onClick={() => setAgentDrawer(false)}
              className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
              title="Close drawer (runs in background)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">
                Right-click any paper node and choose <br />
                <span className="text-indigo-400 font-medium">
                  "Ask Agent About Paper"
                </span>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-indigo-950/60 border border-indigo-800/40 text-indigo-200 ml-4"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-300 mr-4 whitespace-pre-wrap"
                  }`}
                >
                  {msg.text}
                </div>
              ))
            )}
            {isAgentThinking && (
              <div className="text-zinc-500 italic text-[11px] animate-pulse">
                Searching paper chunks in background...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={
                  activePaper
                    ? "Ask methodology, sample size..."
                    : "Select a paper first..."
                }
                disabled={!activePaper}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!activePaper || !chatInput.trim()}
                title="Send task"
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer transition"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </aside>
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
