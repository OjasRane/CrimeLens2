"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useOthers } from "@/lib/liveblocks";

type LiveCursorProps = {
  x: number;
  y: number;
  agentId: string;
};

export function LiveCursor({ x, y, agentId }: LiveCursorProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[110]"
      initial={false}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.28 }}
      aria-hidden="true"
    >
      <svg
        width="24"
        height="30"
        viewBox="0 0 24 30"
        fill="none"
        className={isDark ? "drop-shadow-[0_0_5px_#00FF41]" : ""}
      >
        <path
          d="M2 2L21 16H12.25L8.25 27L3.75 25.25L7.5 15H2V2Z"
          fill={isDark ? "#00FF41" : "#D22B2B"}
          stroke={isDark ? "#00FF41" : "#000000"}
          strokeWidth={isDark ? 1 : 2}
          strokeLinejoin="miter"
        />
      </svg>
      <span
        className={
          isDark
            ? "ml-4 -mt-1 block w-max border border-[#00FF41] bg-[var(--paper)] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#00FF41] drop-shadow-[0_0_5px_#00FF41]"
            : "ml-4 -mt-1 block w-max border-2 border-black bg-white px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-black shadow-[2px_2px_0_black]"
        }
      >
        {agentId}
      </span>
    </motion.div>
  );
}

export function LiveCursors() {
  const others = useOthers();

  return (
    <>
      {others.map(({ connectionId, presence }) => {
        if (typeof presence.x !== "number" || typeof presence.y !== "number") {
          return null;
        }

        return (
          <LiveCursor
            key={connectionId}
            x={presence.x}
            y={presence.y}
            agentId={presence.agentId}
          />
        );
      })}
    </>
  );
}
