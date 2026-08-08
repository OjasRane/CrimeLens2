"use client";

import type { ReactNode } from "react";
import { Board } from "@/components/board";
import { GeospatialMapWorkspace } from "@/components/geospatial-map-workspace";
import { NetworkGraphWorkspace } from "@/components/network-graph-workspace";
import { TimelineWorkspace } from "@/components/timeline-workspace";
import { useInvestigationStore } from "@/store/use-investigation-store";

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

  return <Board />;
}
