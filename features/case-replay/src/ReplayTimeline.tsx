"use client";

import type { ReplayBeat, ReplayEvent } from "@replay/types";

export function ReplayTimeline({
  events,
  beats,
  currentIndex,
  onJump,
}: {
  events: ReplayEvent[];
  beats: ReplayBeat[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="case-replay-progress-strip" aria-label="Replay story progress">
      {beats.map((beat) => {
        const active = currentIndex >= beat.startIndex && currentIndex <= beat.endIndex;
        const complete = currentIndex > beat.endIndex;
        const firstEvent = events[beat.startIndex];
        const eventPosition = active ? currentIndex - beat.startIndex + 1 : 1;
        const eventCount = beat.endIndex - beat.startIndex + 1;

        return (
          <button
            type="button"
            key={beat.id}
            onClick={() => onJump(beat.startIndex)}
            data-state={complete ? "complete" : active ? "current" : "upcoming"}
            title={`Beat ${beat.number}: ${beat.title}. ${eventCount} event${eventCount === 1 ? "" : "s"}; begins ${firstEvent?.timestamp ?? ""}.`}
            aria-label={`Jump to story beat ${beat.number}: ${beat.title}`}
            aria-current={active ? "step" : undefined}
          >
            <span>{String(beat.number).padStart(2, "0")}</span>
            <small>{beat.title}{active && eventCount > 1 ? ` · ${eventPosition}/${eventCount}` : ""}</small>
            <i aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
