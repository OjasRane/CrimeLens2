"use client";

import { Clock3, FileUp, Map, Network, PanelsTopLeft } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";
import { useInvestigationAccess } from "@/components/investigation-access";

const mobileWorkspaces = [
  { id: "canvas" as const, number: "01", label: "Board", icon: PanelsTopLeft },
  { id: "map" as const, number: "02", label: "Map", icon: Map },
  { id: "network" as const, number: "03", label: "Network", icon: Network },
  { id: "timeline" as const, number: "04", label: "Timeline", icon: Clock3 },
  { id: "evidence" as const, number: "05", label: "Intake", icon: FileUp },
];

export function MobileWorkspaceNav() {
  const { isPublicDemo } = useInvestigationAccess();
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );

  return (
    <nav
      aria-label="Mobile workspace"
      className="fixed inset-x-0 bottom-[env(safe-area-inset-bottom)] z-[70] grid h-16 w-full grid-cols-5 gap-1 border-t-4 border-[var(--ink)] bg-[var(--paper)] p-1 font-mono shadow-[0_-4px_0_var(--ink)] md:hidden dark:border-[var(--line)] dark:shadow-[0_-4px_0_var(--ink)]"
    >
      {mobileWorkspaces.map(({ id, number, label, icon: Icon }) => {
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
            className={`relative isolate flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden border-2 px-0.5 font-black uppercase shadow-[2px_2px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)] sm:flex-row sm:gap-2 sm:text-[11px] ${
              isActive
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] dark:border-[var(--accent)] dark:bg-[var(--accent)] dark:text-[var(--accent-ink)]"
                : "border-[var(--ink)] bg-[var(--panel)] text-[var(--ink)] dark:border-[var(--line)] dark:bg-[var(--panel)] dark:text-[var(--ink)]"
            }`}
          >
            {isActive ? (
              <div
                className="absolute inset-0 -z-10 border-2 border-[var(--ink)] bg-[var(--ink)] dark:border-[var(--accent)] dark:bg-[var(--paper)]"
              />
            ) : null}
            <span className="flex items-center gap-0.5 text-[7px] leading-none opacity-65 sm:text-[9px]">
              <span aria-hidden="true">{number}</span>
              <Icon aria-hidden="true" size={13} strokeWidth={2.5} />
            </span>
            <span className="max-w-full truncate text-[7px] leading-none sm:text-[11px]">
              {isPublicDemo && id === "evidence" ? "Sources" : label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
