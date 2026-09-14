"use client";

import {
  type ActiveWorkspace,
  useInvestigationStore,
} from "@/store/use-investigation-store";
import { getInvestigation } from "@/data/investigations/registry";
import { useInvestigationAccess } from "@/components/investigation-access";

const workspaces: { id: ActiveWorkspace; number: string; label: string }[] = [
  { id: "canvas", number: "01", label: "Evidence Board" },
  { id: "map", number: "02", label: "Map" },
  { id: "network", number: "03", label: "Network" },
  { id: "timeline", number: "04", label: "Timeline" },
  { id: "evidence", number: "05", label: "Evidence Intake" },
];

export function WorkspaceBar() {
  const { isPublicDemo } = useInvestigationAccess();
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const activeInvestigation = getInvestigation(activeInvestigationId);

  return (
    <nav
      aria-label="Investigation features"
      className="hide-scrollbar fixed left-0 top-16 z-10 hidden h-14 w-full items-end gap-3 overflow-x-auto overflow-y-hidden border-b-4 border-[var(--ink)] bg-[var(--paper)] px-5 font-mono md:flex dark:border-[var(--line)]"
    >
      {workspaces.map((workspace) => {
        const isActive = activeWorkspace === workspace.id;

        return (
          <button
            key={workspace.id}
            type="button"
            onClick={() => setActiveWorkspace(workspace.id)}
            className="fatal-case-tab flex h-12 shrink-0 items-center gap-2 px-4 pb-2 pt-3 text-[11px] font-black uppercase tracking-normal"
            aria-current={isActive ? "page" : undefined}
          >
            <span className="text-[8px] opacity-65" aria-hidden="true">
              {workspace.number}
            </span>
            <span>{isPublicDemo && workspace.id === "evidence" ? "Case Sources" : workspace.label}</span>
          </button>
        );
      })}
      <div className="ml-auto mb-2 flex h-8 shrink-0 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 text-[9px] font-black uppercase shadow-[2px_2px_0_var(--ink)] dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)]">
        [ {activeInvestigation.badge} ]
        <span className="hidden opacity-65 lg:inline">
          {activeInvestigation.caseId} // {activeInvestigation.caseType}
        </span>
        {activeInvestigation.type === "HISTORICAL" ? (
          <span className="hidden text-[9px] font-bold normal-case opacity-65 xl:inline">
            Approximate times are marked ≈
          </span>
        ) : null}
      </div>
    </nav>
  );
}
