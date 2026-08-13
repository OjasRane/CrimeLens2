"use client";

import {
  createContext,
  memo,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FileSearch,
  Gavel,
  MapPin,
  Shield,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import type {
  GraphLinkKind,
  GraphNodeKind,
  Investigation,
  InvestigationGraphNode,
  InvestigationRoute,
} from "@/data/investigations/types";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

type OptionalLayer = "planning";

type StoryNodeData = {
  label: string;
  kind: GraphNodeKind;
  typeLabel: string;
  subtitle: string;
  badge?: string;
  detail: string;
  sourceLabel: string;
  inTimeRange: boolean;
  expandable?: boolean;
  expanded?: boolean;
  compact?: boolean;
  tooltipSide?: "left" | "right";
  onSelect: () => void;
  onPreview?: (hovered: boolean) => void;
};

type StoryEdgeData = {
  linkKind: GraphLinkKind;
  label: string;
  optional: boolean;
  visibleWhenSelected?: string;
  laneOffset: number;
  routing?: "top-bus" | "bottom-bus";
};

type LaneNodeData = {
  index: string;
  label: string;
  subtitle: string;
};

type PlanningLaneNodeData = {
  enabled: boolean;
  onToggle: () => void;
};

type TeamBandNodeData = {
  label: string;
};

type TeamClusterNodeData = { label: string };

type GraphFocusContextValue = {
  selectedEntityId: string | null;
  focusedNodeIds: Set<string> | null;
  isPreviewingTeam: boolean;
};

const GraphFocusContext = createContext<GraphFocusContextValue>({
  selectedEntityId: null,
  focusedNodeIds: null,
  isPreviewingTeam: false,
});

type NodePresentation = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  typeLabel: string;
  subtitle: string;
  badge?: string;
  detail: string;
  sourceLabel: string;
  connections: string[];
};

const CORE_LOCATION_IDS = [
  "loc-cst",
  "loc-cama",
  "loc-girgaum",
  "loc-leopold",
  "loc-taj",
  "loc-nariman",
  "loc-oberoi",
] as const;

const LANE_HEIGHT = 650;
const LANE_HEADER_HEIGHT = 46;
const TEAM_CARD_HEIGHT = 92;

const LANES = {
  planning: {
    x: 0,
    width: 255,
    index: "01",
    label: "ORGANIZATION / PLANNING",
    subtitle: "Command + surveillance",
  },
  teams: {
    x: 285,
    width: 440,
    index: "02",
    label: "ATTACK TEAMS",
    subtitle: "Five collapsed pairs",
  },
  locations: {
    x: 755,
    width: 730,
    index: "03",
    label: "PRIMARY LOCATIONS",
    subtitle: "Investigative centerline",
  },
} as const;

const TEAM_ROW_Y = [122, 228, 334, 440, 546] as const;
const LOCATION_POSITIONS: Record<
  (typeof CORE_LOCATION_IDS)[number],
  { x: number; y: number }
> = {
  "loc-cst": { x: 755, y: 124 },
  "loc-cama": { x: 1005, y: 124 },
  "loc-girgaum": { x: 1255, y: 124 },
  "loc-leopold": { x: 795, y: 230 },
  "loc-taj": { x: 1085, y: 283 },
  "loc-nariman": { x: 1060, y: 442 },
  "loc-oberoi": { x: 1060, y: 548 },
};

const GRAPH_FIT_VIEW_OPTIONS = {
  padding: { top: "1%", right: "7%", bottom: "5%", left: "7%" },
  minZoom: 0.44,
  maxZoom: 1.15,
  duration: 240,
} as const;

function teamIdForRoute(route: InvestigationRoute) {
  return route.id.replace("route-", "");
}

function sourceLabelFor(sourceRef: string) {
  if (
    sourceRef.includes("supremecourt") ||
    sourceRef.includes("sci.gov") ||
    sourceRef.includes("indiankanoon")
  ) {
    return "SUPREME COURT RECORD / 29 AUG 2012";
  }

  if (sourceRef.includes("justice.gov")) {
    return "U.S. DEPARTMENT OF JUSTICE RECORD";
  }

  return "VERIFIED CASE RECORD";
}

function LaneNode({ data }: NodeProps<Node<LaneNodeData>>) {
  return (
    <div className="relative h-full w-full border-x-2 border-dashed border-black/20 bg-white/35 font-mono text-black dark:border-[#598392]/35 dark:bg-[#124559]/10 dark:text-[#EFF6E0]">
      <div className="relative z-10 flex h-[46px] items-center justify-between gap-3 border-y-4 border-black bg-black px-3 py-1 text-white dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0]">
        <div className="min-w-0">
          <span className="text-[9px] font-black opacity-55">
            COL {data.index}
          </span>
          <div className="truncate text-[12px] font-black leading-tight">
            {data.label}
          </div>
        </div>
        <span className="hidden shrink-0 text-[8px] font-bold opacity-50 xl:block">
          {data.subtitle}
        </span>
      </div>
    </div>
  );
}

function PlanningLaneNode({ data }: NodeProps<Node<PlanningLaneNodeData>>) {
  return (
    <div className="h-full w-full border-x-2 border-dashed border-black/20 bg-white/35 font-mono text-black dark:border-[#598392]/35 dark:bg-[#124559]/10 dark:text-[#EFF6E0]">
      <div className="flex h-[46px] items-center justify-between gap-2 border-y-4 border-black bg-black px-3 text-white dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0]">
        <div className="min-w-0">
          <div className="text-[8px] font-black opacity-55">COL 01</div>
          <div className="truncate text-[11px] font-black uppercase">
            ORGANIZATION / PLANNING
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle();
          }}
          className={`nodrag nopan shrink-0 border-2 px-2 py-1 text-[8px] font-black uppercase ${
            data.enabled
              ? "border-[#FCD34D] bg-[#FCD34D] text-black dark:border-[#AEC3B0] dark:bg-[#AEC3B0] dark:text-[#01161E]"
              : "border-white bg-black text-white dark:border-[#AEC3B0] dark:bg-[#01161E] dark:text-[#EFF6E0]"
          }`}
        >
          [{data.enabled ? "−" : "+"} PLANNING]
        </button>
      </div>
    </div>
  );
}

