"use client";

import { useInvestigationStore } from "@/store/use-investigation-store";

export function GlobalStatusBar() {
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const selectedCrimeTypes = useInvestigationStore(
    (state) => state.selectedCrimeTypes,
  );
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );
  const spatialBounds = useInvestigationStore((state) => state.spatialBounds);
  const clearAllFilters = useInvestigationStore(
    (state) => state.clearAllFilters,
  );

  // Determine if any filters are non-default
  const isDefaultTime =
    timeRange[0] === "2026-07-18" && timeRange[1] === "2026-07-28";
  const isDefaultCrimeTypes =
    selectedCrimeTypes.length === 5 &&
    ["Burglary", "Assault", "Fraud", "Robbery", "Arson"].every((t) =>
      selectedCrimeTypes.includes(t),
    );
  const hasActiveFilters =
    !isDefaultTime ||
    !isDefaultCrimeTypes ||
    selectedSuspectId !== null ||
    spatialBounds !== null;

  // Suspect label map
  const suspectLabels: Record<string, string> = {
    "sus-ada": "ADA CROSS",
    "sus-marlowe": "JON MARLOWE",
    "sus-vale": "MIRA VALE",
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-4 border-black bg-black px-4 py-2 font-mono text-[10px] font-black uppercase text-[#F4F4F0]">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[#FCD34D]">ACTIVE FILTERS:</span>

        {/* Crime types */}
        <span className="text-white/80">
          CRIME[
          <span className={isDefaultCrimeTypes ? "text-white/40" : "text-[#D22B2B]"}>
            {selectedCrimeTypes.length === 0
              ? "NONE"
              : selectedCrimeTypes.map((t) => t.toUpperCase()).join(", ")}
          </span>
          ]
        </span>

        <span className="mx-1 text-white/30">|</span>

        {/* Time range */}
        <span className="text-white/80">
          TIME[
          <span className={isDefaultTime ? "text-white/40" : "text-[#D22B2B]"}>
            {timeRange[0]} TO {timeRange[1]}
          </span>
          ]
        </span>

        <span className="mx-1 text-white/30">|</span>

        {/* Spatial bounds */}
        <span className="text-white/80">
          BOUNDS[
          <span className={spatialBounds ? "text-[#D22B2B]" : "text-white/40"}>
            {spatialBounds ? "SELECTED" : "NONE"}
          </span>
          ]
        </span>

        <span className="mx-1 text-white/30">|</span>

        {/* Suspect */}
        <span className="text-white/80">
          SUSPECT[
          <span
            className={selectedSuspectId ? "text-[#D22B2B]" : "text-white/40"}
          >
            {selectedSuspectId
              ? suspectLabels[selectedSuspectId] ?? selectedSuspectId
              : "NONE"}
          </span>
          ]
        </span>

        {/* Clear all button */}
        {hasActiveFilters && (
          <>
            <span className="mx-2 text-white/30">|</span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="border-2 border-[#D22B2B] bg-[#D22B2B] px-2 py-0.5 text-white shadow-[2px_2px_0_#F4F4F0] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              [ CLEAR ALL FILTERS ]
            </button>
          </>
        )}

        {/* System version */}
        <span className="ml-auto hidden text-white/20 md:inline">
          FATAL//SYNC v1.0
        </span>
      </div>
    </div>
  );
}
