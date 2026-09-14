export const workspaceNodeTypes = [
  "person",
  "organization",
  "location",
  "vehicle",
  "device",
  "phone",
  "account",
  "transaction",
  "event",
  "evidence",
  "document",
  "note",
  "custom",
] as const;

export type WorkspaceNodeType = (typeof workspaceNodeTypes)[number];
export type WorkspaceVerification = "verified" | "manual" | "hypothesis";
export type WorkspaceSourceVerification =
  "verified" | "pending" | "disputed" | "demo";
export type WorkspaceOrigin = "manual" | "investigation";
export type WorkspaceIntelligenceOrigin =
  "CASE_DATABASE" | "INVESTIGATOR_CREATED" | "AI_SUGGESTED_ANALYST_ACCEPTED";
export type EvidenceSupportStatus =
  | "corroborated"
  | "supported"
  | "single_source"
  | "hypothesis"
  | "contradicted";
export type RelationshipConfidence =
  "confirmed" | "high" | "medium" | "low" | "hypothesis";

export const relationshipTypes = [
  "ASSOCIATED WITH",
  "CONTACTED",
  "SEEN WITH",
  "LOCATED AT",
  "OWNS",
  "USES",
  "TRANSFERRED TO",
  "TRAVELLED TO",
  "MEMBER OF",
  "LINKED TO",
  "SUPPORTS",
  "CONTRADICTS",
  "RELATED TO",
  "CUSTOM",
] as const;

export type WorkspaceNodeRecord = {
  id: string;
  type: WorkspaceNodeType;
  label: string;
  origin: WorkspaceOrigin;
  verificationStatus: WorkspaceVerification;
  sourceVerificationStatus?: WorkspaceSourceVerification;
  sourceEntityId?: string | null;
  sourceEventId?: string | null;
  sourceLocationId?: string | null;
  sourceFactId?: string | null;
  investigationId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  intelligenceOrigin?: WorkspaceIntelligenceOrigin;
  position: { x: number; y: number };
};

export type WorkspaceBasisReference = {
  id: string;
  resourceType:
    "entity" | "location" | "event" | "fact" | "document" | "analyst_note";
  label: string;
  sourceRef?: string | null;
  verified: boolean;
};

export type WorkspaceEdgeRecord = {
  id: string;
  source: string;
  target: string;
  relationshipType: string;
  label: string;
  confidence: RelationshipConfidence;
  verificationStatus: WorkspaceVerification;
  reason?: string;
  sourceRef?: string | null;
  basis?: WorkspaceBasisReference[];
  intelligenceOrigin?: WorkspaceIntelligenceOrigin;
};

export type WorkspaceGroupRecord = {
  id: string;
  name: string;
  groupType: string;
  nodeIds: string[];
};

export type WorkspaceSourceReference = {
  sourceKind: "entity" | "location" | "event" | "fact";
  sourceId: string;
  label: string;
  type: WorkspaceNodeType;
  description: string;
  sourceVerificationStatus?: WorkspaceSourceVerification;
};

export type WorkspaceQuestionStatus =
  "OPEN" | "UNDER_REVIEW" | "PARTIALLY_ANSWERED" | "RESOLVED" | "CLOSED";

export type WorkspaceQuestionLink = {
  resourceType: "node" | "edge" | "evidence" | "event" | "note";
  resourceId: string;
  relationship: "SUPPORTS" | "CONTRADICTS" | "RELATED";
};

