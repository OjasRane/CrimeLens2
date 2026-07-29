"use client";

import type { DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { RedStringEdge } from "@/components/flow-edges";
import { PolaroidNode, StickyNoteNode } from "@/components/flow-nodes";
import {
  type EvidenceNodeType,
  useInvestigationStore,
} from "@/store/use-investigation-store";

const dragTransferType = "application/reactflow";

const nodeTypes = {
  stickyNote: StickyNoteNode,
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

function EvidenceBox() {
  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    nodeType: EvidenceNodeType,
  ) {
    event.dataTransfer.setData(dragTransferType, nodeType);
    event.dataTransfer.effectAllowed = "move";
  }

  return (
    <div className="absolute left-4 top-4 z-10 w-48 border-4 border-black bg-white p-3 font-mono text-black shadow-[4px_4px_0_black] rounded-none">
      <div className="mb-3 border-b-2 border-black pb-2 text-xs font-bold uppercase tracking-normal">
        Evidence Box
      </div>
      <div className="space-y-2">
        {evidenceItems.map((item) => (
          <div
            key={item.nodeType}
            draggable
            onDragStart={(event) => handleDragStart(event, item.nodeType)}
            className="cursor-grab border-2 border-black bg-[#F4F4F0] px-3 py-2 text-xs font-bold uppercase shadow-[3px_3px_0_black] active:cursor-grabbing rounded-none"
          >
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardCanvas() {
  const nodes = useInvestigationStore((state) => state.nodes);
  const edges = useInvestigationStore((state) => state.edges);
  const onNodesChange = useInvestigationStore((state) => state.onNodesChange);
  const onEdgesChange = useInvestigationStore((state) => state.onEdgesChange);
  const addEvidenceNode = useInvestigationStore(
    (state) => state.addEvidenceNode,
  );
  const { screenToFlowPosition } = useReactFlow();

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const nodeType = event.dataTransfer.getData(dragTransferType);

    if (nodeType !== "stickyNote" && nodeType !== "polaroid") {
      return;
    }

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    addEvidenceNode(nodeType, position);
  }

  return (
    <div className="relative h-full w-full bg-[#F4F4F0]">
      <EvidenceBox />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        fitView
        className="bg-[#F4F4F0]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="#000000"
          gap={24}
          size={1}
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function Board() {
  return (
    <ReactFlowProvider>
      <BoardCanvas />
    </ReactFlowProvider>
  );
}
