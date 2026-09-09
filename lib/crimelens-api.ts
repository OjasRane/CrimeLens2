import type {
  Investigation,
  InvestigationFact,
  InvestigationGraphLink,
  InvestigationGraphNode,
  InvestigationId,
  InvestigationLocation,
  InvestigationRoute,
  InvestigationTimelineEvent,
} from "@/data/investigations/types";
import {
  getSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase-browser";
import type {
  GraphWorkspace,
  WorkspaceAnalysisResult,
  WorkspaceConflict,
  WorkspacePathResult,
  WorkspaceQuestion,
  WorkspaceQuestionLink,
  WorkspaceSnapshot,
  WorkspaceSuggestion,
  WorkspaceSummary,
} from "@/lib/network-workspace-types";
import type {
  ActivityEvent,
  CandidateReviewStatus,
  EvidenceCommitResult,
  EvidenceExtraction,
  EvidenceItem,
  InvestigationSearchResult,
  InvestigationStatus,
  ReportDraft,
} from "@/lib/evidence-types";

const apiBase = (
  process.env.NEXT_PUBLIC_CRIMELENS_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export class CrimeLensApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CrimeLensApiError";
  }
}

type InvestigationDetail = Omit<
  Investigation,
  "map" | "graph" | "timeline" | "facts"
> & {
  classification: string;
  isDemo: boolean;
  graphFilters: Investigation["graph"]["filters"];
};

type MapResponse = Investigation["map"] & { investigationId: string };
type NetworkResponse = {
  investigationId: string;
  nodes: InvestigationGraphNode[];
  edges: InvestigationGraphLink[];
};
type TimelineResponse = Investigation["timeline"] & {
  investigationId: string;
  events: Array<InvestigationTimelineEvent & { eventTime?: string | null }>;
};
type FactsResponse = {
  investigationId: string;
  facts: InvestigationFact[];
  total: number;
  limit: number;
  offset: number;
};

async function accessToken(): Promise<string> {
  if (!isSupabaseBrowserConfigured) {
    throw new CrimeLensApiError(
      "Supabase Auth is not configured.",
      "AUTH_NOT_CONFIGURED",
      401,
    );
  }
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session?.access_token) {
    throw new CrimeLensApiError(
      "An authenticated investigator session is required.",
      "AUTHENTICATION_REQUIRED",
      401,
    );
  }
  return data.session.access_token;
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${apiBase}${path}`, {
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    let code = "REQUEST_FAILED";
    let message = "Investigation service could not be reached.";
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code || code;
      message = body.error?.message || message;
    } catch {
      // A safe user-facing fallback is already assigned.
    }
    throw new CrimeLensApiError(message, code, response.status);
  }
  return (await response.json()) as T;
}

async function mutate<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${apiBase}${path}`, {
    method,
    signal,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let code = "REQUEST_FAILED";
    let message = "Investigation service could not be reached.";
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = payload.error?.code || code;
      message = payload.error?.message || message;
    } catch {
      // Preserve the safe fallback.
    }
    throw new CrimeLensApiError(message, code, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function mutateForm<T>(
  path: string,
  form: FormData,
  signal?: AbortSignal,
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: form,
  });
  if (!response.ok) {
    let code = "UPLOAD_FAILED";
    let message = "Evidence could not be ingested.";
    try {
      const payload = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = payload.error?.code || code;
      message = payload.error?.message || message;
    } catch {
      // Preserve the safe fallback.
    }
    throw new CrimeLensApiError(message, code, response.status);
  }
  return (await response.json()) as T;
}

export function getCurrentUser(signal?: AbortSignal) {
  return request<{
    userId: string;
    agentId: string;
    displayName: string;
    role: string;
    clearanceLevel: string;
  }>("/api/v1/me", signal);
}

export function getInvestigations(signal?: AbortSignal) {
  return request<
    Array<{
      id: InvestigationId;
      name: string;
      shortName: string;
      type: Investigation["type"];
    }>
  >("/api/v1/investigations", signal);
}

export function getInvestigation(id: InvestigationId, signal?: AbortSignal) {
  return request<InvestigationDetail>(
    `/api/v1/investigations/${encodeURIComponent(id)}`,
    signal,
  );
}

export function getInvestigationMap(
  id: InvestigationId,
  signal?: AbortSignal,
) {
  return request<MapResponse>(
    `/api/v1/investigations/${encodeURIComponent(id)}/map`,
    signal,
  );
}

export function getInvestigationNetwork(
  id: InvestigationId,
  signal?: AbortSignal,
) {
  return request<NetworkResponse>(
    `/api/v1/investigations/${encodeURIComponent(id)}/network`,
    signal,
  );
}

