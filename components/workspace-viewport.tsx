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
    <div className="h-full overflow-y-auto bg-[#F4F4F0] p-4">
      <section className="min-h-full border-4 border-black bg-white shadow-[4px_4px_0_black] rounded-none">
        <div className="border-b-4 border-black bg-[#F4F4F0] px-4 py-3">
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
