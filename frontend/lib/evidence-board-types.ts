import type { JsonObject } from "@liveblocks/client";

export type StoredFlowPosition = JsonObject & {
  x: number;
  y: number;
};

export type StoredFlowNode = JsonObject & {
  id: string;
  type: string;
  position: StoredFlowPosition;
  data: JsonObject;
};

export type StoredFlowEdge = JsonObject & {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: JsonObject;
};
