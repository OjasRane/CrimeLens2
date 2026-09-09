"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useInvestigationStore } from "@/store/use-investigation-store";

function WorkspaceLoading() {
  return (
    <div className="grid h-full min-h-0 place-items-center bg-[var(--paper)] font-mono text-xs font-black uppercase text-[var(--dim)]">
      [ Loading workspace… ]
    </div>
  );
}

const Board = dynamic(
  () => import("@/components/board").then((module) => module.Board),
  { ssr: false, loading: WorkspaceLoading },
);
const GeospatialMapWorkspace = dynamic(
  () =>
    import("@/components/geospatial-map-workspace").then(
      (module) => module.GeospatialMapWorkspace,
    ),
  { ssr: false, loading: WorkspaceLoading },
);
const NetworkGraphWorkspace = dynamic(
  () =>
    import("@/components/network-graph-workspace").then(
      (module) => module.NetworkGraphWorkspace,
    ),
  { ssr: false, loading: WorkspaceLoading },
);
const TimelineWorkspace = dynamic(
  () =>
    import("@/components/timeline-workspace").then(
      (module) => module.TimelineWorkspace,
    ),
  { ssr: false, loading: WorkspaceLoading },
);
const EvidenceIntakeWorkspace = dynamic(
  () =>
    import("@/components/evidence-intake-workspace").then(
      (module) => module.EvidenceIntakeWorkspace,
    ),
  { ssr: false, loading: WorkspaceLoading },
);

function WorkspaceFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="h-full min-h-0 overflow-hidden bg-[var(--paper)] p-0 md:p-4">
      <section className="flex h-full min-h-0 flex-col border-0 border-[var(--ink)] bg-[var(--panel)] shadow-none rounded-none md:min-h-full md:border-4 md:shadow-[4px_4px_0_var(--ink)]">
        <div className="hidden shrink-0 border-b-4 border-[var(--ink)] bg-[var(--paper)] px-4 py-3 md:block">
          <h2 className="font-serif text-3xl font-black uppercase leading-none">
            {title}
          </h2>
        </div>
        {children}
      </section>
    </div>
  );
}

export function WorkspaceViewport() {
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );

  if (activeWorkspace === "map") {
    return <GeospatialMapWorkspace />;
  }

  if (activeWorkspace === "network") {
    return (
      <WorkspaceFrame title="Network Graph">
        <NetworkGraphWorkspace />
      </WorkspaceFrame>
    );
  }

  if (activeWorkspace === "timeline") {
    return <TimelineWorkspace />;
  }

  if (activeWorkspace === "evidence") {
    return <EvidenceIntakeWorkspace />;
  }

  return <Board />;
}
