import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";

export type EvidenceNodeType = "stickyNote" | "polaroid";
export type ActiveWorkspace = "canvas" | "map" | "network" | "timeline";
export type TimeRange = [string, string];
export type SpatialBounds = {
  north: number;
  east: number;
  south: number;
  west: number;
};

export type InvestigationFact = {
  id: string;
  type: "forensic" | "testimonial";
  text: string;
  status: "verified" | "disputed" | "pending";
};

type InvestigationState = {
  activeWorkspace: ActiveWorkspace;
  timeRange: TimeRange;
  playbackDate: string;
  isMapPlaying: boolean;
  selectedSuspectId: string | null;
  selectedCrimeTypes: string[];
  spatialBounds: SpatialBounds | null;
  nodes: Node[];
  edges: Edge[];
  setActiveWorkspace: (workspace: ActiveWorkspace) => void;
  setTimeRange: (timeRange: TimeRange) => void;
  setPlaybackDate: (date: string) => void;
  setIsMapPlaying: (isPlaying: boolean) => void;
  setSelectedSuspectId: (suspectId: string | null) => void;
  toggleSelectedCrimeType: (crimeType: string) => void;
  setSelectedCrimeTypeEnabled: (crimeType: string, isEnabled: boolean) => void;
  setSpatialBounds: (bounds: SpatialBounds | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addEvidenceNode: (nodeType: EvidenceNodeType, position: XYPosition) => void;
  pinFactToBoard: (text: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  facts: InvestigationFact[];
  isLedgerOpen: boolean;
  toggleLedger: () => void;
  openLedger: () => void;
  clearAllFilters: () => void;
};

export const useInvestigationStore = create<InvestigationState>((set, get) => ({
  activeWorkspace: "map",
  timeRange: ["2026-07-18", "2026-07-28"],
  playbackDate: "2026-07-28",
  isMapPlaying: false,
  selectedSuspectId: null,
  selectedCrimeTypes: ["Burglary", "Assault", "Fraud", "Robbery", "Arson"],
  spatialBounds: null,
  nodes: [
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
  ],
  edges: [
    {
      id: "note-victim-photo-ticket",
      source: "note-victim",
      target: "photo-ticket",
      type: "redString",
    },
    {
      id: "note-victim-note-witness",
      source: "note-victim",
      target: "note-witness",
      type: "redString",
    },
  ],
  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace });
  },
  setTimeRange: (timeRange) => {
    set({ timeRange });
  },
  setPlaybackDate: (date) => {
    set({ playbackDate: date });
  },
  setIsMapPlaying: (isPlaying) => {
    set({ isMapPlaying: isPlaying });
  },
  setSelectedSuspectId: (suspectId) => {
    set({ selectedSuspectId: suspectId });
  },
  toggleSelectedCrimeType: (crimeType) => {
    const selectedCrimeTypes = get().selectedCrimeTypes;
    const nextTypes = selectedCrimeTypes.includes(crimeType)
      ? selectedCrimeTypes.filter((type) => type !== crimeType)
      : [...selectedCrimeTypes, crimeType];

    set({
      selectedCrimeTypes: nextTypes,
    });
  },
  setSelectedCrimeTypeEnabled: (crimeType, isEnabled) => {
    const selectedCrimeTypes = get().selectedCrimeTypes;

    if (isEnabled) {
      set({
        selectedCrimeTypes: selectedCrimeTypes.includes(crimeType)
          ? selectedCrimeTypes
          : [...selectedCrimeTypes, crimeType],
      });
      return;
    }

    set({
      selectedCrimeTypes: selectedCrimeTypes.filter((type) => type !== crimeType),
    });
  },
  setSpatialBounds: (bounds) => {
    set({ spatialBounds: bounds });
  },
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  addEvidenceNode: (nodeType, position) => {
    const id = `${nodeType}-${crypto.randomUUID()}`;
    const data =
      nodeType === "stickyNote"
        ? { text: "" }
        : { caption: "SUSPECT POLAROID" };

    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: nodeType,
          position,
          data,
        },
      ],
    });
  },
  pinFactToBoard: (text) => {
    const randomOffset = () => Math.round(Math.random() * 180 - 90);
    const centerX =
      typeof window === "undefined" ? 420 : Math.round(window.innerWidth / 2);
    const centerY =
      typeof window === "undefined" ? 280 : Math.round(window.innerHeight / 2);

    set({
      nodes: [
        ...get().nodes,
        {
          id: `stickyNote-${crypto.randomUUID()}`,
          type: "stickyNote",
          position: {
            x: centerX + randomOffset(),
            y: centerY + randomOffset(),
          },
          data: {
            text,
          },
        },
      ],
    });
  },
  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
              },
            }
          : node,
      ),
    });
  },
  facts: [
    {
      id: "fact-001",
      type: "forensic",
      text: "The victim entered the station at 21:14 and never appeared on the northbound camera.",
      status: "verified",
    },
    {
      id: "fact-002",
      type: "forensic",
      text: "A torn ticket stub was recovered from the inner coat pocket.",
      status: "pending",
    },
    {
      id: "fact-003",
      type: "testimonial",
      text: "The night clerk claims a second visitor arrived fifteen minutes after closing.",
      status: "disputed",
    },
    {
      id: "fact-004",
      type: "testimonial",
      text: "The ledger clock differs from station time by seven minutes.",
      status: "pending",
    },
  ],
  isLedgerOpen: true,
  toggleLedger: () => set((state) => ({ isLedgerOpen: !state.isLedgerOpen })),
  openLedger: () => set({ isLedgerOpen: true }),
  clearAllFilters: () =>
    set({
      timeRange: ["2026-07-18", "2026-07-28"],
      playbackDate: "2026-07-28",
      selectedSuspectId: null,
      selectedCrimeTypes: ["Burglary", "Assault", "Fraud", "Robbery", "Arson"],
      spatialBounds: null,
      isMapPlaying: false,
    }),
}));
