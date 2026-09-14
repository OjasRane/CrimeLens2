import type {
  Investigation,
  InvestigationGraphLink,
  InvestigationGraphNode,
  InvestigationLocation,
  InvestigationTimelineEvent,
} from "@/data/investigations/types";

const DEMO_SOURCE = "CRIMELENS_ORIGINAL_DEMO_DATASET";
const demoMeta = {
  investigationId: "demo" as const,
  sourceRef: DEMO_SOURCE,
  timePrecision: "EXACT" as const,
  confidence: "DEMO" as const,
};

export const demoLocations: InvestigationLocation[] = [
  ["INC-001", "Burglary", "Station Locker Breach", "2026-07-18", "HIGH", -87.6285, 41.884, 8],
  ["INC-002", "Assault", "Alley Witness Report", "2026-07-18", "MED", -87.632, 41.879, 5],
  ["INC-003", "Fraud", "Ticket Ledger Mismatch", "2026-07-19", "LOW", -87.6231, 41.8822, 3],
  ["INC-004", "Robbery", "North Arcade Holdup", "2026-07-20", "HIGH", -87.6198, 41.8894, 7],
  ["INC-005", "Burglary", "Evidence Room Entry", "2026-07-20", "CRITICAL", -87.6142, 41.8757, 10],
  ["INC-006", "Assault", "Platform Stairwell Fight", "2026-07-21", "HIGH", -87.641, 41.8866, 8],
  ["INC-007", "Fraud", "Annex Deposit Forgery", "2026-07-22", "MED", -87.6367, 41.8921, 4],
  ["INC-008", "Arson", "Loading Dock Fire", "2026-07-22", "HIGH", -87.61, 41.8695, 9],
  ["INC-009", "Burglary", "Clerk Office Forced Entry", "2026-07-23", "MED", -87.6465, 41.8786, 6],
  ["INC-010", "Robbery", "Canal Street Bag Snatch", "2026-07-24", "MED", -87.6391, 41.8738, 5],
  ["INC-011", "Assault", "Transit Hall Battery", "2026-07-24", "CRITICAL", -87.6287, 41.875, 9],
  ["INC-012", "Fraud", "Counterfeit Transfer Book", "2026-07-25", "LOW", -87.6209, 41.8795, 3],
  ["INC-013", "Burglary", "Archive Cage Breach", "2026-07-25", "HIGH", -87.6173, 41.8838, 8],
  ["INC-014", "Arson", "Viaduct Accelerant Trace", "2026-07-26", "MED", -87.6501, 41.882, 6],
  ["INC-015", "Robbery", "Market Row Threat", "2026-07-26", "HIGH", -87.6338, 41.8905, 7],
  ["INC-016", "Assault", "Back-Lot Confrontation", "2026-07-27", "MED", -87.6117, 41.8724, 5],
  ["INC-017", "Burglary", "Tool Room Tamper", "2026-07-27", "LOW", -87.6261, 41.8912, 4],
  ["INC-018", "Fraud", "Signal Ledger Substitution", "2026-07-28", "HIGH", -87.6429, 41.8847, 7],
].map(([id, type, title, date, importance, longitude, latitude, intensity]) => ({
  ...demoMeta,
  id: id as string,
  title: title as string,
  type: type as string,
  filterGroups: [type as string],
  date: date as string,
  timeLabel: date as string,
  importance: importance as InvestigationLocation["importance"],
  coordinates: [longitude as number, latitude as number],
  coordinateStatus: "VERIFIED_LOCALITY",
  coordinateSourceRef: DEMO_SOURCE,
  intensity: intensity as number,
  description: title as string,
  linkedEntityIds: [],
  linkedTimelineEventIds: [],
}));

const demoGraphNodeRows: Array<
  Omit<
    InvestigationGraphNode,
    "investigationId" | "sourceRef" | "timePrecision" | "confidence"
  >
