"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText, Sparkles } from "lucide-react";

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

export function PaperNode({ data }: { data: PaperNodeData }) {
  return (
    <div className="w-80 rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-all hover:border-zinc-700">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-3 !h-3" />
      
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-emerald-400">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Research Paper</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
          {data.year || "2024"}
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-zinc-100 leading-snug line-clamp-2">
        {data.title || "Paper Title"}
      </h3>
      <p className="mt-1 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
        {data.summary || "Extracting key findings and baseline parameters..."}
      </p>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          {data.citations || "45 citations"}
        </span>
        <span className="text-emerald-400 font-medium">Indexed</span>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3" />
    </div>
  );
}
