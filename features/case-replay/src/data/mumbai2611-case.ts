import { mumbaiCaseLocations } from "@replay/data/mumbai-case-locations";

export const MUMBAI_CASE_TITLE = "Mumbai 26/11 — Investigative Reconstruction";
export const MUMBAI_CASE_SHORT_TITLE = "Mumbai 26/11";

export const MUMBAI_TIMELINE_EVENTS = [
  { id: "TL-001", date: "2008-11-26", time: "Evening", timestamp: new Date("2008-11-26T18:30:00+05:30").getTime(), category: "EVIDENCE", title: "Maritime approach reconstructed", description: "Navigation material, vessel evidence, and the later route reconstruction establish the Arabian Sea approach toward Mumbai.", severity: 8 },
  { id: "TL-002", date: "2008-11-26", time: "20:10–20:40", timestamp: new Date("2008-11-26T20:10:00+05:30").getTime(), category: "CCTV", title: "Landing in Mumbai established", description: "Investigators reconstruct the landing near Badhwar Park and subsequent movement into South Mumbai from location, witness, and recovered-route evidence.", severity: 8 },
  { id: "TL-003", date: "2008-11-26", time: "21:20–22:00", timestamp: new Date("2008-11-26T21:25:00+05:30").getTime(), category: "CCTV", title: "Multiple incident sites emerge", description: "Reports from CST, Leopold Cafe, the Taj, the Oberoi-Trident, and Nariman House establish that the incidents are distributed across several locations.", severity: 10 },
  { id: "TL-004", date: "2008-11-26", time: "21:20–22:30", timestamp: new Date("2008-11-26T21:35:00+05:30").getTime(), category: "ANALYSIS", title: "CST and Leopold alerts consolidate", description: "Emergency and dispatch records connect the early CST and Leopold reports with the widening city alert while separating confirmed locations from duplication.", severity: 9 },
  { id: "TL-005", date: "2008-11-26", time: "22:00–23:30", timestamp: new Date("2008-11-26T22:00:00+05:30").getTime(), category: "ARREST", title: "Citywide response mobilized", description: "Mumbai Police, fire, medical, and emergency services establish response zones while the scale remains under assessment.", severity: 9 },
  { id: "TL-006", date: "2008-11-26", time: "22:30–00:30", timestamp: new Date("2008-11-26T22:30:00+05:30").getTime(), category: "CALL", title: "Response corridors and perimeters", description: "Command records show hospitals, transport approaches, and major incident perimeters being coordinated across the city.", severity: 8 },
  { id: "TL-007", date: "2008-11-27", time: "00:00–06:00", timestamp: new Date("2008-11-27T00:00:00+05:30").getTime(), category: "CCTV", title: "Taj location remains active", description: "The Taj Mahal Palace becomes a sustained response location requiring evacuation, containment, and specialist support.", severity: 10 },
  { id: "TL-008", date: "2008-11-27", time: "00:00–08:00", timestamp: new Date("2008-11-27T00:05:00+05:30").getTime(), category: "ANALYSIS", title: "Oberoi and Nariman House confirmed", description: "Separate command records confirm continuing operations at the Oberoi-Trident and Nariman House alongside the Taj response.", severity: 10 },
  { id: "TL-009", date: "2008-11-27", time: "Early morning", timestamp: new Date("2008-11-27T05:30:00+05:30").getTime(), category: "ARREST", title: "Specialist response forces deploy", description: "Specialist units arrive and are assigned to the major siege locations under a coordinated command structure.", severity: 9 },
  { id: "TL-010", date: "2008-11-27", time: "27–28 Nov", timestamp: new Date("2008-11-27T09:00:00+05:30").getTime(), category: "ANALYSIS", title: "Multi-site command picture develops", description: "Location status, evacuation information, responder deployments, and verified communications are assembled into a shared operational picture.", severity: 8 },
  { id: "TL-011", date: "2008-11-27", time: "27 Nov", timestamp: new Date("2008-11-27T12:00:00+05:30").getTime(), category: "EVIDENCE", title: "Recovered items enter evidence chain", description: "Recovered phones, navigation devices, documents, and site material are catalogued for technical and forensic examination.", severity: 8 },
  { id: "TL-012", date: "2008-11-27", time: "27 Nov", timestamp: new Date("2008-11-27T15:00:00+05:30").getTime(), category: "FORENSIC", title: "Surviving attacker identified", description: "The individual captured at Girgaum Chowpatty is documented and later identified as Ajmal Amir Kasab; the identity is shown only after confirmation.", severity: 10 },
  { id: "TL-013", date: "2008-11-28", time: "28 Nov onward", timestamp: new Date("2008-11-28T10:00:00+05:30").getTime(), category: "FORENSIC", title: "Digital communications examined", description: "Damaged phones, call data, and communications records are examined to develop relationship and coordination leads.", severity: 9 },
  { id: "TL-014", date: "2008-11-28", time: "28 Nov onward", timestamp: new Date("2008-11-28T14:00:00+05:30").getTime(), category: "EVIDENCE", title: "Maritime route evidence linked", description: "The recovered vessel and navigation material are compared with the reconstructed sea route and landing point.", severity: 9 },
  { id: "TL-015", date: "2008-11-29", time: "28–29 Nov", timestamp: new Date("2008-11-29T08:00:00+05:30").getTime(), category: "ANALYSIS", title: "Major response operations conclude", description: "Operations at Nariman House and the Oberoi conclude on 28 November; the Taj operation concludes on 29 November.", severity: 10 },
  { id: "TL-016", date: "2008-11-29", time: "Post-operation", timestamp: new Date("2008-11-29T12:00:00+05:30").getTime(), category: "ANALYSIS", title: "Case evidence converges", description: "Location records, recovered devices, maritime evidence, identification work, and communications analysis form the investigative case picture.", severity: 9 },
] as const;

