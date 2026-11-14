"use client";

import React, { useState, useMemo } from "react";
import {
  BookOpen,
  Search,
  UploadCloud,
  FileText,
  ExternalLink,
  Bot,
  Play,
  Crosshair,
  Calendar,
  User,
  Filter,
  CheckCircle2,
  X,
} from "lucide-react";
import { Node } from "@xyflow/react";

interface ResearchLibraryProps {
  nodes: Node[];
  onShowInGraph: (nodeId: string) => void;
  onAskAssistant: (node: Node) => void;
  onRunBenchmark: (node: Node) => void;
  onUploadPdf: () => void;
  onOpenDiscovery: () => void;
}

export function ResearchLibrary({
  nodes,
  onShowInGraph,
  onAskAssistant,
  onRunBenchmark,
  onUploadPdf,
  onOpenDiscovery,
}: ResearchLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "uploaded" | "discovery" | "oa">("all");

  // Extract paper nodes
  const paperNodes = useMemo(() => {
    return nodes.filter((n) => {
      const rawType = (n.type || n.data?._node_type || "").toString();
      const id = n.id;
      return (
        rawType === "paper" ||
        rawType === "uploadedPaper" ||
        rawType === "discovery" ||
        id.startsWith("paper") ||
        id.startsWith("discovery")
      );
    });
  }, [nodes]);

  // Filter & search
  const filteredPapers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return paperNodes.filter((n) => {
      const data = (n.data as Record<string, unknown>) || {};
      const title = String(data.title || data.label || n.id).toLowerCase();
      const authors = Array.isArray(data.authors)
        ? data.authors.join(" ").toLowerCase()
        : String(data.authors || "").toLowerCase();
      const doi = String(data.doi || "").toLowerCase();
      const publication = String(data.publication || "").toLowerCase();

      const matchesSearch =
        !q ||
        title.includes(q) ||
        authors.includes(q) ||
        doi.includes(q) ||
        publication.includes(q);

      if (!matchesSearch) return false;

      const rawType = (n.type || data._node_type || "").toString();
      if (filterType === "uploaded") {
        return rawType === "uploadedPaper" || n.id.startsWith("paper-upload");
      }
      if (filterType === "discovery") {
        return rawType === "discovery" || n.id.startsWith("discovery-");
      }
      if (filterType === "oa") {
        return !!data.is_oa;
      }
      return true;
    });
  }, [paperNodes, searchQuery, filterType]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Header with Title and Import Triggers */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-current" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Research Library
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400">
              {paperNodes.length} {paperNodes.length === 1 ? "Paper" : "Papers"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Search, inspect metadata, and launch grounded Q&A or simulations across your literature catalog.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUploadPdf}
            className="btn-primary-mono inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={onOpenDiscovery}
            className="btn-glass-mono inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Discovery</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-panel-mono flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2.5 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search papers by title, author, DOI, or publication..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.04] dark:bg-white/[0.04] border border-white/10 dark:border-white/10 text-xs text-current placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-current"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              filterType === "all"
                ? "btn-primary-mono"
                : "btn-glass-mono opacity-80 hover:opacity-100"
            }`}
          >
            All Papers ({paperNodes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("uploaded")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              filterType === "uploaded"
                ? "btn-primary-mono"
                : "btn-glass-mono opacity-80 hover:opacity-100"
            }`}
          >
            Uploaded PDFs
          </button>
          <button
            type="button"
            onClick={() => setFilterType("discovery")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              filterType === "discovery"
                ? "btn-primary-mono"
                : "btn-glass-mono opacity-80 hover:opacity-100"
            }`}
          >
            Discovery Hub
          </button>
          <button
            type="button"
            onClick={() => setFilterType("oa")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              filterType === "oa"
                ? "btn-primary-mono"
                : "btn-glass-mono opacity-80 hover:opacity-100"
            }`}
          >
            Open Access
          </button>
        </div>
      </div>

      {/* Papers Table */}
      {filteredPapers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel-mono space-y-3">
          <FileText className="w-10 h-10 mx-auto text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-200">No papers found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {searchQuery
              ? `No papers matching "${searchQuery}". Try clearing the search term or switching filter categories.`
              : "Your workspace has zero indexed papers. Upload a local PDF or discover papers from OpenAlex."}
          </p>
          {!searchQuery && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onUploadPdf}
                className="btn-primary-mono px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer active:scale-[0.98]"
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={onOpenDiscovery}
                className="btn-glass-mono px-4 py-2 rounded-xl text-xs font-medium cursor-pointer active:scale-[0.98]"
              >
                Search OpenAlex
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="monochrome-card overflow-hidden rounded-3xl border border-white/15 dark:border-white/15 shadow-2xl">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 [html[data-theme='light']_&]:border-black/10 bg-white/5 [html[data-theme='light']_&]:bg-black/5 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  <th className="px-5 py-3.5 font-semibold">Publication Details</th>
                  <th className="px-5 py-3.5 font-semibold">Authors</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Year</th>
                  <th className="px-4 py-3.5 font-semibold text-center">Source</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 [html[data-theme='light']_&]:divide-black/10">
                {filteredPapers.map((paper) => {
                  const data = (paper.data as Record<string, unknown>) || {};
                  const title = String(data.title || data.label || paper.id).replace(/^📄\s*/, "");
                  const rawType = (paper.type || data._node_type || "").toString();
                  const isDiscovery = rawType === "discovery" || paper.id.startsWith("discovery");

                  const rawAuthors = Array.isArray(data.authors) && data.authors.length > 0
                    ? data.authors.slice(0, 3).join(", ") + (data.authors.length > 3 ? " et al." : "")
                    : (data.authors && String(data.authors).trim() !== "" && String(data.authors) !== "—")
                      ? String(data.authors)
                      : null;

                  const isAuthorsFallback = !rawAuthors && !isDiscovery;
                  const authorsDisplay = rawAuthors || (isAuthorsFallback ? "Local PDF Upload" : "—");

                  const isYearFallback = !data.year && !isDiscovery;
                  const yearDisplay = data.year ? String(data.year) : (isYearFallback ? "Local" : "—");

                  return (
                    <tr
                      key={paper.id}
                      className="hover:bg-white/5 [html[data-theme='light']_&]:hover:bg-black/5 transition-colors group"
                    >
                      {/* Publication Title & Metadata */}
                      <td className="px-5 py-4 max-w-md">
                        <div className="space-y-1">
                          <h4
                            onClick={() => onShowInGraph(paper.id)}
                            className="font-semibold text-current hover:opacity-80 transition cursor-pointer line-clamp-2 leading-snug"
                            title={title}
                          >
                            {title}
                          </h4>
                          <div className="flex items-center gap-2.5 text-[11px] text-zinc-400 flex-wrap">
                            {data.publication ? (
                              <span className="text-zinc-400">{String(data.publication)}</span>
                            ) : null}
                            {data.doi ? (
                              <a
                                href={`https://doi.org/${String(data.doi)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-zinc-400 hover:text-current font-mono text-[10px]"
                              >
                                <span>DOI</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : null}
                            {data.is_oa ? (
                              <span className="px-1.5 py-0.2 rounded bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black font-mono text-[9px]">
                                Open Access
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Authors */}
                      <td className="px-5 py-4 max-w-xs text-[11px]">
                        <div className="flex items-start gap-1.5 line-clamp-2">
                          <User className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <span
                            className={
                              isAuthorsFallback
                                ? "text-zinc-500 italic"
                                : "text-zinc-300 [html[data-theme='light']_&]:text-slate-800"
                            }
                          >
                            {authorsDisplay}
                          </span>
                        </div>
                      </td>

                      {/* Year */}
                      <td
                        className={`px-4 py-4 text-center font-mono ${
                          isYearFallback
                            ? "text-zinc-500 text-[11px]"
                            : "text-zinc-400 [html[data-theme='light']_&]:text-slate-700"
                        }`}
                      >
                        {yearDisplay}
                      </td>

                      {/* Source Badge */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium border bg-white/10 border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black">
                          {isDiscovery ? "OpenAlex" : "Uploaded PDF"}
                        </span>
                      </td>

                      {/* 1-Click Action Buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onShowInGraph(paper.id)}
                            className="btn-glass-mono inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer"
                            title="Center camera on paper in graph canvas"
                          >
                            <Crosshair className="w-3 h-3" />
                            <span>Focus</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onAskAssistant(paper)}
                            className="btn-glass-mono inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition cursor-pointer"
                            title="Chat with Assistant grounded in this paper"
                          >
                            <Bot className="w-3 h-3" />
                            <span>Ask</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onRunBenchmark(paper)}
                            className="btn-primary-mono inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                            title="Generate code & simulate benchmark in sandbox"
                          >
                            <Play className="w-3 h-3" />
                            <span>Benchmark</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

