"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { FileSearch, MapPin, Phone, ReceiptText, UserRound } from "lucide-react";
import { useInvestigationStore } from "@/store/use-investigation-store";

type GraphNodeKind = "suspect" | "evidence" | "location" | "transaction";
type LinkKind = "financial" | "phone" | "colocation";

type CaseGraphNodeData = {
  label: string;
  kind: GraphNodeKind;
  subtitle: string;
  risk?: "HIGH" | "MED" | "LOW";
  active: boolean;
  selected: boolean;
};

type CaseGraphEdgeData = {
  linkKind: LinkKind;
  label: string;
  active: boolean;
};

type CaseGraphNode = {
  id: string;
  data: Omit<CaseGraphNodeData, "active" | "selected">;
  position: { x: number; y: number };
  /** Date range during which this node is relevant (inclusive) */
  dateRange?: [string, string];
};

type CaseGraphLink = {
  id: string;
  source: string;
  target: string;
  linkKind: LinkKind;
  label: string;
};

const linkFilters: { id: LinkKind; label: string; tone: string }[] = [
  { id: "financial", label: "Financial Transactions", tone: "#D22B2B" },
  { id: "phone", label: "Phone Calls", tone: "#111111" },
  { id: "colocation", label: "Co-Locations", tone: "#FCD34D" },
];

const graphNodes: CaseGraphNode[] = [
  {
    id: "sus-ada",
    data: {
      label: "ADA CROSS",
      kind: "suspect",
      subtitle: "Station contractor",
      risk: "HIGH",
    },
    position: { x: 70, y: 210 },
    dateRange: ["2026-07-18", "2026-07-28"],
  },
  {
    id: "sus-marlowe",
    data: {
      label: "JON MARLOWE",
      kind: "suspect",
      subtitle: "Night clerk",
      risk: "MED",
    },
    position: { x: 520, y: 95 },
    dateRange: ["2026-07-18", "2026-07-28"],
  },
  {
    id: "sus-vale",
    data: {
      label: "MIRA VALE",
      kind: "suspect",
      subtitle: "Ticket auditor",
      risk: "LOW",
    },
    position: { x: 535, y: 365 },
    dateRange: ["2026-07-19", "2026-07-28"],
  },
  {
    id: "ev-ticket",
    data: {
      label: "TORN TICKET",
      kind: "evidence",
      subtitle: "Recovered from coat",
    },
    position: { x: 300, y: 210 },
    dateRange: ["2026-07-18", "2026-07-19"],
  },
  {
    id: "ev-print",
    data: {
      label: "ANNEX PRINT",
      kind: "evidence",
      subtitle: "Partial latent",
    },
    position: { x: 720, y: 235 },
    dateRange: ["2026-07-21", "2026-07-24"],
  },
  {
    id: "loc-platform",
    data: {
      label: "PLATFORM 9",
      kind: "location",
      subtitle: "Victim last seen",
    },
    position: { x: 185, y: 30 },
    dateRange: ["2026-07-18", "2026-07-20"],
  },
  {
    id: "loc-annex",
    data: {
      label: "ANNEX B",
      kind: "location",
      subtitle: "Locked service wing",
    },
    position: { x: 790, y: 45 },
    dateRange: ["2026-07-20", "2026-07-24"],
  },
  {
    id: "txn-ledger",
    data: {
      label: "$4,800 LEDGER",
      kind: "transaction",
      subtitle: "Duplicate deposit",
    },
    position: { x: 255, y: 410 },
    dateRange: ["2026-07-19", "2026-07-25"],
  },
  {
    id: "txn-shell",
    data: {
      label: "SHELL TRANSFER",
      kind: "transaction",
      subtitle: "Off-book routing",
    },
    position: { x: 785, y: 415 },
    dateRange: ["2026-07-22", "2026-07-26"],
  },
  {
    id: "loc-diner",
    data: {
      label: "RIVER DINER",
      kind: "location",
      subtitle: "Shared cell ping",
    },
    position: { x: 440, y: 515 },
    dateRange: ["2026-07-24", "2026-07-27"],
  },
];

