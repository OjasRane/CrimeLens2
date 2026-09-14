import { describe, expect, it } from "vitest";
import { geodesicCircle, haversineDistanceKm, reachabilityAt, type GapPreview } from "./gap-reconstruction";

describe("gap reconstruction spatial helpers", () => {
  it("computes stable Haversine distances and closed geodesic rings", () => {
    expect(haversineDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 3);
    const ring = geodesicCircle({ latitude: 80, longitude: 170 }, 25, 24);
    expect(ring[0]).toEqual(ring.at(-1));
    expect(ring.every(([longitude, latitude]) => Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90)).toBe(true);
  });

  it("scrubs reachability locally without changing the saved inputs", () => {
    const preview = { startTime:"2026-01-01T00:00:00Z", endTime:"2026-01-01T02:00:00Z", startCoordinates:{latitude:0,longitude:0}, endCoordinates:{latitude:0,longitude:1}, inputs:{speedKmh:40} } as GapPreview;
    const result = reachabilityAt(preview, "2026-01-01T00:30:00Z");
    expect(result.forwardRadiusKm).toBe(20);
    expect(result.backwardRadiusKm).toBe(60);
  });

  it("rejects missing locations and out-of-interval scrub values", () => {
    expect(() => haversineDistanceKm({ latitude: Number.NaN, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow();
    const preview = { startTime:"2026-01-01T00:00:00Z", endTime:"2026-01-01T01:00:00Z", startCoordinates:{latitude:0,longitude:0}, endCoordinates:{latitude:0,longitude:1}, inputs:{speedKmh:40} } as GapPreview;
    expect(() => reachabilityAt(preview, "2025-12-31T23:00:00Z")).toThrow();
  });
});
