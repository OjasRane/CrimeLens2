import type { ReplayCaseSource, ReplayChapter, ReplayEvent, ReplayPerson, ReplayStory, ReplayView, ReviewStatus } from "@replay/types";

type EventGrounding = {
  people: string[];
  evidence: string[];
  location?: string;
  graph: string[];
  narration: string;
  why: string;
  next: string;
  view: ReplayView;
  sceneTemplate: string;
  knowledgeLabel?: string;
  headline?: string;
};

const PEOPLE: Record<string, ReplayPerson> = {
  "unknown-individual": { entityId: "entity-unknown", name: "Unidentified individual", role: "suspect" },
  "kasab-confirmed": { entityId: "entity-kasab", name: "Ajmal Amir Kasab", role: "suspect" },
  "control-room": { entityId: "control-room", name: "Emergency control room", role: "investigator" },
  "responder": { entityId: "responder", name: "Responder", role: "officer" },
  "specialist-unit": { entityId: "specialist-unit", name: "Specialist response unit", role: "officer" },
  "case-investigator": { entityId: "case-investigator", name: "Case investigator", role: "investigator" },
  "civilian-group": { entityId: "civilian-group", name: "Civilian group", role: "witness" },
};

const EVENTS: Record<string, EventGrounding> = {
  "TL-001": { people: ["unknown-individual"], evidence: ["ev-vessel", "ev-navigation", "photo-route"], location: "loc-landing", graph: ["entity-unknown", "ev-vessel", "ev-navigation", "loc-landing"], narration: "Vessel evidence and navigation material allow investigators to reconstruct an Arabian Sea approach toward Mumbai.", why: "The maritime record establishes that the case timeline began before the first city alerts.", next: "Follow the route line to the coastal landing zone.", view: "environment", sceneTemplate: "SEA_RECONSTRUCTION", knowledgeLabel: "Route reconstructed later / identities unresolved" },
  "TL-002": { people: ["unknown-individual"], evidence: ["photo-route", "ev-navigation"], location: "loc-landing", graph: ["entity-unknown", "loc-landing", "ev-navigation"], narration: "Location, witness, and recovered-route evidence establish the landing near Badhwar Park and movement into South Mumbai.", why: "The landing is the bridge between the maritime approach and the later urban incident pattern.", next: "Trace the branching movement toward the first confirmed sites.", view: "environment", sceneTemplate: "COASTAL_LANDING", knowledgeLabel: "Landing established / team identities unresolved" },
  "TL-003": { people: ["responder", "civilian-group"], evidence: ["note-sites"], location: "loc-cst", graph: ["loc-cst", "loc-taj", "loc-oberoi", "loc-nariman"], narration: "Confirmed reports at CST, Leopold Cafe, the Taj, the Oberoi-Trident, and Nariman House reveal a distributed emergency.", why: "The branching map makes one entry chain becoming multiple city incidents visible before it is explained in text.", next: "Follow the CST marker into the next chapter.", view: "map", sceneTemplate: "MUMBAI_CASE_MAP", knowledgeLabel: "Multiple locations confirmed / full relationship still under review" },
  "TL-004": { people: ["civilian-group", "responder", "control-room"], evidence: ["note-sites"], location: "loc-cst", graph: ["loc-cst", "loc-taj"], headline: "Initial attack begins at CST", narration: "Normal station activity is interrupted. Distant non-graphic incident cues, civilians moving away, and the first verified alerts establish that an attack has begun at CST.", why: "The reconstruction communicates the start of the incident through public reaction and verified alerts without depicting graphic violence or attack mechanics.", next: "Carry the first alert south to Leopold Cafe.", view: "environment", sceneTemplate: "CST_CITY_ALERT" },
  "TL-005": { people: ["civilian-group", "responder"], evidence: ["note-sites"], location: "loc-cst", graph: ["loc-cst", "loc-taj"], headline: "Leopold Cafe incident enters the city alert", narration: "A second restrained reconstruction shows abrupt disruption at Leopold Cafe, civilians leaving the frontage, and emergency responders entering the wider city picture.", why: "The second location makes the early incident progression understandable while keeping the depiction restrained and victim-centred.", next: "Rise to the city map and trace protected response corridors.", view: "environment", sceneTemplate: "CST_CITY_ALERT" },
  "TL-006": { people: ["control-room", "responder"], evidence: ["note-sites"], location: "loc-taj", graph: ["loc-cst", "loc-taj", "loc-oberoi"], narration: "Hospital access, transport approaches, and major perimeters are coordinated across South Mumbai.", why: "Spatial routing shows why the response had to operate as several linked zones.", next: "Focus on the sustained response at the Taj.", view: "map", sceneTemplate: "MAP_ZOOM" },
  "TL-007": { people: ["responder", "civilian-group"], evidence: ["note-sites"], location: "loc-taj", graph: ["loc-taj"], narration: "The Taj Mahal Palace remains a major response location requiring evacuation, containment, and specialist support.", why: "The reconstruction explains the building context while deliberately omitting graphic or tactical reenactment.", next: "Compare the Taj status with the other continuing locations.", view: "environment", sceneTemplate: "LOCATION_INCIDENT" },
  "TL-008": { people: ["control-room", "responder"], evidence: ["note-sites"], location: "loc-oberoi", graph: ["loc-taj", "loc-oberoi", "loc-nariman"], narration: "Command records confirm simultaneous continuing operations at the Oberoi-Trident and Nariman House.", why: "The three-location view prevents the case from being reduced to a single site.", next: "Introduce the specialist response deployment.", view: "map", sceneTemplate: "MAP_ZOOM" },
  "TL-009": { people: ["specialist-unit", "responder"], evidence: ["note-sites"], location: "loc-taj", graph: ["loc-taj", "loc-oberoi", "loc-nariman"], narration: "Specialist response units arrive and are assigned across the major locations within a coordinated command structure.", why: "The emphasis remains on roles, locations, and coordination rather than combat action.", next: "Assemble a shared multi-site command picture.", view: "environment", sceneTemplate: "RESPONSE_COMMAND" },
  "TL-010": { people: ["control-room", "case-investigator"], evidence: ["note-sites", "note-digital"], location: "loc-taj", graph: ["loc-taj", "loc-oberoi", "loc-nariman"], narration: "Verified communications, responder deployments, evacuation information, and location status are assembled on a shared board.", why: "This is the bridge from emergency response to structured investigative knowledge.", next: "Preserve recovered items and begin forensic examination.", view: "timeline", sceneTemplate: "CASE_BOARD_SYNTHESIS" },
  "TL-011": { people: ["case-investigator"], evidence: ["ev-phone", "ev-navigation", "ev-vessel"], location: "loc-landing", graph: ["ev-phone", "ev-navigation", "ev-vessel"], narration: "Phones, navigation devices, documents, and site material are catalogued under an evidence chain for technical examination.", why: "The case begins to move from event reconstruction toward testable evidence links.", next: "Compare the recovered evidence with the captured individual.", view: "evidence", sceneTemplate: "EVIDENCE_TABLE", knowledgeLabel: "Identity still under verification" },
  "TL-012": { people: ["kasab-confirmed", "case-investigator"], evidence: ["ev-phone"], location: "loc-cst", graph: ["entity-kasab", "ev-phone"], narration: "The surviving individual captured at Girgaum Chowpatty is documented and identified as Ajmal Amir Kasab after verification.", why: "The label changes only when the record supports the identity—demonstrating Investigation Knowledge Mode.", next: "Use the confirmed identity to examine communication relationships.", view: "network", sceneTemplate: "RELATIONSHIP_INTELLIGENCE", knowledgeLabel: "Identity confirmed" },
  "TL-013": { people: ["case-investigator", "kasab-confirmed"], evidence: ["ev-phone", "note-digital"], graph: ["entity-kasab", "ev-phone"], narration: "Recovered and damaged phones, call data, and communications records are examined to develop relationship leads.", why: "Technical evidence provides connections that were not visible during the live response.", next: "Compare digital evidence with the reconstructed maritime route.", view: "evidence", sceneTemplate: "EVIDENCE_TABLE" },
  "TL-014": { people: ["case-investigator"], evidence: ["ev-vessel", "ev-navigation", "photo-route"], location: "loc-landing", graph: ["ev-vessel", "ev-navigation", "loc-landing"], narration: "The recovered vessel and navigation material are compared with the sea route and landing area.", why: "Independent physical and digital records reinforce the reconstructed approach to Mumbai.", next: "Return to the location timeline as response operations conclude.", view: "evidence", sceneTemplate: "EVIDENCE_TABLE" },
  "TL-015": { people: ["specialist-unit", "control-room"], evidence: ["note-sites"], location: "loc-taj", graph: ["loc-taj", "loc-oberoi", "loc-nariman"], narration: "Operations at Nariman House and the Oberoi conclude on 28 November; the Taj operation concludes on 29 November.", why: "The operational timeline closes without turning the end state into a dramatic spectacle.", next: "Converge the major evidence threads into a case synthesis.", view: "timeline", sceneTemplate: "TIMELINE_REVEAL" },
  "TL-016": { people: ["case-investigator", "kasab-confirmed"], evidence: ["ev-phone", "ev-navigation", "ev-vessel", "note-sites"], location: "loc-taj", graph: ["entity-kasab", "ev-phone", "ev-navigation", "ev-vessel", "loc-landing", "loc-taj"], narration: "Location records, identification work, recovered devices, maritime evidence, and communications analysis converge into the investigative case picture.", why: "The final state explains what the record establishes and keeps legal conclusions outside the visualization.", next: "Freeze and inspect the evidence, locations, and relationships behind the synthesis.", view: "network", sceneTemplate: "CASE_BOARD_SYNTHESIS" },
};

