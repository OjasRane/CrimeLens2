import { AuthenticatedWorkspace } from "@/components/authenticated-workspace";
import { Suspense } from "react";
import { UplinkTerminal } from "@/components/uplink-terminal";

function UplinkLoading() {
  return (
    <main className="fixed inset-0 flex min-h-screen items-center justify-center overflow-y-auto bg-[#031820] p-6 font-mono text-[#6F8F96] dark:bg-[var(--paper)] dark:text-[var(--dim)]">
      <p className="animate-pulse text-center text-sm font-bold uppercase tracking-[0.16em]">
        [ ESTABLISHING SECURE UPLINK... ]
      </p>
    </main>
  );
}

export default function UplinkPage() {
  return (
    <AuthenticatedWorkspace><Suspense fallback={<UplinkLoading />}>
      <UplinkTerminal />
    </Suspense></AuthenticatedWorkspace>
  );
}
