import type { Investigation } from "../data/investigations/types";
import type {
  EvidenceSupportStatus,
  GraphWorkspace,
  WorkspaceAnalysisResult,
  WorkspaceBasisReference,
  WorkspaceConflict,
  WorkspaceEdgeRecord,
  WorkspaceNodeRecord,
  WorkspacePathResult,
  WorkspaceSuggestion,
} from "./network-workspace-types";

type NodeSignals = {
  locationIds: Set<string>;
  eventIds: Set<string>;
  factIds: Set<string>;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function now() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function intersection<T>(left: Set<T>, right: Set<T>): T[] {
  return [...left].filter((value) => right.has(value));
}

function sourceId(node: WorkspaceNodeRecord): string | null {
  return (
    node.sourceEntityId ??
    node.sourceLocationId ??
    node.sourceEventId ??
    node.sourceFactId ??
    null
  );
}

function signalsForNode(
  node: WorkspaceNodeRecord,
  investigation: Investigation,
): NodeSignals {
  const entityIds = new Set<string>();
  const locationIds = new Set<string>();
  const eventIds = new Set<string>();
  const factIds = new Set<string>();

  if (node.sourceEntityId) entityIds.add(node.sourceEntityId);
  if (node.sourceLocationId) locationIds.add(node.sourceLocationId);
  if (node.sourceEventId) eventIds.add(node.sourceEventId);
  if (node.sourceFactId) factIds.add(node.sourceFactId);

  for (const event of investigation.timeline.events) {
    if (
      eventIds.has(event.id) ||
      event.linkedEntityIds.some((id) => entityIds.has(id)) ||
      event.linkedLocationIds.some((id) => locationIds.has(id))
    ) {
      eventIds.add(event.id);
      event.linkedLocationIds.forEach((id) => locationIds.add(id));
    }
  }
  for (const location of investigation.map.locations) {
    if (
      locationIds.has(location.id) ||
      location.linkedEntityIds.some((id) => entityIds.has(id))
    )
      locationIds.add(location.id);
  }
  for (const fact of investigation.facts) {
    if (
      factIds.has(fact.id) ||
      fact.linkedEntityIds.some((id) => entityIds.has(id)) ||
      fact.linkedLocationIds.some((id) => locationIds.has(id)) ||
      fact.linkedTimelineEventIds.some((id) => eventIds.has(id))
    )
      factIds.add(fact.id);
  }
  return { locationIds, eventIds, factIds };
}

export function findWorkspacePath(
  workspace: GraphWorkspace,
  fromNodeId: string,
  toNodeId: string,
  maxHops: number,
  relationshipTypes?: string[],
): WorkspacePathResult {
  if (fromNodeId === toNodeId)
    return { found: true, nodeIds: [fromNodeId], edgeIds: [], hops: 0 };
  const allowed = relationshipTypes?.length ? new Set(relationshipTypes) : null;
  const adjacency = new Map<
    string,
    Array<{ nodeId: string; edgeId: string }>
  >();
  for (const edge of workspace.edges) {
    if (allowed && !allowed.has(edge.relationshipType)) continue;
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      { nodeId: edge.target, edgeId: edge.id },
    ]);
    adjacency.set(edge.target, [
      ...(adjacency.get(edge.target) ?? []),
      { nodeId: edge.source, edgeId: edge.id },
    ]);
  }
  const queue: Array<{ nodeId: string; nodeIds: string[]; edgeIds: string[] }> =
    [{ nodeId: fromNodeId, nodeIds: [fromNodeId], edgeIds: [] }];
  const visited = new Set([fromNodeId]);
  while (queue.length) {
    const candidate = queue.shift()!;
    if (candidate.edgeIds.length >= maxHops) continue;
    for (const neighbor of adjacency.get(candidate.nodeId) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      const nodeIds = [...candidate.nodeIds, neighbor.nodeId];
      const edgeIds = [...candidate.edgeIds, neighbor.edgeId];
      if (neighbor.nodeId === toNodeId)
        return { found: true, nodeIds, edgeIds, hops: edgeIds.length };
      visited.add(neighbor.nodeId);
      queue.push({ nodeId: neighbor.nodeId, nodeIds, edgeIds });
    }
  }
  return { found: false, nodeIds: [], edgeIds: [], hops: 0 };
}

