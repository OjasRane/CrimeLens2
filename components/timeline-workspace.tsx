"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Eye,
  FileText,
  Files,
  MapPinned,
  Network,
  Radar,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BlindSpotTimelineWorkspace } from "@/components/blind-spot-timeline-workspace";
import { getInvestigation } from "@/data/investigations/registry";
import type {
  Investigation,
  InvestigationTimelineEvent,
  TimelineCategory,
} from "@/data/investigations/types";
import { useInvestigationStore } from "@/store/use-investigation-store";

/* ─── TYPES ─────────────────────────────────────────────────── */

type EventCategory = TimelineCategory;

type TimelineEvent = {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  category: EventCategory;
  title: string;
  description: string;
  severity: number;
  timePrecision?: InvestigationTimelineEvent["timePrecision"];
  confidence?: InvestigationTimelineEvent["confidence"];
  sourceRef?: string;
  timezone?: string;
  linkedEntityIds?: string[];
  linkedLocationIds?: string[];
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
    description:
      "Platform 9 camera captures victim at 21:14. Last confirmed sighting.",
    severity: 9,
  },
  {
    id: "TL-002",
    date: "2026-07-18",
    time: "21:32",
    timestamp: new Date("2026-07-18T21:32:00").getTime(),
    category: "CALL",
    title: "Anonymous tip received",
    description:
      "Switchboard logs anonymous call referencing Platform 9 disturbance.",
    severity: 6,
  },
  {
    id: "TL-003",
    date: "2026-07-18",
    time: "22:05",
    timestamp: new Date("2026-07-18T22:05:00").getTime(),
    category: "EVIDENCE",
    title: "Ticket stub recovered",
    description:
      "Torn ticket stub found in inner coat pocket during initial sweep.",
    severity: 7,
  },
  {
    id: "TL-004",
    date: "2026-07-19",
    time: "08:30",
    timestamp: new Date("2026-07-19T08:30:00").getTime(),
    category: "FORENSIC",
    title: "Ticket ledger mismatch",
    description:
      "Morning audit reveals ledger discrepancy — three entries lack counterfoils.",
    severity: 5,
  },
  {
    id: "TL-005",
    date: "2026-07-20",
    time: "01:15",
    timestamp: new Date("2026-07-20T01:15:00").getTime(),
    category: "CCTV",
    title: "Night clerk second visitor",
    description:
      "CCTV corroborates clerk testimony: unidentified visitor at 01:15.",
    severity: 8,
  },
  {
    id: "TL-006",
    date: "2026-07-20",
    time: "02:40",
    timestamp: new Date("2026-07-20T02:40:00").getTime(),
    category: "CALL",
    title: "Clerk reports break-in attempt",
    description:
      "Night clerk dials emergency line reporting forced entry at Annex B.",
    severity: 7,
  },
  {
    id: "TL-007",
    date: "2026-07-20",
    time: "06:10",
    timestamp: new Date("2026-07-20T06:10:00").getTime(),
    category: "ARREST",
    title: "Suspect A detained",
    description:
      "Individual matching description apprehended near loading dock.",
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
    description:
      "Latent print recovered from forced door handle. Partial match pending.",
    severity: 8,
  },
  {
    id: "TL-010",
    date: "2026-07-22",
    time: "09:00",
    timestamp: new Date("2026-07-22T09:00:00").getTime(),
    category: "ANALYSIS",
    title: "Cross-reference initiated",
    description:
      "Analyst begins cross-referencing ledger anomalies with CCTV timestamps.",
    severity: 4,
  },
  {
    id: "TL-011",
    date: "2026-07-24",
    time: "16:35",
    timestamp: new Date("2026-07-24T16:35:00").getTime(),
    category: "ARREST",
    title: "Suspect B identified",
    description:
      "Second suspect identified through partial print match. Warrant issued.",
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
    description:
      "Suspect B taken into custody at Canal Street Market without incident.",
    severity: 10,
  },
  {
    id: "TL-014",
    date: "2026-07-25",
    time: "10:00",
    timestamp: new Date("2026-07-25T10:00:00").getTime(),
    category: "FORENSIC",
    title: "Accelerant trace confirmed",
    description:
      "Lab confirms petroleum-based accelerant on loading dock samples.",
    severity: 6,
  },
  {
    id: "TL-015",
    date: "2026-07-25",
    time: "15:30",
    timestamp: new Date("2026-07-25T15:30:00").getTime(),
    category: "EVIDENCE",
    title: "Archive cage breach evidence",
    description:
      "Cut lock recovered; tool marks consistent with compact bolt cutter.",
    severity: 7,
  },
  {
    id: "TL-016",
    date: "2026-07-26",
    time: "08:15",
    timestamp: new Date("2026-07-26T08:15:00").getTime(),
    category: "ANALYSIS",
    title: "Pattern link established",
    description:
      "Analyst connects three incidents to single MO. Crime spree hypothesis elevated.",
    severity: 8,
  },
  {
    id: "TL-017",
    date: "2026-07-27",
    time: "12:00",
    timestamp: new Date("2026-07-27T12:00:00").getTime(),
    category: "FORENSIC",
    title: "DNA sample submitted",
    description:
      "Biological sample from ticket stub sent for expedited DNA analysis.",
    severity: 7,
  },
  {
    id: "TL-018",
    date: "2026-07-28",
    time: "09:30",
    timestamp: new Date("2026-07-28T09:30:00").getTime(),
    category: "ANALYSIS",
    title: "Cross-case link promoted",
    description:
      "Three-case connection promoted from hypothesis to active lead.",
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
  LANDING: "#FCD34D",
  ATTACK: "#D22B2B",
  MOVEMENT: "#6366F1",
  POLICE: "#111111",
  RESPONSE: "#111111",
  SECONDARY: "#D97706",
  CLEARANCE: "#059669",
};

const CATEGORY_DARK_STYLES: Record<
  EventCategory,
  {
    cardHover: string;
    label: string;
    markerBorder: string;
    markerActive: string;
    strip: string;
  }
