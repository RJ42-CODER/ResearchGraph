"use client";

import React from "react";
import { FormattedPlainText } from "./FormattedPlainText";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

export interface WorkspaceNodeData {
  title?: string;
  label?: string;
  summary?: string;
  gaps?: string;
  paperCount?: number;
  analyzingCount?: number;
  taskMode?: "comparison" | "gaps";
  onModeChange?: (mode: "comparison" | "gaps") => void;
  isCompact?: boolean;
  [key: string]: unknown;
}

export function SynthesisResultNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  const isCompact = !!data.isCompact;

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={280}
      minHeight={isCompact ? 130 : 180}
      accentColor="#818cf8"
      handleClassName="!bg-indigo-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-indigo-700/80 text-left"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
        <span className="font-bold text-xs text-indigo-300 [html[data-theme='light']_&]:text-indigo-950 truncate">
          ⚡ {data.title || "Synthesis Results"}
        </span>
        {typeof data.paperCount === "number" && (
          <span className="shrink-0 text-[10px] font-medium text-indigo-300 bg-indigo-950/80 [html[data-theme='light']_&]:bg-indigo-50 [html[data-theme='light']_&]:text-indigo-950 [html[data-theme='light']_&]:border-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-800/80">
            {data.paperCount} Papers
          </span>
        )}
      </div>

      <ScrollableNodeBody className="mt-2.5 pr-1">
        <FormattedPlainText
          text={data.summary || "No synthesis output available."}
          className={`text-[11px] text-zinc-200 font-normal leading-relaxed break-words ${
            isCompact ? "line-clamp-3" : ""
          }`}
        />
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}

export function SynthesisTaskNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  const isAnalyzing =
    typeof data.analyzingCount === "number" && data.analyzingCount > 0;
  const taskMode = (data.taskMode as "comparison" | "gaps") || "comparison";

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={260}
      minHeight={150}
      accentColor={taskMode === "gaps" ? "#f59e0b" : "#c084fc"}
      handleClassName={`!w-2.5 !h-2.5 !border-2 !border-zinc-950 ${
        taskMode === "gaps" ? "!bg-amber-500" : "!bg-purple-500"
      }`}
      className={`rounded-xl border border-dashed border-zinc-800 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-md text-left transition-colors hover:border-zinc-700`}
    >
      <div
        className={`font-semibold text-xs flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing pb-1.5 border-b ${
          taskMode === "gaps"
            ? "text-amber-300 [html[data-theme='light']_&]:text-amber-950 border-amber-800/40 [html[data-theme='light']_&]:border-amber-200"
            : "text-purple-300 [html[data-theme='light']_&]:text-purple-950 border-purple-800/40 [html[data-theme='light']_&]:border-purple-200"
        }`}
      >
        {isAnalyzing ? (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full animate-ping shrink-0 ${
                taskMode === "gaps" ? "bg-amber-400" : "bg-purple-400"
              }`}
            />
            <span>Analyzing {data.analyzingCount} papers...</span>
          </div>
        ) : (
          <span className="truncate">
            {taskMode === "gaps" ? "🔍 Research Gap Task" : "📋 Cross-Reference Task"}
          </span>
        )}
      </div>

      {/* Mode Switcher Pill */}
      <div className="mt-2 flex items-center p-0.5 rounded-lg bg-zinc-900/90 border border-zinc-800 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:border-slate-300 text-[10px] shrink-0 nodrag">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof data.onModeChange === "function") {
              data.onModeChange("comparison");
            }
          }}
          className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
            taskMode === "comparison"
              ? "bg-purple-900/80 text-purple-200 border border-purple-700/60 shadow-sm [html[data-theme='light']_&]:bg-purple-100 [html[data-theme='light']_&]:text-purple-950 [html[data-theme='light']_&]:border-purple-300"
              : "text-zinc-400 hover:text-zinc-200 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-slate-900"
          }`}
        >
          📋 Compare
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof data.onModeChange === "function") {
              data.onModeChange("gaps");
            }
          }}
          className={`flex-1 py-1 px-2 rounded-md font-medium transition cursor-pointer text-center ${
            taskMode === "gaps"
              ? "bg-amber-950/80 text-amber-200 border border-amber-700/60 shadow-sm [html[data-theme='light']_&]:bg-amber-100 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-300"
              : "text-zinc-400 hover:text-zinc-200 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-slate-900"
          }`}
        >
          🔍 Gaps
        </button>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p className="text-[11px] text-zinc-400 font-normal leading-snug">
          {taskMode === "gaps"
            ? 'Connect 2+ papers, right-click, and run "Discover Research Gaps".'
            : 'Connect 2+ papers, right-click, and run "Run Cross-Reference".'}
        </p>
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}

