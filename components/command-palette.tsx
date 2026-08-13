"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPin, QrCode, Radio, Search, UserRound, X } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ForceMapPanEvent } from "@/liveblocks.config";
import {
  getInvestigation,
  getLocationsForEntity,
} from "@/data/investigations/registry";
import { triggerHaptic } from "@/lib/haptics";
import { useBroadcastEvent } from "@/lib/liveblocks";
import { useInvestigationStore } from "@/store/use-investigation-store";

type TargetCategory = "SYSTEM ACTIONS" | "PERSONNEL" | "SECTORS" | "VEHICLES";

type IntelligenceTarget = {
  id: string;
  category: Exclude<TargetCategory, "SYSTEM ACTIONS">;
  type: "intelligence_target";
  label: string;
  detail: string;
  searchTerms: string[];
  coords: [number, number];
};

type SystemAction = {
  id: "sys-action-uplink";
  category: "SYSTEM ACTIONS";
  type: "system_action";
  label: string;
  detail: string;
  searchTerms: string[];
};

type CommandResult = IntelligenceTarget | SystemAction;

const TARGETS: CommandResult[] = [
  {
    id: "sys-action-uplink",
    category: "SYSTEM ACTIONS",
    type: "system_action",
    label: "DEPLOY FIELD AGENT (QR UPLINK)",
    detail: "GENERATE MOBILE ACCESS CHANNEL",
    searchTerms: ["deploy", "field", "agent", "qr", "uplink", "mobile"],
  },
  {
    id: "sus-ada",
    category: "PERSONNEL",
    type: "intelligence_target",
    label: "ADA CROSS",
    detail: "PRIMARY SUSPECT / WATCHLIST RED",
    searchTerms: ["agent", "cross", "suspect"],
    coords: [-87.6285, 41.884],
  },
  {
    id: "sus-marlowe",
    category: "PERSONNEL",
    type: "intelligence_target",
    label: "JON MARLOWE",
    detail: "PERSON OF INTEREST / ACTIVE TAIL",
    searchTerms: ["jon", "marlowe", "witness"],
    coords: [-87.632, 41.879],
  },
  {
    id: "sus-vale",
    category: "PERSONNEL",
    type: "intelligence_target",
    label: "MIRA VALE",
    detail: "FINANCIAL LINK / SURVEILLANCE",
    searchTerms: ["mira", "vale", "ledger"],
    coords: [-87.6231, 41.8822],
  },
  {
    id: "sec-platform-9",
    category: "SECTORS",
    type: "intelligence_target",
    label: "PLATFORM 9",
    detail: "LAST KNOWN SIGHTING / 21:14",
    searchTerms: ["station", "platform", "transit"],
    coords: [-87.641, 41.8866],
  },
  {
    id: "sec-evidence",
    category: "SECTORS",
    type: "intelligence_target",
    label: "EVIDENCE ANNEX",
    detail: "SECURITY BREACH / RESTRICTED",
    searchTerms: ["annex", "evidence", "room"],
    coords: [-87.6142, 41.8757],
  },
  {
    id: "sec-fulton",
    category: "SECTORS",
    type: "intelligence_target",
    label: "FULTON MARKET",
    detail: "SHELL TRANSFER RENDEZVOUS",
    searchTerms: ["fulton", "market", "drop"],
    coords: [-87.6501, 41.882],
  },
  {
    id: "sec-river-north",
    category: "SECTORS",
    type: "intelligence_target",
    label: "RIVER NORTH DINER",
    detail: "KNOWN CONTACT SITE / 24H",
    searchTerms: ["river", "north", "diner"],
    coords: [-87.6338, 41.8905],
  },
  {
    id: "veh-sable-07",
    category: "VEHICLES",
    type: "intelligence_target",
    label: "SABLE-07",
    detail: "BLACK SEDAN / IL 4KJ-118",
    searchTerms: ["sedan", "black", "4kj118"],
    coords: [-87.6465, 41.8786],
  },
  {
    id: "veh-ghost-12",
    category: "VEHICLES",
    type: "intelligence_target",
    label: "GHOST-12",
    detail: "WHITE PANEL VAN / PLATES CLONED",
    searchTerms: ["van", "white", "cloned"],
    coords: [-87.6209, 41.8895],
  },
  {
    id: "veh-signal-03",
    category: "VEHICLES",
    type: "intelligence_target",
    label: "SIGNAL-03",
    detail: "RED MOTORCYCLE / NO REGISTRY",
    searchTerms: ["motorcycle", "bike", "red"],
    coords: [-87.6117, 41.8724],
  },
];

const CATEGORIES: TargetCategory[] = [
  "SYSTEM ACTIONS",
  "PERSONNEL",
  "SECTORS",
  "VEHICLES",
];

type CommandPaletteProps = {
  broadcast?: (event: ForceMapPanEvent) => void;
};

