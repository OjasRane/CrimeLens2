import { demoInvestigation } from "@/data/investigations/demo";
import { mumbai2611Investigation } from "@/data/investigations/mumbai2611";
import type {
  Investigation,
  InvestigationId,
} from "@/data/investigations/types";

export const investigationRegistry: Record<InvestigationId, Investigation> = {
  demo: demoInvestigation,
  "mumbai-2611": mumbai2611Investigation,
};

export const investigationOptions = [
  {
    id: "demo" as const,
    shortName: "DEMO CASE",
    description: "CrimeLens fictional demonstration",
  },
  {
    id: "mumbai-2611" as const,
    shortName: "MUMBAI 26/11",
    description: "Historical reconstruction // 26–29 NOV 2008",
  },
];

export function isInvestigationId(value: string): value is InvestigationId {
  return value === "demo" || value === "mumbai-2611";
}

export function getInvestigation(id: InvestigationId): Investigation {
  return investigationRegistry[id] ?? investigationRegistry.demo;
}

export function replaceInvestigation(investigation: Investigation) {
  validateInvestigation(investigation);
  investigationRegistry[investigation.id] = investigation;
}

export function getCaseTotals(investigation: Investigation) {
  return investigation.casualtyLedger.reduce(
    (totals, record) => ({
      killed: totals.killed + record.killed,
      injured: totals.injured + record.injured,
    }),
    { killed: 0, injured: 0 },
  );
}

export function getEventsForEntity(
  investigation: Investigation,
  entityId: string,
) {
  return investigation.timeline.events.filter((event) =>
    event.linkedEntityIds.includes(entityId),
  );
}

export function getLocationsForEntity(
  investigation: Investigation,
  entityId: string,
) {
  return investigation.map.locations.filter((location) =>
    location.linkedEntityIds.includes(entityId),
  );
}

export function getEntitiesForLocation(
  investigation: Investigation,
  locationId: string,
) {
  return (
    investigation.map.locations.find((location) => location.id === locationId)
      ?.linkedEntityIds ?? []
  );
}

export function getEvidenceForEntity(
  investigation: Investigation,
  entityId: string,
) {
  return investigation.facts.filter(
    (fact) =>
      fact.linkedEntityIds.includes(entityId) ||
      fact.linkedLocationIds.includes(entityId),
  );
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[INVESTIGATION DATA INVALID] ${message}`);
  }
}

function validateSourceMetadata(
  item: { sourceRef: string; timePrecision: string; confidence: string },
  label: string,
) {
  invariant(item.sourceRef.trim().length > 0, `${label} is missing sourceRef`);
  invariant(item.timePrecision.length > 0, `${label} is missing timePrecision`);
  invariant(item.confidence.length > 0, `${label} is missing confidence`);
}

export function validateInvestigation(investigation: Investigation) {
  validateSourceMetadata(investigation, investigation.id);

  const containedObjects = [
    ...investigation.map.locations,
    ...investigation.map.routes,
    ...investigation.graph.nodes,
    ...investigation.graph.links,
    ...investigation.timeline.events,
    ...investigation.casualtyLedger,
    ...investigation.facts,
  ];

  for (const item of containedObjects) {
    invariant(
      item.investigationId === investigation.id,
      `${"id" in item ? item.id : "object"} leaked into ${investigation.id}`,
    );
    validateSourceMetadata(item, "id" in item ? item.id : investigation.id);
  }

  const graphNodeIds = new Set(investigation.graph.nodes.map((node) => node.id));
  for (const link of investigation.graph.links) {
    invariant(graphNodeIds.has(link.source), `${link.id} has unknown source`);
    invariant(graphNodeIds.has(link.target), `${link.id} has unknown target`);
  }

  const locationIds = new Set(
    investigation.map.locations.map((location) => location.id),
  );
  for (const record of investigation.casualtyLedger) {
    invariant(
      locationIds.has(record.locationId),
      `${record.id} references unknown location`,
    );
  }

  for (const location of investigation.map.locations) {
    invariant(
      Boolean(location.coordinates) ||
        location.coordinateStatus === "NEEDS_VERIFICATION",
      `${location.id} has neither coordinates nor NEEDS_VERIFICATION`,
    );
  }

  for (const event of investigation.timeline.events) {
    invariant(event.sourceRef.length > 0, `${event.id} is missing sourceRef`);
    if (event.time.includes("≈") || event.time.startsWith(">")) {
      invariant(
        event.timePrecision !== "EXACT",
        `${event.id} displays an approximate time as EXACT`,
      );
    }
  }

  if (investigation.id === "mumbai-2611") {
    const totals = getCaseTotals(investigation);
    invariant(totals.killed === 166, `Mumbai killed total is ${totals.killed}`);
    invariant(totals.injured === 238, `Mumbai injured total is ${totals.injured}`);

    const attackers = investigation.graph.nodes.filter(
      (node) => node.kind === "attacker",
    );
    invariant(attackers.length === 10, `Mumbai attacker count is ${attackers.length}`);
    invariant(
      attackers.filter((node) => node.status === "CAPTURED").length === 1,
      "Mumbai data must have exactly one captured attacker",
    );
    invariant(
      investigation.timeline.events.every(
        (event) => event.timezone === "Asia/Kolkata",
      ),
      "Mumbai timeline must use Asia/Kolkata",
    );
    invariant(
      investigation.verifiedTotals?.peopleKilled === totals.killed &&
        investigation.verifiedTotals?.peopleInjured === totals.injured,
      "Mumbai verified metadata totals do not match the casualty ledger",
    );
  }

  return investigation;
}

validateInvestigation(demoInvestigation);
validateInvestigation(mumbai2611Investigation);
