"use client";

import { useEffect, useState } from "react";

/** Re-renders non-CSS renderers (React Flow, Mapbox) after a theme change. */
export function useThemeVersion() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((current) => current + 1);
    window.addEventListener("fatal-theme-change", refresh);
    return () => window.removeEventListener("fatal-theme-change", refresh);
  }, []);

  return version;
}

export function themeColor(token: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}
