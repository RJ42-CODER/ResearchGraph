"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, Position } from "@xyflow/react";

interface ResizableNodeFrameProps {
  selected?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  accentColor?: string;
  handleClassName?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared frame for canvas nodes with drag-to-resize handles (mouse + touch)
 * and left/right connection handles.
 */
export function ResizableNodeFrame({
  selected = false,
  minWidth = 240,
  minHeight = 120,
  maxWidth = 1000,
  maxHeight = 900,
  accentColor = "#818cf8",
  handleClassName = "!bg-indigo-500 !w-3 !h-3 !border-2 !border-zinc-950",
  className = "",
  children,
}: ResizableNodeFrameProps) {
  return (
    <div className={`group/node relative w-full h-full flex flex-col ${className}`}>
      <NodeResizer
        isVisible={true}
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        color={accentColor}
        lineClassName={
          selected
            ? undefined
            : "!border-transparent group-hover/node:!border-zinc-600/50"
        }
        handleClassName={`!w-2.5 !h-2.5 !rounded-sm !border !border-zinc-950 transition-opacity ${
          selected
            ? "!opacity-100"
            : "!opacity-0 group-hover/node:!opacity-80"
        }`}
      />

      <Handle type="target" position={Position.Left} className={handleClassName} />

      {children}

      {/* Subtle corner grip indicator so users can spot resize support before selecting */}
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className={`pointer-events-none absolute bottom-1.5 right-1.5 w-2.5 h-2.5 text-zinc-500 transition-opacity ${
          selected
            ? "opacity-90 text-zinc-300"
            : "opacity-45 group-hover/node:opacity-90"
        }`}
      >
        <path
          d="M11 5L5 11M11 9L9 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      <Handle type="source" position={Position.Right} className={handleClassName} />
    </div>
  );
}

interface ScrollableNodeBodyProps {
  children: React.ReactNode;
  allowHorizontal?: boolean;
  className?: string;
}

/**
 * Scrollable node content region that keeps a visible scrollbar and
 * activates React Flow's nowheel/nodrag/nopan isolation whenever content
 * overflows so wheel, trackpad, touch, and scrollbar drags scroll the box
 * rather than the canvas.
 */
export function ScrollableNodeBody({
  children,
  allowHorizontal = false,
  className = "",
}: ScrollableNodeBodyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const verticalOverflow = el.scrollHeight > el.clientHeight + 1;
    const horizontalOverflow =
      allowHorizontal && el.scrollWidth > el.clientWidth + 1;
    setIsOverflowing(verticalOverflow || horizontalOverflow);
  }, [allowHorizontal]);

  useEffect(() => {
    const el = scrollRef.current;
    const contentEl = contentRef.current;
    if (!el) return;

    checkOverflow();

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });
    observer.observe(el);
    if (contentEl) {
      observer.observe(contentEl);
    }

    return () => observer.disconnect();
  }, [checkOverflow, children]);

  return (
    <div
      ref={scrollRef}
      className={`flex-1 min-h-0 node-scrollbar overscroll-contain ${
        allowHorizontal ? "overflow-auto" : "overflow-y-auto overflow-x-hidden"
      } ${
        isOverflowing
          ? `nowheel nodrag nopan select-text ${
              allowHorizontal ? "touch-auto" : "touch-pan-y"
            }`
          : ""
      } ${className}`}
    >
      <div
        ref={contentRef}
        className={allowHorizontal ? "w-max min-w-full" : "min-w-0"}
      >
        {children}
      </div>
    </div>
  );
}
