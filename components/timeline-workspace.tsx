"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eye, FileText, X, ZoomIn, ZoomOut } from "lucide-react";
import { useInvestigationStore } from "@/store/use-investigation-store";

/* ─── TYPES ─────────────────────────────────────────────────── */

type EventCategory = "CALL" | "ARREST" | "EVIDENCE" | "CCTV" | "FORENSIC" | "ANALYSIS";

type TimelineEvent = {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  category: EventCategory;
  title: string;
  description: string;
  severity: number; // 1–10
};

type AnnotationType = "cctv" | "eyewitness" | "document";

type Annotation = {
  id: string;
  eventId: string;
  type: AnnotationType;
  note: string;
};

/* ─── DATA ──────────────────────────────────────────────────── */

const EVENTS: TimelineEvent[] = [
  {
    id: "TL-001",
    date: "2026-07-18",
    time: "21:14",
    timestamp: new Date("2026-07-18T21:14:00").getTime(),
    category: "CCTV",
    title: "Victim enters station",
    description: "Platform 9 camera captures victim at 21:14. Last confirmed sighting.",
    severity: 9,
  },
  {
    id: "TL-002",
    date: "2026-07-18",
    time: "21:32",
    timestamp: new Date("2026-07-18T21:32:00").getTime(),
    category: "CALL",
    title: "Anonymous tip received",
    description: "Switchboard logs anonymous call referencing Platform 9 disturbance.",
    severity: 6,
  },
  {
    id: "TL-003",
    date: "2026-07-18",
    time: "22:05",
    timestamp: new Date("2026-07-18T22:05:00").getTime(),
    category: "EVIDENCE",
    title: "Ticket stub recovered",
    description: "Torn ticket stub found in inner coat pocket during initial sweep.",
    severity: 7,
  },
  {
    id: "TL-004",
    date: "2026-07-19",
    time: "08:30",
    timestamp: new Date("2026-07-19T08:30:00").getTime(),
    category: "FORENSIC",
    title: "Ticket ledger mismatch",
    description: "Morning audit reveals ledger discrepancy — three entries lack counterfoils.",
    severity: 5,
  },
  {
    id: "TL-005",
    date: "2026-07-20",
    time: "01:15",
    timestamp: new Date("2026-07-20T01:15:00").getTime(),
    category: "CCTV",
    title: "Night clerk second visitor",
    description: "CCTV corroborates clerk testimony: unidentified visitor at 01:15.",
    severity: 8,
  },
  {
    id: "TL-006",
    date: "2026-07-20",
    time: "02:40",
    timestamp: new Date("2026-07-20T02:40:00").getTime(),
    category: "CALL",
    title: "Clerk reports break-in attempt",
    description: "Night clerk dials emergency line reporting forced entry at Annex B.",
    severity: 7,
  },
  {
    id: "TL-007",
    date: "2026-07-20",
    time: "06:10",
    timestamp: new Date("2026-07-20T06:10:00").getTime(),
    category: "ARREST",
    title: "Suspect A detained",
    description: "Individual matching description apprehended near loading dock.",
    severity: 9,
  },
  {
    id: "TL-008",
    date: "2026-07-20",
    time: "11:00",
    timestamp: new Date("2026-07-20T11:00:00").getTime(),
    category: "EVIDENCE",
    title: "Evidence room entry log",
    description: "Critical evidence room shows unauthorized access at 04:47.",
    severity: 10,
  },
  {
    id: "TL-009",
    date: "2026-07-21",
    time: "14:20",
    timestamp: new Date("2026-07-21T14:20:00").getTime(),
    category: "FORENSIC",
    title: "Partial print from Annex B",
    description: "Latent print recovered from forced door handle. Partial match pending.",
    severity: 8,
  },
  {
    id: "TL-010",
    date: "2026-07-22",
    time: "09:00",
    timestamp: new Date("2026-07-22T09:00:00").getTime(),
    category: "ANALYSIS",
    title: "Cross-reference initiated",
    description: "Analyst begins cross-referencing ledger anomalies with CCTV timestamps.",
    severity: 4,
  },
  {
    id: "TL-011",
    date: "2026-07-24",
    time: "16:35",
    timestamp: new Date("2026-07-24T16:35:00").getTime(),
    category: "ARREST",
    title: "Suspect B identified",
    description: "Second suspect identified through partial print match. Warrant issued.",
    severity: 9,
  },
  {
    id: "TL-012",
    date: "2026-07-24",
    time: "17:10",
    timestamp: new Date("2026-07-24T17:10:00").getTime(),
    category: "CALL",
    title: "Informant tip — Canal St.",
    description: "Registered informant provides location intel on Suspect B.",
    severity: 7,
  },
  {
    id: "TL-013",
    date: "2026-07-24",
    time: "19:45",
    timestamp: new Date("2026-07-24T19:45:00").getTime(),
    category: "ARREST",
    title: "Suspect B apprehended",
    description: "Suspect B taken into custody at Canal Street Market without incident.",
    severity: 10,
  },
  {
    id: "TL-014",
    date: "2026-07-25",
    time: "10:00",
    timestamp: new Date("2026-07-25T10:00:00").getTime(),
    category: "FORENSIC",
    title: "Accelerant trace confirmed",
    description: "Lab confirms petroleum-based accelerant on loading dock samples.",
    severity: 6,
  },
  {
    id: "TL-015",
    date: "2026-07-25",
    time: "15:30",
    timestamp: new Date("2026-07-25T15:30:00").getTime(),
    category: "EVIDENCE",
    title: "Archive cage breach evidence",
    description: "Cut lock recovered; tool marks consistent with compact bolt cutter.",
    severity: 7,
  },
  {
    id: "TL-016",
    date: "2026-07-26",
    time: "08:15",
    timestamp: new Date("2026-07-26T08:15:00").getTime(),
    category: "ANALYSIS",
    title: "Pattern link established",
    description: "Analyst connects three incidents to single MO. Crime spree hypothesis elevated.",
    severity: 8,
  },
  {
    id: "TL-017",
    date: "2026-07-27",
    time: "12:00",
    timestamp: new Date("2026-07-27T12:00:00").getTime(),
    category: "FORENSIC",
    title: "DNA sample submitted",
    description: "Biological sample from ticket stub sent for expedited DNA analysis.",
    severity: 7,
  },
  {
    id: "TL-018",
    date: "2026-07-28",
    time: "09:30",
    timestamp: new Date("2026-07-28T09:30:00").getTime(),
    category: "ANALYSIS",
    title: "Cross-case link promoted",
    description: "Three-case connection promoted from hypothesis to active lead.",
    severity: 9,
  },
];

