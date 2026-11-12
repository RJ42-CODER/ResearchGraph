"use client";

import React from "react";
import { Terminal, CheckCircle2, AlertCircle } from "lucide-react";
import { ResizableNodeFrame, ScrollableNodeBody } from "./ResizableNodeFrame";

export interface CodeExperimentData {
  status?: "success" | "failed" | string;
  label?: string;
  codeSnippet?: string;
  metric?: string;
  [key: string]: unknown;
}

export function CodeExperimentNode({
  data,
  selected,
}: {
  data: CodeExperimentData;
  selected?: boolean;
}) {
  const isSuccess = data.status === "success";

  return (
    <ResizableNodeFrame
      selected={selected}
      minWidth={260}
      minHeight={160}
      accentColor="#06b6d4"
      handleClassName="!bg-cyan-500 !w-3 !h-3 !border-2 !border-zinc-950"
      className="rounded-xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md transition-colors hover:border-zinc-700 text-left"
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80 shrink-0 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 text-cyan-400">
          <Terminal className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">Experiment</span>
        </div>
        {isSuccess ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-800/40">
            <CheckCircle2 className="w-3 h-3" /> Passed
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-800/40">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        )}
      </div>

      <p className="mt-2 text-xs font-medium text-zinc-200 shrink-0">
        {data.label || "Benchmark Run"}
      </p>

      <ScrollableNodeBody
        allowHorizontal
        className="mt-1.5 p-2 rounded-lg bg-zinc-900 border border-zinc-800/80 font-mono text-[11px] text-zinc-300"
      >
        <pre className="m-0 whitespace-pre font-mono">
          <code>{data.codeSnippet || "python test.py"}</code>
        </pre>
      </ScrollableNodeBody>

      <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-900 text-[11px] text-zinc-400 shrink-0">
        <span>Result: <span className="font-semibold text-zinc-200">{data.metric || "Completed"}</span></span>
      </div>
    </ResizableNodeFrame>
  );
}