export function getNodeBasis(
  node: WorkspaceNodeRecord,
  investigation: Investigation,
): WorkspaceBasisReference[] {
  if (node.origin === "manual") {
    return [
      {
        id: node.id,
        resourceType: "analyst_note",
        label: "Manual investigator reasoning",
        verified: false,
      },
    ];
  }
  const references: WorkspaceBasisReference[] = [];
  if (node.sourceEntityId) {
    const entity = investigation.graph.nodes.find(
      (item) => item.id === node.sourceEntityId,
    );
    if (entity)
      references.push({
        id: entity.id,
        resourceType: "entity",
        label: entity.label,
        sourceRef: entity.sourceRef,
        verified: true,
      });
  }
  if (node.sourceLocationId) {
    const location = investigation.map.locations.find(
      (item) => item.id === node.sourceLocationId,
    );
    if (location)
      references.push({
        id: location.id,
        resourceType: "location",
        label: location.title,
        sourceRef: location.sourceRef,
        verified: true,
      });
  }
  if (node.sourceEventId) {
    const event = investigation.timeline.events.find(
      (item) => item.id === node.sourceEventId,
    );
    if (event)
      references.push({
        id: event.id,
        resourceType: "event",
        label: event.title,
        sourceRef: event.sourceRef,
        verified: true,
      });
  }
  if (node.sourceFactId) {
    const fact = investigation.facts.find(
      (item) => item.id === node.sourceFactId,
    );
    if (fact)
      references.push({
        id: fact.id,
        resourceType: "fact",
        label: fact.sourceTitle,
        sourceRef: fact.sourceRef,
        verified: fact.status === "verified",
      });
  }
  const signals = signalsForNode(node, investigation);
  for (const factId of signals.factIds) {
    if (references.some((reference) => reference.id === factId)) continue;
    const fact = investigation.facts.find((item) => item.id === factId);
    if (fact)
      references.push({
        id: fact.id,
        resourceType: "fact",
        label: fact.sourceTitle,
        sourceRef: fact.sourceRef,
        verified: fact.status === "verified",
      });
  }
  for (const eventId of signals.eventIds) {
    if (references.some((reference) => reference.id === eventId)) continue;
    const event = investigation.timeline.events.find(
      (item) => item.id === eventId,
    );
    if (event)
      references.push({
        id: event.id,
        resourceType: "event",
        label: event.title,
        sourceRef: event.sourceRef,
        verified: true,
      });
  }
  return references;
}

export function getEdgeBasis(
  edge: WorkspaceEdgeRecord,
  workspace: GraphWorkspace,
  investigation: Investigation,
): WorkspaceBasisReference[] {
  if (edge.basis?.length) return edge.basis;
  const source = workspace.nodes.find((node) => node.id === edge.source);
  const target = workspace.nodes.find((node) => node.id === edge.target);
  if (!source || !target) return [];
  const sourceSignals = signalsForNode(source, investigation);
  const targetSignals = signalsForNode(target, investigation);
  const factIds = intersection(sourceSignals.factIds, targetSignals.factIds);
  const eventIds = intersection(sourceSignals.eventIds, targetSignals.eventIds);
  const basis: WorkspaceBasisReference[] = [];
  for (const factId of factIds) {
    const fact = investigation.facts.find((item) => item.id === factId);
    if (fact)
      basis.push({
        id: fact.id,
        resourceType: "fact",
        label: fact.sourceTitle,
        sourceRef: fact.sourceRef,
        verified: fact.status === "verified",
      });
  }
  for (const eventId of eventIds) {
    const event = investigation.timeline.events.find(
      (item) => item.id === eventId,
    );
    if (event)
      basis.push({
        id: event.id,
        resourceType: "event",
        label: event.title,
        sourceRef: event.sourceRef,
        verified: true,
      });
  }
  if (!basis.length && edge.reason)
    basis.push({
      id: edge.id,
      resourceType: "analyst_note",
      label: edge.reason,
      verified: false,
    });
  return basis;
}

