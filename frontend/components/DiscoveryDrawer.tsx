"use client";

import React, { useState } from "react";
import {
  Search,
  X,
  ExternalLink,
  BookOpen,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Globe,
  Lock,
  Unlock,
  Layers,
} from "lucide-react";

export interface DiscoveredPaperItem {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  doi: string | null;
  publication: string | null;
  abstract: string | null;
  openalex_id: string | null;
  is_oa: boolean;
  oa_status: string | null;
  pdf_url: string | null;
  landing_page_url: string | null;
  primary_provider: string;
  providers: string[];
}

interface DiscoveryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPaper: (paper: DiscoveredPaperItem) => void;
  existingPaperKeys: Set<string>;
  backendUrl: string;
}

export function DiscoveryDrawer({
  isOpen,
  onClose,
  onAddPaper,
  existingPaperKeys,
  backendUrl,
}: DiscoveryDrawerProps) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiscoveredPaperItem[]>([]);
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setWarnings([]);
    setHasSearched(true);

    try {
      // Auto-detect DOI lookup if query looks like a DOI
      const isDoi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(trimmed) || trimmed.startsWith("doi:");
      let url: string;
      if (isDoi) {
        const cleanDoi = trimmed.replace(/^doi:/i, "").trim();
        url = `${backendUrl}/api/discovery/doi/${encodeURIComponent(cleanDoi)}`;
      } else {
        url = `${backendUrl}/api/discovery/search?q=${encodeURIComponent(trimmed)}&provider=${provider}&limit=20`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Search request failed" }));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      const data = await res.json();

      if (isDoi) {
        if (data.found && data.paper) {
          setResults([data.paper]);
        } else {
          setResults([]);
          if (data.warnings?.length) setWarnings(data.warnings);
        }
      } else {
        setResults(data.papers || []);
        if (data.warnings?.length) setWarnings(data.warnings);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect to discovery service.";
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const isPaperAdded = (paper: DiscoveredPaperItem) => {
    if (paper.doi && existingPaperKeys.has(paper.doi.toLowerCase())) return true;
    if (paper.openalex_id && existingPaperKeys.has(paper.openalex_id)) return true;
    if (paper.id && existingPaperKeys.has(paper.id)) return true;
    return false;
  };

  const formatAuthors = (authors: string[]) => {
    if (!authors || authors.length === 0) return "Unknown Authors";
    if (authors.length <= 2) return authors.join(", ");
    return `${authors[0]}, ${authors[1]} +${authors.length - 2} more`;
  };

  return (
    <aside
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`absolute top-0 right-0 bottom-0 w-[540px] max-w-full z-30 bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800 flex flex-col shadow-2xl transform transition-[transform,opacity] duration-200 ease-in-out ${
        isOpen
          ? "translate-x-0 opacity-100 pointer-events-auto"
          : "translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      {/* Drawer Header */}
      <div className="h-16 px-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center shadow-sm">
            <Globe className="w-4.5 h-4.5 text-current" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Research Discovery Hub
            </h2>
            <p className="text-xs text-zinc-400">
              OpenAlex • Crossref • Unpaywall
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition cursor-pointer"
          title="Close Discovery Hub"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 space-y-3 shrink-0">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4.5 h-4.5 text-zinc-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, keywords, or DOI (e.g. 10.1038/...)"
              className="w-full h-11 bg-zinc-950 border border-zinc-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition shadow-inner"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 p-0.5 text-zinc-400 hover:text-zinc-200 transition"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Provider Controls and Search Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" /> Source:
              </span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 cursor-pointer transition"
              >
                <option value="all">All Providers (Federated)</option>
                <option value="openalex">OpenAlex (Primary Search)</option>
                <option value="crossref">Crossref (Metadata Registry)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="btn-primary-mono h-9 px-4 rounded-lg active:scale-[0.98] disabled:opacity-40 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </form>

        {warnings.length > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs text-amber-300">
            {warnings.map((w, idx) => (
              <p key={idx}>⚠️ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="space-y-3 pt-2">
            <div className="flex flex-col items-center justify-center gap-2.5 text-zinc-400 py-6">
              <RefreshCw className="w-5 h-5 animate-spin text-current" />
              <span className="text-xs font-medium">Resolving OpenAlex & Crossref literature indices...</span>
            </div>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/70 shadow-lg animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-16 bg-zinc-800 rounded-full" />
                    <div className="h-4 w-20 bg-zinc-800/60 rounded-full" />
                    <div className="h-4 w-10 bg-zinc-800/40 rounded-full" />
                  </div>
                  <div className="h-6 w-16 bg-zinc-800/70 rounded-lg" />
                </div>
                <div className="h-4 bg-zinc-800 rounded w-4/5" />
                <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                <div className="space-y-1.5 pt-1">
                  <div className="h-2.5 bg-zinc-800/40 rounded w-full" />
                  <div className="h-2.5 bg-zinc-800/30 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/30 text-rose-300 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-200">
              <AlertCircle className="w-4.5 h-4.5 text-rose-400" />
              <span>Search Error</span>
            </div>
            <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
            <button
              onClick={() => handleSearch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/70 hover:bg-rose-900 text-xs font-medium text-rose-100 border border-rose-700/60 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Search
            </button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center py-20 space-y-3 text-zinc-500">
            <BookOpen className="w-9 h-9 mx-auto opacity-40 text-zinc-400" />
            <p className="text-sm font-medium text-zinc-300">
              No matching papers found
            </p>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Try adjusting your query keywords, searching directly by DOI (e.g. 10.1038/...), or selecting &quot;All Providers&quot;.
            </p>
          </div>
        )}

        {!loading && !error && !hasSearched && (
          <div className="text-center py-24 space-y-3.5 text-zinc-500">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center mx-auto shadow-sm">
              <Search className="w-6 h-6 text-current" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-zinc-200">
                Discover Verified Research
              </p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Search global literature via OpenAlex & Crossref with automatic Open Access full-text resolution via Unpaywall.
              </p>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          results.map((paper) => {
            const added = isPaperAdded(paper);
            const isExpanded = expandedAbstracts[paper.id] || false;

            return (
              <div
                key={paper.id}
                className="p-4 rounded-xl border border-zinc-800/90 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700/80 transition duration-150 space-y-3 text-left shadow-sm"
              >
                {/* Header: Badges & Add Button */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Provider badge */}
                    <span className="text-[11px] font-semibold tracking-wider px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700/70 uppercase">
                      {paper.primary_provider}
                    </span>

                    {/* Open Access badge */}
                    {paper.is_oa ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm">
                        <Unlock className="w-3 h-3 text-emerald-400" />
                        <span>Open Access{paper.oa_status ? ` (${paper.oa_status})` : ""}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-800/90 text-zinc-400 border border-zinc-700/60">
                        <Lock className="w-3 h-3 text-zinc-400" />
                        <span>Closed Access</span>
                      </span>
                    )}

                    {paper.year && (
                      <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900/80 px-2 py-0.5 rounded-full border border-zinc-800">
                        {paper.year}
                      </span>
                    )}
                  </div>

                  {/* Add to Canvas Button */}
                  <button
                    onClick={() => onAddPaper(paper)}
                    disabled={added}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-[0.98] ${
                      added
                        ? "btn-glass-mono opacity-80 cursor-default"
                        : "btn-primary-mono shadow-sm"
                    }`}
                  >
                    {added ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>On Canvas</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Canvas</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 hover:text-cyan-200 leading-snug transition-colors">
                    {paper.title}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-300 font-normal leading-relaxed">
                    {formatAuthors(paper.authors)}
                  </p>
                </div>

                {/* Publication / Venue */}
                {paper.publication && (
                  <p className="text-xs text-zinc-400 italic">
                    {paper.publication}
                  </p>
                )}

                {/* DOI & Links */}
                <div className="flex items-center gap-3.5 pt-2 border-t border-zinc-800/70 text-xs flex-wrap">
                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
                    >
                      <span className="font-medium">DOI: {paper.doi}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {paper.pdf_url && (
                    <a
                      href={paper.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 px-2.5 py-1 rounded-md transition shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      <span>PDF Full Text</span>
                      <ExternalLink className="w-3 h-3 text-emerald-400" />
                    </a>
                  )}

                  {!paper.pdf_url && paper.landing_page_url && (
                    <a
                      href={paper.landing_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition"
                    >
                      <span>Publisher Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Abstract Preview */}
                {paper.abstract && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleAbstract(paper.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer py-0.5"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> Hide Abstract
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-cyan-400" /> View Abstract
                        </>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800/90 text-xs text-zinc-300 leading-relaxed max-h-52 overflow-y-auto overscroll-contain touch-pan-y node-scrollbar whitespace-pre-wrap select-text">
                        {paper.abstract}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </aside>
  );
}
