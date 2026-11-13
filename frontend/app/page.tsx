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
  Folder,
  ChevronDown,
  Check,
  Cpu,
  Download,
  FileText,
  BookOpen,
} from "lucide-react";

import { DiscoveryDrawer, DiscoveredPaperItem } from "../components/DiscoveryDrawer";
import { DiscoveryNode } from "../components/DiscoveryNode";
import { FormattedPlainText } from "../components/FormattedPlainText";
import { PaperNode } from "../components/PaperNode";
import { CodeExperimentNode } from "../components/CodeExperimentNode";
import { ExperimentModal } from "../components/ExperimentModal";
import { ExportModal } from "../components/ExportModal";
import { CitationInspectorModal, CitationPayload } from "../components/CitationInspectorModal";
import {
  NoteNode,
  ResearchGapNode,
  SynthesisResultNode,
  SynthesisTaskNode,
  UploadedPaperNode,
} from "../components/WorkspaceNodes";

const BACKEND_URL = "http://localhost:8000";
type DrawerKind = "none" | "discovery" | "assistant";
const DRAWER_TRANSITION_MS = 220;

interface WorkspaceProject {
  id: string;
  name: string;
  description: string;
  node_count?: number;
  created_at?: string;
}

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

function buildNodeFallbackContext(node: Node): string {
  const data = (node.data || {}) as Record<string, unknown>;
  if (node.type === "note" || node.id.startsWith("note")) {
    return getEditableNodeTitle(node);
  }
  if (node.type === "result" || node.id.startsWith("result")) {
    const title = typeof data.title === "string" ? data.title : "Synthesis Results";
    const summary = typeof data.summary === "string" ? data.summary.trim() : "";
    return summary ? `Title: ${title}\n\n${summary}` : "";
  }

  const parts: string[] = [];
  if (typeof data.title === "string" && data.title.trim()) {
    parts.push(`Title: ${data.title.trim()}`);
  }
  if (Array.isArray(data.authors) && data.authors.length > 0) {
    parts.push(`Authors: ${data.authors.join(", ")}`);
  }
  if (data.year) {
    parts.push(`Year: ${String(data.year)}`);
  }
  if (typeof data.publication === "string" && data.publication.trim()) {
    parts.push(`Publication: ${data.publication.trim()}`);
  }
  if (typeof data.doi === "string" && data.doi.trim()) {
    parts.push(`DOI: ${data.doi.trim()}`);
  }

  const abstract = typeof data.abstract === "string" ? data.abstract.trim() : "";
  const summary = typeof data.summary === "string" ? data.summary.trim() : "";
  if (abstract) {
    parts.push(`Abstract:\n${abstract}`);
  } else if (
    summary &&
    summary !== "Verified academic metadata from Discovery Hub." &&
    !summary.startsWith("Paper indexed into ChromaDB")
  ) {
    parts.push(`Summary:\n${summary}`);
  }

  return parts.join("\n").trim();
}

// Stable NodeTypes definition defined outside component to prevent ReactFlow warning #002
const NODE_TYPES: NodeTypes = {
  discovery: DiscoveryNode,
  paper: PaperNode,
  experiment: CodeExperimentNode,
  result: SynthesisResultNode,
  synth: SynthesisTaskNode,
  note: NoteNode,
  uploadedPaper: UploadedPaperNode,
  gap: ResearchGapNode,
};

