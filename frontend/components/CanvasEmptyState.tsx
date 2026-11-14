"use client";

import React from "react";
import {
  UploadCloud,
  Search,
  StickyNote,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";

interface CanvasEmptyStateProps {
  onUploadPdf: () => void;
  onOpenDiscovery: () => void;
  onAddNote: () => void;
}

export function CanvasEmptyState({
  onUploadPdf,
  onOpenDiscovery,
  onAddNote,
}: CanvasEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none z-10">
      <div className="monochrome-card w-full max-w-lg p-6 rounded-3xl shadow-2xl text-center space-y-5 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6 text-current" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-current flex items-center justify-center gap-2">
            <span>Research Graph is Empty</span>
            <Sparkles className="w-4 h-4 text-current" />
          </h2>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Ingest scientific papers, connect multiple publications to synthesize
            findings, and simulate experimental benchmarks in a safe sandbox.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Action 1: Upload PDF */}
          <button
            onClick={onUploadPdf}
            className="monochrome-card flex flex-col items-center justify-center p-3.5 rounded-2xl text-center transition group cursor-pointer shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-4 h-4 text-current" />
            </div>
            <span className="text-xs font-semibold text-current">Upload PDF</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Drag & drop files</span>
          </button>

          {/* Action 2: Discovery Hub */}
          <button
            onClick={onOpenDiscovery}
            className="monochrome-card flex flex-col items-center justify-center p-3.5 rounded-2xl text-center transition group cursor-pointer shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Search className="w-4 h-4 text-current" />
            </div>
            <span className="text-xs font-semibold text-current">Discovery Hub</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Search OpenAlex</span>
          </button>

          {/* Action 3: Add Note */}
          <button
            onClick={onAddNote}
            className="monochrome-card flex flex-col items-center justify-center p-3.5 rounded-2xl text-center transition group cursor-pointer shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <StickyNote className="w-4 h-4 text-current" />
            </div>
            <span className="text-xs font-semibold text-current">Add Note</span>
            <span className="text-[10px] text-zinc-400 mt-0.5">Human thoughts</span>
          </button>
        </div>

        <div className="pt-2 border-t border-white/10 [html[data-theme='light']_&]:border-black/10 text-[11px] text-zinc-400 flex items-center justify-center gap-1.5">
          <span>Tip: You can also drop any PDF anywhere onto the canvas.</span>
        </div>
      </div>
    </div>
  );
}

