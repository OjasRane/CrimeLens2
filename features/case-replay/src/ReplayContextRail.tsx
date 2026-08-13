"use client";

import type { ReplayChapter, ReplayEvent } from "@replay/types";
import type { ReplayMode } from "@replay/engine/replayStateMachine";
import { getCinematicBeat } from "@replay/engine/CinematicBeatController";
import { EVENT_PRESENTATION } from "@replay/engine/replayPresentation";

function confidenceFor(event: ReplayEvent) {
  if (event.status === "CONFIRMED FACT") return "HIGH";
  if (event.status === "SUPPORTED LINK") return "SUPPORTED";
  if (event.status === "UNVERIFIED") return "UNVERIFIED";
  return "HUMAN REVIEW";
}

export function ReplayContextRail({ event, previousEvent, progress, mode, chapter, isChapterEnd }: { event: ReplayEvent; previousEvent?: ReplayEvent; progress: number; mode: ReplayMode; chapter: ReplayChapter; isChapterEnd: boolean }) {
  const beat = getCinematicBeat(progress);
  const copy = EVENT_PRESENTATION[event.sourceTimelineId];
  const previous = previousEvent ? EVENT_PRESENTATION[previousEvent.sourceTimelineId] : undefined;
  const supporting = [event.location?.label, ...event.people.map((person) => `${person.name} / ${person.role}`), ...event.evidence.map((item) => item.label)]
    .filter((item, index, items): item is string => Boolean(item) && items.indexOf(item) === index)
    .slice(0, 4);
  const stageCopy = beat.stage === "ESTABLISH" && previous
    ? { label: "CLUE CARRY", title: previous.outgoingClue, detail: `Carries into ${copy?.clue ?? event.headline}` }
    : beat.stage === "ACTION"
      ? { label: "SUPPORTING CLUES", title: event.category, detail: copy?.detail ?? event.description }
      : beat.stage === "CLUE REVEAL"
        ? { label: "CLUE REVEAL", title: copy?.clue ?? event.headline, detail: copy?.detail ?? event.description }
        : beat.stage === "CONSEQUENCE"
          ? { label: "CONSEQUENCE", title: copy?.consequence ?? event.whyItMatters, detail: event.status }
          : { label: "HANDOFF", title: copy?.outgoingClue ?? event.transitionCue, detail: copy?.next ?? event.transitionCue };

  return (
    <aside className="case-replay-context-rail" aria-label="Current investigative context">
      <div className="case-replay-context-stage" key={`${event.id}-${beat.stage}`}>
        <span>{stageCopy.label}</span>
        <strong>{stageCopy.title}</strong>
        <p>{stageCopy.detail}</p>
      </div>
      {supporting.length > 0 && (
        <div className="case-replay-context-tray">
          <span>SUPPORTING RECORD</span>
          <ul>{supporting.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {mode === "paused" && (
        <div className="case-replay-freeze-inspector">
          <span>FREEZE + INSPECT</span>
          <dl>
            <div><dt>LOCATION</dt><dd>{event.location?.label ?? "No single location"}</dd></div>
            <div><dt>ENTITIES</dt><dd>{event.people.map((person) => person.name).join(", ") || "Record-led event"}</dd></div>
            <div><dt>EVIDENCE</dt><dd>{event.evidence.map((item) => item.label).join(", ") || "Timeline source"}</dd></div>
            <div><dt>LINKS</dt><dd>{event.relatedLinkIds.length} graph / {event.relatedNodeIds.length} nodes</dd></div>
          </dl>
        </div>
      )}
      {isChapterEnd && (
        <div className="case-replay-chapter-checkpoint">
          <span>CHAPTER CHECKPOINT</span>
          <p><b>Established</b>{chapter.established}</p>
          <p><b>Still unclear</b>{chapter.remainsUnclear}</p>
          <p><b>Next lead</b>{chapter.nextLead}</p>
        </div>
      )}
      <div className="case-replay-context-why">
        <span>WHY THIS MATTERS</span>
        <p>{event.whyItMatters}</p>
        <dl>
          <div><dt>SOURCE</dt><dd>{event.sourceTimelineId}</dd></div>
          <div><dt>CONFIDENCE</dt><dd>{confidenceFor(event)}</dd></div>
        </dl>
      </div>
    </aside>
  );
}
