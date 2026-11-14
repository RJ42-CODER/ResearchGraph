"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  X,
  FileText,
  GitFork,
  AlertTriangle,
  Cpu,
  StickyNote,
  LayoutGrid,
  CheckCircle2,
  Loader2,
  Layers,
  Undo2,
  Redo2,
} from "lucide-react";

export type NodeFilterCategory =
  | "all"
  | "papers"
  | "syntheses"
  | "gaps"
  | "experiments"
  | "notes";

interface FloatingCanvasToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFilter: NodeFilterCategory;
  onSelectFilter: (filter: NodeFilterCategory) => void;
  saveStatus: "saved" | "syncing";
  onTidyLayout: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  nodeCounts: {
    total: number;
    papers: number;
    syntheses: number;
    gaps: number;
    experiments: number;
    notes: number;
  };
  matchingResults?: Array<{ id: string; title: string; type: string }>;
  onFocusNode?: (nodeId: string) => void;
}

export function FloatingCanvasToolbar({
  searchQuery,
  onSearchChange,
  selectedFilter,
  onSelectFilter,
  saveStatus,
  onTidyLayout,
  onUndo,
  canUndo = false,
  onRedo,
  canRedo = false,
  nodeCounts,
  matchingResults = [],
  onFocusNode,
}: FloatingCanvasToolbarProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 max-w-[95vw] pointer-events-auto">
      {/* Main Glass Toolbar Container */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800 shadow-2xl transition-all">
        {/* Search Input with Results Flyout */}
        <div ref={searchContainerRef} className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            <input
              id="canvas-search-input"
              type="text"
              placeholder="Search graph nodes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="w-40 sm:w-56 h-8 pl-8 pr-12 rounded-xl bg-zinc-900/90 border border-zinc-800/80 focus:border-indigo-500 focus:outline-none text-xs text-zinc-200 placeholder:text-zinc-500 transition-all"
            />
            {searchQuery ? (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <kbd className="absolute right-2 px-1.5 py-0.5 rounded text-[9px] font-mono pointer-events-none hidden sm:inline bg-white/10 text-white/70 border border-white/15 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black/70 [html[data-theme='light']_&]:border-black/15">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchFocused && searchQuery.trim() && (
            <div className="absolute left-0 mt-2 w-72 max-h-60 overflow-y-auto rounded-xl glass-panel-mono shadow-2xl p-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Matching Nodes</span>
                <span className="font-mono text-zinc-400">{matchingResults.length}</span>
              </div>
              {matchingResults.length === 0 ? (
                <div className="p-3 text-center text-zinc-400 text-[11px]">
                  No matching nodes found.
                </div>
              ) : (
                matchingResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onFocusNode?.(item.id);
                      setIsSearchFocused(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-current hover:bg-white/10 [html[data-theme='light']_&]:hover:bg-black/5 transition cursor-pointer group"
                  >
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-white/10 [html[data-theme='light']_&]:bg-black/5 border border-white/20 [html[data-theme='light']_&]:border-black/20 text-current font-mono">
                      {item.type}
                    </span>
                    <span className="truncate flex-1 group-hover:opacity-80 transition-opacity">
                      {item.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="w-[1px] h-5 bg-zinc-800/80 [html[data-theme='light']_&]:bg-slate-300 mx-0.5 hidden sm:block" />

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onSelectFilter("all")}
            className={`flex items-center gap-1 h-7 px-2.5 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "all"
                ? "bg-zinc-800 text-white shadow-xs border border-zinc-700/60 [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white [html[data-theme='light']_&]:border-black"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-black [html[data-theme='light']_&]:hover:bg-black/5"
            }`}
            title="Show all node types"
          >
            <Layers className="w-3 h-3" />
            <span>All</span>
            <span className="text-[10px] text-zinc-400 [html[data-theme='light']_&]:text-slate-500 ml-0.5 font-mono">
              {nodeCounts.total}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter("papers")}
            className={`flex items-center gap-1 h-7 px-2 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "papers"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-xs [html[data-theme='light']_&]:bg-emerald-100 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-300"
                : "text-zinc-400 hover:text-emerald-300 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-emerald-950 [html[data-theme='light']_&]:hover:bg-emerald-50"
            }`}
            title="Filter to papers only"
          >
            <FileText className="w-3 h-3 text-emerald-400 [html[data-theme='light']_&]:text-emerald-700" />
            <span className="hidden sm:inline">Papers</span>
            <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
              {nodeCounts.papers}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter("syntheses")}
            className={`flex items-center gap-1 h-7 px-2 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "syntheses"
                ? "bg-purple-950/80 text-purple-300 border border-purple-800/60 shadow-xs [html[data-theme='light']_&]:bg-purple-100 [html[data-theme='light']_&]:text-purple-950 [html[data-theme='light']_&]:border-purple-300"
                : "text-zinc-400 hover:text-purple-300 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-purple-950 [html[data-theme='light']_&]:hover:bg-purple-50"
            }`}
            title="Filter to cross-reference syntheses"
          >
            <GitFork className="w-3 h-3 text-purple-400 [html[data-theme='light']_&]:text-purple-700" />
            <span className="hidden sm:inline">Syntheses</span>
            <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
              {nodeCounts.syntheses}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter("gaps")}
            className={`flex items-center gap-1 h-7 px-2 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "gaps"
                ? "bg-orange-950/80 text-orange-300 border border-orange-800/60 shadow-xs [html[data-theme='light']_&]:bg-amber-100 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-300"
                : "text-zinc-400 hover:text-orange-300 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-amber-950 [html[data-theme='light']_&]:hover:bg-amber-50"
            }`}
            title="Filter to research gap discoveries"
          >
            <AlertTriangle className="w-3 h-3 text-orange-400 [html[data-theme='light']_&]:text-amber-700" />
            <span className="hidden sm:inline">Gaps</span>
            <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
              {nodeCounts.gaps}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter("experiments")}
            className={`flex items-center gap-1 h-7 px-2 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "experiments"
                ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-xs [html[data-theme='light']_&]:bg-cyan-100 [html[data-theme='light']_&]:text-cyan-950 [html[data-theme='light']_&]:border-cyan-300"
                : "text-zinc-400 hover:text-cyan-300 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-cyan-950 [html[data-theme='light']_&]:hover:bg-cyan-50"
            }`}
            title="Filter to sandbox experiments"
          >
            <Cpu className="w-3 h-3 text-cyan-400 [html[data-theme='light']_&]:text-cyan-700" />
            <span className="hidden sm:inline">Experiments</span>
            <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
              {nodeCounts.experiments}
            </span>
          </button>

          <button
            onClick={() => onSelectFilter("notes")}
            className={`flex items-center gap-1 h-7 px-2 rounded-xl text-xs font-medium transition cursor-pointer whitespace-nowrap select-none ${
              selectedFilter === "notes"
                ? "bg-amber-950/80 text-amber-300 border border-amber-800/60 shadow-xs [html[data-theme='light']_&]:bg-amber-100 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-300"
                : "text-zinc-400 hover:text-amber-300 hover:bg-zinc-900 [html[data-theme='light']_&]:text-slate-600 [html[data-theme='light']_&]:hover:text-amber-950 [html[data-theme='light']_&]:hover:bg-amber-50"
            }`}
            title="Filter to researcher notes"
          >
            <StickyNote className="w-3 h-3 text-amber-400 [html[data-theme='light']_&]:text-amber-700" />
            <span className="hidden sm:inline">Notes</span>
            <span className="text-[10px] font-mono text-zinc-400 [html[data-theme='light']_&]:text-slate-500">
              {nodeCounts.notes}
            </span>
          </button>
        </div>

        <div className="w-[1px] h-5 bg-zinc-800/80 [html[data-theme='light']_&]:bg-slate-300 mx-0.5" />

        {/* Tidy Layout Button */}
        <button
          onClick={onTidyLayout}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800/90 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:hover:bg-slate-200 [html[data-theme='light']_&]:text-slate-800 [html[data-theme='light']_&]:border-slate-300 active:scale-95 text-xs font-medium text-zinc-300 hover:text-white border border-zinc-800 hover:border-zinc-700 transition cursor-pointer whitespace-nowrap select-none"
          title="Auto-arrange graph into clean vertical columns and save positions"
        >
          <LayoutGrid className="w-3 h-3 text-indigo-400 [html[data-theme='light']_&]:text-indigo-600" />
          <span className="hidden sm:inline">Tidy</span>
        </button>

        {/* Layout Undo & Redo Buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className={`flex items-center justify-center w-7 h-7 rounded-xl transition cursor-pointer select-none ${
              canUndo
                ? "text-zinc-300 hover:text-white hover:bg-zinc-800/90 [html[data-theme='light']_&]:text-slate-700 [html[data-theme='light']_&]:hover:text-black [html[data-theme='light']_&]:hover:bg-black/5 active:scale-95"
                : "text-zinc-600 cursor-not-allowed opacity-40 [html[data-theme='light']_&]:text-slate-400"
            }`}
            title="Undo node layout position (⌘Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className={`flex items-center justify-center w-7 h-7 rounded-xl transition cursor-pointer select-none ${
              canRedo
                ? "text-zinc-300 hover:text-white hover:bg-zinc-800/90 [html[data-theme='light']_&]:text-slate-700 [html[data-theme='light']_&]:hover:text-black [html[data-theme='light']_&]:hover:bg-black/5 active:scale-95"
                : "text-zinc-600 cursor-not-allowed opacity-40 [html[data-theme='light']_&]:text-slate-400"
            }`}
            title="Redo node layout position (⌘⇧Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-[1px] h-5 bg-zinc-800/80 [html[data-theme='light']_&]:bg-slate-300 mx-0.5 hidden md:block" />

        {/* Live Save Status Pill */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900/60 border border-zinc-800/60 [html[data-theme='light']_&]:bg-slate-100/80 [html[data-theme='light']_&]:border-slate-300 text-[11px] select-none"
          title="All node edits and layout positions are automatically saved to SQLite"
        >
          {saveStatus === "syncing" ? (
            <>
              <Loader2 className="w-3 h-3 text-amber-400 [html[data-theme='light']_&]:text-amber-600 animate-spin" />
              <span className="text-amber-400/90 [html[data-theme='light']_&]:text-amber-700 font-mono text-[10px]">Syncing</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400 [html[data-theme='light']_&]:text-emerald-600" />
              <span className="text-zinc-400 [html[data-theme='light']_&]:text-slate-700 font-mono text-[10px]">Saved</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

