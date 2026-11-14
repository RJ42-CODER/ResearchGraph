"use client";

import React from "react";
import {
  LayoutDashboard,
  Network,
  BookOpen,
  FlaskConical,
  Bot,
  ChevronLeft,
  ChevronRight,
  Layers,
  Database,
  Settings,
} from "lucide-react";

export type AppViewKind = "graph" | "home" | "library" | "experiments" | "agents";

interface SidebarNavProps {
  currentView: AppViewKind;
  onSelectView: (view: AppViewKind) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  nodeCount: number;
  paperCount: number;
  experimentCount: number;
  isAgentBusy: boolean;
  activeProjectName?: string;
  onOpenNewProjectModal?: () => void;
  onOpenSettings?: () => void;
  onOpenMemory?: () => void;
}

export function SidebarNav({
  currentView,
  onSelectView,
  isCollapsed,
  onToggleCollapse,
  nodeCount,
  paperCount,
  experimentCount,
  isAgentBusy,
  onOpenSettings,
  onOpenMemory,
}: SidebarNavProps) {
  const navItems = [
    {
      id: "graph" as AppViewKind,
      label: "Knowledge Graph",
      icon: Network,
      badge: nodeCount > 0 ? String(nodeCount) : undefined,
      description: "Interactive canvas & synthesis graph",
    },
    {
      id: "home" as AppViewKind,
      label: "Home Dashboard",
      icon: LayoutDashboard,
      description: "Overview, quick actions & stats",
    },
    {
      id: "library" as AppViewKind,
      label: "Research Library",
      icon: BookOpen,
      badge: paperCount > 0 ? String(paperCount) : undefined,
      description: "Structured paper catalog & metadata",
    },
    {
      id: "experiments" as AppViewKind,
      label: "Experiments Lab",
      icon: FlaskConical,
      badge: experimentCount > 0 ? String(experimentCount) : undefined,
      description: "Simulation sandbox & domain metrics",
    },
    {
      id: "agents" as AppViewKind,
      label: "AI Agent Activity",
      icon: Bot,
      isPulse: isAgentBusy,
      description: "Multi-agent pipeline & task status",
    },
  ];

  return (
    <aside
      className={`h-full bg-black dark:bg-black border-r border-white/15 dark:border-white/15 flex flex-col shrink-0 select-none z-30 transition-[width] duration-200 ease-in-out ${
        isCollapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-white/15 flex items-center justify-between shrink-0">
        <div
          onClick={() => onSelectView("home")}
          className="flex items-center gap-2.5 cursor-pointer overflow-hidden group"
          title="Go to Home Dashboard"
        >
          <div className="w-8 h-8 rounded-xl bg-white text-black dark:bg-white dark:text-black [html[data-theme='light']_&]:bg-black [html[data-theme='light']_&]:text-white flex items-center justify-center font-bold shadow-md shrink-0 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <span className="brand-heading-text text-sm tracking-tight flex items-center gap-1">
                ResearchGraph
              </span>
              <span className="text-[10px] text-zinc-500 block -mt-0.5 font-mono">
                Studio v2.0
              </span>
            </div>
          )}
        </div>

        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-zinc-400 hover:text-white dark:hover:text-black hover:bg-white/[0.08] transition cursor-pointer"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav Navigation Links */}
      <div className="flex-1 py-4 px-2.5 space-y-1.5 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center rounded-xl transition-all cursor-pointer relative group ${
                isCollapsed
                  ? "justify-center h-11 px-0"
                  : "justify-between px-3 py-2.5"
              } ${
                isActive
                  ? "sidebar-nav-pill-active"
                  : "sidebar-nav-pill-inactive"
              }`}
              title={isCollapsed ? `${item.label} (${item.description})` : undefined}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0 flex items-center justify-center">
                  <Icon className="w-4 h-4 transition-colors" />
                  {item.isPulse && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white dark:bg-white [html[data-theme='light']_&]:bg-black animate-ping" />
                  )}
                </div>

                {!isCollapsed && (
                  <span
                    className={`text-xs truncate ${
                      isActive ? "font-semibold" : "font-medium"
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </div>

              {!isCollapsed && item.badge && (
                <span className="pill-badge text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 border">
                  {item.badge}
                </span>
              )}

              {/* Collapsed Active Indicator Pill */}
              {isCollapsed && isActive && (
                <span className="collapsed-indicator absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Memory & Settings Quick Actions */}
      <div className="px-2.5 py-2 border-t border-white/10 space-y-1 shrink-0">
        <button
          type="button"
          onClick={onOpenMemory}
          className={`sidebar-nav-pill-inactive w-full flex items-center rounded-xl transition cursor-pointer text-xs ${
            isCollapsed
              ? "justify-center h-10 px-0"
              : "justify-start gap-3 px-3 py-2"
          }`}
          title="Research & Vector Memory"
        >
          <Database className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="font-medium truncate">Research Memory</span>}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`sidebar-nav-pill-inactive w-full flex items-center rounded-xl transition cursor-pointer text-xs ${
            isCollapsed
              ? "justify-center h-10 px-0"
              : "justify-start gap-3 px-3 py-2"
          }`}
          title="Studio Preferences"
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="font-medium truncate">Studio Settings</span>}
        </button>
      </div>

      {/* Footer Area: Clean Minimal Collapse / Expand Toggle */}
      <div className="sidebar-collapse-footer p-2 border-t border-white/10 flex items-center justify-center shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-2 p-2 rounded-xl text-zinc-400 hover:text-white dark:hover:text-black hover:bg-white/[0.08] transition cursor-pointer text-xs ${
            isCollapsed ? "justify-center" : "justify-start px-3"
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-[11px] font-medium">Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
