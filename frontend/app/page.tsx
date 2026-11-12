"use client";

import "@xyflow/react/dist/style.css";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  NodeTypes,
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
  Search,
} from "lucide-react";

import { DiscoveryDrawer, DiscoveredPaperItem } from "../components/DiscoveryDrawer";
import { DiscoveryNode } from "../components/DiscoveryNode";
import { PaperNode } from "../components/PaperNode";
import { CodeExperimentNode } from "../components/CodeExperimentNode";
import {
  NoteNode,
  SynthesisResultNode,
  SynthesisTaskNode,
  UploadedPaperNode,
} from "../components/WorkspaceNodes";

const BACKEND_URL = "http://localhost:8000";
type DrawerKind = "none" | "discovery" | "assistant";
const DRAWER_TRANSITION_MS = 220;

function getEditableNodeTitle(node: Node): string {
  const title = typeof node.data?.title === "string" ? node.data.title : "";
  const label = typeof node.data?.label === "string" ? node.data.label : "";
  if (node.id.startsWith("note") || node.type === "note") {
    if (title && title !== "Note") return title;
    return label.replace(/^📝\s*(Note:\s*)?/i, "");
  }
  if (title) return title;
  return label.replace(/^📄\s*/, "");
}

function createNoteNode(
  id: string,
  position: { x: number; y: number },
): Node {
  return {
    id,
    type: "note",
    position,
    data: {
      title: "Note",
      label: "📝 Note: Double-click to edit your thoughts...",
      type: "note",
    },
    style: {
      width: 260,
      height: 150,
    },
  };
}

