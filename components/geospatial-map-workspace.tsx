"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Pause, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import Map, { Marker } from "react-map-gl/maplibre";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== "undefined") {
  // Official MapLibre v6 API to bypass Webpack ESM worker bundling
  setWorkerUrl("/maplibre-gl-worker.js");
}
import {
  type SpatialBounds,
  type IncidentPoint,
  type MovementArc,
  useInvestigationStore,
} from "@/store/use-investigation-store";
import { triggerHaptic } from "@/lib/haptics";
import {
  getInvestigation,
  getLocationsForEntity,
} from "@/data/investigations/registry";
import type { InvestigationLocation } from "@/data/investigations/types";

/* ─── Deck.gl imports ─────────────────────────── */

import { DeckGL } from "@deck.gl/react";
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { ArcLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  AmbientLight,
  DirectionalLight,
  FlyToInterpolator,
  LightingEffect,
} from "@deck.gl/core";

type ActiveLayerType = "PINS" | "HEAT" | "DENSITY" | "ROUTES";
type ViewMode = "2D" | "3D";

/* ─── Types ───────────────────────────────────── */

type CrimeType = "Burglary" | "Assault" | "Fraud" | "Robbery" | "Arson";
type IncidentSeverity = "LOW" | "MED" | "HIGH" | "CRITICAL";

type Incident = {
  id: string;
  type: CrimeType;
  title: string;
  date: string;
  severity: IncidentSeverity;
  coordinates: [number, number];
  intensity: number;
};

type TelemetryPath = MovementArc & {
  path: [number, number][];
  opacity: number;
};

type TrackingTarget = {
  id: string;
  coordinates: [number, number];
  label: string;
};

const crimeTypes: CrimeType[] = [
  "Burglary",
  "Assault",
  "Fraud",
  "Robbery",
  "Arson",
];

// Original incidents kept for the filter panel count
const incidents: Incident[] = [
  {
    id: "INC-001",
    type: "Burglary",
    title: "Station Locker Breach",
    date: "2026-07-18",
    severity: "HIGH",
    coordinates: [-87.6285, 41.884],
    intensity: 8,
  },
  {
    id: "INC-002",
    type: "Assault",
    title: "Alley Witness Report",
    date: "2026-07-18",
    severity: "MED",
    coordinates: [-87.632, 41.879],
    intensity: 5,
  },
  {
    id: "INC-003",
    type: "Fraud",
    title: "Ticket Ledger Mismatch",
    date: "2026-07-19",
    severity: "LOW",
    coordinates: [-87.6231, 41.8822],
    intensity: 3,
  },
  {
    id: "INC-004",
    type: "Robbery",
    title: "North Arcade Holdup",
    date: "2026-07-20",
    severity: "HIGH",
    coordinates: [-87.6198, 41.8894],
    intensity: 7,
  },
  {
    id: "INC-005",
    type: "Burglary",
    title: "Evidence Room Entry",
    date: "2026-07-20",
    severity: "CRITICAL",
    coordinates: [-87.6142, 41.8757],
    intensity: 10,
  },
  {
    id: "INC-006",
    type: "Assault",
    title: "Platform Stairwell Fight",
    date: "2026-07-21",
    severity: "HIGH",
    coordinates: [-87.641, 41.8866],
    intensity: 8,
  },
  {
    id: "INC-007",
    type: "Fraud",
    title: "Annex Deposit Forgery",
    date: "2026-07-22",
    severity: "MED",
    coordinates: [-87.6367, 41.8921],
    intensity: 4,
  },
  {
    id: "INC-008",
    type: "Arson",
    title: "Loading Dock Fire",
    date: "2026-07-22",
    severity: "HIGH",
    coordinates: [-87.61, 41.8695],
    intensity: 9,
  },
  {
    id: "INC-009",
    type: "Burglary",
    title: "Clerk Office Forced Entry",
    date: "2026-07-23",
    severity: "MED",
    coordinates: [-87.6465, 41.8786],
    intensity: 6,
  },
  {
    id: "INC-010",
    type: "Robbery",
    title: "Canal Street Bag Snatch",
    date: "2026-07-24",
    severity: "MED",
    coordinates: [-87.6391, 41.8738],
    intensity: 5,
  },
  {
    id: "INC-011",
    type: "Assault",
    title: "Transit Hall Battery",
    date: "2026-07-24",
    severity: "CRITICAL",
    coordinates: [-87.6287, 41.875],
    intensity: 9,
  },
  {
    id: "INC-012",
    type: "Fraud",
    title: "Counterfeit Transfer Book",
    date: "2026-07-25",
    severity: "LOW",
    coordinates: [-87.6209, 41.8795],
    intensity: 3,
  },
  {
    id: "INC-013",
    type: "Burglary",
    title: "Archive Cage Breach",
    date: "2026-07-25",
    severity: "HIGH",
    coordinates: [-87.6173, 41.8838],
    intensity: 8,
  },
  {
    id: "INC-014",
    type: "Arson",
    title: "Viaduct Accelerant Trace",
    date: "2026-07-26",
    severity: "MED",
    coordinates: [-87.6501, 41.882],
    intensity: 6,
  },
  {
    id: "INC-015",
    type: "Robbery",
    title: "Market Row Threat",
    date: "2026-07-26",
    severity: "HIGH",
    coordinates: [-87.6338, 41.8905],
    intensity: 7,
  },
  {
    id: "INC-016",
    type: "Assault",
    title: "Back-Lot Confrontation",
    date: "2026-07-27",
    severity: "MED",
    coordinates: [-87.6117, 41.8724],
    intensity: 5,
  },
  {
    id: "INC-017",
    type: "Burglary",
    title: "Tool Room Tamper",
    date: "2026-07-27",
    severity: "LOW",
    coordinates: [-87.6261, 41.8912],
    intensity: 4,
  },
  {
    id: "INC-018",
    type: "Fraud",
    title: "Signal Ledger Substitution",
    date: "2026-07-28",
    severity: "HIGH",
    coordinates: [-87.6429, 41.8847],
    intensity: 7,
  },
];