> = {
  CALL: {
    cardHover: "hover:dark:border-[#FF4D55] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FF4D55] dark:text-[#FF4D55]",
    markerBorder: "dark:border-[#FF4D55]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FF4D55]",
  },
  ARREST: {
    cardHover: "hover:dark:border-[#C5CBD0] hover:dark:bg-[#12242C]",
    label: "dark:border-[#C5CBD0] dark:text-[#C5CBD0]",
    markerBorder: "dark:border-[#C5CBD0]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#C5CBD0]",
  },
  EVIDENCE: {
    cardHover: "hover:dark:border-[#FFD45A] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FFD45A] dark:text-[#FFD45A]",
    markerBorder: "dark:border-[#FFD45A]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FFD45A]",
  },
  CCTV: {
    cardHover: "hover:dark:border-[#7C83FF] hover:dark:bg-[#12242C]",
    label: "dark:border-[#7C83FF] dark:text-[#7C83FF]",
    markerBorder: "dark:border-[#7C83FF]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#7C83FF]",
  },
  FORENSIC: {
    cardHover: "hover:dark:border-[#32D6A0] hover:dark:bg-[#12242C]",
    label: "dark:border-[#32D6A0] dark:text-[#32D6A0]",
    markerBorder: "dark:border-[#32D6A0]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#32D6A0]",
  },
  ANALYSIS: {
    cardHover: "hover:dark:border-[#FF9F43] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FF9F43] dark:text-[#FF9F43]",
    markerBorder: "dark:border-[#FF9F43]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FF9F43]",
  },
  LANDING: {
    cardHover: "hover:dark:border-[#FFD45A] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FFD45A] dark:text-[#FFD45A]",
    markerBorder: "dark:border-[#FFD45A]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FFD45A]",
  },
  ATTACK: {
    cardHover: "hover:dark:border-[#FF4D55] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FF4D55] dark:text-[#FF4D55]",
    markerBorder: "dark:border-[#FF4D55]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FF4D55]",
  },
  MOVEMENT: {
    cardHover: "hover:dark:border-[#7C83FF] hover:dark:bg-[#12242C]",
    label: "dark:border-[#7C83FF] dark:text-[#7C83FF]",
    markerBorder: "dark:border-[#7C83FF]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#7C83FF]",
  },
  POLICE: {
    cardHover: "hover:dark:border-[#C5CBD0] hover:dark:bg-[#12242C]",
    label: "dark:border-[#C5CBD0] dark:text-[#C5CBD0]",
    markerBorder: "dark:border-[#C5CBD0]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#C5CBD0]",
  },
  RESPONSE: {
    cardHover: "hover:dark:border-[#C5CBD0] hover:dark:bg-[#12242C]",
    label: "dark:border-[#C5CBD0] dark:text-[#C5CBD0]",
    markerBorder: "dark:border-[#C5CBD0]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#C5CBD0]",
  },
  SECONDARY: {
    cardHover: "hover:dark:border-[#FF9F43] hover:dark:bg-[#12242C]",
    label: "dark:border-[#FF9F43] dark:text-[#FF9F43]",
    markerBorder: "dark:border-[#FF9F43]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#FF9F43]",
  },
  CLEARANCE: {
    cardHover: "hover:dark:border-[#32D6A0] hover:dark:bg-[#12242C]",
    label: "dark:border-[#32D6A0] dark:text-[#32D6A0]",
    markerBorder: "dark:border-[#32D6A0]",
    markerActive: "scale-110",
    strip: "dark:!bg-[#32D6A0]",
  },
};

const ANNOTATION_ICONS: Record<
  AnnotationType,
  { icon: typeof Camera; label: string; emoji: string }
