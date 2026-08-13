export type InvestigationId = "demo" | "mumbai-2611";

export type TimePrecision = "EXACT" | "APPROX" | "WINDOW" | "NOT_APPLICABLE";
export type Confidence = "VERIFIED" | "HIGH" | "MEDIUM" | "DEMO";

export type SourceMetadata = {
  sourceRef: string;
  timePrecision: TimePrecision;
  confidence: Confidence;
};

export type CoordinateStatus =
  | "VERIFIED_VENUE"
  | "VERIFIED_LOCALITY"
  | "NEEDS_VERIFICATION";

export type CasualtyRecord = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  locationId: string;
  label: string;
  killed: number;
  injured: number;
};

export type InvestigationLocation = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  title: string;
  expandedName?: string;
  alternativeLabel?: string;
  type: string;
  filterGroups: string[];
  date: string;
  timeLabel: string;
  importance: "LOW" | "MED" | "HIGH" | "CRITICAL";
  coordinates?: [number, number];
  coordinateStatus: CoordinateStatus;
  coordinateSourceRef?: string;
  intensity: number;
  description: string;
  assignedTeam?: string;
  killed?: number;
  injured?: number;
  casualtyBreakdown?: Array<{
    id: string;
    label: string;
    killed: number;
    injured: number;
  }>;
  clearance?: string;
  graphNodeId?: string;
  linkedEntityIds: string[];
  linkedTimelineEventIds: string[];
};

export type InvestigationRoute = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  label: string;
  teamLabel: string;
  memberEntityIds: string[];
  locationIds: string[];
  description: string;
};

export type GraphNodeKind =
  | "suspect"
  | "attacker"
  | "team"
  | "organization"
  | "planner"
  | "location"
  | "response"
  | "evidence"
  | "transaction";

export type GraphLinkKind =
  | "financial"
  | "phone"
  | "colocation"
  | "team"
  | "target"
  | "movement"
  | "planning"
  | "response"
  | "evidence";

export type InvestigationGraphNode = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  label: string;
  kind: GraphNodeKind;
  subtitle: string;
  status?: string;
  risk?: "HIGH" | "MED" | "LOW";
  position: { x: number; y: number };
  dateRange?: [string, string];
};

export type InvestigationGraphLink = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  source: string;
  target: string;
  linkKind: GraphLinkKind;
  label: string;
};

export type GraphFilter = {
  id: GraphLinkKind;
  label: string;
  tone: string;
  darkTone: string;
};

export type TimelineCategory =
  | "CALL"
  | "ARREST"
  | "EVIDENCE"
  | "CCTV"
  | "FORENSIC"
  | "ANALYSIS"
  | "LANDING"
  | "ATTACK"
  | "MOVEMENT"
  | "POLICE"
  | "RESPONSE"
  | "SECONDARY"
  | "CLEARANCE";

export type InvestigationTimelineEvent = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  date: string;
  time: string;
  sortOrder: number;
  timezone: string;
  category: TimelineCategory;
  title: string;
  description: string;
  severity: number;
  linkedEntityIds: string[];
  linkedLocationIds: string[];
};

export type InvestigationFact = SourceMetadata & {
  investigationId: InvestigationId;
  id: string;
  type:
    | "forensic"
    | "testimonial"
    | "documentary"
    | "timeline"
    | "legal-record"
    | "investigative";
  text: string;
  status: "verified" | "disputed" | "pending" | "demo";
  sourceTitle: string;
  linkedEntityIds: string[];
  linkedTimelineEventIds: string[];
  linkedLocationIds: string[];
};

export type Investigation = SourceMetadata & {
  id: InvestigationId;
  caseId: string;
  slug: InvestigationId;
  name: string;
  shortName: string;
  displayName: string;
  type: "DEMO" | "HISTORICAL";
  deskLabel: string;
  caseType: string;
  location: string;
  start: string;
  end: string;
  timezone: string;
  overallStatus: string;
  summary: string;
  badge: string;
  historicalNote?: string;
  verifiedTotals?: {
    attackersInvolved: number;
    attackersKilled: number;
    attackersCaptured: number;
    peopleKilled: number;
    peopleInjured: number;
    securityPersonnelKilled: number;
    foreignNationalsKilled: number;
  };
  map: {
    center: [number, number];
    zoom: number;
    boundsLabel: string;
    filterGroups: string[];
    locations: InvestigationLocation[];
    routes: InvestigationRoute[];
    densityNotice?: string;
  };
  graph: {
    nodes: InvestigationGraphNode[];
    links: InvestigationGraphLink[];
    filters: GraphFilter[];
  };
  timeline: {
    startDate: string;
    endDate: string;
    events: InvestigationTimelineEvent[];
  };
  casualtyLedger: CasualtyRecord[];
  facts: InvestigationFact[];
};
