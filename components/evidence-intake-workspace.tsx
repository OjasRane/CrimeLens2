"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FileSearch,
  FileUp,
  Fingerprint,
  History,
  LoaderCircle,
  MapPin,
  Network,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getInvestigation } from "@/data/investigations/registry";
import type {
  ActivityEvent,
  CandidateType,
  EvidenceCommitResult,
  EvidenceExtraction,
  EvidenceItem,
  ExtractionCandidate,
  InvestigationSearchResult,
  InvestigationStatus,
  ReportDraft,
} from "@/lib/evidence-types";
import {
  commitEvidence,
  generateCaseBrief,
  getEvidenceExtraction,
  getEvidenceHistory,
  getEvidenceItems,
  getInvestigationActivity,
  getInvestigationBundle,
  getInvestigationStatus,
  retryEvidenceExtraction,
  reviewEvidenceCandidate,
  searchInvestigation,
  uploadEvidence,
} from "@/lib/crimelens-api";
import { triggerHaptic } from "@/lib/haptics";
import { useInvestigationStore } from "@/store/use-investigation-store";

const sourceTypes = [
  "POLICE REPORT",
  "WITNESS STATEMENT",
  "CCTV METADATA",
  "CALL RECORD",
  "DOCUMENT",
  "IMAGE",
  "CSV DATA",
  "TEXT NOTE",
  "OTHER",
];

const reviewTabs: Array<{ id: CandidateType | "EVENTS"; label: string }> = [
  { id: "ENTITY", label: "ENTITIES" },
  { id: "LOCATION", label: "LOCATIONS" },
  { id: "EVENTS", label: "EVENTS" },
  { id: "RELATIONSHIP", label: "RELATIONSHIPS" },
  { id: "CONFLICT", label: "CONFLICTS" },
];

const processingStates = new Set(["UPLOADED", "EXTRACTING", "AI_ANALYZING"]);
const terminalExtractionStates = new Set([
  "PENDING_REVIEW",
  "PARTIALLY_REVIEWED",
  "APPROVED",
  "FAILED",
]);

