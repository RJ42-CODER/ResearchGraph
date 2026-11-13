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
  [key: string]: unknown;
}

export function SynthesisResultNode({
  data,
  selected,
}: {
  data: WorkspaceNodeData;
  selected?: boolean;
}) {
  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={280}
      minHeight={180}
      accentColor="#818cf8"
      handleClassName="!bg-indigo-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-[10px] border border-indigo-600 bg-zinc-900 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-left"
    >
      <div className="flex items-center justify-between gap-2 border-b border-indigo-500/30 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
        <span className="font-bold text-xs text-indigo-300 truncate">
          ⚡ {data.title || "Synthesis Results"}
        </span>
        {typeof data.paperCount === "number" && (
          <span className="shrink-0 text-[10px] font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
            {data.paperCount} Papers Compared
          </span>
        )}
      </div>

      <ScrollableNodeBody className="mt-2.5 pr-1">
        <FormattedPlainText
          text={data.summary || "No synthesis output available."}
          className="text-[11px] text-zinc-200 font-normal leading-relaxed break-words"
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
      handleClassName={`!w-3 !h-3 !border-2 !border-zinc-950 ${taskMode === "gaps" ? "!bg-amber-500" : "!bg-purple-500"}`}
      className={`rounded-[10px] border border-dashed bg-zinc-900 p-3.5 shadow-xl text-left transition-colors ${
        taskMode === "gaps" ? "border-amber-600" : "border-purple-600"
      }`}
    >
      <div
        className={`font-semibold text-xs flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing pb-1.5 border-b ${
          taskMode === "gaps"
            ? "text-amber-300 border-amber-800/40"
            : "text-purple-300 border-purple-800/40"
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
      <div className="mt-2 flex items-center p-0.5 rounded-lg bg-zinc-950/90 border border-zinc-800 text-[10px] shrink-0 nodrag">
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
              ? "bg-purple-900/80 text-purple-200 border border-purple-700/60 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
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
              ? "bg-amber-950/80 text-amber-200 border border-amber-700/60 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
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
  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={320}
      minHeight={220}
      accentColor="#f59e0b"
      handleClassName="!bg-amber-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-[10px] border border-amber-600 bg-zinc-900 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.6)] text-left"
    >
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-2 shrink-0 cursor-grab active:cursor-grabbing">
        <span className="font-bold text-xs text-amber-300 truncate">
          🔍 {data.title || "Research Gap Discovery"}
        </span>
        {typeof data.paperCount === "number" && (
          <span className="shrink-0 text-[10px] font-medium text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800/80">
            {data.paperCount} Papers Analyzed
          </span>
        )}
      </div>

      <ScrollableNodeBody className="mt-2.5 pr-1">
        <FormattedPlainText
          text={data.summary || data.gaps || "No research gaps identified yet."}
          className="text-[11px] text-zinc-200 font-normal leading-relaxed break-words"
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
      handleClassName="!bg-amber-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-lg border border-amber-600 bg-zinc-800 p-3.5 shadow-xl text-left"
    >
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-amber-700/40 text-[11px] font-semibold text-amber-300 shrink-0 cursor-grab active:cursor-grabbing">
        <span>📝 Note</span>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p className="text-xs text-amber-100 leading-relaxed whitespace-pre-wrap">
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
  const rawTitle = (
    data.title ||
    (typeof data.label === "string" ? data.label : "Uploaded Paper")
  ).replace(/^📄\s*/, "");

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={240}
      minHeight={120}
      accentColor="#10b981"
      handleClassName="!bg-emerald-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-[10px] border border-emerald-600 bg-zinc-900 p-4 shadow-xl text-left"
    >
      <div className="pb-2 border-b border-emerald-900/50 shrink-0 cursor-grab active:cursor-grabbing">
        <h3 className="text-[13px] font-semibold text-emerald-400 leading-snug line-clamp-2">
          📄 {rawTitle}
        </h3>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p className="text-xs text-zinc-300 font-normal leading-relaxed whitespace-pre-wrap">
          {data.summary ||
            "Paper indexed into ChromaDB. Right-click to query or annotate."}
        </p>
      </ScrollableNodeBody>
    </ResizableNodeFrame>
  );
}
