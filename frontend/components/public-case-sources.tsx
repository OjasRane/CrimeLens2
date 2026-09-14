"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getInvestigation } from "@/data/investigations/registry";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function PublicCaseSources() {
  const activeInvestigationId = useInvestigationStore((state) => state.activeInvestigationId);
  const investigation = getInvestigation(activeInvestigationId);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const types = useMemo(() => Array.from(new Set(investigation.facts.map((fact) => fact.type))), [investigation]);
  const facts = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return investigation.facts.filter((fact) => {
      if (type !== "all" && fact.type !== type) return false;
      const haystack = `${fact.text} ${fact.sourceTitle} ${fact.sourceRef}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [investigation, query, type]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--paper)] font-mono text-[var(--ink)]">
      <header className="shrink-0 border-b-4 border-[var(--ink)] bg-[var(--panel)] p-3 md:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-60">Approved public dataset // Read only</p>
            <h2 className="font-serif text-2xl font-black uppercase md:text-3xl">Case Sources</h2>
          </div>
          <span className="border-2 border-[var(--ink)] bg-[var(--accent)] px-3 py-2 text-[10px] font-black uppercase shadow-[3px_3px_0_var(--ink)]">{facts.length} / {investigation.facts.length} records</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px]">
          <label className="flex min-h-11 items-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-3">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search case sources</span>
            <input aria-label="Search case sources" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH FACTS OR SOURCES…" className="min-w-0 flex-1 border-0 bg-transparent text-xs font-black uppercase outline-none" />
          </label>
          <label className="sr-only" htmlFor="public-source-type">Filter source type</label>
          <select id="public-source-type" value={type} onChange={(event) => setType(event.target.value)} className="min-h-11 border-2 border-[var(--ink)] bg-[var(--paper)] px-3 text-xs font-black uppercase">
            <option value="all">All record types</option>
            {types.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}
          </select>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-3 md:p-4">
        <table className="w-full min-w-[720px] border-collapse border-4 border-[var(--ink)] bg-[var(--panel)] text-left text-[10px]">
          <thead className="sticky top-0 z-10 bg-[var(--ink)] text-[var(--paper)]">
            <tr><th className="border-2 border-[var(--paper)] p-2 uppercase">Record</th><th className="w-36 border-2 border-[var(--paper)] p-2 uppercase">Status</th><th className="w-[34%] border-2 border-[var(--paper)] p-2 uppercase">Source</th></tr>
          </thead>
          <tbody>
            {facts.map((fact) => (
              <tr key={fact.id}>
                <td className="border-2 border-[var(--ink)] p-3 align-top"><span className="font-black uppercase">{fact.id} // {fact.type}</span><p className="mt-2 text-xs font-bold normal-case leading-relaxed">{fact.text}</p></td>
                <td className="border-2 border-[var(--ink)] p-3 align-top font-black uppercase">{fact.status}<br/><span className="opacity-60">{fact.confidence} / {fact.timePrecision}</span></td>
                <td className="break-words border-2 border-[var(--ink)] p-3 align-top"><strong className="block text-xs normal-case">{fact.sourceTitle}</strong><span className="mt-2 block break-all opacity-70">{fact.sourceRef}</span></td>
              </tr>
            ))}
            {facts.length === 0 ? <tr><td colSpan={3} className="p-8 text-center font-black uppercase">No matching case sources.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