export function getInvestigationTimeline(
  id: InvestigationId,
  signal?: AbortSignal,
) {
  return request<TimelineResponse>(
    `/api/v1/investigations/${encodeURIComponent(id)}/timeline`,
    signal,
  );
}

export function getInvestigationFacts(
  id: InvestigationId,
  signal?: AbortSignal,
) {
  return request<FactsResponse>(
    `/api/v1/investigations/${encodeURIComponent(id)}/facts?limit=250`,
    signal,
  );
}

export function getEntityDetails(
  id: InvestigationId,
  entityId: string,
  signal?: AbortSignal,
) {
  return request<{
    entity: InvestigationGraphNode;
    relationships: InvestigationGraphLink[];
    locations: InvestigationLocation[];
    timelineEvents: InvestigationTimelineEvent[];
    facts: InvestigationFact[];
  }>(
    `/api/v1/investigations/${encodeURIComponent(id)}/entities/${encodeURIComponent(entityId)}`,
    signal,
  );
}

export function getLocationDetails(
  id: InvestigationId,
  locationId: string,
  signal?: AbortSignal,
) {
  return request<{
    location: InvestigationLocation;
    relatedEntities: InvestigationGraphNode[];
    timelineEvents: InvestigationTimelineEvent[];
    facts: InvestigationFact[];
  }>(
    `/api/v1/investigations/${encodeURIComponent(id)}/locations/${encodeURIComponent(locationId)}`,
    signal,
  );
}

export async function getInvestigationBundle(
  id: InvestigationId,
  signal?: AbortSignal,
): Promise<Investigation> {
  const [detail, map, network, timeline, facts] = await Promise.all([
    getInvestigation(id, signal),
    getInvestigationMap(id, signal),
    getInvestigationNetwork(id, signal),
    getInvestigationTimeline(id, signal),
    getInvestigationFacts(id, signal),
  ]);
  const { graphFilters, ...base } = detail;
  return {
    ...base,
    map: {
      center: map.center,
      zoom: map.zoom,
      boundsLabel: map.boundsLabel,
      filterGroups: map.filterGroups,
      locations: map.locations as InvestigationLocation[],
      routes: map.routes as InvestigationRoute[],
      densityNotice: map.densityNotice,
    },
    graph: {
      nodes: network.nodes,
      links: network.edges,
      filters: graphFilters,
    },
    timeline: {
      startDate: timeline.startDate,
      endDate: timeline.endDate,
      events: timeline.events,
    },
    facts: facts.facts,
  };
}

export function getGraphWorkspaces(
  investigationId: InvestigationId,
  signal?: AbortSignal,
) {
  return request<WorkspaceSummary[]>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/workspaces`,
    signal,
  );
}

export function getGraphWorkspace(workspaceId: string, signal?: AbortSignal) {
  return request<GraphWorkspace>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
    signal,
  );
}

export function createGraphWorkspace(
  investigationId: InvestigationId,
  payload: { name: string; description: string },
  signal?: AbortSignal,
) {
  return mutate<GraphWorkspace>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/workspaces`,
    "POST",
    payload,
    signal,
  );
}

export function saveGraphWorkspace(
  workspaceId: string,
  payload: GraphWorkspace,
  signal?: AbortSignal,
) {
  return mutate<GraphWorkspace>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
    "PATCH",
    payload,
    signal,
  );
}

export function deleteGraphWorkspace(
  workspaceId: string,
  signal?: AbortSignal,
) {
  return mutate<void>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
    "DELETE",
    undefined,
    signal,
  );
}

export function findGraphWorkspacePath(
  workspaceId: string,
  payload: { fromNodeId: string; toNodeId: string; maxHops: number; relationshipTypes?: string[] },
  signal?: AbortSignal,
) {
  return mutate<WorkspacePathResult>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/path`, "POST", payload, signal);
}

export function analyzeGraphWorkspace(workspaceId: string, signal?: AbortSignal) {
  return mutate<WorkspaceAnalysisResult>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/analyze`, "POST", {}, signal);
}

export function getWorkspaceSuggestions(workspaceId: string, signal?: AbortSignal) {
  return request<WorkspaceSuggestion[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/suggestions`, signal);
}

export function reviewWorkspaceSuggestion(workspaceId: string, suggestionId: string, status: "ACCEPTED_AS_HYPOTHESIS" | "REJECTED", signal?: AbortSignal) {
  return mutate<WorkspaceSuggestion>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/suggestions/${encodeURIComponent(suggestionId)}`, "PATCH", { status }, signal);
}

