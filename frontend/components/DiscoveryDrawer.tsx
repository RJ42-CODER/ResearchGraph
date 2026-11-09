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

  if (!isOpen) return null;

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
    <aside className="fixed top-14 right-0 bottom-0 w-[490px] max-w-full z-40 bg-zinc-950 border-l border-zinc-800 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Research Discovery Hub
            </h2>
            <p className="text-[11px] text-zinc-500">
              OpenAlex • Crossref • Unpaywall
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition cursor-pointer"
          title="Close Discovery Hub"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/40 space-y-3">
        <form onSubmit={handleSearch} className="space-y-2.5">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, keywords, or DOI (e.g. 10.1038/...)"
              className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg pl-9 pr-8 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 transition"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span>Source:</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Providers (Federated)</option>
                <option value="openalex">OpenAlex (Primary)</option>
                <option value="crossref">Crossref (Metadata)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-medium text-white transition cursor-pointer"
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
          <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300">
            {warnings.map((w, idx) => (
              <p key={idx}>⚠️ {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {loading && (
          <div className="space-y-3 pt-6">
            <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs">Querying academic indices...</span>
            </div>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 animate-pulse space-y-2.5"
              >
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                <div className="h-3 bg-zinc-800/40 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-4 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-300 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Search Error</span>
            </div>
            <p className="text-xs text-rose-300/90 leading-relaxed">{error}</p>
            <button
              onClick={() => handleSearch()}
              className="mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-[11px] text-rose-100 border border-rose-800 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Retry Search
            </button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center py-16 space-y-2 text-zinc-500">
            <BookOpen className="w-8 h-8 mx-auto opacity-40 text-zinc-400" />
            <p className="text-xs font-medium text-zinc-400">
              No matching papers found
            </p>
            <p className="text-[11px] text-zinc-600 max-w-xs mx-auto">
              Try adjusting your query keywords, searching by DOI, or selecting &quot;All Providers&quot;.
            </p>
          </div>
        )}

        {!loading && !error && !hasSearched && (
          <div className="text-center py-20 space-y-3 text-zinc-500">
            <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <Search className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-300">
                Discover Verified Research
              </p>
              <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                Search millions of papers via OpenAlex & Crossref with automatic Open Access full-text resolution via Unpaywall.
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
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700/80 transition space-y-3 text-left"
              >
                {/* Header: Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Provider badge */}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                      {paper.primary_provider.toUpperCase()}
                    </span>

                    {/* Open Access badge */}
                    {paper.is_oa ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                        <Unlock className="w-2.5 h-2.5" />
                        <span>Open Access{paper.oa_status ? ` (${paper.oa_status})` : ""}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                        <Lock className="w-2.5 h-2.5" />
                        <span>Closed Access</span>
                      </span>
                    )}

                    {paper.year && (
                      <span className="text-[10px] font-medium text-zinc-400">
                        {paper.year}
                      </span>
                    )}
                  </div>

                  {/* Add to Canvas Button */}
                  <button
                    onClick={() => onAddPaper(paper)}
                    disabled={added}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      added
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 cursor-default"
                        : "bg-cyan-600 hover:bg-cyan-500 text-white"
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
                  <h3 className="text-xs font-semibold text-zinc-100 leading-snug">
                    {paper.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {formatAuthors(paper.authors)}
                  </p>
                </div>

                {/* Publication / Venue */}
                {paper.publication && (
                  <p className="text-[11px] text-zinc-400 italic">
                    {paper.publication}
                  </p>
                )}

                {/* DOI & Links */}
                <div className="flex items-center gap-3 pt-1 border-t border-zinc-800/60 text-[11px] flex-wrap">
                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                    >
                      <span>DOI: {paper.doi}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {paper.pdf_url && (
                    <a
                      href={paper.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      <FileText className="w-3 h-3" />
                      <span>PDF Full Text</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}

                  {!paper.pdf_url && paper.landing_page_url && (
                    <a
                      href={paper.landing_page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
                    >
                      <span>Publisher Link</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                {/* Abstract Preview */}
                {paper.abstract && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleAbstract(paper.id)}
                      className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> Hide Abstract
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> View Abstract
                        </>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
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
