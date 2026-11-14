"use client";

import React from "react";
import { FileText, Sparkles } from "lucide-react";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

export interface PaperNodeData {
  title?: string;
  year?: string | number;
  summary?: string;
  citations?: string;
  doi?: string;
  authors?: string[];
  publication?: string;
  is_oa?: boolean;
  oa_status?: string;
  pdf_url?: string;
  landing_page_url?: string;
  provider?: string;
  providers?: string[];
  [key: string]: unknown;
}

export function PaperNode({
  data,
  selected,
}: {
  data: PaperNodeData;
  selected?: boolean;
}) {
  const isCompact = !!data.isCompact;

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={260}
      minHeight={isCompact ? 110 : 150}
      accentColor="#10b981"
      handleClassName="!bg-emerald-500 !w-2.5 !h-2.5 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-emerald-700/80 text-left"
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 shrink-0 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 text-emerald-400 [html[data-theme='light']_&]:text-emerald-700">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Research Paper</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-mono [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200">
          {data.year || "2024"}
        </span>
      </div>

      <ScrollableNodeBody className="mt-2 pr-1">
        <h3 className="text-xs font-semibold text-zinc-100 [html[data-theme='light']_&]:text-slate-900 leading-snug line-clamp-1">
          {data.title || "Paper Title"}
        </h3>
        <p className={`mt-1 text-xs text-zinc-300 [html[data-theme='light']_&]:text-slate-700 leading-relaxed whitespace-pre-wrap ${
          isCompact ? "line-clamp-2" : ""
        }`}>
          {data.summary || "Extracting key findings and baseline parameters..."}
        </p>
      </ScrollableNodeBody>

      <div className="mt-2 flex items-center justify-between pt-2 border-t border-zinc-900 [html[data-theme='light']_&]:border-slate-200 text-[11px] text-zinc-400 shrink-0">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400 [html[data-theme='light']_&]:text-amber-600" />
          <span className="text-[10px] [html[data-theme='light']_&]:text-slate-700">{data.citations || "45 citations"}</span>
        </span>
        <span className="text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40 text-[10px] font-mono [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200">
          Indexed
        </span>
      </div>
    </ResizableNodeFrame>
  );
}
