import type { LiveList } from "@liveblocks/client";
import type {
  StoredFlowEdge,
  StoredFlowNode,
} from "@/lib/evidence-board-types";

export type ForceMapPanEvent = {
  type: "FORCE_MAP_PAN";
  coordinates: [number, number];
  targetId: string;
};

declare global {
  interface Liveblocks {
    Presence: {
      x: number | null;
      y: number | null;
      agentId: string;
    };
    Storage: {
      nodes: LiveList<StoredFlowNode>;
      edges: LiveList<StoredFlowEdge>;
    };
    UserMeta: {
      id: string;
      info: {
        name?: string;
      };
    };
    RoomEvent: ForceMapPanEvent;
  }
}

export {};