export function getEvidenceSupport(
  edge: WorkspaceEdgeRecord,
  workspace: GraphWorkspace,
  investigation: Investigation,
): {
  status: EvidenceSupportStatus;
  verifiedSources: number;
  analystNotes: number;
  conflicts: number;
} {
  const basis = getEdgeBasis(edge, workspace, investigation);
  const verifiedSources = unique(
    basis
      .filter((item) => item.verified)
      .map((item) => item.sourceRef ?? item.id),
  ).length;
  const analystNotes = basis.filter((item) => !item.verified).length;
  const conflicts = workspace.conflicts.filter(
    (conflict) =>
      conflict.status === "OPEN" &&
      [conflict.resourceAId, conflict.resourceBId].includes(edge.id),
  ).length;
  if (conflicts)
    return { status: "contradicted", verifiedSources, analystNotes, conflicts };
  if (edge.verificationStatus === "hypothesis" || verifiedSources === 0)
    return { status: "hypothesis", verifiedSources, analystNotes, conflicts };
  if (verifiedSources >= 2)
    return { status: "corroborated", verifiedSources, analystNotes, conflicts };
  if (verifiedSources === 1 && basis.length > 1)
    return { status: "supported", verifiedSources, analystNotes, conflicts };
  return { status: "single_source", verifiedSources, analystNotes, conflicts };
}

function buildSuggestion(
  source: WorkspaceNodeRecord,
  target: WorkspaceNodeRecord,
  reasonCodes: WorkspaceSuggestion["reasonCodes"],
  existing?: WorkspaceSuggestion,
): WorkspaceSuggestion {
  const signature = `suggestion:${[source.id, target.id].sort().join(":")}:${reasonCodes.slice().sort().join(":")}`;
  if (existing) return existing;
  const labels: Record<WorkspaceSuggestion["reasonCodes"][number], string> = {
    SHARED_LOCATION: "a shared location reference",
    TEMPORAL_OVERLAP: "overlapping timeline material",
    COMMON_EVIDENCE_REFERENCE: "common evidence",
    EXISTING_CASE_PATH: "an existing case relationship path",
  };
  return {
    id: newId(),
    signature,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    suggestedRelationship: "ASSOCIATED WITH",
    status: "PENDING",
    reasonCodes,
    explanation: `${source.label} and ${target.label} were flagged because the current case data contains ${reasonCodes.map((code) => labels[code]).join(", ")}. Review the basis before adding any hypothesis.`,
    signalStrength:
      reasonCodes.length >= 3
        ? "HIGH"
        : reasonCodes.length === 2
          ? "MEDIUM"
          : "LOW",
    createdAt: now(),
    reviewedAt: null,
  };
}

function conflictRecord(
  signature: string,
  type: WorkspaceConflict["conflictType"],
  a: Pick<WorkspaceConflict, "resourceAType" | "resourceAId">,
  b: Pick<WorkspaceConflict, "resourceBType" | "resourceBId">,
  explanation: string,
  existing?: WorkspaceConflict,
): WorkspaceConflict {
  return (
    existing ?? {
      id: newId(),
      signature,
      conflictType: type,
      ...a,
      ...b,
      status: "OPEN",
      explanation,
      createdAt: now(),
      reviewedAt: null,
    }
  );
}

function hasBoundedCasePath(
  investigation: Investigation,
  sourceId: string,
  targetId: string,
  maxHops = 2,
) {
  if (sourceId === targetId) return false;
  const adjacency = new Map<string, string[]>();
  for (const link of investigation.graph.links) {
    adjacency.set(link.source, [
      ...(adjacency.get(link.source) ?? []),
      link.target,
    ]);
    adjacency.set(link.target, [
      ...(adjacency.get(link.target) ?? []),
      link.source,
    ]);
  }
  const queue: Array<{ id: string; hops: number }> = [
    { id: sourceId, hops: 0 },
  ];
  const visited = new Set([sourceId]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.hops >= maxHops) continue;
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (neighbor === targetId) return true;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, hops: current.hops + 1 });
      }
    }
  }
  return false;
}