function readable(value: string) {
  return value.replaceAll("_", " ");
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function locatorLabel(payload: Record<string, unknown>) {
  const locator = payload.sourceLocator;
  if (!locator || typeof locator !== "object") return "SOURCE FILE";
  const entries = Object.entries(locator as Record<string, unknown>);
  return entries.length
    ? entries.map(([key, value]) => `${key.toUpperCase()} ${String(value)}`).join(" / ")
    : "SOURCE FILE";
}

function candidateTitle(candidate: ExtractionCandidate) {
  const payload = candidate.candidatePayload;
  if (candidate.candidateType === "RELATIONSHIP") {
    return `${String(payload.sourceLabel ?? "SOURCE")} → ${String(payload.targetLabel ?? "TARGET")}`;
  }
  if (candidate.candidateType === "DATE_TIME") {
    return [payload.date, payload.time].filter(Boolean).join(" // ") || "DATE / TIME";
  }
  return String(payload.label ?? payload.title ?? payload.conflictType ?? "REVIEW CANDIDATE");
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "APPROVED" || status === "ACCEPTED" || status === "EDITED_ACCEPTED"
      ? "bg-emerald-600 text-white"
      : status === "FAILED" || status === "REJECTED"
        ? "bg-[var(--danger)] text-white"
        : status === "PENDING_REVIEW" || status === "PARTIALLY_REVIEWED"
          ? "bg-[var(--accent)] text-black"
          : "bg-[var(--ink)] text-[var(--paper)]";
  return (
    <span className={`inline-flex border-2 border-[var(--ink)] px-2 py-1 text-[9px] font-black uppercase ${tone}`}>
      [ {readable(status)} ]
    </span>
  );
}

function ProcessingRail({ status }: { status: EvidenceItem["processingStatus"] }) {
  const stages = [
    ["FILE INGESTED", ["UPLOADED", "EXTRACTING", "AI_ANALYZING", "PENDING_REVIEW", "PARTIALLY_REVIEWED", "APPROVED"]],
    ["INTEGRITY HASH", ["UPLOADED", "EXTRACTING", "AI_ANALYZING", "PENDING_REVIEW", "PARTIALLY_REVIEWED", "APPROVED"]],
    ["CONTENT EXTRACTION", ["AI_ANALYZING", "PENDING_REVIEW", "PARTIALLY_REVIEWED", "APPROVED"]],
    ["CANDIDATE EXTRACTION", ["PENDING_REVIEW", "PARTIALLY_REVIEWED", "APPROVED"]],
    ["HUMAN REVIEW", ["PARTIALLY_REVIEWED", "APPROVED"]],
    ["CASE COMMIT", ["APPROVED"]],
  ] as const;
  const activeIndex =
    status === "UPLOADED" ? 0 : status === "EXTRACTING" ? 2 : status === "AI_ANALYZING" ? 3 : status === "PENDING_REVIEW" ? 4 : status === "PARTIALLY_REVIEWED" ? 5 : 6;
  return (
    <ol className="grid gap-2 text-[10px] font-black uppercase sm:grid-cols-2 xl:grid-cols-3">
      {stages.map(([label, completedStates], index) => {
        const complete = (completedStates as readonly string[]).includes(status);
        const active = processingStates.has(status) && index === activeIndex;
        return (
          <li key={label} className={`flex items-center gap-2 border-2 border-[var(--ink)] p-2 ${complete ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--paper)]"}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {complete ? <Check size={14} /> : active ? <LoaderCircle className="animate-spin" size={14} /> : <span>○</span>}
          </li>
        );
      })}
    </ol>
  );
}

function UploadPanel({
  investigationName,
  busy,
  onClose,
  onUpload,
}: {
  investigationName: string;
  busy: boolean;
  onClose: () => void;
  onUpload: (payload: { file: File; sourceType: string; description: string }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState(sourceTypes[1]);
  const [description, setDescription] = useState("");
  return (
    <div className="fixed inset-0 z-[160] grid place-items-center bg-black/70 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-evidence-title">
      <form
        className="w-full max-w-2xl border-4 border-[var(--ink)] bg-[var(--paper)] p-4 text-[var(--ink)] shadow-[8px_8px_0_var(--accent)] sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (file) void onUpload({ file, sourceType, description });
        }}
      >
        <div className="mb-5 flex items-start justify-between border-b-4 border-[var(--ink)] pb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">Pilot ingestion channel</p>
            <h3 id="new-evidence-title" className="font-serif text-3xl font-black uppercase">New Evidence</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center border-2 border-[var(--ink)] bg-[var(--panel)] shadow-[3px_3px_0_var(--ink)]" aria-label="Close upload panel"><X /></button>
        </div>
        <div className="grid gap-4">
          <label className="grid gap-1 text-[10px] font-black uppercase">Investigation<input readOnly value={investigationName} className="h-12 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 font-bold" /></label>
          <label className="grid gap-1 text-[10px] font-black uppercase">Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="h-12 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 font-bold">{sourceTypes.map((source) => <option key={source}>{source}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-black uppercase">File<input required type="file" accept=".pdf,.txt,.csv,.json,.jpg,.jpeg,.png,application/pdf,text/plain,text/csv,application/json,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="min-h-12 border-2 border-dashed border-[var(--ink)] bg-[var(--panel)] p-3 font-bold file:mr-3 file:border-2 file:border-[var(--ink)] file:bg-[var(--accent)] file:px-3 file:py-2 file:font-black file:uppercase" /></label>
          <label className="grid gap-1 text-[10px] font-black uppercase">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} className="resize-none border-2 border-[var(--ink)] bg-[var(--panel)] p-3 font-bold normal-case" placeholder="Context for the investigator — not an evidentiary conclusion" /></label>
        </div>
        <div className="mt-5 border-2 border-[var(--ink)] bg-[var(--panel)] p-3 text-[10px] font-bold uppercase">
          Raw material remains unverified. Extracted candidates require human review and a separate commit.
        </div>
        <button disabled={!file || busy} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 border-4 border-[var(--ink)] bg-[var(--accent)] px-4 font-black uppercase shadow-[5px_5px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-45">
          {busy ? <LoaderCircle className="animate-spin" size={18} /> : <FileUp size={18} />} [ Ingest Evidence ]
        </button>
      </form>
    </div>
  );
}

function EditCandidatePanel({ candidate, busy, onClose, onSave }: { candidate: ExtractionCandidate; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => void }) {
  const [payload, setPayload] = useState(candidate.candidatePayload);
  const fields = ["label", "type", "title", "description", "date", "time", "timePrecision", "relationshipType", "sourceLabel", "targetLabel"].filter((key) => key in payload);
  return (
    <div className="fixed inset-0 z-[170] grid place-items-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label="Edit extraction candidate">
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-5 shadow-[7px_7px_0_var(--accent)]">
        <div className="flex items-start justify-between border-b-4 border-[var(--ink)] pb-3"><div><p className="text-[10px] font-black uppercase">Investigator correction</p><h3 className="font-serif text-2xl font-black uppercase">Edit candidate</h3></div><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center border-2 border-[var(--ink)]"><X /></button></div>
        <div className="mt-4 grid gap-3">
          {fields.map((key) => <label key={key} className="grid gap-1 text-[10px] font-black uppercase">{readable(key)}{key === "description" ? <textarea value={String(payload[key] ?? "")} onChange={(event) => setPayload((current) => ({ ...current, [key]: event.target.value }))} rows={4} className="border-2 border-[var(--ink)] bg-[var(--panel)] p-3 font-bold normal-case" /> : <input value={String(payload[key] ?? "")} onChange={(event) => setPayload((current) => ({ ...current, [key]: event.target.value }))} className="h-11 border-2 border-[var(--ink)] bg-[var(--panel)] px-3 font-bold normal-case" />}</label>)}
        </div>
        <button type="button" disabled={busy} onClick={() => onSave(payload)} className="mt-5 min-h-12 w-full border-4 border-[var(--ink)] bg-[var(--accent)] font-black uppercase shadow-[4px_4px_0_var(--ink)]">[ Save + Accept Edit ]</button>
      </div>
    </div>
  );
}

export function EvidenceIntakeWorkspace() {
  const activeInvestigationId = useInvestigationStore((state) => state.activeInvestigationId);
  const hydrateInvestigation = useInvestigationStore((state) => state.hydrateInvestigation);
  const setActiveWorkspace = useInvestigationStore((state) => state.setActiveWorkspace);
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<EvidenceExtraction | null>(null);
  const [activeTab, setActiveTab] = useState<(typeof reviewTabs)[number]["id"]>("ENTITY");
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExtractionCandidate | null>(null);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [commitResult, setCommitResult] = useState<EvidenceCommitResult | null>(null);
  const [history, setHistory] = useState<ActivityEvent[] | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [investigationStatus, setInvestigationStatus] = useState<InvestigationStatus | null>(null);
  const [report, setReport] = useState<ReportDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvestigationSearchResult[]>([]);
  const pollingAttempts = useRef(0);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const refreshItems = useCallback(async () => {
    const next = await getEvidenceItems(activeInvestigationId);
    setItems(next);
    setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
    return next;
  }, [activeInvestigationId]);

  const refreshPeripheralData = useCallback(async () => {
    const [nextActivity, nextStatus] = await Promise.all([
      getInvestigationActivity(activeInvestigationId),
      getInvestigationStatus(activeInvestigationId),
    ]);
    setActivity(nextActivity);
    setInvestigationStatus(nextStatus);
  }, [activeInvestigationId]);

  useEffect(() => {
    let active = true;
    setError(null);
    setExtraction(null);
    setCommitResult(null);
    Promise.all([refreshItems(), refreshPeripheralData()]).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Evidence link could not be established.");
    });
    return () => { active = false; };
  }, [refreshItems, refreshPeripheralData]);

  useEffect(() => {
    if (!selected) { setExtraction(null); return; }
    if (!terminalExtractionStates.has(selected.processingStatus) || selected.processingStatus === "FAILED") {
      setExtraction(null);
      return;
    }
    const controller = new AbortController();
    getEvidenceExtraction(selected.id, controller.signal).then(setExtraction).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setError(reason instanceof Error ? reason.message : "Extraction could not be loaded.");
    });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    if (!selected || !processingStates.has(selected.processingStatus)) return;
    pollingAttempts.current = 0;
    const interval = window.setInterval(() => {
      pollingAttempts.current += 1;
      if (pollingAttempts.current > 40) { window.clearInterval(interval); setError("Processing is taking longer than expected. Refresh the evidence record to continue."); return; }
      void refreshItems().then((next) => {
        const item = next.find((candidate) => candidate.id === selected.id);
        if (!item || terminalExtractionStates.has(item.processingStatus)) {
          window.clearInterval(interval);
          void refreshPeripheralData();
        }
      }).catch(() => window.clearInterval(interval));
    }, 1500);
    return () => window.clearInterval(interval);
  }, [refreshItems, refreshPeripheralData, selected]);

  const visibleCandidates = useMemo(() => extraction?.candidates.filter((candidate) => activeTab === "EVENTS" ? candidate.candidateType === "EVENT" || candidate.candidateType === "DATE_TIME" : candidate.candidateType === activeTab) ?? [], [activeTab, extraction]);
  const pendingCount = extraction?.candidates.filter((candidate) => candidate.reviewStatus === "PENDING").length ?? 0;
  const reviewTotals = useMemo(() => extraction?.candidates.reduce((totals, candidate) => ({ ...totals, [candidate.reviewStatus]: (totals[candidate.reviewStatus] ?? 0) + 1 }), {} as Record<string, number>) ?? {}, [extraction]);

  async function handleUpload(payload: { file: File; sourceType: string; description: string }) {
    setBusy(true); setError(null);
    try {
      const item = await uploadEvidence(activeInvestigationId, payload);
      setItems((current) => [item, ...current]);
      setSelectedId(item.id); setShowUpload(false); setCommitResult(null); triggerHaptic("heavy");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Evidence could not be ingested."); }
    finally { setBusy(false); }
  }

  async function review(candidate: ExtractionCandidate, reviewStatus: "ACCEPTED" | "EDITED_ACCEPTED" | "REJECTED", candidatePayload?: Record<string, unknown>) {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      const updated = await reviewEvidenceCandidate(selected.id, candidate.id, { reviewStatus, ...(candidatePayload ? { candidatePayload } : {}) });
      setExtraction((current) => current ? { ...current, candidates: current.candidates.map((item) => item.id === updated.id ? updated : item) } : current);
      await Promise.all([refreshItems(), refreshPeripheralData()]); setEditing(null); triggerHaptic("light");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Review action failed."); }
    finally { setBusy(false); }
  }

  async function resolveDuplicate(candidate: ExtractionCandidate, resolutionStatus: "MERGE" | "CREATE_SEPARATE") {
    const duplicate = candidate.candidatePayload.possibleDuplicate;
    if (!duplicate || typeof duplicate !== "object") return;
    await review(candidate, "EDITED_ACCEPTED", { ...candidate.candidatePayload, possibleDuplicate: { ...(duplicate as Record<string, unknown>), resolutionStatus } });
  }

  async function handleCommit() {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      const result = await commitEvidence(selected.id);
      setCommitResult(result); setConfirmCommit(false);
      const investigation = await getInvestigationBundle(activeInvestigationId);
      hydrateInvestigation(investigation);
      await Promise.all([refreshItems(), refreshPeripheralData()]);
      const nextExtraction = await getEvidenceExtraction(selected.id);
      setExtraction(nextExtraction); triggerHaptic("heavy");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Commit was blocked."); setConfirmCommit(false); }
    finally { setBusy(false); }
  }

  async function openHistory() {
    if (!selected) return;
    setBusy(true);
    try { setHistory(await getEvidenceHistory(selected.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Audit history could not be loaded."); }
    finally { setBusy(false); }
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setBusy(true);
    try { setSearchResults(await searchInvestigation(activeInvestigationId, searchQuery.trim())); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Search failed."); }
    finally { setBusy(false); }
  }

  async function createReport() {
    setBusy(true);
    try { setReport(await generateCaseBrief(activeInvestigationId, ["overview", "entities", "timeline", "locations", "evidence", "questions", "hypotheses", "conflicts"])); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Draft could not be generated."); }
    finally { setBusy(false); }
  }

  function openSearchResult(result: InvestigationSearchResult) {
    if (["map", "timeline", "network", "evidence"].includes(result.workspace)) setActiveWorkspace(result.workspace as "map" | "timeline" | "network" | "evidence");
    setSearchResults([]); setSearchQuery("");
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--paper)] p-3 font-mono text-[var(--ink)] md:p-4">
      <section className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col border-4 border-[var(--ink)] bg-[var(--panel)] shadow-[6px_6px_0_var(--ink)]">
        <header className="border-b-4 border-[var(--ink)] bg-[var(--paper)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="mb-2 inline-flex border-2 border-[var(--ink)] bg-[var(--accent)] px-2 py-1 text-[9px] font-black uppercase">Pilot / Demonstration feature</div><h2 className="font-serif text-[clamp(2rem,5vw,4.6rem)] font-black uppercase leading-[0.85]">Evidence Intake</h2><p className="mt-3 max-w-3xl text-[11px] font-bold uppercase opacity-70">Raw evidence → extraction candidates → investigator review → explicit case commit</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowUpload(true)} className="flex min-h-12 items-center gap-2 border-4 border-[var(--ink)] bg-[var(--accent)] px-4 text-xs font-black uppercase shadow-[4px_4px_0_var(--ink)]"><FileUp size={18} /> [ Upload evidence ]</button><button type="button" onClick={() => void createReport()} className="min-h-12 border-4 border-[var(--ink)] bg-[var(--panel)] px-4 text-xs font-black uppercase shadow-[4px_4px_0_var(--ink)]">[ Generate case brief ]</button></div>
          </div>
          <form onSubmit={runSearch} className="relative mt-5 max-w-3xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2" size={18} /><input aria-label="Search active investigation" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`SEARCH ${activeInvestigation.shortName} // ENTITIES, LOCATIONS, EVENTS, EVIDENCE, FACTS`} className="h-12 w-full border-4 border-[var(--ink)] bg-[var(--panel)] pl-10 pr-24 text-[10px] font-black uppercase shadow-[4px_4px_0_var(--ink)]" /><button className="absolute right-1 top-1 h-10 border-l-2 border-[var(--ink)] bg-[var(--ink)] px-4 text-[10px] font-black uppercase text-[var(--paper)]">Find</button></form>
          {searchResults.length ? <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto border-2 border-[var(--ink)] bg-[var(--panel)] p-2 sm:grid-cols-2 lg:grid-cols-3">{searchResults.map((result) => <button type="button" key={`${result.resultType}-${result.id}`} onClick={() => openSearchResult(result)} className="flex items-center gap-3 border-2 border-[var(--ink)] bg-[var(--paper)] p-3 text-left"><span className="text-[9px] font-black text-[var(--danger)]">{result.resultType}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] uppercase">{result.title}</strong><span className="block truncate text-[9px] opacity-60">{result.detail}</span></span><ChevronRight size={15} /></button>)}</div> : null}
        </header>

        {error ? <div role="alert" className="m-4 flex items-start justify-between gap-3 border-4 border-[var(--danger)] bg-[var(--paper)] p-3 text-xs font-black uppercase shadow-[4px_4px_0_var(--danger)]"><span>[ ACTION REQUIRED ] {error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={18} /></button></div> : null}

        <div className="grid min-h-0 flex-1 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b-4 border-[var(--ink)] p-3 xl:border-b-0 xl:border-r-4">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="min-w-0 font-serif text-xl font-black uppercase sm:text-2xl">Evidence register</h3><span className="shrink-0 border-2 border-[var(--ink)] px-2 py-1 text-[10px] font-black">{items.length.toString().padStart(2, "0")}</span></div>
            <div className="grid max-h-[42dvh] gap-3 overflow-y-auto pr-1 xl:max-h-[calc(100dvh-330px)]">
              {items.length === 0 ? <div className="border-2 border-dashed border-[var(--ink)] bg-[var(--paper)] p-6 text-center"><FileSearch className="mx-auto mb-3" /><p className="text-xs font-black uppercase">No evidence ingested</p><p className="mt-2 text-[10px] font-bold opacity-60">PDF · TXT · CSV · JSON · JPEG · PNG</p></div> : items.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setCommitResult(null); setHistory(null); }} className={`border-4 border-[var(--ink)] p-3 text-left transition-transform ${item.id === selectedId ? "bg-[var(--accent)] shadow-[4px_4px_0_var(--ink)]" : "bg-[var(--paper)] hover:-translate-y-0.5"}`}><div className="flex items-start justify-between gap-2"><strong className="text-sm uppercase">{item.displayId}</strong><StatusChip status={item.processingStatus} /></div><p className="mt-3 truncate text-[11px] font-black">{item.originalFilename}</p><p className="mt-1 text-[9px] font-bold uppercase opacity-60">{readable(item.sourceType)} // {Math.ceil(item.sizeBytes / 1024)} KB</p></button>)}
            </div>
            {investigationStatus ? <div className="mt-4 border-4 border-[var(--ink)] bg-[var(--paper)] p-3"><h4 className="font-serif text-xl font-black uppercase">Investigation status</h4><div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-black uppercase"><span>Verified entities <b className="block text-xl">{investigationStatus.verifiedEntities}</b></span><span>Supported links <b className="block text-xl">{investigationStatus.supportedLinks}</b></span><span>Hypotheses <b className="block text-xl">{investigationStatus.hypotheses}</b></span><span>Review queue <b className="block text-xl text-[var(--danger)]">{investigationStatus.pendingReview}</b></span></div>{investigationStatus.readinessItems.map((item) => <p key={item.type} className="mt-2 border-t-2 border-[var(--ink)] pt-2 text-[9px] font-black uppercase">⚠ {item.label}</p>)}</div> : null}
          </aside>

          <main className="min-w-0 p-3 sm:p-5">
            {!selected ? <div className="grid min-h-[460px] place-items-center overflow-hidden border-4 border-dashed border-[var(--ink)] bg-[var(--paper)] p-5 text-center sm:p-8"><div className="min-w-0"><Database className="mx-auto mb-4" size={42} /><h3 className="break-words font-serif text-2xl font-black uppercase sm:text-3xl">Select or upload evidence</h3><p className="mt-3 max-w-lg text-[10px] font-bold uppercase opacity-65">CrimeLens preserves raw material separately and never treats machine extraction as verified case data.</p></div></div> : <>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-serif text-3xl font-black uppercase">Evidence // {selected.displayId}</h3><StatusChip status={selected.processingStatus} /></div><p className="mt-1 text-[10px] font-black uppercase opacity-60">{readable(selected.sourceType)} // {selected.originalFilename}</p></div><button type="button" onClick={() => void openHistory()} className="flex min-h-11 items-center justify-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)]"><History size={16} /> View audit history</button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="border-2 border-[var(--ink)] bg-[var(--paper)] p-3"><p className="text-[9px] font-black uppercase opacity-55">File integrity hash</p><p className="mt-2 flex items-center gap-2 break-all text-[11px] font-black"><Fingerprint size={16} /> {shortHash(selected.sha256)}</p></div><div className="border-2 border-[var(--ink)] bg-[var(--paper)] p-3"><p className="text-[9px] font-black uppercase opacity-55">Uploaded by</p><p className="mt-2 text-[11px] font-black">{selected.uploadedBy}</p><p className="text-[9px] opacity-60">{selected.uploadedByName}</p></div><div className="border-2 border-[var(--ink)] bg-[var(--paper)] p-3"><p className="text-[9px] font-black uppercase opacity-55">Uploaded</p><p className="mt-2 text-[10px] font-black">{formatDate(selected.uploadedAt)}</p></div><div className="border-2 border-[var(--ink)] bg-[var(--paper)] p-3"><p className="text-[9px] font-black uppercase opacity-55">Input</p><p className="mt-2 text-[10px] font-black">{selected.mimeType}</p><p className="text-[9px] opacity-60">{selected.sizeBytes.toLocaleString()} BYTES</p></div></div>
              <div className="mt-4 border-4 border-[var(--ink)] bg-[var(--paper)] p-3"><p className="mb-3 text-[10px] font-black uppercase">Evidence processor // {processingStates.has(selected.processingStatus) ? "Active" : "Recorded"}</p><ProcessingRail status={selected.processingStatus} /></div>

              {selected.processingStatus === "FAILED" ? <div className="mt-4 border-4 border-[var(--danger)] bg-[var(--paper)] p-4"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-[var(--danger)]" /><div><h4 className="font-serif text-xl font-black uppercase">Content extraction failed</h4><p className="mt-1 text-[10px] font-bold">{selected.failureReason || "Manual review required."}</p></div></div><button type="button" disabled={busy} onClick={() => void retryEvidenceExtraction(selected.id).then(refreshItems).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Retry failed."))} className="mt-4 min-h-11 border-2 border-[var(--ink)] bg-[var(--accent)] px-4 text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)]">[ Retry extraction ]</button></div> : null}

              {extraction ? <section className="mt-5 border-4 border-[var(--ink)]"><div className="border-b-4 border-[var(--ink)] bg-[var(--paper)] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.16em]">AI output // unverified candidates</p><h4 className="font-serif text-3xl font-black uppercase">Extraction review</h4><p className="mt-1 text-[9px] font-bold uppercase opacity-60">{extraction.provider} // {extraction.modelIdentifier}</p></div><div className="flex flex-wrap gap-2">{Object.entries(extraction.counts).filter(([, count]) => count > 0).map(([label, count]) => <span key={label} className="border-2 border-[var(--ink)] bg-[var(--panel)] px-2 py-1 text-[9px] font-black uppercase">{readable(label)} {count}</span>)}</div></div></div>
                <div className="flex overflow-x-auto border-b-4 border-[var(--ink)] bg-[var(--paper)]">{reviewTabs.map((tab) => { const count = extraction.candidates.filter((candidate) => tab.id === "EVENTS" ? ["EVENT", "DATE_TIME"].includes(candidate.candidateType) : candidate.candidateType === tab.id).length; return <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`min-h-11 shrink-0 border-r-2 border-[var(--ink)] px-3 text-[9px] font-black uppercase ${activeTab === tab.id ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--panel)]"}`}>[ {tab.label} {count} ]</button>; })}</div>
                <div className="grid gap-3 bg-[var(--panel)] p-3 lg:grid-cols-2">{visibleCandidates.length === 0 ? <p className="col-span-full border-2 border-dashed border-[var(--ink)] bg-[var(--paper)] p-6 text-center text-[10px] font-black uppercase opacity-60">No candidates in this category</p> : visibleCandidates.map((candidate) => { const duplicate = candidate.candidatePayload.possibleDuplicate as Record<string, unknown> | undefined; const unresolvedDuplicate = duplicate?.resolutionStatus === "PENDING"; return <article key={candidate.id} className="border-4 border-[var(--ink)] bg-[var(--paper)] p-4 shadow-[3px_3px_0_var(--ink)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase text-[var(--danger)]">{readable(candidate.candidateType)} // Candidate</p><h5 className="mt-1 font-serif text-xl font-black uppercase">{candidateTitle(candidate)}</h5></div><StatusChip status={candidate.reviewStatus} /></div><p className="mt-3 text-[9px] font-black uppercase opacity-60">Source // {locatorLabel(candidate.candidatePayload)}</p>{candidate.candidatePayload.sourceText ? <blockquote className="mt-2 border-l-4 border-[var(--accent)] pl-3 text-[10px] font-bold leading-relaxed">“{String(candidate.candidatePayload.sourceText).slice(0, 260)}”</blockquote> : null}{duplicate ? <div className="mt-3 border-2 border-[var(--danger)] bg-[var(--panel)] p-3"><p className="text-[9px] font-black uppercase text-[var(--danger)]">Possible duplicate entity</p><p className="mt-1 text-[11px] font-black">EXISTING // {String(duplicate.existingLabel)}</p><p className="mt-1 text-[9px] font-bold uppercase">Basis // {Array.isArray(duplicate.basis) ? duplicate.basis.join(", ") : "deterministic identity signal"}</p>{unresolvedDuplicate ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void resolveDuplicate(candidate, "MERGE")} className="min-h-10 border-2 border-[var(--ink)] bg-[var(--accent)] px-3 text-[9px] font-black uppercase">[ Merge with existing ]</button><button type="button" disabled={busy} onClick={() => void resolveDuplicate(candidate, "CREATE_SEPARATE")} className="min-h-10 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-[9px] font-black uppercase">[ Create separate ]</button></div> : <p className="mt-2 text-[9px] font-black uppercase">Decision // {readable(String(duplicate.resolutionStatus))}</p>}</div> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || candidate.reviewStatus !== "PENDING" || unresolvedDuplicate} onClick={() => void review(candidate, "ACCEPTED")} className="min-h-10 border-2 border-[var(--ink)] bg-[var(--ink)] px-3 text-[9px] font-black uppercase text-[var(--paper)] disabled:opacity-35">[ Accept ]</button><button type="button" disabled={busy || candidate.reviewStatus === "REJECTED"} onClick={() => setEditing(candidate)} className="min-h-10 border-2 border-[var(--ink)] bg-[var(--accent)] px-3 text-[9px] font-black uppercase disabled:opacity-35">[ Edit ]</button><button type="button" disabled={busy || candidate.reviewStatus !== "PENDING"} onClick={() => void review(candidate, "REJECTED")} className="min-h-10 border-2 border-[var(--danger)] bg-[var(--paper)] px-3 text-[9px] font-black uppercase text-[var(--danger)] disabled:opacity-35">[ Reject ]</button></div></article>; })}</div>
                <footer className="border-t-4 border-[var(--ink)] bg-[var(--paper)] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="grid grid-cols-4 gap-3 text-center text-[9px] font-black uppercase"><span>Pending<b className="block text-xl">{pendingCount}</b></span><span>Accepted<b className="block text-xl">{reviewTotals.ACCEPTED ?? 0}</b></span><span>Edited<b className="block text-xl">{reviewTotals.EDITED_ACCEPTED ?? 0}</b></span><span>Rejected<b className="block text-xl">{reviewTotals.REJECTED ?? 0}</b></span></div><button type="button" disabled={busy || pendingCount > 0 || extraction.status === "APPROVED"} onClick={() => setConfirmCommit(true)} className="min-h-12 border-4 border-[var(--ink)] bg-[var(--accent)] px-5 text-xs font-black uppercase shadow-[4px_4px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40">[ Commit to investigation ]</button></div>{pendingCount > 0 ? <p className="mt-3 text-[9px] font-black uppercase text-[var(--danger)]">Review all {pendingCount} pending candidate(s) before commit.</p> : null}</footer>
              </section> : null}

              {commitResult ? <div className="mt-5 border-4 border-[var(--ink)] bg-[var(--accent)] p-5 shadow-[5px_5px_0_var(--ink)]"><div className="flex items-center gap-3"><ShieldCheck size={30} /><div><p className="text-[9px] font-black uppercase">Human-reviewed commit complete</p><h4 className="font-serif text-2xl font-black uppercase">Investigation updated</h4></div></div><div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase"><span>+ {commitResult.entitiesCreated} entities</span><span>+ {commitResult.entitiesMerged} merged</span><span>+ {commitResult.locationsCreated} locations</span><span>+ {commitResult.eventsCreated} events</span><span>+ {commitResult.relationshipsCreated} relationships</span></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setActiveWorkspace("map")} className="flex min-h-10 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-[9px] font-black uppercase"><MapPin size={15} /> View on map</button><button type="button" onClick={() => setActiveWorkspace("timeline")} className="flex min-h-10 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-[9px] font-black uppercase"><Clock3 size={15} /> View timeline</button><button type="button" onClick={() => setActiveWorkspace("network")} className="flex min-h-10 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-[9px] font-black uppercase"><Network size={15} /> Open graph</button></div></div> : null}
            </>}
          </main>
        </div>

        <footer className="grid border-t-4 border-[var(--ink)] bg-[var(--paper)] lg:grid-cols-2"><div className="border-b-4 border-[var(--ink)] p-4 lg:border-b-0 lg:border-r-4"><h3 className="font-serif text-xl font-black uppercase">Case activity</h3><div className="mt-3 space-y-2">{activity.slice(0, 5).map((event) => <p key={event.id} className="flex gap-3 text-[9px] font-bold uppercase"><span className="opacity-55">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="font-black">{readable(event.eventType)}</span><span className="ml-auto opacity-55">{event.agentId}</span></p>)}{activity.length === 0 ? <p className="text-[9px] font-bold uppercase opacity-55">No recorded activity for this session.</p> : null}</div></div><div className="p-4"><p className="text-[9px] font-black uppercase text-[var(--danger)]">Authority boundary</p><p className="mt-2 text-[11px] font-black uppercase leading-relaxed">CrimeLens structures candidates and provenance. The investigator remains the authority; AI output never updates case data directly.</p></div></footer>
      </section>

      {showUpload ? <UploadPanel investigationName={activeInvestigation.name} busy={busy} onClose={() => setShowUpload(false)} onUpload={handleUpload} /> : null}
      {editing ? <EditCandidatePanel candidate={editing} busy={busy} onClose={() => setEditing(null)} onSave={(payload) => void review(editing, "EDITED_ACCEPTED", payload)} /> : null}
      {confirmCommit && selected ? <div className="fixed inset-0 z-[175] grid place-items-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label="Confirm evidence commit"><div className="w-full max-w-lg border-4 border-[var(--ink)] bg-[var(--paper)] p-5 shadow-[7px_7px_0_var(--danger)]"><p className="text-[9px] font-black uppercase text-[var(--danger)]">Irreversible case-data mutation</p><h3 className="mt-1 font-serif text-3xl font-black uppercase">Commit reviewed data?</h3><p className="mt-4 text-[11px] font-bold leading-relaxed">This will add accepted candidates from {selected.displayId} to investigation // {activeInvestigation.name}. Rejected candidates remain in extraction history and will not be added.</p><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => setConfirmCommit(false)} className="min-h-12 border-2 border-[var(--ink)] bg-[var(--panel)] font-black uppercase">[ Cancel ]</button><button type="button" disabled={busy} onClick={() => void handleCommit()} className="min-h-12 border-4 border-[var(--ink)] bg-[var(--accent)] font-black uppercase shadow-[4px_4px_0_var(--ink)]">[ Commit ]</button></div></div></div> : null}
      {history ? <div className="fixed inset-0 z-[170] flex justify-end bg-black/60" role="dialog" aria-modal="true" aria-label="Evidence audit history"><aside className="h-full w-full max-w-lg overflow-y-auto border-l-4 border-[var(--ink)] bg-[var(--paper)] p-5 shadow-[-7px_0_0_var(--accent)]"><div className="flex items-start justify-between border-b-4 border-[var(--ink)] pb-4"><div><p className="text-[9px] font-black uppercase">Recorded actions</p><h3 className="font-serif text-3xl font-black uppercase">Evidence history</h3></div><button type="button" onClick={() => setHistory(null)} className="grid h-11 w-11 place-items-center border-2 border-[var(--ink)]"><X /></button></div><ol className="mt-5 space-y-3">{history.map((event) => <li key={event.id} className="border-4 border-[var(--ink)] bg-[var(--panel)] p-3"><p className="text-[9px] font-bold opacity-60">{formatDate(event.createdAt)}</p><p className="mt-1 text-xs font-black uppercase">{readable(event.eventType)}</p><p className="mt-1 text-[9px] font-bold uppercase">{event.agentId} // {event.resourceType}</p></li>)}</ol></aside></div> : null}
      {report ? <div className="fixed inset-0 z-[180] grid place-items-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label="AI-assisted case brief"><article className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto border-4 border-[var(--ink)] bg-[var(--paper)] p-5 shadow-[8px_8px_0_var(--accent)]"><div className="flex items-start justify-between border-b-4 border-[var(--ink)] pb-4"><div><StatusChip status="AI_ASSISTED_DRAFT" /><h3 className="mt-2 font-serif text-3xl font-black uppercase">{report.title}</h3><p className="text-[9px] font-bold uppercase opacity-60">Review draft before any export or final use</p></div><button type="button" onClick={() => setReport(null)} className="grid h-11 w-11 place-items-center border-2 border-[var(--ink)]"><X /></button></div><pre className="mt-5 whitespace-pre-wrap font-mono text-[11px] font-bold leading-relaxed">{report.content}</pre><button type="button" onClick={() => setReport(null)} className="mt-5 min-h-12 border-4 border-[var(--ink)] bg-[var(--accent)] px-5 font-black uppercase shadow-[4px_4px_0_var(--ink)]">[ Review draft complete ]</button></article></div> : null}
    </div>
  );
}
