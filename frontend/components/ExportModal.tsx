"use client";

import React, { useState } from "react";
import {
  Download,
  X,
  FileText,
  BookOpen,
  CheckCircle2,
  Loader2,
  FileDown,
  Layers,
  Sparkles,
} from "lucide-react";
import { Node } from "@xyflow/react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId: string;
  activeProjectName: string;
  nodes: Node[];
  backendUrl?: string;
  onExportSuccess: (msg: string) => void;
}

export function ExportModal({
  isOpen,
  onClose,
  activeProjectId,
  activeProjectName,
  nodes,
  backendUrl = "http://localhost:8000",
  onExportSuccess,
}: ExportModalProps) {
  const [downloadingFormat, setDownloadingFormat] = useState<
    "markdown" | "bibtex" | null
  >(null);

  if (!isOpen) return null;

  // Breakdown counts
  const paperCount = nodes.filter(
    (n) =>
      n.type === "uploadedPaper" ||
      n.type === "discovery" ||
      n.id.startsWith("paper") ||
      n.id.startsWith("discovery")
  ).length;

  const noteCount = nodes.filter(
    (n) => n.type === "note" || n.id.startsWith("note") || n.data?.type === "note"
  ).length;

  const synthCount = nodes.filter(
    (n) =>
      (n.type === "synth" ||
        n.type === "synthesisResult" ||
        n.id.startsWith("synth")) &&
      n.data?.taskMode !== "gaps"
  ).length;

  const gapCount = nodes.filter(
    (n) =>
      n.type === "gap" ||
      n.type === "researchGap" ||
      n.id.startsWith("gap") ||
      n.data?.taskMode === "gaps" ||
      Boolean(n.data?.gaps_summary)
  ).length;

  const experimentCount = nodes.filter(
    (n) =>
      n.type === "experiment" ||
      n.type === "result" ||
      n.id.startsWith("exp") ||
      n.id.startsWith("result")
  ).length;

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: "markdown" | "bibtex") => {
    setDownloadingFormat(format);
    const cleanProjectName = (activeProjectName || "ResearchGraph")
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .replace(/[\s\-]+/g, "_");

    try {
      // 1. Try server-side export first
      const res = await fetch(
        `${backendUrl}/api/workspace/export?project_id=${encodeURIComponent(
          activeProjectId
        )}&format=${format}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.content && data.filename) {
          triggerDownload(
            data.filename,
            data.content,
            format === "bibtex" ? "application/x-bibtex" : "text/markdown"
          );
          onExportSuccess(
            `Exported ${format === "bibtex" ? "BibTeX" : "Markdown"} dossier successfully!`
          );
          onClose();
          return;
        }
      }
      throw new Error("Server export returned empty content");
    } catch (err) {
      console.warn("Server export failed, using instant client-side generator:", err);
      // 2. Client-side fallback ensures 100% guarantee of download
      if (format === "markdown") {
        const content = generateClientMarkdown(activeProjectName, nodes);
        triggerDownload(
          `${cleanProjectName}_dossier.md`,
          content,
          "text/markdown"
        );
        onExportSuccess("Exported Markdown dossier successfully!");
      } else {
        const content = generateClientBibtex(activeProjectName, nodes);
        triggerDownload(
          `${cleanProjectName}_citations.bib`,
          content,
          "application/x-bibtex"
        );
        onExportSuccess("Exported BibTeX citations successfully!");
      }
      onClose();
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl glass-panel-mono border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 [html[data-theme='light']_&]:border-black/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
              <Download className="w-4 h-4 text-current" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-current">
                Export Workspace
              </h3>
              <p className="text-xs text-zinc-400">
                {activeProjectName} ({nodes.length} total artifacts)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-current transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Workspace Artifact Breakdown Pill Banner */}
          <div className="monochrome-card p-3 rounded-xl flex items-center justify-between flex-wrap gap-2 text-[11px]">
            <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-current" /> Included Artifacts:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 [html[data-theme='light']_&]:bg-emerald-50 [html[data-theme='light']_&]:text-emerald-950 [html[data-theme='light']_&]:border-emerald-200">
                {paperCount} Papers
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/60 [html[data-theme='light']_&]:bg-amber-50 [html[data-theme='light']_&]:text-amber-950 [html[data-theme='light']_&]:border-amber-200">
                {noteCount} Notes
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/60 [html[data-theme='light']_&]:bg-purple-50 [html[data-theme='light']_&]:text-purple-950 [html[data-theme='light']_&]:border-purple-200">
                {synthCount} Syntheses
              </span>
              <span className="px-2 py-0.5 rounded-md bg-orange-950/80 text-orange-300 border border-orange-800/60 [html[data-theme='light']_&]:bg-orange-50 [html[data-theme='light']_&]:text-orange-950 [html[data-theme='light']_&]:border-orange-200">
                {gapCount} Gaps
              </span>
              <span className="px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 [html[data-theme='light']_&]:bg-cyan-50 [html[data-theme='light']_&]:text-cyan-950 [html[data-theme='light']_&]:border-cyan-200">
                {experimentCount} Experiments
              </span>
            </div>
          </div>

          {/* Export Options Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Markdown Dossier Card */}
            <div className="monochrome-card p-4 rounded-xl flex flex-col justify-between gap-3 group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-current" />
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20 font-semibold">
                    .MD
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-current transition-colors">
                  Research Dossier
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Publication-ready markdown document detailing connected literature,
                  notes, cross-reference synthesis, research gaps, and verified simulation code.
                </p>
              </div>

              <button
                onClick={() => handleExport("markdown")}
                disabled={downloadingFormat !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white [html[data-theme='light']_&]:hover:bg-black/85 active:scale-95 text-xs transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {downloadingFormat === "markdown" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Dossier</span>
                  </>
                )}
              </button>
            </div>

            {/* BibTeX Bibliography Card */}
            <div className="monochrome-card p-4 rounded-xl flex flex-col justify-between gap-3 group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:text-black flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-current" />
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20 font-semibold">
                    .BIB
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-current transition-colors">
                  Bibliography Citations
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Standard BibTeX citations for all papers with computed cite keys,
                  authors, titles, DOIs, and URLs ready for LaTeX, Overleaf, and Zotero.
                </p>
              </div>

              <button
                onClick={() => handleExport("bibtex")}
                disabled={downloadingFormat !== null}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white [html[data-theme='light']_&]:hover:bg-black/85 active:scale-95 text-xs transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {downloadingFormat === "bibtex" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download BibTeX</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-white/10 [html[data-theme='light']_&]:border-black/10 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-current" /> Fast instant export
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl border transition cursor-pointer bg-white/10 text-white border-white/20 hover:bg-white/20 [html[data-theme='light']_&]:bg-black/5 [html[data-theme='light']_&]:text-black [html[data-theme='light']_&]:border-black/20 [html[data-theme='light']_&]:hover:bg-black/10 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Client-side instant fallbacks (ensures 100% offline & robust functionality)
function generateClientMarkdown(projectName: string, nodes: Node[]): string {
  const papers = nodes.filter(
    (n) =>
      n.type === "uploadedPaper" ||
      n.type === "discovery" ||
      n.id.startsWith("paper") ||
      n.id.startsWith("discovery")
  );
  const notes = nodes.filter(
    (n) => n.type === "note" || n.id.startsWith("note") || n.data?.type === "note"
  );
  const synths = nodes.filter(
    (n) =>
      (n.type === "synth" ||
        n.type === "synthesisResult" ||
        n.id.startsWith("synth")) &&
      n.data?.taskMode !== "gaps"
  );
  const gaps = nodes.filter(
    (n) =>
      n.type === "gap" ||
      n.type === "researchGap" ||
      n.id.startsWith("gap") ||
      n.data?.taskMode === "gaps" ||
      Boolean(n.data?.gaps_summary)
  );
  const experiments = nodes.filter(
    (n) =>
      n.type === "experiment" ||
      n.type === "result" ||
      n.id.startsWith("exp") ||
      n.id.startsWith("result")
  );

  let md = `# Research Dossier: ${projectName || "Research Workspace"}\n`;
  md += `*Exported from ResearchGraph on ${new Date().toLocaleDateString()}*\n\n`;
  md += `## Workspace Summary\n`;
  md += `This workspace integrates **${nodes.length} research artifacts**: ${papers.length} Papers, ${notes.length} Notes, ${synths.length} Syntheses, ${gaps.length} Gaps, and ${experiments.length} Experiments.\n\n---\n\n`;

  // 1. Papers
  md += `## 1. Connected Literature & Papers (${papers.length})\n\n`;
  if (papers.length === 0) {
    md += `*No papers connected in this workspace.*\n\n`;
  } else {
    papers.forEach((p, idx) => {
      const d = p.data || {};
      const title = d.title || d.label || p.id;
      const authors = Array.isArray(d.authors)
        ? d.authors.join(", ")
        : d.authors || "Not specified";
      md += `### 1.${idx + 1} ${title}\n`;
      md += `- **ID**: \`${p.id}\`\n`;
      md += `- **Authors**: ${authors}\n`;
      if (d.year) md += `- **Year**: ${d.year}\n`;
      if (d.doi) md += `- **DOI**: [${d.doi}](https://doi.org/${d.doi})\n`;
      const url = d.landing_page_url || d.pdf_url || d.url;
      if (url) md += `- **Document Link**: [Access Document](${url})\n`;
      const abs = d.abstract || d.summary;
      if (abs) md += `\n> **Abstract / Overview**:\n> ${abs.toString().trim()}\n\n`;
    });
  }

  // 2. Notes
  md += `---\n\n## 2. Research Notes (${notes.length})\n\n`;
  if (notes.length === 0) {
    md += `*No research notes recorded.*\n\n`;
  } else {
    notes.forEach((n, idx) => {
      const d = n.data || {};
      md += `### 2.${idx + 1} 📝 ${d.title || d.label || `Note #${idx + 1}`}\n`;
      md += `${(d.text || d.content || d.summary || "*Empty note*").toString().trim()}\n\n`;
    });
  }

  // 3. Syntheses & Gaps
  md += `---\n\n## 3. Cross-Paper Syntheses & Research Gaps\n\n`;
  if (synths.length > 0) {
    md += `### Multi-Paper Syntheses\n`;
    synths.forEach((s, idx) => {
      const d = s.data || {};
      md += `#### 3.A.${idx + 1} 🔬 ${d.title || d.label || `Synthesis #${idx + 1}`}\n`;
      md += `${(d.comparison_summary || d.summary || "").toString().trim()}\n\n`;
    });
  }
  if (gaps.length > 0) {
    md += `### Identified Research Gaps\n`;
    gaps.forEach((g, idx) => {
      const d = g.data || {};
      md += `#### 3.B.${idx + 1} 🧩 ${d.title || d.label || `Research Gap #${idx + 1}`}\n`;
      if (d.contradictions) md += `**Contradictions**:\n${d.contradictions}\n\n`;
      if (d.limitations) md += `**Limitations**:\n${d.limitations}\n\n`;
      if (d.future_directions) md += `**Future Directions**:\n${d.future_directions}\n\n`;
      if (d.gaps_summary && !d.contradictions) md += `${d.gaps_summary.toString().trim()}\n\n`;
    });
  }

  // 4. Experiments
  md += `---\n\n## 4. Sandbox Experiments & Benchmarks (${experiments.length})\n\n`;
  if (experiments.length === 0) {
    md += `*No sandbox experiments executed.*\n\n`;
  } else {
    experiments.forEach((e, idx) => {
      const d = e.data || {};
      md += `### 4.${idx + 1} ⚡ ${d.label || d.goal || `Experiment #${idx + 1}`}\n`;
      md += `- **Status**: \`${(d.status || "SUCCESS").toString().toUpperCase()}\`\n`;
      if (d.primaryMetric || d.metric) {
        md += `- **Primary Domain Metric**: \`${d.primaryMetric || d.metric}\`\n`;
      }
      if (d.optimized_ms) {
        md += `- **Latency**: Proposed ${d.optimized_ms}ms vs Baseline ${d.baseline_ms || "N/A"}ms (${d.speedup || "Validated"})\n`;
      }
      if (d.summary) md += `- **Analysis**: ${d.summary}\n`;
      if (d.code) {
        md += `\n\`\`\`python\n${d.code.toString().trim()}\n\`\`\`\n\n`;
      }
    });
  }

  md += `---\n\n*Export generated with ResearchGraph • Traceable Citations & Cross-Paper Analysis*\n`;
  return md;
}

function generateClientBibtex(projectName: string, nodes: Node[]): string {
  const papers = nodes.filter(
    (n) =>
      n.type === "uploadedPaper" ||
      n.type === "discovery" ||
      n.id.startsWith("paper") ||
      n.id.startsWith("discovery")
  );

  let bib = `% ====================================================================\n`;
  bib += `% BibTeX Bibliography Export - ResearchGraph\n`;
  bib += `% Project: ${projectName || "Research Workspace"}\n`;
  bib += `% Export Date: ${new Date().toISOString()}\n`;
  bib += `% Total References: ${papers.length}\n`;
  bib += `% ====================================================================\n\n`;

  if (papers.length === 0) {
    bib += `% No papers found in this workspace.\n`;
    return bib;
  }

  papers.forEach((p, idx) => {
    const d = p.data || {};
    const title = (d.title || d.label || p.id).toString().trim();
    let citeKey = `paper_${p.id.slice(0, 8)}`;

    if (d.authors) {
      const firstAuth = String(
        Array.isArray(d.authors)
          ? d.authors[0]
          : d.authors.toString().split(",")[0]
      );
      const authLast =
        firstAuth.split(" ").pop()?.toLowerCase().replace(/[^a-z]/g, "") ||
        "author";
      const year = (d.year || "2024").toString().replace(/[^0-9]/g, "");
      citeKey = `${authLast}${year || "2024"}_ref${idx + 1}`;
    }

    const authors = Array.isArray(d.authors)
      ? d.authors.join(" and ")
      : d.authors || "ResearchGraph Contributor";

    bib += `@article{${citeKey},\n`;
    bib += `  title = {{${title}}},\n`;
    bib += `  author = {${authors}},\n`;
    bib += `  journal = {${d.publication || "ResearchGraph Literature Index"}},\n`;
    bib += `  year = {${d.year || "2024"}},\n`;
    if (d.doi) bib += `  doi = {${d.doi}},\n`;
    const url = d.landing_page_url || d.pdf_url || d.url;
    if (url) bib += `  url = {${url}},\n`;
    if (d.abstract || d.summary) {
      const cleanAbs = String(d.abstract || d.summary)
        .replace(/\s+/g, " ")
        .slice(0, 300);
      bib += `  abstract = {${cleanAbs}...},\n`;
    }
    bib += `  note = {Indexed into ResearchGraph: ${projectName}}\n`;
    bib += `}\n\n`;
  });

  return bib;
}
