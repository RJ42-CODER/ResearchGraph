"use client";

import React from "react";

/**
 * Strips raw Markdown syntax (headings, **bold**, backticks, links) while
 * rendering section titles and bold phrases cleanly without asterisks.
 */
function renderInlineClean(line: string): React.ReactNode {
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
    return <React.Fragment key={idx}>{cleaned}</React.Fragment>;
  });
}

export function FormattedPlainText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const lines = text.replace(/```[a-zA-Z0-9_-]*\n?/g, "").split("\n");

  return (
    <div className={className}>
      {lines.map((rawLine, idx) => {
        const headingMatch = rawLine.match(/^\s*#{1,6}\s+(.*)$/);
        if (headingMatch) {
          return (
            <div key={idx} className="font-semibold text-zinc-100">
              {renderInlineClean(headingMatch[1])}
            </div>
          );
        }

        const bulletLine = rawLine.replace(/^(\s*)\*\s+/, "$1- ");
        if (!bulletLine.trim()) {
          return <div key={idx} className="h-2" />;
        }

        return <div key={idx}>{renderInlineClean(bulletLine)}</div>;
      })}
    </div>
  );
}

