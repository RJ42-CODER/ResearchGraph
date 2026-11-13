"use client";

import React from "react";
import { FileText } from "lucide-react";

export interface CitationClickPayload {
  page: string;
  label: string;
}

/**
 * Strips raw Markdown syntax (headings, **bold**, backticks, links) while
 * rendering section titles, bold phrases, and clickable [Page X] citation badges.
 */
function renderInlineClean(
  line: string,
  onCitationClick?: (citation: CitationClickPayload) => void
): React.ReactNode {
  const normalized = line
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/`([^`]+)`/g, "$1");

  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const cleaned = part
      .replace(/__(.+?)__/g, "$1")
      .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,;:!?]|$)/g, "$1$2");

    // Split on [Page X] or [Abstract] citation tags
    const citationChunks = cleaned.split(/(\[(?:Page\s*\d+|Abstract)\])/gi);

    return (
      <React.Fragment key={idx}>
        {citationChunks.map((chunk, cIdx) => {
          const match = chunk.match(/^\[(?:Page\s*(\d+)|(Abstract))\]$/i);
          if (match) {
            const pageNum = match[1] || "Abstract";
            if (onCitationClick) {
              return (
                <button
                  key={cIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCitationClick({ page: pageNum, label: chunk });
                  }}
                  className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/90 text-indigo-300 border border-indigo-700/60 hover:bg-indigo-900 hover:text-indigo-100 hover:border-indigo-400 active:scale-95 transition-all cursor-pointer shadow-xs select-none align-baseline"
                  title={`Click to inspect traceable citation for ${chunk}`}
                >
                  <FileText className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span>{chunk}</span>
                </button>
              );
            }
            return (
              <span
                key={cIdx}
                className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/40 select-none align-baseline"
              >
                <FileText className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                <span>{chunk}</span>
              </span>
            );
          }
          return <React.Fragment key={cIdx}>{chunk}</React.Fragment>;
        })}
      </React.Fragment>
    );
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
      while (i < lines.length && lines[i].trim().includes("|")) {
        const rowTrimmed = lines[i].trim();
        // Skip duplicate separator rows if any
        if (SEPARATOR_REGEX.test(rowTrimmed)) {
          i++;
          continue;
        }
        const cells = parseCells(rowTrimmed);
        while (cells.length < headers.length) {
          cells.push("");
        }
        rows.push(cells.slice(0, headers.length));
        i++;
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
            <div
              key={idx}
              className="my-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80 shadow-md"
            >
              <div className="overflow-x-auto no-scrollbar max-w-full">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/90">
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          style={{
                            textAlign: block.alignments[hIdx] || "left",
                          }}
                          className="px-3 py-2 font-semibold text-zinc-200 text-[11px] uppercase tracking-wider font-mono whitespace-nowrap"
                        >
                          {renderInlineClean(h, onCitationClick)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-sans">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`hover:bg-zinc-800/40 transition-colors ${
                          rIdx % 2 === 1 ? "bg-zinc-900/30" : "bg-transparent"
                        }`}
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              textAlign: block.alignments[cIdx] || "left",
                            }}
                            className="px-3 py-2 text-zinc-300 text-[11px] leading-relaxed align-top"
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

        return (
          <div key={idx}>
            {renderInlineClean(block.content, onCitationClick)}
          </div>
        );
      })}
    </div>
  );
}
