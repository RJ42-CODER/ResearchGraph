"use client";

import React, { useState } from "react";
import { FileText, Copy, Check, Table as TableIcon } from "lucide-react";

export interface CitationClickPayload {
  page: string;
  label: string;
}

/**
 * Renders inline math, superscript, code chips, bold phrases, and clickable [Page X] citation badges.
 */
function renderInlineClean(
  line: string,
  onCitationClick?: (citation: CitationClickPayload) => void
): React.ReactNode {
  // Normalize links [text](url) -> text (url)
  const normalized = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Split on code spans `code`
  const codeParts = normalized.split(/(`[^`]+`)/g);

  return codeParts.map((codePart, codeIdx) => {
    if (codePart.startsWith("`") && codePart.endsWith("`") && codePart.length > 2) {
      return (
        <code
          key={codeIdx}
          className="px-1.5 py-0.5 rounded bg-zinc-800 text-cyan-300 font-mono text-[10px] border border-zinc-700/60 [html[data-theme='light']_&]:bg-slate-100 [html[data-theme='light']_&]:text-slate-900 [html[data-theme='light']_&]:border-slate-300"
        >
          {codePart.slice(1, -1)}
        </code>
      );
    }

    // Split on **bold**
    const boldParts = codePart.split(/(\*\*[^*]+\*\*)/g);

    return boldParts.map((boldPart, boldIdx) => {
      if (boldPart.startsWith("**") && boldPart.endsWith("**") && boldPart.length > 4) {
        return (
          <strong key={`${codeIdx}-${boldIdx}`} className="font-semibold text-zinc-100 [html[data-theme='light']_&]:text-slate-950">
            {boldPart.slice(2, -2)}
          </strong>
        );
      }

      const cleaned = boldPart
        .replace(/__(.+?)__/g, "$1")
        .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?]|$)/g, "$1$2");

      // Handle exponential math like 10^(-7) or 10^-7 or x^2
      const mathChunks = cleaned.split(/(\b\w+\^\(?[-+]?\w+\)?)/g);

      return mathChunks.map((chunk, mIdx) => {
        const supMatch = chunk.match(/^(\w+)\^\(?([-+]?\w+)\)?$/);
        if (supMatch) {
          return (
            <span key={`${codeIdx}-${boldIdx}-${mIdx}`} className="font-mono text-zinc-200">
              {supMatch[1]}
              <sup className="text-[9px] text-cyan-300 ml-0.5">{supMatch[2]}</sup>
            </span>
          );
        }

        // Split on [Page X] or [Abstract] citation tags
        const citationChunks = chunk.split(/(\[(?:Page\s*\d+|Abstract)\])/gi);

        return (
          <React.Fragment key={`${codeIdx}-${boldIdx}-${mIdx}`}>
            {citationChunks.map((cChunk, cIdx) => {
              const match = cChunk.match(/^\[(?:Page\s*(\d+)|(Abstract))\]$/i);
              if (match) {
                const pageNum = match[1] || "Abstract";
                if (onCitationClick) {
                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCitationClick({ page: pageNum, label: cChunk });
                      }}
                      className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 hover:text-indigo-100 hover:border-indigo-400 [html[data-theme='light']_&]:bg-indigo-50 [html[data-theme='light']_&]:text-indigo-950 [html[data-theme='light']_&]:border-indigo-200 [html[data-theme='light']_&]:hover:bg-indigo-100 [html[data-theme='light']_&]:hover:border-indigo-400 active:scale-95 transition-all cursor-pointer shadow-xs select-none align-baseline"
                      title={`Click to inspect traceable citation for ${cChunk}`}
                    >
                      <FileText className="w-2.5 h-2.5 text-indigo-400 [html[data-theme='light']_&]:text-indigo-700 shrink-0" />
                      <span>{cChunk}</span>
                    </button>
                  );
                }
                return (
                  <span
                    key={cIdx}
                    className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 [html[data-theme='light']_&]:bg-indigo-50 [html[data-theme='light']_&]:text-indigo-950 [html[data-theme='light']_&]:border-indigo-200 select-none align-baseline"
                  >
                    <FileText className="w-2.5 h-2.5 text-indigo-400 [html[data-theme='light']_&]:text-indigo-700 shrink-0" />
                    <span>{cChunk}</span>
                  </span>
                );
              }
              return <React.Fragment key={cIdx}>{cChunk}</React.Fragment>;
            })}
          </React.Fragment>
        );
      });
    });
  });
}

interface TableBlock {
  type: "table";
  headers: string[];
  alignments: ("left" | "center" | "right")[];
  rows: string[][];
}

interface HeadingBlock {
  type: "heading";
  content: string;
}

interface ParagraphBlock {
  type: "paragraph";
  content: string;
}

interface EmptyBlock {
  type: "empty";
}

type ParsedBlock = TableBlock | HeadingBlock | ParagraphBlock | EmptyBlock;

const SEPARATOR_REGEX = /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/;

function parseMarkdownBlocks(text: string): ParsedBlock[] {
  const lines = text.replace(/```[a-zA-Z0-9_-]*\n?/g, "").split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;

  const parseCells = (rowStr: string): string[] => {
    let clean = rowStr.trim();
    if (clean.startsWith("|")) clean = clean.slice(1);
    if (clean.endsWith("|")) clean = clean.slice(0, -1);
    return clean.split("|").map((c) => c.trim());
  };

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check if line begins a Markdown table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      SEPARATOR_REGEX.test(lines[i + 1].trim())
    ) {
      const headers = parseCells(trimmed);
      const sepCells = parseCells(lines[i + 1].trim());
      const alignments = sepCells.map((sep) => {
        const leftColon = sep.startsWith(":");
        const rightColon = sep.endsWith(":");
        if (leftColon && rightColon) return "center" as const;
        if (rightColon) return "right" as const;
        return "left" as const;
      });

      i += 2;
      const rows: string[][] = [];
      let pendingCells: string[] = [];

      while (i < lines.length) {
        const rowTrimmed = lines[i].trim();
        // Stop table collection on empty line or start of another table
        if (!rowTrimmed) break;
        if (
          i + 1 < lines.length &&
          SEPARATOR_REGEX.test(lines[i + 1].trim()) &&
          rowTrimmed.includes("|")
        ) {
          break;
        }

        if (rowTrimmed.includes("|")) {
          if (SEPARATOR_REGEX.test(rowTrimmed)) {
            i++;
            continue;
          }
          const cells = parseCells(rowTrimmed);

          // Handle multiline wrapped cells from LLMs (e.g. 0.0 | or wrapped columns)
          if (pendingCells.length > 0 && pendingCells.length < headers.length) {
            pendingCells.push(...cells);
            if (pendingCells.length >= headers.length) {
              rows.push(pendingCells.slice(0, headers.length));
              pendingCells = [];
            }
          } else {
            if (pendingCells.length > 0) {
              while (pendingCells.length < headers.length) pendingCells.push("");
              rows.push(pendingCells.slice(0, headers.length));
            }
            if (cells.length < headers.length) {
              pendingCells = cells;
            } else {
              rows.push(cells.slice(0, headers.length));
              pendingCells = [];
            }
          }
          i++;
        } else {
          // Wrapped plain text line belonging to the previous cell
          if (pendingCells.length > 0) {
            pendingCells[pendingCells.length - 1] += " " + rowTrimmed;
            i++;
          } else {
            break;
          }
        }
      }

      if (pendingCells.length > 0) {
        while (pendingCells.length < headers.length) pendingCells.push("");
        rows.push(pendingCells.slice(0, headers.length));
      }

      blocks.push({
        type: "table",
        headers,
        alignments,
        rows,
      });
      continue;
    }

    // Check for Headings (# Heading)
    const headingMatch = rawLine.match(/^\s*#{1,6}\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        content: headingMatch[1],
      });
      i++;
      continue;
    }

    // Check for empty lines
    if (!trimmed) {
      blocks.push({ type: "empty" });
      i++;
      continue;
    }

    // Normal paragraph line
    const bulletLine = rawLine.replace(/^(\s*)\*\s+/, "$1- ");
    blocks.push({
      type: "paragraph",
      content: bulletLine,
    });
    i++;
  }

  return blocks;
}

