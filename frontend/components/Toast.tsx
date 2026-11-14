"use client";

import React from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Sparkles, X } from "lucide-react";

export interface ToastNotification {
  id: string;
  type: "success" | "info" | "error" | "warning";
  title?: string;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";

        const Icon = isSuccess
          ? CheckCircle2
          : isError
          ? AlertCircle
          : isWarning
          ? AlertTriangle
          : Sparkles;

        const borderClass = isSuccess
          ? "border-emerald-700/60 bg-emerald-950/90 text-emerald-200"
          : isError
          ? "border-rose-700/60 bg-rose-950/90 text-rose-200"
          : isWarning
          ? "border-amber-700/60 bg-amber-950/90 text-amber-200"
          : "border-indigo-700/60 bg-indigo-950/90 text-indigo-200";

        const iconColor = isSuccess
          ? "text-emerald-400"
          : isError
          ? "text-rose-400"
          : isWarning
          ? "text-amber-400"
          : "text-indigo-400";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${borderClass}`}
          >
            <div className={`mt-0.5 shrink-0 ${iconColor}`}>
              <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              {toast.title && (
                <h4 className="text-xs font-semibold text-zinc-100 mb-0.5">
                  {toast.title}
                </h4>
              )}
              <p className="text-[11px] text-zinc-300 leading-snug">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-zinc-400 hover:text-zinc-100 p-0.5 rounded transition cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