export function getWorkspaceConflicts(workspaceId: string, signal?: AbortSignal) {
  return request<WorkspaceConflict[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/conflicts`, signal);
}

export function reviewWorkspaceConflict(workspaceId: string, conflictId: string, status: "REVIEWED" | "RESOLVED" | "DISMISSED", signal?: AbortSignal) {
  return mutate<WorkspaceConflict>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/conflicts/${encodeURIComponent(conflictId)}`, "PATCH", { status }, signal);
}

export function getWorkspaceQuestions(workspaceId: string, signal?: AbortSignal) {
  return request<WorkspaceQuestion[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/questions`, signal);
}

export function createWorkspaceQuestion(workspaceId: string, payload: { questionText: string; notes?: string; links?: WorkspaceQuestionLink[] }, signal?: AbortSignal) {
  return mutate<WorkspaceQuestion>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/questions`, "POST", payload, signal);
}

export function updateWorkspaceQuestion(workspaceId: string, questionId: string, payload: Partial<Pick<WorkspaceQuestion, "questionText" | "status" | "notes" | "links">>, signal?: AbortSignal) {
  return mutate<WorkspaceQuestion>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/questions/${encodeURIComponent(questionId)}`, "PATCH", payload, signal);
}

export function deleteWorkspaceQuestion(workspaceId: string, questionId: string, signal?: AbortSignal) {
  return mutate<void>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/questions/${encodeURIComponent(questionId)}`, "DELETE", undefined, signal);
}

export function getWorkspaceSnapshots(workspaceId: string, signal?: AbortSignal) {
  return request<WorkspaceSnapshot[]>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/snapshots`, signal);
}

export function createWorkspaceSnapshot(workspaceId: string, payload: { name: string; description?: string }, signal?: AbortSignal) {
  return mutate<WorkspaceSnapshot>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/snapshots`, "POST", payload, signal);
}

export function restoreWorkspaceSnapshot(workspaceId: string, snapshotId: string, signal?: AbortSignal) {
  return mutate<GraphWorkspace>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`, "POST", {}, signal);
}

export function uploadEvidence(
  investigationId: InvestigationId,
  payload: { file: File; sourceType: string; description: string },
  signal?: AbortSignal,
) {
  const form = new FormData();
  form.set("file", payload.file);
  form.set("source_type", payload.sourceType);
  form.set("description", payload.description);
  return mutateForm<EvidenceItem>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/evidence`,
    form,
    signal,
  );
}

export function getEvidenceItems(
  investigationId: InvestigationId,
  signal?: AbortSignal,
) {
  return request<EvidenceItem[]>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/evidence`,
    signal,
  );
}

export function getEvidenceItem(evidenceId: string, signal?: AbortSignal) {
  return request<EvidenceItem>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}`,
    signal,
  );
}

export function retryEvidenceExtraction(
  evidenceId: string,
  signal?: AbortSignal,
) {
  return mutate<{ jobId: string; status: string }>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/extract`,
    "POST",
    {},
    signal,
  );
}

export function getEvidenceExtraction(
  evidenceId: string,
  signal?: AbortSignal,
) {
  return request<EvidenceExtraction>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/extraction`,
    signal,
  );
}

export function reviewEvidenceCandidate(
  evidenceId: string,
  candidateId: string,
  payload: {
    reviewStatus: CandidateReviewStatus;
    candidatePayload?: Record<string, unknown>;
  },
  signal?: AbortSignal,
) {
  return mutate<EvidenceExtraction["candidates"][number]>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/candidates/${encodeURIComponent(candidateId)}`,
    "PATCH",
    payload,
    signal,
  );
}

export function commitEvidence(evidenceId: string, signal?: AbortSignal) {
  return mutate<EvidenceCommitResult>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/commit`,
    "POST",
    {},
    signal,
  );
}

export function getEvidenceHistory(evidenceId: string, signal?: AbortSignal) {
  return request<ActivityEvent[]>(
    `/api/v1/evidence/${encodeURIComponent(evidenceId)}/history`,
    signal,
  );
}

export function searchInvestigation(
  investigationId: InvestigationId,
  query: string,
  signal?: AbortSignal,
) {
  return request<InvestigationSearchResult[]>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/search?q=${encodeURIComponent(query)}`,
    signal,
  );
}

export function getInvestigationActivity(
  investigationId: InvestigationId,
  signal?: AbortSignal,
) {
  return request<ActivityEvent[]>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/activity`,
    signal,
  );
}

export function getInvestigationStatus(
  investigationId: InvestigationId,
  signal?: AbortSignal,
) {
  return request<InvestigationStatus>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/status`,
    signal,
  );
}

export function generateCaseBrief(
  investigationId: InvestigationId,
  include: string[],
  signal?: AbortSignal,
) {
  return mutate<ReportDraft>(
    `/api/v1/investigations/${encodeURIComponent(investigationId)}/reports`,
    "POST",
    { include },
    signal,
  );
}
