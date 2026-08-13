"use client";

import { ClientSideSuspense } from "@liveblocks/react";
import { AnimatePresence, motion } from "framer-motion";
import { RadioTower } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CollaborationProvider } from "@/components/collaboration-context";
import {
  LiveCommandPalette,
  LocalCommandPalette,
} from "@/components/command-palette";
import { LiveCursors } from "@/components/live-cursors";
import {
  isLiveblocksConfigured,
  formatCaseName,
  RoomProvider,
  useEventListener,
  useUpdateMyPresence,
} from "@/lib/liveblocks";
import { createInitialEvidenceStorage } from "@/lib/evidence-board-storage";
import { useInvestigationStore } from "@/store/use-investigation-store";

function createAgentId() {
  const number = Math.floor(Math.random() * 5) + 1;
  return `AGENT-${String(number).padStart(2, "0")}`;
}

function SecureConnectionFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F4F4F0] p-6 font-mono text-black dark:bg-[#01161E] dark:text-[#EFF6E0]">
      <div className="border-4 border-black bg-white px-6 py-5 text-center text-sm font-black uppercase tracking-[0.14em] shadow-[6px_6px_0_black] dark:border dark:border-[#598392] dark:bg-[#124559] dark:text-[#AEC3B0] dark:shadow-[inset_0_0_18px_rgba(174,195,176,0.12),0_0_20px_rgba(1,22,30,0.7)]">
        ESTABLISHING SECURE CONNECTION...
      </div>
    </div>
  );
}

function CollaborationSurface({
  agentId,
  children,
}: {
  agentId: string;
  children: ReactNode;
}) {
  const updateMyPresence = useUpdateMyPresence();

  useEffect(() => {
    updateMyPresence({ agentId, x: null, y: null });
  }, [agentId, updateMyPresence]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      updateMyPresence({ x: event.clientX, y: event.clientY });
    },
    [updateMyPresence],
  );

  const handlePointerLeave = useCallback(() => {
    updateMyPresence({ x: null, y: null });
  }, [updateMyPresence]);

  return (
    <CollaborationProvider agentId={agentId} isMultiplayer>
      <div
        className="min-h-screen"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </div>
      <LiveCursors />
    </CollaborationProvider>
  );
}

function IncomingOverrideListener() {
  const requestMapPan = useInvestigationStore((state) => state.requestMapPan);
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const [message, setMessage] = useState<string | null>(null);
  const toastTimeout = useRef<number | null>(null);

  useEventListener(({ event, user, connectionId }) => {
    if (event.type !== "FORCE_MAP_PAN") return;

    setActiveWorkspace("map");
    requestMapPan(event.coordinates, event.targetId);

    const agentName =
      user?.presence.agentId ||
      user?.info.name?.trim() ||
      `AGENT-${String(connectionId).padStart(2, "0")}`;
    setMessage(`[ INCOMING OVERRIDE: ${agentName.toUpperCase()} ]`);

    if (toastTimeout.current !== null)
      window.clearTimeout(toastTimeout.current);
    toastTimeout.current = window.setTimeout(() => setMessage(null), 4200);
  });

  useEffect(
    () => () => {
      if (toastTimeout.current !== null)
        window.clearTimeout(toastTimeout.current);
    },
    [],
  );

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          aria-live="assertive"
          className="fixed right-2 top-[calc(env(safe-area-inset-top)+7.75rem)] z-[120] flex max-w-[calc(100vw-1rem)] items-center gap-3 border-2 border-black bg-[#F4F4F0] px-3 py-3 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-black shadow-[4px_4px_0_black] sm:right-6 sm:top-6 sm:px-4 sm:text-sm sm:tracking-[0.12em] dark:border dark:border-[#598392] dark:bg-[#01161E] dark:text-[#AEC3B0] dark:shadow-[inset_0_0_18px_rgba(174,195,176,0.14),0_0_24px_rgba(1,22,30,0.7)] dark:[text-shadow:0_0_7px_rgba(174,195,176,0.45)]"
          initial={{ opacity: 0, x: 24, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <RadioTower
            aria-hidden="true"
            size={20}
            className="fatal-command-radio shrink-0"
          />
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ConnectedRuntime({
  roomId,
  children,
}: {
  roomId: string;
  children: ReactNode;
}) {
  const [agentId] = useState(createAgentId);

  return (
    <RoomProvider
      id={roomId}
      initialPresence={{ x: null, y: null, agentId }}
      initialStorage={createInitialEvidenceStorage}
    >
      <ClientSideSuspense fallback={<SecureConnectionFallback />}>
        <CollaborationSurface agentId={agentId}>
          {children}
          <LiveCommandPalette />
          <IncomingOverrideListener />
        </CollaborationSurface>
      </ClientSideSuspense>
    </RoomProvider>
  );
}

export function LiveblocksRuntime({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const requestedCase = formatCaseName(searchParams.get("case") ?? "");

  // An absent/empty case is intentionally local-only. Liveblocks must never
  // fall back to a shared room because that exposes another case's history.
  if (!requestedCase || !isLiveblocksConfigured) {
    return (
      <CollaborationProvider agentId="AGENT-01" isMultiplayer={false}>
        {children}
        <LocalCommandPalette />
      </CollaborationProvider>
    );
  }

  return (
    <ConnectedRuntime key={requestedCase} roomId={requestedCase}>
      {children}
    </ConnectedRuntime>
  );
}