const CATEGORY_COLORS: Record<EventCategory, string> = {
  CALL: "#D22B2B",
  ARREST: "#000000",
  EVIDENCE: "#FCD34D",
  CCTV: "#6366F1",
  FORENSIC: "#059669",
  ANALYSIS: "#D97706",
};

const ANNOTATION_ICONS: Record<AnnotationType, { icon: typeof Camera; label: string; emoji: string }> = {
  cctv: { icon: Camera, label: "CCTV FOOTAGE", emoji: "📸" },
  eyewitness: { icon: Eye, label: "EYEWITNESS", emoji: "👁️" },
  document: { icon: FileText, label: "FORENSICS", emoji: "📄" },
};

/* ─── SUSPECT → TIMELINE EVENT LINKS ─────────────────────── */

const suspectTimelineLinks: Record<string, string[]> = {
  "sus-ada": ["TL-001", "TL-003", "TL-007", "TL-008", "TL-015"],
  "sus-marlowe": ["TL-005", "TL-006", "TL-009", "TL-017"],
  "sus-vale": ["TL-004", "TL-010", "TL-011", "TL-013", "TL-018"],
};

/* ─── HELPERS ───────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const msDay = 86400000;
  return Math.abs(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / msDay,
  );
}

/* ─── GAP COMPRESSION ENGINE ─────────────────────────────────
   Compresses long inactive gaps while expanding dense clusters.
   Returns a mapping of events → x-positions on a virtual axis. */

type CompressedLayout = {
  positions: Map<string, number>;
  totalWidth: number;
  segments: { date: string; x: number; width: number; eventCount: number }[];
};

