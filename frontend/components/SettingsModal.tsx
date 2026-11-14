"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  Database,
  MapPin,
  Activity,
  Layers,
  FileText,
  Cpu,
  GitFork,
  AlertTriangle,
  StickyNote,
  Sliders,
  HardDrive,
  Info,
} from "lucide-react";
import { Node, Edge } from "@xyflow/react";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "settings" | "memory";
  // Studio Preferences
  showMiniMap: boolean;
  onToggleMiniMap: (show: boolean) => void;
  animatedEdges: boolean;
  onToggleAnimatedEdges: (animated: boolean) => void;
  compactNodes: boolean;
  onToggleCompactNodes: (compact: boolean) => void;
  // Stats
  nodes: Node[];
  edges: Edge[];
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  activeProjectName: string;
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "settings",
  showMiniMap,
  onToggleMiniMap,
  animatedEdges,
  onToggleAnimatedEdges,
  compactNodes,
  onToggleCompactNodes,
  nodes,
  edges,
  activeProjectId,
  activeProjectName,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"settings" | "memory">(initialTab);

  if (!isOpen) return null;

  // Derive node breakdown
  const papersCount = nodes.filter(
    (n) =>
      n.type === "paper" ||
      n.type === "uploadedPaper" ||
      n.type === "discovery" ||
      n.id.startsWith("paper") ||
      n.id.startsWith("discovery")
  ).length;

  const synthCount = nodes.filter(
    (n) =>
      n.type === "synth" ||
      n.type === "synthesisResult" ||
      n.type === "synthesisTask" ||
      n.id.startsWith("synth")
  ).length;

  const gapsCount = nodes.filter(
    (n) => n.type === "gap" || n.type === "researchGap" || n.id.startsWith("gap")
  ).length;

  const expCount = nodes.filter(
    (n) =>
      n.type === "experiment" ||
      n.type === "codeExperiment" ||
      n.type === "result" ||
      n.id.startsWith("exp") ||
      n.id.startsWith("result")
  ).length;

  const notesCount = nodes.filter(
    (n) => n.type === "note" || n.id.startsWith("note") || n.data?.type === "note"
  ).length;

  // Derive edge breakdown
  const refEdgesCount = edges.filter((e) => {
    const l = String(e.label || "");
    return !l.includes("synth") && !l.includes("bench") && !e.id.includes("synth") && !e.id.includes("exp");
  }).length;
  const synthEdgesCount = edges.filter((e) => {
    const l = String(e.label || "");
    return l.includes("synth") || e.id.includes("synth");
  }).length;
  const benchEdgesCount = edges.filter((e) => {
    const l = String(e.label || "");
    return l.includes("bench") || l.includes("tested") || e.id.includes("exp");
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-3xl glass-panel-mono shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 [html[data-theme='light']_&]:border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl btn-glass-mono flex items-center justify-center">
              {activeTab === "settings" ? (
                <Settings className="w-4 h-4" />
              ) : (
                <Database className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm text-current">
                {activeTab === "settings"
                  ? "Studio Preferences"
                  : "Research & Vector Memory"}
              </h3>
              <p className="text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                {activeTab === "settings"
                  ? "Customize canvas controls and visual ergonomics"
                  : "ChromaDB embedding stats and workspace graph topology"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-glass-mono p-1.5 rounded-xl cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 pt-3 border-b border-white/10 [html[data-theme='light']_&]:border-slate-200 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "settings"
                ? "border-current font-bold text-current"
                : "border-transparent text-zinc-400 hover:text-current [html[data-theme='light']_&]:text-slate-500"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Studio Preferences</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("memory")}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === "memory"
                ? "border-current font-bold text-current"
                : "border-transparent text-zinc-400 hover:text-current [html[data-theme='light']_&]:text-slate-500"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>ChromaDB & Memory</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {activeTab === "settings" && (
            <div className="space-y-4">
              {/* Option 1: MiniMap Visibility */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                <div className="space-y-1 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-semibold text-current">
                      MiniMap Radar Overview
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500 leading-relaxed">
                    Render high-altitude interactive canvas radar in the bottom-right corner for rapid viewport panning.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleMiniMap(!showMiniMap)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                    showMiniMap ? "toggle-switch-on" : "toggle-switch-off"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full toggle-thumb transition-transform ${
                      showMiniMap ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Option 2: Animated Edge Particles */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                <div className="space-y-1 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-semibold text-current">
                      Animated Streaming Edges
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500 leading-relaxed">
                    Show flowing particle dash streams for active synthesis connections and benchmark simulation results.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleAnimatedEdges(!animatedEdges)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                    animatedEdges ? "toggle-switch-on" : "toggle-switch-off"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full toggle-thumb transition-transform ${
                      animatedEdges ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Option 3: Compact Node Cards */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                <div className="space-y-1 max-w-[80%]">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-semibold text-current">
                      High-Density Compact Nodes
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500 leading-relaxed">
                    Condense canvas card bodies and clamp paper summaries to 2 lines for high-density multi-paper workspaces.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleCompactNodes(!compactNodes)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                    compactNodes ? "toggle-switch-on" : "toggle-switch-off"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full toggle-thumb transition-transform ${
                      compactNodes ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 [html[data-theme='light']_&]:bg-slate-50 [html[data-theme='light']_&]:border-slate-200 text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  All studio preferences are automatically preserved in browser storage. Backend security sandboxes and model safety limits remain strictly enforced.
                </span>
              </div>
            </div>
          )}

          {activeTab === "memory" && (
            <div className="space-y-5">
              {/* Active Workspace Header Card */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-wider opacity-70 text-zinc-400 [html[data-theme='light']_&]:text-slate-500 font-semibold">
                    Active Scoped Workspace
                  </span>
                  <h4 className="text-sm font-bold text-current mt-0.5">
                    {activeProjectName}
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500 block mt-0.5">
                    Workspace ID: {activeProjectId}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-1 rounded-lg border border-white/20 bg-white/10 text-current [html[data-theme='light']_&]:bg-white [html[data-theme='light']_&]:border-slate-300 [html[data-theme='light']_&]:text-slate-800">
                  Collection: workspace_{activeProjectId}
                </span>
              </div>

              {/* Entities Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Research Papers</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {papersCount}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    ~{papersCount * 18} vector chunks
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Syntheses</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {synthCount}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    Cross-paper models
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Research Gaps</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {gapsCount}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    Identified opportunities
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Benchmarks</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {expCount}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    Simulated experiments
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <StickyNote className="w-3.5 h-3.5" />
                    <span>Researcher Notes</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {notesCount}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    Canvas annotations
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:hover:border-slate-300 transition">
                  <div className="flex items-center gap-1.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600 text-xs mb-1 font-medium">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Graph Relations</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-current [html[data-theme='light']_&]:text-slate-900">
                    {edges.length}
                  </div>
                  <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
                    {refEdgesCount} ref • {synthEdgesCount} synth • {benchEdgesCount} bench
                  </span>
                </div>
              </div>

              {/* Vector Architecture Specification Card */}
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 [html[data-theme='light']_&]:bg-slate-50/90 [html[data-theme='light']_&]:border-slate-200 space-y-2 text-xs">
                <div className="font-semibold text-current flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  <span>Vector Embedding Architecture</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 [html[data-theme='light']_&]:text-slate-600 font-mono pt-1">
                  <div>
                    <span className="opacity-70">Model:</span> all-MiniLM-L6-v2
                  </div>
                  <div>
                    <span className="opacity-70">Dimension:</span> 384 dense
                  </div>
                  <div>
                    <span className="opacity-70">Metric:</span> Cosine similarity
                  </div>
                  <div>
                    <span className="opacity-70">Persistence:</span> ChromaDB DuckDB/Parquet
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 [html[data-theme='light']_&]:border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn-primary-mono px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
