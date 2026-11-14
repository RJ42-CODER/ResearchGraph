"use client";

import React from "react";
import {
  Network,
  UploadCloud,
  Search,
  Download,
  StickyNote,
  Plus,
  Sparkles,
  ArrowRight,
  FileText,
  GitFork,
  AlertTriangle,
  Cpu,
  FolderOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
} from "lucide-react";
import { Node } from "@xyflow/react";

interface WorkspaceProject {
  id: string;
  name: string;
  description?: string;
  node_count?: number;
  created_at?: string;
}

interface HomeDashboardProps {
  activeProject: WorkspaceProject;
  projects: WorkspaceProject[];
  nodes: Node[];
  onResumeGraph: () => void;
  onSwitchProject: (projectId: string) => void;
  onOpenWorkspaceGraph?: (projectId: string) => void;
  onOpenNewProjectModal: () => void;
  onUploadPdf: () => void;
  onOpenDiscovery: () => void;
  onAddNote: () => void;
  onOpenExport: () => void;
  onFocusNode: (nodeId: string) => void;
}

export function HomeDashboard({
  activeProject,
  projects,
  nodes,
  onResumeGraph,
  onSwitchProject,
  onOpenWorkspaceGraph,
  onOpenNewProjectModal,
  onUploadPdf,
  onOpenDiscovery,
  onAddNote,
  onOpenExport,
  onFocusNode,
}: HomeDashboardProps) {
  // Aggregate stats from current canvas nodes
  let paperCount = 0;
  let synthesisCount = 0;
  let gapCount = 0;
  let experimentCount = 0;
  let noteCount = 0;

  for (const n of nodes) {
    const rawType = (n.type || n.data?._node_type || "").toString();
    const id = n.id;
    if (
      rawType === "paper" ||
      rawType === "uploadedPaper" ||
      rawType === "discovery" ||
      id.startsWith("paper") ||
      id.startsWith("discovery")
    ) {
      paperCount++;
    } else if (
      rawType === "synth" ||
      rawType === "synthesisResult" ||
      rawType === "synthesisTask" ||
      id.startsWith("synth")
    ) {
      synthesisCount++;
    } else if (
      rawType === "gap" ||
      rawType === "researchGap" ||
      id.startsWith("gap")
    ) {
      gapCount++;
    } else if (
      rawType === "experiment" ||
      rawType === "codeExperiment" ||
      rawType === "result" ||
      id.startsWith("exp") ||
      id.startsWith("result")
    ) {
      experimentCount++;
    } else if (
      rawType === "note" ||
      id.startsWith("note") ||
      n.data?.type === "note"
    ) {
      noteCount++;
    }
  }

  // Recent 6 nodes on canvas
  const recentNodes = [...nodes].reverse().slice(0, 6);

  const handleOpenGraphForProject = (projectId: string) => {
    if (onOpenWorkspaceGraph) {
      onOpenWorkspaceGraph(projectId);
    } else {
      onSwitchProject(projectId);
      onResumeGraph();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-8 animate-in fade-in duration-200">
      {/* Hero Continue Research Card */}
      <div className="monochrome-card relative overflow-hidden rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black text-[11px] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-current" />
              <span>Active Research Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
              {activeProject.name}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              {activeProject.description ||
                "Synthesize multi-paper evidence, isolate research gaps, and run grounded simulation benchmarks with LangGraph and ChromaDB."}
            </p>
          </div>

          <button
            type="button"
            onClick={onResumeGraph}
            className="btn-primary-mono inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-semibold transition-all shadow-lg active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Network className="w-4 h-4" />
            <span>Resume Knowledge Graph</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Metrics Grid inside Hero */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10 [html[data-theme='light']_&]:border-black/10">
          <div className="monochrome-card p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <FileText className="w-4 h-4 text-current" />
              <span>Papers Ingested</span>
            </div>
            <span className="text-2xl font-bold text-current font-mono mt-1 block">
              {paperCount}
            </span>
          </div>

          <div className="monochrome-card p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <GitFork className="w-4 h-4 text-current" />
              <span>Syntheses</span>
            </div>
            <span className="text-2xl font-bold text-current font-mono mt-1 block">
              {synthesisCount}
            </span>
          </div>

          <div className="monochrome-card p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <AlertTriangle className="w-4 h-4 text-current" />
              <span>Research Gaps</span>
            </div>
            <span className="text-2xl font-bold text-current font-mono mt-1 block">
              {gapCount}
            </span>
          </div>

          <div className="monochrome-card p-3.5 rounded-2xl">
            <div className="flex items-center gap-2 text-zinc-400 text-xs">
              <Cpu className="w-4 h-4 text-current" />
              <span>Benchmarks</span>
            </div>
            <span className="text-2xl font-bold text-current font-mono mt-1 block">
              {experimentCount}
            </span>
          </div>
        </div>
      </div>

      {/* Global Quick Actions Strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-mono">
            Global Actions
          </h2>
          <span className="text-[11px] text-zinc-500 font-mono">
            Multi-Workspace Studio
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={onOpenNewProjectModal}
            className="monochrome-card flex items-start gap-3 p-4 rounded-2xl text-left transition group cursor-pointer shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4 text-current" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 [html[data-theme='light']_&]:text-zinc-900 block group-hover:text-current transition-colors">
                + New Workspace
              </span>
              <span className="text-[11px] text-zinc-400 leading-snug">
                Create isolated research graph for new topic
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenDiscovery}
            className="monochrome-card flex items-start gap-3 p-4 rounded-2xl text-left transition group cursor-pointer shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Search className="w-4 h-4 text-current" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 [html[data-theme='light']_&]:text-zinc-900 block group-hover:text-current transition-colors">
                Search Discovery Hub
              </span>
              <span className="text-[11px] text-zinc-400 leading-snug">
                Query 250M+ OpenAlex research publications
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onUploadPdf}
            className="monochrome-card flex items-start gap-3 p-4 rounded-2xl text-left transition group cursor-pointer shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-4 h-4 text-current" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 [html[data-theme='light']_&]:text-zinc-900 block group-hover:text-current transition-colors">
                Upload Paper PDF
              </span>
              <span className="text-[11px] text-zinc-400 leading-snug">
                Extract text & index into ChromaDB vector store
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenExport}
            className="monochrome-card flex items-start gap-3 p-4 rounded-2xl text-left transition group cursor-pointer shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Download className="w-4 h-4 text-current" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 [html[data-theme='light']_&]:text-zinc-900 block group-hover:text-current transition-colors">
                Export Project
              </span>
              <span className="text-[11px] text-zinc-400 leading-snug">
                Download Markdown dossier & BibTeX citations
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* All Workspaces Grid */}
      <div className="monochrome-card p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 [html[data-theme='light']_&]:border-black/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-current" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-current">
                All Workspaces ({projects.length})
              </h2>
              <p className="text-[11px] text-zinc-400">
                Each workspace isolates its own papers, ChromaDB vector collections, and simulation nodes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenNewProjectModal}
            className="btn-primary-mono inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Workspace</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const isActive = p.id === activeProject.id;
            return (
              <div
                key={p.id}
                className={`monochrome-card p-4 rounded-2xl transition flex flex-col justify-between gap-4 ${
                  isActive
                    ? "border-white/50 shadow-md [html[data-theme='light']_&]:border-black/50"
                    : "opacity-95 hover:opacity-100"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="text-xs font-bold text-current hover:opacity-80 transition cursor-pointer truncate"
                      onClick={() => handleOpenGraphForProject(p.id)}
                      title={p.name}
                    >
                      {p.name}
                    </h3>
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/30 [html[data-theme='light']_&]:bg-black/10 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/25 text-[9px] font-mono shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-zinc-600 [html[data-theme='light']_&]:border-black/10 text-[9px] font-mono shrink-0">
                        {p.node_count ?? 0} items
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                    {p.description || "Research workspace with semantic indexing and sandbox verification."}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 [html[data-theme='light']_&]:border-black/10 text-xs">
                  <button
                    type="button"
                    onClick={() => onSwitchProject(p.id)}
                    className={`text-[11px] transition cursor-pointer ${
                      isActive
                        ? "text-current font-bold"
                        : "text-zinc-400 hover:text-current"
                    }`}
                  >
                    {isActive ? "Currently Selected" : "Switch Workspace"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenGraphForProject(p.id)}
                    className="btn-glass-mono inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition cursor-pointer"
                  >
                    <Network className="w-3 h-3" />
                    <span>Open Graph</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Graph Activity */}
      <div className="monochrome-card p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-current" />
            <h2 className="text-sm font-semibold text-current">
              Active Workspace Activity ({activeProject.name})
            </h2>
          </div>
          <button
            type="button"
            onClick={onResumeGraph}
            className="text-xs text-zinc-400 hover:text-current transition cursor-pointer flex items-center gap-1"
          >
            <span>Open Graph Canvas</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentNodes.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 text-xs space-y-2">
            <Network className="w-8 h-8 mx-auto text-zinc-600" />
            <p>Active workspace graph is empty. Import a paper or add a note to begin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentNodes.map((node) => {
              const title = String(
                node.data?.title || node.data?.label || node.id
              );
              const rawType = (node.type || node.data?._node_type || "").toString();
              const isPaper =
                rawType === "paper" ||
                rawType === "uploadedPaper" ||
                rawType === "discovery" ||
                node.id.startsWith("paper") ||
                node.id.startsWith("discovery");

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    onResumeGraph();
                    onFocusNode(node.id);
                  }}
                  className="monochrome-card p-3.5 rounded-2xl transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0">
                      {isPaper ? (
                        <FileText className="w-3.5 h-3.5 text-current" />
                      ) : rawType.includes("gap") ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-current" />
                      ) : rawType.includes("exp") ? (
                        <Cpu className="w-3.5 h-3.5 text-current" />
                      ) : (
                        <GitFork className="w-3.5 h-3.5 text-current" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-300 [html[data-theme='light']_&]:text-zinc-800 font-medium truncate group-hover:text-current transition-colors">
                      {title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResumeGraph();
                      onFocusNode(node.id);
                    }}
                    className="text-[11px] text-zinc-400 group-hover:text-current font-medium shrink-0 flex items-center gap-1"
                  >
                    <span>Focus</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
