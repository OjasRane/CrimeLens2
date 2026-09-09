"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Pause, Play, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  InvestigationPinDeleteDialog,
  InvestigationPinDetails,
  InvestigationPinEditor,
  InvestigationPinMarker,
  TemporaryInvestigationPinMarker,
  type PinLinkOption,
} from "@/components/investigation-pin-panel";
import { AddToNetworkWorkspaceButton } from "@/components/add-to-network-workspace-button";
import {
  createInvestigationPin,
  deleteInvestigationPin,
  listInvestigationPins,
  PIN_CATEGORIES,
  PIN_CATEGORY_DETAILS,
  updateInvestigationPin,
  type InvestigationPin,
  type InvestigationPinCategory,
  type InvestigationPinFormValues,
} from "@/lib/investigation-pins";

/* ─── Deck.gl imports ─────────────────────────── */

import { DeckGL } from "@deck.gl/react";
import { HeatmapLayer, HexagonLayer } from "@deck.gl/aggregation-layers";
import { ArcLayer, PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  AmbientLight,
  DirectionalLight,
  FlyToInterpolator,
  LightingEffect,
  type MapViewState,
} from "@deck.gl/core";

type ActiveLayerType = "PINS" | "HEAT" | "DENSITY" | "ROUTES";
type ViewMode = "2D" | "3D";
type PinVisibility = "all" | "system" | "user";
type TemporaryPin = { latitude: number; longitude: number };

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
const MAP_EFFECTS = [lightingEffect];
const MAP_DIMENSIONS = { width: "100%", height: "100%" } as const;
const MARKER_COLORS = ["#124559", "#598392", "#AEC3B0", "#EFF6E0"] as const;

