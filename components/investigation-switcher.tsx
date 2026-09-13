"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  getInvestigation,
} from "@/data/investigations/registry";
import type { InvestigationId } from "@/data/investigations/types";
import { getInvestigations } from "@/lib/crimelens-api";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";
import { useInvestigationAccess } from "@/components/investigation-access";
import { publicCases } from "@/lib/public-access";

export function InvestigationSwitcher() {
  const { isPublicDemo } = useInvestigationAccess();
  const router = useRouter();
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);

  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [options, setOptions] = useState<
    Array<{ id: InvestigationId; shortName: string; description: string }>
  >([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeInvestigation = getInvestigation(activeInvestigationId);

  useEffect(() => {
    if (isPublicDemo) {
      setStatusMessage(null);
      setOptions(
        publicCases.map((item) => ({
          id: item.id,
          shortName: item.shortName,
          description: item.name,
        })),
      );
      return;
    }
    const controller = new AbortController();
    void getInvestigations(controller.signal).then((available) => {
      if (controller.signal.aborted) return;
      setStatusMessage(null);
      setOptions(available.map(item => ({id:item.id,shortName:item.shortName,description:item.name})));
    }).catch(() => { if (!controller.signal.aborted) setStatusMessage("Case list unavailable. Reload to retry."); });
    return () => controller.abort();
  }, [isPublicDemo]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function selectInvestigation(investigationId: InvestigationId) {
    if (investigationId === activeInvestigationId) {
      setIsOpen(false);
      return;
    }

    if (isPublicDemo) {
      router.push(`/demo/${investigationId}`);
      return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("investigation", investigationId);
    nextUrl.searchParams.delete("case");
    // Reload clears case state and reruns the authenticated loader before rendering.
    window.location.assign(nextUrl.toString());
  }

  return (
    <div ref={rootRef} className="relative shrink-0 font-mono uppercase">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex h-11 w-[68px] items-center justify-center border-4 border-[var(--ink)] bg-[var(--accent)] px-1 text-[10px] font-black text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none md:w-auto md:min-w-[190px] md:justify-start md:px-3 md:text-xs md:shadow-[4px_4px_0_var(--ink)]"
      >
        <span className="md:hidden">
          {activeInvestigation.shortName.slice(0, 10)} ▼
        </span>
        <span className="hidden md:inline">
          [ INVESTIGATION: {activeInvestigation.shortName} ▼ ]
        </span>
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="Select investigation"
          className="fixed left-2 top-[calc(env(safe-area-inset-top)+7.75rem)] z-[110] max-h-[calc(100dvh-env(safe-area-inset-top)-12.5rem)] w-[min(340px,calc(100vw-1rem))] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-2 text-[var(--ink)] shadow-[7px_7px_0_var(--ink)] md:absolute md:left-auto md:right-0 md:top-[calc(100%+10px)] md:max-h-[calc(100dvh-7rem)] md:w-[360px]"
        >
          <div className="mb-2 border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-xs font-black text-[var(--paper)]">
            [ SELECT INVESTIGATION ]
          </div>
          {options.map((option) => {
            const selected = option.id === activeInvestigationId;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => void selectInvestigation(option.id)}
                className={`mb-2 grid min-h-16 w-full grid-cols-[24px_1fr] items-start border-2 border-[var(--ink)] px-3 py-2 text-left shadow-[3px_3px_0_var(--ink)] last:mb-0 ${
                  selected
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--accent)]"
                }`}
              >
                <span className="text-sm" aria-hidden="true">
                  {selected ? "●" : "○"}
                </span>
                <span>
                  <span className="block text-xs font-black">
                    {option.shortName}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold normal-case leading-tight opacity-70">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="mt-2 border-2 border-dashed border-[var(--ink)] px-2 py-2 text-[9px] font-bold leading-tight opacity-70">
            <Link href={isPublicDemo ? "/?next=%2Fcases%2Fnew#signup" : "/cases"} className="flex min-h-11 items-center underline">Your cases / Create a new investigation →</Link>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+7.75rem)] z-[115] max-w-[calc(100vw-1rem)] -translate-x-1/2 border-4 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-center text-[10px] font-black text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] md:top-24 md:max-w-none md:whitespace-nowrap md:text-xs"
        >
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}
