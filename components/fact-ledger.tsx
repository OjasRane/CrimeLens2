"use client";

import type { Node } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { useCollaborationIdentity } from "@/components/collaboration-context";
import type { InvestigationFact } from "@/data/investigations/types";
import { serializeFlowNode } from "@/lib/evidence-board-storage";
import { useMutation } from "@/lib/liveblocks";
import { useInvestigationStore } from "@/store/use-investigation-store";

type FactFilter = "all" | InvestigationFact["type"];

function matchesFilter(fact: InvestigationFact, filter: FactFilter) {
  return filter === "all" || fact.type === filter;
}

function FactLedgerView({
  pinFactToBoard,
}: {
  pinFactToBoard: (fact: InvestigationFact) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<FactFilter>("all");
  const facts = useInvestigationStore((state) => state.facts);
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  const selectedEntityId = useInvestigationStore(
    (state) => state.selectedEntityId,
  );
  const selectedLocationId = useInvestigationStore(
    (state) => state.selectedLocationId,
  );
  const selectedTimelineEventId = useInvestigationStore(
    (state) => state.selectedTimelineEventId,
  );

  useEffect(() => setActiveFilter("all"), [activeInvestigationId]);

  const filters = useMemo(
    () => [
      { label: "[ ALL ]", value: "all" as const },
      ...Array.from(new Set(facts.map((fact) => fact.type))).map((type) => ({
        label: `[ ${type.replaceAll("-", " ").toUpperCase()} ]`,
        value: type,
      })),
    ],
    [facts],
  );

  const filteredFacts = facts.filter((fact) => {
    if (!matchesFilter(fact, activeFilter)) return false;
    if (selectedTimelineEventId) {
      return fact.linkedTimelineEventIds.includes(selectedTimelineEventId);
    }
    if (selectedLocationId) {
      return fact.linkedLocationIds.includes(selectedLocationId);
    }
    if (selectedEntityId) {
      return (
        fact.linkedEntityIds.includes(selectedEntityId) ||
        fact.linkedLocationIds.includes(selectedEntityId)
      );
    }
    return true;
  });

  return (
    <div className="h-full w-full overflow-y-auto p-3 font-mono md:w-[360px] md:p-4">
      <div className="mb-4 border-4 border-[var(--ink)] bg-[var(--panel)] p-3 shadow-[4px_4px_0_var(--ink)] rounded-none">
        <p className="text-xs font-bold uppercase tracking-normal">
          Indexed Evidence / {activeInvestigationId === "demo" ? "Demo Data" : "Historical Record"}
        </p>
        <h2 className="text-2xl font-black uppercase leading-none tracking-normal">
          Fact Ledger
        </h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setActiveFilter(filter.value)}
            className={`min-h-11 border-4 border-[var(--ink)] px-2 py-1 text-[11px] font-black uppercase shadow-[3px_3px_0_var(--ink)] rounded-none ${
              activeFilter === filter.value
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "bg-[var(--panel)] text-[var(--ink)]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <table className="w-full table-fixed border-collapse border-4 border-[var(--ink)] bg-[var(--panel)] text-left text-[11px] uppercase rounded-none">
        <thead>
          <tr>
            <th className="border-4 border-[var(--ink)] bg-[var(--ink)] px-2 py-2 align-top font-black text-[var(--paper)]">
              Fact
            </th>
            <th className="w-[92px] border-4 border-[var(--ink)] bg-[var(--ink)] px-2 py-2 align-top font-black text-[var(--paper)] sm:w-[116px]">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredFacts.map((fact) => (
            <tr key={fact.id}>
              <td className="break-words border-4 border-[var(--ink)] bg-[var(--paper)] px-2 py-2 align-top font-bold leading-tight">
                <div className="mb-2 flex flex-wrap gap-1 text-[10px]">
                  <span className="border-2 border-[var(--ink)] bg-[var(--panel)] px-1 py-0.5">
                    {fact.type}
                  </span>
                  <span className="border-2 border-[var(--ink)] bg-[var(--panel)] px-1 py-0.5">
                    {fact.status}
                  </span>
                </div>
                {fact.text}
                <div className="mt-2 border-t-2 border-dashed border-[var(--ink)] pt-2 text-[9px] normal-case opacity-65">
                  <div>{fact.sourceTitle}</div>
                  <div>
                    {fact.timePrecision} / {fact.confidence}
                  </div>
                </div>
              </td>
              <td className="border-4 border-[var(--ink)] bg-[var(--panel)] px-2 py-2 align-top">
                <button
                  type="button"
                  onClick={() => pinFactToBoard(fact)}
                  className="min-h-11 w-full border-2 border-[var(--ink)] bg-[var(--accent)] px-1 py-2 text-[10px] font-black uppercase leading-tight text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none"
                >
                  [ PIN TO BOARD ]
                </button>
              </td>
            </tr>
          ))}
          {filteredFacts.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="border-4 border-[var(--ink)] bg-[var(--paper)] px-2 py-4 text-center font-black"
              >
                No facts logged.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LiveFactLedger() {
  const pinFactToBoard = useMutation(({ storage }, fact: InvestigationFact) => {
    const randomOffset = () => Math.round(Math.random() * 180 - 90);
    const node: Node = {
      id: `stickyNote-${crypto.randomUUID()}`,
      type: "stickyNote",
      position: {
        x: Math.round(window.innerWidth / 2) + randomOffset(),
        y: Math.round(window.innerHeight / 2) + randomOffset(),
      },
      data: {
        text: fact.text,
        investigationId: fact.investigationId,
        sourceEntityId: fact.linkedEntityIds[0] ?? null,
        sourceType:
          fact.investigationId === "mumbai-2611"
            ? "historical-fact"
            : "investigation-fact",
        sourceFactId: fact.id,
      },
    };

    storage.get("nodes").push(serializeFlowNode(node));
  }, []);

  return <FactLedgerView pinFactToBoard={pinFactToBoard} />;
}

function LocalFactLedger() {
  const pinFactToBoard = useInvestigationStore((state) => state.pinFactToBoard);
  return <FactLedgerView pinFactToBoard={pinFactToBoard} />;
}

export function FactLedger() {
  const { isMultiplayer } = useCollaborationIdentity();
  return isMultiplayer ? <LiveFactLedger /> : <LocalFactLedger />;
}
