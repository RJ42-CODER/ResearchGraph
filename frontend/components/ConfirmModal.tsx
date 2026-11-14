"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md glass-panel-mono rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isDestructive
                  ? "bg-rose-950/60 border-rose-800/60 text-rose-400"
                  : "bg-amber-950/60 border-amber-800/60 text-amber-400"
              }`}
            >
              {isDestructive ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-white/10 [html[data-theme='light']_&]:border-black/10 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="btn-glass-mono px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm active:scale-95 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-500 text-white"
                : "btn-primary-mono"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

