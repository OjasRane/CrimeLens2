"use client";

import { ReplayContextRail } from "@replay/ReplayContextRail";
import type { ReplayMode } from "@replay/engine/replayStateMachine";
import { representationLabel } from "@replay/engine/replayPresentation";
import { EVENT_SCENE_FAMILY } from "@replay/scenes/ReplaySceneFamilies";
import type { ReplayBeat, ReplayChapter, ReplayEvent, ReplayView } from "@replay/types";

export function ReplayHUD({
  event,
  previousEvent,
  eventIndex,
  eventCount,
  chapter,
  chapterCount,
  beat,
  beatCount,
  activeView,
  progress,
  mode,
}: {
  event: ReplayEvent;
  previousEvent?: ReplayEvent;
  eventIndex: number;
  eventCount: number;
  chapter: ReplayChapter;
  chapterCount: number;
  beat: ReplayBeat;
  beatCount: number;
  activeView: ReplayView;
  progress: number;
  mode: ReplayMode;
}) {
  const statusClass = "case-replay-status case-replay-status-" + event.status.toLowerCase().replaceAll(" ", "-");
  const family = EVENT_SCENE_FAMILY[event.sourceTimelineId];
  const isChapterEnd = eventIndex === chapter.endIndex && progress >= 0.76;
  const openingEstablish = event.sourceTimelineId === "TL-001" && progress < 0.2;
  return (
    <div className="case-replay-hud" aria-live="polite">
      <section className="case-replay-chapter">
        {openingEstablish && <em>26/11 MUMBAI · INVESTIGATIVE RECONSTRUCTION</em>}
        <div><strong>CHAPTER {String(chapter.number).padStart(2, "0")} / {String(chapterCount).padStart(2, "0")}</strong></div>
        <p>{chapter.title}</p>
        <span>BEAT {String(beat.number).padStart(2, "0")} / {String(beatCount).padStart(2, "0")} · {beat.title}</span>
      </section>

      <div className="case-replay-current-view" aria-label={`Current view: ${representationLabel(activeView, family)}`}>
        <span>ANALYSIS MODE</span>
        <strong>{representationLabel(activeView, family)}</strong>
      </div>

      {!openingEstablish && <div className="case-replay-knowledge-mode" data-confirmed={Boolean(event.knowledgeLabel?.toLowerCase().includes("confirmed"))}>
        <span>INVESTIGATION KNOWLEDGE MODE</span>
        <strong>{event.knowledgeLabel ?? "Verified record only"}</strong>
      </div>}

      {!openingEstablish && <section className="case-replay-event-caption" data-expanded={mode === "paused"}>
        <div className="case-replay-event-caption-heading">
          <time dateTime={`${event.date}T${event.timestamp}`}>{event.timestamp}</time>
          <span>{event.category} · EVENT {String(eventIndex + 1).padStart(2, "0")} / {eventCount}</span>
        </div>
        <h2>{event.headline}</h2>
        <p className="case-replay-narration">“{event.narration}”</p>
        {mode === "paused" && (
          <div className="case-replay-badges">
            <span className={statusClass}>{event.status}</span>
            {event.evidence.slice(0, 2).map((item) => <span key={item.id}>EVD · {item.label}</span>)}
          </div>
        )}
        <p className="case-replay-transition-cue"><span>LEADS NEXT</span>{event.transitionCue}</p>
      </section>}

      {!openingEstablish && <ReplayContextRail event={event} previousEvent={previousEvent} progress={progress} mode={mode} chapter={chapter} isChapterEnd={isChapterEnd} />}
    </div>
  );
}
