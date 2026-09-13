"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Building2,
  FileSearch,
  MapPin,
  Phone,
  ReceiptText,
  Shield,
  Maximize2,
  Minimize2,
  PanelTopClose,
  PanelTopOpen,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { MumbaiNetworkGraph } from "@/components/mumbai-network-graph";
import { CustomNetworkWorkspace } from "@/components/custom-network-workspace";
import { useInvestigationAccess } from "@/components/investigation-access";
import Link from "next/link";
import { AddToNetworkWorkspaceButton } from "@/components/add-to-network-workspace-button";
import { getInvestigation } from "@/data/investigations/registry";
import type { GraphLinkKind, GraphNodeKind } from "@/data/investigations/types";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

type LinkKind = GraphLinkKind;

type CaseGraphNodeData = {
  label: string;
  kind: GraphNodeKind;
  subtitle: string;
  status?: string;
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

const linkFilters: {
  id: LinkKind;
  label: string;
  tone: string;
  darkTone: string;
}[] = [
  {
    id: "financial",
    label: "Financial Transactions",
    tone: "#D22B2B",
    darkTone: "#AEC3B0",
  },
  { id: "phone", label: "Phone Calls", tone: "#111111", darkTone: "#EFF6E0" },
  {
    id: "colocation",
    label: "Co-Locations",
    tone: "#FCD34D",
    darkTone: "#598392",
  },
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

function getHopDistances(
  enabledKinds: Set<LinkKind>,
  subjectId: string | null,
  links: CaseGraphLink[],
) {
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

    for (const link of links) {
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

/* ─── Node component ──────────────────────────── */

function NetworkNode({ data, id }: NodeProps<Node<CaseGraphNodeData>>) {
  const Icon = (
    {
      suspect: UserRound,
      attacker: UserRound,
      team: UsersRound,
      organization: Building2,
      planner: FileSearch,
      evidence: FileSearch,
      location: MapPin,
      response: Shield,
      transaction: ReceiptText,
    } as const
  )[data.kind];
  const isSuspect = data.kind === "suspect" || data.kind === "attacker";
  const isTransaction = data.kind === "transaction";
  const isEvidence = data.kind === "evidence";
  const isLocation = data.kind === "location";
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );
  const setSelectedSuspectId = useInvestigationStore(
    (state) => state.setSelectedSuspectId,
  );
  const selectedEntityId = useInvestigationStore(
    (state) => state.selectedEntityId,
  );
  const setSelectedEntityId = useInvestigationStore(
    (state) => state.setSelectedEntityId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );

  // Build the node's class string based on kind + dark mode
  // Light mode uses the original brutalist colors
  // Dark mode uses the shared Figma surfaces and preserves data colors.
  let kindClasses = "";

  if (data.selected) {
    // Selected node: red highlight in both modes
    kindClasses =
      "bg-[#D22B2B] text-white dark:bg-[#D22B2B] dark:text-[var(--ink)] dark:border-[#D22B2B]";
  } else if (isSuspect || data.kind === "organization") {
    // Suspect: black in light → teal panel in dark
    kindClasses =
      "bg-black text-white dark:bg-[var(--panel)] dark:border dark:border-[var(--line)] dark:text-[var(--ink)] dark:shadow-none";
  } else if (isTransaction) {
    // Transaction: keep the light color and use a subdued accent tint in dark.
    kindClasses =
      "bg-[#FCD34D] text-black dark:bg-[var(--accent)]/15 dark:border dark:border-[var(--accent)] dark:text-[var(--ink)] dark:shadow-none";
  } else if (isEvidence || isLocation) {
    // Evidence/Location: white/parchment in light → deep void in dark
    kindClasses = `${isEvidence ? "bg-white" : "bg-[#F4F4F0]"} text-black dark:bg-[var(--paper)] dark:border dark:border-[var(--line)] dark:text-[var(--ink)] dark:shadow-none`;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${data.kind}; ${data.label}; ${data.status ?? data.subtitle}`}
      className={`group relative min-h-20 w-36 border-4 border-black p-2 font-mono uppercase shadow-[5px_5px_0_black] transition-all duration-300 rounded-none sm:min-h-24 sm:w-44 sm:p-3 dark:border-[var(--line)] ${kindClasses} ${
        data.selected ? "scale-105" : ""
      }`}
      onClick={() => {
        if (isSuspect) {
          setSelectedSuspectId(selectedSuspectId === id ? null : id);
        } else if (isLocation) {
          setSelectedLocationId(selectedEntityId === id ? null : id);
        } else {
          setSelectedEntityId(selectedEntityId === id ? null : id);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (isSuspect) {
          setSelectedSuspectId(selectedSuspectId === id ? null : id);
        } else if (isLocation) {
          setSelectedLocationId(selectedEntityId === id ? null : id);
        } else {
          setSelectedEntityId(selectedEntityId === id ? null : id);
        }
      }}
      style={{
        opacity: data.active ? 1 : 0.2,
        filter: data.active ? "none" : "grayscale(1)",
        cursor: "pointer",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-black !bg-[#F4F4F0] dark:!border-[var(--ink)] dark:!bg-[var(--panel)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-black !bg-[#D22B2B] dark:!border-[var(--accent)] dark:!bg-[var(--accent)]"
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
        <div className="mt-2 inline-block border-2 border-black bg-[#FCD34D] px-1 py-0.5 text-[10px] font-black text-black dark:border-[var(--accent)] dark:bg-transparent dark:text-[var(--accent)]">
          {data.risk} RISK
        </div>
      ) : null}
      {data.status ? (
        <div className="mt-2 inline-block border-2 border-current px-1 py-0.5 text-[9px] font-black">
          {data.status}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Edge component ──────────────────────────── */

function NetworkRedStringEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<Edge<CaseGraphEdgeData>>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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

  const outerStroke = isDark ? "#EAE5C9" : "#000000";
  const innerStroke = "#D22B2B";

  return (
    <g className="transition-opacity duration-300" style={{ opacity }}>
      <path
        d={path}
        fill="none"
        stroke={outerStroke}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth={6}
      />
      <path
        d={path}
        fill="none"
        stroke={innerStroke}
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

/* ─── Canvas ──────────────────────────────────── */

function NetworkGraphCanvas() {
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const selectedEntityId = useInvestigationStore(
    (state) => state.selectedEntityId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );
  const openLedger = useInvestigationStore((state) => state.openLedger);
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const linkFilters = activeInvestigation.graph.filters;
  const graphNodes = useMemo<CaseGraphNode[]>(
    () =>
      activeInvestigation.graph.nodes.map((node) => ({
        id: node.id,
        data: {
          label: node.label,
          kind: node.kind,
          subtitle: node.subtitle,
          status: node.status,
          risk: node.risk,
        },
        position: node.position,
        dateRange: node.dateRange,
      })),
    [activeInvestigation],
  );
  const graphLinks = useMemo<CaseGraphLink[]>(
    () =>
      activeInvestigation.graph.links.map((link) => ({
        id: link.id,
        source: link.source,
        target: link.target,
        linkKind: link.linkKind,
        label: link.label,
      })),
    [activeInvestigation],
  );

  const [enabledLinkKinds, setEnabledLinkKinds] = useState<Set<LinkKind>>(
    () => new Set(linkFilters.map((filter) => filter.id)),
  );
  const [hopLimit, setHopLimit] = useState(2);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    if (!isFiltersOpen) return;
    const closeFilters = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFiltersOpen(false);
    };
    window.addEventListener("keydown", closeFilters);
    return () => window.removeEventListener("keydown", closeFilters);
  }, [isFiltersOpen]);

  useEffect(() => {
    setEnabledLinkKinds(new Set(linkFilters.map((filter) => filter.id)));
    setHopLimit(2);
    setIsFiltersOpen(false);
  }, [activeInvestigationId]);

  const hopDistances = useMemo(
    () => getHopDistances(enabledLinkKinds, selectedEntityId, graphLinks),
    [enabledLinkKinds, graphLinks, selectedEntityId],
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
        const distance = selectedEntityId
          ? hopDistances.get(node.id)
          : undefined;
        const hopActive =
          !selectedEntityId ||
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
            selected: selectedEntityId === node.id,
          },
          draggable: false,
        };
      }),
    [graphNodes, hopDistances, hopLimit, selectedEntityId, timeRange],
  );

  const activeNodeIds = useMemo(
    () =>
      new Set(nodes.filter((node) => node.data.active).map((node) => node.id)),
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
          animated: false,
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
    [activeNodeIds, enabledLinkKinds, graphLinks, isDark],
  );

  const selectedNode = graphNodes.find((node) => node.id === selectedEntityId);
  const visibleEdgeCount = edges.filter((edge) => edge.data?.active).length;

  function toggleLinkKind(linkKind: LinkKind) {
    triggerHaptic("light");
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

  const filterControls = (
    <div className="space-y-2 p-3">
      {linkFilters.map((filter) => {
        const checked = enabledLinkKinds.has(filter.id);
        const count = graphLinks.filter(
          (link) => link.linkKind === filter.id,
        ).length;

        return (
          <label
            key={filter.id}
            className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-black bg-white px-2 py-2 shadow-[3px_3px_0_black] dark:border-[var(--line)] dark:bg-[var(--paper)] dark:text-[var(--ink)] dark:shadow-none"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleLinkKind(filter.id)}
              className="h-5 w-5 shrink-0 accent-black dark:accent-[var(--accent)]"
            />
            <span
              className="h-3 w-3 shrink-0 border-2 border-black dark:border-[var(--line)]"
              style={{
                backgroundColor: isDark ? filter.darkTone : filter.tone,
              }}
            />
            <span className="min-w-0">
              {filter.label} ({count})
            </span>
          </label>
        );
      })}

      <label className="grid min-h-11 gap-2 border-2 border-black bg-white px-2 py-2 shadow-[3px_3px_0_black] dark:border-[var(--line)] dark:bg-[var(--paper)] dark:text-[var(--ink)] dark:shadow-none">
        <span>Hops From Subject: {hopLimit}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={1}
          value={hopLimit}
          onChange={(event) => {
            triggerHaptic("light");
            setHopLimit(Number(event.target.value));
          }}
          className="fatal-time-slider w-full"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-h-11 items-center border-2 border-black bg-white px-2 py-2 dark:border-[var(--line)] dark:bg-[var(--paper)] dark:text-[var(--ink)]">
          Edges: {visibleEdgeCount}
        </div>
        <button
          type="button"
          onClick={() => setSelectedLocationId(null)}
          className="min-h-11 border-2 border-black bg-[#FCD34D] px-2 py-2 text-left text-black shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-[var(--accent)] dark:bg-[var(--accent)] dark:text-[var(--accent-ink)] dark:shadow-none dark:hover:bg-[var(--ink)] dark:hover:text-[var(--accent-ink)]"
        >
          Clear Subject
        </button>
      </div>
    </div>
  );

  return (
    <div
      data-testid="network-graph"
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#F4F4F0] dark:bg-[var(--paper)]"
    >
      {/* ── Collapsible filter box ──────────────── */}
      <aside
        data-testid="network-filter-box"
        data-network-popover={isFiltersOpen ? "true" : undefined}
        className="absolute left-3 top-3 z-50 flex max-h-[calc(100%-1.5rem)] w-[min(320px,calc(100%-1.5rem))] flex-col border-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase text-black shadow-[3px_3px_0_black] dark:border-[var(--line)] dark:bg-[var(--panel)] dark:text-[var(--ink)] dark:shadow-[0_0_16px_rgba(6,20,27,0.8)] md:left-4 md:top-4 md:shadow-[4px_4px_0_black] dark:md:shadow-[0_0_16px_rgba(6,20,27,0.8)]"
      >
        <button
          type="button"
          onClick={() =>
            setIsFiltersOpen((open) => {
              if (!open) triggerHaptic("light");
              return !open;
            })
          }
          aria-expanded={isFiltersOpen}
          aria-controls="network-link-filters"
          className="flex min-h-11 w-full shrink-0 items-center justify-between bg-black px-3 text-left text-[#F4F4F0] dark:bg-[var(--paper)] dark:text-[var(--ink)]"
        >
          <span>[ {isFiltersOpen ? "-" : "+"} ] Link Filters</span>
          <span className="text-[9px] opacity-70">
            {enabledLinkKinds.size}/{linkFilters.length} Active
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isFiltersOpen ? (
            <motion.div
              id="network-link-filters"
              className="min-h-0 overflow-y-auto border-t-4 border-black dark:border-[var(--line)]"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="max-h-[min(45dvh,430px)] sm:max-h-[min(60dvh,430px)]">
                {filterControls}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </aside>

      {/* ── Graph ───────────────────────────────── */}
      <div className="relative h-full min-h-0 w-full">
        <ReactFlow
          key={activeInvestigationId}
          nodes={nodes}
          edges={edges}
          onlyRenderVisibleElements
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.35}
          maxZoom={1.35}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          className="bg-[#F4F4F0] dark:bg-[var(--paper)]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            color={isDark ? "#EAE5C9" : "#000000"}
            gap={24}
            size={1.15}
          />

          {selectedNode ? (
            <Panel position="bottom-right" className="m-0">
              <div className="max-h-[45dvh] w-[min(320px,calc(100vw-1.5rem))] overflow-y-auto border-4 border-black bg-white p-3 font-mono text-xs font-black uppercase shadow-[6px_6px_0_black] dark:border-[var(--line)] dark:bg-[var(--panel)] dark:text-[var(--ink)] dark:shadow-[6px_6px_0_var(--ink)]">
                <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2 dark:border-[var(--line)]">
                  <Phone aria-hidden="true" size={17} strokeWidth={3} />
                  Subject Locked
                </div>
                <p className="mb-3 leading-tight">
                  {selectedNode.data.label} /{" "}
                  {selectedNode.data.status ?? selectedNode.data.kind} /{" "}
                  {hopLimit} HOPS
                </p>
                <button
                  type="button"
                  onClick={openLedger}
                  className="w-full border-4 border-black bg-[#D22B2B] px-3 py-2 text-left text-white shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none dark:border-[var(--line)] dark:shadow-[4px_4px_0_var(--ink)]"
                >
                  [ INSPECT DOSSIER ]
                </button>
                <AddToNetworkWorkspaceButton
                  source={{
                    sourceKind:
                      selectedNode.data.kind === "location"
                        ? "location"
                        : "entity",
                    sourceId: selectedNode.id,
                    label: selectedNode.data.label,
                    type:
                      selectedNode.data.kind === "location"
                        ? "location"
                        : selectedNode.data.kind === "transaction"
                          ? "transaction"
                          : selectedNode.data.kind === "evidence"
                            ? "evidence"
                            : selectedNode.data.kind === "organization"
                              ? "organization"
                              : "person",
                    description: selectedNode.data.subtitle,
                    sourceVerificationStatus:
                      activeInvestigation.type === "DEMO" ? "demo" : "verified",
                  }}
                  className="mt-2 w-full border-4 border-black bg-[#FCD34D] px-3 py-2 text-left text-[10px] font-black uppercase text-black shadow-[4px_4px_0_black] dark:border-[var(--accent)] dark:bg-[var(--accent)] dark:text-[var(--accent-ink)] dark:shadow-none"
                />
              </div>
            </Panel>
          ) : null}
        </ReactFlow>
      </div>
    </div>
  );
}

export function NetworkGraphWorkspace() {
  const { isPublicDemo } = useInvestigationAccess();
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const networkMode = useInvestigationStore((state) => state.networkMode);
  const setNetworkMode = useInvestigationStore((state) => state.setNetworkMode);
  const isFocusMode = useInvestigationStore(
    (state) => state.isNetworkFocusMode,
  );
  const setFocusMode = useInvestigationStore(
    (state) => state.setNetworkFocusMode,
  );
  const [focusToolsExpanded, setFocusToolsExpanded] = useState(true);
  const wasFocusMode = useRef(false);

  useEffect(() => {
    if (isFocusMode && !wasFocusMode.current) setFocusToolsExpanded(true);
    wasFocusMode.current = isFocusMode;
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (
        document.querySelector(
          '[role="dialog"], [data-network-popover="true"]',
        )
      )
        return;
      setFocusMode(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFocusMode, setFocusMode]);

  const modeSelector = (
    <div
      className="flex shrink-0 items-center gap-1"
      role="group"
      aria-label="Network view"
    >
      <button
        type="button"
        onClick={() => setNetworkMode("case")}
        aria-pressed={networkMode === "case"}
        className={`fatal-raised-control min-h-9 px-2.5 font-mono text-[9px] font-black uppercase sm:px-3 ${networkMode === "case" ? "!bg-[var(--ink)] !text-[var(--paper)] dark:!border-[var(--accent)] dark:!bg-[var(--accent)] dark:!text-[var(--accent-ink)]" : ""}`}
      >
        <span className="hidden xl:inline">Case graph</span>
        <span className="xl:hidden">Case</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (!isPublicDemo) setNetworkMode("workspace");
        }}
        aria-pressed={!isPublicDemo && networkMode === "workspace"}
        aria-disabled={isPublicDemo}
        title={isPublicDemo ? "Sign up to create and save a custom workspace" : undefined}
        className={`fatal-raised-control min-h-9 px-2.5 font-mono text-[9px] font-black uppercase sm:px-3 ${networkMode === "workspace" ? "fatal-raised-control--primary" : ""}`}
      >
        <span className="hidden xl:inline">Custom workspace</span>
        <span className="xl:hidden">Custom</span>
      </button>
      {isPublicDemo ? (
        <Link
          href="/?next=%2Fcases%2Fnew#signup"
          className="hidden text-[9px] font-black uppercase underline sm:inline"
        >
          Sign up to create
        </Link>
      ) : null}
    </div>
  );

  const focusButton = (
    <button
      type="button"
      onClick={() => setFocusMode(!isFocusMode)}
      className={`fatal-raised-control flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 font-mono text-[9px] font-black uppercase ${isFocusMode ? "fatal-raised-control--primary" : ""}`}
      aria-pressed={isFocusMode}
      aria-label={isFocusMode ? "Exit focus mode" : "Enter focus mode"}
      title={isFocusMode ? "Exit focus mode" : "Focus mode"}
    >
      {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      <span>{isFocusMode ? "Exit focus mode" : "Focus"}</span>
    </button>
  );

  const focusToolsButton = isFocusMode ? (
    <button
      type="button"
      onClick={() => setFocusToolsExpanded((expanded) => !expanded)}
      className="fatal-raised-control flex min-h-9 shrink-0 items-center gap-1.5 px-2.5 font-mono text-[9px] font-black uppercase"
      aria-expanded={focusToolsExpanded}
      aria-controls="network-focus-toolkit"
    >
      {focusToolsExpanded ? (
        <PanelTopClose aria-hidden="true" size={14} />
      ) : (
        <PanelTopOpen aria-hidden="true" size={14} />
      )}
      {focusToolsExpanded ? "Collapse tools" : "Expand tools"}
    </button>
  ) : null;

  const caseToolbar = (
    <div className="hide-scrollbar flex min-h-12 shrink-0 flex-wrap items-center gap-2 overflow-visible border-b-2 border-[var(--ink)] bg-[var(--paper)] px-2 py-1.5 sm:flex-nowrap sm:overflow-x-auto sm:px-3">
      {!isFocusMode || focusToolsExpanded ? (
        <div className={isFocusMode ? "hidden shrink-0 sm:block" : "shrink-0"}>
          {modeSelector}
        </div>
      ) : null}
      <span className="w-full min-w-0 flex-1 truncate font-mono text-[9px] font-black uppercase opacity-55 sm:w-auto">
        {getInvestigation(activeInvestigationId).displayName} // Authoritative
      </span>
      {isFocusMode ? (
        <div className="flex w-full min-w-0 gap-2 sm:ml-auto sm:w-auto sm:shrink-0">
          <div className="min-w-0 flex-1 [&>button]:w-full sm:flex-none sm:[&>button]:w-auto">
            {focusToolsButton}
          </div>
          <div className="min-w-0 flex-1 [&>button]:w-full sm:flex-none sm:[&>button]:w-auto">
            {focusButton}
          </div>
        </div>
      ) : (
        <div className="ml-auto">{focusButton}</div>
      )}
    </div>
  );

  if (networkMode === "workspace" && !isPublicDemo) {
    return (
      <div className="fatal-network-workspace flex h-full min-h-0 flex-col">
        <CustomNetworkWorkspace
          investigationId={activeInvestigationId}
          toolbarLeading={modeSelector}
          focusControl={focusButton}
          isFocusMode={isFocusMode}
          focusToolsExpanded={focusToolsExpanded}
          focusToolsControl={focusToolsButton}
        />
      </div>
    );
  }

  if (activeInvestigationId === "mumbai-2611") {
    return (
      <div className="fatal-network-workspace flex h-full min-h-0 flex-col">
        {caseToolbar}
        <ReactFlowProvider key="mumbai-network-graph">
          <MumbaiNetworkGraph investigation={getInvestigation("mumbai-2611")} />
        </ReactFlowProvider>
      </div>
    );
  }

  return (
    <div className="fatal-network-workspace flex h-full min-h-0 flex-col">
      {caseToolbar}
      <ReactFlowProvider key="demo-network-graph">
        <NetworkGraphCanvas />
      </ReactFlowProvider>
    </div>
  );
}
