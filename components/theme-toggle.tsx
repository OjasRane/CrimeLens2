"use client";

import { MonitorCog } from "lucide-react";
import { applyTheme, getDocumentTheme } from "@/lib/theme";

export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(getDocumentTheme() === "terminal" ? "archive" : "terminal");
      }}
      className="theme-toggle flex h-11 items-center gap-2 border-2 border-[var(--line)] bg-[var(--background)] px-3 font-mono text-xs font-black uppercase text-[var(--foreground)] shadow-[4px_4px_0_var(--shadow)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none"
      aria-label="Toggle Archive and Terminal themes"
    >
      <MonitorCog aria-hidden="true" size={18} strokeWidth={2.5} />
      <span className="theme-toggle__archive">Archive</span>
      <span className="theme-toggle__terminal">Terminal</span>
    </button>
  );
}