function getMarkerColor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1)
    hash += id.charCodeAt(index);
  return MARKER_COLORS[hash % MARKER_COLORS.length];
}

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
  const [pins, setPins] = useState<InvestigationPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(true);
  const [pinsLoadError, setPinsLoadError] = useState<string | null>(null);
  const [isAddPinMode, setIsAddPinMode] = useState(false);
  const [temporaryPin, setTemporaryPin] = useState<TemporaryPin | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [pinEditorMode, setPinEditorMode] = useState<"create" | "edit" | null>(
    null,
  );
  const [pinVisibility, setPinVisibility] = useState<PinVisibility>("all");
  const [selectedPinCategories, setSelectedPinCategories] = useState<
    InvestigationPinCategory[]
  >([...PIN_CATEGORIES]);
  const [pinMutationError, setPinMutationError] = useState<string | null>(null);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [deletePinId, setDeletePinId] = useState<string | null>(null);
  const [isDeletingPin, setIsDeletingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const pinMutationInFlightRef = useRef(false);
  const pinFeedbackTimerRef = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const activeInvestigationId = useInvestigationStore(
    (s) => s.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const crimeTypes = activeInvestigation.map.filterGroups;
  const activeLocations = useMemo(
    () =>
      activeInvestigation.map.locations.filter(
        (
          location,
        ): location is InvestigationLocation & {
          coordinates: [number, number];
        } => Boolean(location.coordinates),
      ),
    [activeInvestigation],
  );
  const playbackDates = useMemo(
    () =>
      Array.from(
        new Set(activeInvestigation.timeline.events.map((event) => event.date)),
      ).sort(),
    [activeInvestigation],
  );

  const pinLinkOptions = useMemo(
    () => ({
      evidence: activeInvestigation.graph.nodes
        .filter((node) => node.kind === "evidence")
        .map<PinLinkOption>((node) => ({ id: node.id, label: node.label })),
      suspects: activeInvestigation.graph.nodes
        .filter((node) =>
          ["suspect", "attacker", "planner"].includes(node.kind),
        )
        .map<PinLinkOption>((node) => ({ id: node.id, label: node.label })),
      timeline: activeInvestigation.timeline.events.map<PinLinkOption>(
        (event) => ({ id: event.id, label: `${event.id} // ${event.title}` }),
      ),
    }),
    [activeInvestigation],
  );

  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null;
  const pinPendingDelete = pins.find((pin) => pin.id === deletePinId) ?? null;
  const pinOperationActive = isAddPinMode || pinEditorMode === "create";
  const isAwaitingPinPlacement = isAddPinMode && !temporaryPin;

  const showPinFeedback = useCallback((message: string) => {
    setPinFeedback(message);
    if (pinFeedbackTimerRef.current !== null) {
      window.clearTimeout(pinFeedbackTimerRef.current);
    }
    pinFeedbackTimerRef.current = window.setTimeout(() => {
      setPinFeedback(null);
      pinFeedbackTimerRef.current = null;
    }, 2200);
  }, []);

  const loadPins = useCallback(
    async (signal?: AbortSignal) => {
      setPinsLoading(true);
      setPinsLoadError(null);
      try {
        const casePins = await listInvestigationPins(
          activeInvestigationId,
          signal,
        );
        setPins(casePins);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setPins([]);
        setPinsLoadError(
          error instanceof Error
            ? error.message
            : "INVESTIGATION PINS COULD NOT BE LOADED",
        );
      } finally {
        if (!signal?.aborted) setPinsLoading(false);
      }
    },
    [activeInvestigationId],
  );

  const cancelPinOperation = useCallback(() => {
    setIsAddPinMode(false);
    setTemporaryPin(null);
    setPinEditorMode((mode) => (mode === "create" ? null : mode));
    setPinMutationError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setSelectedPinId(null);
    setDeletePinId(null);
    setPinEditorMode(null);
    setTemporaryPin(null);
    setIsAddPinMode(false);
    void loadPins(controller.signal);
    return () => controller.abort();
  }, [loadPins]);

  useEffect(
    () => () => {
      if (pinFeedbackTimerRef.current !== null) {
        window.clearTimeout(pinFeedbackTimerRef.current);
      }
    },
    [],
  );

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
  const selectedLocationId = useInvestigationStore((s) => s.selectedLocationId);
  const workspaceComparisonSelection = useInvestigationStore(
    (s) => s.workspaceComparisonSelection,
  );
  const setSelectedLocationId = useInvestigationStore(
    (s) => s.setSelectedLocationId,
  );
  const clearAllFilters = useInvestigationStore((s) => s.clearAllFilters);

  const beginOrCancelPinPlacement = useCallback(() => {
    if (pinOperationActive) {
      cancelPinOperation();
      return;
    }
    triggerHaptic("light");
    setActiveLayer("PINS");
    setSelectedLocationId(null);
    setSelectedPinId(null);
    setDeletePinId(null);
    setPinEditorMode(null);
    setTemporaryPin(null);
    setPinMutationError(null);
    setIsAddPinMode(true);
  }, [cancelPinOperation, pinOperationActive, setSelectedLocationId]);

  const selectUserPin = useCallback(
    (pinId: string) => {
      triggerHaptic("light");
      setSelectedLocationId(null);
      setPinEditorMode(null);
      setPinMutationError(null);
      setSelectedPinId(pinId);
    },
    [setSelectedLocationId],
  );

  const handleMapPinPlacement = useCallback(
    (info: { coordinate?: number[] }) => {
      if (!isAwaitingPinPlacement || !info.coordinate) return;
      const [longitude, latitude] = info.coordinate;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return;
      }
      triggerHaptic("heavy");
      setTemporaryPin({ latitude, longitude });
      setIsAddPinMode(false);
      setPinEditorMode("create");
      setPinMutationError(null);
    },
    [isAwaitingPinPlacement],
  );

  const savePin = useCallback(
    async (values: InvestigationPinFormValues) => {
      if (pinMutationInFlightRef.current) return;
      const investigationId = activeInvestigationId;
      pinMutationInFlightRef.current = true;
      setIsSavingPin(true);
      setPinMutationError(null);

      try {
        if (pinEditorMode === "create" && temporaryPin) {
          const created = await createInvestigationPin(investigationId, {
            ...values,
            latitude: temporaryPin.latitude,
            longitude: temporaryPin.longitude,
          });
          if (
            useInvestigationStore.getState().activeInvestigationId !==
            investigationId
          ) {
            return;
          }
          setPins((current) => [...current, created]);
          setSelectedPinId(created.id);
          setTemporaryPin(null);
          setPinEditorMode(null);
          showPinFeedback("PIN ADDED");
          return;
        }

        if (pinEditorMode === "edit" && selectedPin) {
          const updated = await updateInvestigationPin(
            investigationId,
            selectedPin.id,
            values,
          );
          if (
            useInvestigationStore.getState().activeInvestigationId !==
            investigationId
          ) {
            return;
          }
          setPins((current) =>
            current.map((pin) => (pin.id === updated.id ? updated : pin)),
          );
          setPinEditorMode(null);
          showPinFeedback("PIN UPDATED");
        }
      } catch (error) {
        setPinMutationError(
          error instanceof Error ? error.message : "PIN COULD NOT BE SAVED",
        );
      } finally {
        pinMutationInFlightRef.current = false;
        setIsSavingPin(false);
      }
    },
    [
      activeInvestigationId,
      pinEditorMode,
      selectedPin,
      showPinFeedback,
      temporaryPin,
    ],
  );

  const confirmDeletePin = useCallback(async () => {
    if (!pinPendingDelete || pinMutationInFlightRef.current) return;
    const investigationId = activeInvestigationId;
    pinMutationInFlightRef.current = true;
    setIsDeletingPin(true);
    setPinMutationError(null);

    try {
      await deleteInvestigationPin(investigationId, pinPendingDelete.id);
      if (
        useInvestigationStore.getState().activeInvestigationId !==
        investigationId
      ) {
        return;
      }
      setPins((current) =>
        current.filter((pin) => pin.id !== pinPendingDelete.id),
      );
      setSelectedPinId(null);
      setDeletePinId(null);
      showPinFeedback("PIN DELETED");
    } catch (error) {
      setPinMutationError(
        error instanceof Error ? error.message : "PIN COULD NOT BE DELETED",
      );
    } finally {
      pinMutationInFlightRef.current = false;
      setIsDeletingPin(false);
    }
  }, [activeInvestigationId, pinPendingDelete, showPinFeedback]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (deletePinId) {
        setDeletePinId(null);
        setPinMutationError(null);
        return;
      }
      if (pinEditorMode === "edit") {
        setPinEditorMode(null);
        setPinMutationError(null);
        return;
      }
      if (pinOperationActive) cancelPinOperation();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cancelPinOperation, deletePinId, pinEditorMode, pinOperationActive]);

  const selectedLocation = activeInvestigation.map.locations.find(
    (location) => location.id === selectedLocationId,
  );
  const relatedLocationIds = useMemo(() => {
    const ids = new Set(workspaceComparisonSelection?.locationIds ?? []);
    const entityIds = new Set(workspaceComparisonSelection?.entityIds ?? []);
    if (selectedEntityId) entityIds.add(selectedEntityId);
    entityIds.forEach((entityId) =>
      getLocationsForEntity(activeInvestigation, entityId).forEach((location) =>
        ids.add(location.id),
      ),
    );
    return ids;
  }, [activeInvestigation, selectedEntityId, workspaceComparisonSelection]);

  const activeIncidentData = useMemo<IncidentPoint[]>(
    () =>
      activeInvestigationId === "demo"
        ? incidentData
        : activeLocations
            .filter(
              (location) =>
                (location.killed ?? 0) + (location.injured ?? 0) > 0,
            )
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
  }, [
    activeInvestigation,
    activeInvestigationId,
    activeLocations,
    movementData,
  ]);

  const playbackIndex = Math.max(0, playbackDates.indexOf(playbackDate));

  /* ── Deck.gl view state ────────────────────── */

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: -87.6298,
    latitude: 41.8818,
    zoom: 12.7,
    pitch: 0,
    bearing: 0,
  });
  const liveViewStateRef = useRef<MapViewState>(viewState);

  useEffect(() => {
    setActiveLayer("PINS");
    const nextViewState: MapViewState = {
      longitude: activeInvestigation.map.center[0],
      latitude: activeInvestigation.map.center[1],
      zoom: activeInvestigation.map.zoom,
      pitch: 0,
      bearing: 0,
    };
    liveViewStateRef.current = nextViewState;
    setViewState(nextViewState);
  }, [activeInvestigation]);

  const changeViewMode = useCallback((mode: ViewMode) => {
    const camera =
      mode === "3D" ? { pitch: 60, bearing: -15 } : { pitch: 0, bearing: 0 };

    setViewMode(mode);
    // Deck.gl is the single camera owner. Running this on every click also lets
    // the active button restore its intended camera after manual interaction.
    const nextViewState = {
      ...liveViewStateRef.current,
      ...camera,
      transitionDuration: 1500,
      transitionInterpolator: new FlyToInterpolator(),
    };
    liveViewStateRef.current = nextViewState;
    setViewState(nextViewState);
  }, []);

  useEffect(() => {
    if (!mapPanRequest) return;

    const nextViewState = {
      ...liveViewStateRef.current,
      longitude: mapPanRequest.coordinates[0],
      latitude: mapPanRequest.coordinates[1],
      zoom: Math.max(liveViewStateRef.current.zoom, 15),
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    };
    liveViewStateRef.current = nextViewState;
    setViewState(nextViewState);
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
    [
      activeLocations,
      playbackDate,
      selectedCrimeTypes,
      spatialBounds,
      timeRange,
    ],
  );
  const visibleSystemLocations = useMemo(
    () =>
      visibleIncidents.map((location) => ({
        ...location,
        source: "system" as const,
      })),
    [visibleIncidents],
  );

  const visibleUserPins = useMemo(
    () =>
      pinVisibility === "system"
        ? []
        : pins.filter((pin) => selectedPinCategories.includes(pin.category)),
    [pinVisibility, pins, selectedPinCategories],
  );
  const showSystemLocations = pinVisibility !== "user";

  const filterCounts = useMemo(
    () =>
      crimeTypes.reduce<Record<string, number>>((counts, crimeType) => {
        counts[crimeType] = activeLocations.filter(
          (incident) =>
            incident.filterGroups.includes(crimeType) &&
            incident.date <= playbackDate &&
            incident.date >= timeRange[0] &&
            incident.date <= timeRange[1] &&
            isWithinBounds(incident.coordinates, spatialBounds),
        ).length;
        return counts;
      }, {}),
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
            setHoveredRouteId(
              (object as TelemetryPath | undefined)?.routeId ?? null,
            ),
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

  const onViewStateChange = useCallback(
    (nextViewState: MapViewState) => {
      // Deck.gl owns interactive camera frames. Keeping the live value in a ref
      // avoids reconciling every marker, panel, and filter on every pointer move.
      liveViewStateRef.current = nextViewState;
    },
    [],
  );

  /* ── Render ─────────────────────────────────── */

  // Prevent WebGL crash by waiting for theme resolution
  if (!mounted || !resolvedTheme) {
    return (
      <div className="relative h-full min-h-0 w-full bg-[#F4F4F0] dark:bg-[#01161E]" />
    );
  }

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
                if (pinOperationActive && layer !== "PINS") {
                  cancelPinOperation();
                }
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
      <div className="border-t-4 border-[var(--ink)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span>Pin Source</span>
          <span className="text-[9px] opacity-60">{pins.length} USER</span>
        </div>
        <div
          className="grid grid-cols-3 gap-1"
          role="group"
          aria-label="Pin source visibility"
        >
          {(["all", "system", "user"] as PinVisibility[]).map((visibility) => (
            <button
              key={visibility}
              type="button"
              aria-pressed={pinVisibility === visibility}
              onClick={() => {
                triggerHaptic("light");
                setPinVisibility(visibility);
                setActiveLayer("PINS");
              }}
              className={`min-h-11 border-2 border-[var(--ink)] px-1 text-[9px] ${
                pinVisibility === visibility
                  ? "bg-[var(--ink)] text-[var(--paper)]"
                  : "bg-[var(--panel)] text-[var(--ink)]"
              }`}
            >
              {visibility === "all"
                ? "ALL"
                : visibility === "system"
                  ? "SYSTEM"
                  : "USER PINS"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1">
        {PIN_CATEGORIES.map((category) => {
          const detail = PIN_CATEGORY_DETAILS[category];
          const checked = selectedPinCategories.includes(category);
          return (
            <label
              key={category}
              className="flex min-h-11 cursor-pointer items-center gap-2 border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-1 text-[9px]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setSelectedPinCategories((current) =>
                    enabled
                      ? current.includes(category)
                        ? current
                        : [...current, category]
                      : current.filter((item) => item !== category),
                  );
                }}
                className="h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rotate-45 border border-current bg-current"
                style={{ color: detail.color }}
              />
              <span>{detail.label}</span>
            </label>
          );
        })}
      </div>

      <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2 text-[9px]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 border border-[var(--ink)] bg-[var(--ink)]" />
          SYSTEM LOCATION
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rotate-45 border-2 border-[var(--accent)]" />
          USER-ADDED LOCATION
        </div>
      </div>

      {pinsLoadError ? (
        <div
          role="alert"
          className="border-2 border-[var(--danger)] bg-[var(--panel)] p-2 text-[var(--danger)]"
        >
          <div>INVESTIGATION PINS COULD NOT BE LOADED</div>
          <div className="mt-1 normal-case opacity-75">{pinsLoadError}</div>
          <button
            type="button"
            onClick={() => void loadPins()}
            className="mt-2 min-h-11 border-2 border-current px-2"
          >
            [ Retry ]
          </button>
        </div>
      ) : pinsLoading ? (
        <div className="border-2 border-[var(--ink)] bg-[var(--panel)] p-2 text-[9px] opacity-70">
          LOADING USER PINS...
        </div>
      ) : pins.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--ink)] bg-[var(--panel)] p-2 text-[9px] opacity-70">
          NO USER PINS // USE + ADD PIN TO MARK A LOCATION
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="flex min-h-11 items-center border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-2">
          Visible: {visibleIncidents.length}
        </div>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            clearAllFilters();
            setPinVisibility("all");
            setSelectedPinCategories([...PIN_CATEGORIES]);
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
      data-camera-pitch={Math.round(viewState.pitch ?? 0)}
      data-camera-bearing={Math.round(viewState.bearing ?? 0)}
      className={`relative h-full min-h-0 w-full overflow-hidden bg-gray-900 md:rounded-xl ${
        isFullscreenMap ? "fixed inset-0 z-50 h-dvh" : ""
      }`}
    >
      <DeckGL
        initialViewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) =>
          onViewStateChange(nextViewState as MapViewState)
        }
        onClick={handleMapPinPlacement}
        getCursor={({ isDragging }) =>
          isAwaitingPinPlacement
            ? "crosshair"
            : isDragging
              ? "grabbing"
              : "grab"
        }
        controller={true}
        layers={layers}
        effects={MAP_EFFECTS}
        getTooltip={getTooltip as any}
        style={MAP_DIMENSIONS}
      >
        <Map
          style={MAP_DIMENSIONS}
          mapStyle={currentMapStyle}
          reuseMaps={true}
          attributionControl={false}
        >
          {activeLayer === "PINS" &&
            showSystemLocations &&
            visibleSystemLocations.map((incident) => (
              <Marker
                key={incident.id}
                longitude={incident.coordinates[0]}
                latitude={incident.coordinates[1]}
                anchor="center"
              >
                <button
                  type="button"
                  aria-label={`${incident.title}; ${incident.type}; ${incident.timeLabel}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (pinOperationActive) return;
                    triggerHaptic("light");
                    setSelectedPinId(null);
                    setPinEditorMode(null);
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
          {activeLayer === "PINS" &&
            visibleUserPins.map((pin) => (
              <Marker
                key={pin.id}
                longitude={pin.longitude}
                latitude={pin.latitude}
                anchor="bottom"
              >
                <InvestigationPinMarker
                  pin={pin}
                  selected={selectedPinId === pin.id}
                  placementActive={pinOperationActive}
                  onSelect={selectUserPin}
                />
              </Marker>
            ))}
          {temporaryPin ? (
            <Marker
              longitude={temporaryPin.longitude}
              latitude={temporaryPin.latitude}
              anchor="center"
            >
              <TemporaryInvestigationPinMarker />
            </Marker>
          ) : null}
        </Map>
      </DeckGL>

      {activeLayer === "DENSITY" && activeInvestigation.map.densityNotice ? (
        <div className="absolute left-1/2 top-1/2 z-20 w-[min(340px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 border-4 border-[var(--ink)] bg-[var(--accent)] px-4 py-3 text-center font-mono text-xs font-black uppercase text-[var(--ink)] shadow-[5px_5px_0_var(--ink)]">
          [ {activeInvestigation.map.densityNotice} ]
        </div>
      ) : null}

      {hoveredRoute ? (
        <div className="pointer-events-none absolute right-4 top-28 z-20 max-w-sm border-4 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]">
          <div>
            {hoveredRoute.label} // {hoveredRoute.teamLabel}
          </div>
          <div className="mt-1 normal-case opacity-70">
            {hoveredRoute.description}
          </div>
        </div>
      ) : null}

      {selectedLocation && !selectedPin && !pinEditorMode ? (
        <aside className="absolute bottom-3 left-3 right-3 z-40 max-h-[min(60dvh,420px)] overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-3 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[6px_6px_0_var(--ink)] md:bottom-28 md:left-auto md:right-4 md:w-[min(360px,calc(100%-1.5rem))] md:text-xs">
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
              <div className="text-[9px] uppercase opacity-60">
                ASSIGNED TEAM
              </div>
              {selectedLocation.assignedTeam}
            </div>
          ) : null}
          <p className="mt-2 border-2 border-[var(--ink)] p-2 normal-case leading-tight">
            {selectedLocation.description}
          </p>
          <div className="mt-2 text-[9px] opacity-60">
            SOURCE STATUS: {selectedLocation.confidence} / COORDINATE:{" "}
            {selectedLocation.coordinateStatus}
          </div>
          <AddToNetworkWorkspaceButton
            source={{
              sourceKind: "location",
              sourceId: selectedLocation.id,
              label: selectedLocation.title,
              type: "location",
              description: selectedLocation.description,
              sourceVerificationStatus:
                activeInvestigation.type === "DEMO" ? "demo" : "verified",
            }}
            className="mt-3 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-left text-[10px] font-black uppercase text-[var(--ink)] shadow-[4px_4px_0_var(--ink)]"
          />
        </aside>
      ) : null}

      {selectedPin && !pinEditorMode ? (
        <InvestigationPinDetails
          pin={selectedPin}
          linkOptions={pinLinkOptions}
          onClose={() => setSelectedPinId(null)}
          onEdit={() => {
            setPinMutationError(null);
            setPinEditorMode("edit");
          }}
          onDelete={() => {
            setPinMutationError(null);
            setDeletePinId(selectedPin.id);
          }}
        />
      ) : null}

      {pinEditorMode === "create" && temporaryPin ? (
        <InvestigationPinEditor
          key={`create-${temporaryPin.latitude}-${temporaryPin.longitude}`}
          mode="create"
          latitude={temporaryPin.latitude}
          longitude={temporaryPin.longitude}
          linkOptions={pinLinkOptions}
          isSaving={isSavingPin}
          error={pinMutationError}
          onCancel={cancelPinOperation}
          onSave={savePin}
        />
      ) : null}

      {pinEditorMode === "edit" && selectedPin ? (
        <InvestigationPinEditor
          key={`edit-${selectedPin.id}-${selectedPin.updatedAt}`}
          mode="edit"
          pin={selectedPin}
          latitude={selectedPin.latitude}
          longitude={selectedPin.longitude}
          linkOptions={pinLinkOptions}
          isSaving={isSavingPin}
          error={pinMutationError}
          onCancel={() => {
            setPinEditorMode(null);
            setPinMutationError(null);
          }}
          onSave={savePin}
        />
      ) : null}

      {isAwaitingPinPlacement ? (
        <div className="pointer-events-none absolute left-1/2 top-28 z-40 w-[min(390px,calc(100%-1.5rem))] -translate-x-1/2 border-4 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-center font-mono text-[9px] font-black uppercase text-[var(--ink)] shadow-[4px_4px_0_var(--ink)] md:text-xs lg:top-28">
          <div>+ ADD PIN MODE</div>
          <div className="mt-1 text-[8px] opacity-70 md:text-[10px]">
            CLICK OR TAP EMPTY MAP TO PLACE LOCATION // ESC TO CANCEL
          </div>
        </div>
      ) : null}

      {pinFeedback ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute left-1/2 top-3 z-[60] -translate-x-1/2 border-2 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 font-mono text-[10px] font-black uppercase text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] md:top-4"
        >
          [ {pinFeedback} ]
        </div>
      ) : null}

      {/* 2D / 3D camera mode */}
      <div
        role="group"
        aria-label="Map view mode"
        className="absolute right-3 top-3 z-20 flex border-4 border-black bg-white font-mono text-[9px] font-black uppercase shadow-[4px_4px_0_black] dark:border dark:border-[#598392] dark:bg-[#01161E] dark:shadow-[inset_0_0_14px_rgba(174,195,176,0.12),0_0_18px_rgba(1,22,30,0.72)] sm:right-4 sm:top-4 sm:text-xs"
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
              className={`px-2 py-2 sm:px-4 ${
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
              type="button"
              onClick={() => {
                triggerHaptic("light");
                if (pinOperationActive && layer !== "PINS") {
                  cancelPinOperation();
                }
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
        <button
          type="button"
          aria-pressed={pinOperationActive}
          onClick={beginOrCancelPinPlacement}
          className={`flex items-center gap-1 border-l-2 px-3 py-2 transition-[transform,background-color,color] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FCD34D] ${
            pinOperationActive
              ? "border-[#EFF6E0] bg-[#D22B2B] text-white"
              : "border-[#598392] bg-[#FCD34D] text-black"
          }`}
        >
          {pinOperationActive ? (
            <X aria-hidden="true" size={14} strokeWidth={3} />
          ) : (
            <Plus aria-hidden="true" size={14} strokeWidth={3} />
          )}
          {pinOperationActive ? "CANCEL PIN" : "ADD PIN"}
        </button>
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

      <div className="absolute left-3 right-[4.25rem] top-16 z-20 flex min-w-0 font-mono text-[9px] font-black uppercase lg:hidden">
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setIsMobileFiltersOpen(true);
          }}
          className="min-h-11 min-w-0 flex-1 truncate border-4 border-black bg-[#F4F4F0] px-2 text-black shadow-[3px_3px_0_black] dark:border-[#598392] dark:bg-[#01161E] dark:text-[#AEC3B0] dark:shadow-[0_0_12px_rgba(1,22,30,0.75)]"
        >
          [ FILTERS ]
        </button>
        <button
          type="button"
          aria-pressed={pinOperationActive}
          onClick={beginOrCancelPinPlacement}
          className={`ml-2 flex min-h-11 shrink-0 items-center gap-1 border-4 border-black px-2 shadow-[3px_3px_0_black] dark:border-[#598392] ${
            pinOperationActive
              ? "bg-[#D22B2B] text-white"
              : "bg-[#FCD34D] text-black dark:bg-[#AEC3B0] dark:text-[#01161E]"
          }`}
        >
          {pinOperationActive ? (
            <X aria-hidden="true" size={13} strokeWidth={3} />
          ) : (
            <Plus aria-hidden="true" size={13} strokeWidth={3} />
          )}
          {pinOperationActive ? "CANCEL" : "ADD PIN"}
        </button>
      </div>

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
        className="absolute bottom-3 left-3 right-3 z-10 border-4 border-[var(--ink)] bg-[var(--paper)] p-2 font-mono text-[9px] font-black uppercase shadow-[3px_3px_0_var(--ink)] md:bottom-4 md:right-4 md:p-3 md:text-xs md:shadow-[6px_6px_0_var(--ink)] lg:left-[370px]"
      >
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            onClick={togglePlayback}
            className="flex h-11 shrink-0 items-center justify-center gap-2 border-4 border-[var(--ink)] bg-[var(--danger)] px-3 text-[var(--paper)] shadow-[4px_4px_0_var(--ink)] active:translate-x-1 active:translate-y-1 active:shadow-none md:w-36 md:px-4"
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

      {pinPendingDelete ? (
        <InvestigationPinDeleteDialog
          pin={pinPendingDelete}
          isDeleting={isDeletingPin}
          error={pinMutationError}
          onCancel={() => {
            setDeletePinId(null);
            setPinMutationError(null);
          }}
          onConfirm={() => void confirmDeletePin()}
        />
      ) : null}
    </div>
  );
}