const CHAPTERS: Omit<ReplayChapter, "id" | "number">[] = [
  { title: "Maritime Approach", shortSummary: "Maritime evidence reconstructs the Arabian Sea approach toward Mumbai.", timeRange: "26 Nov · evening", startIndex: 0, endIndex: 0, viewSequence: ["environment", "map"], keyEntities: ["Unidentified individuals"], locations: ["Arabian Sea", "Mumbai coast"], evidenceRefs: ["Vessel evidence", "Navigation material"], chapterNarration: "The investigative timeline begins offshore.", whyItMatters: "It establishes the route before the urban incidents.", relatedTimelineEvents: ["TL-001"], established: "A maritime approach toward Mumbai.", remainsUnclear: "Identity and intended destinations.", nextLead: "Follow the route to the landing point." },
  { title: "Coastal Landing", shortSummary: "The final water route stops at the Badhwar Park coastal edge.", timeRange: "26 Nov · 20:10–20:40", startIndex: 1, endIndex: 1, viewSequence: ["environment", "map"], keyEntities: ["Unidentified individuals"], locations: ["Badhwar Park", "South Mumbai"], evidenceRefs: ["Landing reconstruction", "Route evidence"], chapterNarration: "The dinghy stops at the shoreline before movement continues on land.", whyItMatters: "It connects approach evidence to the later urban geography.", relatedTimelineEvents: ["TL-002"], established: "The coastal landing zone.", remainsUnclear: "The future site pattern.", nextLead: "Map branching movement toward major sites." },
  { title: "Split Into City Routes", shortSummary: "Verified South Mumbai locations emerge from the landing route.", timeRange: "26 Nov · 21:20–22:00", startIndex: 2, endIndex: 2, viewSequence: ["map", "network"], keyEntities: ["Emergency control room"], locations: ["CST", "Leopold", "Taj", "Oberoi-Trident", "Nariman House"], evidenceRefs: ["Emergency reports", "Location records"], chapterNarration: "The real map changes from one entry point to distinct location groups.", whyItMatters: "The geographic spread defines the scale.", relatedTimelineEvents: ["TL-003"], established: "Multiple confirmed incident sites.", remainsUnclear: "Status within each site.", nextLead: "Review CST, Leopold, and the first city alerts." },
  { title: "Initial Incident Cluster", shortSummary: "CST, Leopold, early alerts, and first response corridors form one rapid chapter.", timeRange: "26 Nov · 21:20–00:30", startIndex: 3, endIndex: 5, viewSequence: ["environment", "timeline", "map"], keyEntities: ["Responders", "Control room", "Civilians"], locations: ["CST", "Leopold", "South Mumbai response zones"], evidenceRefs: ["Emergency reports", "Dispatch log", "Perimeter map"], chapterNarration: "Fragmented alerts become coordinated public-safety zones.", whyItMatters: "It shows rapid incident emergence without reenacting violence.", relatedTimelineEvents: ["TL-004", "TL-005", "TL-006"], established: "Verified early sites and active response corridors.", remainsUnclear: "Duration at the major locations.", nextLead: "Focus on the continuing major locations." },
  { title: "Major Siege Locations", shortSummary: "Taj, Oberoi-Trident, and Nariman House remain distinct landmark response sites.", timeRange: "27 Nov · overnight", startIndex: 6, endIndex: 7, viewSequence: ["environment", "map"], keyEntities: ["Responders", "Civilian groups"], locations: ["Taj", "Oberoi-Trident", "Nariman House"], evidenceRefs: ["Location status", "Command records"], chapterNarration: "Three different buildings require parallel containment and evacuation work.", whyItMatters: "Each location remains distinct within the larger case.", relatedTimelineEvents: ["TL-007", "TL-008"], established: "Three continuing major locations.", remainsUnclear: "Their operational end states.", nextLead: "Track specialist intervention." },
  { title: "Response + Containment", shortSummary: "Specialist assignments and a shared command picture coordinate the response.", timeRange: "27–28 Nov", startIndex: 8, endIndex: 9, viewSequence: ["environment", "timeline"], keyEntities: ["Specialist response units", "Command staff"], locations: ["Taj", "Oberoi-Trident", "Nariman House"], evidenceRefs: ["Deployment records", "Command board"], chapterNarration: "Vehicles, cordons, communications, and site status form one operational picture.", whyItMatters: "The reconstruction stays focused on response roles and containment.", relatedTimelineEvents: ["TL-009", "TL-010"], established: "Coordinated specialist deployment.", remainsUnclear: "The later evidence and identity network.", nextLead: "Secure and examine recovered material." },
  { title: "Evidence Synthesis / Investigation Board", shortSummary: "Physical, digital, identity, route, location, and timeline evidence converge.", timeRange: "27–29 Nov", startIndex: 10, endIndex: 15, viewSequence: ["evidence", "network", "map", "timeline"], keyEntities: ["Case investigators", "Ajmal Amir Kasab"], locations: ["Evidence processing", "Maritime route", "Major Mumbai sites"], evidenceRefs: ["Phones", "Navigation data", "MV Kuber", "Location records"], chapterNarration: "CrimeLens turns the response record into a structured investigative synthesis.", whyItMatters: "Independent evidence streams become a reviewable case picture.", relatedTimelineEvents: ["TL-011", "TL-012", "TL-013", "TL-014", "TL-015", "TL-016"], established: "Identity, digital, maritime, operational, and location links.", remainsUnclear: "Questions outside the displayed source record.", nextLead: "Freeze and inspect the supporting records." },
];

