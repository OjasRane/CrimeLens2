"use client";

import { AlertTriangle, ArrowLeft, Camera, MapPinned, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getInvestigation } from "@/data/investigations/registry";
import type { InvestigationTimelineEvent } from "@/data/investigations/types";
import { listGapReconstructions, previewGapReconstruction, saveGapReconstruction } from "@/lib/crimelens-api";
import type { GapObservation, GapPreview, GapRequest } from "@/lib/gap-reconstruction";
import { useInvestigationStore } from "@/store/use-investigation-store";

function timestampFor(event: InvestigationTimelineEvent): string | null {
  if (event.eventTime) return event.eventTime;
  const match = event.time.match(/(\d{1,2}):(\d{2})/);
  if (!match || event.timePrecision !== "EXACT") return null;
  const desired = Date.UTC(Number(event.date.slice(0, 4)), Number(event.date.slice(5, 7)) - 1, Number(event.date.slice(8, 10)), Number(match[1]), Number(match[2]));
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: event.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(desired));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    return new Date(desired - (represented - desired)).toISOString();
  } catch { return null; }
}

function observation(event: InvestigationTimelineEvent, locationId: string, earliest?: string, latest?: string): GapObservation | null {
  const exact = timestampFor(event);
  const approximate = event.timePrecision !== "EXACT";
  if (approximate && (!earliest || !latest)) return null;
  const observedAt = exact ?? new Date(earliest!).toISOString();
  return { eventId: event.id, locationId, observedAt, ...(approximate ? { earliestAt: new Date(earliest!).toISOString(), latestAt: new Date(latest!).toISOString() } : {}), timePrecision: event.timePrecision, associationKind: "DOCUMENTED_SIGHTING" };
}

