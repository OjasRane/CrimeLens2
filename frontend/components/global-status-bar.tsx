"use client";

import { useInvestigationStore } from "@/store/use-investigation-store";
import { getInvestigation } from "@/data/investigations/registry";

export function GlobalStatusBar() {
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const selectedCrimeTypes = useInvestigationStore(
    (state) => state.selectedCrimeTypes,
  );
  const selectedEntityId = useInvestigationStore(
    (state) => state.selectedEntityId,
  );
  const spatialBounds = useInvestigationStore((state) => state.spatialBounds);
  const clearAllFilters = useInvestigationStore(
    (state) => state.clearAllFilters,
  );

  // Determine if any filters are non-default
  const isDefaultTime =
    timeRange[0] === activeInvestigation.timeline.startDate &&
    timeRange[1] === activeInvestigation.timeline.endDate;
  const isDefaultCrimeTypes =
    selectedCrimeTypes.length === activeInvestigation.map.filterGroups.length &&
    activeInvestigation.map.filterGroups.every((type) =>
      selectedCrimeTypes.includes(type),
    );
  const hasActiveFilters =
    !isDefaultTime ||
    !isDefaultCrimeTypes ||
    selectedEntityId !== null ||
    spatialBounds !== null;

  const selectedEntityLabel = activeInvestigation.graph.nodes.find(
    (node) => node.id === selectedEntityId,
  )?.label;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 hidden border-t-4 border-[var(--ink)] bg-[var(--ink)] px-4 py-2 font-mono text-[10px] font-black uppercase text-[var(--paper)] md:block">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[var(--accent)]">ACTIVE FILTERS:</span>

        {/* Crime types */}
        <span className="opacity-80">
          {activeInvestigationId === "demo" ? "CRIME" : "SITE TYPE"}[
          <span
            className={
              isDefaultCrimeTypes ? "opacity-40" : "text-[var(--danger)]"
            }
          >
            {selectedCrimeTypes.length === 0
              ? "NONE"
              : selectedCrimeTypes.map((t) => t.toUpperCase()).join(", ")}
          </span>
          ]
        </span>

        <span className="mx-1 opacity-30">|</span>

        {/* Time range */}
        <span className="opacity-80">
          TIME[
          <span
            className={isDefaultTime ? "opacity-40" : "text-[var(--danger)]"}
          >
            {timeRange[0]} TO {timeRange[1]}
          </span>
          ]
        </span>

        <span className="mx-1 opacity-30">|</span>

        {/* Spatial bounds */}
        <span className="opacity-80">
          BOUNDS[
          <span
            className={spatialBounds ? "text-[var(--danger)]" : "opacity-40"}
          >
            {spatialBounds ? "SELECTED" : "NONE"}
          </span>
          ]
        </span>

        <span className="mx-1 opacity-30">|</span>

        {/* Suspect */}
        <span className="opacity-80">
          {activeInvestigationId === "demo" ? "SUSPECT" : "ENTITY"}[
          <span
            className={
              selectedEntityId ? "text-[var(--danger)]" : "opacity-40"
            }
          >
            {selectedEntityId
              ? (selectedEntityLabel ?? selectedEntityId)
              : "NONE"}
          </span>
          ]
        </span>

        {/* Clear all button */}
        {hasActiveFilters && (
          <>
            <span className="mx-2 opacity-30">|</span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="border-2 border-[var(--danger)] bg-[var(--danger)] px-2 py-0.5 text-[var(--paper)] shadow-[2px_2px_0_var(--paper)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              [ CLEAR ALL FILTERS ]
            </button>
          </>
        )}

        {/* System version */}
        <span className="ml-auto hidden opacity-20 md:inline">
          FATAL//SYNC v1.0
        </span>
      </div>
    </div>
  );
}