export function ResearchGapNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  const isCompact = !!data.isCompact;

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={320}
      minHeight={isCompact ? 150 : 220}
      accentColor="#f59e0b"
      handleClassName="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-amber-700/80 text-left"
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
        <span className="font-bold text-xs text-amber-300 [html[data-theme='light']_&]:text-amber-950 truncate">
          🔍 {data.title || "Research Gap Discovery"}
        </span>
        {typeof data.paperCount === "number" && (
          <span className="shrink-0 text-[10px] font-medium text-amber-300 bg-amber-950/80 [html[data-theme='light']_&]:bg-amber-100 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-300 px-2.5 py-0.5 rounded-full border border-amber-800/80">
            {data.paperCount} Papers
          </span>
        )}
      </div>

      <ScrollableNodeBody className="mt-2.5 pr-1">
        <FormattedPlainText
          text={data.summary || data.gaps || "No research gaps identified yet."}
          className={`text-[11px] text-zinc-200 font-normal leading-relaxed break-words ${
            isCompact ? "line-clamp-3" : ""
          }`}
        />
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}

export function NoteNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  const rawNote =
    data.title && data.title !== "Note"
      ? data.title
      : typeof data.label === "string"
        ? data.label.replace(/^📝\s*(Note:\s*)?/i, "")
        : "Double-click to edit your thoughts...";

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={200}
      minHeight={100}
      accentColor="#eab308"
      handleClassName="!bg-amber-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-3.5 shadow-2xl backdrop-blur-md transition-colors hover:border-amber-600/70 text-left"
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 text-[11px] font-semibold text-amber-300 [html[data-theme='light']_&]:text-amber-950 shrink-0 cursor-grab active:cursor-grabbing">
        <span>📝 Note</span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/50 [html[data-theme='light']_&]:bg-amber-100 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-300">
          Editable
        </span>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p className="text-xs text-amber-100/90 [html[data-theme='light']_&]:text-slate-900 leading-relaxed whitespace-pre-wrap">
          {rawNote}
        </p>
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}

export function UploadedPaperNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  const isCompact = !!data.isCompact;
  const rawTitle = (
    data.title ||
    (typeof data.label === "string" ? data.label : "Uploaded Paper")
  ).replace(/^📄\s*/, "");

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={260}
      minHeight={isCompact ? 100 : 130}
      accentColor="#10b981"
      handleClassName="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-700/80 text-left"
    >
      <div className="pb-2 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 flex items-center justify-between gap-2 shrink-0 cursor-grab active:cursor-grabbing">
        <h3 className="text-xs font-semibold text-emerald-400 [html[data-theme='light']_&]:text-emerald-950 leading-snug line-clamp-1 truncate">
          📄 {rawTitle}
        </h3>
        <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 [html[data-theme='light']_&]:bg-emerald-100 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-300">
          ChromaDB
        </span>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p
          className={`text-xs text-zinc-300 font-normal leading-relaxed whitespace-pre-wrap ${
            isCompact ? "line-clamp-2" : ""
          }`}
        >
          {data.summary ||
            "Paper indexed into ChromaDB. Right-click to query or annotate."}
        </p>
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}
