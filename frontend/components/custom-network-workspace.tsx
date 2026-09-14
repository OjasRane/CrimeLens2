"use client";
import { useAccountId } from "@/components/authenticated-workspace";
import { networkStorageKey } from "@/lib/public-access";
import { duplicateGraphWorkspace } from "@/lib/network-workspace-persistence";

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
  ChevronDown,
  CircleUserRound,
  Copy,
  Ellipsis,
  FileText,
  Focus,
  GitBranchPlus,
  History,
  LayoutTemplate,
  ListChecks,
  MapPin,
  Network,
  NotebookPen,
  PanelRight,
  Pencil,
  Pin,
  PinOff,
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
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type ReactNode,
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
  | { kind: "conflicts" }
  | null;

type InspectorTab = "details" | "basis" | "connections" | "conflicts" | "ai";

const iconByType: Record<
  WorkspaceNodeType,
  ComponentType<{ className?: string; size?: number; strokeWidth?: number }>
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
  "fatal-raised-control min-h-10 px-3 py-2 font-mono text-[10px] font-black uppercase";
const toolbarButtonClass =
  "fatal-raised-control flex min-h-9 shrink-0 items-center justify-center gap-1.5 px-2.5 font-mono text-[9px] font-black uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]";

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
      className={`fatal-workspace-node w-44 border-4 bg-[var(--panel)] p-3 font-mono uppercase text-[var(--ink)] shadow-[5px_5px_0_var(--ink)] transition-opacity ${
        isHypothesis ? "border-dashed" : "border-solid"
      } ${selected || data.selectedByAnalyst ? "!border-[var(--danger)] shadow-[5px_5px_0_var(--danger)]" : "border-[var(--ink)]"} ${
        data.dimmed ? "opacity-25" : "opacity-100"
      } ${data.searchMatch ? "outline-4 outline-offset-4 outline-[var(--accent)]" : ""}`}
      data-node-type={data.type}
      data-selected={selected || data.selectedByAnalyst}
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
          <Icon
            className="fatal-workspace-node-icon"
            size={15}
            strokeWidth={3}
          />
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
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);

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

function WorkspaceSidePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    return () => {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
    };
  }, []);

  return (
    <aside
      role="dialog"
      aria-label={title}
      className="absolute inset-0 z-[70] flex min-h-0 flex-col border-0 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] shadow-none sm:bottom-3 sm:left-auto sm:right-3 sm:top-[calc(var(--network-toolbar-height)+0.75rem)] sm:w-[min(390px,calc(100%-1.5rem))] sm:border-2 sm:shadow-[5px_5px_0_var(--ink)]"
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b-2 border-[var(--ink)] bg-[var(--ink)] px-3 text-[var(--paper)]">
        <h3 className="font-serif text-lg font-black">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="grid h-9 w-9 place-items-center border-2 border-current"
        >
          <X size={17} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
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
      <div className="pointer-events-auto max-w-md border-2 border-[var(--ink)] bg-[var(--paper)] p-5 text-left font-mono text-[var(--ink)] shadow-[3px_3px_0_var(--ink)]">
        <Network className="mb-3" size={26} strokeWidth={2.5} />
        <p className="font-serif text-xl font-black">
          Start your investigation workspace
        </p>
        <p className="mt-2 text-[11px] font-bold leading-relaxed opacity-65">
          Add existing case evidence or create your first entity.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCase}
            className={`${buttonClass} !bg-[var(--accent)]`}
          >
            Add from case
          </button>
          <button type="button" onClick={onNode} className={buttonClass}>
            Create entity
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomNetworkWorkspaceInner({
  investigationId,
  toolbarLeading,
  focusControl,
  isFocusMode,
  focusToolsExpanded,
  focusToolsControl,
}: {
  investigationId: InvestigationId;
  toolbarLeading: ReactNode;
  focusControl: ReactNode;
  isFocusMode: boolean;
  focusToolsExpanded: boolean;
  focusToolsControl: ReactNode;
}) {
  const accountId = useAccountId();
  const savedFingerprints = useRef(new Map<string, string>());
  const savedVersions = useRef(new Map<string, number>());
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const [saveAttempt, setSaveAttempt] = useState(0);
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
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "local" | "error">(
    "saved",
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryPinned, setLibraryPinned] = useState(() =>
    typeof window === "undefined"
      ? false
      : localStorage.getItem("crimelens-network-library-pinned") === "true",
  );
  const [libraryQuery, setLibraryQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<
    "workspace" | "add" | "panels" | "more" | null
  >(null);
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
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [toolbarHeight, setToolbarHeight] = useState(48);
  const workspaceMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const panelsMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const moreMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const previousOpenMenu = useRef<typeof openMenu>(null);
  const previousLibraryOpen = useRef(libraryOpen);
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
    if (!toolbarElement) return;
    const updateHeight = () => setToolbarHeight(toolbarElement.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(toolbarElement);
    return () => observer.disconnect();
  }, [toolbarElement]);

  useEffect(() => {
    localStorage.setItem(
      "crimelens-network-library-pinned",
      String(libraryPinned),
    );
    if (libraryPinned) setLibraryOpen(true);
  }, [libraryPinned]);

  useEffect(() => {
    const previous = previousOpenMenu.current;
    previousOpenMenu.current = openMenu;
    if (!previous || openMenu || editor) return;
    const trigger =
      previous === "workspace"
        ? workspaceMenuTriggerRef.current
        : previous === "panels"
          ? panelsMenuTriggerRef.current
          : previous === "more"
            ? moreMenuTriggerRef.current
            : null;
    requestAnimationFrame(() => trigger?.focus());
  }, [editor, openMenu]);

  useEffect(() => {
    const wasOpen = previousLibraryOpen.current;
    previousLibraryOpen.current = libraryOpen;
    if (!wasOpen || libraryOpen || editor) return;
    requestAnimationFrame(() => addTriggerRef.current?.focus());
  }, [editor, libraryOpen]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setWorkspaces([]);
    // Authenticate and load the server first. Never import unclaimed legacy storage.
    void getGraphWorkspaces(investigationId)
      .then(summaries => Promise.all(summaries.map(item => getGraphWorkspace(item.id))))
      .then(remote => {
        if (cancelled) return;
        const items = remote.length ? remote.map(workspace => normalizeWorkspace(workspace, investigation)) : [createBlankWorkspace(investigationId)];
        for (const item of items) {
          if (remote.some(record => record.id === item.id)) savedFingerprints.current.set(item.id, JSON.stringify(item));
          savedVersions.current.set(item.id, item.version);
        }
        setWorkspaces(items);
        const savedId = localStorage.getItem(`${networkStorageKey(accountId, investigationId)}:active`);
        setActiveId(items.some(item => item.id === savedId) ? savedId! : items[0].id);
        setHydrated(true);
      }).catch(() => { if (!cancelled) setSaveStatus("error"); });
    return () => { cancelled = true; };
  }, [accountId, investigation, investigationId]);

  useEffect(() => {
    if (!hydrated || !workspaces.length) return;
    const storageKey = networkStorageKey(accountId, investigationId);
    if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus(isSupabaseBrowserConfigured ? "saving" : "local");
    persistenceTimer.current = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(workspaces));
      localStorage.setItem(`${storageKey}:active`, activeId);
    }, 250);
    let cancelled = false;
    saveTimer.current = setTimeout(() => {
      saveQueue.current = saveQueue.current.then(async () => {
        if (cancelled) return;
        try {
          for (const workspace of workspaces) {
            const fingerprint = JSON.stringify(workspace);
            if (savedFingerprints.current.get(workspace.id) === fingerprint) continue;
            const saved = await saveGraphWorkspace(workspace.id, {
              ...workspace,
              version: Math.max(workspace.version, savedVersions.current.get(workspace.id) ?? 1),
            }, undefined, accountId);
            savedFingerprints.current.set(workspace.id, fingerprint);
            savedVersions.current.set(workspace.id, saved.version);
          }
          if (!cancelled) setSaveStatus("saved");
        } catch { if (!cancelled) setSaveStatus("error"); }
      });
    }, 650);
    return () => {
      cancelled = true;
      if (persistenceTimer.current) clearTimeout(persistenceTimer.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [accountId, activeId, current, hydrated, investigationId, workspaces, saveAttempt]);

  useEffect(() => {
    const storageKey = networkStorageKey(accountId, investigationId);
    return () => {
      if (!latestHydrated.current || !latestWorkspaces.current.length) return;
      localStorage.setItem(
        storageKey,
        JSON.stringify(latestWorkspaces.current),
      );
      localStorage.setItem(`${storageKey}:active`, latestActiveId.current);
    };
  }, [accountId, investigationId]);

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
      const target = event.target;
      if (
        target instanceof Element &&
        target.matches("input, textarea, select, [contenteditable='true']")
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
      } else if (event.key === "Escape") {
        if (openMenu) {
          setOpenMenu(null);
          return;
        }
        if (libraryOpen && !libraryPinned) {
          setLibraryOpen(false);
          return;
        }
        if (editor) {
          setEditor(null);
          return;
        }
        setSelectedNodeIds([]);
        setSelectedEdgeId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection, editor, libraryOpen, libraryPinned, openMenu, redo, undo]);

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

  function selectWorkspace(workspaceId: string, closeMenu = false) {
    const next = workspaces.find((workspace) => workspace.id === workspaceId);
    setActiveId(workspaceId);
    setVerificationFilter(
      next?.filters?.verification ?? ["verified", "manual", "hypothesis"],
    );
    setPast([]);
    setFuture([]);
    if (closeMenu) setOpenMenu(null);
  }

  function duplicateWorkspace() {
    const copy = duplicateGraphWorkspace(current);
    setWorkspaces((items) => [...items, copy]);
    setActiveId(copy.id);
    setOpenMenu(null);
  }

  async function deleteWorkspace() {
    if (
      !confirm(
        `DELETE WORKSPACE?\n\n${current.name}\n\nThis does not modify case data.`,
      )
    )
      return;
    try { await deleteGraphWorkspace(current.id); }
    catch { setSaveStatus("error"); return; }
    setWorkspaces((items) =>
      items.filter((item) => item.id !== current.id),
    );
    setActiveId(
      workspaces.find((item) => item.id !== current.id)?.id ?? "",
    );
    setOpenMenu(null);

  }

  function connectNodes() {
    if (current.nodes.length < 2) {
      alert("Create or import at least two nodes before connecting them.");
      return;
    }
    const source = selectedNodeIds[0] ?? current.nodes[0].id;
    const target =
      selectedNodeIds.find((nodeId) => nodeId !== source) ??
      current.nodes.find((node) => node.id !== source)!.id;
    setEditor({ kind: "edge", source, target });
  }

  function groupNodes() {
    if (selectedNodeIds.length < 2) {
      alert("Select two or more nodes to create a group.");
      return;
    }
    setEditor({ kind: "group" });
  }

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
        {saveStatus === "error" ? "Workspace access failed. Reload to retry; no private data has been loaded." : "Loading custom workspace…"}
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
  const isPrimaryPanelOpen =
    editor?.kind === "analysis" ||
    editor?.kind === "conflicts" ||
    editor?.kind === "questions" ||
    editor?.kind === "snapshots";
  const visibleLibraryTypes = workspaceNodeTypes.filter((type) =>
    type.replaceAll("_", " ").includes(libraryQuery.trim().toLowerCase()),
  );
  const nodeLibraryContent = (
    <>
      <div className="flex min-h-11 items-center gap-2 border-b-2 border-[var(--ink)] px-2">
        <span className="min-w-0 flex-1 font-mono text-[10px] font-black uppercase">
          Node library
        </span>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center border border-[var(--ink)]"
          onClick={() => setLibraryPinned((pinned) => !pinned)}
          aria-pressed={libraryPinned}
          aria-label={libraryPinned ? "Unpin node library" : "Pin node library"}
          title={libraryPinned ? "Unpin library" : "Pin library open"}
        >
          {libraryPinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center border border-[var(--ink)]"
          onClick={() => setLibraryOpen(false)}
          aria-label="Close node library"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <label className="relative block">
          <Search
            aria-hidden="true"
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            size={14}
          />
          <span className="sr-only">Search node types</span>
          <input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search node types"
            className={`${fieldClass} !min-h-9 pl-8 !text-[10px]`}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEditor({ kind: "case" });
            if (!libraryPinned) setLibraryOpen(false);
          }}
          className={`${buttonClass} mt-2 w-full !bg-[var(--accent)]`}
        >
          Add from case
        </button>
        <div className="mt-2 grid gap-1.5">
          {visibleLibraryTypes.map((type) => {
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
                onDragEnd={() => {
                  if (!libraryPinned) setLibraryOpen(false);
                }}
                onClick={() => {
                  createNode(type);
                  if (!libraryPinned) setLibraryOpen(false);
                }}
                className="flex min-h-10 w-full items-center gap-2 border border-[var(--ink)] bg-[var(--panel)] px-2 text-left font-mono text-[9px] font-black uppercase hover:border-2"
              >
                <Icon size={15} strokeWidth={2.5} />
                {type.replaceAll("_", " ")}
              </button>
            );
          })}
          {!visibleLibraryTypes.length ? (
            <p className="border border-dashed border-[var(--ink)] p-3 font-mono text-[9px] font-bold">
              No matching node types.
            </p>
          ) : null}
        </div>
        {current.groups.length ? (
          <div className="mt-4 border-t-2 border-[var(--ink)] pt-3">
            <p className="mb-2 font-mono text-[9px] font-black uppercase">
              Groups
            </p>
            {current.groups.map((group) => (
              <div
                key={group.id}
                className="mb-1.5 flex items-center gap-1 border border-dashed border-[var(--ink)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[8px] font-black uppercase"
              >
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
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
    </>
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-[var(--paper)] text-[var(--ink)]"
      style={
        { "--network-toolbar-height": `${toolbarHeight}px` } as CSSProperties
      }
    >
      <div
        ref={setToolbarElement}
        className="relative z-50 shrink-0 border-b-2 border-[var(--ink)] bg-[var(--paper)] font-mono dark:border-[var(--line)]"
      >
        {isFocusMode ? (
          <>
            <div className="hide-scrollbar flex min-h-12 flex-wrap items-center gap-2 overflow-visible px-2 py-1.5 sm:flex-nowrap sm:overflow-x-auto">
              <div className="hidden shrink-0 sm:block">{toolbarLeading}</div>
              <div className="w-full min-w-0 flex-1 sm:w-auto sm:min-w-32">
                <p className="truncate text-[9px] font-black uppercase">
                  {investigation.displayName}
                </p>
                <p className="truncate text-[8px] font-bold uppercase opacity-55">
                  Workspace // {current.name}
                </p>
              </div>
              <div className="flex w-full min-w-0 gap-2 sm:w-auto sm:shrink-0">
                <div className="min-w-0 flex-1 [&>button]:w-full sm:flex-none sm:[&>button]:w-auto">
                  {focusToolsControl}
                </div>
                <div className="min-w-0 flex-1 [&>button]:w-full sm:flex-none sm:[&>button]:w-auto">
                  {focusControl}
                </div>
              </div>
            </div>

            {focusToolsExpanded ? (
              <div
                id="network-focus-toolkit"
                className="hide-scrollbar grid grid-flow-col auto-cols-[minmax(270px,85vw)] gap-2 overflow-x-auto border-t-2 border-[var(--ink)] bg-[var(--panel)] p-2 dark:border-[var(--line)] md:grid-flow-row md:auto-cols-auto md:grid-cols-2 xl:grid-cols-4"
              >
                <fieldset className="min-w-0 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[2px_2px_0_var(--ink)] dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)]">
                  <legend className="px-1 text-[8px] font-black uppercase opacity-65">
                    Workspace
                  </legend>
                  <label className="block">
                    <span className="sr-only">Existing workspace</span>
                    <select
                      value={current.id}
                      onChange={(event) => selectWorkspace(event.target.value)}
                      className={`${fieldClass} !min-h-9 py-1 !text-[9px]`}
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "workspace" })}>
                      <Plus aria-hidden="true" size={13} /> New
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "workspace", workspace: current })}>
                      <Pencil aria-hidden="true" size={13} /> Rename
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={duplicateWorkspace}>
                      <Copy aria-hidden="true" size={13} /> Duplicate
                    </button>
                    <button type="button" className={toolbarButtonClass} disabled={workspaces.length === 1} onClick={deleteWorkspace}>
                      <Trash2 aria-hidden="true" size={13} /> Delete
                    </button>
                  </div>
                  <p className="mt-2 text-[8px] font-black uppercase opacity-60" aria-live="polite">
                    ● {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved — retry" : saveStatus === "local" ? "Saved locally" : "Saved"}
                    {saveStatus === "error" && <button type="button" className="ml-2 underline" onClick={() => setSaveAttempt(n => n + 1)}>Retry save</button>}
                  </p>
                </fieldset>

                <fieldset className="min-w-0 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[2px_2px_0_var(--ink)] dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)]">
                  <legend className="px-1 text-[8px] font-black uppercase opacity-65">Build</legend>
                  <div className="flex flex-wrap gap-2">
                    <button ref={addTriggerRef} type="button" className={toolbarButtonClass} onClick={() => { setLibraryOpen((open) => !open); setOpenMenu(null); }} aria-expanded={libraryOpen} aria-controls="network-node-library">
                      <Network aria-hidden="true" size={13} /> Library
                    </button>
                    <button type="button" className={`${toolbarButtonClass} fatal-raised-control--primary`} onClick={() => createNode("person")}>
                      <Plus aria-hidden="true" size={13} /> Node
                    </button>
                    <button type="button" className={toolbarButtonClass} disabled={current.nodes.length < 2} onClick={connectNodes}>
                      <GitBranchPlus aria-hidden="true" size={13} /> Connect
                    </button>
                    <button type="button" className={toolbarButtonClass} disabled={selectedNodeIds.length < 2} onClick={groupNodes}>
                      <LayoutTemplate aria-hidden="true" size={13} /> Group
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => createNode("note")}>
                      <NotebookPen aria-hidden="true" size={13} /> Note
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "case" })}>
                      <BookOpenText aria-hidden="true" size={13} /> Add from case
                    </button>
                  </div>
                </fieldset>

                <fieldset className="min-w-0 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[2px_2px_0_var(--ink)] dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)]">
                  <legend className="px-1 text-[8px] font-black uppercase opacity-65">Investigate</legend>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={`${toolbarButtonClass} fatal-raised-control--primary`} onClick={() => void runAnalysis()}>
                      <BrainCircuit aria-hidden="true" size={13} /> Analyze connections
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "path" })}>
                      <Route aria-hidden="true" size={13} /> Find path
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "questions" })}>
                      <ListChecks aria-hidden="true" size={13} /> Questions
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => setEditor({ kind: "snapshots" })}>
                      <History aria-hidden="true" size={13} /> History
                    </button>
                  </div>
                </fieldset>

                <fieldset className="min-w-0 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[2px_2px_0_var(--ink)] dark:border-[var(--line)] dark:shadow-[2px_2px_0_var(--ink)]">
                  <legend className="px-1 text-[8px] font-black uppercase opacity-65">Arrange</legend>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={toolbarButtonClass} onClick={autoLayout}>
                      <LayoutTemplate aria-hidden="true" size={13} /> Auto layout
                    </button>
                    <button type="button" className={toolbarButtonClass} disabled={!past.length} onClick={undo} title="Undo (Ctrl/Command+Z)">
                      <Undo2 aria-hidden="true" size={13} /> Undo
                    </button>
                    <button type="button" className={toolbarButtonClass} disabled={!future.length} onClick={redo} title="Redo (Ctrl/Command+Shift+Z)">
                      <Redo2 aria-hidden="true" size={13} /> Redo
                    </button>
                    <button type="button" className={toolbarButtonClass} onClick={() => void flowRef.current?.fitView({ padding: 0.18, duration: 300 })}>
                      <Focus aria-hidden="true" size={13} /> Fit
                    </button>
                  </div>
                </fieldset>
              </div>
            ) : null}
          </>
        ) : (
          <div className="hide-scrollbar flex min-h-14 items-center gap-2 overflow-x-auto px-2 py-2">
            {toolbarLeading}
            {focusControl}
            <label className="hidden min-w-0 shrink-0 items-center lg:flex">
              <span className="sr-only">Workspace</span>
              <select value={current.id} onChange={(event) => selectWorkspace(event.target.value)} className={`${fieldClass} !min-h-9 !w-40 py-1 !text-[9px]`}>
                {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
              </select>
            </label>
            <button ref={workspaceMenuTriggerRef} className={toolbarButtonClass} type="button" onClick={() => setOpenMenu((menu) => menu === "workspace" ? null : "workspace")} aria-expanded={openMenu === "workspace"} aria-controls="workspace-management-menu">
              <Ellipsis aria-hidden="true" size={14} /> Workspace
            </button>
            <span className="shrink-0 text-[8px] font-black uppercase opacity-55" aria-live="polite">
              ● {saveStatus === "saving" ? "Saving…" : saveStatus === "error" ? "Not saved — retry" : saveStatus === "local" ? "Saved locally" : "Saved"}
                    {saveStatus === "error" && <button type="button" className="ml-2 underline" onClick={() => setSaveAttempt(n => n + 1)}>Retry save</button>}
            </span>
            <button ref={addTriggerRef} className={toolbarButtonClass} type="button" onClick={() => { setLibraryOpen((open) => !open); setOpenMenu(null); }} aria-expanded={libraryOpen} aria-controls="network-node-library">
              <Network aria-hidden="true" size={13} /> Library
            </button>
            <button className={`${toolbarButtonClass} fatal-raised-control--primary`} type="button" onClick={() => createNode("person")}>
              <Plus aria-hidden="true" size={13} /> Node
            </button>
            <button className={toolbarButtonClass} type="button" disabled={current.nodes.length < 2} onClick={connectNodes}>
              <GitBranchPlus aria-hidden="true" size={13} /> Connect
            </button>
            <button className={toolbarButtonClass} type="button" disabled={selectedNodeIds.length < 2} onClick={groupNodes}>
              <LayoutTemplate aria-hidden="true" size={13} /> Group
            </button>
            <button className={toolbarButtonClass} type="button" onClick={() => createNode("note")}>
              <NotebookPen aria-hidden="true" size={13} /> Note
            </button>
            <button className={toolbarButtonClass} type="button" onClick={() => setEditor({ kind: "case" })}>
              <BookOpenText aria-hidden="true" size={13} /> Add from case
            </button>
            <button className={`${toolbarButtonClass} fatal-raised-control--primary`} type="button" onClick={() => void runAnalysis()}>
              <BrainCircuit aria-hidden="true" size={13} /> Analyze connections
            </button>
            <button ref={panelsMenuTriggerRef} className={toolbarButtonClass} type="button" onClick={() => setOpenMenu((menu) => menu === "panels" ? null : "panels")} aria-expanded={openMenu === "panels"} aria-controls="workspace-panels-menu">
              <PanelRight aria-hidden="true" size={13} /> Panels
            </button>
            <button ref={moreMenuTriggerRef} className={toolbarButtonClass} type="button" onClick={() => setOpenMenu((menu) => menu === "more" ? null : "more")} aria-expanded={openMenu === "more"} aria-controls="workspace-more-menu">
              <ChevronDown aria-hidden="true" size={13} /> More
            </button>
          </div>
        )}
      </div>

      {openMenu === "workspace" ? (
        <div
          id="workspace-management-menu"
          data-network-popover="true"
          className="absolute left-2 top-[calc(var(--network-toolbar-height)+0.25rem)] z-[80] w-[min(290px,calc(100%-1rem))] border-2 border-[var(--ink)] bg-[var(--paper)] p-2 font-mono text-[9px] font-black uppercase shadow-[4px_4px_0_var(--ink)] sm:left-48"
        >
          <label className="grid gap-1">
            Current workspace
            <select
              value={current.id}
              onChange={(event) => selectWorkspace(event.target.value, true)}
              className={`${fieldClass} mt-1 !min-h-9 py-1`}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className={buttonClass}
              type="button"
              onClick={() => {
                setEditor({ kind: "workspace" });
                setOpenMenu(null);
              }}
            >
              <Plus size={13} className="inline" /> New
            </button>
            <button
              className={buttonClass}
              type="button"
              onClick={() => {
                setEditor({ kind: "workspace", workspace: current });
                setOpenMenu(null);
              }}
            >
              Rename
            </button>
            <button
              className={buttonClass}
              type="button"
              onClick={duplicateWorkspace}
            >
              Duplicate
            </button>
            <button
              className={`${buttonClass} !bg-[var(--danger)] !text-white`}
              type="button"
              disabled={workspaces.length === 1}
              onClick={deleteWorkspace}
            >
              <Trash2 size={13} className="inline" /> Delete
            </button>
          </div>
        </div>
      ) : null}

      {openMenu === "panels" ? (
        <div
          id="workspace-panels-menu"
          data-network-popover="true"
          className="absolute right-2 top-[calc(var(--network-toolbar-height)+0.25rem)] z-[80] grid w-52 gap-1 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[4px_4px_0_var(--ink)]"
        >
          <button
            type="button"
            disabled={!selectedNode && !selectedEdge}
            className={buttonClass}
            onClick={() => {
              setInspectorOpen(true);
              setEditor(null);
              setOpenMenu(null);
            }}
          >
            Details
          </button>
          <button type="button" className={buttonClass} onClick={() => { setEditor({ kind: "analysis" }); setOpenMenu(null); }}>
            Analysis
          </button>
          <button type="button" className={buttonClass} onClick={() => { setEditor({ kind: "conflicts" }); setOpenMenu(null); }}>
            Conflicts ({current.conflicts.filter((item) => item.status === "OPEN").length})
          </button>
          <button type="button" className={buttonClass} onClick={() => { setEditor({ kind: "questions" }); setOpenMenu(null); }}>
            Questions ({current.questions.filter((item) => !["RESOLVED", "CLOSED"].includes(item.status)).length})
          </button>
          <button type="button" className={buttonClass} onClick={() => { setEditor({ kind: "snapshots" }); setOpenMenu(null); }}>
            History
          </button>
        </div>
      ) : null}

      {openMenu === "more" ? (
        <div
          id="workspace-more-menu"
          data-network-popover="true"
          className="absolute right-2 top-[calc(var(--network-toolbar-height)+0.25rem)] z-[80] grid w-52 grid-cols-2 gap-1 border-2 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[4px_4px_0_var(--ink)]"
        >
          <button type="button" className={buttonClass} onClick={() => { autoLayout(); setOpenMenu(null); }}>
            <LayoutTemplate size={13} className="inline" /> Auto-layout
          </button>
          <button type="button" className={buttonClass} onClick={() => { void flowRef.current?.fitView({ padding: 0.18, duration: 300 }); setOpenMenu(null); }}>
            <Focus size={13} className="inline" /> Fit
          </button>
          <button type="button" className={buttonClass} disabled={!past.length} onClick={() => { undo(); setOpenMenu(null); }} title="Undo (Ctrl/Command+Z)">
            <Undo2 size={13} className="inline" /> Undo
          </button>
          <button type="button" className={buttonClass} disabled={!future.length} onClick={() => { redo(); setOpenMenu(null); }} title="Redo (Ctrl/Command+Shift+Z)">
            <Redo2 size={13} className="inline" /> Redo
          </button>
          <button type="button" className={`${buttonClass} col-span-2`} onClick={() => { setEditor({ kind: "path" }); setOpenMenu(null); }}>
            <Route size={13} className="inline" /> Find connection path
          </button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        {libraryOpen && libraryPinned ? (
          <aside
            id="network-node-library"
            className="z-30 hidden w-56 shrink-0 flex-col overflow-hidden border-r-2 border-[var(--ink)] bg-[var(--paper)] sm:flex"
          >
            {nodeLibraryContent}
          </aside>
        ) : null}

        {libraryOpen && !libraryPinned ? (
          <aside
            id="network-node-library"
            data-network-popover="true"
            className="absolute bottom-3 left-3 top-3 z-[60] flex w-[min(280px,calc(100%-1.5rem))] flex-col overflow-hidden border-2 border-[var(--ink)] bg-[var(--paper)] shadow-[5px_5px_0_var(--ink)]"
          >
            {nodeLibraryContent}
          </aside>
        ) : null}

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
            <label className="relative w-[44%] min-w-0 shrink-0 sm:w-auto sm:flex-1">
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
            <div className="hide-scrollbar flex min-w-0 flex-1 overflow-x-auto border-2 border-[var(--ink)] bg-[var(--panel)] p-1">
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
            {current.nodes.length ? (
              <MiniMap
                pannable
                zoomable
                className="!rounded-none !border !border-[var(--ink)] !bg-[var(--panel)]"
                nodeColor={(node) =>
                  node.type === "workspaceGroup"
                    ? "var(--accent)"
                    : "var(--ink)"
                }
              />
            ) : null}
          </ReactFlow>
        </main>

        {(selectedNode || selectedEdge) && inspectorOpen && !isPrimaryPanelOpen ? (
          <aside className="absolute inset-0 z-40 overflow-y-auto border-0 border-[var(--ink)] bg-[var(--panel)] p-4 font-mono text-[10px] font-black uppercase shadow-none sm:bottom-3 sm:left-auto sm:right-3 sm:top-3 sm:w-[min(340px,calc(100%-1.5rem))] sm:border-2 sm:shadow-[5px_5px_0_var(--ink)]">
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

      {editor?.kind === "conflicts" ? (
        <WorkspaceSidePanel
          title="Potential conflicts"
          onClose={() => setEditor(null)}
        >
          <div className="grid gap-3 p-4 font-mono text-[10px] font-black uppercase">
            {current.conflicts.length ? (
              current.conflicts.map((conflict) => (
                <article
                  key={conflict.id}
                  className="border-2 border-[var(--danger)] p-3"
                >
                  <p className="text-[var(--danger)]">
                    {conflict.conflictType.replaceAll("_", " ")} // {conflict.status}
                  </p>
                  <p className="mt-2 normal-case">{conflict.explanation}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      onClick={() => {
                        const nodeIds = [
                          conflict.resourceAType === "node"
                            ? conflict.resourceAId
                            : null,
                          conflict.resourceBType === "node"
                            ? conflict.resourceBId
                            : null,
                        ].filter((value): value is string => Boolean(value));
                        const edgeId =
                          conflict.resourceAType === "edge"
                            ? conflict.resourceAId
                            : conflict.resourceBType === "edge"
                              ? conflict.resourceBId
                              : null;
                        setSelectedNodeIds(nodeIds);
                        setSelectedEdgeId(edgeId);
                        setInspectorTab("conflicts");
                        setInspectorOpen(true);
                        setEditor(null);
                      }}
                    >
                      Show on graph
                    </button>
                    <button
                      type="button"
                      disabled={conflict.status !== "OPEN"}
                      className={buttonClass}
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
                  </div>
                </article>
              ))
            ) : (
              <p className="border-2 border-dashed border-[var(--ink)] p-4 normal-case">
                No potential conflicts are recorded in this workspace.
              </p>
            )}
          </div>
        </WorkspaceSidePanel>
      ) : null}

      {editor?.kind === "questions" ? (
        <WorkspaceSidePanel
          title="Investigation questions"
          onClose={() => setEditor(null)}
        >
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
        </WorkspaceSidePanel>
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
        <WorkspaceSidePanel
          title="Workspace history"
          onClose={() => setEditor(null)}
        >
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
        </WorkspaceSidePanel>
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
        <WorkspaceSidePanel
          title="Connection analysis"
          onClose={() => setEditor(null)}
        >
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
                  <button
                    type="button"
                    className={`${buttonClass} mt-3 w-full`}
                    onClick={() => {
                      setSelectedNodeIds([
                        suggestion.sourceNodeId,
                        suggestion.targetNodeId,
                      ]);
                      setSelectedEdgeId(null);
                      setEditor(null);
                    }}
                  >
                    Show nodes on graph
                  </button>
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
        </WorkspaceSidePanel>
      ) : null}
    </div>
  );
}

export function CustomNetworkWorkspace({
  investigationId,
  toolbarLeading,
  focusControl,
  isFocusMode,
  focusToolsExpanded,
  focusToolsControl,
}: {
  investigationId: InvestigationId;
  toolbarLeading: ReactNode;
  focusControl: ReactNode;
  isFocusMode: boolean;
  focusToolsExpanded: boolean;
  focusToolsControl: ReactNode;
}) {
  return (
    <ReactFlowProvider>
      <CustomNetworkWorkspaceInner
        key={investigationId}
        investigationId={investigationId}
        toolbarLeading={toolbarLeading}
        focusControl={focusControl}
        isFocusMode={isFocusMode}
        focusToolsExpanded={focusToolsExpanded}
        focusToolsControl={focusToolsControl}
      />
    </ReactFlowProvider>
  );
}