function WorkspaceCanvas() {
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [desiredDrawer, setDesiredDrawer] = useState<DrawerKind>("none");
  const [openDrawer, setOpenDrawer] = useState<DrawerKind>("none");
  const openDrawerRef = useRef<DrawerKind>("none");
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingUntilRef = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);

  const updateOpenDrawer = useCallback((next: DrawerKind) => {
    openDrawerRef.current = next;
    setOpenDrawer(next);
  }, []);

  const selectDrawer = useCallback(
    (next: DrawerKind) => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
      setDesiredDrawer(next);

      const current = openDrawerRef.current;

      if (next === "none") {
        if (current !== "none") {
          closingUntilRef.current = Date.now() + DRAWER_TRANSITION_MS;
          updateOpenDrawer("none");
        }
        return;
      }

      if (current !== "none" && current !== next) {
        // Close the active drawer first so its exit animation plays before the next opens
        closingUntilRef.current = Date.now() + DRAWER_TRANSITION_MS;
        updateOpenDrawer("none");
        switchTimerRef.current = setTimeout(() => {
          switchTimerRef.current = null;
          updateOpenDrawer(next);
        }, DRAWER_TRANSITION_MS);
        return;
      }

      const remaining = Math.max(0, closingUntilRef.current - Date.now());
      if (remaining === 0) {
        updateOpenDrawer(next);
      } else {
        switchTimerRef.current = setTimeout(() => {
          switchTimerRef.current = null;
          updateOpenDrawer(next);
        }, remaining);
      }
    },
    [updateOpenDrawer],
  );

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

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
    nodeData: Record<string, unknown>;
  } | null>(null);

  // Active Focused Paper for Chat
  const [activePaper, setActivePaper] = useState<{
    id: string;
    title: string;
    abstract?: string;
  } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "agent"; text: string }>
  >([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false);

  // Custom node types definition for ReactFlow
  const nodeTypes: NodeTypes = useMemo(
    () => ({
      discovery: DiscoveryNode,
      paper: PaperNode,
      experiment: CodeExperimentNode,
      result: SynthesisResultNode,
      synth: SynthesisTaskNode,
      note: NoteNode,
      uploadedPaper: UploadedPaperNode,
    }),
    [],
  );

  // Set of paper IDs/DOIs present on canvas for duplicate prevention
  const existingPaperKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const node of nodes) {
      if (node.data?.doi && typeof node.data.doi === "string") {
        keys.add(node.data.doi.toLowerCase());
      }
      if (node.data?.openalex_id && typeof node.data.openalex_id === "string") {
        keys.add(node.data.openalex_id);
      }
      if (node.data?.paper_id && typeof node.data.paper_id === "string") {
        keys.add(node.data.paper_id);
      }
      keys.add(node.id);
    }
    return keys;
  }, [nodes]);

  const onPaneClick = useCallback(() => setMenu(null), []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        nodeData: (node.data as Record<string, unknown>) || {},
      });
    },
    [],
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    const currentTitle = getEditableNodeTitle(node);
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
            if (node.type === "discovery" || node.id.startsWith("discovery")) {
              return {
                ...node,
                type: "discovery",
                style: {
                  width: 340,
                  ...(node.data?.abstract ? { height: 230 } : {}),
                  ...node.style,
                },
              };
            }

            if (node.type === "paper") {
              return {
                ...node,
                type: "paper",
                style: { width: 340, ...node.style },
              };
            }

            const isNote =
              node.type === "note" ||
              node.id.startsWith("note") ||
              node.data?.type === "note";
            const isSynth = node.type === "synth" || node.id.startsWith("synth");
            const isResult =
              node.type === "result" ||
              node.id.startsWith("result") ||
              Boolean(node.data?.summary && !node.id.startsWith("paper"));
            const isExp =
              node.type === "experiment" ||
              node.id.startsWith("exp") ||
              Boolean(node.data?.status);

            if (isNote) {
              return {
                ...node,
                type: "note",
                style: { width: 260, height: 150, ...node.style },
              };
            }

            if (isSynth) {
              return {
                ...node,
                type: "synth",
                style: { width: 300, height: 135, ...node.style },
              };
            }

            if (isResult) {
              return {
                ...node,
                type: "result",
                style: { width: 420, height: 340, ...node.style },
              };
            }

            if (isExp) {
              return {
                ...node,
                type: "experiment",
                style: { width: 320, ...node.style },
              };
            }

            return {
              ...node,
              type: "uploadedPaper",
              style: { width: 310, height: 150, ...node.style },
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

    const isPaper =
      targetNode.type === "uploadedPaper" || targetNode.id.startsWith("paper");
    const isNote =
      targetNode.type === "note" || targetNode.id.startsWith("note");
    const isDiscovery = targetNode.type === "discovery" || targetNode.id.startsWith("discovery");

    let formattedLabel: React.ReactNode | string = newTitleInput;
    if (isPaper && !newTitleInput.startsWith("📄")) {
      formattedLabel = `📄 ${newTitleInput}`;
    } else if (isNote && !newTitleInput.startsWith("📝")) {
      formattedLabel = `📝 ${newTitleInput}`;
    } else if (isDiscovery) {
      formattedLabel = newTitleInput;
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
          type: targetNode.type || "default",
          position: targetNode.position,
          data: {
            ...targetNode.data,
            title: newTitleInput,
            label: typeof formattedLabel === "string" ? formattedLabel : newTitleInput,
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
      ? { x: targetNode.position.x + 340, y: targetNode.position.y }
      : { x: 200, y: 200 };

    const noteNode = createNoteNode(noteId, newPos);

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
    const abstract = (node.data?.abstract as string) || "";
    setActivePaper({ id: paperKey, title, abstract });
    selectDrawer("assistant");
    setHasUnreadNotification(false);
    setChatMessages([
      {
        sender: "agent",
        text: `Ask me anything about "${title}". You can ask about methodology, key findings, or baseline details.${
          abstract ? " (Verified abstract context available)" : ""
        }`,
      },
    ]);
    setMenu(null);
  };

  const handleAddSynthesisNode = () => {
    const synthId = `synth-${Date.now()}`;
    const newNode: Node = {
      id: synthId,
      type: "synth",
      position: { x: 380, y: 220 },
      data: {
        title: "Cross-Reference Task",
      },
      style: {
        width: 300,
        height: 135,
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
                analyzingCount: connectedPaperIds.length,
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
                  title: "Cross-Reference Task",
                  analyzingCount: undefined,
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
        type: "result",
        position: { x: posX, y: posY },
        data: {
          title: "Synthesis Results",
          label: "⚡ Synthesis Results",
          summary: data.comparison_summary,
          paperCount: connectedPaperIds.length,
        },
        style: {
          width: 420,
          height: 340,
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
          type: "result",
          position: { x: posX, y: posY },
          data: {
            title: "Synthesis Results",
            label: "⚡ Synthesis Results",
            summary: data.comparison_summary,
            paperCount: connectedPaperIds.length,
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
            ? {
                ...n,
                data: {
                  ...n.data,
                  title: "Cross-Reference Task",
                  analyzingCount: undefined,
                },
              }
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
    } catch {
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
      type: "uploadedPaper",
      position: flowPosition,
      data: {
        label: `📄 ${displayName}`,
        title: displayName,
        paper_id: tempId,
        summary:
          "Paper indexed into ChromaDB. Right-click to query or annotate.",
      },
      style: {
        width: 310,
        height: 150,
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
          type: "uploadedPaper",
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

  // Add paper discovered via Discovery Hub to React Flow canvas
  const handleAddDiscoveryPaper = async (paper: DiscoveredPaperItem) => {
    // Duplicate prevention using DOI and OpenAlex ID
    if (paper.doi && existingPaperKeys.has(paper.doi.toLowerCase())) {
      alert(`Paper with DOI "${paper.doi}" is already on the canvas.`);
      return;
    }
    if (paper.openalex_id && existingPaperKeys.has(paper.openalex_id)) {
      alert(`Paper "${paper.title}" is already on the canvas.`);
      return;
    }

    const cleanDoiId = paper.doi ? paper.doi.replace(/[^a-zA-Z0-9_-]/g, "_") : "";
    const uniqueId = cleanDoiId ? `discovery-${cleanDoiId}` : `discovery-${Date.now()}`;

    // Calculate smart cascaded position on canvas so nodes do not overlap
    const existingCount = nodes.length;
    const posX = 160 + (existingCount % 4) * 360;
    const posY = 140 + Math.floor(existingCount / 4) * 230;

    const nodeData = {
      id: uniqueId,
      paper_id: uniqueId,
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      doi: paper.doi,
      publication: paper.publication,
      abstract: paper.abstract,
      openalex_id: paper.openalex_id,
      is_oa: paper.is_oa,
      oa_status: paper.oa_status,
      pdf_url: paper.pdf_url,
      landing_page_url: paper.landing_page_url,
      provider: paper.primary_provider,
      providers: paper.providers,
      summary: paper.abstract || "Verified academic metadata from Discovery Hub.",
    };

    const newNode: Node = {
      id: uniqueId,
      type: "discovery",
      position: { x: posX, y: posY },
      data: nodeData,
      style: {
        width: 340,
        ...(paper.abstract ? { height: 230 } : {}),
      },
    };

    setNodes((prev) => [...prev, newNode]);

    // Persist metadata to SQLite
    try {
      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: uniqueId,
          type: "discovery",
          position: { x: posX, y: posY },
          data: nodeData,
        }),
      });
    } catch (err) {
      console.error("Failed to persist discovery node:", err);
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
      className="relative w-screen h-screen flex flex-col bg-[#09090b] overflow-hidden"
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
      <header className="relative z-30 h-16 shrink-0 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            R
          </div>
          <span className="font-semibold text-sm text-zinc-100 tracking-tight whitespace-nowrap">
            ResearchGraph{" "}
            <span className="text-zinc-500 font-normal">
              / Multi-Paper Workspace
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto px-1 py-1.5">
          <button
            onClick={resetCanvas}
            title="Clear workspace"
            className="flex items-center gap-2 h-[42px] px-3.5 rounded-lg bg-zinc-900/90 hover:bg-rose-950/60 active:scale-[0.98] text-[13px] font-medium text-zinc-300 hover:text-rose-300 border border-zinc-800 hover:border-rose-900/50 transition cursor-pointer select-none whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>

          {/* Research Discovery Hub Trigger */}
          <button
            onClick={() =>
              selectDrawer(
                desiredDrawer === "discovery" ? "none" : "discovery",
              )
            }
            className={`flex items-center gap-2 h-[42px] px-4 rounded-lg text-[13px] font-medium text-white transition cursor-pointer select-none active:scale-[0.98] shadow-sm whitespace-nowrap shrink-0 ${
              desiredDrawer === "discovery"
                ? "bg-cyan-700 hover:bg-cyan-600 ring-2 ring-cyan-400/50"
                : "bg-cyan-600 hover:bg-cyan-500"
            }`}
            title="Search academic literature (OpenAlex, Crossref, Unpaywall)"
          >
            <Search className="w-4 h-4" /> Discovery Hub
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 h-[42px] px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-[13px] font-medium text-white transition cursor-pointer select-none shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Paper
          </button>

          <button
            onClick={handleAddSynthesisNode}
            className="flex items-center gap-2 h-[42px] px-4 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 active:scale-[0.98] text-[13px] font-medium text-purple-200 border border-purple-800/60 transition cursor-pointer select-none whitespace-nowrap shrink-0"
          >
            <GitFork className="w-4 h-4" /> + Cross-Reference Task
          </button>

          <button
            onClick={() => {
              const noteId = `note-${Date.now()}`;
              setNodes((prev) => [
                ...prev,
                createNoteNode(noteId, { x: 250, y: 150 }),
              ]);
            }}
            className="flex items-center gap-2 h-[42px] px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800/90 active:scale-[0.98] text-[13px] font-medium text-amber-300 border border-amber-900/50 transition cursor-pointer select-none whitespace-nowrap shrink-0"
          >
            <StickyNote className="w-4 h-4" /> + Add Note
          </button>

          <button
            onClick={() => {
              selectDrawer(
                desiredDrawer === "assistant" ? "none" : "assistant",
              );
              setHasUnreadNotification(false);
            }}
            className={`relative flex items-center gap-2 h-[42px] px-4 rounded-lg text-[13px] font-medium text-white transition cursor-pointer select-none active:scale-[0.98] shadow-sm whitespace-nowrap shrink-0 ${
              hasUnreadNotification
                ? "bg-amber-600 hover:bg-amber-500 animate-pulse"
                : desiredDrawer === "assistant"
                  ? "bg-indigo-700 hover:bg-indigo-600 ring-2 ring-indigo-400/50"
                  : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            <Bot className="w-4 h-4" />
            {activePaper
              ? `Chat (${activePaper.title.slice(0, 10)}...)`
              : "Assistant"}
            {hasUnreadNotification && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-200 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </header>

      {/* Workspace Body Below Header */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* Main Canvas */}
        <main className="relative flex-1 min-w-0 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
          {openDrawer !== "assistant" &&
            (isAgentThinking || hasUnreadNotification) && (
              <div
                onClick={() => {
                  selectDrawer("assistant");
                  setHasUnreadNotification(false);
                }}
                style={{
                  right:
                    openDrawer === "discovery"
                      ? "min(564px, calc(100vw - 260px))"
                      : "24px",
                }}
                className="fixed bottom-6 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-zinc-900 border border-indigo-500 shadow-2xl cursor-pointer hover:bg-zinc-800 transition-all duration-200"
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
                    const currTitle = getEditableNodeTitle(targetNode);
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

        {/* Research Discovery Hub Drawer */}
        <DiscoveryDrawer
          isOpen={openDrawer === "discovery"}
          onClose={() => selectDrawer("none")}
          onAddPaper={handleAddDiscoveryPaper}
          existingPaperKeys={existingPaperKeys}
          backendUrl={BACKEND_URL}
        />

        {/* Resizable Contextual Assistant Drawer */}
        <aside
          aria-hidden={openDrawer !== "assistant"}
          inert={openDrawer !== "assistant"}
          style={{ width: `${drawerWidth}px` }}
          className={`absolute top-0 right-0 bottom-0 max-w-full z-30 bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800 flex flex-col shadow-2xl select-text transform transition-[transform,opacity] duration-200 ease-in-out ${
            openDrawer === "assistant"
              ? "translate-x-0 opacity-100 pointer-events-auto"
              : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          {/* Draggable Handle on Left Edge */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 bottom-0 left-0 w-2 -ml-1 cursor-col-resize hover:bg-indigo-500/50 active:bg-indigo-500 transition-colors z-30"
            title="Drag to resize panel"
          />

          <div className="h-16 px-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-950/90 border border-indigo-800/80 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-zinc-100 truncate">
                  {activePaper
                    ? `Paper: ${activePaper.title}`
                    : "Research Assistant"}
                </h2>
                <p className="text-xs text-zinc-400 truncate">
                  {activePaper
                    ? "Answering from paper text"
                    : "Right-click any paper to begin chat"}
                </p>
              </div>
            </div>
            <button
              onClick={() => selectDrawer("none")}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition cursor-pointer shrink-0"
              title="Close drawer (runs in background)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">
                Right-click any paper node and choose <br />
                <span className="text-indigo-400 font-medium">
                  &quot;Ask Agent About Paper&quot;
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
      </div>

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
