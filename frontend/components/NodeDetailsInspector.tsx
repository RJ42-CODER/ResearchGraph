"use client";

import React, { useState } from "react";
import {
  X,
  FileText,
  GitFork,
  AlertTriangle,
  Cpu,
  StickyNote,
  ExternalLink,
  MessageSquare,
  Play,
  Trash2,
  Edit3,
  Calendar,
  User,
  BookOpen,
  ArrowRight,
  Crosshair,
  Code2,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { Node, Edge } from "@xyflow/react";
import { FormattedPlainText } from "./FormattedPlainText";

interface NodeDetailsInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  node: Node | null;
  allNodes: Node[];
  edges: Edge[];
  onAskAssistant: (node: Node) => void;
  onRunBenchmark: (node: Node) => void;
  onFocusNode: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onEditTitle: (node: Node) => void;
}

export function NodeDetailsInspector({
  isOpen,
  onClose,
  node,
  allNodes,
  edges,
  onAskAssistant,
  onRunBenchmark,
  onFocusNode,
  onDeleteNode,
  onEditTitle,
}: NodeDetailsInspectorProps) {
  const [showCode, setShowCode] = useState(false);

  if (!isOpen || !node) return null;

  const rawType = (node.type || node.data?._node_type || "").toString();
  const isPaper =
    rawType === "paper" ||
    rawType === "uploadedPaper" ||
    rawType === "discovery" ||
    node.id.startsWith("paper") ||
    node.id.startsWith("discovery");
  const isSynth =
    rawType === "synth" ||
    rawType === "synthesisResult" ||
    node.id.startsWith("synth");
  const isGap =
    rawType === "gap" ||
    rawType === "researchGap" ||
    node.id.startsWith("gap");
  const isExp =
    rawType === "experiment" ||
    rawType === "result" ||
    node.id.startsWith("exp") ||
    node.id.startsWith("result");
  const isNote =
    rawType === "note" ||
    node.id.startsWith("note") ||
    node.data?.type === "note";

  const data = (node.data as Record<string, unknown>) || {};
  const title = String(data.title || data.label || node.id);

  // Connected edges: upstream sources & downstream targets
  const upstreamEdges = edges.filter((e) => e.target === node.id);
  const downstreamEdges = edges.filter((e) => e.source === node.id);

  const upstreamNodes = upstreamEdges
    .map((e) => allNodes.find((n) => n.id === e.source))
    .filter(Boolean) as Node[];

  const downstreamNodes = downstreamEdges
    .map((e) => allNodes.find((n) => n.id === e.target))
    .filter(Boolean) as Node[];

  const badgeInfo = () => {
    const monoBadge = "bg-white/10 text-white border-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20";
    if (isPaper) {
      return {
        label: rawType === "discovery" ? "Discovery Paper" : "Indexed Paper",
        icon: FileText,
        color: monoBadge,
      };
    }
    if (isSynth) {
      return {
        label: "Cross-Paper Synthesis",
        icon: GitFork,
        color: monoBadge,
      };
    }
    if (isGap) {
      return {
        label: "Research Gap Discovery",
        icon: AlertTriangle,
        color: monoBadge,
      };
    }
    if (isExp) {
      return {
        label: "Sandbox Experiment",
        icon: Cpu,
        color: monoBadge,
      };
    }
    return {
      label: "Researcher Note",
      icon: StickyNote,
      color: monoBadge,
    };
  };

  const badge = badgeInfo();
  const IconComponent = badge.icon;

  return (
    <aside
      className="fixed top-16 right-0 bottom-0 z-40 w-full sm:w-[440px] bg-black/85 dark:bg-black/85 backdrop-blur-2xl border-l border-white/15 dark:border-white/15 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      aria-label="Node Details Inspector"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${badge.color}`}
          >
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span
              className={`inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border mb-0.5 ${badge.color}`}
            >
              {badge.label}
            </span>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-semibold text-zinc-100 truncate">
                {title}
              </h2>
              <button
                onClick={() => onEditTitle(node)}
                className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer p-0.5"
                title="Edit node title"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer shrink-0"
          title="Close details inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-5 text-xs text-zinc-300">
        {/* Paper Academic Metadata */}
        {isPaper && (
          <div className="space-y-3 pb-3 border-b border-zinc-800/80">
            {data.authors ? (
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                <span className="text-zinc-300">
                  {Array.isArray(data.authors)
                    ? data.authors.join(", ")
                    : String(data.authors)}
                </span>
              </div>
            ) : null}

            <div className="flex items-center gap-4 text-[11px] text-zinc-400 flex-wrap">
              {data.year ? (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  {String(data.year)}
                </span>
              ) : null}
              {data.publication ? (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-zinc-500" />
                  {String(data.publication)}
                </span>
              ) : null}
              {data.is_oa ? (
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono text-[10px]">
                  Open Access
                </span>
              ) : null}
            </div>

            {data.doi ? (
              <div className="pt-1">
                <a
                  href={`https://doi.org/${String(data.doi)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition"
                >
                  <span>DOI: {String(data.doi)}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : null}

            {data.landing_page_url || data.pdf_url ? (
              <div className="pt-0.5">
                <a
                  href={String(data.landing_page_url || data.pdf_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                >
                  <span>Open Full Document</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : null}
          </div>
        )}

        {/* Experiment Benchmark Results */}
        {isExp && (
          <div className="space-y-3 pb-3 border-b border-zinc-800/80">
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-zinc-400">
                  Execution Status
                </span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-medium font-mono">
                  <CheckCircle2 className="w-3 h-3" />{" "}
                  {String(data.status || "SUCCESS").toUpperCase()}
                </span>
              </div>

              {data.primaryMetric || data.metric ? (
                <div className="pt-1">
                  <span className="text-[10px] text-zinc-400 block mb-0.5">
                    Primary Domain Metric
                  </span>
                  <div className="px-2.5 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-200 font-mono text-xs">
                    {String(data.primaryMetric || data.metric)}
                  </div>
                </div>
              ) : null}

              {data.optimized_ms ? (
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-500 block text-[10px]">
                      Simulated Latency
                    </span>
                    <span className="font-semibold text-zinc-100 font-mono">
                      {String(data.optimized_ms)}ms
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span className="text-zinc-500 block text-[10px]">
                      Speedup vs Base
                    </span>
                    <span className="font-semibold text-emerald-400 font-mono">
                      {String(data.speedup || "Validated")}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            {data.code ? (
              <div>
                <button
                  onClick={() => setShowCode((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showCode ? "Hide Python Script" : "View Python Script"}</span>
                </button>
                {showCode && (
                  <pre className="mt-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-48 leading-relaxed">
                    {String(data.code)}
                  </pre>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Text Body: Abstract, Summary, Notes, or Findings */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            {isPaper
              ? "Abstract & Overview"
              : isSynth
              ? "Cross-Paper Findings"
              : isGap
              ? "Identified Research Gaps"
              : isExp
              ? "Plain-English Analysis"
              : "Note Content"}
          </h3>
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-200 leading-relaxed text-readable max-h-64 overflow-y-auto">
            <FormattedPlainText
              text={String(
                data.abstract ||
                  data.summary ||
                  data.comparison_summary ||
                  data.gaps_summary ||
                  data.text ||
                  data.content ||
                  "No textual overview available for this node."
              )}
            />
          </div>
        </div>

        {/* Connected Dependencies & Graph Links */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
            <span>Graph Connections</span>
            <span className="font-mono text-zinc-500">
              {upstreamNodes.length + downstreamNodes.length} linked
            </span>
          </div>

          {upstreamNodes.length === 0 && downstreamNodes.length === 0 ? (
            <div className="p-2.5 rounded-lg bg-zinc-900/30 border border-zinc-800/40 text-[11px] text-zinc-500 text-center">
              No connected edges to this node yet. Connect nodes to synthesize.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {upstreamNodes.map((un) => (
                <div
                  key={un.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-white text-black border border-white/20 [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white [html[data-theme='light']_&]:border-black/20">
                      Source
                    </span>
                    <span className="truncate text-zinc-200">
                      {String(un.data?.title || un.data?.label || un.id)}
                    </span>
                  </div>
                  <button
                    onClick={() => onFocusNode(un.id)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    title="Focus on canvas"
                  >
                    <Crosshair className="w-3 h-3 text-current" />
                  </button>
                </div>
              ))}

              {downstreamNodes.map((dn) => (
                <div
                  key={dn.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-white/15 text-white border border-white/20 [html[data-theme='light']_&]:bg-black/10 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20">
                      Target
                    </span>
                    <span className="truncate text-zinc-200">
                      {String(dn.data?.title || dn.data?.label || dn.id)}
                    </span>
                  </div>
                  <button
                    onClick={() => onFocusNode(dn.id)}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    title="Focus on canvas"
                  >
                    <Crosshair className="w-3 h-3 text-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-white/10 bg-black/40 space-y-2">
        <div className="flex items-center gap-2">
          {/* Ask Assistant (Primary Action Button) */}
          <button
            onClick={() => onAskAssistant(node)}
            className="btn-primary-mono flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-white text-black [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white transition cursor-pointer shadow-sm active:scale-95"
          >
            <MessageSquare className="w-3.5 h-3.5 text-black [html[data-theme='light']_&]:text-white" />
            <span className="text-black [html[data-theme='light']_&]:text-white font-semibold">Ask Assistant</span>
          </button>

          {/* Run Sandbox Experiment (papers & gaps) */}
          {(isPaper || isGap) && (
            <button
              onClick={() => onRunBenchmark(node)}
              className="btn-glass-mono flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer shadow-sm active:scale-95"
              title="Synthesize and execute Python benchmark simulation"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Experiment</span>
            </button>
          )}

          {/* Delete Node */}
          <button
            onClick={() => onDeleteNode(node.id)}
            className="btn-glass-mono p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:border-rose-400/50 transition cursor-pointer"
            title="Delete this node from workspace"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