/* ─── SUSPECT → INCIDENT LINKS ─────────────────────────── */

const suspectIncidentLinks: Record<string, string[]> = {
  "sus-ada": ["INC-001", "INC-005", "INC-008", "INC-013"],
  "sus-marlowe": ["INC-002", "INC-006", "INC-009", "INC-016"],
  "sus-vale": ["INC-003", "INC-007", "INC-010", "INC-012", "INC-018"],
};

const playbackDates = Array.from(
  new Set(incidents.map((incident) => incident.date)),
).sort();

/* ─── Deck.gl constants ───────────────────────── */

const HEXAGON_COLOR_RANGE: [number, number, number][] = [
  [1, 22, 30], // #01161E — deepest (base void)
  [18, 69, 89], // #124559
  [49, 100, 118], // interpolated
  [89, 131, 146], // #598392
  [140, 165, 160], // interpolated
  [174, 195, 176], // #AEC3B0 — peak (phosphor sage)
];

const HIGHLIGHT_COLOR: [number, number, number, number] = [239, 246, 224, 255]; // #EFF6E0

// Lighting for 3D hexagon shadows
const ambientLight = new AmbientLight({
  color: [255, 255, 255],
  intensity: 1.0,
});

const directionalLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.5,
  direction: [-3, -9, -1],
});

const lightingEffect = new LightingEffect({
  ambientLight,
  directionalLight,
});

/* ─── Map style configs ───────────────────────── */

const LIGHT_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const DARK_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/* ─── Helpers ─────────────────────────────────── */

function isWithinBounds(
  coords: [number, number],
  bounds: SpatialBounds | null,
) {
  if (!bounds) return true;
  const [longitude, latitude] = coords;
  return (
    latitude <= bounds.north &&
    latitude >= bounds.south &&
    longitude <= bounds.east &&
    longitude >= bounds.west
  );
}

function TacticalMarker({ color }: { color: string }) {
  return (
    <div
      className="h-4 w-4 border border-[#EFF6E0] shadow-[0_0_10px_rgba(239,246,224,0.3)]"
      style={{
        backgroundColor: color,
        transform: "rotate(45deg)",
      }}
    />
  );
}

/* ─── Tooltip renderer ────────────────────────── */

function getTooltip({
  object,
  layer,
}: {
  object?: unknown;
  layer?: { id?: string };
}) {
  if (!object) return null;

  if (layer?.id === "hexagon-layer") {
    const hex = object as { points?: unknown[]; elevationValue?: number };
    const count = hex.points?.length ?? hex.elevationValue ?? 0;
    return {
      html: `
        <div style="
          background: rgba(18,69,89,0.92);
          backdrop-filter: blur(12px);
          border: 1px solid #598392;
          border-radius: 0;
          padding: 10px 14px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 900;
          color: #EFF6E0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 4px 20px rgba(1,22,30,0.6);
        ">
          <div style="color: #598392; font-size: 9px; margin-bottom: 4px;">CRIME DENSITY ANALYSIS</div>
          <div style="font-size: 16px; color: #AEC3B0;">${count} INCIDENTS</div>
          <div style="color: #598392; font-size: 9px; margin-top: 4px;">HEX BIN AGGREGATE</div>
        </div>
      `,
      style: {
        backgroundColor: "transparent",
        border: "none",
        padding: "0",
      },
    };
  }

  if (layer?.id === "arc-layer") {
    const arc = object as MovementArc;
    return {
      html: `
        <div style="
          background: rgba(18,69,89,0.92);
          backdrop-filter: blur(12px);
          border: 1px solid #598392;
          border-radius: 0;
          padding: 10px 14px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 900;
          color: #EFF6E0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 4px 20px rgba(1,22,30,0.6);
        ">
          <div style="color: #598392; font-size: 9px; margin-bottom: 4px;">MOVEMENT TRACE</div>
          <div style="color: #AEC3B0; margin-bottom: 4px;">${arc.label}</div>
          <div>IN: ${arc.inbound} / OUT: ${arc.outbound}</div>
          <div style="color: #598392; font-size: 9px; margin-top: 4px;">${arc.date}</div>
        </div>
      `,
      style: {
        backgroundColor: "transparent",
        border: "none",
        padding: "0",
      },
    };
  }

  return null;
}

