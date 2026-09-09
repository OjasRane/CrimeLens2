"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PanelRightClose, PanelRightOpen, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CaseAccessTerminal } from "@/components/case-access-terminal";
import { FactLedger } from "@/components/fact-ledger";
import { GlobalStatusBar } from "@/components/global-status-bar";
import { InvestigationSwitcher } from "@/components/investigation-switcher";
import { LiveblocksRuntime } from "@/components/liveblocks-runtime";
import { MobileWorkspaceNav } from "@/components/mobile-workspace-nav";
import { QRUplinkModal } from "@/components/qr-uplink-modal";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceBar } from "@/components/workspace-bar";
import { WorkspaceViewport } from "@/components/workspace-viewport";
import { triggerHaptic } from "@/lib/haptics";
import { getInvestigation } from "@/data/investigations/registry";
import { useInvestigationStore } from "@/store/use-investigation-store";

export function InvestigationWorkspace() {
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  useInvestigationStore((state) => state.investigationRevision);
  const activeWorkspace = useInvestigationStore(
    (state) => state.activeWorkspace,
  );
  const isLedgerOpen = useInvestigationStore((state) => state.isLedgerOpen);
  const toggleLedger = useInvestigationStore((state) => state.toggleLedger);
  const toggleCommandPalette = useInvestigationStore(
    (state) => state.toggleCommandPalette,
  );
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileLedgerOpen, setIsMobileLedgerOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => setIsMobileLedgerOpen(false), [activeWorkspace]);

  const displayedLedgerOpen = isMobileViewport
    ? isMobileLedgerOpen
    : isLedgerOpen && activeWorkspace !== "evidence";

  function handleLedgerToggle() {
    if (isMobileViewport) {
      setIsMobileLedgerOpen((open) => {
        if (!open) triggerHaptic("light");
        return !open;
      });
      return;
    }

    toggleLedger();
  }

  return (
    <LiveblocksRuntime>
      <div className="h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-hidden bg-[var(--paper)] text-[var(--ink)] md:h-screen">
        <header className="fixed left-0 top-[env(safe-area-inset-top)] z-50 flex h-[7.25rem] w-full flex-col gap-2 overflow-visible border-b-4 border-[var(--ink)] bg-[var(--paper)] p-2 shadow-[0_4px_0_var(--ink)] rounded-none md:top-0 md:z-20 md:h-20 md:flex-row md:items-center md:justify-between md:pl-5 md:pr-28">
          <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 pr-24 md:block md:pr-0">
            <div className="min-w-0">
              <p className="hidden font-mono text-xs uppercase tracking-normal md:block">
                {activeInvestigation.deskLabel}
              </p>
              <h1 className="truncate whitespace-nowrap font-serif text-lg font-black leading-none md:text-[clamp(2rem,4vw,3rem)]">
                <span className="md:hidden">The Fatal Ledger</span>
                <span className="hidden md:inline">
                  {activeInvestigation.displayName}
                </span>
              </h1>
            </div>
            <div className="shrink-0 md:hidden">
              <InvestigationSwitcher />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:ml-auto md:flex-none md:gap-3">
            {activeWorkspace === "canvas" ? (
              <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
                <CaseAccessTerminal />
              </div>
            ) : (
              <div className="flex-1 md:hidden" />
            )}
            {activeWorkspace !== "evidence" ? <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                toggleCommandPalette();
              }}
              className="grid h-11 w-11 shrink-0 place-items-center border-2 border-[var(--ink)] bg-[var(--panel)] text-[var(--ink)] shadow-[3px_3px_0_var(--ink)] active:translate-x-1 active:translate-y-1 active:shadow-none md:hidden"
              aria-label="Open global intelligence search"
            >
              <Search aria-hidden="true" size={18} strokeWidth={3} />
            </button> : null}
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLedgerToggle}
              className="flex h-11 w-11 items-center justify-center gap-2 border-2 border-[var(--ink)] bg-[var(--paper)] px-0 font-mono text-xs uppercase shadow-[3px_3px_0_var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none rounded-none md:w-auto md:px-3 md:shadow-[4px_4px_0_var(--ink)]"
              aria-expanded={displayedLedgerOpen}
              aria-controls={
                isMobileViewport ? "fact-ledger-mobile" : "fact-ledger"
              }
              aria-label="Toggle fact ledger"
            >
              {displayedLedgerOpen ? (
                <PanelRightClose
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.5}
                />
              ) : (
                <PanelRightOpen
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.5}
                />
              )}
              <span className="hidden md:inline">Ledger</span>
            </button>
            <div className="hidden shrink-0 md:block">
              <InvestigationSwitcher />
            </div>
          </div>
        </header>
        <WorkspaceBar />

        <main className="flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col pb-16 pt-[7.25rem] md:h-screen md:flex-row md:pb-8 md:pt-36">
          <section className="min-h-0 min-w-0 flex-1 md:border-r-4 md:border-[var(--ink)]">
            <WorkspaceViewport />
          </section>

          <aside
            id="fact-ledger"
            className={`hidden h-full shrink-0 overflow-hidden bg-[var(--paper)] transition-[width] duration-300 ease-in-out md:block ${
              isLedgerOpen && activeWorkspace !== "evidence"
                ? "md:w-[clamp(280px,30vw,360px)]"
                : "md:w-0"
            }`}
          >
            {isLedgerOpen && activeWorkspace !== "evidence" ? <FactLedger /> : null}
          </aside>
        </main>

        <AnimatePresence>
          {isMobileLedgerOpen ? (
            <>
              <motion.button
                type="button"
                aria-label="Close fact ledger"
                className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4rem)] top-[calc(env(safe-area-inset-top)+7.25rem)] z-[75] bg-black/55 backdrop-blur-sm md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileLedgerOpen(false)}
              />
              <motion.aside
                id="fact-ledger-mobile"
                className="fixed bottom-[calc(env(safe-area-inset-bottom)+4rem)] right-0 top-[calc(env(safe-area-inset-top)+7.25rem)] z-[80] w-full overflow-hidden border-l-4 border-black bg-[#F4F4F0] shadow-[-4px_0_0_black] sm:w-[min(360px,92vw)] md:hidden dark:border-[#598392] dark:bg-[#01161E] dark:shadow-[-8px_0_24px_rgba(1,22,30,0.8)]"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => setIsMobileLedgerOpen(false)}
                  className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center border-2 border-black bg-white text-black shadow-[3px_3px_0_black] dark:border-[#598392] dark:bg-[#124559] dark:text-[#EFF6E0] dark:shadow-none"
                  aria-label="Close fact ledger"
                >
                  <X aria-hidden="true" size={20} strokeWidth={3} />
                </button>
                <FactLedger />
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <GlobalStatusBar />
        <MobileWorkspaceNav />
        <QRUplinkModal />
      </div>
    </LiveblocksRuntime>
  );
}
