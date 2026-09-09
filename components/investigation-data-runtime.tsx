"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getInvestigationBundle } from "@/lib/crimelens-api";
import { isSupabaseBrowserConfigured } from "@/lib/supabase-browser";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function InvestigationDataRuntime() {
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  const hydrateInvestigation = useInvestigationStore(
    (state) => state.hydrateInvestigation,
  );
  const [failure, setFailure] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const hydrated = useRef(new Set<string>());

  const retry = useCallback(() => {
    hydrated.current.delete(activeInvestigationId);
    setFailure(false);
    setRetryVersion((version) => version + 1);
  }, [activeInvestigationId]);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured || hydrated.current.has(activeInvestigationId)) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    setFailure(false);
    void getInvestigationBundle(activeInvestigationId, controller.signal)
      .then((investigation) => {
        if (!active) return;
        hydrated.current.add(activeInvestigationId);
        hydrateInvestigation(investigation);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setFailure(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeInvestigationId, hydrateInvestigation, retryVersion]);

  if (!failure) return null;
  return (
    <div
      role="alert"
      className="fixed bottom-10 left-1/2 z-[140] w-[min(520px,calc(100vw-1rem))] -translate-x-1/2 border-4 border-[var(--ink)] bg-[var(--paper)] p-3 font-mono text-xs font-black uppercase text-[var(--ink)] shadow-[6px_6px_0_var(--danger)]"
    >
      <p>[ DATA LINK UNAVAILABLE ]</p>
      <p className="mt-1 normal-case font-bold opacity-70">
        Investigation service could not be reached. The bundled dataset remains
        visible and is explicitly operating as a local fallback.
      </p>
      <button
        type="button"
        onClick={retry}
        className="mt-3 min-h-11 border-2 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-left shadow-[3px_3px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
      >
        [ RETRY ]
      </button>
    </div>
  );
}
