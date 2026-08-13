"use client";

import mapboxgl, { type GeoJSONSource, type Map } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { lngLat, mumbaiCaseLocations, type MumbaiCaseLocationId } from "@replay/data/mumbai-case-locations";

type RouteGroup = {
  id: string;
  label: string;
  color: string;
  revealAt: number;
  locations: MumbaiCaseLocationId[];
};

export const MUMBAI_REPLAY_CAMERA_PRESETS = {
  MUMBAI_OVERVIEW: { center: [72.8285, 18.9255] as [number, number], zoom: 12.7 },
  SOUTH_MUMBAI_OVERVIEW: { center: [72.8285, 18.924] as [number, number], zoom: 13.45 },
  BADHWAR_APPROACH: { center: lngLat("BADHWAR_PARK"), zoom: 15.25 },
  CST_FOCUS: { center: lngLat("CST"), zoom: 15.8 },
  TAJ_FOCUS: { center: lngLat("TAJ_MAHAL_PALACE"), zoom: 16 },
  OBEROI_FOCUS: { center: lngLat("OBEROI_TRIDENT"), zoom: 15.8 },
  NARIMAN_HOUSE_FOCUS: { center: lngLat("NARIMAN_HOUSE"), zoom: 16 },
  CITYWIDE_INCIDENT_OVERVIEW: { center: [72.827, 18.926] as [number, number], zoom: 13.25 },
  FINAL_CASE_OVERVIEW: { center: [72.8255, 18.925] as [number, number], zoom: 12.9 },
} as const;

// Relationship traces join confirmed locations. They are deliberately not
// presented as turn-by-turn street routes.
const ROUTE_GROUPS: RouteGroup[] = [
  { id: "cst-group", label: "CST GROUP", color: "#f4c94f", revealAt: .12, locations: ["BADHWAR_PARK", "CST"] },
  { id: "leopold-taj-group", label: "LEOPOLD / TAJ GROUP", color: "#dd684f", revealAt: .29, locations: ["BADHWAR_PARK", "LEOPOLD_CAFE", "TAJ_MAHAL_PALACE"] },
  { id: "oberoi-group", label: "OBEROI GROUP", color: "#3d78cc", revealAt: .48, locations: ["BADHWAR_PARK", "OBEROI_TRIDENT"] },
  { id: "nariman-group", label: "NARIMAN HOUSE GROUP", color: "#2baf83", revealAt: .65, locations: ["BADHWAR_PARK", "NARIMAN_HOUSE"] },
];

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function routeCollection(progress: number) {
  return {
    type: "FeatureCollection" as const,
    features: ROUTE_GROUPS.filter((route) => progress >= route.revealAt).map((route) => ({
      type: "Feature" as const,
      properties: { id: route.id, label: route.label, color: route.color },
      geometry: { type: "LineString" as const, coordinates: route.locations.map(lngLat) },
    })),
  };
}

// These are static case routes. Build them once instead of rebuilding GeoJSON on every replay tick.
const ROUTE_STAGES = [0, .12, .29, .48, .65] as const;
const ROUTE_COLLECTIONS = ROUTE_STAGES.map(routeCollection);
const MARKER_REVEALS = [0, .12, .29, .4, .48, .65] as const;

function routeStage(progress: number) {
  for (let index = ROUTE_STAGES.length - 1; index >= 0; index -= 1) {
    if (progress >= ROUTE_STAGES[index]) return index;
  }
  return 0;
}

export function preloadReplayMap() {
  // Warms Mapbox workers/styles while the opening chapter is visible. It is a no-op when unsupported.
  mapboxgl.prewarm?.();
}

const MARKER_ORDER: MumbaiCaseLocationId[] = ["BADHWAR_PARK", "CST", "LEOPOLD_CAFE", "TAJ_MAHAL_PALACE", "OBEROI_TRIDENT", "NARIMAN_HOUSE"];

