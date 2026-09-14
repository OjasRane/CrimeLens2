import type {
  CasualtyRecord,
  GraphLinkKind,
  GraphNodeKind,
  Investigation,
  InvestigationFact,
  InvestigationGraphLink,
  InvestigationGraphNode,
  InvestigationLocation,
  InvestigationRoute,
  InvestigationTimelineEvent,
  TimePrecision,
  Confidence,
  TimelineCategory,
} from "@/data/investigations/types";

export const SUPREME_COURT_SOURCE =
  "https://indiankanoon.org/doc/193792759/";
export const DOJ_HEADLEY_SOURCE =
  "https://www.justice.gov/usao-ndil/pr/david-coleman-headley-sentenced-35-years-prison-role-india-and-denmark-terror-plots";

const OSM = "https://www.openstreetmap.org";
const MCGM_BADHWAR_SOURCE =
  "https://portal.mcgm.gov.in/irj/go/km/docs/documents/Tenders/ETH/ETH_7000008779_311221.pdf";

function sourceMeta(
  timePrecision: TimePrecision = "NOT_APPLICABLE",
  sourceRef = SUPREME_COURT_SOURCE,
  confidence: Confidence = "VERIFIED",
) {
  return {
    investigationId: "mumbai-2611" as const,
    sourceRef,
    timePrecision,
    confidence,
  };
}

function location(
  value: Omit<InvestigationLocation, keyof ReturnType<typeof sourceMeta>>,
  precision: TimePrecision = "APPROX",
): InvestigationLocation {
  return { ...sourceMeta(precision), ...value };
}