const point = (id: keyof typeof mumbaiCaseLocations): [number, number] => [mumbaiCaseLocations[id].longitude, mumbaiCaseLocations[id].latitude];

export const MUMBAI_MAP_INCIDENTS = [
  { id: "INC-001", locationId: "BADHWAR_PARK", type: "Arrival", title: mumbaiCaseLocations.BADHWAR_PARK.name, date: "2008-11-26", severity: "HIGH", coordinates: point("BADHWAR_PARK"), intensity: 8 },
  { id: "INC-002", locationId: "CST", type: "Incident", title: mumbaiCaseLocations.CST.name, date: "2008-11-26", severity: "CRITICAL", coordinates: point("CST"), intensity: 10 },
  { id: "INC-003", locationId: "LEOPOLD_CAFE", type: "Incident", title: mumbaiCaseLocations.LEOPOLD_CAFE.name, date: "2008-11-26", severity: "HIGH", coordinates: point("LEOPOLD_CAFE"), intensity: 8 },
  { id: "INC-004", locationId: "TAJ_MAHAL_PALACE", type: "Incident", title: mumbaiCaseLocations.TAJ_MAHAL_PALACE.name, date: "2008-11-26", severity: "CRITICAL", coordinates: point("TAJ_MAHAL_PALACE"), intensity: 10 },
  { id: "INC-005", locationId: "OBEROI_TRIDENT", type: "Incident", title: mumbaiCaseLocations.OBEROI_TRIDENT.name, date: "2008-11-26", severity: "CRITICAL", coordinates: point("OBEROI_TRIDENT"), intensity: 10 },
  { id: "INC-006", locationId: "NARIMAN_HOUSE", type: "Incident", title: mumbaiCaseLocations.NARIMAN_HOUSE.name, date: "2008-11-26", severity: "CRITICAL", coordinates: point("NARIMAN_HOUSE"), intensity: 10 },
  { id: "INC-007", locationId: "CAMA_HOSPITAL", type: "Response", title: mumbaiCaseLocations.CAMA_HOSPITAL.name, date: "2008-11-26", severity: "HIGH", coordinates: point("CAMA_HOSPITAL"), intensity: 8 },
  { id: "INC-008", locationId: "GIRGAUM_CHOWPATTY", type: "Evidence", title: mumbaiCaseLocations.GIRGAUM_CHOWPATTY.name, date: "2008-11-27", severity: "HIGH", coordinates: point("GIRGAUM_CHOWPATTY"), intensity: 8 },
  { id: "INC-009", locationId: "TAJ_MAHAL_PALACE", type: "Command", title: "Taj response command zone", date: "2008-11-27", severity: "HIGH", coordinates: point("TAJ_MAHAL_PALACE"), intensity: 7 },
  { id: "INC-010", locationId: "ARABIAN_SEA_ROUTE", type: "Evidence", title: mumbaiCaseLocations.ARABIAN_SEA_ROUTE.name, date: "2008-11-28", severity: "MED", coordinates: point("ARABIAN_SEA_ROUTE"), intensity: 6 },
] as const;

