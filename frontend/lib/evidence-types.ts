import type { InvestigationId } from "@/data/investigations/types";

export type EvidenceProcessingStatus =
  | "UPLOADED"
  | "EXTRACTING"
  | "AI_ANALYZING"
  | "PENDING_REVIEW"
  | "PARTIALLY_REVIEWED"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type CandidateReviewStatus =
  | "PENDING"
  | "ACCEPTED"
  | "EDITED_ACCEPTED"
  | "REJECTED";

export type CandidateType =
  | "ENTITY"
  | "LOCATION"
  | "EVENT"
  | "DATE_TIME"
  | "RELATIONSHIP"
  | "CONFLICT";

export type EvidenceItem = {
  id: string;
  investigationId: InvestigationId;
  displayId: string;
  sourceType: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  description: string;
  processingStatus: EvidenceProcessingStatus;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  extractionCounts: Record<string, number>;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionCandidate = {
  id: string;
  extractionId: string;
  candidateType: CandidateType;
  candidatePayload: Record<string, unknown>;
  reviewStatus: CandidateReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdResourceType: string | null;
  createdResourceId: string | null;
  createdAt: string;
};

export type EvidenceExtraction = {
  id: string;
  evidenceId: string;
  status: EvidenceProcessingStatus;
  provider: string;
  modelIdentifier: string;
  candidates: ExtractionCandidate[];
  counts: Record<string, number>;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
};

export type EvidenceCommitResult = {
  evidenceId: string;
  alreadyCommitted: boolean;
  entitiesCreated: number;
  entitiesMerged: number;
  locationsCreated: number;
  eventsCreated: number;
  relationshipsCreated: number;
  factsCreated: number;
};

export type InvestigationSearchResult = {
  id: string;
  resultType: string;
  title: string;
  detail: string;
  workspace: string;
};

export type ActivityEvent = {
  id: string;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  agentId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type InvestigationStatus = {
  verifiedEntities: number;
  supportedLinks: number;
  hypotheses: number;
  openConflicts: number;
  openQuestions: number;
  unsourcedRelationships: number;
  pendingReview: number;
  readinessItems: Array<{ type: string; count: number; label: string }>;
};

export type ReportDraft = {
  id: string;
  investigationId: string;
  status: "AI_ASSISTED_DRAFT";
  title: string;
  content: string;
  createdAt: string;
};