> = [
  { id: "sus-ada", label: "ADA CROSS", kind: "suspect", subtitle: "Station contractor", risk: "HIGH", position: { x: 70, y: 210 }, dateRange: ["2026-07-18", "2026-07-28"] },
  { id: "sus-marlowe", label: "JON MARLOWE", kind: "suspect", subtitle: "Night clerk", risk: "MED", position: { x: 520, y: 95 }, dateRange: ["2026-07-18", "2026-07-28"] },
  { id: "sus-vale", label: "MIRA VALE", kind: "suspect", subtitle: "Ticket auditor", risk: "LOW", position: { x: 535, y: 365 }, dateRange: ["2026-07-19", "2026-07-28"] },
  { id: "ev-ticket", label: "TORN TICKET", kind: "evidence", subtitle: "Recovered from coat", position: { x: 300, y: 210 }, dateRange: ["2026-07-18", "2026-07-19"] },
  { id: "ev-print", label: "ANNEX PRINT", kind: "evidence", subtitle: "Partial latent", position: { x: 720, y: 235 }, dateRange: ["2026-07-21", "2026-07-24"] },
  { id: "loc-platform", label: "PLATFORM 9", kind: "location", subtitle: "Victim last seen", position: { x: 185, y: 30 }, dateRange: ["2026-07-18", "2026-07-20"] },
  { id: "loc-annex", label: "ANNEX B", kind: "location", subtitle: "Locked service wing", position: { x: 790, y: 45 }, dateRange: ["2026-07-20", "2026-07-24"] },
  { id: "txn-ledger", label: "$4,800 LEDGER", kind: "transaction", subtitle: "Duplicate deposit", position: { x: 255, y: 410 }, dateRange: ["2026-07-19", "2026-07-25"] },
  { id: "txn-shell", label: "SHELL TRANSFER", kind: "transaction", subtitle: "Off-book routing", position: { x: 785, y: 415 }, dateRange: ["2026-07-22", "2026-07-26"] },
  { id: "loc-diner", label: "RIVER DINER", kind: "location", subtitle: "Shared cell ping", position: { x: 440, y: 515 }, dateRange: ["2026-07-24", "2026-07-27"] },
];

export const demoGraphNodes: InvestigationGraphNode[] = demoGraphNodeRows.map(
  (node) => ({ ...demoMeta, ...node }),
);

export const demoGraphLinks: InvestigationGraphLink[] = [
  ["ada-ticket-call", "sus-ada", "ev-ticket", "phone", "3 calls"],
  ["ada-platform-colocation", "sus-ada", "loc-platform", "colocation", "21:14 ping"],
  ["ada-ledger-financial", "sus-ada", "txn-ledger", "financial", "$1,200"],
  ["ticket-marlowe-call", "ev-ticket", "sus-marlowe", "phone", "voicemail"],
  ["marlowe-annex-colocation", "sus-marlowe", "loc-annex", "colocation", "badge echo"],
  ["marlowe-print-colocation", "sus-marlowe", "ev-print", "colocation", "print match"],
  ["vale-ledger-financial", "sus-vale", "txn-ledger", "financial", "$4,800"],
  ["vale-shell-financial", "sus-vale", "txn-shell", "financial", "routing"],
  ["vale-diner-call", "sus-vale", "loc-diner", "phone", "burner ping"],
  ["diner-ada-colocation", "loc-diner", "sus-ada", "colocation", "same booth"],
  ["shell-print-financial", "txn-shell", "ev-print", "financial", "invoice"],
  ["platform-ticket-colocation", "loc-platform", "ev-ticket", "colocation", "drop site"],
].map(([id, source, target, linkKind, label]) => ({
  ...demoMeta,
  id: id as string,
  source: source as string,
  target: target as string,
  linkKind: linkKind as InvestigationGraphLink["linkKind"],
  label: label as string,
}));

const demoEventRows: Array<[string, string, string, string, InvestigationTimelineEvent["category"], string, string, number]> = [
  ["TL-001", "2026-07-18", "21:14", "1", "CCTV", "Victim enters station", "Platform 9 camera captures victim at 21:14. Last confirmed sighting.", 9],
  ["TL-002", "2026-07-18", "21:32", "2", "CALL", "Anonymous tip received", "Switchboard logs anonymous call referencing Platform 9 disturbance.", 6],
  ["TL-003", "2026-07-18", "22:05", "3", "EVIDENCE", "Ticket stub recovered", "Torn ticket stub found in inner coat pocket during initial sweep.", 7],
  ["TL-004", "2026-07-19", "08:30", "4", "FORENSIC", "Ticket ledger mismatch", "Morning audit reveals ledger discrepancy — three entries lack counterfoils.", 5],
  ["TL-005", "2026-07-20", "01:15", "5", "CCTV", "Night clerk second visitor", "CCTV corroborates clerk testimony: unidentified visitor at 01:15.", 8],
  ["TL-006", "2026-07-20", "02:40", "6", "CALL", "Clerk reports break-in attempt", "Night clerk dials emergency line reporting forced entry at Annex B.", 7],
  ["TL-007", "2026-07-20", "06:10", "7", "ARREST", "Suspect A detained", "Individual matching description apprehended near loading dock.", 9],
  ["TL-008", "2026-07-20", "11:00", "8", "EVIDENCE", "Evidence room entry log", "Critical evidence room shows unauthorized access at 04:47.", 10],
  ["TL-009", "2026-07-21", "14:20", "9", "FORENSIC", "Partial print from Annex B", "Latent print recovered from forced door handle. Partial match pending.", 8],
  ["TL-010", "2026-07-22", "09:00", "10", "ANALYSIS", "Cross-reference initiated", "Analyst begins cross-referencing ledger anomalies with CCTV timestamps.", 4],
  ["TL-011", "2026-07-24", "16:35", "11", "ARREST", "Suspect B identified", "Second suspect identified through partial print match. Warrant issued.", 9],
  ["TL-012", "2026-07-24", "17:10", "12", "CALL", "Informant tip — Canal St.", "Registered informant provides location intel on Suspect B.", 7],
  ["TL-013", "2026-07-24", "19:45", "13", "ARREST", "Suspect B apprehended", "Suspect B taken into custody at Canal Street Market without incident.", 10],
  ["TL-014", "2026-07-25", "10:00", "14", "FORENSIC", "Accelerant trace confirmed", "Lab confirms petroleum-based accelerant on loading dock samples.", 6],
  ["TL-015", "2026-07-25", "15:30", "15", "EVIDENCE", "Archive cage breach evidence", "Cut lock recovered; tool marks consistent with compact bolt cutter.", 7],
  ["TL-016", "2026-07-26", "08:15", "16", "ANALYSIS", "Pattern link established", "Analyst connects three incidents to single MO. Crime spree hypothesis elevated.", 8],
  ["TL-017", "2026-07-27", "12:00", "17", "FORENSIC", "DNA sample submitted", "Biological sample from ticket stub sent for expedited DNA analysis.", 7],
  ["TL-018", "2026-07-28", "09:30", "18", "ANALYSIS", "Cross-case link promoted", "Three-case connection promoted from hypothesis to active lead.", 9],
];

