"use client";

import { AlertTriangle, Camera, MapPinned } from "lucide-react";
import { motion } from "framer-motion";


export type IntersectingCamera = {
  id: string;
  lat: number;
  lon: number;
  distance_km: number;
};

export type InvestigationEvent = {
  id: string;
  suspect_id: string;
  type: "EVENT";
  timestamp: string;
  location: string;
  lat: number;
  lon: number;
};

export type InvestigationBlindSpot = {
  id: string;
  suspect_id: string;
  type: "BLIND_SPOT";
  timestamp: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  max_travel_radius_km: number;
  origin_lat: number;
  origin_lon: number;
  intersecting_nodes: IntersectingCamera[];
};

export type InvestigationTimelineItem =
  | InvestigationEvent
  | InvestigationBlindSpot;

type InvestigationTimelineProps = {
  items: readonly InvestigationTimelineItem[];
  className?: string;
};

function formatTimestamp(timestamp: string): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(parsed)
    .replace(",", " //")
    .toUpperCase();
}

function formatMeasurement(value: number): string {
  return Number.isInteger(value)
    ? value.toFixed(0)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function StandardEventNode({ item }: { item: InvestigationEvent }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className="relative pl-11"
    >
      <span
        aria-hidden="true"
        className="absolute left-[9px] top-5 z-10 h-4 w-4 bg-white border-4 border-black dark:border-[#EAE5C9] dark:bg-[#06141B]"
      />

      <article className="border-2 border-black bg-white px-4 py-3 text-black dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9]">
        <time
          dateTime={item.timestamp}
          className="block font-mono text-[11px] font-black tracking-[0.16em] opacity-65"
        >
          {formatTimestamp(item.timestamp)}
        </time>
        <div className="mt-2 flex items-start gap-2 font-mono text-sm font-black uppercase">
          <MapPinned aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{item.location}</span>
        </div>
      </article>
    </motion.li>
  );
}

function BlindSpotNode({ item }: { item: InvestigationBlindSpot }) {
  const duration = formatMeasurement(item.duration_minutes);
  const radius = formatMeasurement(item.max_travel_radius_km);

  return (
    <motion.li
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="relative py-2 pl-4 sm:-ml-4 sm:pl-0"
    >
      <article className="relative overflow-hidden border-4 border-[#EF4444] bg-white text-[#EF4444] shadow-[7px_7px_0_#EF4444] dark:border-[#EAE5C9] dark:bg-[#06141B] dark:shadow-[7px_7px_0_#EAE5C9]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden opacity-[0.14] dark:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #EAE5C9 0, #EAE5C9 10px, transparent 10px, transparent 22px)",
          }}
        />

        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-7 shrink-0 stroke-[3] dark:text-[#EAE5C9]"
            />
            <div>
              <p className="font-mono text-sm font-black uppercase tracking-[0.08em] sm:text-base">
                [ 🔴 UNACCOUNTED TIME DEVIATION: {duration} MINS ]
              </p>
              <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-black/60 dark:text-[#EAE5C9]/70">
                {formatTimestamp(item.start_time)} → {formatTimestamp(item.end_time)}
              </p>
            </div>
          </div>

          <div className="my-5 border-y-2 border-[#EF4444] py-4 dark:border-[#EAE5C9]">
            <p className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.08em] text-black dark:text-[#EAE5C9] sm:text-sm">
              <Camera aria-hidden="true" className="size-5 shrink-0" />
              [ {item.intersecting_nodes.length} SURVEILLANCE NODES IDENTIFIED IN
              RADIUS ]
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              console.log(
                `[SEARCH GRID // ${item.id}]`,
                item.intersecting_nodes,
              );
            }}
            className="w-full border-4 border-black bg-[#EF4444] px-4 py-3 font-mono text-xs font-black uppercase tracking-[0.08em] text-white shadow-[4px_4px_0_#000] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#EF4444] dark:border-[#EAE5C9] dark:bg-[#EAE5C9] dark:text-[#06141B] dark:shadow-[4px_4px_0_#EF4444] dark:focus-visible:outline-[#EAE5C9]"
          >
            [ GENERATE {radius}KM SEARCH GRID ]
          </button>
        </div>
      </article>
    </motion.li>
  );
}

export function InvestigationTimeline({
  items,
  className = "",
}: InvestigationTimelineProps) {
  return (
    <section
      aria-label="Suspect investigation timeline"
      className={`w-full max-w-3xl ${className}`}
    >
      <ol className="relative space-y-5 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-1 before:bg-black before:content-[''] dark:before:bg-[#EAE5C9]">
        {items.map((item) =>
          item.type === "BLIND_SPOT" ? (
            <BlindSpotNode key={item.id} item={item} />
          ) : (
            <StandardEventNode key={item.id} item={item} />
          ),
        )}
      </ol>
    </section>
  );
}