function CommandPalette({ broadcast }: CommandPaletteProps) {
  const activeInvestigationId = useInvestigationStore(
    (state) => state.activeInvestigationId,
  );
  const activeInvestigation = getInvestigation(activeInvestigationId);
  const isOpen = useInvestigationStore((state) => state.isCommandPaletteOpen);
  const close = useInvestigationStore((state) => state.closeCommandPalette);
  const toggle = useInvestigationStore((state) => state.toggleCommandPalette);
  const setQrModalOpen = useInvestigationStore((state) => state.setQrModalOpen);
  const setActiveWorkspace = useInvestigationStore(
    (state) => state.setActiveWorkspace,
  );
  const setSelectedSuspectId = useInvestigationStore(
    (state) => state.setSelectedSuspectId,
  );
  const setSelectedEntityId = useInvestigationStore(
    (state) => state.setSelectedEntityId,
  );
  const setSelectedLocationId = useInvestigationStore(
    (state) => state.setSelectedLocationId,
  );
  const requestMapPan = useInvestigationStore((state) => state.requestMapPan);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const investigationTargets = useMemo<CommandResult[]>(() => {
    if (activeInvestigationId === "demo") return TARGETS;

    const systemAction = TARGETS[0];
    const locationTargets: IntelligenceTarget[] = activeInvestigation.map.locations
      .filter(
        (location): location is typeof location & { coordinates: [number, number] } =>
          Boolean(location.coordinates),
      )
      .map((location) => ({
        id: location.id,
        category: "SECTORS",
        type: "intelligence_target",
        label: location.title,
        detail: `${location.type} / ${location.timeLabel}`,
        searchTerms: [
          location.type,
          location.expandedName ?? "",
          location.alternativeLabel ?? "",
          location.description,
        ],
        coords: location.coordinates,
      }));
    const entityTargets: IntelligenceTarget[] = activeInvestigation.graph.nodes
      .filter((node) => node.kind !== "location")
      .flatMap((node) => {
        const firstLocation = getLocationsForEntity(
          activeInvestigation,
          node.id,
        ).find((location) => location.coordinates);
        if (!firstLocation?.coordinates) return [];
        return [
          {
            id: node.id,
            category: "PERSONNEL" as const,
            type: "intelligence_target" as const,
            label: node.label,
            detail: `${node.kind} / ${node.status ?? node.subtitle}`,
            searchTerms: [node.kind, node.subtitle, node.status ?? ""],
            coords: firstLocation.coordinates,
          },
        ];
      });

    return [systemAction, ...entityTargets, ...locationTargets];
  }, [activeInvestigation, activeInvestigationId]);

  const results = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return investigationTargets;

    return investigationTargets.filter((target) => {
      const haystack = [
        target.id,
        target.label,
        target.detail,
        ...target.searchTerms,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [investigationTargets, query]);

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === "k"
      ) {
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [toggle]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setHighlightedIndex(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    resultRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  const execute = (target: CommandResult, shouldBroadcast: boolean) => {
    if (target.type === "system_action" && target.id === "sys-action-uplink") {
      setQrModalOpen(true);
      close();
      return;
    }

    setActiveWorkspace("map");
    requestMapPan(target.coords, target.id);

    if (target.category === "PERSONNEL") {
      if (activeInvestigationId === "demo") {
        setSelectedSuspectId(target.id);
      } else {
        setSelectedEntityId(target.id);
      }
    } else if (target.category === "SECTORS") {
      setSelectedLocationId(target.id);
    }

    if (shouldBroadcast && broadcast) {
      triggerHaptic("heavy");
      broadcast({
        type: "FORCE_MAP_PAN",
        coordinates: target.coords,
        targetId: target.id,
      });
    }

    close();
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setHighlightedIndex(
        (current) => (current + direction + results.length) % results.length,
      );
      return;
    }

    if (event.key === "Enter" && results[highlightedIndex]) {
      event.preventDefault();
      execute(results[highlightedIndex], event.shiftKey);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="command-palette-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-0 backdrop-blur-md md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Global intelligence command palette"
            className="flex w-full max-w-[780px] flex-col overflow-hidden border-4 border-black bg-[#F4F4F0] font-mono text-black shadow-[4px_4px_0_black] max-md:fixed max-md:inset-0 max-md:h-full max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:shadow-none md:shadow-[8px_8px_0_black] dark:border dark:border-[#598392] dark:bg-[#01161E] dark:text-[#EFF6E0] dark:shadow-[inset_0_0_20px_rgba(174,195,176,0.16),0_0_20px_rgba(1,22,30,0.7)] dark:[text-shadow:0_0_7px_rgba(174,195,176,0.38)]"
            initial={{ opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between border-b-4 border-black px-5 py-3 dark:border-b dark:border-[#598392] dark:bg-[#124559]/45">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] sm:text-xs">
                <Radio
                  aria-hidden="true"
                  size={15}
                  className="fatal-command-radio"
                />
                Global intelligence index
              </div>
              <button
                type="button"
                onClick={close}
                className="grid h-11 w-11 place-items-center border-2 border-black hover:bg-black hover:text-[#F4F4F0] md:h-8 md:w-8 dark:border dark:border-[#598392] dark:text-[#AEC3B0] dark:hover:bg-[#AEC3B0] dark:hover:text-[#01161E]"
                aria-label="Close command palette"
              >
                <X aria-hidden="true" size={18} strokeWidth={3} />
              </button>
            </header>

            <div className="px-5 pt-5">
              <label htmlFor="global-intelligence-search" className="sr-only">
                Search intelligence records
              </label>
              <div className="flex items-center gap-3 border-b-4 border-black pb-3 dark:border-b dark:border-[#598392]">
                <Search
                  aria-hidden="true"
                  className="shrink-0"
                  size={28}
                  strokeWidth={3}
                />
                <input
                  ref={inputRef}
                  id="global-intelligence-search"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-palette-results"
                  aria-activedescendant={
                    results[highlightedIndex]
                      ? `command-result-${results[highlightedIndex].id}`
                      : undefined
                  }
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="QUERY TARGETS..."
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-black uppercase caret-black outline-none placeholder:text-black/35 focus:outline-none sm:text-4xl dark:caret-transparent dark:text-[#EFF6E0] dark:placeholder:text-[#598392]"
                />
                <span
                  aria-hidden="true"
                  className="fatal-terminal-cursor text-2xl leading-none dark:text-[#AEC3B0] sm:text-4xl"
                >
                  █
                </span>
              </div>

              <div className="flex items-center justify-between py-3 text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs">
                <span>
                  MATCHES FOUND: {String(results.length).padStart(2, "0")}
                </span>
                <span className="hidden opacity-60 sm:inline">
                  ↑↓ SELECT / ↵ OPEN / ⇧↵ BROADCAST
                </span>
              </div>
            </div>

            <div
              id="command-palette-results"
              role="listbox"
              className="fatal-command-results min-h-0 flex-1 overflow-y-auto border-t-2 border-black max-md:max-h-none md:max-h-[min(52vh,430px)] dark:border-t dark:border-[#598392]"
            >
              {results.length > 0 ? (
                CATEGORIES.map((category) => {
                  const categoryResults = results.filter(
                    (target) => target.category === category,
                  );
                  if (categoryResults.length === 0) return null;

                  return (
                    <section key={category} aria-label={category}>
                      <div className="sticky top-0 z-10 border-b-2 border-black bg-black px-5 py-2 text-[11px] font-black tracking-[0.2em] text-[#F4F4F0] dark:border-b dark:border-[#598392] dark:bg-[#124559] dark:text-[#AEC3B0]">
                        [ {category} ]
                      </div>
                      {categoryResults.map((target) => {
                        const resultIndex = results.indexOf(target);
                        const isHighlighted = resultIndex === highlightedIndex;
                        const Icon =
                          target.type === "system_action"
                            ? QrCode
                            : target.category === "PERSONNEL"
                              ? UserRound
                              : MapPin;

                        return (
                          <button
                            ref={(element) => {
                              resultRefs.current[resultIndex] = element;
                            }}
                            key={target.id}
                            id={`command-result-${target.id}`}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onMouseMove={() => setHighlightedIndex(resultIndex)}
                            onClick={() => execute(target, false)}
                            className={`flex min-h-11 w-full items-center gap-4 border-b-2 border-black px-5 py-3 text-left uppercase transition-none last:border-b-0 dark:border-b dark:border-[#598392]/60 ${
                              isHighlighted
                                ? "bg-black text-[#F4F4F0] dark:bg-[#AEC3B0] dark:text-[#01161E] dark:[text-shadow:none]"
                                : "bg-[#F4F4F0] hover:bg-black/10 dark:bg-[#01161E] dark:text-[#EFF6E0] dark:hover:bg-[#124559]"
                            }`}
                          >
                            <Icon
                              aria-hidden="true"
                              size={22}
                              strokeWidth={2.5}
                              className="shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black tracking-[0.12em] sm:text-base">
                                {target.label}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] font-bold opacity-65 sm:text-xs">
                                {target.detail}
                              </span>
                            </span>
                            <span className="hidden text-[10px] font-black opacity-60 sm:block">
                              {target.id.toUpperCase()}
                            </span>
                          </button>
                        );
                      })}
                    </section>
                  );
                })
              ) : (
                <div className="grid min-h-40 place-items-center px-6 text-center text-sm font-black uppercase tracking-[0.16em] opacity-60">
                  [ NO CORRELATED INTELLIGENCE ]
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t-4 border-black px-5 py-3 text-[10px] font-black uppercase tracking-[0.1em] dark:border-t dark:border-[#598392] dark:bg-[#124559]/35 dark:text-[#AEC3B0]">
              <span>
                {broadcast
                  ? "MULTIPLAYER UPLINK: ARMED"
                  : "MULTIPLAYER UPLINK: LOCAL MODE"}
              </span>
              <span>ESC ABORT / ⌘K TOGGLE</span>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function LocalCommandPalette() {
  return <CommandPalette />;
}

export function LiveCommandPalette() {
  const broadcast = useBroadcastEvent();
  return <CommandPalette broadcast={broadcast} />;
}
