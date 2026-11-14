"use client";

import React, { useState } from "react";
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp,
  ShieldCheck,
  Code2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

export interface CodeExperimentData {
  status?: "success" | "failed" | string;
  label?: string;
  codeSnippet?: string;
  metric?: string;
  baseline?: string;
  speedup?: string;
  primaryMetric?: string;
  summary?: string;
  targetPaperId?: string;
  onAskAgent?: () => void;
  [key: string]: unknown;
}

export function CodeExperimentNode({
  data,
  selected,
}: {
  data: CodeExperimentData;
  selected?: boolean;
}) {
  const [showCode, setShowCode] = useState(false);
  const isSuccess = data.status === "success" || data.status === "passed";

  // Auto-extract latency and speedup from metric or summary if not passed explicitly
  const latency =
    data.metric ||
    (typeof data.summary === "string" && data.summary.match(/(\d+\.?\d*ms)/)?.[1]) ||
    "Completed";
  const speedup =
    data.speedup ||
    (typeof data.summary === "string" && data.summary.match(/(\d+\.?\d*x\s*(faster)?)/i)?.[1]) ||
    "";
  const baseline =
    data.baseline ||
    (typeof data.summary === "string" && data.summary.match(/vs\s*(\d+\.?\d*ms)/i)?.[1]) ||
    "";

  const plainSummary =
    data.summary ||
    (isSuccess
      ? `Benchmark finished successfully. Average inference latency is ${latency}, demonstrating real-time viability on standard CPU hardware.`
      : "Benchmark execution halted or encountered an error.");

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={320}
      minHeight={210}
      accentColor="#06b6d4"
      handleClassName="!bg-cyan-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-cyan-700/80 text-left flex flex-col justify-between"
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 shrink-0 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2 text-cyan-400 [html[data-theme='light']_&]:text-cyan-700">
            <Cpu className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Experiment Result
            </span>
          </div>
          {isSuccess ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/50 [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 [html[data-theme='light']_&]:text-emerald-700" /> Passed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-rose-400 bg-rose-950/50 [html[data-theme='light']_&]:bg-rose-50 [html[data-theme='light']_&]:text-rose-950 [html[data-theme='light']_&]:border-rose-200 px-2 py-0.5 rounded-full border border-rose-800/40">
              <AlertCircle className="w-3 h-3 text-rose-400 [html[data-theme='light']_&]:text-rose-700" /> Failed
            </span>
          )}
        </div>

        {/* User-friendly Hypothesis Title */}
        <h4 className="mt-2.5 text-xs font-semibold text-zinc-100 [html[data-theme='light']_&]:text-slate-900 line-clamp-2">
          {data.label || "Attention Latency Benchmark"}
        </h4>

        {/* Visual Metric Comparison Tag Pills */}
        <div className="mt-2 flex flex-wrap gap-1.5 shrink-0">
          {data.primaryMetric && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40 [html[data-theme='light']_&]:bg-amber-50 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-200 text-[11px] font-semibold">
              <ShieldCheck className="w-3 h-3 text-amber-400 [html[data-theme='light']_&]:text-amber-700" />
              {data.primaryMetric}
            </span>
          )}
          <span className="neon-benchmark-badge inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-800/40 [html[data-theme='light']_&]:bg-cyan-50 [html[data-theme='light']_&]:text-cyan-950 [html[data-theme='light']_&]:border-cyan-200 text-[11px] font-mono font-bold">
            <Zap className="w-3 h-3 text-cyan-400 [html[data-theme='light']_&]:text-cyan-700" />
            {latency}
          </span>
          {baseline && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-300 text-[11px] font-mono">
              Base: {baseline}
            </span>
          )}
          {speedup && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200 text-[11px] font-semibold">
              <TrendingUp className="w-3 h-3 text-emerald-400 [html[data-theme='light']_&]:text-emerald-700" />
              {speedup}
            </span>
          )}
        </div>

        {/* Plain-English Takeaway */}
        <div className="experiment-summary-box mt-2.5 p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] leading-relaxed text-zinc-300">
          <p className="m-0 font-normal">{plainSummary}</p>
        </div>
      </div>

      {/* Collapsible Code & Actions */}
      <div className="mt-3 pt-2 border-t border-zinc-900 [html[data-theme='light']_&]:border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowCode((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-cyan-300 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-cyan-900 transition cursor-pointer select-none"
          >
            <Code2 className="w-3 h-3" />
            <span>{showCode ? "Hide Python Script" : "View Python Script"}</span>
            {showCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {data.onAskAgent && (
            <button
              type="button"
              onClick={data.onAskAgent}
              className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 [html[data-theme='light']_&]:text-indigo-700 [html[data-theme='light']_&]:hover:text-indigo-950 transition cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Ask Agent</span>
            </button>
          )}
        </div>

        {showCode && (
          <ScrollableNodeBody
            allowHorizontal
            className="mt-2 p-2 rounded-lg bg-black/70 border border-zinc-800/80 font-mono text-[10px] text-zinc-300 [html[data-theme='light']_&]:bg-slate-50 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-300 max-h-36 overflow-y-auto"
          >
            <pre className="m-0 whitespace-pre font-mono">
              <code>{data.codeSnippet || "# Standalone Python benchmark"}</code>
            </pre>
          </ScrollableNodeBody>
        )}
      </div>
    </ResizableNodeFrame>
  );
}