function FormattedTable({
  table,
  onCitationClick,
}: {
  table: TableBlock;
  onCitationClick?: (citation: CitationClickPayload) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyTable = () => {
    const headerRow = `| ${table.headers.join(" | ")} |`;
    const sepRow = `| ${table.headers.map(() => "---").join(" | ")} |`;
    const bodyRows = table.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
    const markdown = `${headerRow}\n${sepRow}\n${bodyRows}`;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/90 shadow-xl backdrop-blur-sm">
      {/* Table Header Pill Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800/80 text-[10px] text-zinc-400">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <TableIcon className="w-3 h-3 text-cyan-400" />
          <span>
            Structured Data ({table.rows.length} {table.rows.length === 1 ? "row" : "rows"})
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopyTable}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700/90 text-zinc-300 hover:text-zinc-100 transition-colors text-[10px] cursor-pointer"
          title="Copy table to clipboard as Markdown"
        >
          {copied ? (
            <>
              <Check className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-emerald-300">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-2.5 h-2.5 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto no-scrollbar max-w-full">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800/90 bg-zinc-900/50">
              {table.headers.map((h, hIdx) => (
                <th
                  key={hIdx}
                  style={{
                    textAlign: table.alignments[hIdx] || "left",
                  }}
                  className="px-3 py-2 font-semibold text-zinc-200 text-[11px] uppercase tracking-wider font-mono whitespace-nowrap border-r border-zinc-800/40 last:border-r-0"
                >
                  {renderInlineClean(h, onCitationClick)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 font-sans">
            {table.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={`hover:bg-zinc-800/40 transition-colors ${
                  rIdx % 2 === 1 ? "bg-zinc-900/25" : "bg-zinc-950/40"
                }`}
              >
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    style={{
                      textAlign: table.alignments[cIdx] || "left",
                    }}
                    className="px-3 py-2 text-zinc-300 text-[11px] leading-relaxed align-top border-r border-zinc-800/30 last:border-r-0"
                  >
                    {cell.trim() ? (
                      renderInlineClean(cell, onCitationClick)
                    ) : (
                      <span className="text-zinc-600 font-mono text-[10px]">
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FormattedPlainText({
  text,
  className = "",
  onCitationClick,
}: {
  text: string;
  className?: string;
  onCitationClick?: (citation: CitationClickPayload) => void;
}) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, idx) => {
        if (block.type === "empty") {
          return <div key={idx} className="h-2" />;
        }

        if (block.type === "heading") {
          return (
            <div key={idx} className="font-semibold text-zinc-100 mt-2 mb-1">
              {renderInlineClean(block.content, onCitationClick)}
            </div>
          );
        }

        if (block.type === "table") {
          return (
            <FormattedTable
              key={idx}
              table={block}
              onCitationClick={onCitationClick}
            />
          );
        }

        return (
          <div key={idx}>
            {renderInlineClean(block.content, onCitationClick)}
          </div>
        );
      })}
    </div>
  );
}
