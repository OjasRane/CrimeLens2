import { describe, expect, it } from "vitest";
import type { Investigation } from "../data/investigations/types";
import {
  analyzeWorkspaceDeterministically,
  findWorkspacePath,
  getEvidenceSupport,
} from "./network-workspace-intelligence";
import {
  createBlankWorkspace,
  type GraphWorkspace,
  type WorkspaceNodeRecord,
} from "./network-workspace-types";

function node(id: string, label: string, x = 0): WorkspaceNodeRecord {
  return {
    id,
    type: "person",
    label,
    origin: "manual",
    verificationStatus: "manual",
    intelligenceOrigin: "INVESTIGATOR_CREATED",
    description: "",
    position: { x, y: 0 },
  };
}

function fixtureInvestigation(): Investigation {
  return {
    graph: {
      nodes: [
        { id: "entity-1", label: "SUBJECT A", sourceRef: "CASE-ENTITY-1" },
      ],
      links: [],
      filters: [],
    },
    map: {
      locations: [],
      routes: [],
      filterGroups: [],
      center: [0, 0],
      zoom: 1,
      boundsLabel: "TEST",
    },
    timeline: { startDate: "2026-01-01", endDate: "2026-01-02", events: [] },
    facts: [
      {
        id: "fact-1",
        sourceTitle: "CALL RECORD 23",
        sourceRef: "CASE-FACT-1",
        status: "verified",
        text: "Linked call record",
        linkedEntityIds: ["entity-1"],
        linkedLocationIds: [],
        linkedTimelineEventIds: [],
      },
    ],
  } as unknown as Investigation;
}

describe("network workspace intelligence", () => {
  it("finds the shortest documented path within a bounded hop count", () => {
    const workspace: GraphWorkspace = {
      ...createBlankWorkspace("demo"),
      nodes: [
        node("00000000-0000-0000-0000-000000000001", "A"),
        node("00000000-0000-0000-0000-000000000002", "B"),
        node("00000000-0000-0000-0000-000000000003", "C"),
      ],
      edges: [
        {
          id: "10000000-0000-0000-0000-000000000001",
          source: "00000000-0000-0000-0000-000000000001",
          target: "00000000-0000-0000-0000-000000000002",
          relationshipType: "CONTACTED",
          label: "CONTACTED",
          confidence: "medium",
          verificationStatus: "manual",
        },
        {
          id: "10000000-0000-0000-0000-000000000002",
          source: "00000000-0000-0000-0000-000000000002",
          target: "00000000-0000-0000-0000-000000000003",
          relationshipType: "LOCATED AT",
          label: "LOCATED AT",
          confidence: "medium",
          verificationStatus: "manual",
        },
      ],
    };
    expect(
      findWorkspacePath(
        workspace,
        workspace.nodes[0].id,
        workspace.nodes[2].id,
        2,
      ),
    ).toEqual({
      found: true,
      nodeIds: workspace.nodes.map((item) => item.id),
      edgeIds: workspace.edges.map((item) => item.id),
      hops: 2,
    });
    expect(
      findWorkspacePath(
        workspace,
        workspace.nodes[0].id,
        workspace.nodes[2].id,
        1,
      ).found,
    ).toBe(false);
  });

  it("suggests only transparent relationships supported by shared case signals", () => {
    const investigation = fixtureInvestigation();
    const fact = investigation.facts.find(
      (item) => item.linkedEntityIds.length > 0,
    )!;
    const entity = investigation.graph.nodes.find(
      (item) => item.id === fact.linkedEntityIds[0],
    )!;
    const workspace: GraphWorkspace = {
      ...createBlankWorkspace("demo"),
      nodes: [
        {
          ...node("00000000-0000-0000-0000-000000000011", entity.label),
          origin: "investigation",
          verificationStatus: "verified",
          sourceEntityId: entity.id,
          intelligenceOrigin: "CASE_DATABASE",
        },
        {
          ...node("00000000-0000-0000-0000-000000000012", fact.sourceTitle),
          type: "evidence",
          origin: "investigation",
          verificationStatus: "verified",
          sourceFactId: fact.id,
          intelligenceOrigin: "CASE_DATABASE",
        },
      ],
    };
    const result = analyzeWorkspaceDeterministically(workspace, investigation);
    expect(result.provider).toBe("deterministic");
    expect(result.aiAvailable).toBe(false);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].reasonCodes).toContain(
      "COMMON_EVIDENCE_REFERENCE",
    );
    expect(workspace.edges).toHaveLength(0);
  });

  it("uses an existing authoritative case path as a deterministic signal", () => {
    const investigation = fixtureInvestigation();
    investigation.graph.nodes.push({
      id: "entity-2",
      label: "SUBJECT B",
    } as never);
    investigation.graph.links.push({
      source: "entity-1",
      target: "entity-2",
    } as never);
    const workspace: GraphWorkspace = {
      ...createBlankWorkspace("demo"),
      nodes: [
        {
          ...node("00000000-0000-0000-0000-000000000031", "A"),
          sourceEntityId: "entity-1",
        },
        {
          ...node("00000000-0000-0000-0000-000000000032", "B"),
          sourceEntityId: "entity-2",
        },
      ],
    };

    const result = analyzeWorkspaceDeterministically(workspace, investigation);

    expect(result.suggestions[0].reasonCodes).toContain("EXISTING_CASE_PATH");
  });

  it("flags divergent workspace copies of one source as an attribute conflict", () => {
    const investigation = fixtureInvestigation();
    const workspace: GraphWorkspace = {
      ...createBlankWorkspace("demo"),
      nodes: [
        {
          ...node("00000000-0000-0000-0000-000000000041", "Original"),
          sourceEntityId: "entity-1",
        },
        {
          ...node("00000000-0000-0000-0000-000000000042", "Edited"),
          sourceEntityId: "entity-1",
        },
      ],
    };

    const result = analyzeWorkspaceDeterministically(workspace, investigation);

    expect(result.conflicts.map((item) => item.conflictType)).toContain(
      "ATTRIBUTE_CONFLICT",
    );
  });

  it("never reports unsupported analyst reasoning as verified evidence", () => {
    const investigation = fixtureInvestigation();
    const workspace: GraphWorkspace = {
      ...createBlankWorkspace("demo"),
      nodes: [
        node("00000000-0000-0000-0000-000000000021", "A"),
        node("00000000-0000-0000-0000-000000000022", "B"),
      ],
      edges: [
        {
          id: "10000000-0000-0000-0000-000000000021",
          source: "00000000-0000-0000-0000-000000000021",
          target: "00000000-0000-0000-0000-000000000022",
          relationshipType: "ASSOCIATED WITH",
          label: "ASSOCIATED WITH",
          confidence: "hypothesis",
          verificationStatus: "hypothesis",
          reason: "Analyst working theory",
        },
      ],
    };
    expect(
      getEvidenceSupport(workspace.edges[0], workspace, investigation),
    ).toMatchObject({
      status: "hypothesis",
      verifiedSources: 0,
    });
  });
});
