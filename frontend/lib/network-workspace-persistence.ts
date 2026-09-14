import type { GraphWorkspace } from "@/lib/network-workspace-types";

/** Remap every reasoning-record ID; globally unique SQL keys cannot be reused. */
export function duplicateGraphWorkspace(workspace: GraphWorkspace): GraphWorkspace {
  const records = [workspace, ...workspace.nodes, ...workspace.edges, ...workspace.groups, ...workspace.questions, ...workspace.suggestions, ...workspace.conflicts, ...workspace.snapshots];
  const ids = new Map(records.map(record => [record.id, crypto.randomUUID()]));
  const copy = JSON.parse(JSON.stringify(workspace), (_key, value) => typeof value === "string" ? ids.get(value) ?? value : value) as GraphWorkspace;
  copy.name = `${workspace.name.slice(0, 115)} COPY`;
  copy.version = 1;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  return copy;
}
