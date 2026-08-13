"use client";

import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import type { ReplayMode } from "@replay/engine/replayStateMachine";

export function ReplayControls({
  mode,
  speed,
  canPrevious,
  progress,
  onPrevious,
  onToggle,
  onNext,
  onSpeed,
  onRestart,
  onExit,
}: {
  mode: ReplayMode;
  speed: number;
  canPrevious: boolean;
  progress: number;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
  onSpeed: (speed: number) => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const playing = mode === "playing";
  return (
    <div className="case-replay-controls">
      <div className="case-replay-event-progress" aria-hidden="true"><span style={{ width: (progress * 100) + "%" }} /></div>
      <button type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="Previous event"><ChevronLeft size={18} /> <span>PREVIOUS</span></button>
      <button type="button" className="case-replay-play" onClick={onToggle} aria-label={playing ? "Pause replay" : "Play replay"}>
        {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />} <span>{playing ? "PAUSE" : "PLAY"}</span>
      </button>
      <button type="button" onClick={onNext} aria-label="Next event"><span>NEXT</span> <ChevronRight size={18} /></button>
      <label className="case-replay-speed">SPEED
        <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} aria-label="Playback speed">
          {[0.75, 1, 1.5, 2].map((value) => <option value={value} key={value}>{value}×</option>)}
        </select>
      </label>
      <button type="button" onClick={onRestart} aria-label="Restart replay"><RotateCcw size={17} /> <span>RESTART</span></button>
      <button type="button" className="case-replay-exit" onClick={onExit} aria-label="Exit replay"><X size={18} /> <span>EXIT REPLAY</span></button>
    </div>
  );
}
