"use client";

import { Network, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { WorkspaceSourceReference } from "@/lib/network-workspace-types";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function AddToNetworkWorkspaceButton({
  source,
  className = "",
  label = "Add to Network Workspace",
}: {
  source: WorkspaceSourceReference;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const options = useInvestigationStore(
    (state) => state.networkWorkspaceOptions,
  );
  const activeId = useInvestigationStore(
    (state) => state.activeNetworkWorkspaceId,
  );
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const setNetworkMode = useInvestigationStore((state) => state.setNetworkMode);
  const requestNetworkWorkspace = useInvestigationStore(
    (state) => state.requestNetworkWorkspace,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = String(
      new FormData(event.currentTarget).get("workspaceId") || "",
    );
    requestNetworkWorkspace({
      action: "add-source",
      source,
      targetWorkspaceId: workspaceId || undefined,
    });
    setNetworkMode("workspace");
    setActiveWorkspace("network");
    triggerHaptic("light");
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Network aria-hidden="true" className="inline size-3" /> {label}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] grid place-items-center bg-black/65 p-3"
              onMouseDown={(event) =>
                event.target === event.currentTarget && setOpen(false)
              }
            >
              <form
                onSubmit={submit}
                role="dialog"
                aria-modal="true"
                aria-label="Add to network workspace"
                className="w-full max-w-md border-4 border-[var(--ink)] bg-[var(--paper)] font-mono text-[var(--ink)] shadow-[8px_8px_0_var(--ink)]"
              >
                <header className="flex items-center justify-between border-b-4 border-[var(--ink)] bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
                  <h3 className="font-serif text-xl font-black uppercase">
                    Add to Workspace
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close add to workspace dialog"
                    className="grid h-8 w-8 place-items-center border-2 border-current"
                  >
                    <X size={16} />
                  </button>
                </header>
                <div className="grid gap-4 p-4">
                  <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-3">
                    <p className="text-[9px] font-black uppercase opacity-60">
                      Case reference //{" "}
                      {source.sourceVerificationStatus ?? "verified"}
                    </p>
                    <p className="mt-1 text-sm font-black uppercase">
                      {source.label}
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase opacity-60">
                      {source.type} // {source.sourceKind}
                    </p>
                  </div>
                  <label className="text-[10px] font-black uppercase">
                    Workspace
                    <select
                      name="workspaceId"
                      defaultValue={activeId ?? ""}
                      className="mt-1 min-h-11 w-full border-2 border-[var(--ink)] bg-[var(--panel)] px-3 font-bold"
                    >
                      {options.length ? (
                        options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))
                      ) : (
                        <option value="">ACTIVE / DEFAULT WORKSPACE</option>
                      )}
                    </select>
                  </label>
                  <p className="text-[9px] font-bold uppercase opacity-65">
                    Creates a workspace reference only. Case data remains
                    unchanged.
                    {source.sourceVerificationStatus === "pending" ||
                    source.sourceVerificationStatus === "disputed"
                      ? " This source requires analyst review."
                      : ""}
                  </p>
                  <button
                    type="submit"
                    className="min-h-11 border-4 border-[var(--ink)] bg-[var(--accent)] px-3 text-left text-[10px] font-black uppercase text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
                  >
                    [ Add Reference ]
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