export const MUMBAI_GRAPH_NODES = [
  { id: "entity-unknown", label: "UNIDENTIFIED INDIVIDUAL", kind: "suspect", subtitle: "Identity unresolved in early record", risk: "HIGH", dateRange: ["2008-11-26", "2008-11-27"] },
  { id: "entity-kasab", label: "AJMAL AMIR KASAB", kind: "suspect", subtitle: "Identity confirmed after capture", risk: "HIGH", dateRange: ["2008-11-27", "2008-11-29"] },
  { id: "loc-landing", label: "BADHWAR PARK", kind: "location", subtitle: "Reconstructed landing area", risk: "LOW", dateRange: ["2008-11-26", "2008-11-29"] },
  { id: "loc-cst", label: "CST", kind: "location", subtitle: "Major incident site", risk: "LOW", dateRange: ["2008-11-26", "2008-11-27"] },
  { id: "loc-taj", label: "TAJ MAHAL PALACE", kind: "location", subtitle: "Major response location", risk: "LOW", dateRange: ["2008-11-26", "2008-11-29"] },
  { id: "loc-oberoi", label: "OBEROI-TRIDENT", kind: "location", subtitle: "Major response location", risk: "LOW", dateRange: ["2008-11-26", "2008-11-28"] },
  { id: "loc-nariman", label: "NARIMAN HOUSE", kind: "location", subtitle: "Major response location", risk: "LOW", dateRange: ["2008-11-26", "2008-11-28"] },
  { id: "ev-phone", label: "RECOVERED PHONES", kind: "evidence", subtitle: "Technical examination", dateRange: ["2008-11-27", "2008-11-29"] },
  { id: "ev-navigation", label: "NAVIGATION DATA", kind: "evidence", subtitle: "Maritime route comparison", dateRange: ["2008-11-27", "2008-11-29"] },
  { id: "ev-vessel", label: "MV KUBER", kind: "evidence", subtitle: "Recovered maritime evidence", dateRange: ["2008-11-27", "2008-11-29"] },
] as const;

export const MUMBAI_GRAPH_LINKS = [
  { id: "landing-route", source: "loc-landing", target: "loc-cst", linkKind: "colocation", label: "reconstructed movement" },
  { id: "landing-taj", source: "loc-landing", target: "loc-taj", linkKind: "colocation", label: "site route" },
  { id: "taj-oberoi", source: "loc-taj", target: "loc-oberoi", linkKind: "colocation", label: "parallel response" },
  { id: "oberoi-nariman", source: "loc-oberoi", target: "loc-nariman", linkKind: "colocation", label: "parallel response" },
  { id: "unknown-phone", source: "entity-unknown", target: "ev-phone", linkKind: "phone", label: "device recovery" },
  { id: "phone-kasab", source: "ev-phone", target: "entity-kasab", linkKind: "phone", label: "identity context" },
  { id: "vessel-navigation", source: "ev-vessel", target: "ev-navigation", linkKind: "colocation", label: "route evidence" },
  { id: "navigation-landing", source: "ev-navigation", target: "loc-landing", linkKind: "colocation", label: "route comparison" },
] as const;

export const MUMBAI_BOARD_NODES = [
  { id: "note-sites", type: "stickyNote", position: { x: 120, y: 120 }, data: { text: "Multiple South Mumbai locations were confirmed through emergency and police records." } },
  { id: "photo-route", type: "polaroid", position: { x: 480, y: 70 }, data: { caption: "COASTAL ROUTE / LANDING" } },
  { id: "note-digital", type: "stickyNote", position: { x: 420, y: 280 }, data: { text: "Recovered phones and navigation devices produced technical and relationship leads." } },
] as const;

export const MUMBAI_FACTS = [
  { id: "fact-001", type: "forensic", text: "Ten attackers reached Mumbai by sea and landed near South Mumbai before dispersing.", status: "verified" },
  { id: "fact-002", type: "testimonial", text: "Emergency calls initially described separate incidents before a coordinated pattern was established.", status: "verified" },
  { id: "fact-003", type: "forensic", text: "Recovered phones and navigation material were examined for technical and route evidence.", status: "verified" },
  { id: "fact-004", type: "forensic", text: "The surviving captured attacker was identified as Ajmal Amir Kasab after the early unidentified-person stage.", status: "verified" },
] as const;
