import { describe, expect, it } from "vitest";
import {
  computeCompressedTimelineLayout,
  getTimelineCapabilities,
  TIMELINE_CARD_GAP,
  TIMELINE_CARD_WIDTH,
  type TimelineLayoutEvent,
} from "@/lib/timeline-analysis";

const denseEvents: TimelineLayoutEvent[] = [
  { id: "late", date: "2026-07-18", timestamp: 300 },
  { id: "early", date: "2026-07-18", timestamp: 100 },
  { id: "middle", date: "2026-07-18", timestamp: 200 },
  { id: "next-day", date: "2026-07-19", timestamp: 400 },
];

describe("timeline analysis consistency", () => {
  it.each([0.5, 1, 2, 3])(
    "keeps dense event cards readable at %sx zoom",
    (zoomLevel) => {
      const layout = computeCompressedTimelineLayout(denseEvents, zoomLevel);
      const renderedPositions = ["early", "middle", "late"].map(
        (id) => layout.positions.get(id)! * zoomLevel,
      );

      expect(renderedPositions).toEqual([...renderedPositions].sort((a, b) => a - b));
      expect(renderedPositions[1] - renderedPositions[0]).toBeGreaterThanOrEqual(
        TIMELINE_CARD_WIDTH + TIMELINE_CARD_GAP,
      );
      expect(renderedPositions[2] - renderedPositions[1]).toBeGreaterThanOrEqual(
        TIMELINE_CARD_WIDTH + TIMELINE_CARD_GAP,
      );
    },
  );

  it("keeps geometry stable when only the external theme changes", () => {
    const lightLayout = computeCompressedTimelineLayout(denseEvents, 1);
    const darkLayout = computeCompressedTimelineLayout(denseEvents, 1);

    expect([...darkLayout.positions]).toEqual([...lightLayout.positions]);
    expect(darkLayout.segments).toEqual(lightLayout.segments);
    expect(darkLayout.totalWidth).toBe(lightLayout.totalWidth);
  });

  it("allows public guests to inspect events without mutation access", () => {
    const capabilities = getTimelineCapabilities({
      canWrite: false,
      canCollaborate: false,
    });

    expect(capabilities.canInspectEvents).toBe(true);
    expect(capabilities.canAnnotate).toBe(false);
    expect(capabilities.canUseMutationTools).toBe(false);
    expect(capabilities.canCollaborate).toBe(false);
  });

  it("retains annotation and workspace mutations for authorized users", () => {
    const capabilities = getTimelineCapabilities({
      canWrite: true,
      canCollaborate: true,
    });

    expect(capabilities.canInspectEvents).toBe(true);
    expect(capabilities.canAnnotate).toBe(true);
    expect(capabilities.canUseMutationTools).toBe(true);
    expect(capabilities.canCollaborate).toBe(true);
  });
});
