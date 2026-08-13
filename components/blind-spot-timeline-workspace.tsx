"use client";

import { RefreshCw, Radar } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  InvestigationTimeline,
  type InvestigationTimelineItem,
} from "@/components/investigation-timeline";


const SUSPECT_ID = "SUSPECT-001";
const TIMELINE_ENDPOINT =
  process.env.NEXT_PUBLIC_TIMELINE_INTEL_URL ??
  `http://localhost:8000/api/v1/intel/timeline/${SUSPECT_ID}`;

const DEMO_TIMELINE: InvestigationTimelineItem[] = [
  {
    id: "EVT-001",
    suspect_id: SUSPECT_ID,
    type: "EVENT",
    timestamp: "2026-08-12T09:05:00Z",
    location: "Shivajinagar Transit Gate",
    lat: 18.5308,
    lon: 73.8475,
  },
  {
    id: "EVT-002",
    suspect_id: SUSPECT_ID,
    type: "EVENT",
    timestamp: "2026-08-12T09:17:00Z",
    location: "Central Evidence Annex",
    lat: 18.5204,
    lon: 73.8567,
  },
  {
    id: "BLIND-EVT-002-EVT-003",
    suspect_id: SUSPECT_ID,
    type: "BLIND_SPOT",
    timestamp: "2026-08-12T09:17:00Z",
    start_time: "2026-08-12T09:17:00Z",
    end_time: "2026-08-12T09:44:00Z",
    duration_minutes: 27,
    max_travel_radius_km: 18,
    origin_lat: 18.5204,
    origin_lon: 73.8567,
    intersecting_nodes: [
      { id: "CAM-S11", lat: 18.5204, lon: 73.8567, distance_km: 0 },
      { id: "CAM-K07", lat: 18.5362, lon: 73.8939, distance_km: 4.298 },
      { id: "CAM-R19", lat: 18.5089, lon: 73.9259, distance_km: 7.408 },
      { id: "CAM-P33", lat: 18.5679, lon: 73.9143, distance_km: 8.048 },
    ],
  },
  {
    id: "EVT-003",
    suspect_id: SUSPECT_ID,
    type: "EVENT",
    timestamp: "2026-08-12T09:44:00Z",
    location: "Hadapsar Toll Camera",
    lat: 18.5089,
    lon: 73.9259,
  },
  {
    id: "EVT-004",
    suspect_id: SUSPECT_ID,
    type: "EVENT",
    timestamp: "2026-08-12T09:59:00Z",
    location: "Magarpatta Access Road",
    lat: 18.5167,
    lon: 73.9272,
  },
];

type FeedStatus = "loading" | "live" | "demo";

export function BlindSpotTimelineWorkspace() {
  const [items, setItems] =
    useState<InvestigationTimelineItem[]>(DEMO_TIMELINE);
  const [status, setStatus] = useState<FeedStatus>("loading");

  const loadTimeline = useCallback(async (signal?: AbortSignal) => {
    setStatus("loading");

    try {
      const { data: sessionData } =
        await getSupabaseBrowserClient().auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Authenticated session unavailable");

      const response = await fetch(TIMELINE_ENDPOINT, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal,
      });

      if (!response.ok) {
        throw new Error(`Timeline request failed with ${response.status}`);
      }

      const timeline = (await response.json()) as InvestigationTimelineItem[];
      setItems(timeline);
      setStatus("live");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.warn("Timeline intelligence API unavailable; using demo data.", error);
      setItems(DEMO_TIMELINE);
      setStatus("demo");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadTimeline(controller.signal);
    return () => controller.abort();
  }, [loadTimeline]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F4F4F0] dark:bg-[#031820]">
      <header className="shrink-0 border-b-4 border-black bg-black px-4 py-3 text-white dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9] sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#EF4444] dark:text-[#EAE5C9]/70">
              Investigation Blind-Spot Detector
            </p>
            <h2 className="mt-1 font-serif text-2xl font-black uppercase leading-none sm:text-3xl">
              Suspect Timeline // {SUSPECT_ID}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => void loadTimeline()}
            disabled={status === "loading"}
            className="grid size-11 shrink-0 place-items-center border-2 border-white bg-black text-white shadow-[3px_3px_0_#EF4444] disabled:opacity-60 dark:border-[#EAE5C9] dark:bg-[#06141B] dark:text-[#EAE5C9]"
            aria-label="Refresh timeline intelligence"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-5 ${status === "loading" ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] font-black uppercase tracking-[0.12em]">
          <Radar aria-hidden="true" className="size-4 text-[#EF4444]" />
          <span
            className={
              status === "live"
                ? "text-emerald-400"
                : status === "demo"
                  ? "text-amber-300"
                  : "text-white/60 dark:text-[#EAE5C9]/60"
            }
          >
            {status === "live"
              ? "Live spatial feed"
              : status === "demo"
                ? "API offline // demo evidence loaded"
                : "Acquiring spatial feed..."}
          </span>
        </div>
      </header>

      <main className="fatal-timeline-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <InvestigationTimeline items={items} className="mx-auto" />
      </main>
    </div>
  );
}