export function ReplayGeospatialMap({ active, progress, eventId }: { active: boolean; progress: number; eventId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const lastLayoutRef = useRef<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      center: MUMBAI_REPLAY_CAMERA_PRESETS.SOUTH_MUMBAI_OVERVIEW.center,
      zoom: MUMBAI_REPLAY_CAMERA_PRESETS.SOUTH_MUMBAI_OVERVIEW.zoom,
      minZoom: 11,
      maxZoom: 17,
      attributionControl: true,
      interactive: false,
      style: {
        version: 8,
        sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
        layers: [
          { id: "ground", type: "background", paint: { "background-color": "#e9e5da" } },
          { id: "osm-parchment", type: "raster", source: "osm", paint: { "raster-saturation": -.94, "raster-contrast": .3, "raster-brightness-min": .66, "raster-brightness-max": .96, "raster-opacity": .92 } },
        ],
      },
    });
    mapRef.current = map;
    map.on("load", () => {
      map.addSource("replay-routes", { type: "geojson", lineMetrics: true, data: ROUTE_COLLECTIONS[0] ?? EMPTY_COLLECTION });
      map.addLayer({ id: "replay-routes-shadow", type: "line", source: "replay-routes", paint: { "line-color": "#111", "line-width": 6, "line-opacity": .75 } });
      map.addLayer({ id: "replay-routes", type: "line", source: "replay-routes", paint: { "line-color": ["get", "color"], "line-width": 3.2, "line-opacity": .96 } });
      markersRef.current = MARKER_ORDER.map((id, index) => {
        const location = mumbaiCaseLocations[id];
        const element = document.createElement("div");
        element.className = "case-replay-map-marker";
        element.dataset.index = String(index);
        element.dataset.kind = location.category;
        element.innerHTML = `<i></i><span>${location.name}</span>`;
        return new mapboxgl.Marker({ element, anchor: "bottom" }).setLngLat(lngLat(id)).addTo(map);
      });
      setStatus("ready");
    });
    map.on("error", () => setStatus((current) => current === "ready" ? current : "error"));
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const stage = routeStage(progress);
    const cameraStage = progress > .82 ? "cst" : progress < .12 ? "landing" : "overview";
    const layoutKey = `${eventId}:${stage}:${cameraStage}`;
    if (lastLayoutRef.current === layoutKey) return;
    lastLayoutRef.current = layoutKey;
    (map.getSource("replay-routes") as GeoJSONSource | undefined)?.setData(ROUTE_COLLECTIONS[stage] ?? EMPTY_COLLECTION);
    markersRef.current.forEach((marker, index) => {
      const revealAt = MARKER_REVEALS[index] ?? 1;
      marker.getElement().dataset.visible = String(progress >= revealAt);
      marker.getElement().dataset.active = String((eventId === "TL-003" && index === 1 && progress > .82) || (index === 0 && progress < .12));
    });
    const preset = cameraStage === "cst" ? MUMBAI_REPLAY_CAMERA_PRESETS.CST_FOCUS : cameraStage === "landing" ? MUMBAI_REPLAY_CAMERA_PRESETS.BADHWAR_APPROACH : MUMBAI_REPLAY_CAMERA_PRESETS.SOUTH_MUMBAI_OVERVIEW;
    map.easeTo({ center: preset.center, zoom: preset.zoom, duration: 360, essential: true });
  }, [eventId, progress, status]);

  return <section className="case-replay-map-layer" data-status={status} data-active={active} aria-hidden={!active} aria-label="Real geographic map of South Mumbai">
    <div ref={containerRef} className="case-replay-map-canvas" />
    <div className="case-replay-map-key" aria-hidden="true">
      <span>REAL GEOGRAPHIC BASEMAP / OSM</span>
      <strong>SOUTH MUMBAI INCIDENT GEOGRAPHY</strong>
      <small>Group traces connect verified locations; not turn-by-turn paths.</small>
    </div>
  </section>;
}