const graphLinks: CaseGraphLink[] = [
  {
    id: "ada-ticket-call",
    source: "sus-ada",
    target: "ev-ticket",
    linkKind: "phone",
    label: "3 calls",
  },
  {
    id: "ada-platform-colocation",
    source: "sus-ada",
    target: "loc-platform",
    linkKind: "colocation",
    label: "21:14 ping",
  },
  {
    id: "ada-ledger-financial",
    source: "sus-ada",
    target: "txn-ledger",
    linkKind: "financial",
    label: "$1,200",
  },
  {
    id: "ticket-marlowe-call",
    source: "ev-ticket",
    target: "sus-marlowe",
    linkKind: "phone",
    label: "voicemail",
  },
  {
    id: "marlowe-annex-colocation",
    source: "sus-marlowe",
    target: "loc-annex",
    linkKind: "colocation",
    label: "badge echo",
  },
  {
    id: "marlowe-print-colocation",
    source: "sus-marlowe",
    target: "ev-print",
    linkKind: "colocation",
    label: "print match",
  },
  {
    id: "vale-ledger-financial",
    source: "sus-vale",
    target: "txn-ledger",
    linkKind: "financial",
    label: "$4,800",
  },
  {
    id: "vale-shell-financial",
    source: "sus-vale",
    target: "txn-shell",
    linkKind: "financial",
    label: "routing",
  },
  {
    id: "vale-diner-call",
    source: "sus-vale",
    target: "loc-diner",
    linkKind: "phone",
    label: "burner ping",
  },
  {
    id: "diner-ada-colocation",
    source: "loc-diner",
    target: "sus-ada",
    linkKind: "colocation",
    label: "same booth",
  },
  {
    id: "shell-print-financial",
    source: "txn-shell",
    target: "ev-print",
    linkKind: "financial",
    label: "invoice",
  },
  {
    id: "platform-ticket-colocation",
    source: "loc-platform",
    target: "ev-ticket",
    linkKind: "colocation",
    label: "drop site",
  },
];

const kindStyles: Record<GraphNodeKind, { bg: string; icon: typeof UserRound }> =
  {
    suspect: { bg: "#000000", icon: UserRound },
    evidence: { bg: "#FFFFFF", icon: FileSearch },
    location: { bg: "#F4F4F0", icon: MapPin },
    transaction: { bg: "#FCD34D", icon: ReceiptText },
  };

function getHopDistances(enabledKinds: Set<LinkKind>, subjectId: string | null) {
  if (!subjectId) {
    return new Map<string, number>();
  }

  const distances = new Map<string, number>([[subjectId, 0]]);
  const queue = [subjectId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId) {
      continue;
    }

    const currentDistance = distances.get(currentId) ?? 0;

    for (const link of graphLinks) {
      if (!enabledKinds.has(link.linkKind)) {
        continue;
      }

      const neighbor =
        link.source === currentId
          ? link.target
          : link.target === currentId
            ? link.source
            : null;

      if (!neighbor || distances.has(neighbor)) {
        continue;
      }

      distances.set(neighbor, currentDistance + 1);
      queue.push(neighbor);
    }
  }

  return distances;
}

