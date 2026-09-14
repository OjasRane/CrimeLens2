import { LiveList } from "@liveblocks/client";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "@/lib/evidence-board-types";

export const INITIAL_EVIDENCE_NODES: StoredFlowNode[] = [
  {
    id: "note-victim",
    type: "stickyNote",
    position: { x: 120, y: 120 },
    data: {
      text: "Victim last seen at Platform 9. Station clock reads 21:14.",
    },
  },
  {
    id: "photo-ticket",
    type: "polaroid",
    position: { x: 480, y: 70 },
    data: {
      caption: "TORN TICKET",
    },
  },
  {
    id: "note-witness",
    type: "stickyNote",
    position: { x: 420, y: 280 },
    data: {
      text: "Night clerk reports a second visitor after closing.",
    },
  },
];

export const INITIAL_EVIDENCE_EDGES: StoredFlowEdge[] = [];

export function createInitialEvidenceStorage() {
  return {
    nodes: new LiveList(INITIAL_EVIDENCE_NODES),
    edges: new LiveList(INITIAL_EVIDENCE_EDGES),
  };
}

export function serializeFlowNode(node: Node): StoredFlowNode {
  return JSON.parse(JSON.stringify(node)) as StoredFlowNode;
}

export function serializeFlowEdge(edge: Edge): StoredFlowEdge {
  return JSON.parse(JSON.stringify(edge)) as StoredFlowEdge;
}

export function deserializeFlowNodes(nodes: readonly unknown[]): Node[] {
  return nodes.map((node) => {
    const stored = node as StoredFlowNode;

    return {
      ...stored,
      position: { ...stored.position },
      data: { ...stored.data },
    } as unknown as Node;
  });
}

export function deserializeFlowEdges(edges: readonly unknown[]): Edge[] {
  return edges.map((edge) => {
    const stored = edge as StoredFlowEdge;

    return {
      ...stored,
      data: stored.data ? { ...stored.data } : undefined,
    } as unknown as Edge;
  });
}

/**
 * Applies React Flow changes without clearing the shared list. Clearing and
 * rebuilding the list on every drag frame can overwrite another collaborator's
 * simultaneous insert or edit; targeted mutations allow Liveblocks to merge
 * changes by list item instead.
 */
export function applyNodeChangesToLiveList(
  liveNodes: LiveList<StoredFlowNode>,
  changes: NodeChange[],
) {
  for (const change of changes) {
    if (change.type === "add") {
      const index = Math.min(change.index ?? liveNodes.length, liveNodes.length);
      liveNodes.insert(serializeFlowNode(change.item), index);
      continue;
    }

    const index = liveNodes.findIndex((node) => node.id === change.id);
    if (index === -1) continue;

    if (change.type === "remove") {
      liveNodes.delete(index);
      continue;
    }

    if (change.type === "replace") {
      liveNodes.set(index, serializeFlowNode(change.item));
      continue;
    }

    const storedNode = liveNodes.get(index);
    if (!storedNode) continue;

    const [nextNode] = applyNodeChanges(
      [change],
      deserializeFlowNodes([storedNode]),
    );
    if (nextNode) liveNodes.set(index, serializeFlowNode(nextNode));
  }
}

export function applyEdgeChangesToLiveList(
  liveEdges: LiveList<StoredFlowEdge>,
  changes: EdgeChange[],
) {
  for (const change of changes) {
    if (change.type === "add") {
      const index = Math.min(change.index ?? liveEdges.length, liveEdges.length);
      liveEdges.insert(serializeFlowEdge(change.item), index);
      continue;
    }

    const index = liveEdges.findIndex((edge) => edge.id === change.id);
    if (index === -1) continue;

    if (change.type === "remove") {
      liveEdges.delete(index);
      continue;
    }

    if (change.type === "replace") {
      liveEdges.set(index, serializeFlowEdge(change.item));
      continue;
    }

    const storedEdge = liveEdges.get(index);
    if (!storedEdge) continue;

    const [nextEdge] = applyEdgeChanges(
      [change],
      deserializeFlowEdges([storedEdge]),
    );
    if (nextEdge) liveEdges.set(index, serializeFlowEdge(nextEdge));
  }
}
