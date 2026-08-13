export type MumbaiCaseLocationId =
  | "BADHWAR_PARK" | "NARIMAN_POINT" | "CST" | "LEOPOLD_CAFE"
  | "TAJ_MAHAL_PALACE" | "OBEROI_TRIDENT" | "NARIMAN_HOUSE"
  | "CAMA_HOSPITAL" | "GIRGAUM_CHOWPATTY" | "ARABIAN_SEA_ROUTE";

export type MumbaiCaseLocation = {
  id: MumbaiCaseLocationId;
  name: string;
  latitude: number;
  longitude: number;
  category: "landing" | "district" | "incident" | "response" | "evidence";
  chapterIds: number[];
  timelineEventIds: string[];
  evidenceRefs: string[];
  landmarkModel?: "cst" | "taj" | "oberoi" | "nariman-house";
  verified: boolean;
  source: string;
  notes: string;
};

/** One geographic source of truth shared by the CrimeLens map and replay. */
export const mumbaiCaseLocations: Record<MumbaiCaseLocationId, MumbaiCaseLocation> = {
  BADHWAR_PARK: { id: "BADHWAR_PARK", name: "Badhwar Park landing area", latitude: 18.9102, longitude: 72.8258, category: "landing", chapterIds: [2, 3, 8, 9], timelineEventIds: ["TL-002", "TL-003", "TL-014", "TL-016"], evidenceRefs: ["photo-route", "ev-navigation"], verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Reused without replay-specific adjustment; landing-area marker." },
  NARIMAN_POINT: { id: "NARIMAN_POINT", name: "Nariman Point", latitude: 18.926912, longitude: 72.819745, category: "district", chapterIds: [3, 5, 6, 9], timelineEventIds: ["TL-003", "TL-006", "TL-008", "TL-016"], evidenceRefs: [], verified: true, source: "OpenStreetMap-linked Wikimedia geographic metadata", notes: "District orientation reference only; never rendered as an incident." },
  CST: { id: "CST", name: "Chhatrapati Shivaji Terminus", latitude: 18.9398, longitude: 72.8355, category: "incident", chapterIds: [3, 4, 9], timelineEventIds: ["TL-003", "TL-004", "TL-016"], evidenceRefs: ["note-sites"], landmarkModel: "cst", verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map incident coordinate." },
  LEOPOLD_CAFE: { id: "LEOPOLD_CAFE", name: "Leopold Cafe", latitude: 18.922, longitude: 72.8315, category: "incident", chapterIds: [3, 4, 9], timelineEventIds: ["TL-003", "TL-004", "TL-016"], evidenceRefs: ["note-sites"], verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map incident coordinate." },
  TAJ_MAHAL_PALACE: { id: "TAJ_MAHAL_PALACE", name: "Taj Mahal Palace", latitude: 18.9217, longitude: 72.8332, category: "incident", chapterIds: [3, 5, 6, 7, 9], timelineEventIds: ["TL-003", "TL-007", "TL-009", "TL-010", "TL-015", "TL-016"], evidenceRefs: ["note-sites"], landmarkModel: "taj", verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map incident coordinate." },
  OBEROI_TRIDENT: { id: "OBEROI_TRIDENT", name: "Oberoi-Trident", latitude: 18.9283, longitude: 72.8208, category: "incident", chapterIds: [3, 5, 6, 7, 9], timelineEventIds: ["TL-003", "TL-008", "TL-009", "TL-010", "TL-015", "TL-016"], evidenceRefs: ["note-sites"], landmarkModel: "oberoi", verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map incident coordinate." },
  NARIMAN_HOUSE: { id: "NARIMAN_HOUSE", name: "Nariman House", latitude: 18.9109, longitude: 72.8291, category: "incident", chapterIds: [3, 5, 6, 7, 9], timelineEventIds: ["TL-003", "TL-008", "TL-009", "TL-010", "TL-015", "TL-016"], evidenceRefs: ["note-sites"], landmarkModel: "nariman-house", verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map incident coordinate." },
  CAMA_HOSPITAL: { id: "CAMA_HOSPITAL", name: "Cama Hospital response area", latitude: 18.9418, longitude: 72.8335, category: "response", chapterIds: [4, 6, 9], timelineEventIds: ["TL-004", "TL-005", "TL-016"], evidenceRefs: ["note-sites"], verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Response-area reference retained from the working map." },
  GIRGAUM_CHOWPATTY: { id: "GIRGAUM_CHOWPATTY", name: "Girgaum Chowpatty capture site", latitude: 18.9545, longitude: 72.812, category: "evidence", chapterIds: [8, 9], timelineEventIds: ["TL-012", "TL-016"], evidenceRefs: ["ev-phone"], verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Existing case-map evidence coordinate." },
  ARABIAN_SEA_ROUTE: { id: "ARABIAN_SEA_ROUTE", name: "Maritime evidence route", latitude: 18.9, longitude: 72.795, category: "evidence", chapterIds: [1, 8, 9], timelineEventIds: ["TL-001", "TL-014", "TL-016"], evidenceRefs: ["ev-vessel", "ev-navigation"], verified: true, source: "Existing CrimeLens MUMBAI_MAP_INCIDENTS registry", notes: "Evidence-route reference point, not a precise track waypoint." },
};

export const mumbaiCaseLocationList = Object.values(mumbaiCaseLocations);
export const lngLat = (id: MumbaiCaseLocationId): [number, number] => {
  const location = mumbaiCaseLocations[id];
  return [location.longitude, location.latitude];
};
