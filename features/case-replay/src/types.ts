export type ReplaySceneType =
  | "station"
  | "shop"
  | "street"
  | "evidence"
  | "map"
  | "network"
  | "analysis"
  | "fallback";

export type ReplayView =
  | "timeline"
  | "environment"
  | "map"
  | "network"
  | "evidence";

export type CameraPreset =
  | "wide"
  | "medium"
  | "close-up"
  | "overhead"
  | "follow-character"
  | "evidence-focus"
  | "map-rise"
  | "graph-orbit";

export type ReviewStatus =
  | "CONFIRMED FACT"
  | "SUPPORTED LINK"
  | "UNVERIFIED"
  | "INVESTIGATIVE HYPOTHESIS";

export type ReplayPerson = {
  entityId: string;
  name: string;
  role: "victim" | "suspect" | "witness" | "investigator" | "officer";
};

export type ReplayEvidence = {
  id: string;
  label: string;
  sourceId: string;
  status: ReviewStatus;
};

export type ReplayLocation = {
  id: string;
  label: string;
  coordinates?: [number, number];
  sourceIncidentId?: string;
};

export type ReplayChapter = {
  id: string;
  number: number;
  title: string;
  startIndex: number;
  endIndex: number;
  shortSummary?: string;
  timeRange?: string;
  viewSequence?: ReplayView[];
  keyEntities?: string[];
  locations?: string[];
  evidenceRefs?: string[];
  chapterNarration?: string;
  whyItMatters?: string;
  relatedTimelineEvents?: string[];
  established?: string;
  remainsUnclear?: string;
  nextLead?: string;
};

export type ReplayBeat = {
  id: string;
  number: number;
  title: string;
  startIndex: number;
  endIndex: number;
};

export type ReplayEvent = {
  id: string;
  sourceTimelineId: string;
  sourceIncidentId?: string;
  timestamp: string;
  date: string;
  category: string;
  title: string;
  headline: string;
  description: string;
  narration: string;
  transitionCue: string;
  importance: "low" | "medium" | "high" | "critical";
  status: ReviewStatus;
  whyItMatters: string;
  sceneType: ReplaySceneType;
  cameraPreset: CameraPreset;
  viewSequence: ReplayView[];
  people: ReplayPerson[];
  evidence: ReplayEvidence[];
  location?: ReplayLocation;
  relatedNodeIds: string[];
  relatedLinkIds: string[];
  chapterId: string;
  beatId: string;
  eventType?: string;
  currentView?: ReplayView;
  sceneTemplate?: string;
  annotationText?: string;
  nextLead?: string;
  knowledgeLabel?: string;
};

export type ReplayStory = {
  caseId: string;
  title: string;
  subtitle: string;
  dateRange: [string, string];
  events: ReplayEvent[];
  chapters: ReplayChapter[];
  beats: ReplayBeat[];
  entityCount: number;
  evidenceCount: number;
};

export type SourceTimelineEvent = {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  category: string;
  title: string;
  description: string;
  severity: number;
};

export type SourceEvidenceNode = {
  id: string;
  data: Record<string, unknown>;
};

export type SourceMapIncident = {
  id: string;
  title: string;
  date: string;
  coordinates: [number, number];
};

export type SourceGraphNode = {
  id: string;
  label: string;
  kind: string;
  subtitle: string;
};

export type SourceGraphLink = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type ReplayCaseSource = {
  caseId: string;
  title: string;
  timelineEvents: SourceTimelineEvent[];
  evidenceNodes: SourceEvidenceNode[];
  mapIncidents: SourceMapIncident[];
  graphNodes: SourceGraphNode[];
  graphLinks: SourceGraphLink[];
};

export type ReplayCaseData = ReplayCaseSource;
