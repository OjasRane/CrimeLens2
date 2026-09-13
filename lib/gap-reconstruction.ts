import type { InvestigationId } from "@/data/investigations/types";

export type CameraAvailability = "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
export type CameraReviewStatus = "NOT_REVIEWED" | "REQUESTED" | "FOOTAGE_UNAVAILABLE" | "REVIEWED_NO_RELEVANT_FINDING" | "RELEVANT_FOOTAGE_FOUND";
export type GapCoordinates = { latitude: number; longitude: number };
export type GapCamera = { id: string; investigationId: InvestigationId; label: string; coordinates: GapCoordinates; sourceRef: string; isSynthetic: boolean; operationalFrom: string | null; operationalTo: string | null; recordingAvailability: CameraAvailability; retentionInformation: string | null; verifiedOrientation: Record<string, unknown> | null; createdAt: string; updatedAt: string };
export type GapObservation = { eventId: string; locationId: string; observedAt: string; earliestAt?: string; latestAt?: string; timePrecision: string; associationKind: "DOCUMENTED_SIGHTING" | "ANALYST_ASSUMPTION"; analystAssumptionNote?: string };
export type GapRequest = { entityId: string; startObservation: GapObservation; endObservation: GapObservation; travelMode: string; speedKmh: number; selectedTime?: string };
export type GapCandidate = { camera: GapCamera; included: boolean; reason: string; distanceFromStartKm: number; distanceToEndKm: number; earliestArrival: string | null; latestDeparture: string | null; operationalStatus: string; recordingAvailability: CameraAvailability };
export type GapPreview = { investigationId: InvestigationId; algorithmVersion: string; modelLabel: string; isEnvelope: boolean; feasible: boolean; reason: string; startCoordinates: GapCoordinates; endCoordinates: GapCoordinates; startTime: string; endTime: string; selectedTime: string; forwardRadiusKm: number; backwardRadiusKm: number; forwardRegion: number[][]; backwardRegion: number[][]; candidates: GapCandidate[]; excludedCameras: GapCandidate[]; inputs: GapRequest; id?: string; investigatorUserId?: string; createdAt?: string; reviews?: GapCameraReview[] };
export type GapCameraReview = { runId: string; cameraId: string; investigationId: string; status: CameraReviewStatus; notes: string; evidenceId: string | null; reviewedBy: string; updatedAt: string };

const EARTH_RADIUS_KM = 6371.0088;

function assertPoint(point: GapCoordinates) {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error("Invalid coordinates");
}

export function haversineDistanceKm(a: GapCoordinates, b: GapCoordinates) {
  assertPoint(a); assertPoint(b);
  const rad = Math.PI / 180;
  const lat1 = a.latitude * rad; const lat2 = b.latitude * rad;
  const dLat = (b.latitude - a.latitude) * rad; const dLon = (b.longitude - a.longitude) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
}

export function geodesicCircle(center: GapCoordinates, radiusKm: number, vertices = 96): [number, number][] {
  assertPoint(center);
  if (!Number.isFinite(radiusKm) || radiusKm < 0) throw new Error("Invalid radius");
  const lat1 = center.latitude * Math.PI / 180; const lon1 = center.longitude * Math.PI / 180;
  const angular = radiusKm / EARTH_RADIUS_KM;
  return Array.from({ length: vertices + 1 }, (_, index) => {
    const bearing = index * 2 * Math.PI / vertices;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    return [((lon2 * 180 / Math.PI + 540) % 360) - 180, lat2 * 180 / Math.PI];
  });
}

export function reachabilityAt(preview: GapPreview, selectedTime: string) {
  const start = Date.parse(preview.startTime); const end = Date.parse(preview.endTime); const at = Date.parse(selectedTime);
  if (![start, end, at].every(Number.isFinite) || at < start || at > end || end <= start) throw new Error("Invalid analysis time");
  const speed = preview.inputs.speedKmh;
  const forwardRadiusKm = speed * (at - start) / 3_600_000;
  const backwardRadiusKm = speed * (end - at) / 3_600_000;
  return { forwardRadiusKm, backwardRadiusKm, forwardRegion: geodesicCircle(preview.startCoordinates, forwardRadiusKm), backwardRegion: geodesicCircle(preview.endCoordinates, backwardRadiusKm) };
}
