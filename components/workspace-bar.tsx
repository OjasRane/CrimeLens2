"use client";

import {
  type ActiveWorkspace,
  useInvestigationStore,
} from "@/store/use-investigation-store";
import { getInvestigation } from "@/data/investigations/registry";

const workspaces: { id: ActiveWorkspace; label: string }[] = [
  { id: "canvas", label: "01 // EVIDENCE BOARD" },
  { id: "map", label: "02 // GEOSPATIAL MAP" },
  { id: "network", label: "03 // NETWORK GRAPH" },
  { id: "timeline", label: "04 // TIMELINE ANALYSIS" },
  { id: "evidence", label: "05 // EVIDENCE INTAKE" },
];

export function WorkspaceBar() {
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
    <nav className="fixed left-0 top-20 z-10 hidden h-16 w-full items-center gap-3 overflow-x-auto border-b-4 border-[var(--ink)] bg-[var(--paper)] px-5 font-mono shadow-[0_4px_0_var(--ink)] rounded-none md:flex">
      {workspaces.map((workspace) => {
        const isActive = activeWorkspace === workspace.id;

        return (
          <button
            key={workspace.id}
            type="button"
            onClick={() => setActiveWorkspace(workspace.id)}
            className={`h-10 shrink-0 border-4 border-[var(--ink)] px-4 text-xs font-black uppercase tracking-normal shadow-[4px_4px_0_var(--ink)] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none ${
              isActive
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--accent)] text-[var(--ink)] hover:-translate-x-0.5 hover:-translate-y-0.5"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            [ {workspace.label} ]
          </button>
        );
      })}
      <div className="ml-auto flex shrink-0 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 py-2 text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)]">
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
