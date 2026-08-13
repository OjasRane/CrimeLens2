"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import { gsap } from "gsap";
import { CaseReplayScene } from "@replay/CaseReplayScene";
import { ReplayControls } from "@replay/ReplayControls";
import { ReplayHUD } from "@replay/ReplayHUD";
import { ReplayTimeline } from "@replay/ReplayTimeline";
import { preloadReplayMap, ReplayGeospatialMap } from "@replay/components/ReplayGeospatialMap";
import { buildStoryScript } from "@replay/engine/buildStoryScript";
import { getCinematicBeat } from "@replay/engine/CinematicBeatController";
import { durationForEvent, representationLabel } from "@replay/engine/replayPresentation";
import { useReplayStateMachine } from "@replay/engine/replayStateMachine";
import { EVENT_SCENE_FAMILY } from "@replay/scenes/ReplaySceneFamilies";
import { DEFAULT_REPLAY_CASE_DATA } from "@replay/data/defaultReplayCaseData";
import type { ReplayCaseData } from "@replay/types";

export type CaseReplayProps = {
  caseData?: ReplayCaseData;
  initialEventId?: string;
  onExit: () => void;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

function LoadingScreen() {
  return (
    <div className="case-replay-loading" role="status" aria-live="polite">
      <div className="case-replay-loading-mark"><span /><span /><span /></div>
      <p>CRIMELENS / CASE ENGINE</p>
      <h2>Preparing Case Replay</h2>
      <ul>
        <li>Scenes <b>READY</b></li>
        <li>Evidence <b>INDEXED</b></li>
        <li>Locations <b>MAPPED</b></li>
        <li>Characters <b>STAGED</b></li>
      </ul>
    </div>
  );
}

export function CaseReplay({
  caseData = DEFAULT_REPLAY_CASE_DATA,
  initialEventId,
  onExit,
}: CaseReplayProps) {
  const [ready, setReady] = useState(false);
  const [summarySceneCleared, setSummarySceneCleared] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneCanvasRef = useRef<HTMLDivElement>(null);
  const sceneTransitionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const warmMap = () => preloadReplayMap();
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(warmMap, { timeout: 1600 });
      return () => idleWindow.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(warmMap, 320);
    return () => window.clearTimeout(timer);
  }, []);

  const story = useMemo(() => buildStoryScript(caseData), [caseData]);

  const eventDurations = useMemo(
    () => story.events.map((event) => reducedMotion ? 12000 : durationForEvent(event.sourceTimelineId)),
    [reducedMotion, story.events],
  );
  const machine = useReplayStateMachine(story.events.length, eventDurations);
  const initialJumpHandled = useRef(false);
  const activeEvent = story.events[machine.state.eventIndex] ?? story.events[0];
  const previousEvent = machine.state.eventIndex > 0 ? story.events[machine.state.eventIndex - 1] : undefined;
  const activeChapter =
    story.chapters.find((chapter) => chapter.id === activeEvent.chapterId) ??
    story.chapters[0];
  const activeView =
    activeEvent.viewSequence[machine.phaseIndex] ??
    activeEvent.viewSequence[0];
  const activeBeat = story.beats.find((beat) => beat.id === activeEvent.beatId) ?? story.beats[0];
  const cinematicBeat = getCinematicBeat(machine.progress);
  const activeFamily = EVENT_SCENE_FAMILY[activeEvent.sourceTimelineId];
  const previousFamily = previousEvent ? EVENT_SCENE_FAMILY[previousEvent.sourceTimelineId] : undefined;

  useEffect(() => {
    if (!initialEventId || initialJumpHandled.current) return;
    const index = story.events.findIndex(
      (event) => event.id === initialEventId || event.sourceTimelineId === initialEventId,
    );
    if (index >= 0) machine.jump(index);
    initialJumpHandled.current = true;
  }, [initialEventId, machine.jump, story.events]);

  useEffect(() => {
    if (machine.state.mode !== "summary") {
      setSummarySceneCleared(false);
      setSummaryVisible(false);
      return;
    }
    const clearScene = window.setTimeout(() => setSummarySceneCleared(true), reducedMotion ? 0 : 360);
    const revealSummary = window.setTimeout(() => setSummaryVisible(true), reducedMotion ? 0 : 720);
    return () => {
      window.clearTimeout(clearScene);
      window.clearTimeout(revealSummary);
    };
  }, [machine.state.mode, reducedMotion]);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), reducedMotion ? 100 : 720);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [reducedMotion]);

  useLayoutEffect(() => {
    if (!ready || !rootRef.current || reducedMotion) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        rootRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.55, ease: "power2.out" },
      );
    }, rootRef);
    return () => context.revert();
  }, [ready, reducedMotion]);

  useLayoutEffect(() => {
    if (!ready || !sceneTransitionRef.current || reducedMotion) return;
    gsap.killTweensOf(sceneTransitionRef.current);
    gsap.fromTo(
      sceneTransitionRef.current,
      { opacity: 0.16 },
      { opacity: 0, duration: 1.05, ease: "power2.out" },
    );
    if (sceneCanvasRef.current) {
      gsap.killTweensOf(sceneCanvasRef.current);
      gsap.fromTo(
        sceneCanvasRef.current,
        { opacity: 0.96 },
        { opacity: 1, duration: 1.05, ease: "power2.inOut" },
      );
    }
  }, [activeEvent.id, ready, reducedMotion]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onExit();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (machine.state.mode === "intro") machine.start();
        else machine.toggle();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        machine.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        machine.previous();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    machine.next,
    machine.previous,
    machine.start,
    machine.state.mode,
    machine.toggle,
    onExit,
  ]);

  if (!ready) {
    return (
      <div className="case-replay-root" role="dialog" aria-modal="true" aria-label="Preparing 3D Case Replay">
        <LoadingScreen />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="case-replay-root" data-mode={machine.state.mode} data-summary-cleared={summarySceneCleared} data-cinematic-stage={cinematicBeat.stage} data-family={activeFamily} role="dialog" aria-modal="true" aria-label="3D Case Replay">
      <div ref={sceneCanvasRef} className="case-replay-canvas" aria-hidden={machine.state.mode === "intro"}>
        <CaseReplayScene event={activeEvent} view={activeView} progress={machine.state.mode === "summary" ? 1 : machine.progress} reducedMotion={reducedMotion} finalPresentation={summarySceneCleared} />
      </div>
      {machine.state.mode !== "intro" && (
        <ReplayGeospatialMap active={activeFamily === "MUMBAI_CASE_MAP"} progress={machine.progress} eventId={activeEvent.sourceTimelineId} />
      )}
      <div ref={sceneTransitionRef} className="case-replay-scene-transition" aria-hidden="true" />
      <div className="case-replay-vignette" aria-hidden="true" />
      <div className="case-replay-scanlines" aria-hidden="true" />
      {(cinematicBeat.stage === "CLUE REVEAL" || cinematicBeat.stage === "CONSEQUENCE") && <div className="case-replay-attention-wash" aria-hidden="true" />}

      {machine.state.mode === "intro" && (
        <section className="case-replay-intro">
          <p>CRIMELENS / NARRATIVE PLAYBACK</p>
          <span className="case-replay-intro-rule" />
          <h1>{story.title}</h1>
          <p className="case-replay-intro-subtitle">{story.subtitle}</p>
          <dl>
            <div><dt>EVENTS</dt><dd>{story.events.length}</dd></div>
            <div><dt>DATE RANGE</dt><dd>{story.dateRange[0]} — {story.dateRange[1]}</dd></div>
            <div><dt>KEY ENTITIES</dt><dd>{story.entityCount}</dd></div>
            <div><dt>EVIDENCE</dt><dd>{story.evidenceCount}</dd></div>
          </dl>
          <div className="case-replay-intro-notice">
            Reconstructed from current case records. Facts, supported links, unverified items, and hypotheses remain explicitly labelled.
          </div>
          <button type="button" onClick={machine.start} autoFocus><Play size={19} fill="currentColor" /> BEGIN CASE REPLAY</button>
          <button type="button" className="case-replay-intro-exit" onClick={onExit}><X size={16} /> RETURN TO TIMELINE</button>
        </section>
      )}

      {(machine.state.mode === "playing" || machine.state.mode === "paused") && (
        <>
          <ReplayHUD
            event={activeEvent}
            previousEvent={previousEvent}
            eventIndex={machine.state.eventIndex}
            eventCount={story.events.length}
            chapter={activeChapter}
            chapterCount={story.chapters.length}
            beat={activeBeat}
            beatCount={story.beats.length}
            activeView={activeView}
            progress={machine.progress}
            mode={machine.state.mode}
          />
          {previousFamily && previousFamily !== activeFamily && machine.progress < 0.16 && (
            <div className="case-replay-mode-transition" aria-hidden="true">
              <span>CLUE MORPH / {previousEvent?.nextLead ?? previousEvent?.transitionCue}</span>
              <strong>{representationLabel(previousEvent?.currentView ?? activeView, previousFamily)} → {representationLabel(activeView, activeFamily)}</strong>
            </div>
          )}
          <div className="case-replay-bottom" data-cinematic={machine.state.mode === "playing"}>
            <ReplayTimeline events={story.events} beats={story.beats} currentIndex={machine.state.eventIndex} onJump={machine.jump} />
            <ReplayControls
              mode={machine.state.mode}
              speed={machine.state.speed}
              canPrevious={machine.state.eventIndex > 0}
              progress={machine.progress}
              onPrevious={machine.previous}
              onToggle={machine.toggle}
              onNext={machine.next}
              onSpeed={machine.setSpeed}
              onRestart={machine.restart}
              onExit={onExit}
            />
            <p className="case-replay-shortcuts">SPACE PLAY/PAUSE · ← → EVENTS · ESC EXIT</p>
          </div>
        </>
      )}

      {machine.state.mode === "summary" && summaryVisible && (
        <section className="case-replay-summary">
          <p>CASE REPLAY COMPLETE</p>
          <h2>Current record reviewed</h2>
          <div className="case-replay-summary-grid">
            <div><strong>{story.events.length}</strong><span>EVENTS PLAYED</span></div>
            <div><strong>{story.chapters.length}</strong><span>CHAPTERS</span></div>
            <div><strong>{story.evidenceCount}</strong><span>EVIDENCE REFERENCES</span></div>
          </div>
          <p className="case-replay-summary-note">
            This narrative is an investigative aid, not a guilt assessment. Confirmed facts, supported links, unverified records, and hypotheses require human review in their source modules.
          </p>
          <div className="case-replay-summary-actions">
            <button type="button" onClick={machine.restart}><RotateCcw size={18} /> RESTART</button>
            <button type="button" onClick={onExit}><X size={18} /> EXIT TO TIMELINE</button>
          </div>
        </section>
      )}
    </div>
  );
}