/* ─── Component ───────────────────────────────── */

export function GeospatialMapWorkspace() {
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ActiveLayerType>("PINS");
  const [viewMode, setViewMode] = useState<ViewMode>("2D");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const activeInvestigationId = useInvestigationStore(
    (s) => s.activeInvestigationId,
  );
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const crimeTypes = activeInvestigation.map.filterGroups;
  const activeLocations = activeInvestigation.map.locations.filter(
    (
      location,
    ): location is InvestigationLocation & { coordinates: [number, number] } =>
      Boolean(location.coordinates),
  );
  const playbackDates = Array.from(
    new Set(activeInvestigation.timeline.events.map((event) => event.date)),
  ).sort();

  const selectedCrimeTypes = useInvestigationStore((s) => s.selectedCrimeTypes);
  const setSelectedCrimeTypeEnabled = useInvestigationStore(
    (s) => s.setSelectedCrimeTypeEnabled,
  );
  const spatialBounds = useInvestigationStore((s) => s.spatialBounds);
  const playbackDate = useInvestigationStore((s) => s.playbackDate);
  const setPlaybackDate = useInvestigationStore((s) => s.setPlaybackDate);
  const isMapPlaying = useInvestigationStore((s) => s.isMapPlaying);
  const setIsMapPlaying = useInvestigationStore((s) => s.setIsMapPlaying);
  const timeRange = useInvestigationStore((s) => s.timeRange);
  const incidentData = useInvestigationStore((s) => s.incidentData);
  const movementData = useInvestigationStore((s) => s.movementData);
  const mapPanRequest = useInvestigationStore((s) => s.mapPanRequest);
  const selectedEntityId = useInvestigationStore((s) => s.selectedEntityId);
  const selectedLocationId = useInvestigationStore(
    (s) => s.selectedLocationId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (s) => s.setSelectedLocationId,
  );
  const clearAllFilters = useInvestigationStore((s) => s.clearAllFilters);

  const selectedLocation = activeInvestigation.map.locations.find(
    (location) => location.id === selectedLocationId,
  );
  const relatedLocationIds = useMemo(
    () =>
      new Set(
        selectedEntityId
          ? getLocationsForEntity(activeInvestigation, selectedEntityId).map(
              (location) => location.id,
            )
          : [],
      ),
    [activeInvestigation, selectedEntityId],
  );

  const activeIncidentData = useMemo<IncidentPoint[]>(
    () =>
      activeInvestigationId === "demo"
        ? incidentData
        : activeLocations
            .filter((location) => (location.killed ?? 0) + (location.injured ?? 0) > 0)
            .map((location) => ({
              coordinates: location.coordinates,
              weight: (location.killed ?? 0) + (location.injured ?? 0),
              date: location.date,
            })),
    [activeInvestigationId, activeLocations, incidentData],
  );

  const activeMovementData = useMemo<MovementArc[]>(() => {
    if (activeInvestigationId === "demo") return movementData;

    const locationById = new globalThis.Map(
      activeLocations.map((location) => [location.id, location] as const),
    );
    return activeInvestigation.map.routes.flatMap((route) =>
      route.locationIds.slice(1).flatMap((locationId, index) => {
        const from = locationById.get(route.locationIds[index]);
        const to = locationById.get(locationId);
        if (!from || !to) return [];
        return [
          {
            from: { coordinates: from.coordinates },
            to: { coordinates: to.coordinates },
            routeId: route.id,
            memberEntityIds: route.memberEntityIds,
            locationIds: route.locationIds,
            inbound: 0,
            outbound: 0,
            date: activeInvestigation.timeline.startDate,
            label: `${route.label} // ${route.teamLabel}`,
          },
        ];
      }),
    );
  }, [activeInvestigation, activeInvestigationId, activeLocations, movementData]);

  const playbackIndex = Math.max(0, playbackDates.indexOf(playbackDate));

  /* ── Deck.gl view state ────────────────────── */

  const [viewState, setViewState] = useState({
    longitude: -87.6298,
    latitude: 41.8818,
    zoom: 12.7,
    pitch: 0,
    bearing: 0,
  });

  useEffect(() => {
    setActiveLayer("PINS");
    setViewState({
      longitude: activeInvestigation.map.center[0],
      latitude: activeInvestigation.map.center[1],
      zoom: activeInvestigation.map.zoom,
      pitch: 0,
      bearing: 0,
    });
  }, [activeInvestigation]);

  const changeViewMode = useCallback((mode: ViewMode) => {
    const camera =
      mode === "3D" ? { pitch: 60, bearing: -15 } : { pitch: 0, bearing: 0 };

    setViewMode(mode);
    // Deck.gl is the single camera owner. Running this on every click also lets
    // the active button restore its intended camera after manual interaction.
    setViewState((current) => ({
      ...current,
      ...camera,
      transitionDuration: 1500,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, []);

  useEffect(() => {
    if (!mapPanRequest) return;

    setViewState((current) => ({
      ...current,
      longitude: mapPanRequest.coordinates[0],
      latitude: mapPanRequest.coordinates[1],
      zoom: Math.max(current.zoom, 15),
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, [mapPanRequest]);

  /* ── Memoized filtered data for Deck.gl ──── */

  const filteredIncidents = useMemo(
    () =>
      activeIncidentData.filter(
        (d) =>
          d.date <= playbackDate &&
          d.date >= timeRange[0] &&
          d.date <= timeRange[1] &&
          isWithinBounds(d.coordinates, spatialBounds),
      ),
    [activeIncidentData, playbackDate, timeRange, spatialBounds],
  );

  const filteredMovements = useMemo(
    () =>
      activeMovementData.filter(
        (d) =>
          d.date <= playbackDate &&
          d.date >= timeRange[0] &&
          d.date <= timeRange[1],
      ),
    [activeMovementData, playbackDate, timeRange],
  );

  // Original incidents for filter counts
  const visibleIncidents = useMemo(
    () =>
      activeLocations.filter(
        (incident) =>
          incident.filterGroups.some((group) =>
            selectedCrimeTypes.includes(group),
          ) &&
          incident.date <= playbackDate &&
          incident.date >= timeRange[0] &&
          incident.date <= timeRange[1] &&
          isWithinBounds(incident.coordinates, spatialBounds),
      ),
    [activeLocations, playbackDate, selectedCrimeTypes, spatialBounds, timeRange],
  );

  const filterCounts = useMemo(
    () =>
      crimeTypes.reduce<Record<string, number>>(
        (counts, crimeType) => {
          counts[crimeType] = activeLocations.filter(
            (incident) =>
              incident.filterGroups.includes(crimeType) &&
              incident.date <= playbackDate &&
              incident.date >= timeRange[0] &&
              incident.date <= timeRange[1] &&
              isWithinBounds(incident.coordinates, spatialBounds),
          ).length;
          return counts;
        },
        {},
      ),
    [activeLocations, crimeTypes, playbackDate, spatialBounds, timeRange],
  );

  /* ── Deck.gl layers ────────────────────────── */

  const layers = useMemo(() => {
    const result = [];
    if (activeLayer === "HEAT" && activeInvestigationId === "mumbai-2611") {
      result.push(
        new HeatmapLayer<IncidentPoint>({
          id: "heat-layer",
          data: filteredIncidents,
          getPosition: (d) => d.coordinates,
          getWeight: (d) => d.weight,
          radiusPixels: 60,
          intensity: 1,
          threshold: 0.03,
          colorRange: [
            [252, 211, 77, 35],
            [252, 211, 77, 120],
            [210, 43, 43, 180],
            [210, 43, 43, 255],
          ],
          pickable: true,
        }),
      );
    }
    if (activeLayer === "DENSITY" && activeInvestigationId === "demo") {
      result.push(
        new HexagonLayer<IncidentPoint>({
          id: "hexagon-layer",
          data: filteredIncidents,
          getPosition: (d: IncidentPoint) => d.coordinates,
          getElevationWeight: (d: IncidentPoint) => d.weight,
          elevationScale: 50,
          elevationRange: [0, 3000],
          extruded: true,
          radius: 200,
          colorRange: HEXAGON_COLOR_RANGE,
          pickable: true,
          autoHighlight: true,
          highlightColor: HIGHLIGHT_COLOR,
          coverage: 0.88,
          upperPercentile: 95,
          material: {
            ambient: 0.5,
            diffuse: 0.6,
            shininess: 20,
            specularColor: [89, 131, 146],
          },
        }),
      );
    }
    if (
      activeLayer === "ROUTES" &&
      viewMode === "3D" &&
      activeInvestigationId === "demo"
    ) {
      result.push(
        new ArcLayer<MovementArc>({
          id: "arc-glow-layer",
          data: filteredMovements,
          getSourcePosition: (d: MovementArc) => d.from.coordinates,
          getTargetPosition: (d: MovementArc) => d.to.coordinates,
          getSourceColor: [174, 195, 176, 70],
          getTargetColor: [89, 131, 146, 35],
          getWidth: 8,
          getHeight: 0.75,
          greatCircle: false,
          pickable: false,
        }),
        new ArcLayer<MovementArc>({
          id: "arc-layer",
          data: filteredMovements,
          getSourcePosition: (d: MovementArc) => d.from.coordinates,
          getTargetPosition: (d: MovementArc) => d.to.coordinates,
          getSourceColor: [174, 195, 176, 255], // #AEC3B0 phosphor sage
          getTargetColor: [89, 131, 146, 200], // #598392 muted steel
          getWidth: 2.5,
          getHeight: 0.75,
          pickable: true,
          autoHighlight: true,
          highlightColor: HIGHLIGHT_COLOR,
          greatCircle: false,
        }),
      );
    } else if (activeLayer === "ROUTES") {
      const telemetryPaths: TelemetryPath[] = filteredMovements.flatMap(
        (movement, index, movements) => {
          const opacity = Math.round(
            70 + (185 * (index + 1)) / movements.length,
          );
          if (activeInvestigationId === "demo") {
            return [
              {
                ...movement,
                path: [movement.from.coordinates, movement.to.coordinates],
                opacity,
              },
            ];
          }

          const [fromLng, fromLat] = movement.from.coordinates;
          const [toLng, toLat] = movement.to.coordinates;
          return Array.from({ length: 18 }, (_, segment) => segment)
            .filter((segment) => segment % 2 === 0)
            .map((segment) => {
              const start = segment / 18;
              const end = Math.min((segment + 1) / 18, 1);
              return {
                ...movement,
                path: [
                  [
                    fromLng + (toLng - fromLng) * start,
                    fromLat + (toLat - fromLat) * start,
                  ] as [number, number],
                  [
                    fromLng + (toLng - fromLng) * end,
                    fromLat + (toLat - fromLat) * end,
                  ] as [number, number],
                ],
                opacity,
              };
            });
        },
      );

      const targets: TrackingTarget[] = filteredMovements.map(
        (movement, index) => ({
          id: `target-${index}-${movement.label}`,
          coordinates: movement.to.coordinates,
          label: movement.label,
        }),
      );

      result.push(
        new PathLayer<TelemetryPath>({
          id: "telemetry-path-layer",
          data: telemetryPaths,
          getPath: (d) => d.path,
          getColor: (d) =>
            isDark ? [174, 195, 176, d.opacity] : [18, 69, 89, d.opacity],
          getWidth: 2.5,
          widthUnits: "pixels",
          widthMinPixels: 1.5,
          capRounded: false,
          jointRounded: false,
          pickable: true,
          onHover: ({ object }) =>
            setHoveredRouteId((object as TelemetryPath | undefined)?.routeId ?? null),
        }),
        new ScatterplotLayer<TrackingTarget>({
          id: "tracking-target-layer",
          data: targets,
          getPosition: (d) => d.coordinates,
          getRadius: 75,
          radiusMinPixels: 5,
          radiusMaxPixels: 10,
          filled: true,
          stroked: true,
          getFillColor: isDark ? [239, 246, 224, 235] : [210, 43, 43, 235],
          getLineColor: isDark ? [174, 195, 176, 255] : [0, 0, 0, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          pickable: true,
        }),
      );
    }
    return result;
  }, [
    activeInvestigationId,
    activeLayer,
    filteredIncidents,
    filteredMovements,
    isDark,
    viewMode,
  ]);

  /* ── Playback timer ────────────────────────── */

  useEffect(() => {
    if (!isMapPlaying) return;
    const timer = window.setInterval(() => {
      const nextIndex = playbackIndex + 1;
      if (nextIndex >= playbackDates.length) {
        setIsMapPlaying(false);
        return;
      }
      setPlaybackDate(playbackDates[nextIndex]);
    }, 850);
    return () => window.clearInterval(timer);
  }, [
    isMapPlaying,
    playbackDates,
    playbackIndex,
    setIsMapPlaying,
    setPlaybackDate,
  ]);

  const togglePlayback = () => {
    if (isMapPlaying) {
      setIsMapPlaying(false);
      return;
    }
    if (playbackIndex >= playbackDates.length - 1) {
      setPlaybackDate(playbackDates[0]);
    }
    setIsMapPlaying(true);
  };

  /* ── Sync Deck.gl viewState to Mapbox ──────── */

  const onViewStateChange = useCallback(({ viewState: newViewState }: any) => {
    setViewState(newViewState);
  }, []);

  /* ── Render ─────────────────────────────────── */

  // Prevent WebGL crash by waiting for theme resolution
  if (!mounted || !resolvedTheme) {
    return (
      <div className="relative h-full min-h-0 w-full bg-[#F4F4F0] dark:bg-[#01161E]" />
    );
  }

  const MARKER_COLORS = ["#124559", "#598392", "#AEC3B0", "#EFF6E0"];
  const getMarkerColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
    return MARKER_COLORS[hash % MARKER_COLORS.length];
  };

  const mapDimensions = { width: "100%", height: "100%" };
  const currentMapStyle = isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
  const hoveredRoute = activeInvestigation.map.routes.find(
    (route) => route.id === hoveredRouteId,
  );

  const filterPanelContent = (
    <div className="space-y-2 p-3">
      <div className="grid grid-cols-2 gap-2 border-b-2 border-[var(--ink)] pb-3 lg:hidden">
        {(["PINS", "HEAT", "DENSITY", "ROUTES"] as ActiveLayerType[]).map(
          (layer) => (
            <button
              key={layer}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setActiveLayer(layer);
              }}
              className={`min-h-11 border-2 border-[var(--ink)] px-2 py-2 text-left ${
                activeLayer === layer
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-[var(--panel)] text-[var(--ink)]"
              }`}
            >
              [ {layer} ]
            </button>
          ),
        )}
      </div>
      {crimeTypes.map((crimeType) => {
        const count = filterCounts[crimeType];
        const incidentLabel =
          activeInvestigationId === "demo"
            ? count === 1
              ? "INCIDENT"
              : "INCIDENTS"
            : count === 1
              ? "SITE"
              : "SITES";

        return (
          <label
            key={crimeType}
            className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-2"
          >
            <input
              type="checkbox"
              checked={selectedCrimeTypes.includes(crimeType)}
              onChange={(event) => {
                triggerHaptic("light");
                setSelectedCrimeTypeEnabled(crimeType, event.target.checked);
              }}
              className="h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              {crimeType.toUpperCase()} ({count} {incidentLabel})
            </span>
          </label>
        );
      })}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex min-h-11 items-center border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-2">
          Visible: {visibleIncidents.length}
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            clearAllFilters();
          }}
          className="min-h-11 border-2 border-[var(--ink)] bg-[var(--accent)] px-2 py-2 text-left text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          Clear Filters
        </button>
      </div>
      <div className="flex min-h-11 items-center border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-2">
        Bounds: {spatialBounds ? "ACTIVE" : activeInvestigation.map.boundsLabel}
      </div>
    </div>
  );

  return (
    <div
      data-testid="geospatial-map"
      data-view-mode={viewMode}
      data-camera-pitch={Math.round(viewState.pitch)}
      data-camera-bearing={Math.round(viewState.bearing)}
      className={`relative h-full min-h-0 w-full overflow-hidden bg-gray-900 md:rounded-xl ${
        isFullscreenMap ? "fixed inset-0 z-50 h-dvh" : ""
      }`}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers}
        effects={[lightingEffect]}
        getTooltip={getTooltip as any}
        style={mapDimensions}
      >
        <Map
          style={mapDimensions}
          mapStyle={currentMapStyle}
          reuseMaps={true}
          attributionControl={false}
        >
          {activeLayer === "PINS" &&
            visibleIncidents.map((incident) => (
              <Marker
                key={incident.id}
                longitude={incident.coordinates[0]}
                latitude={incident.coordinates[1]}
                anchor="center"
              >
                <button
                  type="button"
                  aria-label={`${incident.title}; ${incident.type}; ${incident.timeLabel}`}
                  onClick={() => {
                    triggerHaptic("light");
                    setSelectedLocationId(incident.id);
                  }}
                  className="grid h-11 w-11 place-items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FCD34D]"
                >
                  <TacticalMarker
                    color={
                      selectedLocationId === incident.id ||
                      relatedLocationIds.has(incident.id) ||
                      hoveredRoute?.locationIds.includes(incident.id)
                        ? "#FCD34D"
                        : getMarkerColor(incident.id)
                    }
                  />
                </button>
              </Marker>
            ))}
        </Map>
      </DeckGL>

      {activeLayer === "DENSITY" && activeInvestigation.map.densityNotice ? (
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 border-4 border-[var(--ink)] bg-[var(--accent)] px-4 py-3 font-mono text-xs font-black uppercase text-[var(--ink)] shadow-[5px_5px_0_var(--ink)]">
          [ {activeInvestigation.map.densityNotice} ]
        </div>
      ) : null}

      {hoveredRoute ? (
        <div className="pointer-events-none absolute right-4 top-28 z-20 max-w-sm border-4 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]">
          <div>{hoveredRoute.label} // {hoveredRoute.teamLabel}</div>
          <div className="mt-1 normal-case opacity-70">
            {hoveredRoute.description}
          </div>
        </div>
      ) : null}

      {selectedLocation ? (
        <aside className="absolute bottom-28 right-3 z-20 max-h-[48dvh] w-[min(360px,calc(100%-1.5rem))] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-3 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[6px_6px_0_var(--ink)] md:bottom-28 md:right-4 md:text-xs">
          <button
            type="button"
            onClick={() => setSelectedLocationId(null)}
            aria-label="Close location details"
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
          >
            [ X ]
          </button>
          <div className="mb-3 border-b-4 border-[var(--ink)] pb-2 pr-10">
            <div className="text-[9px] opacity-60">LOCATION</div>
            <div className="font-serif text-xl font-black leading-none">
              {selectedLocation.title}
            </div>
            {selectedLocation.expandedName ? (
              <div className="mt-1 normal-case opacity-70">
                {selectedLocation.expandedName}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border-2 border-[var(--ink)] p-2">
              <div className="text-[9px] opacity-60">DATE / TIME</div>
              {selectedLocation.date} / {selectedLocation.timeLabel}
            </div>
            <div className="border-2 border-[var(--ink)] p-2">
              <div className="text-[9px] opacity-60">PRECISION</div>
              {selectedLocation.timePrecision}
            </div>
            <div className="border-2 border-[var(--ink)] p-2">
              <div className="text-[9px] opacity-60">KILLED</div>
              {selectedLocation.killed ?? "N/A"}
            </div>
            <div className="border-2 border-[var(--ink)] p-2">
              <div className="text-[9px] opacity-60">INJURED</div>
              {selectedLocation.injured ?? "N/A"}
            </div>
          </div>
          {selectedLocation.casualtyBreakdown ? (
            <div className="mt-2 border-2 border-[var(--ink)] p-2">
              {selectedLocation.casualtyBreakdown.map((phase) => (
                <div key={phase.id}>
                  {phase.label}: {phase.killed} KILLED / {phase.injured} INJURED
                </div>
              ))}
            </div>
          ) : null}
          {selectedLocation.assignedTeam ? (
            <div className="mt-2 border-2 border-[var(--ink)] p-2 normal-case">
              <div className="text-[9px] uppercase opacity-60">ASSIGNED TEAM</div>
              {selectedLocation.assignedTeam}
            </div>
          ) : null}
          <p className="mt-2 border-2 border-[var(--ink)] p-2 normal-case leading-tight">
            {selectedLocation.description}
          </p>
          <div className="mt-2 text-[9px] opacity-60">
            SOURCE STATUS: {selectedLocation.confidence} / COORDINATE: {selectedLocation.coordinateStatus}
          </div>
        </aside>
      ) : null}

      {/* 2D / 3D camera mode */}
      <div
        role="group"
        aria-label="Map view mode"
        className="absolute right-4 top-4 z-20 flex border-4 border-black bg-white font-mono text-[10px] font-black uppercase shadow-[4px_4px_0_black] dark:border dark:border-[#598392] dark:bg-[#01161E] dark:shadow-[inset_0_0_14px_rgba(174,195,176,0.12),0_0_18px_rgba(1,22,30,0.72)] sm:text-xs"
      >
        {(["2D", "3D"] as ViewMode[]).map((mode) => {
          const isActive = viewMode === mode;
          const label = mode === "2D" ? "TACTICAL" : "CINEMATIC";

          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                triggerHaptic("light");
                changeViewMode(mode);
              }}
              className={`px-3 py-2 sm:px-4 ${
                isActive
                  ? "bg-black text-white dark:bg-[#AEC3B0] dark:text-[#01161E] dark:[text-shadow:none]"
                  : "bg-white text-black dark:bg-transparent dark:text-[#EFF6E0] dark:[text-shadow:0_0_7px_rgba(174,195,176,0.38)]"
              }`}
            >
              [ {label} ]
            </button>
          );
        })}
      </div>

      {/* Analysis layer toggle */}
      <div className="absolute right-4 top-16 z-20 hidden border border-[#598392] font-mono text-xs font-black uppercase tracking-wide shadow-[4px_4px_0_rgba(1,22,30,0.8)] lg:flex">
        {(["PINS", "HEAT", "DENSITY", "ROUTES"] as ActiveLayerType[]).map(
          (layer) => (
            <button
              key={layer}
              onClick={() => {
                triggerHaptic("light");
                setActiveLayer(layer);
              }}
              className={`px-3 py-2 transition-colors ${
                activeLayer === layer
                  ? "bg-[#EFF6E0] text-[#01161E]"
                  : "border-r border-[#598392] bg-[#124559] text-[#EFF6E0] last:border-r-0 hover:bg-[#598392]"
              }`}
            >
              {layer}
            </button>
          ),
        )}
      </div>

      {/* Border overlay */}
      <div className="pointer-events-none absolute inset-0 border-4 border-[var(--ink)] z-30" />

      {/* Desktop filter drawer */}
      <aside
        data-testid="desktop-map-filters"
        className="absolute left-4 top-4 z-10 hidden max-h-[calc(100%-2rem)] w-80 overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] font-mono text-xs font-black uppercase shadow-[6px_6px_0_var(--ink)] lg:block"
      >
        <div className="border-b-4 border-[var(--ink)] bg-[var(--ink)] px-3 py-2 text-[var(--paper)]">
          Filter Drawer
        </div>
        {filterPanelContent}
      </aside>

      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          setIsMobileFiltersOpen(true);
        }}
        className="absolute left-3 top-16 z-20 min-h-11 border-4 border-black bg-[#F4F4F0] px-3 font-mono text-[10px] font-black uppercase text-black shadow-[3px_3px_0_black] lg:hidden dark:border dark:border-[#598392] dark:bg-[#01161E] dark:text-[#AEC3B0] dark:shadow-[0_0_12px_rgba(1,22,30,0.75)]"
      >
        [ ACTIVE FILTERS ]
      </button>

      <AnimatePresence>
        {isMobileFiltersOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close active filters"
              className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileFiltersOpen(false)}
            />
            <motion.aside
              className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] z-[90] max-h-[72dvh] overflow-y-auto border-t-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase shadow-[0_-4px_0_black] md:bottom-8 lg:hidden dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0] dark:shadow-[0_-10px_28px_rgba(1,22,30,0.85)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b-4 border-black bg-black px-3 text-white dark:border-[#598392] dark:bg-[#124559] dark:text-[#AEC3B0]">
                <span>[ ACTIVE FILTERS ]</span>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="grid h-11 w-11 place-items-center border-2 border-white bg-black text-white dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0]"
                  aria-label="Close active filters"
                >
                  [ X ]
                </button>
              </div>
              {filterPanelContent}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Fullscreen toggle (mobile) */}
      <button
        type="button"
        onClick={() => setIsFullscreenMap((f) => !f)}
        className="absolute right-3 top-16 z-20 grid h-11 w-11 place-items-center border-4 border-[var(--ink)] bg-[var(--accent)] p-0 font-mono text-xs font-black uppercase text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] active:translate-x-1 active:translate-y-1 active:shadow-none md:hidden"
        aria-label={isFullscreenMap ? "Exit fullscreen map" : "Fullscreen map"}
      >
        {isFullscreenMap ? (
          <X aria-hidden="true" size={18} strokeWidth={3} />
        ) : (
          <Maximize2 aria-hidden="true" size={18} strokeWidth={3} />
        )}
      </button>

      {/* Playback bar */}
      <div
        data-testid="map-playback"
        className="absolute bottom-3 left-3 right-3 z-10 border-4 border-[var(--ink)] bg-[var(--paper)] p-2 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)] md:bottom-4 md:right-4 md:p-3 md:text-xs md:shadow-[6px_6px_0_var(--ink)] lg:left-[370px]"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-11 items-center justify-center gap-2 border-4 border-[var(--ink)] bg-[var(--danger)] px-4 text-[var(--paper)] shadow-[4px_4px_0_var(--ink)] active:translate-x-1 active:translate-y-1 active:shadow-none md:w-36"
          >
            {isMapPlaying ? (
              <Pause aria-hidden="true" size={18} fill="currentColor" />
            ) : (
              <Play aria-hidden="true" size={18} fill="currentColor" />
            )}
            {isMapPlaying ? "Pause" : "Play"}
          </button>
          <label className="grid min-w-0 flex-1 gap-1">
            <span>
              MapWeave Time Playback / {playbackDate} /{" "}
              {visibleIncidents.length} shown
            </span>
            <input
              type="range"
              min={0}
              max={playbackDates.length - 1}
              step={1}
              value={playbackIndex}
              onChange={(event) => {
                setIsMapPlaying(false);
                setPlaybackDate(playbackDates[Number(event.target.value)]);
              }}
              className="fatal-time-slider w-full"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
