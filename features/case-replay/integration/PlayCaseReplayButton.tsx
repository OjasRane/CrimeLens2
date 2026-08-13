"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { CaseReplayProps, ReplayCaseData } from "../src";

const CaseReplay = dynamic<CaseReplayProps>(
  () => import("../src").then((module) => module.CaseReplay),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading 3D case replay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 199,
          display: "grid",
          placeItems: "center",
          background: "#111311",
          color: "#f5f3ed",
          fontFamily: '"Courier New", Courier, monospace',
          letterSpacing: "0.12em",
        }}
      >
        PREPARING 3D CASE REPLAY…
      </div>
    ),
  },
);

export type PlayCaseReplayButtonProps = {
  /** Optional timeline/event id. Omit it to begin at Chapter 1. */
  initialEventId?: string;
  /** Optional host case data. The bundled Mumbai replay is used when omitted. */
  caseData?: ReplayCaseData;
  /** Button contents. */
  children?: ReactNode;
  /** Class from the host timeline page's design system. */
  className?: string;
  /** Called after the launcher opens or closes. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Same-page launcher for the full-screen CrimeLens replay.
 *
 * The Three.js bundle is downloaded only after the user clicks the button.
 * Closing the replay unmounts it and reveals the timeline at its previous scroll
 * position.
 */
export function PlayCaseReplayButton({
  initialEventId,
  caseData,
  children = "PLAY CASE REPLAY",
  className,
  onOpenChange,
}: PlayCaseReplayButtonProps) {
  const [open, setOpen] = useState(false);

  const setReplayOpen = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setReplayOpen(true)}
      >
        {children}
      </button>

      {open ? (
        <CaseReplay
          caseData={caseData}
          initialEventId={initialEventId}
          onExit={() => setReplayOpen(false)}
        />
      ) : null}
    </>
  );
}
