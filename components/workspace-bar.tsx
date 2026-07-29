"use client";

import {
  type ActiveWorkspace,
  useInvestigationStore,
} from "@/store/use-investigation-store";

const workspaces: { id: ActiveWorkspace; label: string }[] = [
  { id: "canvas", label: "01 // EVIDENCE BOARD" },
  { id: "map", label: "02 // GEOSPATIAL MAP" },
  { id: "network", label: "03 // NETWORK GRAPH" },
  { id: "timeline", label: "04 // TIMELINE ANALYSIS" },
];

export function WorkspaceBar() {
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );

  return (
    <nav className="fixed left-0 top-20 z-10 flex h-16 w-full items-center gap-3 overflow-x-auto border-b-4 border-black bg-[#F4F4F0] px-5 font-mono shadow-[0_4px_0_black] rounded-none">
      {workspaces.map((workspace) => {
        const isActive = activeWorkspace === workspace.id;

        return (
          <button
            key={workspace.id}
            type="button"
            onClick={() => setActiveWorkspace(workspace.id)}
            className={`h-10 shrink-0 border-4 border-black px-4 text-xs font-black uppercase tracking-normal shadow-[4px_4px_0_black] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none ${
              isActive
                ? "bg-black text-white"
                : "bg-[#FCD34D] text-black hover:-translate-x-0.5 hover:-translate-y-0.5"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            [ {workspace.label} ]
          </button>
        );
      })}
    </nav>
  );
}