export function GapReconstructionPanel({ onClose }: { onClose: () => void }) {
  const investigationId = useInvestigationStore((state) => state.activeInvestigationId);
  useInvestigationStore((state) => state.investigationRevision);
  const setGapReconstruction = useInvestigationStore((state) => state.setGapReconstruction);
  const setActiveWorkspace = useInvestigationStore((state) => state.setActiveWorkspace);
  const selectedEntityId = useInvestigationStore((state) => state.selectedEntityId);
  const investigation = getInvestigation(investigationId);
  const entities = investigation.graph.nodes.filter((node) => !["location", "team", "organization", "response"].includes(node.kind));
  const [entityId, setEntityId] = useState(selectedEntityId && entities.some((node) => node.id === selectedEntityId) ? selectedEntityId : entities[0]?.id ?? "");
  const eligible = useMemo(() => investigation.timeline.events.filter((event) => event.linkedEntityIds.includes(entityId) && event.linkedLocationIds.some((id) => investigation.map.locations.some((location) => location.id === id && location.coordinates))), [entityId, investigation]);
  const [startId, setStartId] = useState(""); const [endId, setEndId] = useState("");
  const [speed, setSpeed] = useState(40); const [mode, setMode] = useState("vehicle");
  const [startEarliest, setStartEarliest] = useState(""); const [startLatest, setStartLatest] = useState("");
  const [endEarliest, setEndEarliest] = useState(""); const [endLatest, setEndLatest] = useState("");
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [previewed, setPreviewed] = useState(false);
  const [result, setResult] = useState<GapPreview | null>(null);
  const [savedRuns, setSavedRuns] = useState<GapPreview[]>([]);
  const requestRef = useRef<GapRequest | null>(null); const abortRef = useRef<AbortController | null>(null);
  const startEvent = eligible.find((event) => event.id === startId); const endEvent = eligible.find((event) => event.id === endId);

  useEffect(() => {
    const controller = new AbortController();
    void listGapReconstructions(investigationId, controller.signal)
      .then(setSavedRuns)
      .catch((caught) => { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Saved analyses could not be loaded."); });
    return () => { controller.abort(); abortRef.current?.abort(); };
  }, [investigationId]);

  function buildRequest(): GapRequest | null {
    if (!startEvent || !endEvent || startEvent.id === endEvent.id) { setError("Select two different documented sightings."); return null; }
    const start = observation(startEvent, startEvent.linkedLocationIds[0], startEarliest, startLatest);
    const end = observation(endEvent, endEvent.linkedLocationIds[0], endEarliest, endLatest);
    if (!start || !end) { setError("Approximate timestamps require explicit earliest and latest bounds. No exact time will be fabricated."); return null; }
    const payload = { entityId, startObservation: start, endObservation: end, travelMode: mode, speedKmh: speed };
    if (Date.parse(start.earliestAt ?? start.observedAt) >= Date.parse(end.latestAt ?? end.observedAt)) { setError("The second observation must occur after the first."); return null; }
    return payload;
  }

  async function run(save: boolean) {
    const payload = requestRef.current ?? buildRequest(); if (!payload) return;
    abortRef.current?.abort(); const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setError(null);
    try {
      const result = save ? await saveGapReconstruction(investigationId, payload, controller.signal) : await previewGapReconstruction(investigationId, payload, controller.signal);
      requestRef.current = payload; setGapReconstruction(result); setResult(result); setPreviewed(true);
      if (save) setSavedRuns((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      if (save) setActiveWorkspace("map");
    } catch (caught) { if (!(caught instanceof DOMException && caught.name === "AbortError")) setError(caught instanceof Error ? caught.message : "Gap reconstruction failed."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <section className="flex h-full min-h-0 flex-col bg-[var(--paper)] text-[var(--ink)]">
    <header className="flex items-center justify-between border-b-4 border-[var(--ink)] bg-[var(--ink)] p-3 text-[var(--paper)]">
      <div><p className="font-mono text-[10px] font-black uppercase tracking-[.18em] text-[var(--accent)]">Calculated analysis // not verified evidence</p><h2 className="font-serif text-2xl font-black uppercase">Gap Reconstruction</h2></div>
      <button type="button" onClick={onClose} className="flex min-h-11 items-center gap-2 border-2 border-current px-3 font-mono text-xs font-black uppercase"><ArrowLeft className="size-4"/> Timeline</button>
    </header>
    <div className="fatal-timeline-scroll grid flex-1 gap-4 overflow-y-auto p-4 font-mono text-xs lg:grid-cols-2">
      <div className="space-y-4">
        <label className="block font-black uppercase">1 // Person or vehicle<select value={entityId} onChange={(event) => { setEntityId(event.target.value); setStartId(""); setEndId(""); requestRef.current=null; }} className="mt-1 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--panel)] p-2">{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label} // {entity.kind}</option>)}</select></label>
        {eligible.length < 2 ? <div role="status" className="border-4 border-dashed border-[var(--danger)] p-3"><AlertTriangle className="mb-2 size-5"/><b>INSUFFICIENT DOCUMENTED SIGHTINGS</b><p className="mt-2 normal-case">An entity mention does not establish presence. At least two entity-linked events with explicit, geocoded locations are required.</p></div> : <>
          <label className="block font-black uppercase">2 // Start sighting<select value={startId} onChange={(event) => { setStartId(event.target.value); requestRef.current=null; }} className="mt-1 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--panel)] p-2"><option value="">Choose documented event…</option>{eligible.map((event) => <option key={event.id} value={event.id}>{event.date} {event.time} // {event.title}</option>)}</select></label>
          <label className="block font-black uppercase">3 // End sighting<select value={endId} onChange={(event) => { setEndId(event.target.value); requestRef.current=null; }} className="mt-1 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--panel)] p-2"><option value="">Choose documented event…</option>{eligible.map((event) => <option key={event.id} value={event.id}>{event.date} {event.time} // {event.title}</option>)}</select></label>
        </>}
        {[{event:startEvent,prefix:"Start",earliest:startEarliest,latest:startLatest,setEarliest:setStartEarliest,setLatest:setStartLatest},{event:endEvent,prefix:"End",earliest:endEarliest,latest:endLatest,setEarliest:setEndEarliest,setLatest:setEndLatest}].map((item) => item.event && item.event.timePrecision !== "EXACT" ? <div key={item.prefix} className="border-2 border-[var(--accent)] p-2"><b>{item.prefix.toUpperCase()} TIME ENVELOPE REQUIRED</b><div className="mt-2 grid gap-2 sm:grid-cols-2"><label>Earliest<input type="datetime-local" value={item.earliest} onChange={(e)=>item.setEarliest(e.target.value)} className="mt-1 w-full border-2 border-[var(--ink)] bg-[var(--panel)] p-2"/></label><label>Latest<input type="datetime-local" value={item.latest} onChange={(e)=>item.setLatest(e.target.value)} className="mt-1 w-full border-2 border-[var(--ink)] bg-[var(--panel)] p-2"/></label></div></div> : null)}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="font-black uppercase">Travel mode<select value={mode} onChange={(e)=>{setMode(e.target.value);requestRef.current=null;}} className="mt-1 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--panel)] p-2"><option value="walk">Walk</option><option value="bicycle">Bicycle</option><option value="vehicle">Vehicle</option><option value="analyst-defined">Analyst-defined</option></select></label><label className="font-black uppercase">Assumed speed<input type="number" min="0.1" max="400" step="0.5" value={speed} onChange={(e)=>{setSpeed(Number(e.target.value));requestRef.current=null;}} className="mt-1 min-h-11 w-full border-4 border-[var(--ink)] bg-[var(--panel)] p-2"/><span className="block text-[9px]">KM/H // assumption, not proven maximum</span></label></div>
        <div className="border-4 border-[var(--ink)] bg-[var(--panel)] p-3"><MapPinned className="mb-2 size-5"/><b>MODEL BOUNDARY</b><p className="mt-2 normal-case leading-relaxed">Uses intersecting geodesic reachability disks and the necessary condition d(A,C)+d(C,B) ≤ speed × elapsed time. It does not claim a road route, actual sighting, field of view, footage availability, or guilt.</p></div>
        {error ? <div role="alert" className="border-4 border-[var(--danger)] p-3 font-bold text-[var(--danger)]">{error}</div> : null}
        {result ? <div role="status" className={`border-4 p-3 ${result.feasible ? "border-[var(--accent)]" : "border-[var(--danger)]"}`}><Camera className="mb-2 size-5"/><b>{result.feasible ? `${result.candidates.length} CANDIDATE CAMERA${result.candidates.length === 1 ? "" : "S"}` : "EMPTY POSSIBLE REGION"}</b><p className="mt-2 normal-case">{result.reason} {result.candidates.length === 0 && result.feasible ? "No eligible camera inventory intersects this travel budget. Camera availability may also be unknown." : "Open Map to scrub the interval and inspect review windows."}</p></div> : null}
        <div className="grid gap-2 sm:grid-cols-3"><button disabled={busy || eligible.length<2} onClick={()=>void run(false)} className="min-h-12 border-4 border-[var(--ink)] bg-[var(--accent)] px-3 font-black uppercase disabled:opacity-40">{busy ? "Calculating…" : "Run preview"}</button><button disabled={!previewed || busy} onClick={()=>setActiveWorkspace("map")} className="min-h-12 border-4 border-[var(--ink)] bg-[var(--panel)] px-3 font-black uppercase disabled:opacity-40">Open Map</button><button disabled={!previewed || busy} onClick={()=>void run(true)} className="flex min-h-12 items-center justify-center gap-2 border-4 border-[var(--ink)] bg-[var(--ink)] px-3 font-black uppercase text-[var(--paper)] disabled:opacity-40"><Save className="size-4"/>Save workflow</button></div>
        <div className="border-t-4 border-[var(--ink)] pt-3"><b>SAVED RECONSTRUCTIONS ({savedRuns.length})</b>{savedRuns.length === 0 ? <p className="mt-2 normal-case opacity-70">No saved gap-review workflows in this investigation.</p> : <div className="mt-2 space-y-2">{savedRuns.map((run) => <button key={run.id} type="button" onClick={()=>{setGapReconstruction(run);setActiveWorkspace("map");}} className="block min-h-11 w-full border-2 border-[var(--ink)] bg-[var(--panel)] p-2 text-left"><span>{run.inputs.entityId} // {run.candidates.length} candidates</span><span className="block text-[9px] normal-case opacity-70">{run.createdAt ? new Date(run.createdAt).toLocaleString() : run.algorithmVersion}</span></button>)}</div>}</div>
      </div>
    </div>
  </section>;
}