const locations: InvestigationLocation[] = [
  location({
    id: "loc-nariman-point-arrival",
    title: "NARIMAN POINT WATERFRONT",
    type: "LANDING / MOVEMENT",
    filterGroups: ["LANDING / MOVEMENT"],
    date: "2008-11-26",
    timeLabel: "LATE EVENING",
    importance: "HIGH",
    coordinates: [72.8195, 18.9269],
    coordinateStatus: "NEEDS_VERIFICATION",
    intensity: 1,
    description:
      "General Nariman Point waterfront movement marker for Team 05. It is not presented as an exact landing coordinate.",
    assignedTeam: "FAHADULLAH + ABDUL RAHMAN ‘CHHOTA’ @ SAQIB",
    linkedEntityIds: ["attacker-fahadullah", "attacker-chhota"],
    linkedTimelineEventIds: [],
  }, "WINDOW"),
  location({
    id: "loc-badhwar",
    title: "BADHWAR PARK",
    expandedName: "Badhwar Park / Machhimar Nagar, Cuffe Parade",
    type: "LANDING",
    filterGroups: ["LANDING / MOVEMENT"],
    date: "2008-11-26",
    timeLabel: "≈ 21:15–21:30 IST",
    importance: "CRITICAL",
    coordinates: [72.825489, 18.918783],
    coordinateStatus: "VERIFIED_LOCALITY",
    coordinateSourceRef: MCGM_BADHWAR_SOURCE,
    intensity: 1,
    description:
      "Documented landing area used by the attack group on the evening of 26 November 2008.",
    assignedTeam: "ALL FIVE TEAMS",
    killed: 0,
    injured: 0,
    graphNodeId: "loc-badhwar",
    linkedEntityIds: [
      "attacker-kasab",
      "attacker-ismail",
      "attacker-imran",
      "attacker-nasir",
      "attacker-nazir",
      "attacker-bada",
      "attacker-chhota",
      "attacker-fahadullah",
      "attacker-javed",
      "attacker-shoaib",
    ],
    linkedTimelineEventIds: ["MUM-TL-001"],
  }, "WINDOW"),
  location({
    id: "loc-cst",
    title: "CST",
    expandedName: "Chhatrapati Shivaji Terminus",
    type: "PRIMARY ATTACK SITE",
    filterGroups: ["PRIMARY ATTACK SITES"],
    date: "2008-11-26",
    timeLabel: "≈ 21:55 IST",
    importance: "CRITICAL",
    coordinates: [72.8355191, 18.939856],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/107441516`,
    intensity: 161,
    description:
      "The Supreme Court judgment records 52 people killed and 109 injured at CST.",
    assignedTeam: "AJMAL AMIR KASAB + ABU ISMAIL",
    killed: 52,
    injured: 109,
    graphNodeId: "loc-cst",
    linkedEntityIds: ["attacker-kasab", "attacker-ismail"],
    linkedTimelineEventIds: ["MUM-TL-006"],
  }),
  location({
    id: "loc-cama",
    title: "CAMA HOSPITAL",
    expandedName: "Cama & Albless Hospital / surrounding area",
    type: "ATTACK / POLICE RESPONSE SITE",
    filterGroups: ["POLICE RESPONSE"],
    date: "2008-11-26",
    timeLabel: "≈ 22:30–23:45 IST",
    importance: "CRITICAL",
    coordinates: [72.8318285, 18.9424375],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/207376648`,
    intensity: 33,
    description:
      "The court record separates the incident into CAMA_IN and CAMA_OUT phases.",
    assignedTeam: "AJMAL AMIR KASAB + ABU ISMAIL",
    killed: 16,
    injured: 17,
    casualtyBreakdown: [
      { id: "CAMA_IN", label: "CAMA_IN", killed: 7, injured: 10 },
      { id: "CAMA_OUT", label: "CAMA_OUT", killed: 9, injured: 7 },
    ],
    graphNodeId: "loc-cama",
    linkedEntityIds: ["attacker-kasab", "attacker-ismail"],
    linkedTimelineEventIds: ["MUM-TL-007", "MUM-TL-010"],
  }, "WINDOW"),
  location({
    id: "loc-leopold",
    title: "LEOPOLD CAFÉ",
    type: "PRIMARY ATTACK SITE",
    filterGroups: ["PRIMARY ATTACK SITES"],
    date: "2008-11-26",
    timeLabel: "LATE EVENING",
    importance: "CRITICAL",
    coordinates: [72.831763, 18.9227115],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/40387597`,
    intensity: 39,
    description:
      "The Supreme Court judgment records 11 people killed and 28 injured at Leopold Café.",
    assignedTeam: "NAZIR AHMAD @ ABU OMAIR + SHOAIB @ ABU SOHEB",
    killed: 11,
    injured: 28,
    graphNodeId: "loc-leopold",
    linkedEntityIds: ["attacker-nazir", "attacker-shoaib"],
    linkedTimelineEventIds: ["MUM-TL-003"],
  }, "WINDOW"),
  location({
    id: "loc-taj",
    title: "TAJ MAHAL PALACE",
    type: "PRIMARY ATTACK SITE",
    filterGroups: ["PRIMARY ATTACK SITES", "CLEARANCE EVENTS"],
    date: "2008-11-26",
    timeLabel: "LATE EVENING // CLEARANCE ≈ 29 NOV 09:00",
    importance: "CRITICAL",
    coordinates: [72.8332848, 18.921778],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/28846517`,
    intensity: 66,
    description:
      "The Supreme Court judgment records 36 people killed and 30 injured at the Taj.",
    assignedTeam:
      "ABDUL RAHMAN ‘BADA’ @ HAJAZI + JAVED @ ABU ALI; NAZIR AHMAD @ ABU OMAIR + SHOAIB @ ABU SOHEB AFTER LEOPOLD",
    killed: 36,
    injured: 30,
    clearance: "29 NOV 2008 ≈ 09:00 IST",
    graphNodeId: "loc-taj",
    linkedEntityIds: [
      "attacker-bada",
      "attacker-javed",
      "attacker-nazir",
      "attacker-shoaib",
    ],
    linkedTimelineEventIds: ["MUM-TL-004", "MUM-TL-015"],
  }, "WINDOW"),
  location({
    id: "loc-nariman",
    title: "NARIMAN HOUSE",
    alternativeLabel: "CHABAD HOUSE",
    type: "PRIMARY ATTACK SITE",
    filterGroups: ["PRIMARY ATTACK SITES", "CLEARANCE EVENTS"],
    date: "2008-11-26",
    timeLabel: "≈ 21:45 ONWARD // CLEARANCE NIGHT OF 28 NOV",
    importance: "CRITICAL",
    coordinates: [72.8276113, 18.9164614],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/353758579`,
    intensity: 16,
    description:
      "The Supreme Court judgment records 9 people killed and 7 injured at Nariman House.",
    assignedTeam: "IMRAN BABAR @ ABU AQSA + NASIR @ ABU UMAR",
    killed: 9,
    injured: 7,
    clearance: "NIGHT OF 28 NOV 2008",
    graphNodeId: "loc-nariman",
    linkedEntityIds: ["attacker-imran", "attacker-nasir"],
    linkedTimelineEventIds: ["MUM-TL-002", "MUM-TL-014"],
  }, "WINDOW"),
  location({
    id: "loc-oberoi",
    title: "OBEROI / TRIDENT",
    expandedName: "Oberoi / Trident, Nariman Point",
    type: "PRIMARY ATTACK SITE",
    filterGroups: ["PRIMARY ATTACK SITES", "CLEARANCE EVENTS"],
    date: "2008-11-26",
    timeLabel: "≈ 21:55 IST // CLEARANCE ≈ 28 NOV 07:00",
    importance: "CRITICAL",
    coordinates: [72.8211257, 18.9278382],
    coordinateStatus: "VERIFIED_VENUE",
    coordinateSourceRef: `${OSM}/way/753875938`,
    intensity: 59,
    description:
      "The Supreme Court judgment records 35 people killed and 24 injured at the Oberoi / Trident.",
    assignedTeam: "FAHADULLAH + ABDUL RAHMAN ‘CHHOTA’ @ SAQIB",
    killed: 35,
    injured: 24,
    clearance: "28 NOV 2008 ≈ 07:00 IST",
    graphNodeId: "loc-oberoi",
    linkedEntityIds: ["attacker-fahadullah", "attacker-chhota"],
    linkedTimelineEventIds: ["MUM-TL-005", "MUM-TL-013"],
  }),
  location({
    id: "loc-girgaum",
    title: "GIRGAUM CHOWPATTY",
    alternativeLabel: "VINOLI CHOWPATTY",
    type: "POLICE INTERCEPTION",
    filterGroups: ["POLICE RESPONSE"],
    date: "2008-11-27",
    timeLabel: "≈ 00:30 IST",
    importance: "CRITICAL",
    coordinates: [72.81142, 18.95439],
    coordinateStatus: "VERIFIED_LOCALITY",
    coordinateSourceRef: `${OSM}/way/38718382`,
    intensity: 2,
    description:
      "Police intercepted the vehicle; Ajmal Amir Kasab was captured and Abu Ismail was killed. ASI Tukaram Ombale was killed in the incident.",
    assignedTeam: "AJMAL AMIR KASAB + ABU ISMAIL",
    killed: 1,
    injured: 1,
    graphNodeId: "loc-girgaum",
    linkedEntityIds: [
      "attacker-kasab",
      "attacker-ismail",
      "response-mumbai-police",
    ],
    linkedTimelineEventIds: ["MUM-TL-012"],
  }),
  location({
    id: "loc-mazgaon",
    title: "WADI BUNDER / MAZGAON",
    type: "SECONDARY INCIDENT",
    filterGroups: ["SECONDARY INCIDENTS"],
    date: "2008-11-26",
    timeLabel: "≈ 22:30 IST",
    importance: "HIGH",
    coordinates: [72.8454387, 18.9657144],
    coordinateStatus: "VERIFIED_LOCALITY",
    coordinateSourceRef: `${OSM}/node/13522505114`,
    intensity: 22,
    description:
      "Secondary incident recorded in the Wadi Bunder Road / Mazgaon area. Marker is at the verified Wadi Bunder locality.",
    killed: 3,
    injured: 19,
    graphNodeId: "loc-mazgaon",
    linkedEntityIds: [],
    linkedTimelineEventIds: ["MUM-TL-008"],
  }),
  location({
    id: "loc-vile-parle",
    title: "VILE PARLE EAST",
    type: "SECONDARY INCIDENT",
    filterGroups: ["SECONDARY INCIDENTS"],
    date: "2008-11-26",
    timeLabel: "> 22:45 IST",
    importance: "HIGH",
    coordinates: [72.8445616, 19.1007285],
    coordinateStatus: "VERIFIED_LOCALITY",
    coordinateSourceRef: `${OSM}/node/10267208087`,
    intensity: 5,
    description:
      "Secondary incident shortly after 22:45. Marker is the verified Vile Parle East locality, not a claimed exact incident point.",
    killed: 2,
    injured: 3,
    graphNodeId: "loc-vile-parle",
    linkedEntityIds: [],
    linkedTimelineEventIds: ["MUM-TL-009"],
  }),
  location({
    id: "loc-kuber",
    title: "KUBER / PRE-ATTACK MARITIME CASE",
    type: "EVIDENCE",
    filterGroups: ["LANDING / MOVEMENT"],
    date: "2008-11-26",
    timeLabel: "PRE-ATTACK",
    importance: "HIGH",
    coordinateStatus: "NEEDS_VERIFICATION",
    intensity: 1,
    description:
      "Included in the verified casualty ledger. No map coordinate is asserted for this record.",
    killed: 1,
    injured: 0,
    graphNodeId: "evidence-kuber",
    linkedEntityIds: [],
    linkedTimelineEventIds: [],
  }, "WINDOW"),
];

const routes: InvestigationRoute[] = [
  ["route-team-01", "TEAM 01", "AJMAL AMIR KASAB + ABU ISMAIL", ["attacker-kasab", "attacker-ismail"], ["loc-badhwar", "loc-cst", "loc-cama", "loc-girgaum"], "Badhwar Park → CST → Cama Hospital area → South Mumbai movement → Girgaum Chowpatty"],
  ["route-team-02", "TEAM 02", "NAZIR AHMAD @ ABU OMAIR + SHOAIB @ ABU SOHEB", ["attacker-nazir", "attacker-shoaib"], ["loc-badhwar", "loc-leopold", "loc-taj"], "Badhwar Park → Leopold Café → Taj Mahal Palace"],
  ["route-team-03", "TEAM 03", "ABDUL RAHMAN ‘BADA’ @ HAJAZI + JAVED @ ABU ALI", ["attacker-bada", "attacker-javed"], ["loc-badhwar", "loc-taj"], "Badhwar Park → Taj Mahal Palace"],
  ["route-team-04", "TEAM 04", "IMRAN BABAR @ ABU AQSA + NASIR @ ABU UMAR", ["attacker-imran", "attacker-nasir"], ["loc-badhwar", "loc-nariman"], "Badhwar Park → Nariman House"],
  ["route-team-05", "TEAM 05", "FAHADULLAH + ABDUL RAHMAN ‘CHHOTA’ @ SAQIB", ["attacker-fahadullah", "attacker-chhota"], ["loc-nariman-point-arrival", "loc-oberoi"], "Mumbai waterfront arrival → Nariman Point → Oberoi / Trident"],
].map(([id, label, teamLabel, memberEntityIds, locationIds, description]) => ({
  ...sourceMeta("WINDOW"),
  id: id as string,
  label: label as string,
  teamLabel: teamLabel as string,
  memberEntityIds: memberEntityIds as string[],
  locationIds: locationIds as string[],
  description: description as string,
}));

function graphNode(
  id: string,
  label: string,
  kind: GraphNodeKind,
  subtitle: string,
  status: string | undefined,
  x: number,
  y: number,
  sourceRef = SUPREME_COURT_SOURCE,
): InvestigationGraphNode {
  return {
    ...sourceMeta("NOT_APPLICABLE", sourceRef),
    id,
    label,
    kind,
    subtitle,
    status,
    position: { x, y },
    dateRange: ["2008-11-26", "2008-11-29"],
  };
}

const attackerNodes: InvestigationGraphNode[] = [
  graphNode("attacker-kasab", "AJMAL AMIR KASAB", "attacker", "Team 01", "CAPTURED", 80, 130),
  graphNode("attacker-ismail", "ABU ISMAIL", "attacker", "Team 01", "DECEASED", 80, 310),
  graphNode("attacker-nazir", "NAZIR AHMAD @ ABU OMAIR", "attacker", "Team 02", "DECEASED", 80, 500),
  graphNode("attacker-shoaib", "SHOAIB @ ABU SOHEB", "attacker", "Team 02", "DECEASED", 80, 680),
  graphNode("attacker-bada", "ABDUL RAHMAN ‘BADA’ @ HAJAZI", "attacker", "Team 03", "DECEASED", 360, 70),
  graphNode("attacker-javed", "JAVED @ ABU ALI", "attacker", "Team 03", "DECEASED", 360, 250),
  graphNode("attacker-imran", "IMRAN BABAR @ ABU AQSA", "attacker", "Team 04", "DECEASED", 360, 430),
  graphNode("attacker-nasir", "NASIR @ ABU UMAR", "attacker", "Team 04", "DECEASED", 360, 610),
  graphNode("attacker-fahadullah", "FAHADULLAH", "attacker", "Team 05", "DECEASED", 360, 790),
  graphNode("attacker-chhota", "ABDUL RAHMAN ‘CHHOTA’ @ SAQIB", "attacker", "Team 05", "DECEASED", 80, 860),
];

const teamNodeSubtitles: Record<string, string> = {
  "route-team-01": "KASAB + ABU ISMAIL",
  "route-team-02": "NAZIR AHMAD + SHOAIB",
  "route-team-03": "A.R. ‘BADA’ + JAVED",
  "route-team-04": "IMRAN BABAR + NASIR",
  "route-team-05": "FAHADULLAH + A.R. ‘CHHOTA’",
};

const teamNodes: InvestigationGraphNode[] = routes.map((route, index) =>
  graphNode(
    route.id.replace("route-", ""),
    route.label,
    "team",
    teamNodeSubtitles[route.id],
    "2 MEMBERS",
    420,
    120 + index * 170,
  ),
);

const graphNodes: InvestigationGraphNode[] = [
  ...teamNodes,
  ...attackerNodes,
  graphNode("org-let", "LASHKAR-E-TAIBA", "organization", "Organization responsible / training & planning connection", "ORGANIZATION", 650, 20, DOJ_HEADLEY_SOURCE),
  { ...graphNode("planner-headley", "DAVID COLEMAN HEADLEY", "planner", "Pre-attack surveillance / planning", "PLEADED GUILTY IN U.S.", 930, 20, DOJ_HEADLEY_SOURCE), dateRange: ["2006-09-01", "2008-11-26"] },
  graphNode("loc-badhwar", "BADHWAR PARK", "location", "Landing area", undefined, 650, 200),
  graphNode("loc-cst", "CST", "location", "52 killed / 109 injured", undefined, 930, 170),
  graphNode("loc-cama", "CAMA HOSPITAL", "location", "CAMA_IN + CAMA_OUT", undefined, 1200, 170),
  graphNode("loc-girgaum", "GIRGAUM CHOWPATTY", "location", "Police interception", undefined, 1470, 170),
  graphNode("loc-leopold", "LEOPOLD CAFÉ", "location", "11 killed / 28 injured", undefined, 650, 400),
  graphNode("loc-taj", "TAJ MAHAL PALACE", "location", "36 killed / 30 injured", undefined, 930, 400),
  graphNode("loc-nariman", "NARIMAN HOUSE", "location", "9 killed / 7 injured", undefined, 1200, 400),
  graphNode("loc-oberoi", "OBEROI / TRIDENT", "location", "35 killed / 24 injured", undefined, 1470, 400),
  graphNode("response-mumbai-police", "MUMBAI POLICE RESPONSE", "response", "Girgaum Chowpatty interception", "DOCUMENTED RESPONSE", 1200, 650),
  graphNode("evidence-judgment", "SUPREME COURT JUDGMENT", "evidence", "Kasab v. State of Maharashtra / 29 Aug 2012", "SOURCE RECORD", 1470, 650),
];

function graphLink(
  id: string,
  source: string,
  target: string,
  linkKind: GraphLinkKind,
  label: string,
  sourceRef = SUPREME_COURT_SOURCE,
): InvestigationGraphLink {
  return {
    ...sourceMeta("NOT_APPLICABLE", sourceRef),
    id,
    source,
    target,
    linkKind,
    label,
  };
}

const teamLinks = routes.flatMap((route) => {
  const teamId = route.id.replace("route-", "");

  return [
    graphLink(`org-${teamId}`, "org-let", teamId, "team", "TEAM STRUCTURE", DOJ_HEADLEY_SOURCE),
    ...route.memberEntityIds.map((memberId, index) =>
      graphLink(`${teamId}-member-${index + 1}`, teamId, memberId, "team", "TEAM MEMBER"),
    ),
    graphLink(
      `${teamId}-primary-location`,
      teamId,
      route.locationIds.find((locationId) => locationId !== "loc-badhwar" && locationId !== "loc-nariman-point-arrival") ?? route.locationIds[0],
      "target",
      "ASSIGNED LOCATION",
    ),
  ];
});

const targetLinks: InvestigationGraphLink[] = [
  ["attacker-kasab", "loc-cst"], ["attacker-ismail", "loc-cst"],
  ["attacker-kasab", "loc-cama"], ["attacker-ismail", "loc-cama"],
  ["attacker-kasab", "loc-girgaum"], ["attacker-ismail", "loc-girgaum"],
  ["attacker-nazir", "loc-leopold"], ["attacker-shoaib", "loc-leopold"],
  ["attacker-nazir", "loc-taj"], ["attacker-shoaib", "loc-taj"],
  ["attacker-bada", "loc-taj"], ["attacker-javed", "loc-taj"],
  ["attacker-imran", "loc-nariman"], ["attacker-nasir", "loc-nariman"],
  ["attacker-fahadullah", "loc-oberoi"], ["attacker-chhota", "loc-oberoi"],
].map(([source, target], index) =>
  graphLink(`target-${index + 1}`, source, target, "target", "LOCATION LINK"),
);

const graphLinks: InvestigationGraphLink[] = [
  ...teamLinks,
  ...targetLinks,
  graphLink("headley-let", "planner-headley", "org-let", "planning", "ASSOCIATED WITH", DOJ_HEADLEY_SOURCE),
  ...["loc-cst", "loc-leopold", "loc-taj", "loc-nariman", "loc-oberoi"].map((target, index) =>
    graphLink(`headley-target-${index + 1}`, "planner-headley", target, "planning", "PRE-ATTACK SURVEILLANCE", DOJ_HEADLEY_SOURCE),
  ),
  graphLink("response-girgaum", "response-mumbai-police", "loc-girgaum", "response", "POLICE RESPONSE"),
  graphLink("judgment-response", "evidence-judgment", "response-mumbai-police", "response", "LEGAL RECORD"),
  ...["loc-cst", "loc-cama", "loc-girgaum", "loc-leopold", "loc-taj", "loc-nariman", "loc-oberoi"].map((target, index) =>
    graphLink(`judgment-location-${index + 1}`, "evidence-judgment", target, "evidence", "VERIFIED LEGAL SOURCE"),
  ),
  graphLink("move-01-a", "loc-badhwar", "loc-cst", "movement", "TEAM 01"),
  graphLink("move-01-b", "loc-cst", "loc-cama", "movement", "TEAM 01"),
  graphLink("move-01-c", "loc-cama", "loc-girgaum", "movement", "TEAM 01"),
  graphLink("move-02-a", "loc-badhwar", "loc-leopold", "movement", "TEAM 02"),
  graphLink("move-02-b", "loc-leopold", "loc-taj", "movement", "TEAM 02"),
  graphLink("move-03", "loc-badhwar", "loc-taj", "movement", "TEAM 03"),
  graphLink("move-04", "loc-badhwar", "loc-nariman", "movement", "TEAM 04"),
  graphLink("move-05", "loc-badhwar", "loc-oberoi", "movement", "TEAM 05"),
];

function timelineEvent(
  id: string,
  date: string,
  time: string,
  sortOrder: number,
  category: TimelineCategory,
  title: string,
  description: string,
  precision: TimePrecision,
  linkedEntityIds: string[],
  linkedLocationIds: string[],
  severity: number,
): InvestigationTimelineEvent {
  return {
    ...sourceMeta(precision),
    id,
    date,
    time,
    sortOrder,
    timezone: "Asia/Kolkata",
    category,
    title,
    description,
    severity,
    linkedEntityIds,
    linkedLocationIds,
  };
}

const timelineEvents: InvestigationTimelineEvent[] = [
  timelineEvent("MUM-TL-001", "2008-11-26", "≈ 21:15–21:30", 1, "LANDING", "Attack group reaches the Mumbai shore", "The group reaches the documented landing area at Badhwar Park.", "WINDOW", attackerNodes.map((node) => node.id), ["loc-badhwar"], 9),
  timelineEvent("MUM-TL-002", "2008-11-26", "≈ 21:45 ONWARD", 2, "ATTACK", "Nariman House incident underway", "A witness in the Supreme Court record encountered an attacker inside Nariman House at about 21:45.", "APPROX", ["attacker-imran", "attacker-nasir"], ["loc-nariman"], 9),
  timelineEvent("MUM-TL-003", "2008-11-26", "LATE EVENING", 3, "ATTACK", "Leopold Café incident", "The two attackers subsequently moved to the Taj Mahal Palace.", "WINDOW", ["attacker-nazir", "attacker-shoaib"], ["loc-leopold", "loc-taj"], 9),
  timelineEvent("MUM-TL-004", "2008-11-26", "LATE EVENING", 4, "ATTACK", "Taj Mahal Palace incident underway", "The incident at the Taj was underway during the late evening of 26 November.", "WINDOW", ["attacker-bada", "attacker-javed", "attacker-nazir", "attacker-shoaib"], ["loc-taj"], 10),
  timelineEvent("MUM-TL-005", "2008-11-26", "≈ 21:55", 5, "ATTACK", "Oberoi / Trident incident begins", "The Supreme Court judgment records entry at about 21:55.", "APPROX", ["attacker-fahadullah", "attacker-chhota"], ["loc-oberoi"], 10),
  timelineEvent("MUM-TL-006", "2008-11-26", "≈ 21:55", 6, "ATTACK", "CST incident underway", "A witness in the court record heard the first major explosion at approximately 21:55.", "APPROX", ["attacker-kasab", "attacker-ismail"], ["loc-cst"], 10),
  timelineEvent("MUM-TL-007", "2008-11-26", "≈ 22:30", 7, "MOVEMENT", "Kasab and Abu Ismail reach the Cama Hospital area", "Documented movement after leaving CST.", "APPROX", ["attacker-kasab", "attacker-ismail"], ["loc-cst", "loc-cama"], 8),
  timelineEvent("MUM-TL-008", "2008-11-26", "≈ 22:30", 8, "SECONDARY", "Mazgaon / Wadi Bunder secondary incident", "Secondary incident recorded in the Wadi Bunder Road / Mazgaon area.", "APPROX", [], ["loc-mazgaon"], 8),
  timelineEvent("MUM-TL-009", "2008-11-26", "> 22:45", 9, "SECONDARY", "Vile Parle East secondary incident", "The court record places this incident shortly after 22:45.", "APPROX", [], ["loc-vile-parle"], 7),
  timelineEvent("MUM-TL-010", "2008-11-26", "≈ 23:45", 10, "MOVEMENT", "Kasab and Abu Ismail emerge from the Cama Hospital area", "Documented movement from the Cama Hospital area.", "APPROX", ["attacker-kasab", "attacker-ismail"], ["loc-cama"], 8),
  timelineEvent("MUM-TL-011", "2008-11-27", "≈ 00:15", 11, "MOVEMENT", "Vehicle taken near Nariman Point / Vidhan Sabha area", "The Supreme Court judgment records the sequence at approximately 00:15.", "APPROX", ["attacker-kasab", "attacker-ismail"], [], 8),
  timelineEvent("MUM-TL-012", "2008-11-27", "≈ 00:30", 12, "POLICE", "Police interception at Girgaum Chowpatty", "Ajmal Amir Kasab was captured alive and Abu Ismail was killed during the documented police interception.", "APPROX", ["attacker-kasab", "attacker-ismail", "response-mumbai-police"], ["loc-girgaum"], 10),
  timelineEvent("MUM-TL-013", "2008-11-28", "≈ 07:00", 13, "CLEARANCE", "Oberoi / Trident operation concludes", "The Supreme Court judgment records the final clearance at about 07:00 on 28 November.", "APPROX", ["attacker-fahadullah", "attacker-chhota"], ["loc-oberoi"], 9),
  timelineEvent("MUM-TL-014", "2008-11-28", "NIGHT", 14, "CLEARANCE", "Nariman House operation concludes", "The operation concluded during the night of 28 November.", "WINDOW", ["attacker-imran", "attacker-nasir"], ["loc-nariman"], 9),
  timelineEvent("MUM-TL-015", "2008-11-29", "≈ 09:00", 15, "CLEARANCE", "Taj Mahal Palace operation concludes", "The final clearance at the Taj marks the end of the attack period in this case reconstruction.", "APPROX", ["attacker-bada", "attacker-javed", "attacker-nazir", "attacker-shoaib"], ["loc-taj"], 10),
];

const casualtyLedger: CasualtyRecord[] = [
  ["cas-kuber", "loc-kuber", "KUBER / PRE-ATTACK MARITIME CASE", 1, 0],
  ["cas-cst", "loc-cst", "CST", 52, 109],
  ["cas-cama-in", "loc-cama", "CAMA_IN", 7, 10],
  ["cas-cama-out", "loc-cama", "CAMA_OUT", 9, 7],
  ["cas-girgaum", "loc-girgaum", "GIRGAUM / VINOLI CHOWPATTY", 1, 1],
  ["cas-vile-parle", "loc-vile-parle", "VILE PARLE", 2, 3],
  ["cas-leopold", "loc-leopold", "LEOPOLD", 11, 28],
  ["cas-mazgaon", "loc-mazgaon", "MAZGAON", 3, 19],
  ["cas-taj", "loc-taj", "TAJ", 36, 30],
  ["cas-nariman", "loc-nariman", "NARIMAN HOUSE", 9, 7],
  ["cas-oberoi", "loc-oberoi", "OBEROI", 35, 24],
].map(([id, locationId, label, killed, injured]) => ({
  ...sourceMeta("NOT_APPLICABLE"),
  id: id as string,
  locationId: locationId as string,
  label: label as string,
  killed: killed as number,
  injured: injured as number,
}));

function fact(
  id: string,
  type: InvestigationFact["type"],
  text: string,
  sourceTitle: string,
  linkedEntityIds: string[],
  linkedTimelineEventIds: string[],
  linkedLocationIds: string[],
  sourceRef = SUPREME_COURT_SOURCE,
  precision: TimePrecision = "NOT_APPLICABLE",
): InvestigationFact {
  return {
    ...sourceMeta(precision, sourceRef),
    id,
    type,
    text,
    status: "verified",
    sourceTitle,
    linkedEntityIds,
    linkedTimelineEventIds,
    linkedLocationIds,
  };
}

const facts: InvestigationFact[] = [
  fact("mum-fact-landing", "forensic", "The attack group reached the Mumbai shoreline at Badhwar Park between approximately 21:15 and 21:30 on 26 November 2008.", "Supreme Court of India judgment / 29 Aug 2012", attackerNodes.map((node) => node.id), ["MUM-TL-001"], ["loc-badhwar"], SUPREME_COURT_SOURCE, "WINDOW"),
  fact("mum-fact-cst", "documentary", "CCTV and witness evidence documented the CST incident; the judgment records 52 people killed and 109 injured there.", "Supreme Court of India judgment / 29 Aug 2012", ["attacker-kasab", "attacker-ismail"], ["MUM-TL-006"], ["loc-cst"], SUPREME_COURT_SOURCE, "APPROX"),
  fact("mum-fact-oberoi", "timeline", "The Oberoi / Trident incident began at approximately 21:55 on 26 November 2008.", "Supreme Court of India judgment / 29 Aug 2012", ["attacker-fahadullah", "attacker-chhota"], ["MUM-TL-005", "MUM-TL-013"], ["loc-oberoi"], SUPREME_COURT_SOURCE, "APPROX"),
  fact("mum-fact-totals", "legal-record", "The Supreme Court judgment records 166 people killed and 238 injured across the attack.", "Supreme Court of India judgment / 29 Aug 2012", ["evidence-judgment"], [], locations.map((item) => item.id)),
  fact("mum-fact-headley", "investigative", "David Coleman Headley pleaded guilty in the United States to charges connected with planning the Mumbai attacks and conducted pre-attack surveillance of potential targets during multiple visits.", "U.S. Department of Justice / Headley sentencing record", ["planner-headley", "org-let"], [], ["loc-cst", "loc-leopold", "loc-taj", "loc-nariman", "loc-oberoi"], DOJ_HEADLEY_SOURCE),
  fact("mum-fact-taj", "legal-record", "The Supreme Court judgment records 36 people killed and 30 injured at the Taj Mahal Palace.", "Supreme Court of India judgment / 29 Aug 2012", ["attacker-bada", "attacker-javed", "attacker-nazir", "attacker-shoaib"], ["MUM-TL-004", "MUM-TL-015"], ["loc-taj"]),
  fact("mum-fact-cama", "legal-record", "The Cama record is separated into CAMA_IN (7 killed, 10 injured) and CAMA_OUT (9 killed, 7 injured).", "Supreme Court of India judgment / 29 Aug 2012", ["attacker-kasab", "attacker-ismail"], ["MUM-TL-007", "MUM-TL-010"], ["loc-cama"]),
  fact("mum-fact-clearance", "timeline", "The documented clearance sequence concludes at the Oberoi / Trident on 28 November, Nariman House during the night of 28 November, and the Taj at approximately 09:00 on 29 November.", "Supreme Court of India judgment / 29 Aug 2012", [], ["MUM-TL-013", "MUM-TL-014", "MUM-TL-015"], ["loc-oberoi", "loc-nariman", "loc-taj"], SUPREME_COURT_SOURCE, "WINDOW"),
];

export const mumbai2611Investigation: Investigation = {
  id: "mumbai-2611",
  caseId: "MUM-2611-2008",
  slug: "mumbai-2611",
  name: "Mumbai 26/11 Attacks",
  shortName: "MUMBAI 26/11",
  displayName: "The Fatal Ledger",
  type: "HISTORICAL",
  deskLabel: "Case Desk / Historical Case",
  caseType: "COORDINATED TERROR ATTACK",
  location: "Mumbai, Maharashtra, India",
  start: "2008-11-26T21:15:00+05:30",
  end: "2008-11-29T09:00:00+05:30",
  timezone: "Asia/Kolkata",
  overallStatus: "CLOSED / HISTORICAL CASE",
  summary:
    "A coordinated attack across multiple locations in Mumbai between 26 and 29 November 2008.",
  badge: "VERIFIED HISTORICAL DATA",
  historicalNote:
    "Historical reconstruction based on court and government records. Approximate times are marked ≈.",
  verifiedTotals: {
    attackersInvolved: 10,
    attackersKilled: 9,
    attackersCaptured: 1,
    peopleKilled: 166,
    peopleInjured: 238,
    securityPersonnelKilled: 18,
    foreignNationalsKilled: 26,
  },
  sourceRef: SUPREME_COURT_SOURCE,
  timePrecision: "WINDOW",
  confidence: "VERIFIED",
  map: {
    center: [72.8296, 18.9362],
    zoom: 12.2,
    boundsLabel: "MUMBAI / SOUTH MUMBAI",
    filterGroups: [
      "PRIMARY ATTACK SITES",
      "LANDING / MOVEMENT",
      "POLICE RESPONSE",
      "SECONDARY INCIDENTS",
      "CLEARANCE EVENTS",
    ],
    locations,
    routes,
    densityNotice: "LIMITED HISTORICAL SAMPLE",
  },
  graph: {
    nodes: graphNodes,
    links: graphLinks,
    filters: [
      { id: "team", label: "Team Connections", tone: "#D22B2B", darkTone: "#AEC3B0" },
      { id: "target", label: "Target / Location Links", tone: "#111111", darkTone: "#EFF6E0" },
      { id: "movement", label: "Movement", tone: "#FCD34D", darkTone: "#598392" },
      { id: "planning", label: "Pre-Attack Planning", tone: "#6366F1", darkTone: "#AEC3B0" },
      { id: "response", label: "Police / Response", tone: "#D97706", darkTone: "#EFF6E0" },
      { id: "evidence", label: "Evidence / Legal Source", tone: "#D22B2B", darkTone: "#AEC3B0" },
    ],
  },
  timeline: {
    startDate: "2008-11-26",
    endDate: "2008-11-29",
    events: timelineEvents,
  },
  casualtyLedger,
  facts,
};
