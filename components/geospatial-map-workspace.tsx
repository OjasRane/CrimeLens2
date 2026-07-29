"use client";

import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Maximize2, Pause, Play, X } from "lucide-react";
import mapboxgl, { type GeoJSONSource, type Map } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
  Position,
} from "geojson";
import {
  type SpatialBounds,
  useInvestigationStore,
} from "@/store/use-investigation-store";

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

const crimeTypes: CrimeType[] = [
  "Burglary",
  "Assault",
  "Fraud",
  "Robbery",
  "Arson",
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

const markerSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
  <path d="M18 42 4 22C-2 10 6 2 18 2s20 8 14 20L18 42Z" fill="#D22B2B" stroke="#000" stroke-width="4"/>
  <circle cx="18" cy="17" r="6" fill="#F4F4F0" stroke="#000" stroke-width="3"/>
</svg>
`);

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

function addIncidentLayers(map: Map) {
  if (!map.hasImage("fatal-incident-marker")) {
    const image = new Image(36, 44);
    image.onload = () => {
      if (!map.hasImage("fatal-incident-marker")) {
        map.addImage("fatal-incident-marker", image, { pixelRatio: 2 });
      }
    };
    image.src = `data:image/svg+xml;charset=utf-8,${markerSvg}`;
  }

  map.addSource("incident-heatmap", {
    type: "geojson",
    data: incidentFeatureCollection([]),
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
        "rgba(210,43,43,0)",
        0.25,
        "rgba(210,43,43,0.22)",
        0.55,
        "rgba(210,43,43,0.5)",
        0.85,
        "rgba(210,43,43,0.78)",
        1,
        "rgba(0,0,0,0.85)",
      ],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 15, 44],
      "heatmap-opacity": 0.82,
    },
  });

  map.addLayer({
    id: "incident-clusters-halo",
    type: "circle",
    source: "incidents",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#F4F4F0",
      "circle-radius": [
        "step",
        ["get", "point_count"],
        22,
        4,
        28,
        8,
        34,
      ],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 5,
    },
  });

  map.addLayer({
    id: "incident-clusters-core",
    type: "circle",
    source: "incidents",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#D22B2B",
      "circle-radius": [
        "step",
        ["get", "point_count"],
        12,
        4,
        16,
        8,
        20,
      ],
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 3,
    },
  });

  map.addLayer({
    id: "incident-points",
    type: "symbol",
    source: "incidents",
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": "fatal-incident-marker",
      "icon-size": 0.86,
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
    },
  });
}

function getSource(map: Map, sourceId: string) {
  return map.getSource(sourceId) as GeoJSONSource | undefined;
}

export function GeospatialMapWorkspace() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFullscreenMap, setIsFullscreenMap] = useState(false);

  const selectedCrimeTypes = useInvestigationStore(
    (state) => state.selectedCrimeTypes,
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
            paint: { "background-color": "#F4F4F0" },
          },
          {
            id: "osm-parchment",
            type: "raster",
            source: "osm",
            paint: {
              "raster-saturation": -1,
              "raster-contrast": 0.42,
              "raster-brightness-min": 0.68,
              "raster-brightness-max": 0.98,
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
            "fill-color": "#D22B2B",
            "fill-outline-color": "#000000",
            "fill-opacity": 0.16,
          },
        },
        {
          id: "draw-polygon-stroke",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"]],
          paint: {
            "line-color": "#000000",
            "line-dasharray": [2, 1],
            "line-width": 4,
          },
        },
        {
          id: "draw-points",
          type: "circle",
          filter: ["all", ["==", "$type", "Point"]],
          paint: {
            "circle-color": "#F4F4F0",
            "circle-radius": 5,
            "circle-stroke-color": "#000000",
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
      addIncidentLayers(map);
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

    map.on("click", "incident-points", (event) => {
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
    });

    map.on("mouseenter", "incident-points", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "incident-points", () => {
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
  }, [setSpatialBounds]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    const featureCollection = incidentFeatureCollection(visibleIncidents);
    getSource(mapRef.current, "incidents")?.setData(featureCollection);
    getSource(mapRef.current, "incident-heatmap")?.setData(featureCollection);
  }, [isMapReady, visibleIncidents]);

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
      className={`relative h-full min-h-[640px] overflow-hidden bg-[#F4F4F0] ${
        isFullscreenMap ? "fixed inset-0 z-50 min-h-screen" : ""
      }`}
    >
      <div ref={mapContainerRef} className="fatal-map h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-[#F4F4F0]/30 mix-blend-multiply" />
      <div className="pointer-events-none absolute inset-0 border-4 border-black" />

      <aside className="absolute left-4 top-4 z-10 w-[min(330px,calc(100%-2rem))] border-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase shadow-[6px_6px_0_black]">
        <div className="border-b-4 border-black bg-black px-3 py-2 text-[#F4F4F0]">
          Filter Drawer
        </div>
        <div className="space-y-2 p-3">
          {crimeTypes.map((crimeType) => {
            const count = filterCounts[crimeType];
            const incidentLabel = count === 1 ? "INCIDENT" : "INCIDENTS";

            return (
              <label
                key={crimeType}
                className="flex cursor-pointer items-center gap-2 border-2 border-black bg-white px-2 py-2"
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
            <div className="border-2 border-black bg-white px-2 py-2">
              Visible: {visibleIncidents.length}
            </div>
            <button
              type="button"
              onClick={() => {
                drawRef.current?.deleteAll();
                setSpatialBounds(null);
              }}
              className="border-2 border-black bg-[#FCD34D] px-2 py-2 text-left shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Clear Query
            </button>
          </div>
          <div className="border-2 border-black bg-white px-2 py-2">
            Bounds: {spatialBounds ? "ACTIVE" : "NONE"}
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setIsFullscreenMap((isFullscreen) => !isFullscreen)}
        className="absolute right-4 top-4 z-20 flex h-11 items-center gap-2 border-4 border-black bg-[#FCD34D] px-3 font-mono text-xs font-black uppercase shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none md:hidden"
      >
        {isFullscreenMap ? (
          <X aria-hidden="true" size={18} strokeWidth={3} />
        ) : (
          <Maximize2 aria-hidden="true" size={18} strokeWidth={3} />
        )}
        [ {isFullscreenMap ? "EXIT MAP" : "FULLSCREEN MAP"} ]
      </button>

      <div className="absolute bottom-4 left-4 right-4 z-10 border-4 border-black bg-[#F4F4F0] p-3 font-mono text-xs font-black uppercase shadow-[6px_6px_0_black] md:left-[370px]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-11 items-center justify-center gap-2 border-4 border-black bg-[#D22B2B] px-4 text-white shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none md:w-36"
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
