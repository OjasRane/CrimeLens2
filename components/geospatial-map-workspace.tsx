"use client";

import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Flame, GitBranch, MapPin, Maximize2, Pause, Play, Scan, X } from "lucide-react";
import mapboxgl, { type GeoJSONSource, type Map } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import {
  type MapDisplayMode,
  type SpatialBounds,
  useInvestigationStore,
} from "@/store/use-investigation-store";
import { getDocumentTheme, themeChangeEvent, type ThemeMode } from "@/lib/theme";
import type { MapDensityPoint, MapMovementRoute } from "@/data/map-analytics";

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

type IncidentFeatureProperties = {
  id: string;
  type: CrimeType;
  title: string;
  date: string;
  severity: IncidentSeverity;
  intensity: number;
};

type DensityFeatureProperties = {
  id: string;
  intensity: number;
  severity: IncidentSeverity;
};

type RouteFeatureProperties = {
  id: string;
  label: string;
  inbound: number;
  outbound: number;
  volume: number;
};

type MapPalette = {
  ground: string;
  foreground: string;
  panel: string;
  line: string;
  primary: string;
  secondary: string;
  heatRamp: [string, string, string, string, string];
  clusterHalo: string;
  markerCenter: string;
  raster: {
    saturation: number;
    contrast: number;
    brightnessMin: number;
    brightnessMax: number;
  };
};

const crimeTypes: CrimeType[] = [
  "Burglary",
  "Assault",
  "Fraud",
  "Robbery",
  "Arson",
];

const mapModeOptions: {
  id: MapDisplayMode;
  label: string;
  icon: typeof MapPin;
}[] = [
    { id: "pins", label: "Pins", icon: MapPin },
    { id: "heatmap", label: "Heat", icon: Flame },
    { id: "density", label: "Density", icon: Scan },
    { id: "routes", label: "Routes", icon: GitBranch },
  ];

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

const mapPalettes: Record<ThemeMode, MapPalette> = {
  archive: {
    ground: "#F4F4F0",
    foreground: "#000000",
    panel: "#FFFFFF",
    line: "#000000",
    primary: "#D22B2B",
    secondary: "#FCD34D",
    heatRamp: [
      "rgba(210,43,43,0)",
      "rgba(210,43,43,0.22)",
      "rgba(210,43,43,0.5)",
      "rgba(210,43,43,0.78)",
      "rgba(0,0,0,0.85)",
    ],
    clusterHalo: "#F4F4F0",
    markerCenter: "#F4F4F0",
    raster: {
      saturation: -1,
      contrast: 0.42,
      brightnessMin: 0.68,
      brightnessMax: 0.98,
    },
  },
  terminal: {
    ground: "#01161E",
    foreground: "#EFF6E0",
    panel: "#124559",
    line: "#598392",
    primary: "#AEC3B0",
    secondary: "#F3C969",
    heatRamp: [
      "rgba(18,69,89,0)",
      "rgba(89,131,146,0.32)",
      "rgba(174,195,176,0.58)",
      "rgba(239,246,224,0.82)",
      "rgba(243,201,105,0.95)",
    ],
    clusterHalo: "#124559",
    markerCenter: "#01161E",
    raster: {
      saturation: -0.75,
      contrast: 0.18,
      brightnessMin: 0.08,
      brightnessMax: 0.52,
    },
  },
};