function computeCompressedLayout(events: TimelineEvent[]): CompressedLayout {
  if (events.length === 0) {
    return { positions: new Map(), totalWidth: 0, segments: [] };
  }

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Group events by date
  const dateGroups = new Map<string, TimelineEvent[]>();
  for (const event of sorted) {
    const existing = dateGroups.get(event.date) || [];
    existing.push(event);
    dateGroups.set(event.date, existing);
  }

  const dates = Array.from(dateGroups.keys()).sort();
  const positions = new Map<string, number>();
  const segments: CompressedLayout["segments"] = [];

  const BASE_DAY_WIDTH = 120;
  const DENSE_BONUS = 40; // extra width per event in a cluster
  const MIN_GAP_WIDTH = 32;
  const MAX_GAP_WIDTH = 60;
  const EVENT_NODE_SPACING = 56;

  let cursor = 60; // left padding

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const group = dateGroups.get(date)!;

    // Calculate segment width based on event density
    const segmentWidth = BASE_DAY_WIDTH + (group.length - 1) * DENSE_BONUS;

    const segStart = cursor;

    // Position each event within the segment
    for (let j = 0; j < group.length; j++) {
      const eventX = segStart + (j * EVENT_NODE_SPACING);
      positions.set(group[j].id, eventX);
    }

    segments.push({
      date,
      x: segStart,
      width: Math.max(segmentWidth, group.length * EVENT_NODE_SPACING),
      eventCount: group.length,
    });

    cursor = segStart + Math.max(segmentWidth, group.length * EVENT_NODE_SPACING);

    // Add compressed gap to next date
    if (i < dates.length - 1) {
      const gap = daysBetween(date, dates[i + 1]);
      // Logarithmic compression for gaps
      const gapWidth = gap <= 1
        ? MIN_GAP_WIDTH
        : Math.min(MAX_GAP_WIDTH, MIN_GAP_WIDTH + Math.log2(gap) * 14);
      cursor += gapWidth;
    }
  }

  cursor += 60; // right padding

  return { positions, totalWidth: cursor, segments };
}

/* ─── DENSITY HEATMAP DATA ───────────────────────────────────── */

type DensityBucket = {
  date: string;
  count: number;
  maxSeverity: number;
  events: TimelineEvent[];
};

