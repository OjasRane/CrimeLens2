"use client";

import { ClientSideSuspense } from "@liveblocks/react";
import {
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type XYPosition,
} from "@xyflow/react";
import { useCollaborationIdentity } from "@/components/collaboration-context";
import { getInvestigation } from "@/data/investigations/registry";
import { RedStringEdge } from "@/components/flow-edges";
import {
  LiveStickyNoteNode,
  PolaroidNode,
  StickyNoteNode,
} from "@/components/flow-nodes";
import {
  applyEdgeChangesToLiveList,
  applyNodeChangesToLiveList,
  deserializeFlowEdges,
  deserializeFlowNodes,
  serializeFlowEdge,
  serializeFlowNode,
} from "@/lib/evidence-board-storage";
import { triggerHaptic } from "@/lib/haptics";
import { useMutation, useStorage } from "@/lib/liveblocks";
import {
  type EvidenceNodeType,
  useInvestigationStore,
} from "@/store/use-investigation-store";

const dragTransferType = "application/reactflow";

const localNodeTypes = {
  stickyNote: StickyNoteNode,
  polaroid: PolaroidNode,
};

const liveNodeTypes = {
  stickyNote: LiveStickyNoteNode,
  polaroid: PolaroidNode,
};

const edgeTypes = {
  redString: RedStringEdge,
};

type EvidenceItem = {
  label: string;
  nodeType: EvidenceNodeType;
};

const evidenceItems: EvidenceItem[] = [
  { label: "Blank Sticky", nodeType: "stickyNote" },
  { label: "Suspect Polaroid", nodeType: "polaroid" },
];

