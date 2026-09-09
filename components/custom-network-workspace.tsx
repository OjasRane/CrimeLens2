"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  BadgeDollarSign,
  BrainCircuit,
  BookOpenText,
  Bot,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  FileText,
  Focus,
  GitBranchPlus,
  History,
  LayoutTemplate,
  ListChecks,
  MapPin,
  Network,
  NotebookPen,
  Phone,
  Plus,
  Radio,
  Redo2,
  Route,
  Search,
  Trash2,
  Undo2,
  Waypoints,
  X,
  Zap,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type DragEvent,
  type FormEvent,
} from "react";
import { getInvestigation } from "@/data/investigations/registry";
import type {
  GraphNodeKind,
  Investigation,
  InvestigationId,
} from "@/data/investigations/types";
import {
  analyzeGraphWorkspace,
  deleteGraphWorkspace,
  getGraphWorkspace,
  getGraphWorkspaces,
  saveGraphWorkspace,
} from "@/lib/crimelens-api";
import {
  analyzeWorkspaceDeterministically,
  findWorkspacePath,
  getEdgeBasis,
  getEvidenceSupport,
  getNodeBasis,
} from "@/lib/network-workspace-intelligence";
import {
  createBlankWorkspace,
  relationshipTypes,
  workspaceNodeTypes,
  type GraphWorkspace,
  type RelationshipConfidence,
  type WorkspaceEdgeRecord,
  type WorkspaceGroupRecord,
  type WorkspaceNodeRecord,
  type WorkspaceNodeType,
  type WorkspacePathResult,
  type WorkspaceQuestion,
  type WorkspaceSnapshot,
  type WorkspaceSourceReference,
  type WorkspaceSuggestion,
  type WorkspaceVerification,
} from "@/lib/network-workspace-types";
import { isSupabaseBrowserConfigured } from "@/lib/supabase-browser";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

type WorkspaceNodeData = WorkspaceNodeRecord & {
  dimmed?: boolean;
  searchMatch?: boolean;
  selectedByAnalyst?: boolean;
  hasConflict?: boolean;
  hasSuggestion?: boolean;
};

type GroupNodeData = WorkspaceGroupRecord;
type CanvasNode =
  | Node<WorkspaceNodeData, "workspaceEntity">
  | Node<GroupNodeData, "workspaceGroup">;
type WorkspaceEdgeData = WorkspaceEdgeRecord;
type HistorySnapshot = Pick<
  GraphWorkspace,
  "nodes" | "edges" | "groups" | "questions" | "suggestions" | "conflicts"
>;
type EditorState =
  | {
      kind: "node";
      node?: WorkspaceNodeRecord;
      defaultType?: WorkspaceNodeType;
    }
  | { kind: "edge"; edge?: WorkspaceEdgeRecord; source: string; target: string }
  | { kind: "workspace"; workspace?: GraphWorkspace }
  | { kind: "group" }
  | { kind: "case" }
  | { kind: "path" }
  | { kind: "questions" }
  | { kind: "question"; question?: WorkspaceQuestion }
  | { kind: "snapshots" }
  | { kind: "snapshot" }
  | { kind: "analysis" }
  | null;

type InspectorTab = "details" | "basis" | "connections" | "conflicts" | "ai";

const iconByType: Record<
  WorkspaceNodeType,
  ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  person: CircleUserRound,
  organization: Building2,
  location: MapPin,
  vehicle: Car,
  device: Radio,
  phone: Phone,
  account: BookOpenText,
  transaction: BadgeDollarSign,
  event: Zap,
  evidence: Search,
  document: FileText,
  note: NotebookPen,
  custom: Bot,
};

const graphKindToWorkspaceType: Record<GraphNodeKind, WorkspaceNodeType> = {
  suspect: "person",
  attacker: "person",
  team: "organization",
  organization: "organization",
  planner: "person",
  location: "location",
  response: "organization",
  evidence: "evidence",
  transaction: "transaction",
};

const fieldClass =
  "min-h-10 w-full border-2 border-[var(--ink)] bg-[var(--panel)] px-3 py-2 font-mono text-xs font-bold text-[var(--ink)] outline-none focus:shadow-[3px_3px_0_var(--danger)]";
const buttonClass =
  "min-h-10 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 py-2 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-35";

function id() {
  return crypto.randomUUID();
}