function TeamBandNode({ data }: NodeProps<Node<TeamBandNodeData>>) {
  return (
    <div className="relative h-full w-full border-t border-dashed border-black/15 dark:border-[#598392]/25">
      <span className="absolute -top-2.5 left-1 bg-[#F4F4F0] px-1 font-mono text-[8px] font-black uppercase text-black/40 dark:bg-[#01161E] dark:text-[#AEC3B0]/50">
        {data.label}
      </span>
    </div>
  );
}

function TeamClusterNode() {
  const { focusedNodeIds } = useContext(GraphFocusContext);
  const active = !focusedNodeIds || focusedNodeIds.has("attack-team-cluster");

  return (
    <div
      className="h-[46px] w-[240px] border-3 border-black bg-white px-3 py-1.5 font-mono uppercase text-black shadow-[3px_3px_0_black] dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0] dark:shadow-[3px_3px_0_#01161E]"
      style={{ opacity: active ? 1 : 0.18 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-none !border-2 !border-black !bg-white dark:!border-[#598392] dark:!bg-[#AEC3B0]"
      />
      <div className="text-[11px] font-black">ATTACK TEAMS / GROUP</div>
      <div className="text-[8px] font-bold opacity-55">5 operational pairs</div>
    </div>
  );
}

const StoryNode = memo(function StoryNode({
  data,
  id,
}: NodeProps<Node<StoryNodeData>>) {
  const { focusedNodeIds, isPreviewingTeam, selectedEntityId } =
    useContext(GraphFocusContext);
  const Icon = (
    {
      attacker: UserRound,
      team: UsersRound,
      organization: Building2,
      planner: FileSearch,
      location: MapPin,
      response: Shield,
      evidence: Gavel,
      suspect: UserRound,
      transaction: FileSearch,
    } as const
  )[data.kind];
  const isActor = ["attacker", "team", "organization"].includes(data.kind);
  const isTeam = data.kind === "team";
  const isLocation = data.kind === "location";
  const isSelected = selectedEntityId === id;
  const isActive =
    data.inTimeRange && (!focusedNodeIds || focusedNodeIds.has(id));
  const widthClass = data.compact
    ? "w-[200px]"
    : isTeam
      ? "w-[240px]"
      : isLocation
        ? "w-[230px]"
        : "w-[230px]";
  const heightClass = data.compact
    ? "min-h-[64px]"
    : isTeam
      ? "h-[92px]"
      : isLocation
        ? "h-[88px]"
        : "min-h-[82px]";
  const palette = isSelected
    ? "bg-[#FCD34D] text-black dark:bg-[#AEC3B0] dark:text-[#01161E]"
    : isActor
      ? "bg-black text-white dark:bg-[#124559] dark:text-[#EFF6E0]"
      : "bg-[#F4F4F0] text-black dark:bg-[#01161E] dark:text-[#EFF6E0]";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        data.onSelect();
      }}
      onMouseEnter={data.onPreview ? () => data.onPreview?.(true) : undefined}
      onMouseLeave={data.onPreview ? () => data.onPreview?.(false) : undefined}
      onFocus={data.onPreview ? () => data.onPreview?.(true) : undefined}
      onBlur={data.onPreview ? () => data.onPreview?.(false) : undefined}
      aria-label={`${data.typeLabel}: ${data.label}. ${data.subtitle}`}
      aria-expanded={data.expandable ? data.expanded : undefined}
      title={isLocation ? "Click to inspect location details" : undefined}
      className={`nodrag nopan group relative ${heightClass} ${widthClass} rounded-none border-4 border-black ${isTeam || data.compact ? "p-2" : "p-3"} text-left font-mono uppercase shadow-[5px_5px_0_black] dark:border-[#598392] dark:shadow-[5px_5px_0_#01161E] ${palette}`}
      style={{
        opacity: isActive
          ? 1
          : selectedEntityId
            ? 0.18
            : isPreviewingTeam
              ? 0.44
              : 0.16,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-none !border-2 !border-black !bg-[#F4F4F0] dark:!border-[#598392] dark:!bg-[#AEC3B0]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-none !border-2 !border-black !bg-[#F4F4F0] dark:!border-[#598392] dark:!bg-[#AEC3B0]"
      />

      {isLocation ? (
        <>
          <div className="truncate text-[17px] font-black leading-none tracking-[-0.02em]">
            {data.label}
          </div>
          {data.badge ? (
            <div className="mt-2 truncate text-[10px] font-black text-[#D22B2B] dark:text-[#AEC3B0]">
              {data.badge}
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-1.5 border-t-2 border-current pt-1.5 opacity-65">
            <Icon aria-hidden="true" size={13} strokeWidth={3} />
            <span className="truncate text-[8px] font-black tracking-[0.1em]">
              {data.typeLabel}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="mb-1.5 flex items-center justify-between gap-2 border-b-2 border-current pb-1.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <Icon aria-hidden="true" size={15} strokeWidth={3} />
              <span className="truncate text-[9px] font-black tracking-[0.12em]">
                {data.typeLabel}
              </span>
            </span>
            {data.expandable ? (
              data.expanded ? (
                <ChevronDown aria-hidden="true" size={17} strokeWidth={4} />
              ) : (
                <ChevronRight aria-hidden="true" size={17} strokeWidth={4} />
              )
            ) : null}
          </div>

          <div className="line-clamp-2 text-[15px] font-black leading-[1.02]">
            {data.label}
          </div>
          {!data.compact ? (
            <div
              className={`mt-1 truncate text-[10px] font-bold normal-case opacity-75 ${isTeam ? "max-w-[150px]" : ""}`}
            >
              {data.subtitle}
            </div>
          ) : null}
          {data.badge ? (
            <span
              className={`${isTeam ? "absolute bottom-2 right-2" : "mt-1.5 inline-block"} max-w-full truncate border-2 border-current px-1 py-0.5 text-[9px] font-black`}
            >
              {data.badge}
            </span>
          ) : null}
        </>
      )}

      {!isLocation && !isTeam ? (
        <div
          role="tooltip"
          className={`pointer-events-none invisible absolute top-0 z-[100] w-60 border-4 border-black bg-white p-2.5 text-black opacity-0 shadow-[5px_5px_0_black] transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0] dark:shadow-[5px_5px_0_#01161E] ${
            data.tooltipSide === "left"
              ? "right-[calc(100%+12px)]"
              : "left-[calc(100%+12px)]"
          }`}
        >
          <div className="mb-1 border-b-2 border-current pb-1 text-[8px] font-black opacity-60">
            QUICK CONTEXT
          </div>
          <p className="line-clamp-4 text-[9px] font-bold leading-tight normal-case">
            {data.detail}
          </p>
          <p className="mt-2 text-[8px] font-black text-[#D22B2B] dark:text-[#AEC3B0]">
            {data.expandable ? "CLICK TO EXPAND + FOCUS" : "CLICK TO FOCUS"}
          </p>
        </div>
      ) : null}
    </button>
  );
});

const StoryEdge = memo(function StoryEdge({
  id,
  data,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<Edge<StoryEdgeData>>) {
  const [hovered, setHovered] = useState(false);
  const { resolvedTheme } = useTheme();
  const { focusedNodeIds, isPreviewingTeam, selectedEntityId } =
    useContext(GraphFocusContext);
  const isDark = resolvedTheme === "dark";
  const visibleForFocus =
    !data?.visibleWhenSelected || data.visibleWhenSelected === selectedEntityId;
  const active =
    !focusedNodeIds ||
    (focusedNodeIds.has(source) && focusedNodeIds.has(target));
  const highlighted = Boolean(selectedEntityId) && active && !data?.optional;
  const previewed = isPreviewingTeam && active;
  const middleX = sourceX + (targetX - sourceX) * 0.5 + (data?.laneOffset ?? 0);
  const busY =
    data?.routing === "bottom-bus"
      ? LANE_HEIGHT - 8 + (data?.laneOffset ?? 0) * 0.25
      : LANE_HEADER_HEIGHT + 16 + (data?.laneOffset ?? 0) * 0.35;
  const busX = LANES.locations.x - 18 + (data?.laneOffset ?? 0);
  const path =
    data?.routing === "top-bus" || data?.routing === "bottom-bus"
      ? `M ${sourceX} ${sourceY} V ${busY} H ${busX} V ${targetY} H ${targetX}`
      : `M ${sourceX} ${sourceY} H ${middleX} V ${targetY} H ${targetX}`;
  const labelX = data?.routing ? busX : middleX;
  const labelY = data?.routing
    ? busY + (targetY - busY) * 0.5
    : sourceY + (targetY - sourceY) * 0.5;
  const selectedPath = highlighted;
  const previewPath = previewed;
  const hoverPath = hovered && !selectedPath;
  const opacity = !active
    ? 0.05
    : selectedPath
      ? 1
      : previewPath || hoverPath
        ? 0.94
        : data?.optional
          ? 0.34
          : 0.62;
  const showLabel = hovered || highlighted;
  const restingStroke = isDark ? "#598392" : "#4B5563";
  const interactiveStroke = isDark ? "#EFF6E0" : "#000000";
  const stroke = selectedPath
    ? "#D22B2B"
    : previewPath || hoverPath
      ? interactiveStroke
      : restingStroke;
  const strokeWidth = selectedPath
    ? 3
    : previewPath || hoverPath
      ? 2.35
      : data?.linkKind === "planning"
        ? 1.15
        : 1.65;
  const markerId = `focus-arrow-${id}`;

  if (!visibleForFocus) return null;

  return (
    <g
      style={{ opacity }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#D22B2B" />
        </marker>
      </defs>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke" }}
      />
      {selectedPath ? (
        <path
          d={path}
          fill="none"
          stroke={isDark ? "#01161E" : "#000000"}
          strokeLinecap="square"
          strokeLinejoin="miter"
          strokeWidth={5}
        />
      ) : null}
      <path
        id={`${id}-path`}
        d={path}
        fill="none"
        markerEnd={selectedPath ? `url(#${markerId})` : undefined}
        stroke={stroke}
        strokeDasharray={data?.linkKind === "planning" ? "7 6" : undefined}
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeWidth={strokeWidth}
      />
      {showLabel ? (
        <foreignObject
          x={labelX - 76}
          y={labelY - 16}
          width={152}
          height={32}
          className="overflow-visible"
          style={{ pointerEvents: "none" }}
        >
          <div className="border-2 border-black bg-[#FCD34D] px-1.5 py-1 text-center font-mono text-[8px] font-black uppercase leading-tight text-black shadow-[2px_2px_0_black] dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0] dark:shadow-[2px_2px_0_#01161E]">
            {data?.label}
          </div>
        </foreignObject>
      ) : null}
    </g>
  );
});

const nodeTypes = {
  storyNode: StoryNode,
  laneNode: LaneNode,
  planningLaneNode: PlanningLaneNode,
  teamBandNode: TeamBandNode,
  teamClusterNode: TeamClusterNode,
};

const edgeTypes = {
  storyEdge: StoryEdge,
};

function buildPresentation(
  investigation: Investigation,
  node: InvestigationGraphNode,
): NodePresentation {
  const location = investigation.map.locations.find(
    (item) => item.graphNodeId === node.id || item.id === node.id,
  );
  const route = investigation.map.routes.find(
    (item) =>
      teamIdForRoute(item) === node.id ||
      item.memberEntityIds.includes(node.id),
  );
  const relatedRoutes = investigation.map.routes.filter((item) =>
    item.locationIds.includes(node.id),
  );
  const kindLabels: Record<GraphNodeKind, string> = {
    attacker: "ATTACKER",
    team: "ATTACK TEAM",
    organization: "ORGANIZATION",
    planner: "PLANNING",
    location: location?.type ?? "LOCATION",
    response: "POLICE RESPONSE",
    evidence: "LEGAL SOURCE",
    suspect: "SUBJECT",
    transaction: "TRANSACTION",
  };
  const casualtyBadge = location
    ? `${location.killed ?? 0} KILLED / ${location.injured ?? 0} INJURED`
    : undefined;

  let detail = node.subtitle;
  let connections: string[] = [];

  if (node.kind === "team" && route) {
    detail = route.description;
    connections = [
      `${route.memberEntityIds.length} identified members`,
      `${route.locationIds.filter((id) => CORE_LOCATION_IDS.includes(id as (typeof CORE_LOCATION_IDS)[number])).length} primary story locations`,
    ];
  } else if (node.kind === "attacker" && route) {
    const locations = route.locationIds
      .map(
        (id) =>
          investigation.map.locations.find((item) => item.id === id)?.title,
      )
      .filter(Boolean);
    detail = `Member of ${route.label}. Associated graph locations: ${locations.join(" → ")}.`;
    connections = [`${route.label} / paired team`];
  } else if (location) {
    detail = location.description;
    connections = [
      `${relatedRoutes.length} related team${relatedRoutes.length === 1 ? "" : "s"}`,
    ];
  } else if (node.kind === "organization") {
    detail =
      "Organization connected to the five documented team assignments in this reconstruction.";
    connections = ["5 attack teams", "Planning record available"];
  } else if (node.kind === "planner") {
    const planningTargets = investigation.graph.links.filter(
      (link) => link.source === node.id && link.linkKind === "planning",
    ).length;
    detail =
      investigation.facts.find((fact) => fact.id === "mum-fact-headley")
        ?.text ?? node.subtitle;
    connections = [
      `${planningTargets} planning links`,
      "Target-location context only",
    ];
  } else if (node.kind === "response") {
    detail =
      investigation.timeline.events.find((event) => event.id === "MUM-TL-012")
        ?.description ?? node.subtitle;
    connections = ["Girgaum Chowpatty", "Legal source record"];
  } else if (node.kind === "evidence") {
    detail =
      investigation.facts.find((fact) => fact.id === "mum-fact-totals")?.text ??
      node.subtitle;
    connections = ["Verified casualty ledger", "Primary location records"];
  }

  return {
    id: node.id,
    label: node.label,
    kind: node.kind,
    typeLabel: kindLabels[node.kind],
    subtitle:
      node.kind === "location"
        ? node.subtitle.replace(
            /\d+ killed \/ \d+ injured/i,
            location?.type ?? "LOCATION",
          )
        : node.subtitle,
    badge: casualtyBadge ?? node.status,
    detail,
    sourceLabel: sourceLabelFor(node.sourceRef),
    connections,
  };
}

export function MumbaiNetworkGraph({
  investigation,
}: {
  investigation: Investigation;
}) {
  const setGlobalSelectedEntityId = useInvestigationStore(
    (state) => state.setSelectedEntityId,
  );
  const setGlobalSelectedSuspectId = useInvestigationStore(
    (state) => state.setSelectedSuspectId,
  );
  const setGlobalSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );
  const openLedger = useInvestigationStore((state) => state.openLedger);
  const isLedgerOpen = useInvestigationStore((state) => state.isLedgerOpen);
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    () => useInvestigationStore.getState().selectedEntityId,
  );
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(
    null,
  );
  const pendingGlobalSync = useRef<
    { type: "idle" | "timeout"; id: number } | undefined
  >(undefined);
  const [layers, setLayers] = useState<Record<OptionalLayer, boolean>>({
    planning: false,
  });
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (!flowInstance) return;
    const timeout = window.setTimeout(() => {
      void flowInstance.fitView(GRAPH_FIT_VIEW_OPTIONS);
    }, 330);

    return () => window.clearTimeout(timeout);
  }, [flowInstance, isLedgerOpen]);

  useEffect(
    () => () => {
      const pending = pendingGlobalSync.current;
      if (!pending) return;
      if (pending.type === "idle") {
        window.cancelIdleCallback(pending.id);
      } else {
        window.clearTimeout(pending.id);
      }
    },
    [],
  );

  function scheduleGlobalSync(update: () => void) {
    const pending = pendingGlobalSync.current;
    if (pending?.type === "idle") window.cancelIdleCallback(pending.id);
    if (pending?.type === "timeout") window.clearTimeout(pending.id);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(
        () => {
          pendingGlobalSync.current = undefined;
          startTransition(update);
        },
        { timeout: 250 },
      );
      pendingGlobalSync.current = { type: "idle", id };
      return;
    }

    const id = window.setTimeout(() => {
      pendingGlobalSync.current = undefined;
      startTransition(update);
    }, 0);
    pendingGlobalSync.current = { type: "timeout", id };
  }

  const nodeById = useMemo(
    () => new Map(investigation.graph.nodes.map((node) => [node.id, node])),
    [investigation.graph.nodes],
  );
  const routes = investigation.map.routes;
  const teamIds = useMemo(
    () => routes.map((route) => teamIdForRoute(route)),
    [routes],
  );
  const presentationById = useMemo(
    () =>
      new Map(
        investigation.graph.nodes.map((node) => [
          node.id,
          buildPresentation(investigation, node),
        ]),
      ),
    [investigation],
  );

  const selectedNode = selectedEntityId
    ? nodeById.get(selectedEntityId)
    : undefined;
  const selectedRoute = useMemo(
    () =>
      routes.find(
        (route) =>
          teamIdForRoute(route) === selectedEntityId ||
          route.memberEntityIds.includes(selectedEntityId ?? ""),
      ),
    [routes, selectedEntityId],
  );
  const selectedLocationRoutes = useMemo(
    () =>
      routes.filter((route) =>
        route.locationIds.includes(selectedEntityId ?? ""),
      ),
    [routes, selectedEntityId],
  );

  const effectiveExpandedTeamIds = useMemo(() => {
    if (!selectedRoute) return expandedTeamIds;
    return new Set([teamIdForRoute(selectedRoute)]);
  }, [expandedTeamIds, selectedRoute]);

  const relatedNodeIds = useMemo(() => {
    if (!selectedEntityId) return null;

    const related = new Set<string>([selectedEntityId]);

    if (selectedRoute) {
      related.add(teamIdForRoute(selectedRoute));
      if (selectedNode?.kind === "attacker") {
        related.add(selectedNode.id);
      } else if (selectedNode?.kind === "team") {
        selectedRoute.memberEntityIds.forEach((id) => related.add(id));
      }
      selectedRoute.locationIds
        .filter((id) =>
          CORE_LOCATION_IDS.includes(id as (typeof CORE_LOCATION_IDS)[number]),
        )
        .forEach((id) => related.add(id));
    } else if (selectedNode?.kind === "location") {
      selectedLocationRoutes.forEach((route) => {
        related.add(teamIdForRoute(route));
      });
    }

    if (selectedEntityId === "org-let") {
      related.add("attack-team-cluster");
      teamIds.forEach((id) => related.add(id));
      if (layers.planning) related.add("planner-headley");
    }

    if (selectedEntityId === "planner-headley") {
      related.add("org-let");
      investigation.graph.links
        .filter(
          (link) =>
            link.source === "planner-headley" && link.linkKind === "planning",
        )
        .forEach((link) => related.add(link.target));
    }

    return related;
  }, [
    investigation.graph.links,
    layers.planning,
    routes,
    selectedEntityId,
    selectedLocationRoutes,
    selectedNode?.kind,
    selectedRoute,
    teamIds,
  ]);

  const previewNodeIds = useMemo(() => {
    if (selectedEntityId || !hoveredTeamId) return null;
    const route = routes.find((item) => teamIdForRoute(item) === hoveredTeamId);
    if (!route) return null;

    return new Set<string>([
      hoveredTeamId,
      ...route.locationIds.filter((id) =>
        CORE_LOCATION_IDS.includes(id as (typeof CORE_LOCATION_IDS)[number]),
      ),
    ]);
  }, [hoveredTeamId, routes, selectedEntityId]);

  const focusedNodeIds = relatedNodeIds ?? previewNodeIds;
  const isPreviewingTeam = Boolean(previewNodeIds && !selectedEntityId);

  function nodeIsInTimeRange(node: InvestigationGraphNode) {
    if (!node.dateRange) return true;
    return (
      node.dateRange[1] >= timeRange[0] && node.dateRange[0] <= timeRange[1]
    );
  }

  function clearFocus() {
    setSelectedEntityId(null);
    setExpandedTeamIds((current) => (current.size === 0 ? current : new Set()));
    setHoveredTeamId(null);
    scheduleGlobalSync(() => setGlobalSelectedEntityId(null));
  }

  function selectNode(id: string, kind: GraphNodeKind) {
    triggerHaptic("light");
    setHoveredTeamId(null);

    if (kind === "team") {
      const isExpanded = effectiveExpandedTeamIds.has(id);
      setExpandedTeamIds(isExpanded ? new Set() : new Set([id]));
      setSelectedEntityId(isExpanded ? null : id);
      scheduleGlobalSync(() =>
        setGlobalSelectedEntityId(isExpanded ? null : id),
      );
      return;
    }

    if (kind === "attacker" || kind === "suspect") {
      if (selectedEntityId === id) {
        clearFocus();
        return;
      }
      setExpandedTeamIds((current) =>
        current.size === 0 ? current : new Set(),
      );
      setSelectedEntityId(id);
      scheduleGlobalSync(() => setGlobalSelectedSuspectId(id));
      return;
    }

    if (kind === "location") {
      if (selectedEntityId === id) {
        clearFocus();
        return;
      }
      setExpandedTeamIds((current) =>
        current.size === 0 ? current : new Set(),
      );
      setSelectedEntityId(id);
      scheduleGlobalSync(() => setGlobalSelectedLocationId(id));
      return;
    }

    if (selectedEntityId === id) {
      clearFocus();
      return;
    }
    setExpandedTeamIds((current) => (current.size === 0 ? current : new Set()));
    setSelectedEntityId(id);
    scheduleGlobalSync(() => setGlobalSelectedEntityId(id));
  }

  const selectedEntityIdRef = useRef(selectedEntityId);
  selectedEntityIdRef.current = selectedEntityId;
  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;
  const clearFocusRef = useRef(clearFocus);
  clearFocusRef.current = clearFocus;
  const onPaneClick = useMemo(() => () => clearFocusRef.current(), []);

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>(["org-let", ...teamIds, ...CORE_LOCATION_IDS]);

    effectiveExpandedTeamIds.forEach((teamId) => {
      routes
        .find((route) => teamIdForRoute(route) === teamId)
        ?.memberEntityIds.forEach((id) => ids.add(id));
    });
    if (layers.planning) ids.add("planner-headley");

    return ids;
  }, [effectiveExpandedTeamIds, layers.planning, routes, teamIds]);

  const nodes = useMemo<
    Node<
      | StoryNodeData
      | LaneNodeData
      | PlanningLaneNodeData
      | TeamBandNodeData
      | TeamClusterNodeData
    >[]
  >(() => {
    const laneNodes = Object.entries(LANES)
      .filter(([key]) => key !== "planning")
      .map(([key, lane]) => ({
        id: `lane-${key}`,
        type: "laneNode",
        position: { x: lane.x, y: 0 },
        data: {
          index: lane.index,
          label: lane.label,
          subtitle: lane.subtitle,
        },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -10,
        style: {
          width: lane.width,
          height: LANE_HEIGHT,
          pointerEvents: "none" as const,
        },
      }));

    const planningLaneNode: Node<PlanningLaneNodeData> = {
      id: "lane-planning",
      type: "planningLaneNode",
      position: { x: LANES.planning.x, y: 0 },
      data: {
        enabled: layers.planning,
        onToggle: () => toggleLayer("planning"),
      },
      draggable: false,
      selectable: true,
      focusable: false,
      zIndex: 2,
      style: {
        width: LANES.planning.width,
        height: LANE_HEIGHT,
      },
    };

    const teamBandNodes: Node<TeamBandNodeData>[] = TEAM_ROW_Y.map(
      (rowY, index) => ({
        id: `team-band-${index + 1}`,
        type: "teamBandNode",
        position: {
          x: LANES.teams.x + 8,
          y: rowY + TEAM_CARD_HEIGHT / 2,
        },
        data: { label: `Operational lane 0${index + 1}` },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -5,
        style: {
          width:
            LANES.locations.x + LANES.locations.width - (LANES.teams.x + 16),
          height: 1,
          pointerEvents: "none" as const,
        },
      }),
    );

    const clusterNode: Node<TeamClusterNodeData> = {
      id: "attack-team-cluster",
      type: "teamClusterNode",
      position: { x: LANES.teams.x + 18, y: LANE_HEADER_HEIGHT + 26 },
      data: { label: "ATTACK TEAMS / GROUP" },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 5,
    };

    const storyNodes: Node<StoryNodeData>[] = [];

    function pushNode(
      id: string,
      position: { x: number; y: number },
      options: {
        compact?: boolean;
        expandable?: boolean;
        expanded?: boolean;
        tooltipSide?: "left" | "right";
      } = {},
    ) {
      const node = nodeById.get(id);
      const presentation = presentationById.get(id);
      if (!node || !presentation || !visibleNodeIds.has(id)) return;

      storyNodes.push({
        id,
        type: "storyNode",
        position,
        zIndex: presentation.kind === "location" ? 8 : 6,
        draggable: false,
        selectable: true,
        data: {
          label: presentation.label,
          kind: presentation.kind,
          typeLabel: presentation.typeLabel,
          subtitle: presentation.subtitle,
          badge: presentation.badge,
          detail: presentation.detail,
          sourceLabel: presentation.sourceLabel,
          inTimeRange: nodeIsInTimeRange(node),
          compact: options.compact,
          expandable: options.expandable,
          expanded: options.expanded,
          tooltipSide: options.tooltipSide,
          onSelect: () => selectNodeRef.current(id, presentation.kind),
          onPreview:
            presentation.kind === "team"
              ? (hovered) =>
                  setHoveredTeamId((current) => {
                    if (selectedEntityIdRef.current) return current;
                    return hovered ? id : current === id ? null : current;
                  })
              : undefined,
        },
      });
    }

    pushNode("org-let", {
      x: LANES.planning.x + (LANES.planning.width - 230) / 2,
      y: LANE_HEADER_HEIGHT + 8,
    });
    if (layers.planning) {
      pushNode("planner-headley", {
        x: LANES.planning.x + (LANES.planning.width - 230) / 2,
        y: LANE_HEADER_HEIGHT + 154,
      });
    }

    teamIds.forEach((teamId, teamIndex) => {
      const rowY = TEAM_ROW_Y[teamIndex];
      const expanded = effectiveExpandedTeamIds.has(teamId);
      pushNode(
        teamId,
        {
          x: LANES.teams.x + 18,
          y: rowY,
        },
        { expandable: true, expanded },
      );

      if (!expanded) return;
      routes
        .find((route) => teamIdForRoute(route) === teamId)
        ?.memberEntityIds.forEach((memberId, index) => {
          pushNode(
            memberId,
            {
              x: LANES.teams.x + 268,
              y: rowY - 4 + index * 70,
            },
            { compact: true },
          );
        });
    });

    CORE_LOCATION_IDS.forEach((id) => {
      pushNode(id, LOCATION_POSITIONS[id], {
        tooltipSide: id === "loc-cst" ? "right" : "left",
      });
    });

    return [
      ...laneNodes,
      ...teamBandNodes,
      planningLaneNode,
      clusterNode,
      ...storyNodes,
    ];
  }, [
    effectiveExpandedTeamIds,
    layers.planning,
    nodeById,
    presentationById,
    routes,
    teamIds,
    timeRange,
    visibleNodeIds,
  ]);

  const edges = useMemo<Edge<StoryEdgeData>[]>(() => {
    type DisplayLink = {
      id: string;
      source: string;
      target: string;
      linkKind: GraphLinkKind;
      label: string;
      optional?: boolean;
      visibleWhenSelected?: string;
      routing?: "top-bus" | "bottom-bus";
    };

    const operationalLinks: DisplayLink[] = investigation.graph.links.filter(
      (link) =>
        (link.linkKind === "target" &&
          nodeById.get(link.source)?.kind === "team" &&
          CORE_LOCATION_IDS.includes(
            link.target as (typeof CORE_LOCATION_IDS)[number],
          )) ||
        (link.linkKind === "movement" &&
          CORE_LOCATION_IDS.includes(
            link.source as (typeof CORE_LOCATION_IDS)[number],
          ) &&
          CORE_LOCATION_IDS.includes(
            link.target as (typeof CORE_LOCATION_IDS)[number],
          )),
    );

    const overviewLinks: DisplayLink[] = [
      {
        id: "overview-org-team-cluster",
        source: "org-let",
        target: "attack-team-cluster",
        linkKind: "team",
        label: "5 TEAM STRUCTURE",
        optional: true,
      },
      ...operationalLinks,
    ];

    const operationalPairs = new Set(
      operationalLinks.map((link) => `${link.source}:${link.target}`),
    );
    const locationFocusLinks: DisplayLink[] = routes
      .flatMap((route) =>
        route.locationIds
          .filter((locationId) =>
            CORE_LOCATION_IDS.includes(
              locationId as (typeof CORE_LOCATION_IDS)[number],
            ),
          )
          .map((locationId) => ({
            id: `focus-${teamIdForRoute(route)}-${locationId}`,
            source: teamIdForRoute(route),
            target: locationId,
            linkKind: "target" as const,
            label: "ASSOCIATED TEAM",
            visibleWhenSelected: locationId,
          })),
      )
      .filter((link) => !operationalPairs.has(`${link.source}:${link.target}`));

    const memberLinks: DisplayLink[] = investigation.graph.links
      .filter(
        (link) =>
          link.linkKind === "team" &&
          nodeById.get(link.source)?.kind === "team" &&
          nodeById.get(link.target)?.kind === "attacker" &&
          effectiveExpandedTeamIds.has(link.source),
      )
      .map((link) => ({ ...link, optional: true }));

    const attackerLinks: DisplayLink[] = investigation.graph.links
      .filter(
        (link) =>
          link.linkKind === "target" &&
          nodeById.get(link.source)?.kind === "attacker" &&
          CORE_LOCATION_IDS.includes(
            link.target as (typeof CORE_LOCATION_IDS)[number],
          ),
      )
      .map((link) => ({ ...link, visibleWhenSelected: link.source }));

    const planningLinks: DisplayLink[] = layers.planning
      ? investigation.graph.links
          .filter(
            (link) =>
              link.linkKind === "planning" &&
              link.source === "planner-headley" &&
              (link.target === "org-let" ||
                CORE_LOCATION_IDS.includes(
                  link.target as (typeof CORE_LOCATION_IDS)[number],
                )),
          )
          .map((link) => ({
            ...link,
            optional: true,
            routing:
              link.target === "org-let" ? undefined : ("bottom-bus" as const),
          }))
      : [];

    return [
      ...overviewLinks,
      ...locationFocusLinks,
      ...memberLinks,
      ...attackerLinks,
      ...planningLinks,
    ]
      .filter(
        (link) =>
          (link.source === "attack-team-cluster" ||
            visibleNodeIds.has(link.source)) &&
          (link.target === "attack-team-cluster" ||
            visibleNodeIds.has(link.target)),
      )
      .map((link, index) => {
        return {
          id: link.id,
          source: link.source,
          target: link.target,
          type: "storyEdge",
          selectable: true,
          focusable: true,
          data: {
            linkKind: link.linkKind,
            label: link.label,
            optional: Boolean(link.optional),
            visibleWhenSelected: link.visibleWhenSelected,
            laneOffset: ((index % 5) - 2) * 5,
            routing: link.routing,
          },
        };
      });
  }, [
    effectiveExpandedTeamIds,
    investigation.graph.links,
    layers.planning,
    nodeById,
    routes,
    visibleNodeIds,
  ]);

  const selectedPresentation = selectedEntityId
    ? presentationById.get(selectedEntityId)
    : undefined;
  const selectedLocation = selectedEntityId
    ? investigation.map.locations.find(
        (location) => location.id === selectedEntityId,
      )
    : undefined;
  const selectedRoutes = selectedEntityId
    ? routes.filter(
        (route) =>
          teamIdForRoute(route) === selectedEntityId ||
          route.memberEntityIds.includes(selectedEntityId) ||
          route.locationIds.includes(selectedEntityId),
      )
    : [];
  const selectedTimelineEvents = selectedEntityId
    ? investigation.timeline.events.filter((event) => {
        if (selectedNode?.kind === "team" && selectedRoute) {
          return selectedRoute.memberEntityIds.some((id) =>
            event.linkedEntityIds.includes(id),
          );
        }

        return (
          event.linkedEntityIds.includes(selectedEntityId) ||
          event.linkedLocationIds.includes(selectedEntityId)
        );
      })
    : [];

  const responsePresentation = presentationById.get("response-mumbai-police");
  const evidencePresentation = presentationById.get("evidence-judgment");
  const contextFacts = useMemo(() => {
    const routeEntityIds = selectedRoute?.memberEntityIds ?? [];
    const routeLocationIds = selectedRoute?.locationIds ?? [];
    const relevant = selectedEntityId
      ? investigation.facts.filter(
          (fact) =>
            fact.linkedEntityIds.includes(selectedEntityId) ||
            fact.linkedLocationIds.includes(selectedEntityId) ||
            routeEntityIds.some((id) => fact.linkedEntityIds.includes(id)) ||
            routeLocationIds.some((id) => fact.linkedLocationIds.includes(id)),
        )
      : [];
    const fallback = investigation.facts.filter(
      (fact) => fact.status === "verified",
    );

    return (relevant.length > 0 ? relevant : fallback).slice(0, 4);
  }, [investigation.facts, selectedEntityId, selectedRoute]);
  const coreCasualtyTotals = useMemo(
    () =>
      investigation.map.locations
        .filter((location) =>
          CORE_LOCATION_IDS.includes(
            location.id as (typeof CORE_LOCATION_IDS)[number],
          ),
        )
        .reduce(
          (totals, location) => ({
            killed: totals.killed + (location.killed ?? 0),
            injured: totals.injured + (location.injured ?? 0),
          }),
          { killed: 0, injured: 0 },
        ),
    [investigation.map.locations],
  );
  const focusContextValue = useMemo<GraphFocusContextValue>(
    () => ({ selectedEntityId, focusedNodeIds, isPreviewingTeam }),
    [focusedNodeIds, isPreviewingTeam, selectedEntityId],
  );

  function toggleLayer(layer: OptionalLayer) {
    triggerHaptic("light");
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <div
      data-testid="mumbai-network-story-map"
      className="relative h-full min-h-0 w-full flex-1 overflow-hidden bg-[#F4F4F0] dark:bg-[#01161E]"
    >
      <GraphFocusContext.Provider value={focusContextValue}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={GRAPH_FIT_VIEW_OPTIONS}
          minZoom={0.4}
          maxZoom={1.45}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          onInit={setFlowInstance}
          onPaneClick={onPaneClick}
          className="bg-[#F4F4F0] dark:bg-[#01161E]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            color={isDark ? "#598392" : "#000000"}
            gap={24}
            size={1.05}
          />

          <Panel position="top-right" className="m-2 md:m-3">
            {!isContextExpanded ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setIsContextExpanded(true);
                }}
                className="border-4 border-black bg-black px-3 py-2 font-mono text-[10px] font-black uppercase text-white shadow-[4px_4px_0_black] dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0] dark:shadow-[4px_4px_0_#01161E]"
              >
                [ + CONTEXT / EVIDENCE ]
              </button>
            ) : (
              <div className="max-h-[min(72dvh,560px)] w-[min(370px,calc(100vw-2rem))] overflow-y-auto border-4 border-black bg-white font-mono text-black shadow-[7px_7px_0_black] dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0] dark:shadow-[7px_7px_0_#01161E]">
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-4 border-black bg-black px-3 py-2.5 text-white dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0]">
                  <div>
                    <div className="text-[8px] font-black opacity-55">
                      COL 04
                    </div>
                    <div className="text-[11px] font-black uppercase">
                      CONTEXT / EVIDENCE
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsContextExpanded(false)}
                    className="border-2 border-white px-2 py-1 text-[8px] font-black uppercase dark:border-[#AEC3B0]"
                  >
                    [ × CLOSE ]
                  </button>
                </div>

                <div className="space-y-3 p-3">
                  <section className="border-3 border-black p-3 dark:border-[#598392]">
                    <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2 text-[9px] font-black uppercase dark:border-[#598392]">
                      <Shield aria-hidden="true" size={15} strokeWidth={3} />
                      Police response
                    </div>
                    <div className="text-[12px] font-black uppercase">
                      {responsePresentation?.label}
                    </div>
                    <p className="mt-1 text-[9px] font-bold leading-snug normal-case opacity-75">
                      {responsePresentation?.detail}
                    </p>
                    <span className="mt-2 inline-block border-2 border-black bg-[#FCD34D] px-1.5 py-1 text-[8px] font-black uppercase dark:border-[#AEC3B0] dark:bg-[#AEC3B0] dark:text-[#01161E]">
                      {responsePresentation?.badge}
                    </span>
                  </section>

                  <section className="border-3 border-black p-3 dark:border-[#598392]">
                    <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2 text-[9px] font-black uppercase dark:border-[#598392]">
                      <Gavel aria-hidden="true" size={15} strokeWidth={3} />
                      Legal sources
                    </div>
                    <div className="text-[12px] font-black uppercase">
                      {evidencePresentation?.label}
                    </div>
                    <p className="mt-1 text-[9px] font-bold leading-snug normal-case opacity-75">
                      {evidencePresentation?.detail}
                    </p>
                    <div className="mt-2 border-t-2 border-black pt-2 text-[8px] font-black uppercase opacity-60 dark:border-[#598392]">
                      {evidencePresentation?.sourceLabel}
                    </div>
                  </section>

                  <section className="border-3 border-black p-3 dark:border-[#598392]">
                    <div className="mb-2 flex items-center gap-2 border-b-2 border-black pb-2 text-[9px] font-black uppercase dark:border-[#598392]">
                      <FileSearch
                        aria-hidden="true"
                        size={15}
                        strokeWidth={3}
                      />
                      Evidence
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border-2 border-black bg-black p-2 text-white dark:border-[#598392] dark:bg-[#124559]">
                        <div className="text-[7px] font-black opacity-55">
                          PRIMARY-SITE KILLED
                        </div>
                        <div className="text-xl font-black">
                          {coreCasualtyTotals.killed}
                        </div>
                      </div>
                      <div className="border-2 border-black bg-[#FCD34D] p-2 text-black dark:border-[#AEC3B0] dark:bg-[#AEC3B0] dark:text-[#01161E]">
                        <div className="text-[7px] font-black opacity-55">
                          PRIMARY-SITE INJURED
                        </div>
                        <div className="text-xl font-black">
                          {coreCasualtyTotals.injured}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="border-3 border-black p-3 dark:border-[#598392]">
                    <div className="mb-2 border-b-2 border-black pb-2 text-[9px] font-black uppercase dark:border-[#598392]">
                      Related facts / {contextFacts.length}
                    </div>
                    <div className="space-y-2">
                      {contextFacts.map((fact) => (
                        <article
                          key={fact.id}
                          className="border-l-4 border-[#D22B2B] bg-[#F4F4F0] p-2 dark:bg-[#124559]"
                        >
                          <div className="text-[7px] font-black uppercase text-[#D22B2B] dark:text-[#AEC3B0]">
                            {fact.type}
                          </div>
                          <p className="mt-1 line-clamp-3 text-[9px] font-bold leading-snug normal-case">
                            {fact.text}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <button
                    type="button"
                    onClick={openLedger}
                    className="w-full border-4 border-black bg-[#D22B2B] px-3 py-2 text-left text-[10px] font-black uppercase text-white shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none dark:border-[#598392] dark:shadow-[4px_4px_0_#01161E]"
                  >
                    [ Open source ledger ]
                  </button>
                </div>
              </div>
            )}
          </Panel>

          {selectedPresentation ? (
            <Panel position="bottom-left" className="m-3 md:m-4">
              <div
                className={`max-h-[min(52dvh,400px)] ${
                  isLedgerOpen
                    ? "w-[min(220px,calc(100vw-2rem))]"
                    : "w-[min(320px,calc(100vw-2rem))]"
                } overflow-y-auto border-4 border-black bg-white font-mono text-black shadow-[6px_6px_0_black] dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0] dark:shadow-[6px_6px_0_#01161E]`}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b-4 border-black bg-black px-3 py-2 text-white dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0]">
                  <span className="text-[9px] font-black uppercase">
                    [ FOCUSED INSPECTOR ]
                  </span>
                  <button
                    type="button"
                    onClick={clearFocus}
                    className="border-2 border-white px-1.5 py-0.5 text-[8px] font-black uppercase dark:border-[#598392]"
                  >
                    Clear
                  </button>
                </div>
                <div className="p-3">
                  <div className="text-[9px] font-black uppercase text-[#D22B2B] dark:text-[#AEC3B0]">
                    {selectedPresentation.typeLabel}
                  </div>
                  <h3 className="mt-1 font-serif text-xl font-black uppercase leading-none">
                    {selectedPresentation.label}
                  </h3>
                  {selectedPresentation.badge ? (
                    <div className="mt-2 inline-block border-2 border-black bg-[#FCD34D] px-1.5 py-1 text-[9px] font-black uppercase dark:border-[#AEC3B0] dark:bg-[#AEC3B0] dark:text-[#01161E]">
                      {selectedPresentation.badge}
                    </div>
                  ) : null}

                  <p className="mt-3 text-[10px] font-bold leading-[1.35] normal-case">
                    {selectedPresentation.detail}
                  </p>

                  {selectedRoutes.length > 0 ? (
                    <div className="mt-3 border-t-2 border-black pt-2 dark:border-[#598392]">
                      <div className="mb-1 text-[8px] font-black uppercase opacity-55">
                        Related story path
                      </div>
                      {selectedRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="mb-1 text-[9px] font-black uppercase leading-tight"
                        >
                          {route.label} → {route.description}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {selectedLocation ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t-2 border-black pt-2 dark:border-[#598392]">
                      <div className="border-2 border-black bg-black p-2 text-white dark:border-[#598392] dark:bg-[#01161E]">
                        <div className="text-[8px] font-black opacity-60">
                          KILLED
                        </div>
                        <div className="text-lg font-black">
                          {selectedLocation.killed ?? 0}
                        </div>
                      </div>
                      <div className="border-2 border-black bg-[#FCD34D] p-2 text-black dark:border-[#AEC3B0] dark:bg-[#AEC3B0] dark:text-[#01161E]">
                        <div className="text-[8px] font-black opacity-60">
                          INJURED
                        </div>
                        <div className="text-lg font-black">
                          {selectedLocation.injured ?? 0}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 border-t-2 border-black pt-2 dark:border-[#598392]">
                    <div className="mb-1 text-[8px] font-black uppercase opacity-55">
                      Context links
                    </div>
                    {[
                      ...selectedPresentation.connections,
                      `${selectedTimelineEvents.length} timeline events`,
                    ]
                      .filter(
                        (item, index, values) => values.indexOf(item) === index,
                      )
                      .map((item) => (
                        <div
                          key={item}
                          className="text-[9px] font-black uppercase"
                        >
                          → {item}
                        </div>
                      ))}
                  </div>

                  <div className="mt-3 border-t-2 border-black pt-2 text-[8px] font-black uppercase opacity-55 dark:border-[#598392]">
                    Source: {selectedPresentation.sourceLabel}
                  </div>
                  <button
                    type="button"
                    onClick={openLedger}
                    className="mt-3 w-full border-4 border-black bg-[#D22B2B] px-3 py-2 text-left text-[10px] font-black uppercase text-white shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none dark:border-[#598392] dark:shadow-[4px_4px_0_#01161E]"
                  >
                    [ Inspect source ledger ]
                  </button>
                </div>
              </div>
            </Panel>
          ) : null}
        </ReactFlow>
      </GraphFocusContext.Provider>
    </div>
  );
}
