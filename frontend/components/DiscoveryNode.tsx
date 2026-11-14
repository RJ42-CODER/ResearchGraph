"use client";

import React from "react";
import { Globe, ExternalLink, FileText, Unlock, Lock } from "lucide-react";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

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

export function DiscoveryNode({
  data,
  selected,
}: {
  data: DiscoveryNodeData;
  selected?: boolean;
}) {
  const authorsText =
    data.authors && data.authors.length > 0
      ? data.authors.length > 2
        ? `${data.authors[0]}, ${data.authors[1]} +${data.authors.length - 2}`
        : data.authors.join(", ")
      : null;

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={260}
      minHeight={180}
      accentColor="#06b6d4"
      handleClassName="!bg-cyan-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-xl border border-cyan-800/80 bg-zinc-950/95 p-4.5 shadow-2xl backdrop-blur-md transition-colors hover:border-cyan-500 text-left"
    >
      {/* Header: Provider & Badges */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200 shrink-0 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-1.5 text-cyan-400 [html[data-theme='light']_&]:text-cyan-700">
          <Globe className="w-4 h-4 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider">
            {data.provider || "Academic"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {data.is_oa ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200">
              <Unlock className="w-2.5 h-2.5 text-emerald-400 [html[data-theme='light']_&]:text-emerald-700" />
              <span>OA</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-zinc-800 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-300">
              <Lock className="w-2.5 h-2.5 text-zinc-400 [html[data-theme='light']_&]:text-slate-600" />
              <span>Closed</span>
            </span>
          )}

          {data.year && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-300">
              {data.year}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Metadata & Abstract Body */}
      <ScrollableNodeBody className="mt-2.5 pr-1">
        <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
          {data.title || "Academic Paper"}
        </h3>

        {authorsText && (
          <p className="mt-1.5 text-xs text-zinc-300 leading-relaxed">
            {authorsText}
          </p>
        )}

        {data.publication && (
          <p className="mt-0.5 text-xs text-zinc-400 italic">
            {data.publication}
          </p>
        )}

        {data.abstract && (
          <p className="mt-2 pt-2 border-t border-zinc-800/70 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap">
            {data.abstract}
          </p>
        )}
      </ScrollableNodeBody>

      {/* DOI and Links */}
      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-zinc-900 text-xs shrink-0 gap-2">
        {data.doi ? (
          <a
            href={`https://doi.org/${data.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="nodrag inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition min-w-0"
          >
            <span className="truncate">DOI: {data.doi}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <span className="text-zinc-500 text-[11px]">Verified Citation</span>
        )}

        {data.pdf_url ? (
          <a
            href={data.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="nodrag shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 px-2.5 py-1 rounded-md transition shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDF</span>
            <ExternalLink className="w-3 h-3 text-emerald-400" />
          </a>
        ) : data.landing_page_url ? (
          <a
            href={data.landing_page_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="nodrag shrink-0 inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs transition"
          >
            <span>Link</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
      </div>
    </ResizableNodeFrame>
  );
}