function uniqueIds(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function snapshot(workspace: GraphWorkspace): HistorySnapshot {
  return structuredClone({
    nodes: workspace.nodes,
    edges: workspace.edges,
    groups: workspace.groups,
    questions: workspace.questions,
    suggestions: workspace.suggestions,
    conflicts: workspace.conflicts,
  });
}

function normalizeWorkspace(
  workspace: GraphWorkspace,
  investigation?: Investigation,
): GraphWorkspace {
  const factStatus = new Map(
    investigation?.facts.map((fact) => [fact.id, fact.status]) ?? [],
  );
  return {
    ...workspace,
    nodes: workspace.nodes.map((node) => {
      if (node.sourceFactId && factStatus.has(node.sourceFactId)) {
        const sourceVerificationStatus = factStatus.get(node.sourceFactId)!;
        return {
          ...node,
          sourceVerificationStatus,
          verificationStatus:
            sourceVerificationStatus === "pending" ||
            sourceVerificationStatus === "disputed"
              ? "manual"
              : node.verificationStatus,
        };
      }
      if (
        node.origin === "investigation" &&
        !node.sourceVerificationStatus &&
        investigation
      ) {
        return {
          ...node,
          sourceVerificationStatus:
            investigation.type === "DEMO" ? "demo" : "verified",
        };
      }
      return node;
    }),
    questions: workspace.questions ?? [],
    suggestions: workspace.suggestions ?? [],
    conflicts: workspace.conflicts ?? [],
    snapshots: workspace.snapshots ?? [],
  };
}

function snapshotData(workspace: GraphWorkspace) {
  return structuredClone({
    name: workspace.name,
    description: workspace.description,
    nodes: workspace.nodes,
    edges: workspace.edges,
    groups: workspace.groups,
    questions: workspace.questions,
    suggestions: workspace.suggestions,
    conflicts: workspace.conflicts,
    viewport: workspace.viewport,
    filters: workspace.filters,
    version: workspace.version,
  });
}

function snapshotDifference(
  workspace: GraphWorkspace,
  item: WorkspaceSnapshot,
) {
  const before = item.snapshotData;
  const nodeIds = new Set(workspace.nodes.map((node) => node.id));
  const oldNodeIds = new Set(before.nodes.map((node) => node.id));
  const edgeIds = new Set(workspace.edges.map((edge) => edge.id));
  const oldEdgeIds = new Set(before.edges.map((edge) => edge.id));
  const changedEdges = workspace.edges.filter((edge) => {
    const old = before.edges.find((candidate) => candidate.id === edge.id);
    return old && JSON.stringify(old) !== JSON.stringify(edge);
  }).length;
  return {
    addedNodes: [...nodeIds].filter((nodeId) => !oldNodeIds.has(nodeId)).length,
    removedNodes: [...oldNodeIds].filter((nodeId) => !nodeIds.has(nodeId))
      .length,
    addedEdges: [...edgeIds].filter((edgeId) => !oldEdgeIds.has(edgeId)).length,
    removedEdges: [...oldEdgeIds].filter((edgeId) => !edgeIds.has(edgeId))
      .length,
    changedEdges,
  };
}

const WorkspaceEntityNode = memo(function WorkspaceEntityNode({
  data,
  selected,
}: NodeProps<Node<WorkspaceNodeData, "workspaceEntity">>) {
  const Icon = iconByType[data.type];
  const isVerified = data.verificationStatus === "verified";
  const isHypothesis = data.verificationStatus === "hypothesis";
  const displayedStatus =
    data.sourceVerificationStatus ?? data.verificationStatus;
  return (
    <div
      className={`w-44 border-4 bg-[var(--panel)] p-3 font-mono uppercase text-[var(--ink)] shadow-[5px_5px_0_var(--ink)] transition-opacity ${
        isHypothesis ? "border-dashed" : "border-solid"
      } ${selected || data.selectedByAnalyst ? "!border-[var(--danger)] shadow-[5px_5px_0_var(--danger)]" : "border-[var(--ink)]"} ${
        data.dimmed ? "opacity-25" : "opacity-100"
      } ${data.searchMatch ? "outline-4 outline-offset-4 outline-[var(--accent)]" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-none !border-2 !border-[var(--ink)] !bg-[var(--panel)]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-none !border-2 !border-[var(--ink)] !bg-[var(--danger)]"
      />
      <div className="mb-2 flex items-center justify-between border-b-2 border-current pb-2 text-[9px] font-black">
        <span className="flex items-center gap-1.5">
          <Icon size={15} strokeWidth={3} />
          {data.type}
        </span>
        <span>{data.origin === "investigation" ? "CASE" : "ANALYST"}</span>
      </div>
      <p className="m-0 break-words text-sm font-black leading-tight">
        {data.label}
      </p>
      {data.description ? (
        <p className="mt-2 line-clamp-2 text-[9px] font-bold normal-case opacity-70">
          {data.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1">
        <span
          className={`inline-block border-2 border-current px-1.5 py-0.5 text-[8px] font-black ${isVerified && displayedStatus === "verified" ? "bg-[var(--ink)] text-[var(--paper)]" : ""}`}
        >
          {displayedStatus}
        </span>
        {data.sourceVerificationStatus === "pending" ||
        data.sourceVerificationStatus === "disputed" ? (
          <span className="inline-block border-2 border-[var(--danger)] bg-[var(--danger)] px-1.5 py-0.5 text-[8px] font-black text-white">
            review
          </span>
        ) : null}
        {data.hasConflict ? (
          <span className="inline-block border-2 border-[var(--danger)] px-1.5 py-0.5 text-[8px] font-black text-[var(--danger)]">
            conflict
          </span>
        ) : null}
        {data.hasSuggestion ? (
          <span className="inline-block border-2 border-dashed border-current px-1.5 py-0.5 text-[8px] font-black">
            AI suggested
          </span>
        ) : null}
      </div>
    </div>
  );
});

const WorkspaceGroupNode = memo(function WorkspaceGroupNode({
  data,
}: NodeProps<Node<GroupNodeData, "workspaceGroup">>) {
  return (
    <div className="h-full w-full border-4 border-dashed border-[var(--dim)] bg-[color-mix(in_srgb,var(--panel)_55%,transparent)] p-3 font-mono text-[10px] font-black uppercase text-[var(--dim)]">
      [ {data.name} ] // {data.groupType}
    </div>
  );
});

const nodeTypes = {
  workspaceEntity: WorkspaceEntityNode,
  workspaceGroup: WorkspaceGroupNode,
};

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 z-[90] grid place-items-center bg-black/55 p-3"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90%] w-full max-w-lg overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-[8px_8px_0_var(--ink)]"
      >
        <header className="flex items-center justify-between border-b-4 border-[var(--ink)] bg-[var(--ink)] px-4 py-3 text-[var(--paper)]">
          <h3 className="font-serif text-xl font-black uppercase">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center border-2 border-current"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EmptyState({
  onNode,
  onCase,
}: {
  onNode: () => void;
  onCase: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
      <div className="pointer-events-auto max-w-sm border-4 border-[var(--ink)] bg-[var(--paper)] p-6 text-center font-mono uppercase text-[var(--ink)] shadow-[7px_7px_0_var(--ink)]">
        <Network className="mx-auto mb-3" size={32} strokeWidth={3} />
        <p className="font-serif text-2xl font-black">No entities on canvas</p>
        <p className="mt-2 text-[10px] font-bold opacity-65">
          Build a theory from scratch or reference verified case data.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onNode} className={buttonClass}>
            + First Node
          </button>
          <button
            type="button"
            onClick={onCase}
            className={`${buttonClass} !bg-[var(--accent)]`}
          >
            Add From Case
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomNetworkWorkspaceInner({
  investigationId,
}: {
  investigationId: InvestigationId;
}) {
  const investigation = getInvestigation(investigationId);
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const setNetworkMode = useInvestigationStore((state) => state.setNetworkMode);
  const setSelectedEntityId = useInvestigationStore(
    (state) => state.setSelectedEntityId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );
  const setSelectedTimelineEventId = useInvestigationStore(
    (state) => state.setSelectedTimelineEventId,
  );
  const setWorkspaceComparisonSelection = useInvestigationStore(
    (state) => state.setWorkspaceComparisonSelection,
  );
  const openLedger = useInvestigationStore((state) => state.openLedger);
  const [workspaces, setWorkspaces] = useState<GraphWorkspace[]>([]);
  const [activeId, setActiveId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "local">(
    "saved",
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("details");
  const [pathResult, setPathResult] = useState<WorkspacePathResult | null>(
    null,
  );
  const [pathNodeIds, setPathNodeIds] = useState<string[]>([]);
  const [pathEdgeIds, setPathEdgeIds] = useState<string[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "analyzing" | "ready" | "unavailable"
  >("idle");
  const [snapshotCompareId, setSnapshotCompareId] = useState<string | null>(
    null,
  );
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);
  const [verificationFilter, setVerificationFilter] = useState<
    WorkspaceVerification[]
  >(["verified", "manual", "hypothesis"]);
  const flowRef = useRef<ReactFlowInstance<
    CanvasNode,
    Edge<WorkspaceEdgeData>
  > | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<HistorySnapshot | null>(null);
  const processedRequest = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestWorkspaces = useRef<GraphWorkspace[]>([]);
  const latestActiveId = useRef("");
  const latestHydrated = useRef(false);
  const current =
    workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];
  const networkWorkspaceRequest = useInvestigationStore(
    (state) => state.networkWorkspaceRequest,
  );
  const setNetworkWorkspaceCatalog = useInvestigationStore(
    (state) => state.setNetworkWorkspaceCatalog,
  );
  latestWorkspaces.current = workspaces;
  latestActiveId.current = activeId;
  latestHydrated.current = hydrated;

  useEffect(() => {
    let cancelled = false;
    const storageKey = `crimelens-network-workspaces:${investigationId}`;
    const raw = localStorage.getItem(storageKey);
    let local: GraphWorkspace[] = [];
    try {
      local = raw
        ? (JSON.parse(raw) as GraphWorkspace[]).map((workspace) =>
            normalizeWorkspace(workspace, investigation),
          )
        : [];
    } catch {
      local = [];
    }
    if (!local.length) local = [createBlankWorkspace(investigationId)];
    setWorkspaces(local);
    const savedActiveId = localStorage.getItem(`${storageKey}:active`);
    setActiveId(
      local.some((workspace) => workspace.id === savedActiveId)
        ? savedActiveId!
        : local[0].id,
    );
    setHydrated(true);
    if (isSupabaseBrowserConfigured) {
      void getGraphWorkspaces(investigationId)
        .then(async (summaries) =>
          Promise.all(summaries.map((item) => getGraphWorkspace(item.id))),
        )
        .then((remote) => {
          if (!cancelled && remote.length) {
            setWorkspaces(
              remote.map((workspace) =>
                normalizeWorkspace(workspace, investigation),
              ),
            );
            setActiveId(remote[0].id);
          }
        })
        .catch(() => setSaveStatus("local"));
    } else {
      setSaveStatus("local");
    }
    return () => {
      cancelled = true;
    };
  }, [investigation, investigationId]);

  useEffect(() => {
    if (!hydrated || !workspaces.length) return;
    const storageKey = `crimelens-network-workspaces:${investigationId}`;
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus(isSupabaseBrowserConfigured ? "saving" : "local");
    persistenceTimer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(workspaces));
      localStorage.setItem(`${storageKey}:active`, activeId);
    }, 250);
    if (current && isSupabaseBrowserConfigured) {
      saveTimer.current = setTimeout(() => {
        void saveGraphWorkspace(current.id, current)
          .then(() => setSaveStatus("saved"))
          .catch(() => setSaveStatus("local"));
      }, 650);
    }
    return () => {
      if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activeId, current, hydrated, investigationId, workspaces]);

  useEffect(() => {
    const storageKey = `crimelens-network-workspaces:${investigationId}`;
    return () => {
      if (!latestHydrated.current || !latestWorkspaces.current.length) return;
      localStorage.setItem(
        storageKey,
        JSON.stringify(latestWorkspaces.current),
      );
      localStorage.setItem(`${storageKey}:active`, latestActiveId.current);
    };
  }, [investigationId]);

  useEffect(() => {
    setNetworkWorkspaceCatalog(
      workspaces.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
      })),
      current?.id ?? null,
    );
  }, [current?.id, setNetworkWorkspaceCatalog, workspaces]);

  const replaceCurrent = useCallback(
    (
      next: GraphWorkspace | ((workspace: GraphWorkspace) => GraphWorkspace),
    ) => {
      setWorkspaces((items) =>
        items.map((workspace) => {
          if (workspace.id !== activeId) return workspace;
          const value = typeof next === "function" ? next(workspace) : next;
          return {
            ...value,
            updatedAt: new Date().toISOString(),
            version: workspace.version + 1,
          };
        }),
      );
    },
    [activeId],
  );

  const commit = useCallback(
    (change: (workspace: GraphWorkspace) => GraphWorkspace) => {
      if (!current) return;
      setPast((items) => [...items.slice(-39), snapshot(current)]);
      setFuture([]);
      replaceCurrent(change);
    },
    [current, replaceCurrent],
  );

  const undo = useCallback(() => {
    const previous = past.at(-1);
    if (!current || !previous) return;
    setFuture((items) => [snapshot(current), ...items].slice(0, 40));
    setPast((items) => items.slice(0, -1));
    replaceCurrent((workspace) => ({
      ...workspace,
      ...structuredClone(previous),
    }));
  }, [current, past, replaceCurrent]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!current || !next) return;
    setPast((items) => [...items.slice(-39), snapshot(current)]);
    setFuture((items) => items.slice(1));
    replaceCurrent((workspace) => ({ ...workspace, ...structuredClone(next) }));
  }, [current, future, replaceCurrent]);

  const deleteSelection = useCallback(() => {
    if (!current || (!selectedNodeIds.length && !selectedEdgeId)) return;
    commit((workspace) => ({
      ...workspace,
      nodes: workspace.nodes.filter(
        (node) => !selectedNodeIds.includes(node.id),
      ),
      edges: workspace.edges.filter(
        (edge) =>
          edge.id !== selectedEdgeId &&
          !selectedNodeIds.includes(edge.source) &&
          !selectedNodeIds.includes(edge.target),
      ),
      groups: workspace.groups
        .map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter(
            (nodeId) => !selectedNodeIds.includes(nodeId),
          ),
        }))
        .filter((group) => group.nodeIds.length),
    }));
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [commit, current, selectedEdgeId, selectedNodeIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, [contenteditable='true']"))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === "Escape") {
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
        setEditor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection, redo, undo]);

  const canvasNodes = useMemo<CanvasNode[]>(() => {
    if (!current) return [];
    const q = searchQuery.trim().toLowerCase();
    const visibleIds = new Set(
      current.nodes
        .filter((node) => verificationFilter.includes(node.verificationStatus))
        .map((node) => node.id),
    );
    const focusId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
    const neighbors = new Set<string>();
    if (focusId)
      current.edges.forEach((edge) => {
        if (edge.source === focusId) neighbors.add(edge.target);
        if (edge.target === focusId) neighbors.add(edge.source);
      });
    const conflictNodeIds = new Set(
      current.conflicts
        .filter((conflict) => conflict.status === "OPEN")
        .flatMap((conflict) => [conflict.resourceAId, conflict.resourceBId]),
    );
    const suggestedNodeIds = new Set(
      current.suggestions
        .filter((suggestion) => suggestion.status === "PENDING")
        .flatMap((suggestion) => [
          suggestion.sourceNodeId,
          suggestion.targetNodeId,
        ]),
    );
    const entityNodes: CanvasNode[] = current.nodes
      .filter((node) => visibleIds.has(node.id))
      .map((node) => ({
        id: node.id,
        type: "workspaceEntity",
        position: node.position,
        data: {
          ...node,
          searchMatch: Boolean(
            q &&
            `${node.label} ${node.description ?? ""}`.toLowerCase().includes(q),
          ),
          dimmed: pathNodeIds.length
            ? !pathNodeIds.includes(node.id)
            : Boolean(
                focusId && node.id !== focusId && !neighbors.has(node.id),
              ),
          selectedByAnalyst: selectedNodeIds.includes(node.id),
          hasConflict: conflictNodeIds.has(node.id),
          hasSuggestion: suggestedNodeIds.has(node.id),
        },
      }));
    const groupNodes: CanvasNode[] = current.groups.map((group) => {
      const members = current.nodes.filter((node) =>
        group.nodeIds.includes(node.id),
      );
      const minX = Math.min(...members.map((node) => node.position.x), 0) - 35;
      const minY = Math.min(...members.map((node) => node.position.y), 0) - 55;
      const maxX =
        Math.max(...members.map((node) => node.position.x), minX + 260) + 220;
      const maxY =
        Math.max(...members.map((node) => node.position.y), minY + 180) + 150;
      return {
        id: `group:${group.id}`,
        type: "workspaceGroup",
        position: { x: minX, y: minY },
        data: group,
        draggable: false,
        selectable: false,
        zIndex: -1,
        style: { width: maxX - minX, height: maxY - minY },
      };
    });
    return [...groupNodes, ...entityNodes];
  }, [current, pathNodeIds, searchQuery, selectedNodeIds, verificationFilter]);

  const canvasEdges = useMemo<Edge<WorkspaceEdgeData>[]>(() => {
    if (!current) return [];
    const visible = new Set(
      canvasNodes
        .filter((node) => node.type === "workspaceEntity")
        .map((node) => node.id),
    );
    const documented: Edge<WorkspaceEdgeData>[] = current.edges
      .filter((edge) => visible.has(edge.source) && visible.has(edge.target))
      .map((edge) => {
        const onPath = pathEdgeIds.includes(edge.id);
        const pathActive = pathEdgeIds.length > 0;
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          data: edge,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color:
              edge.id === selectedEdgeId || onPath ? "#D22B2B" : "var(--ink)",
          },
          style: {
            stroke:
              edge.id === selectedEdgeId || onPath
                ? "var(--danger)"
                : "var(--ink)",
            strokeWidth: edge.id === selectedEdgeId || onPath ? 3 : 2,
            strokeDasharray:
              edge.verificationStatus === "hypothesis" ? "8 6" : undefined,
            opacity: pathActive && !onPath ? 0.14 : 1,
          },
          labelStyle: {
            fontFamily: "monospace",
            fontWeight: 900,
            fontSize: 9,
            fill: "var(--ink)",
          },
          labelBgStyle: {
            fill: "var(--paper)",
            stroke: "var(--ink)",
            strokeWidth: 1,
          },
          labelBgPadding: [5, 3],
          labelBgBorderRadius: 0,
        };
      });
    const ghostSuggestions: Edge<WorkspaceEdgeData>[] = current.suggestions
      .filter(
        (suggestion) =>
          suggestion.status === "PENDING" &&
          visible.has(suggestion.sourceNodeId) &&
          visible.has(suggestion.targetNodeId),
      )
      .map((suggestion) => ({
        id: `suggestion:${suggestion.id}`,
        source: suggestion.sourceNodeId,
        target: suggestion.targetNodeId,
        label: "SUGGESTION",
        selectable: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--dim)" },
        style: {
          stroke: "var(--dim)",
          strokeWidth: 2,
          strokeDasharray: "4 8",
          opacity: pathEdgeIds.length ? 0.08 : 0.55,
        },
        labelStyle: {
          fontFamily: "monospace",
          fontWeight: 900,
          fontSize: 8,
          fill: "var(--dim)",
        },
        labelBgStyle: {
          fill: "var(--paper)",
          stroke: "var(--dim)",
          strokeWidth: 1,
        },
      }));
    return [...documented, ...ghostSuggestions];
  }, [canvasNodes, current, pathEdgeIds, selectedEdgeId]);

  function createNode(
    type: WorkspaceNodeType,
    position?: { x: number; y: number },
  ) {
    setEditor({ kind: "node", defaultType: type });
    if (position)
      sessionStorage.setItem(
        "crimelens-node-drop-position",
        JSON.stringify(position),
      );
  }

  function saveNode(
    event: FormEvent<HTMLFormElement>,
    existing?: WorkspaceNodeRecord,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    let dropped: { x: number; y: number } | undefined;
    try {
      dropped = JSON.parse(
        sessionStorage.getItem("crimelens-node-drop-position") || "null",
      ) as { x: number; y: number } | undefined;
    } catch {
      dropped = undefined;
    }
    sessionStorage.removeItem("crimelens-node-drop-position");
    const record: WorkspaceNodeRecord = existing
      ? {
          ...existing,
          type: data.get("type") as WorkspaceNodeType,
          label: String(data.get("label") || existing.label).trim(),
          verificationStatus: data.get("verification") as WorkspaceVerification,
          description: String(data.get("description") || "").trim(),
        }
      : {
          id: id(),
          type: data.get("type") as WorkspaceNodeType,
          label: String(data.get("label") || "UNTITLED ENTITY").trim(),
          origin: "manual",
          intelligenceOrigin: "INVESTIGATOR_CREATED",
          verificationStatus: data.get("verification") as WorkspaceVerification,
          investigationId,
          description: String(data.get("description") || "").trim(),
          position: dropped ?? {
            x: 120 + (current?.nodes.length ?? 0) * 34,
            y: 110 + ((current?.nodes.length ?? 0) % 5) * 70,
          },
        };
    commit((workspace) => ({
      ...workspace,
      nodes: existing
        ? workspace.nodes.map((node) =>
            node.id === existing.id ? record : node,
          )
        : [...workspace.nodes, record],
    }));
    setEditor(null);
    setSelectedNodeIds([record.id]);
  }

  function saveEdge(
    event: FormEvent<HTMLFormElement>,
    state: Extract<EditorState, { kind: "edge" }>,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const relationshipType = String(data.get("relationshipType"));
    const custom = String(data.get("customLabel") || "").trim();
    const source = String(data.get("source") || state.source);
    const target = String(data.get("target") || state.target);
    if (source === target) return;
    const record: WorkspaceEdgeRecord = {
      id: state.edge?.id ?? id(),
      source,
      target,
      relationshipType,
      label:
        relationshipType === "CUSTOM"
          ? custom || "RELATED TO"
          : relationshipType,
      confidence: data.get("confidence") as RelationshipConfidence,
      verificationStatus: data.get("verification") as WorkspaceVerification,
      reason: String(data.get("reason") || "").trim(),
      intelligenceOrigin:
        state.edge?.intelligenceOrigin ?? "INVESTIGATOR_CREATED",
    };
    commit((workspace) => ({
      ...workspace,
      edges: state.edge
        ? workspace.edges.map((edge) => (edge.id === record.id ? record : edge))
        : [...workspace.edges, record],
    }));
    setEditor(null);
    setSelectedEdgeId(record.id);
  }

  function onConnect(connection: Connection) {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return;
    setEditor({
      kind: "edge",
      source: connection.source,
      target: connection.target,
    });
  }

  function autoLayout() {
    if (!current || !current.nodes.length) return;
    const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: "LR", ranksep: 90, nodesep: 60 });
    current.nodes.forEach((node) =>
      graph.setNode(node.id, { width: 176, height: 118 }),
    );
    current.edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
    dagre.layout(graph);
    commit((workspace) => ({
      ...workspace,
      nodes: workspace.nodes.map((node) => {
        const point = graph.node(node.id);
        return { ...node, position: { x: point.x - 88, y: point.y - 59 } };
      }),
    }));
    requestAnimationFrame(
      () => void flowRef.current?.fitView({ padding: 0.18, duration: 300 }),
    );
  }

  function toggleVerificationFilter(status: WorkspaceVerification) {
    const next = verificationFilter.includes(status)
      ? verificationFilter.filter((item) => item !== status)
      : [...verificationFilter, status];
    setVerificationFilter(next);
    replaceCurrent((workspace) => ({
      ...workspace,
      filters: { verification: next },
    }));
  }

  function addCaseNode(entry: WorkspaceSourceReference) {
    if (
      !current ||
      current.nodes.some(
        (node) =>
          node.origin === "investigation" &&
          [
            node.sourceEntityId,
            node.sourceLocationId,
            node.sourceEventId,
            node.sourceFactId,
          ].includes(entry.sourceId),
      )
    )
      return;
    const record: WorkspaceNodeRecord = {
      id: id(),
      type: entry.type,
      label: entry.label,
      origin: "investigation",
      verificationStatus:
        entry.sourceVerificationStatus === "pending" ||
        entry.sourceVerificationStatus === "disputed"
          ? "manual"
          : "verified",
      sourceVerificationStatus: entry.sourceVerificationStatus ?? "verified",
      intelligenceOrigin: "CASE_DATABASE",
      sourceEntityId: entry.sourceKind === "entity" ? entry.sourceId : null,
      sourceLocationId: entry.sourceKind === "location" ? entry.sourceId : null,
      sourceEventId: entry.sourceKind === "event" ? entry.sourceId : null,
      sourceFactId: entry.sourceKind === "fact" ? entry.sourceId : null,
      investigationId,
      description: entry.description,
      metadata: { sourceKind: entry.sourceKind },
      position: {
        x: 140 + current.nodes.length * 28,
        y: 120 + (current.nodes.length % 4) * 90,
      },
    };
    commit((workspace) => ({
      ...workspace,
      nodes: [...workspace.nodes, record],
    }));
    setSelectedNodeIds([record.id]);
    triggerHaptic("light");
  }

  const caseEntries = useMemo(() => {
    const defaultStatus = investigation.type === "DEMO" ? "demo" : "verified";
    const entries: WorkspaceSourceReference[] = investigation.graph.nodes.map(
      (node) => ({
        sourceId: node.id,
        label: node.label,
        type: graphKindToWorkspaceType[node.kind],
        description: node.subtitle,
        sourceKind: "entity",
        sourceVerificationStatus: defaultStatus,
      }),
    );
    const ids = new Set(entries.map((item) => item.sourceId));
    for (const location of investigation.map.locations)
      if (!ids.has(location.id))
        entries.push({
          sourceId: location.id,
          label: location.title,
          type: "location",
          description: location.description,
          sourceKind: "location",
          sourceVerificationStatus: defaultStatus,
        });
    for (const event of investigation.timeline.events)
      entries.push({
        sourceId: event.id,
        label: event.title,
        type: "event",
        description: event.description,
        sourceKind: "event",
        sourceVerificationStatus: defaultStatus,
      });
    for (const fact of investigation.facts)
      entries.push({
        sourceId: fact.id,
        label: fact.text.length > 72 ? `${fact.text.slice(0, 69)}…` : fact.text,
        type: "evidence",
        description: `${fact.sourceTitle} // ${fact.status}`,
        sourceKind: "fact",
        sourceVerificationStatus: fact.status,
      });
    return entries;
  }, [investigation]);

  function comparisonFor(nodes: WorkspaceNodeRecord[]) {
    return {
      entityIds: uniqueIds(nodes.map((node) => node.sourceEntityId)),
      locationIds: uniqueIds(nodes.map((node) => node.sourceLocationId)),
      eventIds: uniqueIds(nodes.map((node) => node.sourceEventId)),
    };
  }

  function compareSelection(destination: "map" | "timeline") {
    const nodes = current.nodes.filter((node) =>
      selectedNodeIds.includes(node.id),
    );
    const selection = comparisonFor(nodes);
    setWorkspaceComparisonSelection(selection);
    setSelectedEntityId(null);
    setSelectedLocationId(null);
    setSelectedTimelineEventId(null);
    setActiveWorkspace(destination);
  }

  async function runAnalysis() {
    setAnalysisStatus("analyzing");
    try {
      const result = isSupabaseBrowserConfigured
        ? await analyzeGraphWorkspace(current.id)
        : analyzeWorkspaceDeterministically(current, investigation);
      commit((workspace) => ({
        ...workspace,
        suggestions: result.suggestions,
        conflicts: result.conflicts,
      }));
      setAnalysisStatus(result.aiAvailable ? "ready" : "unavailable");
      setEditor({ kind: "analysis" });
    } catch {
      const fallback = analyzeWorkspaceDeterministically(
        current,
        investigation,
      );
      commit((workspace) => ({
        ...workspace,
        suggestions: fallback.suggestions,
        conflicts: fallback.conflicts,
      }));
      setAnalysisStatus("unavailable");
      setEditor({ kind: "analysis" });
    }
  }

  function reviewSuggestion(
    suggestion: WorkspaceSuggestion,
    status: "ACCEPTED_AS_HYPOTHESIS" | "REJECTED",
  ) {
    if (suggestion.status !== "PENDING") return;
    const reviewedAt = new Date().toISOString();
    commit((workspace) => {
      const suggestions = workspace.suggestions.map((item) =>
        item.id === suggestion.id ? { ...item, status, reviewedAt } : item,
      );
      if (
        status === "REJECTED" ||
        workspace.edges.some(
          (edge) =>
            edge.source === suggestion.sourceNodeId &&
            edge.target === suggestion.targetNodeId,
        )
      ) {
        return { ...workspace, suggestions };
      }
      const hypothesis: WorkspaceEdgeRecord = {
        id: id(),
        source: suggestion.sourceNodeId,
        target: suggestion.targetNodeId,
        relationshipType: suggestion.suggestedRelationship,
        label: suggestion.suggestedRelationship,
        confidence: "hypothesis",
        verificationStatus: "hypothesis",
        reason: suggestion.explanation,
        intelligenceOrigin: "AI_SUGGESTED_ANALYST_ACCEPTED",
      };
      return {
        ...workspace,
        suggestions,
        edges: [...workspace.edges, hypothesis],
      };
    });
  }

  function saveQuestion(
    event: FormEvent<HTMLFormElement>,
    question?: WorkspaceQuestion,
  ) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const updatedAt = new Date().toISOString();
    const next: WorkspaceQuestion = question
      ? {
          ...question,
          questionText: String(
            data.get("questionText") || question.questionText,
          ).trim(),
          status: data.get("status") as WorkspaceQuestion["status"],
          notes: String(data.get("notes") || "").trim(),
          updatedAt,
          resolvedAt:
            data.get("status") === "RESOLVED"
              ? (question.resolvedAt ?? updatedAt)
              : null,
        }
      : {
          id: id(),
          questionText: String(
            data.get("questionText") || "UNTITLED QUESTION",
          ).trim(),
          status: "OPEN",
          notes: String(data.get("notes") || "").trim(),
          links: [],
          createdAt: updatedAt,
          updatedAt,
          resolvedAt: null,
        };
    commit((workspace) => ({
      ...workspace,
      questions: question
        ? workspace.questions.map((item) =>
            item.id === question.id ? next : item,
          )
        : [...workspace.questions, next],
    }));
    setEditor({ kind: "questions" });
  }

  function linkSelectedNodesToQuestion(question: WorkspaceQuestion) {
    if (!selectedNodeIds.length && !selectedEdgeId) return;
    const links = [
      ...question.links,
      ...selectedNodeIds
        .filter(
          (nodeId) =>
            !question.links.some(
              (link) =>
                link.resourceType === "node" && link.resourceId === nodeId,
            ),
        )
        .map((nodeId) => ({
          resourceType: "node" as const,
          resourceId: nodeId,
          relationship: "RELATED" as const,
        })),
      ...(selectedEdgeId &&
      !question.links.some(
        (link) =>
          link.resourceType === "edge" && link.resourceId === selectedEdgeId,
      )
        ? [
            {
              resourceType: "edge" as const,
              resourceId: selectedEdgeId,
              relationship: "RELATED" as const,
            },
          ]
        : []),
    ];
    commit((workspace) => ({
      ...workspace,
      questions: workspace.questions.map((item) =>
        item.id === question.id
          ? { ...item, links, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }

  function createSnapshotRecord(
    name: string,
    description: string,
  ): WorkspaceSnapshot {
    return {
      id: id(),
      name,
      description,
      createdAt: new Date().toISOString(),
      snapshotData: snapshotData(current),
    };
  }

  function saveSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = createSnapshotRecord(
      String(
        data.get("name") || `WORKING THEORY ${current.snapshots.length + 1}`,
      ).trim(),
      String(data.get("description") || "").trim(),
    );
    commit((workspace) => ({
      ...workspace,
      snapshots: [...workspace.snapshots, item],
    }));
    setEditor({ kind: "snapshots" });
  }

  function restoreSnapshot(item: WorkspaceSnapshot) {
    if (
      !confirm(
        "RESTORE WORKSPACE?\n\nThe current workspace will be replaced by this snapshot. A backup snapshot will be created first.",
      )
    )
      return;
    const backup = createSnapshotRecord(
      `BACKUP BEFORE ${item.name}`,
      "Automatic backup created before snapshot restore.",
    );
    commit((workspace) => ({
      ...workspace,
      ...structuredClone(item.snapshotData),
      snapshots: [...workspace.snapshots, backup],
    }));
    setPathNodeIds([]);
    setPathEdgeIds([]);
    setPathResult(null);
    setEditor(null);
  }

  useEffect(() => {
    if (
      !current ||
      !networkWorkspaceRequest ||
      processedRequest.current === networkWorkspaceRequest.sequence
    )
      return;
    if (
      networkWorkspaceRequest.action === "add-source" &&
      networkWorkspaceRequest.targetWorkspaceId &&
      current.id !== networkWorkspaceRequest.targetWorkspaceId
    ) {
      if (
        workspaces.some(
          (workspace) =>
            workspace.id === networkWorkspaceRequest.targetWorkspaceId,
        )
      )
        setActiveId(networkWorkspaceRequest.targetWorkspaceId);
      return;
    }
    processedRequest.current = networkWorkspaceRequest.sequence;
    switch (networkWorkspaceRequest.action) {
      case "add-source":
        addCaseNode(networkWorkspaceRequest.source);
        break;
      case "add-node":
        setEditor({
          kind: "node",
          defaultType: networkWorkspaceRequest.nodeType,
        });
        break;
      case "add-note":
        setEditor({ kind: "node", defaultType: "note" });
        break;
      case "auto-layout":
        autoLayout();
        break;
      case "fit-view":
        requestAnimationFrame(
          () => void flowRef.current?.fitView({ padding: 0.18, duration: 300 }),
        );
        break;
      case "search":
        requestAnimationFrame(() => searchInputRef.current?.focus());
        break;
      case "open":
        break;
    }
    // The request sequence is the command boundary; workspace helpers intentionally use the current render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, networkWorkspaceRequest, workspaces]);

  if (!current)
    return (
      <div className="grid h-full place-items-center font-mono text-xs font-black uppercase">
        Loading custom workspace…
      </div>
    );
  const selectedNode = current.nodes.find(
    (node) => selectedNodeIds.length === 1 && node.id === selectedNodeIds[0],
  );
  const selectedEdge = current.edges.find((edge) => edge.id === selectedEdgeId);
  const selectedResourceId = selectedNode?.id ?? selectedEdge?.id ?? null;
  const selectedBasis = selectedNode
    ? getNodeBasis(selectedNode, investigation)
    : selectedEdge
      ? getEdgeBasis(selectedEdge, current, investigation)
      : [];
  const selectedSupport = selectedEdge
    ? getEvidenceSupport(selectedEdge, current, investigation)
    : null;
  const relevantConflicts = selectedResourceId
    ? current.conflicts.filter((conflict) =>
        [conflict.resourceAId, conflict.resourceBId].includes(
          selectedResourceId,
        ),
      )
    : [];
  const relevantSuggestions = selectedNode
    ? current.suggestions.filter((suggestion) =>
        [suggestion.sourceNodeId, suggestion.targetNodeId].includes(
          selectedNode.id,
        ),
      )
    : [];
  const comparisonSelection = comparisonFor(
    current.nodes.filter((node) => selectedNodeIds.includes(node.id)),
  );
  const canCompareOnMap =
    comparisonSelection.entityIds.length > 0 ||
    comparisonSelection.locationIds.length > 0;
  const canCompareOnTimeline =
    comparisonSelection.entityIds.length > 0 ||
    comparisonSelection.locationIds.length > 0 ||
    comparisonSelection.eventIds.length > 0;
  const sourceEvent = selectedNode?.sourceEventId
    ? investigation.timeline.events.find(
        (event) => event.id === selectedNode.sourceEventId,
      )
    : null;
  const sourceFact = selectedNode?.sourceFactId
    ? investigation.facts.find((fact) => fact.id === selectedNode.sourceFactId)
    : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--paper)] text-[var(--ink)]">
      <div className="shrink-0 border-b-4 border-[var(--ink)] bg-[var(--paper)] p-2 font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-52 flex-1 items-center gap-2 text-[9px] font-black uppercase sm:flex-none">
            Workspace
            <select
              value={current.id}
              onChange={(event) => {
                const next = workspaces.find(
                  (workspace) => workspace.id === event.target.value,
                );
                setActiveId(event.target.value);
                setVerificationFilter(
                  next?.filters?.verification ?? [
                    "verified",
                    "manual",
                    "hypothesis",
                  ],
                );
                setPast([]);
                setFuture([]);
              }}
              className={`${fieldClass} !min-h-9 min-w-0 py-1 sm:w-56`}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass}
            type="button"
            onClick={() => setEditor({ kind: "workspace" })}
          >
            <Plus size={14} className="inline" /> New
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() => setEditor({ kind: "workspace", workspace: current })}
          >
            Rename
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() => {
              const copy = {
                ...structuredClone(current),
                id: id(),
                name: `${current.name} COPY`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
              };
              setWorkspaces((items) => [...items, copy]);
              setActiveId(copy.id);
            }}
          >
            Duplicate
          </button>
          <button
            className={`${buttonClass} !bg-[var(--danger)] !text-white`}
            type="button"
            disabled={workspaces.length === 1}
            onClick={() => {
              if (
                !confirm(
                  `DELETE WORKSPACE?\n\n${current.name}\n\nThis does not modify case data.`,
                )
              )
                return;
              setWorkspaces((items) =>
                items.filter((item) => item.id !== current.id),
              );
              setActiveId(
                workspaces.find((item) => item.id !== current.id)?.id ?? "",
              );
              if (isSupabaseBrowserConfigured)
                void deleteGraphWorkspace(current.id).catch(() => undefined);
            }}
          >
            <Trash2 size={13} className="inline" /> Delete
          </button>
          <span
            className="ml-auto text-[9px] font-black uppercase"
            aria-live="polite"
          >
            ●{" "}
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "local"
                ? "Saved locally"
                : "Saved"}
          </span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <button
            className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
            type="button"
            onClick={() => setEditor({ kind: "node", defaultType: "person" })}
          >
            <Plus size={14} className="inline" /> Node
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() => {
              if (current.nodes.length < 2) {
                alert(
                  "Create or import at least two nodes before connecting them.",
                );
                return;
              }
              const source = selectedNodeIds[0] ?? current.nodes[0].id;
              const target =
                selectedNodeIds.find((nodeId) => nodeId !== source) ??
                current.nodes.find((node) => node.id !== source)!.id;
              setEditor({ kind: "edge", source, target });
            }}
          >
            <GitBranchPlus size={14} className="inline" /> Connect
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() =>
              selectedNodeIds.length
                ? setEditor({ kind: "group" })
                : alert("Select two or more nodes to create a group.")
            }
          >
            <LayoutTemplate size={14} className="inline" /> Group
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() => setEditor({ kind: "node", defaultType: "note" })}
          >
            <NotebookPen size={14} className="inline" /> Note
          </button>
          <button
            className={`${buttonClass} !bg-[var(--accent)]`}
            type="button"
            onClick={() => setEditor({ kind: "case" })}
          >
            Add From Case
          </button>
          <button className={buttonClass} type="button" onClick={autoLayout}>
            <LayoutTemplate size={14} className="inline" /> Auto Layout
          </button>
          <button
            className={buttonClass}
            type="button"
            disabled={!past.length}
            onClick={undo}
          >
            <Undo2 size={14} className="inline" /> Undo
          </button>
          <button
            className={buttonClass}
            type="button"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={14} className="inline" /> Redo
          </button>
          <button
            className={buttonClass}
            type="button"
            onClick={() =>
              void flowRef.current?.fitView({ padding: 0.18, duration: 300 })
            }
          >
            <Focus size={14} className="inline" /> Fit
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto border-2 border-[var(--ink)] bg-[var(--panel)] p-1.5 text-[8px] font-black uppercase">
          <span className="shrink-0 bg-[var(--ink)] px-2 py-1.5 text-[var(--paper)]">
            Workspace // {current.name}
          </span>
          <span className="shrink-0">{current.nodes.length} nodes</span>
          <span className="shrink-0">{current.edges.length} links</span>
          <span className="shrink-0">
            {
              current.edges.filter(
                (edge) => edge.verificationStatus === "hypothesis",
              ).length
            }{" "}
            hypotheses
          </span>
          <span className="shrink-0">
            {
              current.conflicts.filter((conflict) => conflict.status === "OPEN")
                .length
            }{" "}
            conflicts
          </span>
          <span className="shrink-0">
            {
              current.questions.filter(
                (question) => !["RESOLVED", "CLOSED"].includes(question.status),
              ).length
            }{" "}
            open questions
          </span>
          <button
            className={`${buttonClass} ml-auto !min-h-8 shrink-0 !bg-[var(--accent)] !px-2 !py-1`}
            type="button"
            onClick={() => void runAnalysis()}
          >
            <BrainCircuit size={13} className="inline" /> Analyze Connections
          </button>
          <button
            className={`${buttonClass} !min-h-8 shrink-0 !px-2 !py-1`}
            type="button"
            onClick={() => setEditor({ kind: "path" })}
          >
            <Route size={13} className="inline" /> Find Path
          </button>
          <button
            className={`${buttonClass} !min-h-8 shrink-0 !px-2 !py-1`}
            type="button"
            onClick={() => setEditor({ kind: "questions" })}
          >
            <ListChecks size={13} className="inline" /> Questions
          </button>
          <button
            className={`${buttonClass} !min-h-8 shrink-0 !px-2 !py-1`}
            type="button"
            onClick={() => setEditor({ kind: "snapshots" })}
          >
            <History size={13} className="inline" /> History
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <aside
          className={`${libraryOpen ? "w-48" : "w-11"} z-30 hidden shrink-0 overflow-hidden border-r-4 border-[var(--ink)] bg-[var(--paper)] transition-[width] sm:block`}
        >
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between border-b-4 border-[var(--ink)] px-3 font-mono text-[10px] font-black uppercase"
            onClick={() => setLibraryOpen((open) => !open)}
            aria-expanded={libraryOpen}
          >
            {libraryOpen ? "Node Library" : ""}
            {libraryOpen ? (
              <ChevronLeft size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          {libraryOpen ? (
            <div className="h-[calc(100%-2.75rem)] overflow-y-auto p-2">
              {workspaceNodeTypes.map((type) => {
                const Icon = iconByType[type];
                return (
                  <button
                    key={type}
                    type="button"
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "application/crimelens-node",
                        type,
                      )
                    }
                    onClick={() => createNode(type)}
                    className="mb-2 flex min-h-10 w-full items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-2 text-left font-mono text-[9px] font-black uppercase shadow-[2px_2px_0_var(--ink)]"
                  >
                    <Icon size={15} strokeWidth={3} />
                    {type}
                  </button>
                );
              })}
              {current.groups.length ? (
                <div className="mt-4 border-t-4 border-[var(--ink)] pt-3">
                  <p className="mb-2 font-mono text-[9px] font-black uppercase">
                    Groups
                  </p>
                  {current.groups.map((group) => (
                    <div
                      key={group.id}
                      className="mb-2 flex items-center gap-1 border-2 border-dashed border-[var(--ink)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[8px] font-black uppercase"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {group.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete group ${group.name}`}
                        onClick={() =>
                          commit((workspace) => ({
                            ...workspace,
                            groups: workspace.groups.filter(
                              (item) => item.id !== group.id,
                            ),
                          }))
                        }
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <main
          className="relative min-w-0 flex-1"
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event: DragEvent<HTMLElement>) => {
            event.preventDefault();
            const type = event.dataTransfer.getData(
              "application/crimelens-node",
            ) as WorkspaceNodeType;
            if (!workspaceNodeTypes.includes(type)) return;
            const position = flowRef.current?.screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });
            createNode(type, position);
          }}
        >
          <div className="absolute left-3 right-3 top-3 z-20 flex max-w-xl gap-2">
            <label className="relative min-w-0 flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={15}
              />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="SEARCH WORKSPACE"
                className={`${fieldClass} pl-9`}
              />
            </label>
            <div className="flex border-2 border-[var(--ink)] bg-[var(--panel)] p-1">
              {(
                ["verified", "manual", "hypothesis"] as WorkspaceVerification[]
              ).map((status) => (
                <button
                  key={status}
                  type="button"
                  aria-pressed={verificationFilter.includes(status)}
                  onClick={() => toggleVerificationFilter(status)}
                  className={`px-2 font-mono text-[8px] font-black uppercase ${verificationFilter.includes(status) ? "bg-[var(--ink)] text-[var(--paper)]" : "opacity-45"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          {selectedNodeIds.length > 1 ? (
            <div className="absolute left-3 top-16 z-20 flex gap-2 border-2 border-[var(--ink)] bg-[var(--accent)] p-2 font-mono text-[9px] font-black uppercase shadow-[3px_3px_0_var(--ink)]">
              <span className="self-center">
                {selectedNodeIds.length} selected
              </span>
              {canCompareOnTimeline ? (
                <button
                  type="button"
                  className={`${buttonClass} !min-h-8 !bg-[var(--panel)] !px-2 !py-1`}
                  onClick={() => compareSelection("timeline")}
                >
                  <Waypoints size={13} className="inline" /> Compare on timeline
                </button>
              ) : null}
              {canCompareOnMap ? (
                <button
                  type="button"
                  className={`${buttonClass} !min-h-8 !bg-[var(--panel)] !px-2 !py-1`}
                  onClick={() => compareSelection("map")}
                >
                  <MapPin size={13} className="inline" /> Compare on map
                </button>
              ) : null}
            </div>
          ) : null}
          {!current.nodes.length ? (
            <EmptyState
              onNode={() => setEditor({ kind: "node", defaultType: "person" })}
              onCase={() => setEditor({ kind: "case" })}
            />
          ) : null}
          <ReactFlow<CanvasNode, Edge<WorkspaceEdgeData>>
            key={current.id}
            nodes={canvasNodes}
            edges={canvasEdges}
            onlyRenderVisibleElements
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flowRef.current = instance;
            }}
            defaultViewport={current.viewport}
            onMoveEnd={(_, viewport) =>
              replaceCurrent((workspace) => ({ ...workspace, viewport }))
            }
            onNodeDragStart={() => {
              dragStart.current = snapshot(current);
            }}
            onNodeDrag={(_, draggedNode) => {
              if (draggedNode.type !== "workspaceEntity") return;
              replaceCurrent((workspace) => ({
                ...workspace,
                nodes: workspace.nodes.map((node) =>
                  node.id === draggedNode.id
                    ? { ...node, position: draggedNode.position }
                    : node,
                ),
              }));
            }}
            onNodeDragStop={() => {
              if (dragStart.current) {
                setPast((items) => [...items.slice(-39), dragStart.current!]);
                setFuture([]);
                dragStart.current = null;
              }
            }}
            onConnect={onConnect}
            onNodeClick={(event, node) => {
              if (node.type !== "workspaceEntity") return;
              setSelectedNodeIds((previous) =>
                event.shiftKey
                  ? previous.includes(node.id)
                    ? previous.filter((nodeId) => nodeId !== node.id)
                    : [...previous, node.id]
                  : [node.id],
              );
              setSelectedEdgeId(null);
              setInspectorTab("details");
              setInspectorOpen(true);
            }}
            onSelectionEnd={() => {
              const selectedNodes =
                flowRef.current?.getNodes().filter((node) => node.selected) ??
                [];
              setSelectedNodeIds(
                selectedNodes
                  .filter((node) => node.type === "workspaceEntity")
                  .map((node) => node.id),
              );
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              if (edge.id.startsWith("suggestion:")) return;
              setSelectedEdgeId(edge.id);
              setSelectedNodeIds([]);
              setInspectorTab("details");
              setInspectorOpen(true);
            }}
            onPaneClick={() => {
              setSelectedNodeIds([]);
              setSelectedEdgeId(null);
            }}
            fitView={!current.nodes.length}
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            selectionOnDrag
            panOnDrag={[1, 2]}
            multiSelectionKeyCode="Shift"
            deleteKeyCode={null}
            className="bg-[var(--paper)]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="var(--dim)"
              gap={24}
              size={1.2}
            />
            <Controls position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              className="!rounded-none !border-2 !border-[var(--ink)] !bg-[var(--panel)]"
              nodeColor={(node) =>
                node.type === "workspaceGroup" ? "var(--accent)" : "var(--ink)"
              }
            />
          </ReactFlow>
        </main>

        {(selectedNode || selectedEdge) && inspectorOpen ? (
          <aside className="absolute bottom-3 right-3 z-40 max-h-[calc(100%-1.5rem)] w-[min(340px,calc(100%-1.5rem))] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--panel)] p-4 font-mono text-[10px] font-black uppercase shadow-[6px_6px_0_var(--ink)]">
            <button
              type="button"
              className="absolute right-2 top-2"
              onClick={() => setInspectorOpen(false)}
              aria-label="Close inspector"
            >
              <X size={18} />
            </button>
            <p className="mb-2 opacity-60">
              {selectedNode
                ? `Entity // ${selectedNode.type}`
                : "Relationship basis"}
            </p>
            <h3 className="border-b-2 border-[var(--ink)] pb-3 pr-5 font-serif text-xl font-black">
              {selectedNode ? (
                selectedNode.label
              ) : (
                <>
                  {
                    current.nodes.find(
                      (node) => node.id === selectedEdge?.source,
                    )?.label
                  }
                  <br />→ {selectedEdge?.label} →<br />
                  {
                    current.nodes.find(
                      (node) => node.id === selectedEdge?.target,
                    )?.label
                  }
                </>
              )}
            </h3>
            <div className="mt-3 flex overflow-x-auto border-2 border-[var(--ink)]">
              {(
                [
                  "details",
                  "basis",
                  "connections",
                  "conflicts",
                  "ai",
                ] as InspectorTab[]
              )
                .filter((tab) => tab !== "ai" || selectedNode)
                .map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setInspectorTab(tab)}
                    className={`min-h-8 shrink-0 border-r-2 border-[var(--ink)] px-2 text-[8px] last:border-r-0 ${inspectorTab === tab ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--panel)]"}`}
                  >
                    {tab}
                  </button>
                ))}
            </div>

            {inspectorTab === "details" ? (
              <div className="mt-3">
                {selectedNode ? (
                  <>
                    <dl className="grid grid-cols-2 gap-2">
                      <dt>Origin</dt>
                      <dd>
                        {selectedNode.intelligenceOrigin?.replaceAll(
                          "_",
                          " ",
                        ) ??
                          (selectedNode.origin === "investigation"
                            ? "Case database"
                            : "Investigator created")}
                      </dd>
                      <dt>Verification</dt>
                      <dd>
                        {selectedNode.sourceVerificationStatus ??
                          selectedNode.verificationStatus}
                      </dd>
                      <dt>Related</dt>
                      <dd>
                        {current.edges
                          .filter(
                            (edge) =>
                              edge.source === selectedNode.id ||
                              edge.target === selectedNode.id,
                          )
                          .length.toString()
                          .padStart(2, "0")}
                      </dd>
                    </dl>
                    {selectedNode.sourceVerificationStatus === "pending" ||
                    selectedNode.sourceVerificationStatus === "disputed" ? (
                      <p className="mt-3 border-2 border-[var(--danger)] bg-[var(--danger)] p-2 text-white">
                        Source record requires analyst review
                      </p>
                    ) : null}
                    {selectedNode.verificationStatus === "hypothesis" ? (
                      <p className="mt-3 border-2 border-dashed border-[var(--ink)] bg-[var(--accent)] p-2">
                        Not verified case data
                      </p>
                    ) : null}
                    {selectedNode.description ? (
                      <p className="mt-3 border-t-2 border-[var(--ink)] pt-3 normal-case">
                        {selectedNode.description}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-2">
                      {selectedNode.origin === "manual" ? (
                        <button
                          type="button"
                          className={buttonClass}
                          onClick={() =>
                            setEditor({ kind: "node", node: selectedNode })
                          }
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => {
                          const copy = {
                            ...selectedNode,
                            id: id(),
                            label: `${selectedNode.label} COPY`,
                            origin: "manual" as const,
                            intelligenceOrigin: "INVESTIGATOR_CREATED" as const,
                            verificationStatus: "manual" as const,
                            sourceVerificationStatus: undefined,
                            sourceEntityId: null,
                            sourceEventId: null,
                            sourceLocationId: null,
                            sourceFactId: null,
                            position: {
                              x: selectedNode.position.x + 35,
                              y: selectedNode.position.y + 35,
                            },
                          };
                          commit((workspace) => ({
                            ...workspace,
                            nodes: [...workspace.nodes, copy],
                          }));
                        }}
                      >
                        Duplicate as manual
                      </button>
                      <button
                        type="button"
                        className={`${buttonClass} !bg-[var(--danger)] !text-white`}
                        onClick={deleteSelection}
                      >
                        {selectedNode.origin === "investigation"
                          ? "Remove reference"
                          : "Delete entity"}
                      </button>
                    </div>
                  </>
                ) : selectedEdge ? (
                  <>
                    <dl className="grid grid-cols-2 gap-2">
                      <dt>Status</dt>
                      <dd>{selectedEdge.verificationStatus}</dd>
                      <dt>Origin</dt>
                      <dd>
                        {selectedEdge.intelligenceOrigin?.replaceAll(
                          "_",
                          " ",
                        ) ?? "Investigator created"}
                      </dd>
                      <dt>Confidence</dt>
                      <dd>{selectedEdge.confidence}</dd>
                    </dl>
                    {selectedEdge.verificationStatus === "hypothesis" ? (
                      <p className="mt-3 border-2 border-dashed border-[var(--ink)] bg-[var(--accent)] p-2">
                        Analyst hypothesis // not verified case data
                      </p>
                    ) : null}
                    {selectedEdge.reason ? (
                      <p className="mt-3 border-t-2 border-[var(--ink)] pt-3 normal-case">
                        {selectedEdge.reason}
                      </p>
                    ) : null}
                    <div className="mt-4 grid gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() =>
                          setEditor({
                            kind: "edge",
                            edge: selectedEdge,
                            source: selectedEdge.source,
                            target: selectedEdge.target,
                          })
                        }
                      >
                        Edit relationship
                      </button>
                      <button
                        type="button"
                        className={`${buttonClass} !bg-[var(--danger)] !text-white`}
                        onClick={deleteSelection}
                      >
                        Delete connection
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {inspectorTab === "basis" ? (
              <div className="mt-3">
                <p className="border-2 border-[var(--ink)] bg-[var(--ink)] p-2 text-[var(--paper)]">
                  {selectedNode ? "Source provenance" : "Relationship basis"}
                </p>
                {selectedSupport ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <dt>Evidence support</dt>
                    <dd>{selectedSupport.status.replaceAll("_", " ")}</dd>
                    <dt>Verified sources</dt>
                    <dd>{selectedSupport.verifiedSources}</dd>
                    <dt>Analyst notes</dt>
                    <dd>{selectedSupport.analystNotes}</dd>
                    <dt>Known conflicts</dt>
                    <dd>{selectedSupport.conflicts}</dd>
                  </dl>
                ) : null}
                <div className="mt-3 grid gap-2">
                  {selectedBasis.length ? (
                    selectedBasis.map((basis) => (
                      <article
                        key={`${basis.resourceType}:${basis.id}`}
                        className="border-2 border-[var(--ink)] p-2"
                      >
                        <p>
                          {basis.verified ? "✓" : "○"} {basis.label}
                        </p>
                        <p className="mt-1 text-[8px] opacity-60">
                          {basis.resourceType} //{" "}
                          {basis.verified ? "verified" : "review required"}
                        </p>
                        {basis.sourceRef ? (
                          <p className="mt-1 break-all text-[8px] normal-case">
                            {basis.sourceRef}
                          </p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <p className="border-2 border-dashed border-[var(--ink)] p-3">
                      No authoritative source attached. Basis is manual
                      investigator reasoning.
                    </p>
                  )}
                </div>
                {selectedNode?.origin === "investigation" || selectedEdge ? (
                  <button
                    type="button"
                    className={`${buttonClass} mt-3 w-full`}
                    onClick={openLedger}
                  >
                    Open source records
                  </button>
                ) : null}
              </div>
            ) : null}

            {inspectorTab === "connections" && selectedNode ? (
              <div className="mt-3 grid gap-2">
                {selectedNode.sourceLocationId ||
                selectedNode.sourceEntityId ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      if (selectedNode.sourceLocationId)
                        setSelectedLocationId(selectedNode.sourceLocationId);
                      else
                        setSelectedEntityId(
                          selectedNode.sourceEntityId ?? null,
                        );
                      setActiveWorkspace("map");
                    }}
                  >
                    View on map
                  </button>
                ) : null}
                {selectedNode.sourceEventId ||
                selectedNode.sourceEntityId ||
                selectedNode.sourceLocationId ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      if (selectedNode.sourceEventId)
                        setSelectedTimelineEventId(selectedNode.sourceEventId);
                      else
                        setSelectedEntityId(
                          selectedNode.sourceEntityId ??
                            selectedNode.sourceLocationId ??
                            null,
                        );
                      setActiveWorkspace("timeline");
                    }}
                  >
                    View in timeline
                  </button>
                ) : null}
                {sourceEvent?.linkedLocationIds[0] ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      setSelectedLocationId(sourceEvent.linkedLocationIds[0]);
                      setActiveWorkspace("map");
                    }}
                  >
                    Open event location
                  </button>
                ) : null}
                {selectedNode.origin === "investigation" ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={openLedger}
                  >
                    Open evidence
                  </button>
                ) : null}
                {sourceFact?.linkedEntityIds[0] ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      setSelectedEntityId(sourceFact.linkedEntityIds[0]);
                      setNetworkMode("case");
                      setActiveWorkspace("network");
                    }}
                  >
                    View linked entities
                  </button>
                ) : null}
                {selectedNode.sourceEntityId ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => {
                      setSelectedEntityId(selectedNode.sourceEntityId!);
                      setNetworkMode("case");
                      setActiveWorkspace("network");
                    }}
                  >
                    View case record
                  </button>
                ) : null}
                <p className="mt-2 border-t-2 border-[var(--ink)] pt-2">
                  Linked workspace records
                </p>
                {current.edges
                  .filter(
                    (edge) =>
                      edge.source === selectedNode.id ||
                      edge.target === selectedNode.id,
                  )
                  .map((edge) => {
                    const otherId =
                      edge.source === selectedNode.id
                        ? edge.target
                        : edge.source;
                    return (
                      <button
                        key={edge.id}
                        type="button"
                        className="border-2 border-[var(--ink)] p-2 text-left"
                        onClick={() => {
                          setSelectedNodeIds([otherId]);
                          setInspectorTab("details");
                        }}
                      >
                        {edge.label} //{" "}
                        {
                          current.nodes.find((node) => node.id === otherId)
                            ?.label
                        }
                      </button>
                    );
                  })}
              </div>
            ) : null}

            {inspectorTab === "conflicts" ? (
              <div className="mt-3 grid gap-2">
                {relevantConflicts.length ? (
                  relevantConflicts.map((conflict) => (
                    <article
                      key={conflict.id}
                      className="border-2 border-[var(--danger)] p-3"
                    >
                      <p className="text-[var(--danger)]">
                        Potential conflict // requires review
                      </p>
                      <p className="mt-2 normal-case">{conflict.explanation}</p>
                      <p className="mt-2 text-[8px]">
                        {conflict.conflictType.replaceAll("_", " ")} //{" "}
                        {conflict.status}
                      </p>
                      {conflict.status === "OPEN" ? (
                        <button
                          type="button"
                          className={`${buttonClass} mt-2 w-full`}
                          onClick={() =>
                            commit((workspace) => ({
                              ...workspace,
                              conflicts: workspace.conflicts.map((item) =>
                                item.id === conflict.id
                                  ? {
                                      ...item,
                                      status: "REVIEWED",
                                      reviewedAt: new Date().toISOString(),
                                    }
                                  : item,
                              ),
                            }))
                          }
                        >
                          Mark reviewed
                        </button>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="border-2 border-dashed border-[var(--ink)] p-3">
                    No deterministic conflicts attached to this record.
                  </p>
                )}
              </div>
            ) : null}

            {inspectorTab === "ai" && selectedNode ? (
              <div className="mt-3 grid gap-2">
                <p className="border-2 border-[var(--ink)] bg-[var(--accent)] p-2">
                  Suggestions are unverified until an analyst accepts one as a
                  hypothesis.
                </p>
                {relevantSuggestions.length ? (
                  relevantSuggestions.map((suggestion) => (
                    <article
                      key={suggestion.id}
                      className="border-2 border-dashed border-[var(--ink)] p-3"
                    >
                      <p>
                        Connection suggestion // {suggestion.signalStrength}{" "}
                        signal
                      </p>
                      <p className="mt-2 normal-case">
                        {suggestion.explanation}
                      </p>
                      <p className="mt-2 text-[8px]">
                        {suggestion.reasonCodes.join(" // ")}
                      </p>
                      <p className="mt-2">Status // {suggestion.status}</p>
                      {suggestion.status === "PENDING" ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() =>
                              reviewSuggestion(suggestion, "REJECTED")
                            }
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className={`${buttonClass} !bg-[var(--accent)]`}
                            onClick={() =>
                              reviewSuggestion(
                                suggestion,
                                "ACCEPTED_AS_HYPOTHESIS",
                              )
                            }
                          >
                            Add as hypothesis
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="border-2 border-dashed border-[var(--ink)] p-3">
                    No connection suggestion for this node. Run analysis after
                    adding authoritative references.
                  </p>
                )}
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {editor?.kind === "node" ? (
        <Modal
          title={
            editor.node
              ? "Edit Entity"
              : editor.defaultType === "note"
                ? "Add Investigator Note"
                : "Create Entity"
          }
          onClose={() => setEditor(null)}
        >
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => saveNode(event, editor.node)}
          >
            <label className="text-[10px] font-black uppercase">
              Type
              <select
                name="type"
                defaultValue={
                  editor.node?.type ?? editor.defaultType ?? "person"
                }
                className={`${fieldClass} mt-1`}
              >
                {workspaceNodeTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase">
              Label
              <input
                required
                maxLength={120}
                name="label"
                defaultValue={editor.node?.label}
                className={`${fieldClass} mt-1`}
                autoFocus
              />
            </label>
            <label className="text-[10px] font-black uppercase">
              Verification
              <select
                name="verification"
                defaultValue={
                  editor.node?.verificationStatus ??
                  (editor.defaultType === "note" ? "manual" : "manual")
                }
                className={`${fieldClass} mt-1`}
              >
                <option value="manual">MANUAL</option>
                <option value="hypothesis">HYPOTHESIS</option>
              </select>
            </label>
            <label className="text-[10px] font-black uppercase">
              Description / Notes
              <textarea
                name="description"
                defaultValue={editor.node?.description}
                rows={4}
                className={`${fieldClass} mt-1 resize-y`}
              />
            </label>
            <button
              className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
              type="submit"
            >
              {editor.node ? "Save changes" : "Create node"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "edge" ? (
        <Modal
          title={editor.edge ? "Edit Relationship" : "Create Relationship"}
          onClose={() => setEditor(null)}
        >
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => saveEdge(event, editor)}
          >
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="text-[10px] font-black uppercase">
                From
                <select
                  name="source"
                  defaultValue={editor.source}
                  className={`${fieldClass} mt-1`}
                >
                  {current.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="pb-3 font-black">→</span>
              <label className="text-[10px] font-black uppercase">
                To
                <select
                  name="target"
                  defaultValue={editor.target}
                  className={`${fieldClass} mt-1`}
                >
                  {current.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-[10px] font-black uppercase">
              Relationship
              <select
                name="relationshipType"
                defaultValue={
                  editor.edge?.relationshipType ?? "ASSOCIATED WITH"
                }
                className={`${fieldClass} mt-1`}
              >
                {relationshipTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase">
              Custom label
              <input
                name="customLabel"
                defaultValue={
                  editor.edge?.relationshipType === "CUSTOM"
                    ? editor.edge.label
                    : ""
                }
                maxLength={48}
                className={`${fieldClass} mt-1`}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] font-black uppercase">
                Status
                <select
                  name="verification"
                  defaultValue={editor.edge?.verificationStatus ?? "manual"}
                  className={`${fieldClass} mt-1`}
                >
                  <option value="manual">MANUAL</option>
                  <option value="hypothesis">HYPOTHESIS</option>
                  <option value="verified" disabled>
                    VERIFIED / CASE ONLY
                  </option>
                </select>
              </label>
              <label className="text-[10px] font-black uppercase">
                Confidence
                <select
                  name="confidence"
                  defaultValue={editor.edge?.confidence ?? "medium"}
                  className={`${fieldClass} mt-1`}
                >
                  <option value="confirmed">CONFIRMED</option>
                  <option value="high">HIGH</option>
                  <option value="medium">MEDIUM</option>
                  <option value="low">LOW</option>
                  <option value="hypothesis">HYPOTHESIS</option>
                </select>
              </label>
            </div>
            <label className="text-[10px] font-black uppercase">
              Source / Reason
              <textarea
                name="reason"
                defaultValue={editor.edge?.reason}
                rows={3}
                className={`${fieldClass} mt-1 resize-y`}
              />
            </label>
            <button
              className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
              type="submit"
            >
              {editor.edge ? "Save relationship" : "Create connection"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "workspace" ? (
        <Modal
          title={editor.workspace ? "Rename Workspace" : "New Graph Workspace"}
          onClose={() => setEditor(null)}
        >
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = String(
                data.get("name") || "UNTITLED WORKSPACE",
              ).trim();
              const description = String(data.get("description") || "").trim();
              if (editor.workspace)
                replaceCurrent((workspace) => ({
                  ...workspace,
                  name,
                  description,
                }));
              else {
                const created = createBlankWorkspace(
                  investigationId,
                  name,
                  description,
                );
                setWorkspaces((items) => [...items, created]);
                setActiveId(created.id);
              }
              setEditor(null);
            }}
          >
            <label className="text-[10px] font-black uppercase">
              Name
              <input
                required
                name="name"
                defaultValue={editor.workspace?.name}
                className={`${fieldClass} mt-1`}
                autoFocus
              />
            </label>
            <label className="text-[10px] font-black uppercase">
              Description
              <textarea
                name="description"
                defaultValue={editor.workspace?.description}
                rows={3}
                className={`${fieldClass} mt-1`}
              />
            </label>
            <p className="font-mono text-[10px] font-bold uppercase">
              Base // Blank workspace
            </p>
            <button
              type="submit"
              className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
            >
              {editor.workspace ? "Save" : "Create"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "group" ? (
        <Modal
          title="Create Investigative Group"
          onClose={() => setEditor(null)}
        >
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              commit((workspace) => ({
                ...workspace,
                groups: [
                  ...workspace.groups,
                  {
                    id: id(),
                    name: String(data.get("name") || "ANALYST GROUP"),
                    groupType: String(data.get("groupType") || "CUSTOM"),
                    nodeIds: selectedNodeIds,
                  },
                ],
              }));
              setEditor(null);
            }}
          >
            <p className="font-mono text-[10px] font-black uppercase">
              Selected entities // {selectedNodeIds.length}
            </p>
            <label className="text-[10px] font-black uppercase">
              Group name
              <input
                required
                name="name"
                className={`${fieldClass} mt-1`}
                autoFocus
              />
            </label>
            <label className="text-[10px] font-black uppercase">
              Type
              <select name="groupType" className={`${fieldClass} mt-1`}>
                {[
                  "SUSPECT CLUSTER",
                  "FINANCIAL CLUSTER",
                  "COMMUNICATION CLUSTER",
                  "LOCATION CLUSTER",
                  "TIMELINE CLUSTER",
                  "HYPOTHESIS",
                  "CUSTOM",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
            >
              Create group
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "case" ? (
        <Modal title="Case Entity Library" onClose={() => setEditor(null)}>
          <div className="p-4">
            <input
              value={caseQuery}
              onChange={(event) => setCaseQuery(event.target.value)}
              placeholder="SEARCH CURRENT INVESTIGATION"
              className={fieldClass}
              autoFocus
            />
            <p className="mt-3 font-mono text-[9px] font-black uppercase opacity-60">
              Source // {investigation.displayName}
            </p>
            <div className="mt-3 grid max-h-[55vh] gap-2 overflow-y-auto pr-1">
              {caseEntries
                .filter((entry) =>
                  `${entry.label} ${entry.type} ${entry.description}`
                    .toLowerCase()
                    .includes(caseQuery.toLowerCase()),
                )
                .map((entry) => {
                  const added = current.nodes.some((node) =>
                    [
                      node.sourceEntityId,
                      node.sourceLocationId,
                      node.sourceEventId,
                      node.sourceFactId,
                    ].includes(entry.sourceId),
                  );
                  return (
                    <article
                      key={`${entry.sourceKind}:${entry.sourceId}`}
                      className="flex items-center gap-3 border-2 border-[var(--ink)] bg-[var(--panel)] p-3 font-mono"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black uppercase">
                          {entry.label}
                        </p>
                        <p className="text-[9px] font-bold uppercase opacity-60">
                          {entry.type} //{" "}
                          {entry.sourceVerificationStatus ?? "verified"} //{" "}
                          {entry.sourceKind}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addCaseNode(entry)}
                        className={`${buttonClass} shrink-0`}
                      >
                        {added ? "Added" : "Add"}
                      </button>
                    </article>
                  );
                })}
            </div>
          </div>
        </Modal>
      ) : null}

      {editor?.kind === "path" ? (
        <Modal title="Find Connection" onClose={() => setEditor(null)}>
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const relationshipType = String(
                data.get("relationshipType") || "ALL",
              );
              const result = findWorkspacePath(
                current,
                String(data.get("from")),
                String(data.get("to")),
                Number(data.get("maxHops") || 4),
                relationshipType === "ALL" ? undefined : [relationshipType],
              );
              setPathResult(result);
              setPathNodeIds(result.nodeIds);
              setPathEdgeIds(result.edgeIds);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] font-black uppercase">
                From
                <select
                  name="from"
                  defaultValue={selectedNodeIds[0] ?? current.nodes[0]?.id}
                  className={`${fieldClass} mt-1`}
                >
                  {current.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-black uppercase">
                To
                <select
                  name="to"
                  defaultValue={
                    selectedNodeIds[1] ??
                    current.nodes[1]?.id ??
                    current.nodes[0]?.id
                  }
                  className={`${fieldClass} mt-1`}
                >
                  {current.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] font-black uppercase">
                Max hops
                <select
                  name="maxHops"
                  defaultValue="4"
                  className={`${fieldClass} mt-1`}
                >
                  {[1, 2, 3, 4, 5, 6].map((hops) => (
                    <option key={hops} value={hops}>
                      {hops}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] font-black uppercase">
                Relationship types
                <select
                  name="relationshipType"
                  defaultValue="ALL"
                  className={`${fieldClass} mt-1`}
                >
                  <option>ALL</option>
                  {relationshipTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={current.nodes.length < 2}
              className={`${buttonClass} !bg-[var(--accent)]`}
            >
              <Route size={14} className="inline" /> Find path
            </button>
            {pathResult ? (
              <section
                className={`border-4 p-4 ${pathResult.found ? "border-[var(--danger)]" : "border-[var(--ink)]"}`}
                aria-live="polite"
              >
                <p className="font-serif text-xl font-black uppercase">
                  {pathResult.found
                    ? "Connection found"
                    : "No documented connection found"}
                </p>
                {pathResult.found ? (
                  <>
                    <div className="mt-3 grid gap-1">
                      {pathResult.nodeIds.map((nodeId, index) => (
                        <div key={nodeId}>
                          <p className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2 text-[10px] font-black uppercase">
                            {
                              current.nodes.find((node) => node.id === nodeId)
                                ?.label
                            }
                          </p>
                          {pathResult.edgeIds[index] ? (
                            <p className="py-1 text-center text-[9px] font-black text-[var(--danger)]">
                              ↓{" "}
                              {
                                current.edges.find(
                                  (edge) =>
                                    edge.id === pathResult.edgeIds[index],
                                )?.label
                              }
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] font-black uppercase">
                      {pathResult.hops} hops // workspace relationships only
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[10px] font-bold uppercase">
                    CrimeLens did not add or infer any missing link.
                  </p>
                )}
              </section>
            ) : null}
            {pathResult ? (
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  setPathResult(null);
                  setPathNodeIds([]);
                  setPathEdgeIds([]);
                }}
              >
                Clear path highlight
              </button>
            ) : null}
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "questions" ? (
        <Modal title="Investigation Questions" onClose={() => setEditor(null)}>
          <div className="grid gap-3 p-4">
            <button
              type="button"
              className={`${buttonClass} !bg-[var(--accent)]`}
              onClick={() => setEditor({ kind: "question" })}
            >
              + Question
            </button>
            {current.questions.length ? (
              current.questions.map((question, index) => (
                <article
                  key={question.id}
                  className="border-2 border-[var(--ink)] p-3 font-mono uppercase"
                >
                  <p className="text-[8px] opacity-60">
                    Open question // Q-{String(index + 1).padStart(2, "0")}
                  </p>
                  <h4 className="mt-1 font-serif text-lg font-black">
                    {question.questionText}
                  </h4>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-[9px] font-black">
                    <dt>Status</dt>
                    <dd>{question.status.replaceAll("_", " ")}</dd>
                    <dt>Linked items</dt>
                    <dd>{question.links.length}</dd>
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => setEditor({ kind: "question", question })}
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      disabled={!selectedNodeIds.length && !selectedEdgeId}
                      className={buttonClass}
                      onClick={() => linkSelectedNodesToQuestion(question)}
                    >
                      Link selected
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="border-2 border-dashed border-[var(--ink)] p-4 font-mono text-[10px] font-black uppercase">
                No open investigation questions.
              </p>
            )}
          </div>
        </Modal>
      ) : null}

      {editor?.kind === "question" ? (
        <Modal
          title={
            editor.question
              ? "Question Inspector"
              : "Create Investigation Question"
          }
          onClose={() => setEditor({ kind: "questions" })}
        >
          <form
            className="grid gap-4 p-4"
            onSubmit={(event) => saveQuestion(event, editor.question)}
          >
            <label className="text-[10px] font-black uppercase">
              Question
              <textarea
                required
                name="questionText"
                defaultValue={editor.question?.questionText}
                rows={3}
                className={`${fieldClass} mt-1 resize-y`}
                autoFocus
              />
            </label>
            {editor.question ? (
              <label className="text-[10px] font-black uppercase">
                Status
                <select
                  name="status"
                  defaultValue={editor.question.status}
                  className={`${fieldClass} mt-1`}
                >
                  {[
                    "OPEN",
                    "UNDER_REVIEW",
                    "PARTIALLY_ANSWERED",
                    "RESOLVED",
                    "CLOSED",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="text-[10px] font-black uppercase">
              Notes
              <textarea
                name="notes"
                defaultValue={editor.question?.notes}
                rows={4}
                className={`${fieldClass} mt-1 resize-y`}
              />
            </label>
            {editor.question ? (
              <div className="border-2 border-[var(--ink)] p-3 font-mono text-[9px] font-black uppercase">
                <p>
                  Supporting //{" "}
                  {
                    editor.question.links.filter(
                      (link) => link.relationship === "SUPPORTS",
                    ).length
                  }
                </p>
                <p>
                  Conflicting //{" "}
                  {
                    editor.question.links.filter(
                      (link) => link.relationship === "CONTRADICTS",
                    ).length
                  }
                </p>
                <p>
                  Related //{" "}
                  {
                    editor.question.links.filter(
                      (link) => link.relationship === "RELATED",
                    ).length
                  }
                </p>
              </div>
            ) : null}
            <button
              type="submit"
              className={`${buttonClass} !bg-[var(--ink)] !text-[var(--paper)]`}
            >
              {editor.question ? "Save question" : "Create question"}
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "snapshots" ? (
        <Modal title="Workspace History" onClose={() => setEditor(null)}>
          <div className="grid gap-3 p-4">
            <button
              type="button"
              className={`${buttonClass} !bg-[var(--accent)]`}
              onClick={() => setEditor({ kind: "snapshot" })}
            >
              Create snapshot
            </button>
            {current.snapshots.length ? (
              [...current.snapshots].reverse().map((item, index) => {
                const difference = snapshotDifference(current, item);
                const comparing = snapshotCompareId === item.id;
                return (
                  <article
                    key={item.id}
                    className="border-2 border-[var(--ink)] p-3 font-mono uppercase"
                  >
                    <p className="text-[8px] opacity-60">
                      {String(current.snapshots.length - index).padStart(
                        2,
                        "0",
                      )}{" "}
                      // {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                    <h4 className="mt-1 font-serif text-lg font-black">
                      {item.name}
                    </h4>
                    {item.description ? (
                      <p className="mt-1 text-[9px] normal-case">
                        {item.description}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() =>
                          setSnapshotCompareId(comparing ? null : item.id)
                        }
                      >
                        Compare
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => restoreSnapshot(item)}
                      >
                        Restore snapshot
                      </button>
                    </div>
                    {comparing ? (
                      <div className="mt-3 border-2 border-[var(--danger)] p-3 text-[9px]">
                        <p>Snapshot difference</p>
                        <p className="mt-2">
                          + {difference.addedNodes} nodes // -{" "}
                          {difference.removedNodes} nodes
                        </p>
                        <p>
                          + {difference.addedEdges} relationships // -{" "}
                          {difference.removedEdges} relationships
                        </p>
                        <p>~ {difference.changedEdges} relationships updated</p>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <p className="border-2 border-dashed border-[var(--ink)] p-4 font-mono text-[10px] font-black uppercase">
                No analyst-controlled snapshots yet.
              </p>
            )}
          </div>
        </Modal>
      ) : null}

      {editor?.kind === "snapshot" ? (
        <Modal
          title="Create Workspace Snapshot"
          onClose={() => setEditor({ kind: "snapshots" })}
        >
          <form className="grid gap-4 p-4" onSubmit={saveSnapshot}>
            <label className="text-[10px] font-black uppercase">
              Snapshot name
              <input
                required
                name="name"
                placeholder="BEFORE CALL RECORD REVIEW"
                className={`${fieldClass} mt-1`}
                autoFocus
              />
            </label>
            <label className="text-[10px] font-black uppercase">
              Note
              <textarea
                name="description"
                placeholder="Initial network structure"
                rows={3}
                className={`${fieldClass} mt-1 resize-y`}
              />
            </label>
            <p className="font-mono text-[9px] font-black uppercase">
              Captures workspace reasoning and references. Authoritative case
              records are not duplicated.
            </p>
            <button
              type="submit"
              className={`${buttonClass} !bg-[var(--accent)]`}
            >
              Save snapshot
            </button>
          </form>
        </Modal>
      ) : null}

      {editor?.kind === "analysis" ? (
        <Modal title="Connection Analysis" onClose={() => setEditor(null)}>
          <div className="grid gap-3 p-4 font-mono uppercase">
            <div className="border-2 border-[var(--ink)] bg-[var(--ink)] p-3 text-[var(--paper)]">
              <p>
                {analysisStatus === "analyzing"
                  ? "Analyzing workspace…"
                  : `${current.suggestions.filter((suggestion) => suggestion.status === "PENDING").length} connection suggestions`}
              </p>
              <p className="mt-1 text-[9px]">
                {current.nodes.length} entities // {current.edges.length}{" "}
                relationships //{" "}
                {
                  uniqueIds(current.nodes.map((node) => node.sourceFactId))
                    .length
                }{" "}
                direct evidence references
              </p>
            </div>
            {analysisStatus === "unavailable" ? (
              <div className="border-2 border-[var(--danger)] p-3">
                <p className="font-black text-[var(--danger)]">
                  AI analysis unavailable
                </p>
                <p className="mt-2 text-[9px] font-bold normal-case">
                  Core workspace remains fully functional. Transparent
                  deterministic signals were analyzed; no external model was
                  called.
                </p>
              </div>
            ) : null}
            <p className="text-[9px] font-black">
              Suggestions never edit the graph automatically.
            </p>
            {current.suggestions.length ? (
              current.suggestions.map((suggestion) => (
                <article
                  key={suggestion.id}
                  className="border-2 border-dashed border-[var(--ink)] p-3"
                >
                  <p>
                    Suggestion // {suggestion.signalStrength} signal //{" "}
                    {suggestion.status}
                  </p>
                  <p className="mt-2 text-[9px] normal-case">
                    {suggestion.explanation}
                  </p>
                  <p className="mt-2 text-[8px]">
                    {suggestion.reasonCodes.join(" // ")}
                  </p>
                  {suggestion.status === "PENDING" ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => reviewSuggestion(suggestion, "REJECTED")}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className={`${buttonClass} !bg-[var(--accent)]`}
                        onClick={() =>
                          reviewSuggestion(suggestion, "ACCEPTED_AS_HYPOTHESIS")
                        }
                      >
                        Add as hypothesis
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="border-2 border-dashed border-[var(--ink)] p-3 text-[9px] font-black">
                No shared deterministic signals were found between currently
                disconnected nodes.
              </p>
            )}
            {current.conflicts.length ? (
              <div className="border-t-4 border-[var(--ink)] pt-3">
                <p className="font-black text-[var(--danger)]">
                  {
                    current.conflicts.filter(
                      (conflict) => conflict.status === "OPEN",
                    ).length
                  }{" "}
                  potential conflicts // requires review
                </p>
                {current.conflicts.map((conflict) => (
                  <p
                    key={conflict.id}
                    className="mt-2 border-2 border-[var(--danger)] p-2 text-[9px] normal-case"
                  >
                    {conflict.explanation}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function CustomNetworkWorkspace({
  investigationId,
}: {
  investigationId: InvestigationId;
}) {
  return (
    <ReactFlowProvider>
      <CustomNetworkWorkspaceInner
        key={investigationId}
        investigationId={investigationId}
      />
    </ReactFlowProvider>
  );
}