function NetworkNode({ data, id }: NodeProps<Node<CaseGraphNodeData>>) {
  const Icon = kindStyles[data.kind].icon;
  const isSuspect = data.kind === "suspect";
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );
  const setSelectedSuspectId = useInvestigationStore(
    (state) => state.setSelectedSuspectId,
  );

  return (
    <div
      className={`group relative min-h-24 w-44 border-4 border-black p-3 font-mono uppercase shadow-[5px_5px_0_black] transition-all duration-300 rounded-none ${
        data.selected
          ? "scale-105 bg-[#D22B2B] text-white"
          : isSuspect
            ? "bg-black text-white"
            : "text-black"
      }`}
      onClick={() => {
        if (isSuspect) {
          setSelectedSuspectId(selectedSuspectId === id ? null : id);
        }
      }}
      style={{
        backgroundColor:
          data.selected || isSuspect ? undefined : kindStyles[data.kind].bg,
        opacity: data.active ? 1 : 0.2,
        filter: data.active ? "none" : "grayscale(1)",
        cursor: isSuspect ? "pointer" : "default",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-black !bg-[#F4F4F0]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-black !bg-[#D22B2B]"
      />
      <div className="mb-2 flex items-center justify-between gap-2 border-b-2 border-current pb-2">
        <Icon aria-hidden="true" size={18} strokeWidth={3} />
        <span className="text-[10px] font-black">{data.kind}</span>
      </div>
      <div className="text-sm font-black leading-tight">{data.label}</div>
      <div className="mt-1 text-[10px] font-bold leading-tight normal-case">
        {data.subtitle}
      </div>
      {data.risk ? (
        <div className="mt-2 inline-block border-2 border-black bg-[#FCD34D] px-1 py-0.5 text-[10px] font-black text-black">
          {data.risk} RISK
        </div>
      ) : null}
    </div>
  );
}

function NetworkRedStringEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<Edge<CaseGraphEdgeData>>) {
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const path = [
    [sourceX, sourceY],
    [sourceX + deltaX * 0.32, sourceY + deltaY * 0.2 - 20],
    [sourceX + deltaX * 0.58, sourceY + deltaY * 0.62 + 18],
    [targetX, targetY],
  ]
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
    .join(" ");

  const opacity = data?.active ? 0.95 : 0;

  return (
    <g className="transition-opacity duration-300" style={{ opacity }}>
      <path
        d={path}
        fill="none"
        stroke="#000000"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth={6}
      />
      <path
        d={path}
        fill="none"
        stroke="#D22B2B"
        strokeDasharray="8,7"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth={3}
      />
      <text>
        <textPath
          href={`#${data?.label ?? ""}`}
          startOffset="50%"
          textAnchor="middle"
        />
      </text>
    </g>
  );
}

const nodeTypes = {
  networkNode: NetworkNode,
};

const edgeTypes = {
  networkRedString: NetworkRedStringEdge,
};

function NetworkGraphCanvas() {
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );
  const setSelectedSuspectId = useInvestigationStore(
    (state) => state.setSelectedSuspectId,
  );
  const openLedger = useInvestigationStore((state) => state.openLedger);
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const [enabledLinkKinds, setEnabledLinkKinds] = useState<Set<LinkKind>>(
    () => new Set(linkFilters.map((filter) => filter.id)),
  );
  const [hopLimit, setHopLimit] = useState(2);

  const hopDistances = useMemo(
    () => getHopDistances(enabledLinkKinds, selectedSuspectId),
    [enabledLinkKinds, selectedSuspectId],
  );

  // Check if a node's date range overlaps with the global timeRange
  function isInTimeRange(node: CaseGraphNode): boolean {
    if (!node.dateRange) return true;
    const [nodeStart, nodeEnd] = node.dateRange;
    return nodeEnd >= timeRange[0] && nodeStart <= timeRange[1];
  }

  const nodes = useMemo<Node<CaseGraphNodeData>[]>(
    () =>
      graphNodes.map((node) => {
        const distance = selectedSuspectId
          ? hopDistances.get(node.id)
          : undefined;
        const hopActive =
          !selectedSuspectId ||
          (typeof distance === "number" && distance <= hopLimit);
        const temporalActive = isInTimeRange(node);
        const active = hopActive && temporalActive;

        return {
          id: node.id,
          type: "networkNode",
          position: node.position,
          data: {
            ...node.data,
            active,
            selected: selectedSuspectId === node.id,
          },
          draggable: false,
        };
      }),
    [hopDistances, hopLimit, selectedSuspectId, timeRange],
  );

  const activeNodeIds = useMemo(
    () =>
      new Set(
        nodes.filter((node) => node.data.active).map((node) => node.id),
      ),
    [nodes],
  );

  const edges = useMemo<Edge<CaseGraphEdgeData>[]>(
    () =>
      graphLinks.map((link) => {
        const active =
          enabledLinkKinds.has(link.linkKind) &&
          activeNodeIds.has(link.source) &&
          activeNodeIds.has(link.target);

        return {
          id: link.id,
          source: link.source,
          target: link.target,
          type: "networkRedString",
          animated: active,
          data: {
            linkKind: link.linkKind,
            label: link.label,
            active,
          },
          markerEnd: active
            ? {
                type: MarkerType.ArrowClosed,
                color: "#D22B2B",
                width: 18,
                height: 18,
              }
            : undefined,
          style: {
            pointerEvents: active ? "auto" : "none",
            transition: "opacity 300ms ease",
          },
        };
      }),
    [activeNodeIds, enabledLinkKinds],
  );

  const selectedNode = graphNodes.find((node) => node.id === selectedSuspectId);
  const visibleEdgeCount = edges.filter((edge) => edge.data?.active).length;

  function toggleLinkKind(linkKind: LinkKind) {
    setEnabledLinkKinds((currentKinds) => {
      const nextKinds = new Set(currentKinds);

      if (nextKinds.has(linkKind)) {
        nextKinds.delete(linkKind);
      } else {
        nextKinds.add(linkKind);
      }

      return nextKinds;
    });
  }

  return (
    <div className="grid h-full min-h-[640px] bg-[#F4F4F0] lg:grid-cols-[330px_1fr]">
      <aside className="z-10 border-b-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase lg:border-b-0 lg:border-r-4">
        <div className="border-b-4 border-black bg-black px-3 py-2 text-[#F4F4F0]">
          Link Filters
        </div>
        <div className="space-y-2 p-3">
          {linkFilters.map((filter) => {
            const checked = enabledLinkKinds.has(filter.id);
            const count = graphLinks.filter(
              (link) => link.linkKind === filter.id,
            ).length;

            return (
              <label
                key={filter.id}
                className="flex cursor-pointer items-center gap-2 border-2 border-black bg-white px-2 py-2 shadow-[3px_3px_0_black]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleLinkKind(filter.id)}
                  className="h-4 w-4 shrink-0 accent-black"
                />
                <span
                  className="h-3 w-3 shrink-0 border-2 border-black"
                  style={{ backgroundColor: filter.tone }}
                />
                <span className="min-w-0">
                  {filter.label} ({count})
                </span>
              </label>
            );
          })}

          <label className="grid gap-2 border-2 border-black bg-white px-2 py-2 shadow-[3px_3px_0_black]">
            <span>Hops From Subject: {hopLimit}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={hopLimit}
              onChange={(event) => setHopLimit(Number(event.target.value))}
              className="fatal-time-slider w-full"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div className="border-2 border-black bg-white px-2 py-2">
              Edges: {visibleEdgeCount}
            </div>
            <button
              type="button"
              onClick={() => setSelectedSuspectId(null)}
              className="border-2 border-black bg-[#FCD34D] px-2 py-2 text-left shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Clear Subject
            </button>
          </div>
        </div>
      </aside>

      <div className="relative min-h-[520px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.55}
        maxZoom={1.35}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        className="bg-[#F4F4F0]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#000000"
          gap={24}
          size={1.15}
        />

        {selectedNode ? (
          <Panel position="bottom-right" className="m-0">
            <div className="max-w-[320px] border-4 border-black bg-white p-3 font-mono text-xs font-black uppercase shadow-[6px_6px_0_black]">
              <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2">
                <Phone aria-hidden="true" size={17} strokeWidth={3} />
                Subject Locked
              </div>
              <p className="mb-3 leading-tight">
                {selectedNode.data.label} /{" "}
                {selectedNode.data.risk ?? "UNKNOWN"} RISK / {hopLimit} HOPS
              </p>
              <button
                type="button"
                onClick={openLedger}
                className="w-full border-4 border-black bg-[#D22B2B] px-3 py-2 text-left text-white shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                [ INSPECT DOSSIER ]
              </button>
            </div>
          </Panel>
        ) : null}
      </ReactFlow>
      </div>
    </div>
  );
}

export function NetworkGraphWorkspace() {
  return (
    <ReactFlowProvider>
      <NetworkGraphCanvas />
    </ReactFlowProvider>
  );
}