function markerSvg(palette: MapPalette) {
  return encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 42 4 22C-2 10 6 2 18 2s20 8 14 20L18 42Z" fill="${palette.primary}" stroke="${palette.line}" stroke-width="4"/>
  <circle cx="18" cy="17" r="6" fill="${palette.markerCenter}" stroke="${palette.line}" stroke-width="3"/>
</svg>
`);
}

function incidentFeatureCollection(
  sourceIncidents: Incident[],
): FeatureCollection<Point, IncidentFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: sourceIncidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: incident.coordinates,
      },
      properties: {
        id: incident.id,
        type: incident.type,
        title: incident.title,
        date: incident.date,
        severity: incident.severity,
        intensity: incident.intensity,
      },
    })),
  };
}

function densityFeatureCollection(
  sourceIncidents: Incident[],
  densityPoints: MapDensityPoint[] = [],
): FeatureCollection<Polygon, DensityFeatureProperties> {
  const cellSize = 0.0024;

  return {
    type: "FeatureCollection",
    features: sourceIncidents.map((incident) => {
      const [longitude, latitude] = incident.coordinates;
      const densityPoint = densityPoints.find(
        (point) =>
          Math.abs(point.coordinates[0] - longitude) < 0.0001 &&
          Math.abs(point.coordinates[1] - latitude) < 0.0001,
      );
      const intensity = densityPoint?.weight ?? incident.intensity;

      return {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [longitude - cellSize, latitude - cellSize],
              [longitude + cellSize, latitude - cellSize],
              [longitude + cellSize, latitude + cellSize],
              [longitude - cellSize, latitude + cellSize],
              [longitude - cellSize, latitude - cellSize],
            ],
          ],
        },
        properties: {
          id: `density-${incident.id}`,
          intensity,
          severity: incident.severity,
        },
      };
    }),
  };
}

function curvedRouteCoordinates(
  from: [number, number],
  to: [number, number],
): [number, number][] {
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const deltaLongitude = toLongitude - fromLongitude;
  const deltaLatitude = toLatitude - fromLatitude;
  const curve = Math.hypot(deltaLongitude, deltaLatitude) * 0.22;
  const normalLongitude = -deltaLatitude;
  const normalLatitude = deltaLongitude;
  const normalLength = Math.hypot(normalLongitude, normalLatitude) || 1;

  return Array.from({ length: 18 }, (_, index) => {
    const t = index / 17;
    const bow = Math.sin(Math.PI * t) * curve;

    return [
      fromLongitude +
      deltaLongitude * t +
      (normalLongitude / normalLength) * bow,
      fromLatitude +
      deltaLatitude * t +
      (normalLatitude / normalLength) * bow,
    ];
  });
}

function routeFeatureCollection(
  routes: MapMovementRoute[],
  visibleIncidentSet: Set<string>,
): FeatureCollection<LineString, RouteFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: routes
      .filter((route) => {
        const endpoints = [route.from.coordinates, route.to.coordinates];

        return endpoints.some(([longitude, latitude]) =>
          incidents.some(
            (incident) =>
              visibleIncidentSet.has(incident.id) &&
              Math.abs(incident.coordinates[0] - longitude) < 0.0001 &&
              Math.abs(incident.coordinates[1] - latitude) < 0.0001,
          ),
        );
      })
      .map((route) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: curvedRouteCoordinates(
            route.from.coordinates,
            route.to.coordinates,
          ),
        },
        properties: {
          id: route.id,
          label: route.label,
          inbound: route.inbound,
          outbound: route.outbound,
          volume: route.inbound + route.outbound,
        },
      })),
  };
}

function isWithinBounds(incident: Incident, bounds: SpatialBounds | null) {
  if (!bounds) {
    return true;
  }

  const [longitude, latitude] = incident.coordinates;

  return (
    latitude <= bounds.north &&
    latitude >= bounds.south &&
    longitude <= bounds.east &&
    longitude >= bounds.west
  );
}

function collectPositions(geometry: Geometry): Position[] {
  if (geometry.type === "Point") {
    return [geometry.coordinates];
  }

  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    return geometry.coordinates;
  }

  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat(2);
  }

  return [];
}

function boundsFromFeatures(
  features: Feature<Geometry, GeoJsonProperties>[],
): SpatialBounds | null {
  const positions = features.flatMap((feature) =>
    collectPositions(feature.geometry),
  );

  if (positions.length === 0) {
    return null;
  }

  const longitudes = positions.map((position) => position[0]);
  const latitudes = positions.map((position) => position[1]);

  return {
    north: Math.max(...latitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    west: Math.min(...longitudes),
  };
}

function addMarkerImage(map: Map, themeMode: ThemeMode) {
  const imageId = `fatal-incident-marker-${themeMode}`;

  if (!map.hasImage(imageId)) {
    const image = new Image(36, 44);
    image.onload = () => {
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, image, { pixelRatio: 2 });
      }
    };
    image.src = `data:image/svg+xml;charset=utf-8,${markerSvg(mapPalettes[themeMode])}`;
  }
}

function addIncidentLayers(map: Map, themeMode: ThemeMode) {
  const palette = mapPalettes[themeMode];

  addMarkerImage(map, "archive");
  addMarkerImage(map, "terminal");

  map.addSource("incident-heatmap", {
    type: "geojson",
    data: incidentFeatureCollection([]),
  });

  map.addSource("incident-density", {
    type: "geojson",
    data: densityFeatureCollection([]),
  });

  map.addSource("movement-routes", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
    lineMetrics: true,
  });

  map.addSource("incidents", {
    type: "geojson",
    data: incidentFeatureCollection([]),
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 54,
  });

  map.addLayer({
    id: "crime-hotspots",
    type: "heatmap",
    source: "incident-heatmap",
    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        0,
        0,
        10,
        1,
      ],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.7, 15, 2],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        palette.heatRamp[0],
        0.25,
        palette.heatRamp[1],
        0.55,
        palette.heatRamp[2],
        0.85,
        palette.heatRamp[3],
        1,
        palette.heatRamp[4],
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 15, 44],
      "heatmap-opacity": 0.82,
    },
  });

  map.addLayer({
    id: "incident-density-extrusion",
    type: "fill-extrusion",
    source: "incident-density",
    paint: {
      "fill-extrusion-color": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        0,
        palette.panel,
        4,
        palette.secondary,
        7,
        palette.primary,
        10,
        palette.foreground,
      ],
      "fill-extrusion-height": [
        "interpolate",
        ["linear"],
        ["get", "intensity"],
        0,
        25,
        10,
        420,
      ],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.78,
    },
    layout: {
      visibility: "none",
    },
  });

  map.addLayer({
    id: "movement-routes-casing",
    type: "line",
    source: "movement-routes",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "none",
    },
    paint: {
      "line-color": palette.line,
      "line-opacity": 0.85,
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "volume"],
        0,
        4,
        220,
        11,
      ],
    },
  });

  map.addLayer({
    id: "movement-routes-flow",
    type: "line",
    source: "movement-routes",
    layout: {
      "line-cap": "round",
      "line-join": "round",
      visibility: "none",
    },
    paint: {
      "line-color": palette.primary,
      "line-dasharray": [2, 1.4],
      "line-opacity": 0.94,
      "line-width": [
        "interpolate",
        ["linear"],
        ["get", "volume"],
        0,
        2,
        220,
        7,
      ],
    },
  });

  map.addLayer({
    id: "incident-clusters-halo",
    type: "circle",
    source: "incidents",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": palette.clusterHalo,
      "circle-radius": [
        "step",
        ["get", "point_count"],
        22,
        4,
        28,
        8,
        34,
      ],
      "circle-stroke-color": palette.line,
      "circle-stroke-width": 5,
    },
  });

  map.addLayer({
    id: "incident-clusters-core",
    type: "circle",
    source: "incidents",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": palette.primary,
      "circle-radius": [
        "step",
        ["get", "point_count"],
        12,
        4,
        16,
        8,
        20,
      ],
      "circle-stroke-color": palette.line,
      "circle-stroke-width": 3,
    },
  });

  map.addLayer({
    id: "incident-points",
    type: "symbol",
    source: "incidents",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": `fatal-incident-marker-${themeMode}`,
      "icon-size": 0.86,
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
    },
  });

  map.addLayer({
    id: "incident-hit-targets",
    type: "circle",
    source: "incidents",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": palette.primary,
      "circle-opacity": 0.01,
      "circle-radius": 16,
      "circle-stroke-opacity": 0,
    },
  });
}

function getSource(map: Map, sourceId: string) {
  return map.getSource(sourceId) as GeoJSONSource | undefined;
}

function applyMapTheme(map: Map, themeMode: ThemeMode) {
  const palette = mapPalettes[themeMode];

  addMarkerImage(map, themeMode);

  if (map.getLayer("parchment-ground")) {
    map.setPaintProperty("parchment-ground", "background-color", palette.ground);
  }

  if (map.getLayer("osm-parchment")) {
    map.setPaintProperty("osm-parchment", "raster-saturation", palette.raster.saturation);
    map.setPaintProperty("osm-parchment", "raster-contrast", palette.raster.contrast);
    map.setPaintProperty(
      "osm-parchment",
      "raster-brightness-min",
      palette.raster.brightnessMin,
    );
    map.setPaintProperty(
      "osm-parchment",
      "raster-brightness-max",
      palette.raster.brightnessMax,
    );
  }

  if (map.getLayer("crime-hotspots")) {
    map.setPaintProperty("crime-hotspots", "heatmap-color", [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      palette.heatRamp[0],
      0.25,
      palette.heatRamp[1],
      0.55,
      palette.heatRamp[2],
      0.85,
      palette.heatRamp[3],
      1,
      palette.heatRamp[4],
    ]);
  }

  if (map.getLayer("incident-density-extrusion")) {
    map.setPaintProperty("incident-density-extrusion", "fill-extrusion-color", [
      "interpolate",
      ["linear"],
      ["get", "intensity"],
      0,
      palette.panel,
      4,
      palette.secondary,
      7,
      palette.primary,
      10,
      palette.foreground,
    ]);
  }

  if (map.getLayer("movement-routes-casing")) {
    map.setPaintProperty("movement-routes-casing", "line-color", palette.line);
  }

  if (map.getLayer("movement-routes-flow")) {
    map.setPaintProperty("movement-routes-flow", "line-color", palette.primary);
  }

  if (map.getLayer("incident-clusters-halo")) {
    map.setPaintProperty("incident-clusters-halo", "circle-color", palette.clusterHalo);
    map.setPaintProperty("incident-clusters-halo", "circle-stroke-color", palette.line);
  }

  if (map.getLayer("incident-clusters-core")) {
    map.setPaintProperty("incident-clusters-core", "circle-color", palette.primary);
    map.setPaintProperty("incident-clusters-core", "circle-stroke-color", palette.line);
  }

  if (map.getLayer("incident-points")) {
    map.setLayoutProperty("incident-points", "icon-image", `fatal-incident-marker-${themeMode}`);
  }

  if (map.getLayer("draw-polygon-fill")) {
    map.setPaintProperty("draw-polygon-fill", "fill-color", palette.primary);
    map.setPaintProperty("draw-polygon-fill", "fill-outline-color", palette.line);
  }

  if (map.getLayer("draw-polygon-stroke")) {
    map.setPaintProperty("draw-polygon-stroke", "line-color", palette.line);
  }

  if (map.getLayer("draw-points")) {
    map.setPaintProperty("draw-points", "circle-color", palette.ground);
    map.setPaintProperty("draw-points", "circle-stroke-color", palette.line);
  }
}

function setLayerVisibility(map: Map, layerId: string, isVisible: boolean) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
  }
}

function applyMapDisplayMode(map: Map, mode: MapDisplayMode) {
  const showPins = mode === "pins";
  const showHeatmap = mode === "heatmap";
  const showDensity = mode === "density";
  const showRoutes = mode === "routes";

  setLayerVisibility(map, "crime-hotspots", showHeatmap);
  setLayerVisibility(map, "incident-density-extrusion", showDensity);
  setLayerVisibility(map, "movement-routes-casing", showRoutes);
  setLayerVisibility(map, "movement-routes-flow", showRoutes);
  setLayerVisibility(map, "incident-clusters-halo", showPins);
  setLayerVisibility(map, "incident-clusters-core", showPins);
  setLayerVisibility(map, "incident-points", showPins || showRoutes);
  setLayerVisibility(map, "incident-hit-targets", showHeatmap || showDensity);

  map.easeTo({
    pitch: showDensity ? 55 : 0,
    bearing: showDensity ? -22 : 0,
    duration: 450,
  });
}

export function GeospatialMapWorkspace() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("archive");

  const selectedCrimeTypes = useInvestigationStore(
    (state) => state.selectedCrimeTypes,
  );
  const mapDisplayMode = useInvestigationStore((state) => state.mapDisplayMode);
  const setMapDisplayMode = useInvestigationStore(
    (state) => state.setMapDisplayMode,
  );
  const mapMovementRoutes = useInvestigationStore(
    (state) => state.mapMovementRoutes,
  );
  const mapDensityPoints = useInvestigationStore(
    (state) => state.mapDensityPoints,
  );
  const setSelectedCrimeTypeEnabled = useInvestigationStore(
    (state) => state.setSelectedCrimeTypeEnabled,
  );
  const spatialBounds = useInvestigationStore((state) => state.spatialBounds);
  const setSpatialBounds = useInvestigationStore(
    (state) => state.setSpatialBounds,
  );
  const playbackDate = useInvestigationStore((state) => state.playbackDate);
  const setPlaybackDate = useInvestigationStore(
    (state) => state.setPlaybackDate,
  );
  const isMapPlaying = useInvestigationStore((state) => state.isMapPlaying);
  const setIsMapPlaying = useInvestigationStore(
    (state) => state.setIsMapPlaying,
  );
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );

  const playbackIndex = Math.max(0, playbackDates.indexOf(playbackDate));

  // Suspect-linked incident IDs for highlighting
  const suspectLinkedIncidents = useMemo(
    () =>
      selectedSuspectId
        ? new Set(suspectIncidentLinks[selectedSuspectId] ?? [])
        : null,
    [selectedSuspectId],
  );

  const visibleIncidents = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          selectedCrimeTypes.includes(incident.type) &&
          incident.date <= playbackDate &&
          incident.date >= timeRange[0] &&
          incident.date <= timeRange[1] &&
          isWithinBounds(incident, spatialBounds),
      ),
    [playbackDate, selectedCrimeTypes, spatialBounds, timeRange],
  );

  const visibleIncidentIds = useMemo(
    () => new Set(visibleIncidents.map((incident) => incident.id)),
    [visibleIncidents],
  );

  const filterCounts = useMemo(
    () =>
      crimeTypes.reduce<Record<CrimeType, number>>((counts, crimeType) => {
        counts[crimeType] = incidents.filter(
          (incident) =>
            incident.type === crimeType &&
            incident.date <= playbackDate &&
            incident.date >= timeRange[0] &&
            incident.date <= timeRange[1] &&
            isWithinBounds(incident, spatialBounds),
        ).length;
        return counts;
      }, {} as Record<CrimeType, number>),
    [playbackDate, spatialBounds, timeRange],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const initialTheme = getDocumentTheme();
    const initialPalette = mapPalettes[initialTheme];
    setThemeMode(initialTheme);

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      center: [-87.6298, 41.8818],
      zoom: 12.7,
      minZoom: 10,
      maxZoom: 17,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap",
          },
        },
        layers: [
          {
            id: "parchment-ground",
            type: "background",
            paint: { "background-color": initialPalette.ground },
          },
          {
            id: "osm-parchment",
            type: "raster",
            source: "osm",
            paint: {
              "raster-saturation": initialPalette.raster.saturation,
              "raster-contrast": initialPalette.raster.contrast,
              "raster-brightness-min": initialPalette.raster.brightnessMin,
              "raster-brightness-max": initialPalette.raster.brightnessMax,
            },
          },
        ],
      },
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      styles: [
        {
          id: "draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"]],
          paint: {
            "fill-color": initialPalette.primary,
            "fill-outline-color": initialPalette.line,
            "fill-opacity": 0.16,
          },
        },
        {
          id: "draw-polygon-stroke",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"]],
          paint: {
            "line-color": initialPalette.line,
            "line-dasharray": [2, 1],
            "line-width": 4,
          },
        },
        {
          id: "draw-points",
          type: "circle",
          filter: ["all", ["==", "$type", "Point"]],
          paint: {
            "circle-color": initialPalette.ground,
            "circle-radius": 5,
            "circle-stroke-color": initialPalette.line,
            "circle-stroke-width": 3,
          },
        },
      ],
    });

    const updateDrawBounds = () => {
      const drawnFeatures = draw.getAll().features as Feature<
        Geometry,
        GeoJsonProperties
      >[];
      setSpatialBounds(boundsFromFeatures(drawnFeatures));
    };

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(draw, "top-right");
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true, customAttribution: "" }),
      "bottom-right",
    );

    map.on("load", () => {
      addIncidentLayers(map, initialTheme);
      applyMapDisplayMode(map, mapDisplayMode);
      setIsMapReady(true);
    });
    map.on("draw.create", updateDrawBounds);
    map.on("draw.update", updateDrawBounds);
    map.on("draw.delete", updateDrawBounds);

    map.on("click", "incident-clusters-core", (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["incident-clusters-core"],
      });
      const clusterId = features[0]?.properties?.cluster_id as number | undefined;
      const source = getSource(map, "incidents");

      if (typeof clusterId !== "number" || !source) {
        return;
      }

      source.getClusterExpansionZoom(clusterId, (error, zoom) => {
        if (error || typeof zoom !== "number") {
          return;
        }

        const coordinates = (features[0].geometry as Point).coordinates as [
          number,
          number,
        ];
        map.easeTo({ center: coordinates, zoom });
      });
    });

    const showIncidentPopup = (event: mapboxgl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = feature?.properties as IncidentFeatureProperties | undefined;
      const coordinates = (feature?.geometry as Point | undefined)?.coordinates as
        | [number, number]
        | undefined;

      if (!properties || !coordinates) {
        return;
      }

      new mapboxgl.Popup({
        closeButton: false,
        className: "fatal-map-popup",
        offset: 18,
      })
        .setLngLat(coordinates)
        .setHTML(
          `<strong>${properties.id}</strong><span>${properties.type} / ${properties.severity}</span><em>${properties.date}</em><p>${properties.title}</p>`,
        )
        .addTo(map);
    };

    map.on("click", "incident-points", showIncidentPopup);
    map.on("click", "incident-hit-targets", showIncidentPopup);

    map.on("mouseenter", "incident-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "incident-points", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "incident-hit-targets", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "incident-hit-targets", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      setIsMapReady(false);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [mapDisplayMode, setSpatialBounds]);

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = getDocumentTheme();
      setThemeMode(nextTheme);

      if (mapRef.current && isMapReady) {
        applyMapTheme(mapRef.current, nextTheme);
      }
    };

    handleThemeChange();
    window.addEventListener(themeChangeEvent, handleThemeChange);
    return () => window.removeEventListener(themeChangeEvent, handleThemeChange);
  }, [isMapReady]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    const featureCollection = incidentFeatureCollection(visibleIncidents);
    const routeCollection = routeFeatureCollection(
      mapMovementRoutes,
      visibleIncidentIds,
    );
    getSource(mapRef.current, "incidents")?.setData(featureCollection);
    getSource(mapRef.current, "incident-heatmap")?.setData(featureCollection);
    getSource(mapRef.current, "incident-density")?.setData(
      densityFeatureCollection(visibleIncidents, mapDensityPoints),
    );
    getSource(mapRef.current, "movement-routes")?.setData(routeCollection);
  }, [
    isMapReady,
    mapDensityPoints,
    mapMovementRoutes,
    visibleIncidentIds,
    visibleIncidents,
  ]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    applyMapDisplayMode(mapRef.current, mapDisplayMode);
  }, [isMapReady, mapDisplayMode]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    applyMapTheme(mapRef.current, themeMode);
  }, [isMapReady, themeMode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const resizeFrame = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(resizeFrame);
  }, [isFullscreenMap]);

  useEffect(() => {
    if (!isMapPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      const nextIndex = playbackIndex + 1;

      if (nextIndex >= playbackDates.length) {
        setIsMapPlaying(false);
        return;
      }

      setPlaybackDate(playbackDates[nextIndex]);
    }, 850);

    return () => window.clearInterval(timer);
  }, [isMapPlaying, playbackIndex, setIsMapPlaying, setPlaybackDate]);

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

  return (
    <div
      className={`relative h-full min-h-[640px] overflow-hidden bg-[var(--background)] ${isFullscreenMap ? "fixed inset-0 z-50 min-h-screen" : ""
        }`}
    >
      <div ref={mapContainerRef} className="fatal-map h-full w-full" />
      <div
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{ backgroundColor: "var(--map-overlay)" }}
      />
      <div className="pointer-events-none absolute inset-0 border-4 border-[var(--line)]" />

      <aside className="absolute left-4 top-4 z-10 w-[min(330px,calc(100%-2rem))] border-4 border-[var(--line)] bg-[var(--background)] font-mono text-xs font-black uppercase shadow-[6px_6px_0_var(--shadow)]">
        <div className="border-b-4 border-[var(--line)] bg-[var(--panel-strong)] px-3 py-2 text-[var(--panel-strong-foreground)]">
          Filter Drawer
        </div>
        <div className="space-y-2 p-3">
          {crimeTypes.map((crimeType) => {
            const count = filterCounts[crimeType];
            const incidentLabel = count === 1 ? "INCIDENT" : "INCIDENTS";

            return (
              <label
                key={crimeType}
                className="flex cursor-pointer items-center gap-2 border-2 border-[var(--line)] bg-[var(--panel)] px-2 py-2"
              >
                <input
                  type="checkbox"
                  checked={selectedCrimeTypes.includes(crimeType)}
                  onChange={(event) =>
                    setSelectedCrimeTypeEnabled(crimeType, event.target.checked)
                  }
                  className="h-4 w-4 shrink-0 accent-black"
                />
                <span className="min-w-0">
                  {crimeType.toUpperCase()} ({count} {incidentLabel})
                </span>
              </label>
            );
          })}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="border-2 border-[var(--line)] bg-[var(--panel)] px-2 py-2">
              Visible: {visibleIncidents.length}
            </div>
            <button
              type="button"
              onClick={() => {
                drawRef.current?.deleteAll();
                setSpatialBounds(null);
              }}
              className="border-2 border-[var(--line)] bg-[var(--secondary)] px-2 py-2 text-left text-black shadow-[3px_3px_0_var(--shadow)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Clear Query
            </button>
          </div>
          <div className="border-2 border-[var(--line)] bg-[var(--panel)] px-2 py-2">
            Bounds: {spatialBounds ? "ACTIVE" : "NONE"}
          </div>
        </div>
      </aside>

      <div className="absolute right-4 top-4 z-20 flex max-w-[calc(100%-2rem)] flex-wrap border-4 border-[var(--line)] bg-[var(--panel)] font-mono text-[10px] font-black uppercase shadow-[4px_4px_0_var(--shadow)] md:text-xs">
        {mapModeOptions.map((mode, index) => {
          const Icon = mode.icon;
          const isActive = mapDisplayMode === mode.id;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMapDisplayMode(mode.id)}
              className={`flex h-10 items-center gap-1.5 px-2.5 transition-colors ${index > 0 ? "border-l-4 border-[var(--line)]" : ""
                } ${isActive
                  ? "bg-[var(--panel-strong)] text-[var(--panel-strong-foreground)]"
                  : "bg-[var(--panel)] text-[var(--foreground)] hover:bg-[var(--secondary)] hover:text-black"
                }`}
              aria-pressed={isActive}
            >
              <Icon aria-hidden="true" size={15} strokeWidth={3} />
              {mode.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setIsFullscreenMap((isFullscreen) => !isFullscreen)}
        className="absolute right-4 top-20 z-20 flex h-11 items-center gap-2 border-4 border-[var(--line)] bg-[var(--secondary)] px-3 font-mono text-xs font-black uppercase text-black shadow-[4px_4px_0_var(--shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none md:hidden"
      >
        {isFullscreenMap ? (
          <X aria-hidden="true" size={18} strokeWidth={3} />
        ) : (
          <Maximize2 aria-hidden="true" size={18} strokeWidth={3} />
        )}
        [ {isFullscreenMap ? "EXIT MAP" : "FULLSCREEN MAP"} ]
      </button>

      <div className="absolute bottom-4 left-4 right-4 z-10 border-4 border-[var(--line)] bg-[var(--background)] p-3 font-mono text-xs font-black uppercase shadow-[6px_6px_0_var(--shadow)] md:left-[370px]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-11 items-center justify-center gap-2 border-4 border-[var(--line)] bg-[var(--primary)] px-4 text-[var(--background)] shadow-[4px_4px_0_var(--shadow)] active:translate-x-1 active:translate-y-1 active:shadow-none md:w-36"
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
              MapWeave Time Playback / {playbackDate} / {visibleIncidents.length}{" "}
              shown
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
