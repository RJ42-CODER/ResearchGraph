"use client";

import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Globe, ExternalLink, FileText, Unlock, Lock } from "lucide-react";

export interface DiscoveryNodeData {
  id?: string;
  title?: string;
  label?: string | React.ReactNode;
  authors?: string[];
  year?: number | string;
  doi?: string;
  publication?: string;
  is_oa?: boolean;
  oa_status?: string;
  pdf_url?: string;
  landing_page_url?: string;
  provider?: string;
  providers?: string[];
  abstract?: string;
  summary?: string;
  paper_id?: string;
  [key: string]: unknown;
}

export function DiscoveryNode({ data }: { data: DiscoveryNodeData }) {
  const authorsText = data.authors && data.authors.length > 0
    ? data.authors.length > 2
      ? `${data.authors[0]}, ${data.authors[1]} +${data.authors.length - 2}`
      : data.authors.join(", ")
    : null;

  return (
    <div className="w-[320px] rounded-xl border border-cyan-800/80 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-all hover:border-cyan-500 text-left cursor-pointer">
      <Handle type="target" position={Position.Left} className="!bg-cyan-500 !w-3 !h-3" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 text-cyan-400">
          <Globe className="w-3.5 h-3.5" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {data.provider || "Academic"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {data.is_oa ? (
            <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/60">
              <Unlock className="w-2.5 h-2.5" />
              <span>OA</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              <Lock className="w-2.5 h-2.5" />
              <span>Closed</span>
            </span>
          )}

          {data.year && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {data.year}
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="mt-2 text-xs font-semibold text-zinc-100 leading-snug line-clamp-2">
        {data.title || "Academic Paper"}
      </h3>

      {/* Authors & Publication */}
      {authorsText && (
        <p className="mt-1 text-[11px] text-zinc-400 line-clamp-1">
          {authorsText}
        </p>
      )}

      {data.publication && (
        <p className="mt-0.5 text-[10px] text-zinc-500 italic line-clamp-1">
          {data.publication}
        </p>
      )}

      {/* DOI and Links */}
      <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px]">
        {data.doi ? (
          <a
            href={`https://doi.org/${data.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
          >
            <span className="truncate max-w-[130px]">DOI: {data.doi}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </a>
        ) : (
          <span className="text-zinc-500">Verified Citation</span>
        )}

        {data.pdf_url ? (
          <a
            href={data.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40"
          >
            <FileText className="w-3 h-3" />
            <span>PDF</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : data.landing_page_url ? (
          <a
            href={data.landing_page_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-300 text-[10px]"
          >
            <span>Link</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        ) : null}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-3 !h-3" />
    </div>
  );
}