type TouchEvidenceDrag = {
  pointerId: number;
  nodeType: EvidenceNodeType;
  label: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function EvidenceBox({
  onMobilePlace,
}: {
  onMobilePlace: (
    nodeType: EvidenceNodeType,
    screenPosition?: XYPosition,
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [touchDrag, setTouchDrag] = useState<TouchEvidenceDrag | null>(null);
  const touchDragRef = useRef<TouchEvidenceDrag | null>(null);
  const lastTouchPlacementAtRef = useRef(0);
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const openLedger = useInvestigationStore((state) => state.openLedger);
  const activeInvestigation = getInvestigation(activeInvestigationId);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncDefaultState = () => setIsOpen(!mediaQuery.matches);

    syncDefaultState();
    mediaQuery.addEventListener("change", syncDefaultState);
    return () => mediaQuery.removeEventListener("change", syncDefaultState);
  }, []);

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    nodeType: EvidenceNodeType,
  ) {
    event.dataTransfer.setData(dragTransferType, nodeType);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleTouchDragStart(
    event: ReactPointerEvent<HTMLButtonElement>,
    item: EvidenceItem,
  ) {
    if (event.pointerType === "mouse") return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDrag: TouchEvidenceDrag = {
      pointerId: event.pointerId,
      nodeType: item.nodeType,
      label: item.label,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
    };
    touchDragRef.current = nextDrag;
    setTouchDrag(nextDrag);
  }

  function handleTouchDragMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = touchDragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const nextDrag = {
      ...currentDrag,
      x: event.clientX,
      y: event.clientY,
    };
    touchDragRef.current = nextDrag;
    setTouchDrag(nextDrag);
  }

  function finishTouchDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const currentDrag = touchDragRef.current;
    if (!currentDrag || currentDrag.pointerId !== event.pointerId) return;

    event.preventDefault();
    lastTouchPlacementAtRef.current = Date.now();

    const distance = Math.hypot(
      event.clientX - currentDrag.startX,
      event.clientY - currentDrag.startY,
    );
    onMobilePlace(
      currentDrag.nodeType,
      distance >= 8 ? { x: event.clientX, y: event.clientY } : undefined,
    );
    triggerHaptic("light");
    touchDragRef.current = null;
    setTouchDrag(null);
  }

  function cancelTouchDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (touchDragRef.current?.pointerId !== event.pointerId) return;
    touchDragRef.current = null;
    setTouchDrag(null);
  }

  return (
    <div className="absolute left-2 top-2 z-10 w-[min(12rem,calc(100%-1rem))] border-4 border-[var(--ink)] bg-[var(--panel)] p-2 font-mono shadow-[3px_3px_0_var(--ink)] rounded-none md:left-4 md:top-4 md:p-3 md:shadow-[4px_4px_0_var(--ink)]">
      <button
        type="button"
        onClick={() =>
          setIsOpen((open) => {
            if (!open) triggerHaptic("light");
            return !open;
          })
        }
        aria-expanded={isOpen}
        aria-controls="evidence-box-actions"
        className={`flex min-h-11 w-full items-center border-b-2 border-[var(--ink)] px-1 text-left text-xs font-bold uppercase tracking-normal ${
          isOpen ? "mb-3" : ""
        }`}
      >
        [ {isOpen ? "-" : "+"} ] Evidence Box
      </button>

      {isOpen ? (
        <div id="evidence-box-actions" className="space-y-2">
          <div className="border-2 border-[var(--ink)] bg-[var(--paper)] px-2 py-2 text-[10px] font-black uppercase">
            <div>[ {activeInvestigation.shortName} ]</div>
            <div className="mt-1 normal-case opacity-60">
              {activeInvestigation.facts.length} indexed case records
            </div>
            <button
              type="button"
              onClick={openLedger}
              className="mt-2 hidden min-h-11 w-full border-2 border-[var(--ink)] bg-[var(--accent)] px-2 text-left text-[9px] font-black uppercase shadow-[2px_2px_0_var(--ink)] md:block"
            >
              [ OPEN CASE LEDGER ]
            </button>
          </div>
          {evidenceItems.map((item) => (
            <div key={item.nodeType}>
              <div
                draggable
                onDragStart={(event) => handleDragStart(event, item.nodeType)}
                className="hidden min-h-11 cursor-grab items-center border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-xs font-bold uppercase shadow-[3px_3px_0_var(--ink)] active:cursor-grabbing rounded-none md:flex"
              >
                {item.label}
              </div>
              <button
                type="button"
                onPointerDown={(event) => handleTouchDragStart(event, item)}
                onPointerMove={handleTouchDragMove}
                onPointerUp={finishTouchDrag}
                onPointerCancel={cancelTouchDrag}
                onClick={() => {
                  // Touch browsers may synthesize a delayed click after the
                  // pointer-up placement. Ignore it so one gesture adds one node.
                  if (Date.now() - lastTouchPlacementAtRef.current < 500)
                    return;
                  onMobilePlace(item.nodeType);
                  triggerHaptic("light");
                }}
                className="flex min-h-11 w-full touch-none items-center justify-between border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-left text-xs font-bold uppercase shadow-[3px_3px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none rounded-none md:hidden"
                aria-label={`Add ${item.label} to board`}
              >
                <span>{item.label}</span>
                <span className="text-[9px] opacity-65">Tap / Drag</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {touchDrag ? (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[100] border-2 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)]"
          style={{
            transform: `translate3d(${touchDrag.x + 12}px, ${touchDrag.y + 12}px, 0)`,
          }}
        >
          {touchDrag.label}
        </div>
      ) : null}
    </div>
  );
}

type BoardSurfaceProps = {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addEvidenceNode: (nodeType: EvidenceNodeType, position: XYPosition) => void;
  setNodeLock: (nodeId: string, lockedBy: string | null) => void;
  isLive: boolean;
};

function BoardSurface({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  addEvidenceNode,
  setNodeLock,
  isLive,
}: BoardSurfaceProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { agentId } = useCollaborationIdentity();
  const boardRef = useRef<HTMLDivElement>(null);
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const activeInvestigation = getInvestigation(activeInvestigationId);

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const lockedBy =
          typeof node.data.lockedBy === "string" ? node.data.lockedBy : null;

        return {
          ...node,
          draggable: lockedBy === null || lockedBy === agentId,
        };
      }),
    [agentId, nodes],
  );

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const nodeType = event.dataTransfer.getData(dragTransferType);
    if (nodeType !== "stickyNote" && nodeType !== "polaroid") return;

    addEvidenceNode(
      nodeType,
      screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    );
  }

  function handleMobilePlace(
    nodeType: EvidenceNodeType,
    screenPosition?: XYPosition,
  ) {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const isInsideBoard =
      screenPosition &&
      screenPosition.x >= bounds.left &&
      screenPosition.x <= bounds.right &&
      screenPosition.y >= bounds.top &&
      screenPosition.y <= bounds.bottom;
    const target = isInsideBoard
      ? screenPosition
      : {
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        };

    addEvidenceNode(nodeType, screenToFlowPosition(target));
  }

  function handleNodeDragStart(_event: unknown, node: Node) {
    const lockedBy =
      typeof node.data.lockedBy === "string" ? node.data.lockedBy : null;

    if (lockedBy === null || lockedBy === agentId) {
      setNodeLock(node.id, agentId);
    }
  }

  function handleNodeDragStop(_event: unknown, node: Node) {
    setNodeLock(node.id, null);
  }

  return (
    <div ref={boardRef} className="relative h-full w-full bg-[var(--paper)]">
      <EvidenceBox onMobilePlace={handleMobilePlace} />
      <div className="pointer-events-none absolute right-2 top-2 z-10 max-w-[calc(100%-13rem)] border-2 border-[var(--ink)] bg-[var(--paper)] px-2 py-2 text-right font-mono text-[9px] font-black uppercase shadow-[3px_3px_0_var(--ink)] max-[390px]:hidden md:right-4 md:top-4 md:text-[10px]">
        <div>[ {activeInvestigation.shortName} ]</div>
        <div className="mt-1 hidden font-bold normal-case opacity-65 sm:block">
          Board storage follows the active collaboration room
        </div>
      </div>
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        onlyRenderVisibleElements
        nodeTypes={isLive ? liveNodeTypes : localNodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        panOnScroll
        selectionOnDrag={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        className="bg-[var(--paper)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="var(--dim)"
          gap={24}
          size={1}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function LiveBoardCanvas() {
  const { fitView } = useReactFlow();
  const storedNodes = useStorage((root) => root.nodes);
  const storedEdges = useStorage((root) => root.edges);
  const nodes = useMemo(() => deserializeFlowNodes(storedNodes), [storedNodes]);
  const edges = useMemo(() => deserializeFlowEdges(storedEdges), [storedEdges]);
  const knownNodeIds = useRef(new Set(nodes.map((node) => node.id)));

  useEffect(() => {
    const incomingNode = nodes.find(
      (node) =>
        !knownNodeIds.current.has(node.id) &&
        node.data.source === "FIELD-UPLINK",
    );

    knownNodeIds.current = new Set(nodes.map((node) => node.id));
    if (!incomingNode) return;

    const animationFrame = window.requestAnimationFrame(() => {
      void fitView({
        nodes: [incomingNode],
        duration: 500,
        padding: 0.8,
        maxZoom: 1.1,
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [fitView, nodes]);

  const onNodesChange = useMutation(({ storage }, changes: NodeChange[]) => {
    applyNodeChangesToLiveList(storage.get("nodes"), changes);
  }, []);

  const onEdgesChange = useMutation(({ storage }, changes: EdgeChange[]) => {
    applyEdgeChangesToLiveList(storage.get("edges"), changes);
  }, []);

  const addEvidenceNode = useMutation(
    ({ storage }, nodeType: EvidenceNodeType, position: XYPosition) => {
      const node: Node = {
        id: `${nodeType}-${crypto.randomUUID()}`,
        type: nodeType,
        position,
        data:
          nodeType === "stickyNote"
            ? { text: "" }
            : { caption: "SUSPECT POLAROID" },
      };

      storage.get("nodes").push(serializeFlowNode(node));
    },
    [],
  );

  const setNodeLock = useMutation(
    ({ storage }, nodeId: string, lockedBy: string | null) => {
      const liveNodes = storage.get("nodes");
      const nodeIndex = liveNodes.findIndex((node) => node.id === nodeId);
      if (nodeIndex === -1) return;

      const node = liveNodes.get(nodeIndex);
      if (!node) return;

      liveNodes.set(nodeIndex, {
        ...node,
        data: {
          ...node.data,
          lockedBy,
        },
      });
    },
    [],
  );

  return (
    <BoardSurface
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      addEvidenceNode={addEvidenceNode}
      setNodeLock={setNodeLock}
      isLive
    />
  );
}

function LocalBoardCanvas() {
  const nodes = useInvestigationStore((state) => state.nodes);
  const edges = useInvestigationStore((state) => state.edges);
  const onNodesChange = useInvestigationStore((state) => state.onNodesChange);
  const onEdgesChange = useInvestigationStore((state) => state.onEdgesChange);
  const addEvidenceNode = useInvestigationStore(
    (state) => state.addEvidenceNode,
  );
  const lockNode = useInvestigationStore((state) => state.lockNode);
  const unlockNode = useInvestigationStore((state) => state.unlockNode);

  return (
    <BoardSurface
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      addEvidenceNode={addEvidenceNode}
      setNodeLock={(nodeId, lockedBy) => {
        if (lockedBy) lockNode(nodeId, lockedBy);
        else unlockNode(nodeId, "AGENT-01");
      }}
      isLive={false}
    />
  );
}

function BoardStorageFallback() {
  return (
    <div className="grid h-full w-full place-items-center bg-[var(--paper)] p-6 font-mono text-sm font-black uppercase tracking-[0.14em] text-[var(--dim)]">
      [ DECRYPTING LEDGER... ]
    </div>
  );
}

export function Board() {
  const { isMultiplayer } = useCollaborationIdentity();

  return (
    <ReactFlowProvider>
      {isMultiplayer ? (
        <ClientSideSuspense fallback={<BoardStorageFallback />}>
          <LiveBoardCanvas />
        </ClientSideSuspense>
      ) : (
        <LocalBoardCanvas />
      )}
    </ReactFlowProvider>
  );
}
