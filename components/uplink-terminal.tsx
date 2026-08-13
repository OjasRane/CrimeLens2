"use client";

import { ClientSideSuspense } from "@liveblocks/react";
import type { Node } from "@xyflow/react";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  createInitialEvidenceStorage,
  serializeFlowNode,
} from "@/lib/evidence-board-storage";
import {
  formatCaseName,
  isLiveblocksConfigured,
  RoomProvider,
  useMutation,
  useStatus,
  useStorage,
} from "@/lib/liveblocks";

type TransmissionStatus = "idle" | "sending" | "sent";

function UplinkInterface({ roomId }: { roomId: string }) {
  useStorage((root) => root.nodes.length);
  const connectionStatus = useStatus();
  const addNode = useMutation(({ storage }, intelText: string) => {
    const timestamp = Date.now();
    const node: Node = {
      id: `note-${timestamp}-${crypto.randomUUID()}`,
      type: "stickyNote",
      position: { x: 250, y: 250 },
      data: {
        text: intelText,
        timestamp,
        source: "FIELD-UPLINK",
      },
    };

    storage.get("nodes").push(serializeFlowNode(node));
  }, []);
  const [intel, setIntel] = useState("");
  const [status, setStatus] = useState<TransmissionStatus>("idle");
  const resetTimer = useRef<number | null>(null);

  const isConnected = connectionStatus === "connected";

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!intel.trim() || !isConnected || status !== "idle") return;

    setStatus("sending");

    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate([20, 50, 20]);
    }

    addNode(intel);
    setIntel("");
    setStatus("sent");

    resetTimer.current = window.setTimeout(() => {
      setStatus("idle");
      resetTimer.current = null;
    }, 2000);
  }

  const isDisabled = !isConnected || !intel.trim() || status !== "idle";

  return (
    <main className="fixed inset-0 flex min-h-dvh flex-col overflow-y-auto bg-[#031820] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] font-mono text-[#F4F1DC] sm:justify-center sm:p-6">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 py-2 sm:gap-6">
        <header className="border-l-2 border-[#32D6A0] pl-4">
          <p
            className={`text-xs font-bold uppercase tracking-[0.16em] ${
              isConnected ? "animate-pulse text-[#32D6A0]" : "text-[#6F8F96]"
            }`}
            role="status"
            aria-live="polite"
          >
            {isConnected
              ? "[ SECURE UPLINK ESTABLISHED ]"
              : "[ ESTABLISHING SECURE UPLINK... ]"}
          </p>
          <h1 className="mt-3 text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
            Field Intelligence Relay
          </h1>
          <p className="mt-3 text-xs uppercase tracking-[0.12em] text-[#6F8F96]">
            Case channel: {roomId}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label
            htmlFor="uplink-intel"
            className="text-xs font-bold uppercase tracking-[0.14em] text-[#6F8F96]"
          >
            Intelligence payload
          </label>
          <textarea
            id="uplink-intel"
            value={intel}
            onChange={(event) => setIntel(event.target.value)}
            placeholder="ENTER FIELD INTELLIGENCE..."
            rows={6}
            autoFocus
            className="min-h-36 w-full resize-y rounded-none border border-[#426D79] bg-transparent p-4 text-base leading-relaxed text-[#F4F1DC] outline-none placeholder:text-[#6F8F96] focus:border-[#32D6A0] disabled:opacity-50 sm:min-h-52 sm:resize-none"
            disabled={!isConnected || status !== "idle"}
          />
          <button
            type="submit"
            disabled={isDisabled}
            className="min-h-14 w-full rounded-none border border-[#32D6A0] bg-[#32D6A0] px-5 py-4 text-base font-black uppercase tracking-[0.12em] text-[#031820] transition-colors active:bg-[#F4F1DC] disabled:cursor-not-allowed disabled:border-[#426D79] disabled:bg-[#144453] disabled:text-[#6F8F96]"
          >
            {status === "sent"
              ? "[ TRANSMITTED ]"
              : status === "sending"
                ? "[ TRANSMITTING... ]"
                : "[ TRANSMIT INTEL ]"}
          </button>
        </form>

        <p className="border-t border-[#426D79] pt-4 text-[11px] uppercase leading-relaxed tracking-[0.12em] text-[#6F8F96]">
          Payloads are inserted onto the command center evidence board at the
          shared staging coordinates.
        </p>
      </div>
    </main>
  );
}

function MissingLiveblocksConfiguration() {
  return (
    <main className="fixed inset-0 flex min-h-screen items-center justify-center overflow-y-auto bg-[#031820] p-6 font-mono text-[#FF4D55]">
      <p className="max-w-md border border-[#FF4D55] p-5 text-center text-sm font-bold uppercase tracking-[0.14em]">
        [ UPLINK OFFLINE: LIVEBLOCKS KEY NOT CONFIGURED ]
      </p>
    </main>
  );
}

function MissingCaseId() {
  return (
    <main className="fixed inset-0 flex min-h-screen items-center justify-center overflow-y-auto bg-[#031820] p-6 font-mono text-[#FFD45A]">
      <p className="max-w-md border border-[#FFD45A] p-5 text-center text-sm font-bold uppercase tracking-[0.14em]">
        [ UPLINK OFFLINE: CASE ID NOT PROVIDED ]
      </p>
    </main>
  );
}

function UplinkStorageFallback() {
  return (
    <main className="fixed inset-0 flex min-h-screen items-center justify-center overflow-y-auto bg-[#031820] p-6 font-mono text-[#6F8F96]">
      <p className="animate-pulse text-center text-sm font-bold uppercase tracking-[0.16em]">
        [ DECRYPTING LEDGER... ]
      </p>
    </main>
  );
}

export function UplinkTerminal() {
  const searchParams = useSearchParams();
  const requestedCase = formatCaseName(searchParams.get("case") ?? "");

  if (!requestedCase) return <MissingCaseId />;
  if (!isLiveblocksConfigured) return <MissingLiveblocksConfiguration />;

  return (
    <RoomProvider
      id={requestedCase}
      initialPresence={{ x: null, y: null, agentId: "FIELD-UPLINK" }}
      initialStorage={createInitialEvidenceStorage}
    >
      <ClientSideSuspense fallback={<UplinkStorageFallback />}>
        <UplinkInterface roomId={requestedCase} />
      </ClientSideSuspense>
    </RoomProvider>
  );
}
