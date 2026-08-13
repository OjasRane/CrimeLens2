"use client";

import { motion } from "framer-motion";
import { Clock3, Map, Network, PanelsTopLeft } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

const mobileWorkspaces = [
  { id: "map" as const, label: "MAP", icon: Map },
  { id: "canvas" as const, label: "BOARD", icon: PanelsTopLeft },
  { id: "network" as const, label: "GRAPH", icon: Network },
  { id: "timeline" as const, label: "TIME", icon: Clock3 },
];

export function MobileWorkspaceNav() {
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );

  return (
    <nav
      aria-label="Mobile workspace"
      className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-[70] grid h-16 w-full grid-cols-4 border-t-4 border-black bg-[#F4F4F0] p-1 font-mono shadow-[0_-4px_0_black] md:hidden dark:border-[#598392] dark:bg-[#01161E] dark:shadow-[0_-4px_16px_rgba(1,22,30,0.75)]"
    >
      {mobileWorkspaces.map(({ id, label, icon: Icon }) => {
        const isActive = activeWorkspace === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setActiveWorkspace(id);
            }}
            aria-current={isActive ? "page" : undefined}
            className={`relative isolate flex min-h-11 min-w-0 items-center justify-center gap-1 overflow-hidden border-2 px-1 text-[9px] font-black uppercase dark:border-[#598392] sm:gap-2 sm:text-[11px] ${
              isActive
                ? "border-black bg-white text-white dark:bg-[#01161E] dark:text-[#AEC3B0]"
                : "border-black bg-white text-black dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0]"
            }`}
          >
            {isActive ? (
              <motion.div
                layoutId="active-nav-pill"
                className="absolute inset-0 -z-10 border-2 border-black bg-black dark:border dark:border-[#AEC3B0] dark:bg-transparent dark:shadow-[0_5px_12px_rgba(174,195,176,0.45)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            ) : null}
            <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
