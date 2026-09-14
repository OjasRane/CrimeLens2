"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { triggerHaptic } from "@/lib/haptics";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Keep the server render and the first client render identical. next-themes
  // only has access to the resolved theme after hydration.
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic("light");
        setTheme(isDark ? "light" : "dark");
      }}
      className="flex whitespace-nowrap h-11 w-11 items-center justify-center border-2 border-[var(--ink)] bg-[var(--panel)] px-0 font-mono text-[10px] uppercase shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none md:w-auto md:px-3 md:text-xs md:shadow-[4px_4px_0_var(--ink)]"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span className="md:hidden">
        {mounted ? (isDark ? "[ D ]" : "[ L ]") : "[ - ]"}
      </span>
      <span className="hidden md:inline">
        {mounted ? (isDark ? "[ DARK ]" : "[ LIGHT ]") : "[ ---- ]"}
      </span>
    </button>
  );
}
