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
    <div className="w-[340px] rounded-xl border border-zinc-800 bg-zinc-950/95 p-4.5 shadow-2xl backdrop-blur-md transition-all hover:border-zinc-700 text-left">
      <Handle type="target" position={Position.Left} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-zinc-950" />
      
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-emerald-400">
          <FileText className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Research Paper</span>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 font-medium">
          {data.year || "2024"}
        </span>
      </div>

      <h3 className="mt-2.5 text-sm font-semibold text-zinc-100 leading-snug line-clamp-2">
        {data.title || "Paper Title"}
      </h3>
      <p className="mt-1.5 text-xs text-zinc-300 line-clamp-3 leading-relaxed">
        {data.summary || "Extracting key findings and baseline parameters..."}
      </p>

      <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-zinc-900 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{data.citations || "45 citations"}</span>
        </span>
        <span className="text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">Indexed</span>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-zinc-950" />
    </div>
  );
}
