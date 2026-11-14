"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  FlaskConical,
  Bot,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  Crosshair,
  MessageSquare,
  Code2,
  Copy,
  Check,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Terminal,
  GitFork,
} from "lucide-react";
import { Node } from "@xyflow/react";

interface ExperimentsStudioProps {
  nodes: Node[];
  initialTab?: "experiments" | "agents";
  activeTab?: "experiments" | "agents";
  onTabChange?: (tab: "experiments" | "agents") => void;
  isAgentThinking: boolean;
  onShowInGraph: (nodeId: string) => void;
  onAskAgentAboutExperiment: (promptText: string, paperInfo?: { id: string; title: string }) => void;
  onOpenNewExperiment: () => void;
}

export function ExperimentsStudio({
  nodes,
  initialTab = "experiments",
  activeTab: activeTabProp,
  onTabChange,
  isAgentThinking,
  onShowInGraph,
  onAskAgentAboutExperiment,
  onOpenNewExperiment,
}: ExperimentsStudioProps) {
  const [internalTab, setInternalTab] = useState<"experiments" | "agents">(
    activeTabProp || initialTab
  );

  useEffect(() => {
    if (activeTabProp) {
      setInternalTab(activeTabProp);
    } else if (initialTab) {
      setInternalTab(initialTab);
    }
  }, [activeTabProp, initialTab]);

  const activeTab = activeTabProp || internalTab;

  const handleTabSwitch = (tab: "experiments" | "agents") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const [expandedCodeId, setExpandedCodeId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Extract experiment nodes
  const experimentNodes = useMemo(() => {
    return nodes.filter((n) => {
      const rawType = (n.type || n.data?._node_type || "").toString();
      const id = n.id;
      return (
        rawType === "experiment" ||
        rawType === "codeExperiment" ||
        rawType === "result" ||
        id.startsWith("exp") ||
        id.startsWith("result")
      );
    });
  }, [nodes]);

  // Extract synthesis nodes
  const synthesisNodes = useMemo(() => {
    return nodes.filter((n) => {
      const rawType = (n.type || n.data?._node_type || "").toString();
      const id = n.id;
      return (
        rawType === "synth" ||
        rawType === "synthesisResult" ||
        rawType === "gap" ||
        rawType === "researchGap" ||
        id.startsWith("synth") ||
        id.startsWith("gap")
      );
    });
  }, [nodes]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeId(id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    });
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
              {activeTab === "experiments" ? (
                <FlaskConical className="w-4 h-4 text-current" />
              ) : (
                <Bot className="w-4 h-4 text-current" />
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              {activeTab === "experiments"
                ? "Experiments & Benchmark Lab"
                : "AI Agent Activity Center"}
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {activeTab === "experiments"
              ? "Inspect simulated code, domain metrics (TPR, speedup, latency), and execution logs."
              : "Monitor multi-agent execution pipeline, vector RAG retrieval, and background processes."}
          </p>
        </div>

        {/* Tab Toggle Pills */}
        <div className="flex items-center p-1 rounded-2xl glass-panel-mono shrink-0">
          <button
            type="button"
            onClick={() => handleTabSwitch("experiments")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              activeTab === "experiments"
                ? "btn-primary-mono shadow-sm"
                : "text-zinc-400 hover:text-current"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Experiments ({experimentNodes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("agents")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer relative ${
              activeTab === "agents"
                ? "btn-primary-mono shadow-sm"
                : "text-zinc-400 hover:text-current"
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Agent Activity</span>
            {isAgentThinking && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* TAB 1: EXPERIMENTS BENCHMARK REGISTRY     */}
      {/* ========================================= */}
      {activeTab === "experiments" && (
        <div className="space-y-6">
          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="monochrome-card p-4 rounded-2xl">
              <span className="text-[11px] text-zinc-400 font-mono uppercase">
                Simulations Run
              </span>
              <span className="text-2xl font-bold text-current font-mono mt-1 block">
                {experimentNodes.length}
              </span>
            </div>
            <div className="monochrome-card p-4 rounded-2xl">
              <span className="text-[11px] text-zinc-400 font-mono uppercase">
                Sandbox Environment
              </span>
              <span className="text-sm font-semibold text-current mt-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-current" />
                <span>Isolated Python 3.13 Runtime</span>
              </span>
            </div>
            <div className="monochrome-card p-4 rounded-2xl">
              <span className="text-[11px] text-zinc-400 font-mono uppercase">
                Evaluation Engine
              </span>
              <span className="text-sm font-semibold text-current mt-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-current" />
                <span>Dry-Run + Automated Fallback</span>
              </span>
            </div>
          </div>

          {/* Experiment Cards List */}
          {experimentNodes.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-zinc-900/30 border border-zinc-800/60 space-y-3">
              <FlaskConical className="w-10 h-10 mx-auto text-zinc-600" />
              <h3 className="text-sm font-semibold text-zinc-300">
                No experiments recorded yet
              </h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Double-click any paper or research gap on the canvas to configure and execute a simulation benchmark.
              </p>
              <button
                type="button"
                onClick={onOpenNewExperiment}
                className="btn-primary-mono px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer active:scale-95"
              >
                Launch Simulation Sandbox
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {experimentNodes.map((exp) => {
                const data = (exp.data as Record<string, unknown>) || {};
                const title = String(data.title || data.label || exp.id);
                const status = String(data.status || "VALIDATED").toUpperCase();
                const primaryMetric = String(data.primaryMetric || data.metric || "Simulated Benchmark");
                const summary = String(data.summary || "Simulation benchmark verified in sandbox.");
                const code = typeof data.code === "string" ? data.code : "";
                const isExpanded = expandedCodeId === exp.id;

                return (
                  <div
                    key={exp.id}
                    className="monochrome-card p-5 rounded-3xl shadow-xl space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 [html[data-theme='light']_&]:border-black/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0">
                          <Cpu className="w-4 h-4 text-current" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-current text-sm">
                            {title}
                          </h3>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            Node ID: {exp.id}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20 font-mono text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-current" />
                          <span>{status}</span>
                        </span>
                      </div>
                    </div>

                    {/* Metrics Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/10">
                        <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                          Primary Metric
                        </span>
                        <span className="font-mono text-current font-semibold block mt-1">
                          {primaryMetric}
                        </span>
                      </div>

                      {data.optimized_ms ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/10">
                          <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                            Simulated Latency
                          </span>
                          <span className="font-mono text-current font-semibold block mt-1">
                            {String(data.optimized_ms)}ms
                          </span>
                        </div>
                      ) : null}

                      {data.speedup ? (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/10">
                          <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                            Speedup vs Baseline
                          </span>
                          <span className="font-mono text-current font-semibold block mt-1">
                            {String(data.speedup)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Analysis Summary */}
                    <p className="text-xs text-current leading-relaxed bg-white/5 [html[data-theme='light']_&]:bg-black/5 p-3.5 rounded-xl border border-white/10 [html[data-theme='light']_&]:border-black/10">
                      {summary}
                    </p>

                    {/* Code Section */}
                    {code && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCodeId(isExpanded ? null : exp.id)
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-current font-medium cursor-pointer"
                          >
                            <Code2 className="w-3.5 h-3.5 text-current" />
                            <span>{isExpanded ? "Hide Python Script" : "View Python Script"}</span>
                          </button>

                          {isExpanded && (
                            <button
                              type="button"
                              onClick={() => handleCopyCode(exp.id, code)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] cursor-pointer"
                            >
                              {copiedCodeId === exp.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5 text-zinc-400" />
                                  <span>Copy Code</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {isExpanded && (
                          <pre className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-56 leading-relaxed no-scrollbar">
                            {code}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => onShowInGraph(exp.id)}
                        className="btn-glass-mono inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Focus in Graph</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onAskAgentAboutExperiment(
                            `In the context of ${title}, explain what our sandbox simulation result (${primaryMetric}: ${summary}) means and how it relates to the paper's findings.`,
                            { id: exp.id, title }
                          )
                        }
                        className="btn-primary-mono inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>Ask Agent About Result</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================= */}
      {/* TAB 2: AI AGENT ACTIVITY & PIPELINE LOGS   */}
      {/* ========================================= */}
      {activeTab === "agents" && (
        <div className="space-y-6">
          {/* Live Agent Status Card */}
          <div className="monochrome-card p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-current" />
                <h3 className="font-semibold text-sm text-current">
                  Autonomous Multi-Agent Swarm
                </h3>
              </div>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/25 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span>Ollama + LangGraph Active</span>
              </span>
            </div>

            {isAgentThinking && (
              <div className="p-3 rounded-2xl bg-white/10 border border-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 flex items-center gap-3 animate-pulse">
                <div className="w-3 h-3 rounded-full bg-current animate-ping" />
                <span className="text-xs text-current font-medium">
                  Assistant is processing semantic chunks and generating grounded response...
                </span>
              </div>
            )}

            {/* Specialized Pipeline Agents */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="monochrome-card p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-current">
                    1. Ingestion & Vector RAG Agent
                  </span>
                  <span className="text-[10px] font-mono text-current opacity-80 font-semibold">READY</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Extracts text, splits into 1000-token chunks with 200 overlap, and indexes into ChromaDB vector collections.
                </p>
              </div>

              <div className="monochrome-card p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-current">
                    2. Cross-Reference & Gap Agent
                  </span>
                  <span className="text-[10px] font-mono text-current opacity-80 font-semibold">READY</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Compares methodology claims across connected papers, identifies contradictory findings and untracked research gaps.
                </p>
              </div>

              <div className="monochrome-card p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-current">
                    3. Coder & Sandbox Evaluator
                  </span>
                  <span className="text-[10px] font-mono text-current opacity-80 font-semibold">READY</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Writes domain-specific verification scripts, dry-run validates against NameError/NaN, and executes in a 15s timeout sandbox.
                </p>
              </div>

              <div className="monochrome-card p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-current">
                    4. Grounded Contextual Assistant
                  </span>
                  <span className="text-[10px] font-mono text-current opacity-80 font-semibold">READY</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Queries ChromaDB chunks, prepends Title, Abstract, and Page 1 at temperature 0.0 with clickable [Page X] citations.
                </p>
              </div>
            </div>
          </div>

          {/* Recent Agent Tasks List */}
          <div className="monochrome-card p-5 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-current flex items-center gap-2">
                <Terminal className="w-4 h-4 text-current" />
                <span>Agent Execution History</span>
              </h3>
              <span className="text-xs text-zinc-400 font-mono">
                {synthesisNodes.length + experimentNodes.length} Agent Artifacts
              </span>
            </div>

            {synthesisNodes.length === 0 && experimentNodes.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-6">
                No agent synthesis or experiment tasks recorded yet in this workspace.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto no-scrollbar">
                {[...synthesisNodes, ...experimentNodes].reverse().map((node) => {
                  const title = String(node.data?.title || node.data?.label || node.id);
                  const isExp = node.id.startsWith("exp") || node.id.startsWith("result");

                  return (
                    <div
                      key={node.id}
                      onClick={() => onShowInGraph(node.id)}
                      className="monochrome-card p-3.5 rounded-2xl cursor-pointer flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shrink-0">
                          {isExp ? (
                            <FlaskConical className="w-3.5 h-3.5 text-current" />
                          ) : (
                            <GitFork className="w-3.5 h-3.5 text-current" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-zinc-200 [html[data-theme='light']_&]:text-zinc-900 group-hover:text-current truncate block">
                            {title}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {isExp ? "Sandbox Simulation Run" : "Multi-Paper Synthesis"}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowInGraph(node.id);
                        }}
                        className="text-xs text-zinc-400 group-hover:text-current font-medium shrink-0 flex items-center gap-1"
                      >
                        <span>Inspect in Canvas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
