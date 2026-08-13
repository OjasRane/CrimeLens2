import { DEFAULT_REPLAY_CASE_DATA } from "@replay/data/defaultReplayCaseData";
import type { ReplayCaseData, SourceEvidenceNode, SourceTimelineEvent } from "@replay/types";

export type ReplayCaseOverrides = Partial<Omit<ReplayCaseData, "timelineEvents" | "evidenceNodes">> & {
  timelineEvents?: SourceTimelineEvent[];
  evidenceNodes?: SourceEvidenceNode[];
};

export function buildReplayCase(overrides: ReplayCaseOverrides = {}): ReplayCaseData {
  return {
    ...DEFAULT_REPLAY_CASE_DATA,
    ...overrides,
    timelineEvents: overrides.timelineEvents ?? DEFAULT_REPLAY_CASE_DATA.timelineEvents,
    evidenceNodes: overrides.evidenceNodes ?? DEFAULT_REPLAY_CASE_DATA.evidenceNodes,
  };
}