const FINAL_CHAPTER_TITLES = [
  "Maritime Approach",
  "Coastal Landing",
  "South Mumbai Movement / Route Split",
  "Initial Attacks — CST + Leopold",
  "Major Siege Locations — Taj + Oberoi + Nariman House",
  "Response + Containment",
  "Investigation + Evidence + Case Synthesis",
] as const;

function statusFor(event: ReplayCaseSource["timelineEvents"][number]): ReviewStatus {
  return event.category === "ANALYSIS" ? "SUPPORTED LINK" : "CONFIRMED FACT";
}

export function buildStoryScript(source: ReplayCaseSource): ReplayStory {
  const ordered = [...source.timelineEvents].sort((a, b) => a.timestamp - b.timestamp);
  const chapters: ReplayChapter[] = CHAPTERS.map((chapter, index) => ({ ...chapter, title: FINAL_CHAPTER_TITLES[index] ?? chapter.title, id: `chapter-${index + 1}`, number: index + 1 }));
  const beats = chapters.map((chapter) => ({ id: `beat-${chapter.number}`, number: chapter.number, title: chapter.title, startIndex: chapter.startIndex, endIndex: chapter.endIndex }));
  const graphNodeMap = new Map(source.graphNodes.map((node) => [node.id, node]));
  const evidenceNodeMap = new Map(source.evidenceNodes.map((node) => [node.id, node]));

  const events = ordered.map<ReplayEvent>((event, index) => {
    const grounding = EVENTS[event.id];
    const chapter = chapters.find((item) => index >= item.startIndex && index <= item.endIndex) ?? chapters[0];
    const beat = beats.find((item) => index >= item.startIndex && index <= item.endIndex) ?? beats[0];
    const relatedNodeIds = grounding.graph.filter((id) => graphNodeMap.has(id));
    const relatedLinkIds = source.graphLinks.filter((link) => relatedNodeIds.includes(link.source) && relatedNodeIds.includes(link.target)).map((link) => link.id);
    const locationNode = grounding.location ? graphNodeMap.get(grounding.location) : undefined;
    const incident = source.mapIncidents.find((item) => item.title.toLowerCase().includes((locationNode?.label ?? "").split(" ")[0].toLowerCase())) ?? source.mapIncidents.find((item) => item.date === event.date);
    const evidence = grounding.evidence.map((id) => {
      const board = evidenceNodeMap.get(id);
      const graph = graphNodeMap.get(id);
      const label = String(board?.data.caption ?? board?.data.text ?? graph?.label ?? id.replaceAll("-", " "));
      return { id, sourceId: board?.id ?? graph?.id ?? id, label: label.length > 52 ? `${label.slice(0, 49)}…` : label, status: statusFor(event) };
    });
    const viewSequence = [grounding.view, grounding.view === "map" ? "environment" : grounding.view === "environment" ? "map" : grounding.view === "evidence" ? "network" : "evidence"] as ReplayView[];
    return {
      id: `replay-${event.id}`,
      sourceTimelineId: event.id,
      sourceIncidentId: incident?.id,
      timestamp: event.time,
      date: event.date,
      category: event.category,
      title: event.title,
      headline: grounding.headline ?? event.title,
      description: event.description,
      narration: grounding.narration,
      transitionCue: grounding.next,
      importance: event.severity >= 10 ? "critical" : event.severity >= 8 ? "high" : "medium",
      status: statusFor(event),
      whyItMatters: grounding.why,
      sceneType: grounding.view === "map" ? "map" : grounding.view === "evidence" ? "evidence" : grounding.view === "network" ? "network" : grounding.view === "environment" ? "street" : "analysis",
      cameraPreset: grounding.view === "map" ? "map-rise" : grounding.view === "evidence" ? "evidence-focus" : grounding.view === "network" ? "graph-orbit" : "wide",
      viewSequence,
      people: grounding.people.map((id) => PEOPLE[id]).filter(Boolean),
      evidence,
      location: grounding.location ? { id: grounding.location, label: locationNode?.label ?? grounding.location, coordinates: incident?.coordinates, sourceIncidentId: incident?.id } : undefined,
      relatedNodeIds,
      relatedLinkIds,
      chapterId: chapter.id,
      beatId: beat.id,
      eventType: event.category,
      currentView: grounding.view,
      sceneTemplate: grounding.sceneTemplate,
      annotationText: grounding.narration,
      nextLead: grounding.next,
      knowledgeLabel: grounding.knowledgeLabel,
    };
  });

  return {
    caseId: source.caseId,
    title: source.title,
    subtitle: "Respectful, non-graphic reconstruction from the documented investigative record",
    dateRange: [events[0]?.date ?? "", events.at(-1)?.date ?? ""],
    events,
    chapters,
    beats,
    entityCount: new Set(events.flatMap((event) => event.people.map((person) => person.entityId))).size,
    evidenceCount: new Set(events.flatMap((event) => event.evidence.map((item) => item.id))).size,
  };
}
