"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { FactLedger } from "@/components/fact-ledger";
import { GlobalStatusBar } from "@/components/global-status-bar";
import { WorkspaceBar } from "@/components/workspace-bar";
import { WorkspaceViewport } from "@/components/workspace-viewport";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function InvestigationWorkspace() {
  const { isLedgerOpen, toggleLedger } = useInvestigationStore();

  return (
    <div className="min-h-screen bg-[#F4F4F0] text-black">
      <header className="fixed left-0 top-0 z-20 flex h-20 w-full items-center justify-between border-b-4 border-black bg-[#F4F4F0] px-5 shadow-[0_4px_0_black] rounded-none">
        <div>
          <p className="font-mono text-xs uppercase tracking-normal">
            Case Desk / Hackathon Edition
          </p>
          <h1 className="font-serif text-3xl font-black leading-none md:text-5xl">
            The Fatal Ledger
          </h1>
        </div>
        <button
          type="button"
          onClick={toggleLedger}
          className="flex h-11 items-center gap-2 border-2 border-black bg-[#F4F4F0] px-3 font-mono text-xs uppercase shadow-[4px_4px_0_black] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none"
          aria-expanded={isLedgerOpen}
          aria-controls="fact-ledger"
        >
          {isLedgerOpen ? (
            <PanelRightClose aria-hidden="true" size={18} strokeWidth={2.5} />
          ) : (
            <PanelRightOpen aria-hidden="true" size={18} strokeWidth={2.5} />
          )}
          Ledger
        </button>
      </header>
      <WorkspaceBar />

      <main className="flex h-screen pb-8 pt-36">
        <section className="min-w-0 flex-1 border-r-4 border-black">
          <WorkspaceViewport />
        </section>

        <aside
          id="fact-ledger"
          className={`fixed right-0 top-36 z-30 h-[calc(100vh-9rem-2rem)] shrink-0 overflow-hidden border-l-4 border-black bg-[#F4F4F0] transition-[width] duration-300 ease-in-out rounded-none md:static md:h-full md:border-l-0 ${
            isLedgerOpen ? "w-[min(360px,100vw)] md:w-[360px]" : "w-0"
          }`}
        >
          <FactLedger />
        </aside>
      </main>

      <GlobalStatusBar />
    </div>
  );
}

