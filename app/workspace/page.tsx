import { Suspense } from "react";
import { AuthenticatedWorkspace } from "@/components/authenticated-workspace";
import { InvestigationWorkspace } from "@/components/investigation-workspace";

export default function WorkspacePage() {
  return (
    <AuthenticatedWorkspace>
      <Suspense
        fallback={
          <div className="grid min-h-screen place-items-center bg-[#F4F4F0] font-mono text-sm font-black uppercase text-black dark:bg-[#01161E] dark:text-[#AEC3B0]">
            ESTABLISHING CASE TERMINAL...
          </div>
        }
      >
        <InvestigationWorkspace />
      </Suspense>
    </AuthenticatedWorkspace>
  );
}
