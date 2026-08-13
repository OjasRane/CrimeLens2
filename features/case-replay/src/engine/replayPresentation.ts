import type { ReplayView } from "@replay/types";
import type { ReplaySceneFamily } from "@replay/scenes/ReplaySceneFamilies";

export type ReplayComplexity = "QUICK" | "NORMAL" | "DETAILED" | "MAJOR";

export type EventPresentation = {
  clue: string;
  detail: string;
  consequence: string;
  next: string;
  outgoingClue: string;
  complexity: ReplayComplexity;
};

export const EVENT_PRESENTATION: Record<string, EventPresentation> = {
  "TL-001": { clue: "NAVIGATION / ROUTE EVIDENCE", detail: "Vessel and navigation records reconstruct movement toward Mumbai", consequence: "The case timeline begins offshore", next: "Follow the route to the landing zone", outgoingClue: "SEA ROUTE", complexity: "MAJOR" },
  "TL-002": { clue: "COASTAL LANDING ZONE", detail: "Badhwar Park anchors the reconstructed arrival", consequence: "Sea evidence connects to the city", next: "Trace branching movement toward major sites", outgoingClue: "LANDING ROUTE", complexity: "DETAILED" },
  "TL-003": { clue: "ONE ENTRY / MULTIPLE LOCATIONS", detail: "CST, Leopold Cafe, Taj, Oberoi-Trident and Nariman House activate sequentially", consequence: "A coordinated citywide incident becomes visible", next: "Focus on the first CST reports", outgoingClue: "CST", complexity: "MAJOR" },
  "TL-004": { clue: "ATTACK BEGINS AT CST", detail: "Public movement and verified alerts interrupt normal station activity", consequence: "The first city incident is confirmed", next: "Carry the alert to Leopold Cafe", outgoingClue: "CST ALERT", complexity: "DETAILED" },
  "TL-005": { clue: "LEOPOLD INCIDENT CONFIRMED", detail: "A second disruption enters the widening city alert", consequence: "Emergency response expands across South Mumbai", next: "Trace protected approaches", outgoingClue: "CITY ALERT", complexity: "DETAILED" },
  "TL-006": { clue: "PROTECTED CORRIDORS", detail: "Hospital access, approaches and perimeters are coordinated", consequence: "Several linked response zones emerge", next: "Focus on the Taj response", outgoingClue: "TAJ CORRIDOR", complexity: "NORMAL" },
  "TL-007": { clue: "TAJ RESPONSE LOCATION", detail: "Evacuation, containment and specialist support continue", consequence: "The building remains an active response site", next: "Compare continuing locations", outgoingClue: "LOCATION STATUS", complexity: "MAJOR" },
  "TL-008": { clue: "THREE CONTINUING LOCATIONS", detail: "Taj, Oberoi-Trident and Nariman House", consequence: "Parallel operations are confirmed", next: "Introduce specialist deployments", outgoingClue: "MULTI-SITE STATUS", complexity: "DETAILED" },
  "TL-009": { clue: "SPECIALIST DEPLOYMENT", detail: "Units are assigned across the major locations", consequence: "A coordinated command structure develops", next: "Assemble the command picture", outgoingClue: "DEPLOYMENT RECORD", complexity: "DETAILED" },
  "TL-010": { clue: "SHARED COMMAND PICTURE", detail: "Location status, deployments and verified communications align", consequence: "Response knowledge becomes structured", next: "Secure recovered items", outgoingClue: "RECOVERY RECORD", complexity: "MAJOR" },
  "TL-011": { clue: "RECOVERED DEVICES", detail: "Phones, navigation material and documents enter evidence control", consequence: "Technical examination can begin", next: "Compare evidence with the captured individual", outgoingClue: "DEVICE RECORD", complexity: "DETAILED" },
  "TL-012": { clue: "IDENTITY CONFIRMED", detail: "The captured individual is identified after verification", consequence: "Unidentified becomes Ajmal Amir Kasab", next: "Examine communications relationships", outgoingClue: "CONFIRMED IDENTITY", complexity: "MAJOR" },
  "TL-013": { clue: "DIGITAL COMMUNICATIONS", detail: "Recovered phones and call data are examined", consequence: "Relationship leads become visible", next: "Compare with maritime evidence", outgoingClue: "COMMUNICATION LINKS", complexity: "DETAILED" },
  "TL-014": { clue: "MARITIME ROUTE", detail: "Vessel and navigation records are compared with the landing area", consequence: "Independent route evidence aligns", next: "Return to the operational timeline", outgoingClue: "ROUTE CORROBORATION", complexity: "DETAILED" },
  "TL-015": { clue: "OPERATIONS CONCLUDE", detail: "Documented end states are placed on the shared timeline", consequence: "The live-response sequence closes", next: "Converge the major evidence threads", outgoingClue: "OPERATION TIMELINE", complexity: "MAJOR" },
  "TL-016": { clue: "EVIDENCE CONVERGES", detail: "Locations, identity, devices and maritime records align", consequence: "A coherent investigative reconstruction emerges", next: "Freeze and inspect the supporting record", outgoingClue: "CASE SYNTHESIS", complexity: "MAJOR" },
};

// 16 chronological records remain intact; this pacing totals about 116 seconds.
const DURATION: Record<ReplayComplexity, number> = { QUICK: 3200, NORMAL: 4600, DETAILED: 6700, MAJOR: 8500 };

export function durationForEvent(id: string) {
  return DURATION[EVENT_PRESENTATION[id]?.complexity ?? "NORMAL"];
}

export function representationLabel(view: ReplayView, family?: ReplaySceneFamily) {
  if (family === "MARITIME_RECONSTRUCTION") return "MARITIME RECONSTRUCTION";
  if (family === "COASTAL_LANDING_RECONSTRUCTION") return "COASTAL RECONSTRUCTION";
  if (family === "MUMBAI_CASE_MAP") return "GEOSPATIAL TRACE";
  if (family === "CST_LEOPOLD_RECONSTRUCTION") return "INITIAL INCIDENT CLUSTER";
  if (family === "TAJ_RECONSTRUCTION" || family === "OBEROI_NARIMAN_RECONSTRUCTION") return "LANDMARK RECONSTRUCTION";
  if (family === "CITY_RESPONSE_RECONSTRUCTION" || family === "SPECIALIST_RESPONSE_RECONSTRUCTION") return "RESPONSE + CONTAINMENT";
  if (family === "RELATIONSHIP_INTELLIGENCE") return "RELATIONSHIP INTELLIGENCE";
  if (family === "FORENSIC_EVIDENCE") return "FORENSIC EXAMINATION";
  if (family === "INVESTIGATION_BOARD" || family === "CASE_SYNTHESIS") return "INVESTIGATION BOARD";
  if (family === "ACCESS_RECORD_REVIEW") return "ACCESS RECORD REVIEW";
  if (family === "MAP_ROUTE") return "SPATIAL ROUTE MODEL";
  if (family === "DETENTION_OFFICER_INTERACTION") return "RESPONSE COORDINATION";
  if (family === "LOCATION_RECONSTRUCTION") return "LOCATION RECONSTRUCTION";
  return view === "network" ? "RELATIONSHIP INTELLIGENCE" : view === "evidence" ? "EVIDENCE FOCUS" : view === "map" ? "SPATIAL ANALYSIS" : view === "environment" ? "3D RECONSTRUCTION" : "TIMELINE RECORD";
}
