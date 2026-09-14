export type TimelineLayoutEvent = {
  id: string;
  date: string;
  timestamp: number;
};

export type CompressedTimelineLayout = {
  positions: Map<string, number>;
  totalWidth: number;
  segments: { date: string; x: number; width: number; eventCount: number }[];
};

export const TIMELINE_CARD_WIDTH = 140;
export const TIMELINE_CARD_GAP = 20;
export const TIMELINE_CARD_LEFT = -46;

export function daysBetween(a: string, b: string): number {
  const msDay = 86400000;
  return Math.abs(
    (new Date(`${b}T00:00:00`).getTime() -
      new Date(`${a}T00:00:00`).getTime()) /
      msDay,
  );
}

/**
 * Places cards on one compressed chronological axis. Card spacing is calculated
 * in rendered pixels so dense same-day groups remain legible at every detail
 * zoom while calendar gaps retain the existing logarithmic compression.
 */
export function computeCompressedTimelineLayout(
  events: TimelineLayoutEvent[],
  zoomLevel: number,
): CompressedTimelineLayout {
  if (events.length === 0) {
    return { positions: new Map(), totalWidth: 0, segments: [] };
  }

  const detailZoom = Math.max(zoomLevel, 0.5);
  const renderedCardStep = Math.max(
    TIMELINE_CARD_WIDTH + TIMELINE_CARD_GAP,
    56 * detailZoom,
  );
  const eventNodeSpacing = renderedCardStep / detailZoom;
  const outerPadding = 64 / detailZoom;
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const dateGroups = new Map<string, TimelineLayoutEvent[]>();

  for (const event of sorted) {
    const existing = dateGroups.get(event.date) ?? [];
    existing.push(event);
    dateGroups.set(event.date, existing);
  }

  const dates = Array.from(dateGroups.keys()).sort();
  const positions = new Map<string, number>();
  const segments: CompressedTimelineLayout["segments"] = [];
  let cursor = outerPadding;

  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const group = dateGroups.get(date)!;
    const segmentWidth = group.length * eventNodeSpacing;

    group.forEach((event, eventIndex) => {
      positions.set(event.id, cursor + eventIndex * eventNodeSpacing);
    });
    segments.push({
      date,
      x: cursor,
      width: segmentWidth,
      eventCount: group.length,
    });
    cursor += segmentWidth;

    if (index < dates.length - 1) {
      const gap = daysBetween(date, dates[index + 1]);
      cursor +=
        gap <= 1 ? 32 : Math.min(60, 32 + Math.log2(gap) * 14);
    }
  }

  return {
    positions,
    totalWidth: cursor + outerPadding,
    segments,
  };
}

export function getTimelineCapabilities(access: {
  canWrite: boolean;
  canCollaborate: boolean;
}) {
  return {
    canInspectEvents: true,
    canAnnotate: access.canWrite,
    canUseMutationTools: access.canWrite,
    canCollaborate: access.canCollaborate,
  } as const;
}