function computeDensityBuckets(events: TimelineEvent[]): DensityBucket[] {
  const bucketMap = new Map<string, DensityBucket>();

  for (const event of events) {
    const existing = bucketMap.get(event.date);
    if (existing) {
      existing.count++;
      existing.maxSeverity = Math.max(existing.maxSeverity, event.severity);
      existing.events.push(event);
    } else {
      bucketMap.set(event.date, {
        date: event.date,
        count: 1,
        maxSeverity: event.severity,
        events: [event],
      });
    }
  }

  return Array.from(bucketMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

/* ─── ANNOTATION PANEL ───────────────────────────────────────── */

function AnnotationPanel({
  event,
  annotations,
  onAdd,
  onClose,
}: {
  event: TimelineEvent;
  annotations: Annotation[];
  onAdd: (type: AnnotationType, note: string) => void;
  onClose: () => void;
}) {
  const [selectedType, setSelectedType] = useState<AnnotationType>("cctv");
  const [noteText, setNoteText] = useState("");
  const eventAnnotations = annotations.filter((a) => a.eventId === event.id);

  return (
    <div className="absolute right-0 top-0 z-50 h-full w-[380px] border-l-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase shadow-[-6px_0_0_black] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-3 text-white">
        <span>Annotate Event</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center border-2 border-white hover:bg-white hover:text-black"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>

      {/* Event Info */}
      <div className="border-b-4 border-black p-4">
        <div className="mb-2 inline-block px-2 py-1 text-white" style={{ backgroundColor: CATEGORY_COLORS[event.category] }}>
          {event.category}
        </div>
        <p className="text-sm">{event.id} — {event.date} {event.time}</p>
        <p className="mt-2 normal-case leading-tight">{event.title}</p>
      </div>

      {/* Add Annotation */}
      <div className="border-b-4 border-black p-4">
        <p className="mb-3">Add Intelligence Note</p>
        <div className="flex gap-2 mb-3">
          {(Object.entries(ANNOTATION_ICONS) as [AnnotationType, typeof ANNOTATION_ICONS[AnnotationType]][]).map(
            ([type, config]) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`flex h-10 flex-1 items-center justify-center gap-1 border-4 border-black shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                  selectedType === type
                    ? "bg-black text-white"
                    : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5"
                }`}
              >
                <span className="text-base not-italic">{config.emoji}</span>
              </button>
            ),
          )}
        </div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter annotation note..."
          className="mb-3 block w-full resize-none border-4 border-black bg-white p-3 normal-case placeholder:uppercase placeholder:text-black/30 focus:outline-none"
          rows={3}
        />
        <button
          type="button"
          onClick={() => {
            if (noteText.trim()) {
              onAdd(selectedType, noteText.trim());
              setNoteText("");
            }
          }}
          disabled={!noteText.trim()}
          className="w-full border-4 border-black bg-[#FCD34D] py-2 shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none"
        >
          Pin Annotation
        </button>
      </div>

      {/* Existing Annotations */}
      {eventAnnotations.length > 0 && (
        <div className="p-4">
          <p className="mb-3">Pinned Notes ({eventAnnotations.length})</p>
          <div className="space-y-3">
            {eventAnnotations.map((annotation) => {
              const config = ANNOTATION_ICONS[annotation.type];
              return (
                <div
                  key={annotation.id}
                  className="border-4 border-black bg-white p-3 shadow-[3px_3px_0_black]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-base">{config.emoji}</span>
                    <span className="text-[10px]">{config.label}</span>
                  </div>
                  <p className="normal-case leading-tight">{annotation.note}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ANNOTATION CALLOUT (pinned above event nodes) ──────────── */

function AnnotationCallout({
  annotation,
  style,
}: {
  annotation: Annotation;
  style: React.CSSProperties;
}) {
  const config = ANNOTATION_ICONS[annotation.type];

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={style}
    >
      {/* Callout box */}
      <div className="relative border-4 border-black bg-white px-2 py-1.5 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_black] whitespace-nowrap pointer-events-auto">
        <span className="mr-1 text-sm not-italic">{config.emoji}</span>
        <span className="max-w-[120px] overflow-hidden text-ellipsis inline-block align-middle">
          {annotation.note.length > 18 ? annotation.note.slice(0, 18) + "…" : annotation.note}
        </span>
        {/* Arrow pointing down */}
        <div className="absolute -bottom-[10px] left-4 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-black" />
      </div>
    </div>
  );
}

/* ─── DENSITY HEATMAP VIEW (fully zoomed out) ─────────────── */

function DensityHeatmapView({
  buckets,
  onBrush,
}: {
  buckets: DensityBucket[];
  onBrush: (start: string, end: string) => void;
}) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (index: number) => {
    setBrushStart(index);
    setBrushEnd(index);
    setIsDragging(true);
  };

  const handleMouseMove = (index: number) => {
    if (isDragging) {
      setBrushEnd(index);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && brushStart !== null && brushEnd !== null) {
      const start = Math.min(brushStart, brushEnd);
      const end = Math.max(brushStart, brushEnd);
      onBrush(buckets[start].date, buckets[end].date);
    }
    setIsDragging(false);
  };

  const isBrushed = (index: number) => {
    if (brushStart === null || brushEnd === null) return false;
    const start = Math.min(brushStart, brushEnd);
    const end = Math.max(brushStart, brushEnd);
    return index >= start && index <= end;
  };

  return (
    <div
      className="flex h-full items-end gap-[3px] px-4 pb-8 pt-12 select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {buckets.map((bucket, index) => {
        const heightPct = (bucket.count / maxCount) * 100;
        const intensity = bucket.maxSeverity / 10;
        const brushed = isBrushed(index);

        return (
          <div
            key={bucket.date}
            className="group relative flex flex-1 flex-col items-center"
            style={{ height: "100%" }}
          >
            {/* Tooltip */}
            <div className="pointer-events-none absolute -top-1 left-1/2 z-40 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="border-4 border-black bg-white px-2 py-1 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_black] whitespace-nowrap">
                {formatDate(bucket.date)} — {bucket.count} EVENT{bucket.count > 1 ? "S" : ""}
              </div>
            </div>

            <div className="flex flex-1 items-end w-full">
              <div
                className={`w-full border-2 border-black transition-all cursor-crosshair ${
                  brushed ? "border-[#D22B2B]" : ""
                }`}
                style={{
                  height: `${Math.max(heightPct, 8)}%`,
                  backgroundColor: brushed
                    ? "#D22B2B"
                    : `rgba(0, 0, 0, ${0.15 + intensity * 0.85})`,
                }}
                onMouseDown={() => handleMouseDown(index)}
                onMouseMove={() => handleMouseMove(index)}
              />
            </div>
            <span className="mt-2 block text-center font-mono text-[9px] font-black uppercase leading-none -rotate-45 origin-top-left translate-x-2">
              {formatDate(bucket.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── MAIN TIMELINE COMPONENT ────────────────────────────────── */

export function TimelineWorkspace() {
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const setTimeRange = useInvestigationStore((state) => state.setTimeRange);
  const selectedSuspectId = useInvestigationStore(
    (state) => state.selectedSuspectId,
  );

  const [zoomLevel, setZoomLevel] = useState(1); // 0 = heatmap, 1–3 = detail zoom
  const [scrollX, setScrollX] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [brushActive, setBrushActive] = useState(false);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingBrush = useRef(false);

  // Suspect-linked timeline event IDs for highlighting
  const suspectLinkedEvents = useMemo(
    () =>
      selectedSuspectId
        ? new Set(suspectTimelineLinks[selectedSuspectId] ?? [])
        : null,
    [selectedSuspectId],
  );

  // Filter events by current time range
  const filteredEvents = useMemo(
    () =>
      EVENTS.filter((e) => e.date >= timeRange[0] && e.date <= timeRange[1]),
    [timeRange],
  );

  const layout = useMemo(
    () => computeCompressedLayout(filteredEvents),
    [filteredEvents],
  );

  const densityBuckets = useMemo(
    () => computeDensityBuckets(filteredEvents),
    [filteredEvents],
  );

  const scaledWidth = layout.totalWidth * zoomLevel;

  // Brush selection handling
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!brushActive || zoomLevel === 0) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + container.scrollLeft;
      setBrushStart(x);
      setBrushEnd(x);
      isDraggingBrush.current = true;
    },
    [brushActive, zoomLevel],
  );

  const handleTimelineMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDraggingBrush.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left + container.scrollLeft;
      setBrushEnd(x);
    },
    [],
  );

  const handleTimelineMouseUp = useCallback(() => {
    if (!isDraggingBrush.current || brushStart === null || brushEnd === null) {
      isDraggingBrush.current = false;
      return;
    }
    isDraggingBrush.current = false;

    const startX = Math.min(brushStart, brushEnd) / zoomLevel;
    const endX = Math.max(brushStart, brushEnd) / zoomLevel;

    // Find events within brush range
    const brushedEvents = filteredEvents.filter((event) => {
      const pos = layout.positions.get(event.id);
      return pos !== undefined && pos >= startX && pos <= endX;
    });

    if (brushedEvents.length >= 1) {
      const dates = brushedEvents.map((e) => e.date).sort();
      setTimeRange([dates[0], dates[dates.length - 1]]);
    }
  }, [brushStart, brushEnd, zoomLevel, filteredEvents, layout, setTimeRange]);

  const addAnnotation = useCallback(
    (type: AnnotationType, note: string) => {
      if (!selectedEvent) return;
      setAnnotations((prev) => [
        ...prev,
        {
          id: `ANN-${crypto.randomUUID().slice(0, 8)}`,
          eventId: selectedEvent.id,
          type,
          note,
        },
      ]);
    },
    [selectedEvent],
  );

  // Scroll sync
  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      setScrollX(scrollContainerRef.current.scrollLeft);
    }
  }, []);

  // Keyboard zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        setZoomLevel((z) => Math.min(z + 0.5, 3));
      } else if (e.key === "-") {
        setZoomLevel((z) => Math.max(z - 0.5, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isHeatmapMode = zoomLevel === 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#F4F4F0]">
      {/* ─── TOP TOOLBAR ──────────────────────────── */}
      <div className="shrink-0 border-b-4 border-black bg-[#F4F4F0]">
        <div className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-3">
          <h2 className="font-serif text-2xl font-black uppercase leading-none text-white md:text-3xl">
            Timeline Analysis
          </h2>
          <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase text-white">
            <span className="hidden md:inline">{filteredEvents.length} Events Loaded</span>
            <span className="inline-block h-2 w-2 animate-pulse bg-[#D22B2B]" />
            <span>LIVE</span>
          </div>
        </div>

        {/* Controls strip */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 font-mono text-xs font-black uppercase">
          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              FROM
              <input
                type="date"
                value={timeRange[0]}
                onChange={(e) => setTimeRange([e.target.value, timeRange[1]])}
                className="border-4 border-black bg-white px-2 py-1.5 shadow-[3px_3px_0_black] focus:outline-none"
              />
            </label>
            <span className="text-black/40">→</span>
            <label className="flex items-center gap-1">
              TO
              <input
                type="date"
                value={timeRange[1]}
                onChange={(e) => setTimeRange([timeRange[0], e.target.value])}
                className="border-4 border-black bg-white px-2 py-1.5 shadow-[3px_3px_0_black] focus:outline-none"
              />
            </label>
          </div>

          <div className="h-6 w-[4px] bg-black hidden md:block" />

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-black/60">ZOOM</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.5, 0))}
              className="flex h-8 w-8 items-center justify-center border-4 border-black bg-white shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <ZoomOut size={14} strokeWidth={3} />
            </button>
            <div className="flex h-8 w-28 items-center border-4 border-black bg-white px-1">
              <div className="relative h-1 w-full bg-black/20">
                <div
                  className="absolute left-0 top-0 h-full bg-black transition-all"
                  style={{ width: `${(zoomLevel / 3) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-2 -translate-y-1/2 border-2 border-black bg-[#D22B2B] transition-all"
                  style={{ left: `${(zoomLevel / 3) * 100}%`, marginLeft: "-4px" }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.5, 3))}
              className="flex h-8 w-8 items-center justify-center border-4 border-black bg-white shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <ZoomIn size={14} strokeWidth={3} />
            </button>
            <span className="ml-1 tabular-nums text-[10px]">
              {isHeatmapMode ? "HEATMAP" : `${zoomLevel.toFixed(1)}×`}
            </span>
          </div>

          <div className="h-6 w-[4px] bg-black hidden md:block" />

          {/* Brush toggle */}
          <button
            type="button"
            onClick={() => {
              setBrushActive((b) => !b);
              setBrushStart(null);
              setBrushEnd(null);
            }}
            className={`flex h-8 items-center gap-1.5 border-4 border-black px-3 shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
              brushActive
                ? "bg-[#D22B2B] text-white"
                : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              <rect x="2" y="2" width="10" height="10" strokeDasharray="3 2" />
            </svg>
            BRUSH {brushActive ? "ON" : "OFF"}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => {
              setTimeRange(["2026-07-18", "2026-07-28"]);
              setZoomLevel(1);
              setBrushStart(null);
              setBrushEnd(null);
            }}
            className="flex h-8 items-center gap-1 border-4 border-black bg-[#FCD34D] px-3 shadow-[3px_3px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            RESET
          </button>
        </div>

        {/* Category legend */}
        <div className="flex flex-wrap gap-2 border-t-2 border-black/20 px-4 py-2 font-mono text-[10px] font-black uppercase">
          {(Object.entries(CATEGORY_COLORS) as [EventCategory, string][]).map(
            ([category, color]) => (
              <span key={category} className="flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 border-2 border-black"
                  style={{ backgroundColor: color }}
                />
                {category}
              </span>
            ),
          )}
        </div>
      </div>

      {/* ─── MAIN TIMELINE AREA ───────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {isHeatmapMode ? (
          /* ─── DENSITY HEATMAP MODE ─────────────── */
          <div className="h-full border-4 border-black bg-white mx-4 my-4 shadow-[4px_4px_0_black]">
            <div className="border-b-4 border-black bg-[#F4F4F0] px-4 py-2 font-mono text-[10px] font-black uppercase">
              Activity Density Heatmap — {densityBuckets.length} Active Days
            </div>
            <DensityHeatmapView
              buckets={densityBuckets}
              onBrush={(start, end) => {
                setTimeRange([start, end]);
                setZoomLevel(1);
              }}
            />
          </div>
        ) : (
          /* ─── DETAIL TIMELINE MODE ─────────────── */
          <div
            ref={scrollContainerRef}
            className={`h-full overflow-x-auto overflow-y-hidden fatal-timeline-scroll ${
              brushActive ? "cursor-crosshair" : ""
            }`}
            onScroll={handleScroll}
            onMouseDown={handleTimelineMouseDown}
            onMouseMove={handleTimelineMouseMove}
            onMouseUp={handleTimelineMouseUp}
            onMouseLeave={handleTimelineMouseUp}
          >
            <div
              className="relative h-full"
              style={{ width: `${Math.max(scaledWidth, 900)}px`, minHeight: "100%" }}
            >
              {/* ─── AXIS LINE ──────────────────────── */}
              <div
                className="absolute border-t-4 border-black"
                style={{
                  top: "60%",
                  left: 0,
                  right: 0,
                }}
              />

              {/* ─── DATE SEGMENT LABELS ────────────── */}
              {layout.segments.map((seg) => (
                <div
                  key={seg.date}
                  className="absolute font-mono text-[10px] font-black uppercase"
                  style={{
                    left: `${seg.x * zoomLevel}px`,
                    top: "calc(60% + 12px)",
                  }}
                >
                  <div className="border-l-4 border-black pl-2 py-1">
                    <span className="bg-black px-1.5 py-0.5 text-white">
                      {formatDate(seg.date)}
                    </span>
                    {seg.eventCount > 1 && (
                      <span className="ml-1 bg-[#D22B2B] px-1 py-0.5 text-white text-[9px]">
                        ×{seg.eventCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* ─── GAP INDICATORS (zig-zag) ────── */}
              {layout.segments.map((seg, i) => {
                if (i >= layout.segments.length - 1) return null;
                const nextSeg = layout.segments[i + 1];
                const gapStart = (seg.x + seg.width) * zoomLevel;
                const gapEnd = nextSeg.x * zoomLevel;
                const gapDays = daysBetween(seg.date, nextSeg.date);

                if (gapDays <= 1) return null;

                return (
                  <div
                    key={`gap-${seg.date}`}
                    className="absolute flex items-center justify-center font-mono text-[9px] font-black text-black/40"
                    style={{
                      left: `${gapStart}px`,
                      width: `${gapEnd - gapStart}px`,
                      top: "calc(60% - 8px)",
                    }}
                  >
                    {/* Zig-zag line */}
                    <svg
                      width={Math.max(gapEnd - gapStart - 8, 10)}
                      height="16"
                      className="stroke-black/30"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="square"
                    >
                      <polyline
                        points={Array.from({ length: Math.ceil((gapEnd - gapStart) / 8) }, (_, k) =>
                          `${k * 8},${k % 2 === 0 ? 0 : 16}`,
                        ).join(" ")}
                      />
                    </svg>
                    <span className="absolute -bottom-4 whitespace-nowrap">
                      {gapDays}D GAP
                    </span>
                  </div>
                );
              })}

              {/* ─── EVENT NODES ─────────────────────── */}
              {filteredEvents.map((event) => {
                const x = layout.positions.get(event.id);
                if (x === undefined) return null;

                const eventAnnotations = annotations.filter(
                  (a) => a.eventId === event.id,
                );
                const isSelected = selectedEvent?.id === event.id;
                const isHovered = hoveredEvent === event.id;
                const isSuspectLinked =
                  suspectLinkedEvents !== null && suspectLinkedEvents.has(event.id);
                const isDimmed =
                  suspectLinkedEvents !== null && !suspectLinkedEvents.has(event.id);

                return (
                  <div key={event.id} className="absolute" style={{ left: `${x * zoomLevel}px`, top: 0, height: "100%" }}>
                    {/* Annotation callouts (pinned above node) */}
                    {eventAnnotations.map((ann, annIdx) => (
                      <AnnotationCallout
                        key={ann.id}
                        annotation={ann}
                        style={{
                          left: "-8px",
                          top: `calc(60% - ${88 + annIdx * 44}px)`,
                        }}
                      />
                    ))}

                    {/* Vertical connector stem */}
                    <div
                      className="absolute w-0 border-l-[3px] border-dashed border-black/40"
                      style={{
                        left: "12px",
                        top: "14%",
                        height: "46%",
                        opacity: isDimmed ? 0.2 : 1,
                      }}
                    />

                    {/* Event card (above axis) */}
                    <div
                      className={`absolute w-[140px] transition-all duration-200 ${
                        brushActive ? "pointer-events-none" : "cursor-pointer"
                      }`}
                      style={{
                        left: "-46px",
                        top: "calc(14% - 4px)",
                        transform: isHovered ? "translateY(-4px)" : "none",
                        opacity: isDimmed ? 0.25 : 1,
                        filter: isDimmed ? "grayscale(1)" : "none",
                      }}
                      onClick={() => {
                        if (!brushActive) setSelectedEvent(event);
                      }}
                      onMouseEnter={() => setHoveredEvent(event.id)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      <div
                        className={`border-4 p-2 font-mono text-[10px] font-black uppercase leading-tight transition-shadow ${
                          isSelected
                            ? "border-black bg-[#FCD34D] shadow-[6px_6px_0_black]"
                            : isSuspectLinked
                              ? "border-[#D22B2B] bg-[#D22B2B]/10 shadow-[6px_6px_0_#D22B2B]"
                              : "border-black bg-white shadow-[4px_4px_0_black] hover:shadow-[6px_6px_0_black]"
                        }`}
                      >
                        {/* Suspect-linked badge */}
                        {isSuspectLinked && (
                          <div className="absolute -left-2 -top-2 flex h-5 items-center gap-0.5 border-2 border-[#D22B2B] bg-[#D22B2B] px-1 text-[8px] text-white">
                            ● LINKED
                          </div>
                        )}
                        <div
                          className="mb-1 inline-block px-1 py-0.5 text-[9px] text-white"
                          style={{
                            backgroundColor: CATEGORY_COLORS[event.category],
                          }}
                        >
                          {event.category}
                        </div>
                        <p className="text-[10px]">{event.time}</p>
                        <p className="mt-1 normal-case leading-tight text-[10px]">
                          {event.title}
                        </p>
                        {/* Severity bar */}
                        <div className="mt-2 flex gap-[2px]">
                          {Array.from({ length: 10 }, (_, i) => (
                            <div
                              key={i}
                              className="h-[4px] flex-1"
                              style={{
                                backgroundColor:
                                  i < event.severity
                                    ? event.severity >= 8
                                      ? "#D22B2B"
                                      : event.severity >= 5
                                        ? "#D97706"
                                        : "#059669"
                                    : "#e5e5e5",
                              }}
                            />
                          ))}
                        </div>
                        {/* Annotation badge count */}
                        {eventAnnotations.length > 0 && (
                          <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border-2 border-black bg-[#D22B2B] text-[9px] text-white">
                            {eventAnnotations.length}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Node dot on axis */}
                    <div
                      className={`absolute h-5 w-5 border-4 transition-all ${
                        isSelected
                          ? "scale-125 border-black bg-[#FCD34D]"
                          : isSuspectLinked
                            ? "scale-125 border-[#D22B2B] bg-[#D22B2B]"
                            : "border-black bg-white"
                      }`}
                      style={{
                        left: "3px",
                        top: "calc(60% - 10px)",
                        backgroundColor: isSelected
                          ? "#FCD34D"
                          : isSuspectLinked
                            ? "#D22B2B"
                            : CATEGORY_COLORS[event.category],
                        opacity: isDimmed ? 0.2 : 1,
                      }}
                    />
                  </div>
                );
              })}

              {/* ─── BRUSH SELECTION OVERLAY ────────── */}
              {brushActive &&
                brushStart !== null &&
                brushEnd !== null &&
                isDraggingBrush.current && (
                  <div
                    className="absolute top-0 h-full border-x-4 border-[#D22B2B] bg-[#D22B2B]/10 pointer-events-none z-20"
                    style={{
                      left: `${Math.min(brushStart, brushEnd)}px`,
                      width: `${Math.abs(brushEnd - brushStart)}px`,
                    }}
                  />
                )}
            </div>
          </div>
        )}

        {/* ─── ANNOTATION PANEL (slides in from right) ── */}
        {selectedEvent && !isHeatmapMode && (
          <AnnotationPanel
            event={selectedEvent}
            annotations={annotations}
            onAdd={addAnnotation}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </div>

      {/* ─── STATUS BAR ───────────────────────────── */}
      <div className="shrink-0 border-t-4 border-black bg-black px-4 py-2 font-mono text-[10px] font-black uppercase text-[#F4F4F0]">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Range: {timeRange[0]} → {timeRange[1]}
          </span>
          <span className="text-[#D22B2B]">
            {filteredEvents.length} Events
          </span>
          <span>
            {annotations.length} Annotations
          </span>
          <span className="text-[#FCD34D]">
            Zoom: {isHeatmapMode ? "HEATMAP" : `${zoomLevel.toFixed(1)}×`}
          </span>
          {brushActive && (
            <span className="animate-pulse text-[#D22B2B]">
              ● BRUSH ACTIVE — DRAG TO SELECT
            </span>
          )}
          <span className="ml-auto text-white/40">
            FATAL//TIMELINE v2.0
          </span>
        </div>
      </div>
    </div>
  );
}