> = {
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
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const msDay = 86400000;
  return Math.abs(
    (new Date(b + "T00:00:00").getTime() -
      new Date(a + "T00:00:00").getTime()) /
      msDay,
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

function computeCompressedLayout(
  events: TimelineEvent[],
  options: {
    baseDayWidth?: number;
    denseBonus?: number;
    eventNodeSpacing?: number;
    outerPadding?: number;
  } = {},
): CompressedLayout {
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

  const BASE_DAY_WIDTH = options.baseDayWidth ?? 120;
  const DENSE_BONUS = options.denseBonus ?? 40; // extra width per event in a cluster
  const MIN_GAP_WIDTH = 32;
  const MAX_GAP_WIDTH = 60;
  const EVENT_NODE_SPACING = options.eventNodeSpacing ?? 56;
  const OUTER_PADDING = options.outerPadding ?? 60;

  let cursor = OUTER_PADDING;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    const group = dateGroups.get(date)!;

    // Calculate segment width based on event density
    const segmentWidth = BASE_DAY_WIDTH + (group.length - 1) * DENSE_BONUS;

    const segStart = cursor;

    // Position each event within the segment
    for (let j = 0; j < group.length; j++) {
      const eventX = segStart + j * EVENT_NODE_SPACING;
      positions.set(group[j].id, eventX);
    }

    segments.push({
      date,
      x: segStart,
      width: Math.max(segmentWidth, group.length * EVENT_NODE_SPACING),
      eventCount: group.length,
    });

    cursor =
      segStart + Math.max(segmentWidth, group.length * EVENT_NODE_SPACING);

    // Add compressed gap to next date
    if (i < dates.length - 1) {
      const gap = daysBetween(date, dates[i + 1]);
      // Logarithmic compression for gaps
      const gapWidth =
        gap <= 1
          ? MIN_GAP_WIDTH
          : Math.min(MAX_GAP_WIDTH, MIN_GAP_WIDTH + Math.log2(gap) * 14);
      cursor += gapWidth;
    }
  }

  cursor += OUTER_PADDING;

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
  className = "",
}: {
  event: TimelineEvent;
  annotations: Annotation[];
  onAdd: (type: AnnotationType, note: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [selectedType, setSelectedType] = useState<AnnotationType>("cctv");
  const [noteText, setNoteText] = useState("");
  const eventAnnotations = annotations.filter((a) => a.eventId === event.id);

  return (
    <div className={`fatal-timeline-annotation absolute inset-0 z-50 h-full w-full overflow-y-auto border-l-4 border-black bg-[#F4F4F0] font-mono text-xs font-black uppercase shadow-[-6px_0_0_black] sm:left-auto sm:w-[380px] dark:border-[#D8D3C7] dark:bg-[#081318] dark:text-[#F2EFE7] dark:shadow-[-7px_0_0_#010506] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-black bg-black px-4 py-3 text-white dark:border-[#426D79] dark:bg-[#08242D] dark:text-[#F4F1DC]">
        <span>Annotate Event</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-none border-2 border-white hover:bg-white hover:text-black sm:h-7 sm:w-7 dark:border-[#FF4D55] dark:text-[#FF4D55] dark:hover:bg-[#FF4D55] dark:hover:text-[#031820]"
        >
          <X size={14} strokeWidth={3} />
        </button>
      </div>

      {/* Event Info */}
      <div className="border-b-4 border-black p-4 dark:border-[#426D79]">
        <div
          className={`mb-2 inline-block rounded-none px-2 py-1 text-white dark:border dark:bg-[#031820] ${CATEGORY_DARK_STYLES[event.category].label}`}
          style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
        >
          {event.category}
        </div>
        <p className="text-sm">
          {event.id} — {event.date} {event.time}
        </p>
        <p className="mt-2 normal-case leading-tight">{event.title}</p>
      </div>

      {/* Add Annotation */}
      <div className="border-b-4 border-black p-4 dark:border-[#426D79]">
        <p className="mb-3">Add Intelligence Note</p>
        <div className="flex gap-2 mb-3">
          {(
            Object.entries(ANNOTATION_ICONS) as [
              AnnotationType,
              (typeof ANNOTATION_ICONS)[AnnotationType],
            ][]
          ).map(([type, config]) => (
            <button
              key={type}
              type="button"
              onClick={() => setSelectedType(type)}
              className={`flex h-10 flex-1 items-center justify-center gap-1 rounded-none border-4 border-black shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border dark:border-[#426D79] dark:shadow-[4px_4px_0_#011015] ${
                selectedType === type
                  ? "bg-black text-white dark:border-[#32D6A0] dark:bg-[#08242D] dark:text-[#32D6A0]"
                  : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5 dark:bg-[#144453] dark:text-[#F4F1DC]"
              }`}
            >
              <span className="text-base not-italic">{config.emoji}</span>
            </button>
          ))}
        </div>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter annotation note..."
          className="mb-3 block w-full resize-none rounded-none border-4 border-black bg-white p-3 normal-case placeholder:uppercase placeholder:text-black/30 focus:outline-none dark:border dark:border-[#426D79] dark:bg-[#144453] dark:text-[#F4F1DC] dark:placeholder:text-[#6F8F96]"
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
          className="w-full rounded-none border-4 border-black bg-[#FCD34D] py-2 shadow-[4px_4px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:shadow-none dark:border dark:border-[#32D6A0] dark:bg-[#08242D] dark:text-[#32D6A0] dark:shadow-[4px_4px_0_#011015]"
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
                  className="rounded-none border-4 border-black bg-white p-3 shadow-[3px_3px_0_black] dark:border dark:border-[#426D79] dark:bg-[#144453] dark:text-[#F4F1DC] dark:shadow-[4px_4px_0_#011015]"
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
    <div className="absolute z-30 pointer-events-none" style={style}>
      {/* Callout box */}
      <div className="pointer-events-auto relative whitespace-nowrap rounded-none border-4 border-black bg-white px-2 py-1.5 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_black] dark:border dark:border-[#426D79] dark:bg-[#144453] dark:text-[#F4F1DC] dark:shadow-[4px_4px_0_#011015]">
        <span className="mr-1 text-sm not-italic">{config.emoji}</span>
        <span className="max-w-[120px] overflow-hidden text-ellipsis inline-block align-middle">
          {annotation.note.length > 18
            ? annotation.note.slice(0, 18) + "…"
            : annotation.note}
        </span>
        {/* Arrow pointing down */}
        <div className="absolute -bottom-[10px] left-4 h-0 w-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-black dark:border-t-[#426D79]" />
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
      className="flex h-full touch-none select-none items-end gap-[3px] px-4 pb-8 pt-12"
      onPointerUp={handleMouseUp}
      onPointerCancel={handleMouseUp}
      onPointerLeave={handleMouseUp}
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
              <div className="border-4 border-black bg-white px-2 py-1 font-mono text-[10px] font-black uppercase shadow-[3px_3px_0_black] whitespace-nowrap dark:border dark:border-[#426D79] dark:bg-[#144453] dark:text-[#F4F1DC] dark:shadow-[4px_4px_0_#011015]">
                {formatDate(bucket.date)} — {bucket.count} EVENT
                {bucket.count > 1 ? "S" : ""}
              </div>
            </div>

            <div className="flex flex-1 items-end w-full">
              <div
                className={`fatal-density-bar w-full border-2 border-black transition-all cursor-crosshair dark:border-[#34515A] ${
                  brushed
                    ? "border-[#D22B2B] dark:!border-[#FF4D55] dark:!bg-[#FF4D55]"
                    : "dark:!bg-[#144453]"
                }`}
                data-brushed={brushed}
                style={{
                  height: `${Math.max(heightPct, 8)}%`,
                  backgroundColor: brushed
                    ? "#D22B2B"
                    : `rgba(0, 0, 0, ${0.15 + intensity * 0.85})`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleMouseDown(index);
                }}
                onPointerMove={() => handleMouseMove(index)}
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

function formatInspectorDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${date}T00:00:00Z`))
    .toUpperCase();
}

function EventInspector({
  event,
  investigation,
  onClear,
  onAnnotate,
}: {
  event: TimelineEvent;
  investigation: Investigation;
  onClear: () => void;
  onAnnotate: () => void;
}) {
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const setSelectedEntityId = useInvestigationStore(
    (state) => state.setSelectedEntityId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );
  const requestMapPan = useInvestigationStore((state) => state.requestMapPan);
  const openLedger = useInvestigationStore((state) => state.openLedger);

  const linkedLocations = investigation.map.locations.filter((location) =>
    event.linkedLocationIds?.includes(location.id),
  );
  const linkedRoutes = investigation.map.routes.filter(
    (route) =>
      route.locationIds.some((id) => event.linkedLocationIds?.includes(id)) ||
      route.memberEntityIds.some((id) => event.linkedEntityIds?.includes(id)),
  );
  const linkedFacts = investigation.facts.filter((fact) =>
    fact.linkedTimelineEventIds.includes(event.id),
  );
  const primaryLocation = linkedLocations[0];
  const networkTarget =
    event.linkedEntityIds?.[0] ??
    primaryLocation?.graphNodeId ??
    primaryLocation?.id;
  const sourceLabel =
    linkedFacts[0]?.sourceTitle ??
    (event.sourceRef ? new URL(event.sourceRef).hostname : investigation.badge);

  return (
    <motion.aside
      aria-label={`Event inspector for ${event.title}`}
      className="fatal-event-inspector absolute inset-x-2 bottom-2 z-40 max-h-[58dvh] overflow-y-auto border-2 border-[#D8D3C7] bg-[#0D1A20] text-[#F2EFE7] shadow-[7px_7px_0_#010506] sm:inset-x-4 sm:bottom-3"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="flex items-center justify-between border-b border-[#34515A] bg-[#050B0E] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#AFAFA7]">
        <span>
          Event // <span className="text-[#F2EFE7]">{event.id}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 border border-[#D8D3C7] bg-[#0D1A20] px-2 py-1 text-[9px] text-[#F2EFE7] transition-colors duration-150 hover:bg-[#F2EFE7] hover:text-[#050B0E]"
        >
          <X aria-hidden="true" className="size-3" strokeWidth={3} />
          Clear Focus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,1fr)]">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono font-black uppercase">
            <span className="text-base tabular-nums text-[#F2EFE7]">
              {event.time}
            </span>
            <span
              className={`border bg-[#050B0E] px-1.5 py-0.5 text-[9px] ${CATEGORY_DARK_STYLES[event.category].label}`}
            >
              {event.category}
            </span>
            <span className="border border-[#34515A] px-1.5 py-0.5 text-[9px] text-[#AFAFA7]">
              {event.timePrecision ?? "EXACT"}
            </span>
          </div>
          <h3 className="truncate font-mono text-sm font-black uppercase tracking-[0.02em] text-[#F2EFE7]">
            {event.title}
          </h3>
          <p className="mt-1 line-clamp-2 font-mono text-[10px] font-bold leading-relaxed text-[#AFAFA7]">
            {event.description}
          </p>
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-2">
          <dl className="grid grid-cols-2 gap-3 font-mono text-[9px] uppercase sm:grid-cols-4">
            <div className="min-w-0 border-l border-[#34515A] pl-2">
              <dt className="text-[#70878D]">Location</dt>
              <dd className="mt-0.5 truncate font-black text-[#F2EFE7]">
                {linkedLocations.map((location) => location.title).join(" / ") ||
                  "—"}
              </dd>
            </div>
            <div className="min-w-0 border-l border-[#34515A] pl-2">
              <dt className="text-[#70878D]">Date</dt>
              <dd className="mt-0.5 truncate font-black text-[#F2EFE7]">
                {formatInspectorDate(event.date)}
              </dd>
            </div>
            <div className="min-w-0 border-l border-[#34515A] pl-2">
              <dt className="text-[#70878D]">Related Team</dt>
              <dd className="mt-0.5 truncate font-black text-[#F2EFE7]">
                {Array.from(new Set(linkedRoutes.map((route) => route.label))).join(
                  " / ",
                ) || "—"}
              </dd>
            </div>
            <div className="min-w-0 border-l border-[#34515A] pl-2">
              <dt className="text-[#70878D]">Source</dt>
              <dd className="mt-0.5 truncate font-black text-[#F2EFE7]">
                {sourceLabel}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap justify-start gap-2 font-mono text-[9px] font-black uppercase lg:justify-end">
            {primaryLocation ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedLocationId(primaryLocation.id);
                  if (primaryLocation.coordinates) {
                    requestMapPan(primaryLocation.coordinates, primaryLocation.id);
                  }
                  setActiveWorkspace("map");
                }}
                className="fatal-inspector-action"
              >
                <MapPinned aria-hidden="true" className="size-3" />
                View on Map
              </button>
            ) : null}
            {networkTarget ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedEntityId(networkTarget);
                  setActiveWorkspace("network");
                }}
                className="fatal-inspector-action"
              >
                <Network aria-hidden="true" className="size-3" />
                View Network
              </button>
            ) : null}
            {linkedFacts.length > 0 ? (
              <button
                type="button"
                onClick={openLedger}
                className="fatal-inspector-action"
              >
                <Files aria-hidden="true" className="size-3" />
                Related Evidence ({linkedFacts.length})
              </button>
            ) : null}
            <button
              type="button"
              onClick={onAnnotate}
              className="fatal-inspector-action"
            >
              <FileText aria-hidden="true" className="size-3" />
              Add Note
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/* ─── MAIN TIMELINE COMPONENT ────────────────────────────────── */

export function TimelineWorkspace() {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const timeRange = useInvestigationStore((state) => state.timeRange);
  const setTimeRange = useInvestigationStore((state) => state.setTimeRange);
  const selectedEntityId = useInvestigationStore(
    (state) => state.selectedEntityId,
  );
  const selectedTimelineEventId = useInvestigationStore(
    (state) => state.selectedTimelineEventId,
  );
  const setSelectedTimelineEventId = useInvestigationStore(
    (state) => state.setSelectedTimelineEventId,
  );

  const [zoomLevel, setZoomLevel] = useState(1); // 0 = heatmap, 1–3 = detail zoom
  const [scrollX, setScrollX] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(
    null,
  );
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [brushActive, setBrushActive] = useState(false);
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] =
    useState<EventCategory | null>(null);
  const [showDarkAnnotationPanel, setShowDarkAnnotationPanel] = useState(false);
  const [showBlindSpotDetector, setShowBlindSpotDetector] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingBrush = useRef(false);

  useEffect(() => {
    setZoomLevel(1);
    setSelectedEvent(null);
    setAnnotations([]);
    setBrushActive(false);
    setBrushStart(null);
    setBrushEnd(null);
    setHoveredCategory(null);
    setShowDarkAnnotationPanel(false);
    setShowBlindSpotDetector(false);
  }, [activeInvestigationId]);

  const investigationEvents = useMemo<TimelineEvent[]>(
    () =>
      activeInvestigation.timeline.events.map((event) => ({
        id: event.id,
        date: event.date,
        time: event.time,
        timestamp:
          new Date(`${event.date}T00:00:00+05:30`).getTime() + event.sortOrder,
        category: event.category,
        title: event.title,
        description: event.description,
        severity: event.severity,
        timePrecision: event.timePrecision,
        confidence: event.confidence,
        sourceRef: event.sourceRef,
        timezone: event.timezone,
        linkedEntityIds: event.linkedEntityIds,
        linkedLocationIds: event.linkedLocationIds,
      })),
    [activeInvestigation],
  );

  const timelineEvents =
    activeInvestigationId === "demo" ? EVENTS : investigationEvents;

  useEffect(() => {
    if (!selectedTimelineEventId) {
      setSelectedEvent(null);
      return;
    }

    setSelectedEvent(
      timelineEvents.find((event) => event.id === selectedTimelineEventId) ??
        null,
    );
  }, [selectedTimelineEventId, timelineEvents]);

  // Entity-linked timeline event IDs for highlighting
  const suspectLinkedEvents = useMemo(
    () => {
      if (!selectedEntityId) return null;
      if (activeInvestigationId === "demo") {
        return new Set(suspectTimelineLinks[selectedEntityId] ?? []);
      }
      return new Set(
        investigationEvents
          .filter(
            (event) =>
              event.linkedEntityIds?.includes(selectedEntityId) ||
              event.linkedLocationIds?.includes(selectedEntityId),
          )
          .map((event) => event.id),
      );
    }, [activeInvestigationId, investigationEvents, selectedEntityId],
  );

  // Filter events by current time range
  const filteredEvents = useMemo(
    () =>
      timelineEvents.filter(
        (event) => event.date >= timeRange[0] && event.date <= timeRange[1],
      ),
    [timeRange, timelineEvents],
  );

  const layout = useMemo(() => {
    if (!isDarkMode) return computeCompressedLayout(filteredEvents);

    return computeCompressedLayout(filteredEvents, {
      baseDayWidth: 184,
      denseBonus: 148,
      eventNodeSpacing: 178,
      outerPadding: 96,
    });
  }, [filteredEvents, isDarkMode]);

  const densityBuckets = useMemo(
    () => computeDensityBuckets(filteredEvents),
    [filteredEvents],
  );
  const visibleCategories = useMemo(
    () => new Set(timelineEvents.map((event) => event.category)),
    [timelineEvents],
  );
  const focusedDate = selectedEvent?.date ?? null;
  const hoveredDate = hoveredEvent
    ? filteredEvents.find((event) => event.id === hoveredEvent)?.date ?? null
    : null;

  const scaledWidth = layout.totalWidth * zoomLevel;

  // Brush selection handling
  const handleTimelineMouseDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!brushActive || zoomLevel === 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
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
    (e: React.PointerEvent<HTMLDivElement>) => {
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

  if (showBlindSpotDetector) {
    return (
      <div className="relative h-full min-h-0">
        <BlindSpotTimelineWorkspace />
        <button
          type="button"
          onClick={() => setShowBlindSpotDetector(false)}
          className="absolute right-16 top-3 z-30 flex h-9 items-center gap-2 border-2 border-white bg-black px-3 font-mono text-[10px] font-black uppercase text-white shadow-[3px_3px_0_#EF4444] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none sm:right-20 dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9]"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={3} />
          <span className="hidden sm:inline">Back to Timeline</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fatal-timeline-root relative flex h-full flex-col overflow-hidden bg-[#F4F4F0] dark:bg-[#050B0E] ${
        isDarkMode && selectedEvent ? "fatal-timeline-focused" : ""
      }`}
    >
      {/* ─── TOP TOOLBAR ──────────────────────────── */}
      <div className="fatal-timeline-toolbar shrink-0 border-b-4 border-black bg-[#F4F4F0] dark:border-b dark:border-[#34515A] dark:bg-[#0D1A20]">
        <div className="fatal-timeline-commandbar flex items-center justify-between gap-2 border-b-4 border-black bg-black px-3 py-2 sm:px-4 sm:py-3 dark:border-b dark:border-[#34515A] dark:bg-[#050B0E]">
          <h2 className="fatal-timeline-title truncate font-serif text-lg font-black uppercase leading-none text-white sm:text-2xl md:text-3xl dark:text-[#F2EFE7]">
            Timeline Analysis
          </h2>
          <div className="flex items-center gap-2 font-mono text-[10px] font-black uppercase text-white dark:text-[#F2EFE7]">
            <button
              type="button"
              onClick={() => setShowBlindSpotDetector(true)}
              disabled={activeInvestigationId === "mumbai-2611"}
              className="fatal-historical-badge mr-1 flex h-8 items-center gap-1.5 border-2 border-[#EF4444] bg-[#EF4444] px-2.5 text-[9px] font-black uppercase tracking-[0.08em] text-white transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 dark:border-[#D8D3C7] dark:bg-[#0D1A20] dark:text-[#F2EFE7]"
            >
              <Radar aria-hidden="true" className="size-3.5" strokeWidth={3} />
              <span className="hidden sm:inline">
                {activeInvestigationId === "mumbai-2611"
                  ? "Historical Record"
                  : "Blind-Spot Detector"}
              </span>
              <span className="sm:hidden">
                {activeInvestigationId === "mumbai-2611" ? "Record" : "Blind Spots"}
              </span>
            </button>
            <span className="fatal-events-loaded hidden md:inline dark:text-[#AFAFA7]">
              {filteredEvents.length} Events Loaded
            </span>
            <span className="inline-block h-2 w-2 bg-[#D22B2B] dark:h-2 dark:w-2 dark:rounded-none dark:bg-[#FF4D55] dark:shadow-none" />
            <span className="dark:text-[#AFAFA7]">LIVE</span>
          </div>
        </div>

        {/* Controls strip */}
        <div className="fatal-timeline-controls hide-scrollbar flex items-center gap-3 overflow-x-auto px-3 py-2 font-mono text-xs font-black uppercase sm:flex-wrap sm:px-4 sm:py-3 dark:text-[#F2EFE7]">
          {/* Date range */}
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-1">
              FROM
              <input
                type="date"
                value={timeRange[0]}
                onChange={(e) => setTimeRange([e.target.value, timeRange[1]])}
                className="fatal-timeline-control w-[8.8rem] border-4 border-black bg-white px-2 py-1.5 shadow-[3px_3px_0_black] focus:outline-none dark:border dark:border-[#D8D3C7] dark:bg-[#081318] dark:text-[#F2EFE7] dark:shadow-none"
              />
            </label>
            <span className="text-black/40 dark:text-[#6F8F96]">→</span>
            <label className="flex items-center gap-1">
              TO
              <input
                type="date"
                value={timeRange[1]}
                onChange={(e) => setTimeRange([timeRange[0], e.target.value])}
                className="fatal-timeline-control w-[8.8rem] border-4 border-black bg-white px-2 py-1.5 shadow-[3px_3px_0_black] focus:outline-none dark:border dark:border-[#D8D3C7] dark:bg-[#081318] dark:text-[#F2EFE7] dark:shadow-none"
              />
            </label>
          </div>

          <div className="h-6 w-[4px] bg-black hidden md:block dark:w-px dark:bg-[#34515A]" />

          {/* Zoom controls */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-black/60 dark:text-[#6F8F96]">
              ZOOM
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 0.5, 0))}
              className="fatal-timeline-control flex h-8 w-8 items-center justify-center border-4 border-black bg-white shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border dark:border-[#D8D3C7] dark:bg-[#081318] dark:shadow-none"
            >
              <ZoomOut size={14} strokeWidth={3} />
            </button>
            <div className="fatal-timeline-control flex h-8 w-28 items-center border-4 border-black bg-white px-1 dark:border dark:border-[#D8D3C7] dark:bg-[#081318]">
              <div className="relative h-1 w-full bg-black/20 dark:bg-[#426D79]/30">
                <div
                  className="absolute left-0 top-0 h-full bg-black transition-all dark:bg-[#426D79]"
                  style={{ width: `${(zoomLevel / 3) * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-4 w-2 -translate-y-1/2 border-2 border-black bg-[#D22B2B] transition-all dark:border-[#32D6A0] dark:bg-[#32D6A0]"
                  style={{
                    left: `${(zoomLevel / 3) * 100}%`,
                    marginLeft: "-4px",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 0.5, 3))}
              className="fatal-timeline-control flex h-8 w-8 items-center justify-center border-4 border-black bg-white shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border dark:border-[#D8D3C7] dark:bg-[#081318] dark:shadow-none"
            >
              <ZoomIn size={14} strokeWidth={3} />
            </button>
            <span className="fatal-zoom-readout ml-1 tabular-nums text-[10px] dark:border dark:border-[#34515A] dark:bg-[#050B0E] dark:px-1.5 dark:py-1 dark:text-[#F2EFE7]">
              {isHeatmapMode ? "HEATMAP" : `${zoomLevel.toFixed(1)}×`}
            </span>
          </div>

          <div className="h-6 w-[4px] bg-black hidden md:block dark:w-px dark:bg-[#34515A]" />

          {/* Brush toggle */}
          <button
            type="button"
            onClick={() => {
              setBrushActive((b) => !b);
              setBrushStart(null);
              setBrushEnd(null);
            }}
            className={`flex h-8 items-center gap-1.5 border-4 border-black px-3 shadow-[3px_3px_0_black] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none dark:border-[1px] dark:shadow-none ${
              brushActive
                ? "bg-[#D22B2B] text-white dark:border-[#F2EFE7] dark:bg-[#F2EFE7] dark:text-[#050B0E]"
                : "bg-white hover:-translate-x-0.5 hover:-translate-y-0.5 dark:border-[#D8D3C7] dark:bg-[#081318] dark:text-[#F2EFE7] hover:dark:bg-[#12242C]"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            >
              <rect x="2" y="2" width="10" height="10" strokeDasharray="3 2" />
            </svg>
            BRUSH {brushActive ? "ON" : "OFF"}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => {
              setTimeRange([
                activeInvestigation.timeline.startDate,
                activeInvestigation.timeline.endDate,
              ]);
              setZoomLevel(1);
              setBrushStart(null);
              setBrushEnd(null);
            }}
            className="fatal-reset-control flex h-8 items-center gap-1 border-4 border-black bg-[#FCD34D] px-3 shadow-[3px_3px_0_black] active:translate-x-1 active:translate-y-1 active:shadow-none dark:border dark:border-[#FFD45A] dark:bg-[#0D1A20] dark:text-[#FFD45A] dark:shadow-none hover:dark:bg-[#FFD45A] hover:dark:text-[#050B0E]"
          >
            RESET
          </button>
        </div>

        {/* Category legend */}
        <div className="fatal-timeline-legend hide-scrollbar flex gap-2 overflow-x-auto whitespace-nowrap border-t-2 border-black/20 px-3 py-2 font-mono text-[10px] font-black uppercase sm:flex-wrap sm:px-4 dark:border-[#34515A] dark:text-[#AFAFA7]">
          {(Object.entries(CATEGORY_COLORS) as [EventCategory, string][]).map(
            ([category, color]) =>
              visibleCategories.has(category) ? (
              <span
                key={category}
                className="fatal-timeline-legend-item flex items-center gap-1"
                data-active={hoveredCategory === category}
                onMouseEnter={() => setHoveredCategory(category)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <span
                  className={`inline-block h-3 w-3 border-2 border-black dark:border-[1px] dark:border-[#426D79] ${CATEGORY_DARK_STYLES[category].strip}`}
                  style={{ backgroundColor: color }}
                />
                {category}
              </span>
              ) : null,
          )}
        </div>
      </div>

      {/* ─── MAIN TIMELINE AREA ───────────────────── */}
      <div className="fatal-timeline-main relative flex-1 overflow-hidden">
        {isHeatmapMode ? (
          /* ─── DENSITY HEATMAP MODE ─────────────── */
          <div className="fatal-timeline-heatmap m-1 h-[calc(100%-0.5rem)] border-4 border-black bg-white shadow-[4px_4px_0_black] sm:m-4 sm:h-[calc(100%-2rem)] dark:border dark:border-[#34515A] dark:bg-[#0D1A20] dark:shadow-[6px_6px_0_#010506]">
            <div className="border-b-4 border-black bg-[#F4F4F0] px-4 py-2 font-mono text-[10px] font-black uppercase dark:border-[#426D79] dark:bg-[#08242D] dark:text-[#F4F1DC]">
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
            className={`fatal-timeline-scroll h-full overflow-x-auto overflow-y-hidden ${
              brushActive ? "touch-none cursor-crosshair" : "touch-pan-x"
            }`}
            onScroll={handleScroll}
            onPointerDown={handleTimelineMouseDown}
            onPointerMove={handleTimelineMouseMove}
            onPointerUp={handleTimelineMouseUp}
            onPointerCancel={handleTimelineMouseUp}
            onPointerLeave={handleTimelineMouseUp}
          >
            <div
              className="fatal-timeline-stage relative h-full"
              style={{
                width: `${Math.max(scaledWidth, 900)}px`,
                minHeight: "100%",
              }}
            >
              {/* ─── AXIS LINE ──────────────────────── */}
              <div
                className="fatal-timeline-axis absolute border-t-4 border-black dark:h-[2px] dark:border-0 dark:bg-[#D8D3C7]"
                style={{
                  top: "var(--fatal-axis-y)",
                  left: 0,
                  right: 0,
                }}
              />

              {/* ─── DATE SEGMENT LABELS ────────────── */}
              {layout.segments.map((seg) => (
                <div
                  key={seg.date}
                  className="fatal-timeline-date absolute font-mono text-[10px] font-black uppercase"
                  data-active={focusedDate === seg.date || hoveredDate === seg.date}
                  style={{
                    left: `${seg.x * zoomLevel}px`,
                    top: "calc(var(--fatal-axis-y) + 12px)",
                  }}
                >
                  <div className="border-l-4 border-black pl-2 py-1 dark:border-l-2 dark:border-[#34515A]">
                    <span className="fatal-timeline-date-label bg-black px-1.5 py-0.5 text-white dark:border dark:border-[#34515A] dark:bg-[#050B0E] dark:text-[#D8D3C7]">
                      {formatDate(seg.date)}
                    </span>
                    {seg.eventCount > 1 && (
                      <span className="ml-1 bg-[#D22B2B] px-1 py-0.5 text-white text-[9px] dark:bg-[#FF4D55] dark:text-[#031820]">
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
                    className="absolute flex items-center justify-center font-mono text-[9px] font-black text-black/40 dark:text-[#6F8F96]"
                    style={{
                      left: `${gapStart}px`,
                      width: `${gapEnd - gapStart}px`,
                      top: "calc(var(--fatal-axis-y) - 8px)",
                    }}
                  >
                    {/* Zig-zag line */}
                    <svg
                      width={Math.max(gapEnd - gapStart - 8, 10)}
                      height="16"
                      className="stroke-black/30 dark:stroke-[#426D79]"
                      strokeWidth="2.5"
                      fill="none"
                      strokeLinecap="square"
                    >
                      <polyline
                        points={Array.from(
                          { length: Math.ceil((gapEnd - gapStart) / 8) },
                          (_, k) => `${k * 8},${k % 2 === 0 ? 0 : 16}`,
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
                const isSelected = selectedTimelineEventId === event.id;
                const isHovered = hoveredEvent === event.id;
                const isSuspectLinked =
                  suspectLinkedEvents !== null &&
                  suspectLinkedEvents.has(event.id);
                const isEntityDimmed =
                  suspectLinkedEvents !== null &&
                  !suspectLinkedEvents.has(event.id);
                const isFocusDimmed =
                  isDarkMode &&
                  selectedTimelineEventId !== null &&
                  !isSelected;
                const isHoverDimmed =
                  isDarkMode &&
                  !selectedTimelineEventId &&
                  hoveredEvent !== null &&
                  !isHovered;
                const isCategoryDimmed =
                  isDarkMode &&
                  hoveredCategory !== null &&
                  hoveredCategory !== event.category;
                const isDimmed = isDarkMode
                  ? !isSelected &&
                    (isEntityDimmed ||
                      isFocusDimmed ||
                      isHoverDimmed ||
                      isCategoryDimmed)
                  : isEntityDimmed;
                const prominence = isEntityDimmed
                  ? 0.25
                  : isFocusDimmed || isCategoryDimmed
                    ? 0.42
                    : isHoverDimmed
                      ? 0.72
                      : 1;
                const categoryStyles = CATEGORY_DARK_STYLES[event.category];

                return (
                  <div
                    key={event.id}
                    className="fatal-timeline-node absolute"
                    data-selected={isSelected}
                    data-hovered={isHovered}
                    style={{
                      left: `${x * zoomLevel}px`,
                      top: 0,
                      height: "100%",
                      "--event-color": CATEGORY_COLORS[event.category],
                    } as React.CSSProperties}
                  >
                    {/* Annotation callouts (pinned above node) */}
                    {eventAnnotations.map((ann, annIdx) => (
                      <AnnotationCallout
                        key={ann.id}
                        annotation={ann}
                        style={{
                          left: "-8px",
                          top: `calc(var(--fatal-axis-y) - ${88 + annIdx * 44}px)`,
                        }}
                      />
                    ))}

                    {/* Vertical connector stem */}
                    <div
                      className="fatal-timeline-stem absolute w-0 border-l-[3px] border-dashed border-black/40 dark:border-l dark:border-[#526970]"
                      data-selected={isSelected}
                      data-hovered={isHovered}
                      style={{
                        left: "12px",
                        top: isDarkMode ? "11%" : "14%",
                        height: isDarkMode
                          ? "calc(var(--fatal-axis-y) - 11%)"
                          : "46%",
                        opacity: isDimmed ? prominence : 1,
                      }}
                    />

                    {/* Event card (above axis) */}
                    <motion.div
                      role="button"
                      tabIndex={brushActive ? -1 : 0}
                      aria-label={`${event.date} ${event.time}; ${event.category}; ${event.title}; ${event.timePrecision ?? "EXACT"}`}
                      className={`fatal-timeline-event-card absolute w-[140px] transition-all duration-200 hover:-translate-y-1 dark:w-[168px] ${
                        brushActive ? "pointer-events-none" : "cursor-pointer"
                      }`}
                      initial={false}
                      animate={{ opacity: isDimmed ? prominence : 1 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        left: isDarkMode ? "-72px" : "-46px",
                        top: isDarkMode
                          ? "calc(11% - 4px)"
                          : "calc(14% - 4px)",
                        filter: isEntityDimmed ? "grayscale(1)" : "none",
                      }}
                      onClick={() => {
                        if (!brushActive) {
                          setSelectedEvent(event);
                          setSelectedTimelineEventId(event.id);
                          setShowDarkAnnotationPanel(false);
                        }
                      }}
                      onKeyDown={(keyboardEvent) => {
                        if (
                          !brushActive &&
                          (keyboardEvent.key === "Enter" ||
                            keyboardEvent.key === " ")
                        ) {
                          keyboardEvent.preventDefault();
                          setSelectedEvent(event);
                          setSelectedTimelineEventId(event.id);
                          setShowDarkAnnotationPanel(false);
                        }
                      }}
                      onMouseEnter={() => setHoveredEvent(event.id)}
                      onMouseLeave={() => setHoveredEvent(null)}
                    >
                      <div
                        className={`fatal-timeline-card-surface relative min-h-0 rounded-none border-4 p-2 font-mono text-[10px] font-black uppercase leading-tight transition-colors duration-150 dark:min-h-[124px] dark:border-2 dark:border-[#D8D3C7] dark:bg-[#0D1A20] dark:p-3 dark:text-[#F2EFE7] dark:shadow-[6px_6px_0_#010506] ${categoryStyles.cardHover} ${
                          isSelected
                            ? "border-black bg-[#FCD34D] shadow-[6px_6px_0_black] dark:border-[#F2EFE7] dark:bg-[#12242C] dark:shadow-[8px_8px_0_#010506]"
                            : isSuspectLinked
                              ? "border-[#D22B2B] bg-[#D22B2B]/10 shadow-[6px_6px_0_#D22B2B] dark:border-[#D8D3C7] dark:bg-[#0D1A20] dark:shadow-[6px_6px_0_#010506]"
                              : "border-black bg-white shadow-[4px_4px_0_black] hover:shadow-[6px_6px_0_black]"
                        }`}
                      >
                        {/* Suspect-linked badge */}
                        {isSuspectLinked && (
                          <div className="absolute -left-2 -top-2 flex h-5 items-center gap-0.5 border-2 border-[#D22B2B] bg-[#D22B2B] px-1 text-[8px] text-white dark:border-[1px] dark:border-[#32D6A0] dark:bg-[#144453] dark:text-[#32D6A0]">
                            ● LINKED
                          </div>
                        )}
                        <div
                          className={`mb-1 inline-block rounded-none px-1 py-0.5 text-[9px] text-white dark:border dark:!bg-[#031820] ${categoryStyles.label}`}
                          style={{
                            backgroundColor: CATEGORY_COLORS[event.category],
                          }}
                        >
                          {event.category}
                        </div>
                        <p className="fatal-timeline-card-time text-[10px] dark:text-[12px] dark:text-[#F2EFE7]">
                          {event.time}
                        </p>
                        {event.timePrecision ? (
                          <p className="mt-1 text-[8px] opacity-60">
                            {event.timePrecision}
                          </p>
                        ) : null}
                        <p className="fatal-timeline-card-title mt-1 normal-case leading-tight text-[10px] dark:mt-2 dark:text-[11px] dark:leading-[1.25] dark:text-[#F2EFE7]">
                          {event.title}
                        </p>
                        {/* Severity bar */}
                        <div className="fatal-timeline-severity mt-2 flex gap-[2px]">
                          {Array.from({ length: 10 }, (_, i) => (
                            <div
                              key={i}
                              className={`h-[4px] flex-1 ${
                                i < event.severity
                                  ? `${
                                      event.severity >= 8
                                        ? "bg-[#D22B2B]"
                                        : event.severity >= 5
                                          ? "bg-[#D97706]"
                                          : "bg-[#059669]"
                                    } ${categoryStyles.strip}`
                                  : "bg-[#e5e5e5] dark:bg-[#426D79]"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="fatal-timeline-category-accent mt-2 hidden grid-cols-5 gap-[2px] dark:grid">
                          {Array.from({ length: 5 }, (_, segment) => (
                            <span
                              key={segment}
                              className={`h-1 rounded-none ${categoryStyles.strip}`}
                            />
                          ))}
                        </div>
                        {/* Annotation badge count */}
                        {eventAnnotations.length > 0 && (
                          <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border-2 border-black bg-[#D22B2B] text-[9px] text-white dark:border-[#426D79] dark:bg-[#FF4D55] dark:text-[#031820]">
                            {eventAnnotations.length}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Node dot on axis */}
                    <div
                      className={`fatal-timeline-marker absolute h-5 w-5 rounded-none border-4 transition-transform duration-150 hover:scale-110 dark:border-2 ${categoryStyles.markerBorder} ${categoryStyles.strip} ${
                        isHovered ? categoryStyles.markerActive : ""
                      } ${
                        isSelected
                          ? "scale-125 border-black bg-[#FCD34D]"
                          : isSuspectLinked
                            ? "scale-125 border-[#D22B2B] bg-[#D22B2B]"
                            : "border-black bg-white"
                      }`}
                      data-selected={isSelected}
                      data-hovered={isHovered}
                      style={{
                        left: "3px",
                        top: "calc(var(--fatal-axis-y) - 10px)",
                        backgroundColor: isSelected
                          ? "#FCD34D"
                          : isSuspectLinked
                            ? "#D22B2B"
                            : CATEGORY_COLORS[event.category],
                        opacity: isDimmed ? prominence : 1,
                        "--event-color": CATEGORY_COLORS[event.category],
                      } as React.CSSProperties}
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
                    className="fatal-timeline-brush absolute top-0 z-20 h-full border-x-4 border-[#D22B2B] bg-[#D22B2B]/10 pointer-events-none dark:border-[#D8D3C7] dark:bg-[#D8D3C7]/10"
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
        {selectedEvent && !isHeatmapMode && !isDarkMode && (
          <AnnotationPanel
            event={selectedEvent}
            annotations={annotations}
            onAdd={addAnnotation}
            onClose={() => {
              setSelectedEvent(null);
              setSelectedTimelineEventId(null);
            }}
          />
        )}
        {selectedEvent && !isHeatmapMode && isDarkMode && (
          <EventInspector
            event={selectedEvent}
            investigation={activeInvestigation}
            onAnnotate={() => setShowDarkAnnotationPanel(true)}
            onClear={() => {
              setSelectedEvent(null);
              setSelectedTimelineEventId(null);
              setShowDarkAnnotationPanel(false);
            }}
          />
        )}
        {selectedEvent &&
          !isHeatmapMode &&
          isDarkMode &&
          showDarkAnnotationPanel && (
            <AnnotationPanel
              event={selectedEvent}
              annotations={annotations}
              onAdd={addAnnotation}
              onClose={() => setShowDarkAnnotationPanel(false)}
            />
          )}
      </div>

      {/* ─── STATUS BAR ───────────────────────────── */}
      <div className="fatal-timeline-footer hide-scrollbar shrink-0 overflow-x-auto whitespace-nowrap border-t-4 border-black bg-black px-3 py-2 font-mono text-[9px] font-black uppercase text-[#F4F4F0] sm:px-4 sm:text-[10px] dark:border-t dark:border-[#34515A] dark:bg-[#050B0E] dark:text-[#AFAFA7]">
        <div className="flex items-center gap-4">
          <span>
            Range: {timeRange[0]} → {timeRange[1]}
          </span>
          <span className="text-[#D22B2B] dark:text-[#FF4D55]">
            {filteredEvents.length} Events
          </span>
          <span>{annotations.length} Annotations</span>
          <span className="text-[#FCD34D] dark:text-[#FFD45A]">
            Zoom: {isHeatmapMode ? "HEATMAP" : `${zoomLevel.toFixed(1)}×`}
          </span>
          {brushActive && (
            <span className="animate-pulse text-[#D22B2B] dark:text-[#FF4D55]">
              ● BRUSH ACTIVE — DRAG TO SELECT
            </span>
          )}
          <span className="ml-auto text-white/40 dark:text-[#6F8F96]">
            FATAL//TIMELINE v2.0
          </span>
        </div>
      </div>
    </div>
  );
}