function WorkspaceCanvas() {
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
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
    context?: string;
    sourcePaperIds?: string[];
  } | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "agent"; text: string }>
  >([]);
  const [isAgentThinking, setIsAgentThinking] = useState(false);
  const [hasUnreadNotification, setHasUnreadNotification] = useState(false);

  // Multi-Workspace / Project State
  const [projects, setProjects] = useState<WorkspaceProject[]>([
    {
      id: "default",
      name: "Multi-Paper Workspace",
      description: "Default research workspace",
      node_count: 0,
    },
  ]);
  const [activeProjectId, setActiveProjectId] = useState<string>("default");
  const activeProjectIdRef = useRef<string>("default");
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  // Step 5: Traceable Citations & Export State
  const [citationModal, setCitationModal] = useState<CitationPayload | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [experimentTargetNode, setExperimentTargetNode] = useState<{
    id: string;
    title: string;
    paper_id?: string;
    abstract?: string;
    summary?: string;
  } | null>(null);
  const [isExperimentModalOpen, setIsExperimentModalOpen] = useState(false);

  const activeProject = useMemo(() => {
    return (
      projects.find((p) => p.id === activeProjectId) ||
      projects[0] || { id: "default", name: "Multi-Paper Workspace" }
    );
  }, [projects, activeProjectId]);

  // Stable custom node types reference
  const nodeTypes: NodeTypes = NODE_TYPES;

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

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/workspace/projects`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setProjects(data);
      }
    } catch (e) {
      console.warn("Failed to fetch projects:", e);
    }
  }, []);

  const handleUpdateTaskMode = useCallback((nodeId: string, newMode: "comparison" | "gaps") => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const updatedData = {
          ...n.data,
          taskMode: newMode,
          title: newMode === "gaps" ? "Research Gap Task" : "Cross-Reference Task",
        };
        fetch(`${BACKEND_URL}/api/workspace/node`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: n.id,
            type: n.type || "synth",
            position: n.position,
            project_id: activeProjectIdRef.current,
            data: updatedData,
          }),
        }).catch((e) => console.warn("Failed to persist task mode update:", e));
        return {
          ...n,
          data: updatedData,
        };
      })
    );
  }, []);

  const handleAskAgentAboutExperiment = useCallback(
    async (
      promptText: string,
      paperInfo?: {
        id: string;
        title: string;
        abstract?: string;
        context?: string;
      }
    ) => {
      // 1. Resolve active paper context
      let targetPaper = paperInfo;
      if (!targetPaper) {
        const firstPaperNode = nodes.find(
          (n) =>
            n.type === "uploadedPaper" ||
            n.type === "discovery" ||
            n.id.startsWith("paper") ||
            n.id.startsWith("discovery")
        );
        if (firstPaperNode) {
          targetPaper = {
            id: (firstPaperNode.data?.paper_id as string) || firstPaperNode.id,
            title:
              (firstPaperNode.data?.title as string) ||
              (firstPaperNode.data?.label as string) ||
              "Research Paper",
            abstract: (firstPaperNode.data?.abstract as string) || "",
            context: buildNodeFallbackContext(firstPaperNode),
          };
        } else {
          targetPaper = {
            id: "workspace-experiment",
            title: "Experiment Benchmark",
            context: promptText,
          };
        }
      }

      // 2. Open assistant drawer and set active paper so chat is fully enabled
      setActivePaper(targetPaper);
      selectDrawer("assistant");
      setHasUnreadNotification(false);
      setChatInput("");

      // 3. Populate user question and trigger thinking indicator
      setChatMessages((prev) => [
        ...prev,
        { sender: "user", text: promptText },
      ]);
      setIsAgentThinking(true);

      // 4. Immediately query backend chat agent
      try {
        const res = await fetch(`${BACKEND_URL}/api/agents/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paper_id: targetPaper.id,
            query: promptText,
            fallback_context: targetPaper.context,
          }),
        });
        const data = await res.json();
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "agent",
            text: data.reply || "No response received from assistant.",
          },
        ]);
        setHasUnreadNotification(true);
      } catch (err) {
        console.error("Experiment chat error:", err);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "agent",
            text: "Could not retrieve explanation. Ensure Ollama and the backend server are running.",
          },
        ]);
      } finally {
        setIsAgentThinking(false);
      }
    },
    [nodes, selectDrawer]
  );

  const handleAskAgentRef = useRef(handleAskAgentAboutExperiment);
  useEffect(() => {
    handleAskAgentRef.current = handleAskAgentAboutExperiment;
  });

  const handleInspectCitation = useCallback(
    (citation: { page: string; label: string }) => {
      let targetPaperId = activePaper?.id;
      let targetTitle = activePaper?.title;

      if (!targetPaperId) {
        const firstPaper = nodes.find(
          (n) =>
            n.type === "uploadedPaper" ||
            n.type === "discovery" ||
            n.id.startsWith("paper") ||
            n.id.startsWith("discovery")
        );
        if (firstPaper) {
          targetPaperId = (firstPaper.data?.paper_id as string) || firstPaper.id;
          targetTitle =
            (firstPaper.data?.title as string) ||
            (firstPaper.data?.label as string) ||
            "Paper";
        }
      }

      if (targetPaperId) {
        setCitationModal({
          paperId: targetPaperId,
          paperTitle: targetTitle || "Referenced Research Paper",
          page: citation.page,
          label: citation.label,
        });
      }
    },
    [activePaper, nodes]
  );

  const handleFocusPaperOnCanvas = useCallback(
    (paperId: string) => {
      const node = nodes.find(
        (n) =>
          n.id === paperId ||
          n.data?.paper_id === paperId ||
          (typeof n.data?.paper_id === "string" && paperId.includes(n.data.paper_id as string))
      );
      if (node) {
        setCenter(node.position.x + 170, node.position.y + 100, {
          zoom: 1.15,
          duration: 600,
        });
      }
    },
    [nodes, setCenter]
  );

  const fetchGraph = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/workspace/graph?project_id=${projectId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const styledNodes = data.nodes.map((node: Node) => {
          const rawType = (node.type || node.data?._node_type || "").toString();

          if (rawType === "discovery" || node.id.startsWith("discovery")) {
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

          if (rawType === "paper" || (rawType !== "uploadedPaper" && node.id.startsWith("paper"))) {
            return {
              ...node,
              type: "paper",
              style: { width: 340, ...node.style },
            };
          }

          if (rawType === "note" || node.id.startsWith("note") || node.data?.type === "note") {
            return {
              ...node,
              type: "note",
              style: { width: 260, height: 150, ...node.style },
            };
          }

          if (rawType === "synth" || node.id.startsWith("synth")) {
            const currentMode = (node.data?.taskMode as "comparison" | "gaps") || "comparison";
            return {
              ...node,
              type: "synth",
              style: { width: 300, height: 150, ...node.style },
              data: {
                ...node.data,
                taskMode: currentMode,
                onModeChange: (newMode: "comparison" | "gaps") => handleUpdateTaskMode(node.id, newMode),
              },
            };
          }

          if (rawType === "gap" || node.id.startsWith("gap") || node.data?._node_type === "gap") {
            return {
              ...node,
              type: "gap",
              style: { width: 420, height: 340, ...node.style },
            };
          }

          if (rawType === "result" || node.id.startsWith("result")) {
            return {
              ...node,
              type: "result",
              style: { width: 420, height: 340, ...node.style },
            };
          }

          if (rawType === "experiment" || node.id.startsWith("exp") || Boolean(node.data?.status)) {
            return {
              ...node,
              type: "experiment",
              style: { width: 330, ...node.style },
              data: {
                ...node.data,
                onAskAgent: () => {
                  const summaryText =
                    (node.data?.summary as string) ||
                    (node.data?.metric as string) ||
                    "CPU benchmark";
                  const primaryMetric = (node.data?.primaryMetric as string) || "";
                  const targetPaperId = node.data?.targetPaperId as string;
                  const targetPaperNode = targetPaperId
                    ? data.nodes.find(
                        (n: Node) =>
                          n.id === targetPaperId ||
                          (n.data && n.data.paper_id === targetPaperId)
                      )
                    : null;
                  const paperTitle =
                    (targetPaperNode?.data?.title as string) ||
                    (targetPaperNode?.data?.label as string) ||
                    "the research paper";
                  const paperInfo = targetPaperNode
                    ? {
                        id: (targetPaperNode.data?.paper_id as string) || targetPaperNode.id,
                        title: paperTitle,
                        abstract: (targetPaperNode.data?.abstract as string) || "",
                        context: buildNodeFallbackContext(targetPaperNode),
                      }
                    : undefined;

                  const metricDetail = primaryMetric
                    ? `${primaryMetric}: ${summaryText}`
                    : summaryText;
                  const enrichedQuery = `In the context of ${paperTitle}, explain what our sandbox simulation result (${metricDetail}) means and how it relates to the paper's findings.`;

                  handleAskAgentRef.current(enrichedQuery, paperInfo);
                },
              },
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
        setTimeout(() => {
          fitView({ padding: 0.25, duration: 400 });
        }, 80);
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.warn("Database load warning:", err);
    }
  }, [fitView, handleUpdateTaskMode]);

  // Initial load: mount only with guard to prevent duplicate calls or HMR dependency array length mismatches
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    const savedPid = typeof window !== "undefined"
      ? localStorage.getItem("research_graph_active_project") || "default"
      : "default";
    setActiveProjectId(savedPid);
    activeProjectIdRef.current = savedPid;
    fetchProjects();
    fetchGraph(savedPid);
  }, [fetchProjects, fetchGraph]);

  const handleSwitchProject = useCallback(async (projectId: string) => {
    setActiveProjectId(projectId);
    activeProjectIdRef.current = projectId;
    if (typeof window !== "undefined") {
      localStorage.setItem("research_graph_active_project", projectId);
    }
    setIsProjectDropdownOpen(false);
    setActivePaper(null);
    setChatMessages([]);
    await fetchGraph(projectId);
    fetchProjects();
  }, [fetchGraph, fetchProjects]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/workspace/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim(),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewProjectName("");
        setNewProjectDesc("");
        setIsNewProjectModalOpen(false);
        await fetchProjects();
        handleSwitchProject(created.id);
      }
    } catch (e) {
      console.error("Failed to create project:", e);
    }
  }, [newProjectName, newProjectDesc, fetchProjects, handleSwitchProject]);

  const handleDeleteProject = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (projectId === "default") return;
    if (!confirm("Are you sure you want to delete this workspace and all its nodes?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/workspace/projects/${projectId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (activeProjectIdRef.current === projectId) {
          if (typeof window !== "undefined") {
            localStorage.setItem("research_graph_active_project", "default");
          }
          handleSwitchProject("default");
        } else {
          fetchProjects();
        }
      }
    } catch (e) {
      console.error("Failed to delete project:", e);
    }
  }, [handleSwitchProject, fetchProjects]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onNodeDragStop = useCallback(
    async (_event: unknown, node: Node) => {
      try {
        await fetch(`${BACKEND_URL}/api/workspace/node`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: node.id,
            type: node.type || "uploadedPaper",
            position: node.position,
            project_id: activeProjectIdRef.current,
            data: node.data,
          }),
        });
      } catch (e) {
        console.warn("Failed to persist dragged node position:", e);
      }
    },
    []
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
    fetchProjects();
  }, [fetchProjects]);

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
          project_id: activeProjectId,
        }),
      });
    } catch (e) {
      console.error("Save edge error:", e);
    }
  }, [activeProjectId]);

  const resetCanvas = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/workspace/reset?project_id=${activeProjectId}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Backend reset error:", e);
    }
    setNodes([]);
    setEdges([]);
    setActivePaper(null);
    setChatMessages([]);
    fetchProjects();
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
          project_id: activeProjectId,
          data: {
            ...targetNode.data,
            title: newTitleInput,
            label: typeof formattedLabel === "string" ? formattedLabel : newTitleInput,
          },
        }),
      });
      fetchProjects();
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

  const handleOpenExperimentModal = (node: Node) => {
    setExperimentTargetNode({
      id: node.id,
      title: (node.data?.title as string) || (node.data?.label as string) || "Research Paper",
      paper_id: (node.data?.paper_id as string) || node.id,
      abstract: (node.data?.abstract as string) || "",
      summary: (node.data?.summary as string) || "",
    });
    setIsExperimentModalOpen(true);
    setMenu(null);
  };

  const handleSaveExperimentToCanvas = useCallback(
    async (
      experimentData: {
        label: string;
        codeSnippet: string;
        metric: string;
        baseline?: string;
        speedup?: string;
        summary?: string;
        primary_metric?: string;
        status: "success" | "failed";
      },
      targetNodeId: string
    ) => {
      const expId = `exp-${Date.now()}`;
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      let posX = targetNode ? targetNode.position.x + 360 : 350;
      let posY = targetNode ? targetNode.position.y : 220;
      while (nodes.some((n) => Math.abs(n.position.x - posX) < 70 && Math.abs(n.position.y - posY) < 70)) {
        posY += 140;
      }

      const newExpNode: Node = {
        id: expId,
        type: "experiment",
        position: { x: posX, y: posY },
        style: { width: 330 },
        data: {
          label: experimentData.label,
          codeSnippet: experimentData.codeSnippet,
          metric: experimentData.metric,
          baseline: experimentData.baseline,
          speedup: experimentData.speedup,
          summary: experimentData.summary,
          primaryMetric: experimentData.primary_metric,
          status: experimentData.status,
          targetPaperId: targetNodeId,
          onAskAgent: () => {
            const summaryText =
              experimentData.summary || experimentData.metric || "CPU benchmark";
            const primaryMetric = experimentData.primary_metric || "";
            const targetNode = nodes.find((n) => n.id === targetNodeId);
            const paperTitle =
              (targetNode?.data?.title as string) ||
              (targetNode?.data?.label as string) ||
              "the research paper";
            const paperInfo = targetNode
              ? {
                  id: (targetNode.data?.paper_id as string) || targetNode.id,
                  title: paperTitle,
                  abstract: (targetNode.data?.abstract as string) || "",
                  context: buildNodeFallbackContext(targetNode),
                }
              : undefined;

            const metricDetail = primaryMetric
              ? `${primaryMetric}: ${summaryText}`
              : summaryText;
            const enrichedQuery = `In the context of ${paperTitle}, explain what our sandbox simulation result (${metricDetail}) means and how it relates to the paper's findings.`;

            handleAskAgentAboutExperiment(enrichedQuery, paperInfo);
          },
        },
      };

      const newEdge: Edge = {
        id: `edge-${targetNodeId}-${expId}`,
        source: targetNodeId,
        target: expId,
        label: "tested_in_sandbox",
        animated: true,
        style: { stroke: "#06b6d4", strokeWidth: 2 },
      };

      setNodes((prev) => [...prev, newExpNode]);
      setEdges((prev) => [...prev, newEdge]);

      try {
        await fetch(`${BACKEND_URL}/api/workspace/node`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newExpNode.id,
            type: "experiment",
            position: newExpNode.position,
            project_id: activeProjectIdRef.current,
            data: newExpNode.data,
          }),
        });
        await fetch(`${BACKEND_URL}/api/workspace/edge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newEdge.id,
            source: newEdge.source,
            target: newEdge.target,
            label: newEdge.label || "tested_in_sandbox",
            project_id: activeProjectIdRef.current,
          }),
        });
        fetchProjects();
      } catch (e) {
        console.warn("Failed to persist experiment node:", e);
      }
    },
    [nodes, fetchProjects]
  );

  const handleOpenChatForNode = (node: Node) => {
    const paperKey =
      (node.data?.paper_id as string) || (node.id as string) || "";
    const title = (node.data?.title || node.data?.label || "Paper") as string;
    const abstract = (node.data?.abstract as string) || "";
    const context = buildNodeFallbackContext(node);

    let sourcePaperIds: string[] | undefined;
    if (node.type === "result" || node.id.startsWith("result")) {
      const storedSources = Array.isArray(node.data?.sourcePaperIds)
        ? (node.data.sourcePaperIds as string[])
        : [];
      if (storedSources.length > 0) {
        sourcePaperIds = storedSources;
      } else {
        // Trace Synthesis Results <- Cross-Reference Task <- Source Papers on canvas
        const synthIds = edges
          .filter((e) => e.target === node.id)
          .map((e) => e.source);
        const derivedIds = edges
          .filter((e) => synthIds.includes(e.target))
          .map((e) => nodes.find((n) => n.id === e.source))
          .filter((n): n is Node => n !== undefined)
          .map((n) => (n.data?.paper_id as string) || n.id);
        if (derivedIds.length > 0) {
          sourcePaperIds = derivedIds;
        }
      }
    }

    setActivePaper({ id: paperKey, title, abstract, context, sourcePaperIds });
    selectDrawer("assistant");
    setHasUnreadNotification(false);
    setChatMessages([
      {
        sender: "agent",
        text: `Ask me anything about "${title}". You can ask about methodology, key findings, or claims cited in [Page 1] or [Abstract].`,
      },
    ]);
    setMenu(null);
  };

  const handleAddSynthesisNode = () => {
    const synthId = `synth-${Date.now()}`;
    let posX = 380;
    let posY = 220;
    while (nodes.some((n) => Math.abs(n.position.x - posX) < 70 && Math.abs(n.position.y - posY) < 70)) {
      posY += 140;
    }
    const newNode: Node = {
      id: synthId,
      type: "synth",
      position: { x: posX, y: posY },
      data: {
        title: "Cross-Reference Task",
        taskMode: "comparison",
        onModeChange: (newMode: "comparison" | "gaps") => handleUpdateTaskMode(synthId, newMode),
      },
      style: {
        width: 300,
        height: 150,
      },
    };
    setNodes((prev) => [...prev, newNode]);
    fetch(`${BACKEND_URL}/api/workspace/node`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: synthId,
        type: "synth",
        position: { x: posX, y: posY },
        project_id: activeProjectIdRef.current,
        data: {
          title: "Cross-Reference Task",
          taskMode: "comparison",
        },
      }),
    }).catch((e) => console.warn("Failed to persist synth node:", e));
  };

  const handleRunSynthesis = async (synthNodeId: string) => {
    const incomingEdges = edges.filter((e) => e.target === synthNodeId);

    const connectedSourceNodes = incomingEdges
      .map((edge) => nodes.find((n) => n.id === edge.source))
      .filter((n): n is Node => n !== undefined)
      .filter(
        (n) =>
          !n.id.startsWith("synth") &&
          !n.id.startsWith("note") &&
          !n.id.startsWith("result") &&
          !n.id.startsWith("gap"),
      );

    const connectedPaperIds = connectedSourceNodes.map(
      (sourceNode) => (sourceNode.data?.paper_id as string) || sourceNode.id,
    );

    const synthNode = nodes.find((n) => n.id === synthNodeId);
    const isGapMode = synthNode?.data?.taskMode === "gaps";

    if (connectedPaperIds.length < 2) {
      alert(
        isGapMode
          ? "Please connect at least 2 papers as sources into this Research Gap Task node."
          : "Please connect at least 2 papers as sources into this Cross-Reference Task node.",
      );
      setMenu(null);
      return;
    }

    const paperContexts: Record<string, string> = {};
    for (const sourceNode of connectedSourceNodes) {
      const pid = (sourceNode.data?.paper_id as string) || sourceNode.id;
      const ctx = buildNodeFallbackContext(sourceNode);
      if (ctx) {
        paperContexts[pid] = ctx;
      }
    }

    setMenu(null);

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
      const endpoint = isGapMode
        ? `${BACKEND_URL}/api/agents/research-gap`
        : `${BACKEND_URL}/api/agents/cross-reference`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_ids: connectedPaperIds,
          paper_contexts: paperContexts,
        }),
      });
      const data = await res.json();

      setNodes((prev) =>
        prev.map((n) =>
          n.id === synthNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  title: isGapMode ? "Research Gap Task" : "Cross-Reference Task",
                  analyzingCount: undefined,
                },
              }
            : n,
        ),
      );

      const targetText = isGapMode
        ? data.gaps_summary || "No research gaps found."
        : data.comparison_summary || "No comparison output.";

      const targetNodeId = isGapMode ? `gap-${Date.now()}` : `result-${Date.now()}`;
      let posX = synthNode ? synthNode.position.x + 360 : 720;
      let posY = synthNode ? synthNode.position.y - 40 : 200;
      while (nodes.some((n) => Math.abs(n.position.x - posX) < 70 && Math.abs(n.position.y - posY) < 70)) {
        posY += 140;
      }

      const outputNode: Node = {
        id: targetNodeId,
        type: isGapMode ? "gap" : "result",
        position: { x: posX, y: posY },
        data: {
          title: isGapMode ? "Research Gap Discovery" : "Synthesis Results",
          label: isGapMode ? "🔍 Research Gap Discovery" : "⚡ Synthesis Results",
          summary: targetText,
          gaps: isGapMode ? targetText : undefined,
          paperCount: connectedPaperIds.length,
          sourcePaperIds: connectedPaperIds,
        },
        style: {
          width: 420,
          height: 340,
        },
      };

      const resultEdge: Edge = {
        id: `e-${synthNodeId}-${targetNodeId}`,
        source: synthNodeId,
        target: targetNodeId,
        animated: true,
        label: isGapMode ? "gaps_discovered" : "synthesized_into",
        style: { stroke: isGapMode ? "#f59e0b" : "#818cf8", strokeWidth: 2 },
      };

      setNodes((prev) => [...prev, outputNode]);
      setEdges((prev) => [...prev, resultEdge]);

      await fetch(`${BACKEND_URL}/api/workspace/node`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: targetNodeId,
          type: isGapMode ? "gap" : "result",
          position: { x: posX, y: posY },
          project_id: activeProjectIdRef.current,
          data: {
            title: isGapMode ? "Research Gap Discovery" : "Synthesis Results",
            label: isGapMode ? "🔍 Research Gap Discovery" : "⚡ Synthesis Results",
            summary: targetText,
            gaps: isGapMode ? targetText : undefined,
            paperCount: connectedPaperIds.length,
            sourcePaperIds: connectedPaperIds,
          },
        }),
      });

      await fetch(`${BACKEND_URL}/api/workspace/edge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: resultEdge.id,
          source: synthNodeId,
          target: targetNodeId,
          label: isGapMode ? "gaps_discovered" : "synthesized_into",
          project_id: activeProjectId,
        }),
      });
      fetchProjects();
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
    if (!chatInput.trim()) return;
    const userText = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setIsAgentThinking(true);

    let currentPaper = activePaper;
    if (!currentPaper) {
      const firstPaper = nodes.find(
        (n) =>
          n.type === "uploadedPaper" ||
          n.type === "discovery" ||
          n.id.startsWith("paper") ||
          n.id.startsWith("discovery")
      );
      if (firstPaper) {
        currentPaper = {
          id: (firstPaper.data?.paper_id as string) || firstPaper.id,
          title:
            (firstPaper.data?.title as string) ||
            (firstPaper.data?.label as string) ||
            "Research Paper",
          abstract: (firstPaper.data?.abstract as string) || "",
          context: buildNodeFallbackContext(firstPaper),
        };
      } else {
        currentPaper = {
          id: "workspace-assistant",
          title: activeProject.name,
          context: nodes
            .map((n) => buildNodeFallbackContext(n))
            .filter(Boolean)
            .join("\n\n"),
        };
      }
      setActivePaper(currentPaper);
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/agents/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_id: currentPaper.id,
          query: userText,
          fallback_context: currentPaper.context,
          source_paper_ids: currentPaper.sourcePaperIds,
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { sender: "agent", text: data.reply || "No response received." },
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
          project_id: activeProjectId,
          data: {
            label: `📄 ${displayName}`,
            title: displayName,
            paper_id: actualId,
            summary: "Paper indexed into ChromaDB.",
          },
        }),
      });
      fetchProjects();
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
          project_id: activeProjectId,
          data: nodeData,
        }),
      });
      fetchProjects();
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
      <header className="relative z-30 h-16 shrink-0 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm px-4 xl:px-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 shrink-0 relative">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            R
          </div>
          <span className="font-semibold text-sm text-zinc-100 tracking-tight whitespace-nowrap">
            ResearchGraph
          </span>
          <span className="text-zinc-600 font-light hidden sm:inline">/</span>

          {/* Workspace Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProjectDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
              title="Switch research workspace project"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="max-w-[120px] xl:max-w-[170px] truncate">{activeProject.name}</span>
              <span className="text-[10px] text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded-full border border-zinc-700/50">
                {activeProject.node_count ?? nodes.length}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            </button>

            {isProjectDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProjectDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                    <span>Workspaces</span>
                    <span className="text-zinc-500">{projects.length} total</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-1 my-1">
                    {projects.map((p) => {
                      const isActive = p.id === activeProjectId;
                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSwitchProject(p.id)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                            isActive
                              ? "bg-indigo-950/60 text-indigo-200 border border-indigo-800/50"
                              : "text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isActive ? (
                              <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            ) : (
                              <Folder className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            )}
                            <div className="truncate">
                              <p className="font-medium truncate">{p.name}</p>
                              {p.description && (
                                <p className="text-[10px] text-zinc-500 truncate">{p.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">
                              {p.node_count ?? 0}
                            </span>
                            {p.id !== "default" && (
                              <button
                                onClick={(e) => handleDeleteProject(e, p.id)}
                                title="Delete workspace"
                                className="p-1 hover:text-rose-400 hover:bg-rose-950/50 rounded transition text-zinc-500"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-1 border-t border-zinc-800/80">
                    <button
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        setIsNewProjectModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-indigo-400 hover:bg-indigo-950/40 hover:text-indigo-300 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Create New Workspace</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 xl:gap-2.5 overflow-x-auto no-scrollbar px-1 py-1.5 min-w-0">
          <button
            onClick={resetCanvas}
            title="Clear workspace"
            className="flex items-center gap-1.5 h-[38px] px-3 xl:px-3.5 rounded-lg bg-zinc-900/90 hover:bg-rose-950/60 active:scale-[0.98] text-xs xl:text-[13px] font-medium text-zinc-300 hover:text-rose-300 border border-zinc-800 hover:border-rose-900/50 transition cursor-pointer select-none whitespace-nowrap shrink-0"
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
            className={`flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg text-xs xl:text-[13px] font-medium text-white transition cursor-pointer select-none active:scale-[0.98] shadow-sm whitespace-nowrap shrink-0 ${
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
            className="flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-xs xl:text-[13px] font-medium text-white transition cursor-pointer select-none shadow-sm whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Paper
          </button>

          <button
            onClick={handleAddSynthesisNode}
            className="flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 active:scale-[0.98] text-xs xl:text-[13px] font-medium text-purple-200 border border-purple-800/60 transition cursor-pointer select-none whitespace-nowrap shrink-0"
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
            className="flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800/90 active:scale-[0.98] text-xs xl:text-[13px] font-medium text-amber-300 border border-amber-900/50 transition cursor-pointer select-none whitespace-nowrap shrink-0"
          >
            <StickyNote className="w-4 h-4" /> + Add Note
          </button>

          {/* Workspace Export Trigger */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            title="Export research dossier (.md) or bibliography (.bib)"
            className="flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg bg-zinc-900 hover:bg-emerald-950/60 active:scale-[0.98] text-xs xl:text-[13px] font-medium text-emerald-300 border border-emerald-900/50 hover:border-emerald-800/70 transition cursor-pointer select-none whitespace-nowrap shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export</span>
          </button>

          <button
            onClick={() => {
              const nextState = desiredDrawer === "assistant" ? "none" : "assistant";
              selectDrawer(nextState);
              setHasUnreadNotification(false);
              if (nextState === "assistant" && !activePaper) {
                const firstPaper = nodes.find(
                  (n) =>
                    n.type === "uploadedPaper" ||
                    n.type === "discovery" ||
                    n.id.startsWith("paper") ||
                    n.id.startsWith("discovery")
                );
                if (firstPaper) {
                  const paperKey = (firstPaper.data?.paper_id as string) || firstPaper.id;
                  const title = (firstPaper.data?.title || firstPaper.data?.label || "Paper") as string;
                  const abstract = (firstPaper.data?.abstract as string) || "";
                  const context = buildNodeFallbackContext(firstPaper);
                  setActivePaper({ id: paperKey, title, abstract, context });
                  if (chatMessages.length === 0) {
                    setChatMessages([
                      {
                        sender: "agent",
                        text: `Ask me anything about "${title}". You can ask about methodology, key findings, or claims cited in [Page 1] or [Abstract].`,
                      },
                    ]);
                  }
                }
              }
            }}
            className={`relative flex items-center gap-1.5 h-[38px] px-3 xl:px-4 rounded-lg text-xs xl:text-[13px] font-medium text-white transition cursor-pointer select-none active:scale-[0.98] shadow-sm whitespace-nowrap shrink-0 ${
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
            onNodeDragStop={onNodeDragStop}
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

              {menu &&
                !menu.id.startsWith("note") &&
                !menu.id.startsWith("synth") &&
                !menu.id.startsWith("result") &&
                !menu.id.startsWith("gap") &&
                !menu.id.startsWith("exp") && (
                  <button
                    onClick={() => {
                      const targetNode = nodes.find((n) => n.id === menu.id);
                      if (targetNode) handleOpenExperimentModal(targetNode);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-cyan-300 hover:text-cyan-200 hover:bg-cyan-950/40 transition text-left cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Run Code Experiment (Sandbox)
                  </button>
                )}

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
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer ${
                    menu.nodeData?.taskMode === "gaps"
                      ? "text-amber-300 hover:text-amber-200 hover:bg-amber-950/40"
                      : "text-purple-300 hover:text-purple-200 hover:bg-purple-950/40"
                  }`}
                >
                  {menu.nodeData?.taskMode === "gaps" ? (
                    <>
                      <Search className="w-3.5 h-3.5 text-amber-400" /> Run Research Gap Discovery
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Run Cross-Reference
                    </>
                  )}
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
                    : `Workspace: ${activeProject.name}`}
                </h2>
                <p className="text-xs text-zinc-400 truncate">
                  {activePaper
                    ? "Answering from paper text & benchmark data"
                    : "Ask questions about papers in this workspace"}
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
              <div className="text-center text-zinc-500 py-12 space-y-2">
                <Bot className="w-8 h-8 text-indigo-400/60 mx-auto" />
                <p className="text-xs text-zinc-400 font-medium">
                  {activePaper
                    ? `Ask anything about "${activePaper.title}"`
                    : "Ask questions about your research papers or benchmarks."}
                </p>
                <p className="text-[11px] text-zinc-500">
                  Tip: Right-click any paper or click &quot;Ask Assistant&quot; on experiment results to inspect details.
                </p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-indigo-950/60 border border-indigo-800/40 text-indigo-200 ml-4"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-300 mr-4"
                  }`}
                >
                  {msg.sender === "agent" ? (
                    <FormattedPlainText
                      text={msg.text}
                      onCitationClick={handleInspectCitation}
                    />
                  ) : (
                    msg.text
                  )}
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
                    ? `Ask about ${activePaper.title.slice(0, 24)}...`
                    : "Ask questions about workspace papers or benchmarks..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                title="Send message"
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

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <Folder className="w-5 h-5" />
                <h3 className="font-semibold text-base text-zinc-100">Create Research Workspace</h3>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Workspaces isolate your paper graph, canvas nodes, and ChromaDB vector memory.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Attention Models & Transformer Architecture"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Comparative literature review for Chapter 2"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200 placeholder:text-zinc-600"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition shadow-sm"
              >
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Experiment Execution Sandbox Modal */}
      <ExperimentModal
        isOpen={isExperimentModalOpen}
        onClose={() => setIsExperimentModalOpen(false)}
        targetNode={experimentTargetNode}
        activeProjectId={activeProjectId}
        onExperimentSaved={handleSaveExperimentToCanvas}
        onAskAgent={handleAskAgentAboutExperiment}
      />

      {/* Workspace Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeProjectId={activeProjectId}
        activeProjectName={activeProject.name}
        nodes={nodes}
        backendUrl={BACKEND_URL}
        onExportSuccess={(msg) => {
          setExportFeedback(msg);
          setTimeout(() => setExportFeedback(null), 3500);
        }}
      />

      {/* Traceable Citation Inspector Modal */}
      <CitationInspectorModal
        isOpen={!!citationModal}
        onClose={() => setCitationModal(null)}
        citation={citationModal}
        onFocusNode={handleFocusPaperOnCanvas}
        backendUrl={BACKEND_URL}
      />

      {/* Export Notification Toast */}
      {exportFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-950/95 border border-emerald-600/70 text-emerald-200 text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{exportFeedback}</span>
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