export const demoTimelineEvents: InvestigationTimelineEvent[] = demoEventRows.map(
  ([id, date, time, sortOrder, category, title, description, severity]) => ({
    ...demoMeta,
    id,
    date,
    time,
    sortOrder: Number(sortOrder),
    timezone: "America/Chicago",
    category,
    title,
    description,
    severity,
    linkedEntityIds: [],
    linkedLocationIds: [],
  }),
);

export const demoInvestigation: Investigation = {
  id: "demo",
  caseId: "DEMO-001",
  slug: "demo",
  name: "Demo Case",
  shortName: "DEMO CASE",
  displayName: "The Fatal Ledger",
  type: "DEMO",
  deskLabel: "Case Desk / Hackathon Edition",
  caseType: "FICTIONAL INVESTIGATION",
  location: "Chicago, Illinois",
  start: "2026-07-18",
  end: "2026-07-28",
  timezone: "America/Chicago",
  overallStatus: "ACTIVE DEMONSTRATION",
  summary: "Original CrimeLens fictional demonstration investigation.",
  badge: "DEMO DATA",
  sourceRef: DEMO_SOURCE,
  timePrecision: "EXACT",
  confidence: "DEMO",
  map: {
    center: [-87.6298, 41.8818],
    zoom: 12.7,
    boundsLabel: "CHICAGO",
    filterGroups: ["Burglary", "Assault", "Fraud", "Robbery", "Arson"],
    locations: demoLocations,
    routes: [],
  },
  graph: {
    nodes: demoGraphNodes,
    links: demoGraphLinks,
    filters: [
      { id: "financial", label: "Financial Transactions", tone: "#D22B2B", darkTone: "#AEC3B0" },
      { id: "phone", label: "Phone Calls", tone: "#111111", darkTone: "#EFF6E0" },
      { id: "colocation", label: "Co-Locations", tone: "#FCD34D", darkTone: "#598392" },
    ],
  },
  timeline: {
    startDate: "2026-07-18",
    endDate: "2026-07-28",
    events: demoTimelineEvents,
  },
  casualtyLedger: [],
  facts: [
    { ...demoMeta, id: "fact-001", type: "forensic", text: "The victim entered the station at 21:14 and never appeared on the northbound camera.", status: "verified", sourceTitle: "CrimeLens Demo Record", linkedEntityIds: [], linkedTimelineEventIds: ["TL-001"], linkedLocationIds: ["loc-platform"] },
    { ...demoMeta, id: "fact-002", type: "forensic", text: "A torn ticket stub was recovered from the inner coat pocket.", status: "pending", sourceTitle: "CrimeLens Demo Record", linkedEntityIds: ["ev-ticket"], linkedTimelineEventIds: ["TL-003"], linkedLocationIds: [] },
    { ...demoMeta, id: "fact-003", type: "testimonial", text: "The night clerk claims a second visitor arrived fifteen minutes after closing.", status: "disputed", sourceTitle: "CrimeLens Demo Record", linkedEntityIds: ["sus-marlowe"], linkedTimelineEventIds: ["TL-005"], linkedLocationIds: [] },
    { ...demoMeta, id: "fact-004", type: "testimonial", text: "The ledger clock differs from station time by seven minutes.", status: "pending", sourceTitle: "CrimeLens Demo Record", linkedEntityIds: ["txn-ledger"], linkedTimelineEventIds: ["TL-004"], linkedLocationIds: [] },
  ],
};
