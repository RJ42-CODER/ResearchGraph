"use client";

import React from "react";
import { FormattedPlainText } from "./FormattedPlainText";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

export interface WorkspaceNodeData {
  title?: string;
  label?: string;
  summary?: string;
  paperCount?: number;
  analyzingCount?: number;
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

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={240}
      minHeight={110}
      accentColor="#c084fc"
      handleClassName="!bg-purple-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-[10px] border border-dashed border-purple-600 bg-zinc-900 p-3.5 shadow-xl text-left"
    >
      <div className="font-semibold text-xs text-purple-300 flex items-center gap-2 shrink-0 cursor-grab active:cursor-grabbing pb-1.5 border-b border-purple-800/40">
        {isAnalyzing ? (
          <>
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" />
            <span>Analyzing {data.analyzingCount} papers...</span>
          </>
        ) : (
          <span className="truncate">
            🔍 {data.title || "Cross-Reference Task"}
          </span>
        )}
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <p className="text-[11px] text-zinc-400 font-normal leading-snug">
          Connect 2 or more papers into this node, right-click, and select
          &quot;Run Cross-Reference&quot;.
        </p>
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
