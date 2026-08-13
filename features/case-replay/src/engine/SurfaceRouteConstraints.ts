export type MovementSurface = "WATER" | "LAND" | "ROAD";
export type EntityLifecycle = "spawn" | "active" | "handoff" | "stop" | "exit";

export type SurfaceWaypoint = {
  position: readonly [number, number, number];
  surface: MovementSurface;
  lifecycle: EntityLifecycle;
};

export type SurfaceBoundary = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const DINGHY_WATER_BOUNDARY: SurfaceBoundary = { minX: -6.4, maxX: -1.72, minZ: -2.6, maxZ: 2.8 };

export function validateSurfaceRoute(name: string, allowedSurface: MovementSurface, route: readonly SurfaceWaypoint[]) {
  if (route.length < 2) throw new Error(`${name} requires at least two constrained waypoints.`);
  const invalid = route.find((waypoint) => waypoint.surface !== allowedSurface);
  if (invalid) throw new Error(`${name} cannot enter ${invalid.surface}; allowed surface is ${allowedSurface}.`);
  if (route.at(-1)?.lifecycle !== "stop" && route.at(-1)?.lifecycle !== "exit" && route.at(-1)?.lifecycle !== "handoff") {
    throw new Error(`${name} route must end in stop, handoff, or exit.`);
  }
  return route;
}

export const MV_KUBER_ROUTE = validateSurfaceRoute("MV Kuber", "WATER", [
  { position: [-1.1, .52, 0], surface: "WATER", lifecycle: "spawn" },
  { position: [-.65, .52, -.08], surface: "WATER", lifecycle: "active" },
  { position: [-.35, .52, -.16], surface: "WATER", lifecycle: "handoff" },
] as const);

export const DINGHY_ROUTE = validateSurfaceRoute("Inflatable dinghy", "WATER", [
  { position: [-4.8, .27, 1.65], surface: "WATER", lifecycle: "spawn" },
  { position: [-3.2, .27, 1.05], surface: "WATER", lifecycle: "active" },
  { position: [-2.25, .27, .52], surface: "WATER", lifecycle: "active" },
  { position: [-1.76, .27, .18], surface: "WATER", lifecycle: "stop" },
] as const);

export function sampleConstrainedRoute(route: readonly SurfaceWaypoint[], progress: number, boundary?: SurfaceBoundary): [number, number, number] {
  const safe = Math.max(0, Math.min(1, progress));
  const scaled = safe * (route.length - 1);
  const index = Math.min(route.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = route[index].position;
  const to = route[index + 1].position;
  const point: [number, number, number] = [from[0] + (to[0] - from[0]) * local, from[1] + (to[1] - from[1]) * local, from[2] + (to[2] - from[2]) * local];
  if (!boundary) return point;
  point[0] = Math.max(boundary.minX, Math.min(boundary.maxX, point[0]));
  point[2] = Math.max(boundary.minZ, Math.min(boundary.maxZ, point[2]));
  return point;
}