export type WorkspaceQuestion = {
  id: string;
  questionText: string;
  status: WorkspaceQuestionStatus;
  notes: string;
  links: WorkspaceQuestionLink[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

export type SuggestionStatus =
  "PENDING" | "ACCEPTED_AS_HYPOTHESIS" | "REJECTED";
export type SuggestionSignalStrength = "LOW" | "MEDIUM" | "HIGH";
export type WorkspaceSuggestion = {
  id: string;
  signature: string;
  sourceNodeId: string;
  targetNodeId: string;
  suggestedRelationship: string;
  status: SuggestionStatus;
  reasonCodes: Array<
    | "SHARED_LOCATION"
    | "TEMPORAL_OVERLAP"
    | "COMMON_EVIDENCE_REFERENCE"
    | "EXISTING_CASE_PATH"
  >;
  explanation: string;
  signalStrength: SuggestionSignalStrength;
  createdAt: string;
  reviewedAt?: string | null;
};

export type WorkspaceConflictType =
  | "TEMPORAL_CONFLICT"
  | "ATTRIBUTE_CONFLICT"
  | "RELATIONSHIP_CONFLICT"
  | "SOURCE_DISAGREEMENT"
  | "DUPLICATE_IDENTITY";
export type WorkspaceConflictStatus =
  "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED";
export type WorkspaceConflict = {
  id: string;
  signature: string;
  conflictType: WorkspaceConflictType;
  resourceAType: "node" | "edge" | "event" | "fact";
  resourceAId: string;
  resourceBType: "node" | "edge" | "event" | "fact";
  resourceBId: string;
  status: WorkspaceConflictStatus;
  explanation: string;
  createdAt: string;
  reviewedAt?: string | null;
};

export type WorkspaceSnapshotData = {
  name: string;
  description: string;
  nodes: WorkspaceNodeRecord[];
  edges: WorkspaceEdgeRecord[];
  groups: WorkspaceGroupRecord[];
  questions: WorkspaceQuestion[];
  suggestions: WorkspaceSuggestion[];
  conflicts: WorkspaceConflict[];
  viewport?: { x: number; y: number; zoom: number };
  filters?: { verification: WorkspaceVerification[] };
  version: number;
};

export type WorkspaceSnapshot = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  snapshotData: WorkspaceSnapshotData;
};

export type WorkspacePathResult = {
  found: boolean;
  nodeIds: string[];
  edgeIds: string[];
  hops: number;
};

export type WorkspaceAnalysisResult = {
  provider: "deterministic" | "openai";
  aiAvailable: boolean;
  suggestions: WorkspaceSuggestion[];
  conflicts: WorkspaceConflict[];
  analyzedNodeCount: number;
  analyzedEdgeCount: number;
  evidenceReferenceCount: number;
};

export type NetworkWorkspaceCommand =
  | {
      action: "add-source";
      source: WorkspaceSourceReference;
      targetWorkspaceId?: string;
    }
  | { action: "add-node"; nodeType: WorkspaceNodeType }
  | { action: "add-note" }
  | { action: "auto-layout" }
  | { action: "fit-view" }
  | { action: "search" }
  | { action: "open" };

export type GraphWorkspace = {
  id: string;
  investigationId: string;
  ownerUserId?: string;
  name: string;
  description: string;
  nodes: WorkspaceNodeRecord[];
  edges: WorkspaceEdgeRecord[];
  groups: WorkspaceGroupRecord[];
  questions: WorkspaceQuestion[];
  suggestions: WorkspaceSuggestion[];
  conflicts: WorkspaceConflict[];
  snapshots: WorkspaceSnapshot[];
  viewport?: { x: number; y: number; zoom: number };
  filters?: {
    verification: WorkspaceVerification[];
  };
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSummary = Pick<
  GraphWorkspace,
  | "id"
  | "investigationId"
  | "name"
  | "description"
  | "version"
  | "createdAt"
  | "updatedAt"
>;

export function createBlankWorkspace(
  investigationId: string,
  name = "MASTER ANALYSIS",
  description = "Investigator-controlled analysis workspace",
): GraphWorkspace {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    investigationId,
    name,
    description,
    nodes: [],
    edges: [],
    groups: [],
    questions: [],
    suggestions: [],
    conflicts: [],
    snapshots: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    filters: { verification: ["verified", "manual", "hypothesis"] },
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}
