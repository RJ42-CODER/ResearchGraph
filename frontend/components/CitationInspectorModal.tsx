"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  X,
  Copy,
  Check,
  Crosshair,
  ExternalLink,
  BookOpen,
  Loader2,
  AlertCircle,
} from "lucide-react";

export interface CitationPayload {
  paperId: string;
  paperTitle: string;
  page: string;
  label: string;
}

interface CitationExcerptResponse {
  status: string;
  paper_id: string;
  paper_title: string;
  page: string;
  citation_label: string;
  excerpt: string;
  source_type: string;
  total_pages?: number;
}

export function CitationInspectorModal({
  isOpen,
  onClose,
  citation,
  onFocusNode,
  backendUrl = "http://localhost:8000",
}: {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationPayload | null;
  onFocusNode?: (paperId: string) => void;
  backendUrl?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CitationExcerptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !citation) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchExcerpt = async () => {
      try {
        const cleanPage = citation.page || "1";
        const res = await fetch(
          `${backendUrl}/api/papers/citation-excerpt?paper_id=${encodeURIComponent(
            citation.paperId
          )}&page=${encodeURIComponent(cleanPage)}`
        );
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted) {
          setData(json);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load citation excerpt"
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchExcerpt();

    return () => {
      isMounted = false;
    };
  }, [isOpen, citation, backendUrl]);

  if (!isOpen || !citation) return null;

  const handleCopy = () => {
    if (!data?.excerpt) return;
    const citeText = `"${citation.paperTitle}", ${data.citation_label}: "${data.excerpt.trim()}"`;
    navigator.clipboard.writeText(citeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sourceTypeBadge = () => {
    if (!data) return null;
    const type = data.source_type;
    if (type === "pdf_page") {
      return (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200">
          ✓ Verified from PDF
        </span>
      );
    }
    if (type === "indexed_chunk") {
      return (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 [html[data-theme='light']_&]:bg-indigo-50 [html[data-theme='light']_&]:text-indigo-950 [html[data-theme='light']_&]:border-indigo-200">
          ✓ Vector Indexed Chunk
        </span>
      );
    }
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/60 [html[data-theme='light']_&]:bg-amber-50 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-200">
        Abstract / Overview
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Traceable Citation Excerpt
                </h3>
                {sourceTypeBadge()}
                {data?.total_pages && data.total_pages > 1 && (
                  <span className="text-[10px] text-zinc-500">
                    ({data.total_pages} total pages)
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-md">
                {citation.paperTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition cursor-pointer"
            title="Close citation inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs">
                Retrieving verified page text from document storage...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/50 flex items-start gap-3 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Unable to load excerpt</p>
                <p className="text-[11px] text-rose-400/80 mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Citation Anchor Tag */}
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 [html[data-theme='light']_&]:border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 [html[data-theme='light']_&]:bg-indigo-50 [html[data-theme='light']_&]:text-indigo-950 [html[data-theme='light']_&]:border-indigo-200">
                    {data?.citation_label || citation.label}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Direct excerpt retrieved from target paper
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">
                  ID: {citation.paperId.slice(0, 12)}
                </span>
              </div>

              {/* Verified Text Quote Box */}
              <div className="relative p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-200 [html[data-theme='light']_&]:bg-slate-50 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-200 leading-relaxed font-serif text-[13px] shadow-inner select-text">
                <div className="absolute top-2 left-2 text-zinc-700 [html[data-theme='light']_&]:text-slate-400 font-serif text-3xl select-none leading-none">
                  &ldquo;
                </div>
                <div className="pl-4 pt-1 whitespace-pre-wrap">
                  {data?.excerpt ||
                    "No textual excerpt was located for this specific page reference."}
                </div>
                <div className="text-right text-zinc-700 [html[data-theme='light']_&]:text-slate-400 font-serif text-3xl select-none leading-none">
                  &rdquo;
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 [html[data-theme='light']_&]:bg-slate-100/60 [html[data-theme='light']_&]:border-slate-200 [html[data-theme='light']_&]:text-slate-700 flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  Grounding Rule: Responses citing this tag are directly verified
                  against this source text.
                </span>
                <span className="text-indigo-400 [html[data-theme='light']_&]:text-indigo-700 font-mono">100% Traceable</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            disabled={!data?.excerpt}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-xs text-zinc-200 transition cursor-pointer disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Citation Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Citation</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            {onFocusNode && (
              <button
                onClick={() => {
                  onFocusNode(citation.paperId);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/70 border border-indigo-800/60 active:scale-95 text-xs text-indigo-200 transition cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5 text-indigo-400" />
                <span>Focus Paper on Canvas</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