export function analyzeWorkspaceDeterministically(
  workspace: GraphWorkspace,
  investigation: Investigation,
): WorkspaceAnalysisResult {
  const connected = new Set(
    workspace.edges.flatMap((edge) => [
      `${edge.source}:${edge.target}`,
      `${edge.target}:${edge.source}`,
    ]),
  );
  const existingSuggestions = new Map(
    workspace.suggestions.map((item) => [item.signature, item]),
  );
  const suggestions: WorkspaceSuggestion[] = [];
  const signals = new Map(
    workspace.nodes.map((node) => [
      node.id,
      signalsForNode(node, investigation),
    ]),
  );
  for (let left = 0; left < workspace.nodes.length; left += 1) {
    for (let right = left + 1; right < workspace.nodes.length; right += 1) {
      const source = workspace.nodes[left];
      const target = workspace.nodes[right];
      if (connected.has(`${source.id}:${target.id}`)) continue;
      const sourceSignals = signals.get(source.id)!;
      const targetSignals = signals.get(target.id)!;
      const reasonCodes: WorkspaceSuggestion["reasonCodes"] = [];
      if (
        intersection(sourceSignals.locationIds, targetSignals.locationIds)
          .length
      )
        reasonCodes.push("SHARED_LOCATION");
      if (intersection(sourceSignals.eventIds, targetSignals.eventIds).length)
        reasonCodes.push("TEMPORAL_OVERLAP");
      if (intersection(sourceSignals.factIds, targetSignals.factIds).length)
        reasonCodes.push("COMMON_EVIDENCE_REFERENCE");
      if (
        source.sourceEntityId &&
        target.sourceEntityId &&
        hasBoundedCasePath(
          investigation,
          source.sourceEntityId,
          target.sourceEntityId,
        )
      )
        reasonCodes.push("EXISTING_CASE_PATH");
      if (!reasonCodes.length) continue;
      const signature = `suggestion:${[source.id, target.id].sort().join(":")}:${reasonCodes.slice().sort().join(":")}`;
      suggestions.push(
        buildSuggestion(
          source,
          target,
          reasonCodes,
          existingSuggestions.get(signature),
        ),
      );
    }
  }

  const existingConflicts = new Map(
    workspace.conflicts.map((item) => [item.signature, item]),
  );
  const conflicts: WorkspaceConflict[] = [];
  for (let left = 0; left < workspace.nodes.length; left += 1) {
    for (let right = left + 1; right < workspace.nodes.length; right += 1) {
      const a = workspace.nodes[left];
      const b = workspace.nodes[right];
      const aSource = sourceId(a);
      const bSource = sourceId(b);
      if (
        aSource &&
        aSource === bSource &&
        (a.type !== b.type ||
          a.label.trim().toLowerCase() !== b.label.trim().toLowerCase())
      ) {
        const signature = `attribute:${[a.id, b.id].sort().join(":")}`;
        conflicts.push(
          conflictRecord(
            signature,
            "ATTRIBUTE_CONFLICT",
            { resourceAType: "node", resourceAId: a.id },
            { resourceBType: "node", resourceBId: b.id },
            "Two workspace references to the same case record disagree on identity attributes. Review the imported data and any analyst edits.",
            existingConflicts.get(signature),
          ),
        );
        continue;
      }
      if (
        a.label.trim().toLowerCase() === b.label.trim().toLowerCase() &&
        aSource !== bSource
      ) {
        const signature = `duplicate:${[a.id, b.id].sort().join(":")}`;
        conflicts.push(
          conflictRecord(
            signature,
            "DUPLICATE_IDENTITY",
            { resourceAType: "node", resourceAId: a.id },
            { resourceBType: "node", resourceBId: b.id },
            `Potential duplicate identity: ${a.label} appears as separate workspace records.`,
            existingConflicts.get(signature),
          ),
        );
      }
    }
  }
  const eventNodes = workspace.nodes.flatMap((node) => {
    if (!node.sourceEventId) return [];
    const event = investigation.timeline.events.find(
      (item) => item.id === node.sourceEventId,
    );
    return event ? [{ node, event }] : [];
  });
  for (let left = 0; left < eventNodes.length; left += 1) {
    for (let right = left + 1; right < eventNodes.length; right += 1) {
      const a = eventNodes[left];
      const b = eventNodes[right];
      if (
        !intersection(
          new Set(a.event.linkedEntityIds),
          new Set(b.event.linkedEntityIds),
        ).length
      )
        continue;
      if (
        intersection(
          new Set(a.event.linkedLocationIds),
          new Set(b.event.linkedLocationIds),
        ).length
      )
        continue;
      const aTime = Date.parse(
        `${a.event.date}T${/^\d{2}:\d{2}$/.test(a.event.time) ? a.event.time : "00:00"}:00`,
      );
      const bTime = Date.parse(
        `${b.event.date}T${/^\d{2}:\d{2}$/.test(b.event.time) ? b.event.time : "00:00"}:00`,
      );
      const minutes = Math.round(Math.abs(aTime - bTime) / 60_000);
      if (!Number.isFinite(minutes) || minutes > 5) continue;
      const signature = `temporal:${[a.node.id, b.node.id].sort().join(":")}`;
      conflicts.push(
        conflictRecord(
          signature,
          "TEMPORAL_CONFLICT",
          { resourceAType: "node", resourceAId: a.node.id },
          { resourceBType: "node", resourceBId: b.node.id },
          `Potential timeline conflict: linked events occur at different locations ${minutes} minute${minutes === 1 ? "" : "s"} apart. Travel feasibility requires analyst review.`,
          existingConflicts.get(signature),
        ),
      );
    }
  }
  const ownershipEdges = workspace.edges.filter(
    (edge) =>
      edge.relationshipType === "OWNS" || edge.relationshipType === "MEMBER OF",
  );
  for (let left = 0; left < ownershipEdges.length; left += 1) {
    for (let right = left + 1; right < ownershipEdges.length; right += 1) {
      const a = ownershipEdges[left];
      const b = ownershipEdges[right];
      if (
        a.source === b.source &&
        a.target !== b.target &&
        a.verificationStatus === "verified" &&
        b.verificationStatus === "verified"
      ) {
        const signature = `relationship:${[a.id, b.id].sort().join(":")}`;
        conflicts.push(
          conflictRecord(
            signature,
            "RELATIONSHIP_CONFLICT",
            { resourceAType: "edge", resourceAId: a.id },
            { resourceBType: "edge", resourceBId: b.id },
            "Two verified records assign the same exclusive relationship to different targets. Review their sources.",
            existingConflicts.get(signature),
          ),
        );
      }
    }
  }
  for (const edge of workspace.edges) {
    const disputed = getEdgeBasis(edge, workspace, investigation).find(
      (basis) => basis.resourceType === "fact" && !basis.verified,
    );
    if (!disputed) continue;
    const signature = `source:${edge.id}:${disputed.id}`;
    conflicts.push(
      conflictRecord(
        signature,
        "SOURCE_DISAGREEMENT",
        { resourceAType: "edge", resourceAId: edge.id },
        { resourceBType: "fact", resourceBId: disputed.id },
        "A relationship basis includes a disputed or pending source record and requires analyst review.",
        existingConflicts.get(signature),
      ),
    );
  }

  return {
    provider: "deterministic",
    aiAvailable: false,
    suggestions,
    conflicts,
    analyzedNodeCount: workspace.nodes.length,
    analyzedEdgeCount: workspace.edges.length,
    evidenceReferenceCount: unique(
      workspace.nodes.flatMap((node) => [
        ...signalsForNode(node, investigation).factIds,
      ]),
    ).length,
  };
}
