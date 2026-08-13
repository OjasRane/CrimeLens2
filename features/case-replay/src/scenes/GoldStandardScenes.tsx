"use client";

import { Html } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EvidenceWorkbench } from "@replay/components/EvidenceWorkbench";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import { ForensicLabKit, FORENSIC_LAB_KIT, StationKit, STATION_KIT, INVESTIGATION_ROOM_KIT } from "@replay/components/SceneEnvironment";
import { AnimatedConnector, FocusBeacon } from "@replay/components/SceneMotion";
import { CinematicHuman } from "@replay/entities/ReplayEntities";
import { CinematicBeatCamera, CinematicBeatController, CinematicReveal, type CinematicBeat } from "@replay/engine/CinematicBeatController";
import { RelationshipIntelligenceScene } from "@replay/scenes/RelationshipIntelligenceScene";
import { ScreenSpaceAnnotation } from "@replay/components/AnnotationLayoutManager";
import type { ReplayEvent } from "@replay/types";

// The original three prototypes remain available as reference implementations,
// but the Mumbai reconstruction routes every event through the shared families.
export const GOLD_STANDARD_EVENT_IDS = new Set<string>();

function BeatSlate({ beat }: { beat: CinematicBeat }) {
  void beat;
  return null;
}

function PlatformHumanScene({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const victimMotion = useRef<THREE.Group>(null);
  const action = beat.value("ACTION");
  const clue = beat.value("CLUE REVEAL");
  const consequence = beat.value("CONSEQUENCE");
  const transition = beat.value("TRANSITION");
  useFrame((_, delta) => {
    if (!victimMotion.current) return;
    const desired = new THREE.Vector3(-0.45 + action * 0.52, 0, 0.45 - action * 0.12);
    victimMotion.current.position.lerp(desired, reducedMotion ? 1 : 1 - Math.exp(-delta * 2.8));
  });
  const victim = event.people.find((person) => person.role === "victim") ?? event.people[0];
  const suspect = event.people.find((person) => person.role === "suspect") ?? event.people[1];
  return (
    <StationKit>
      <BeatSlate beat={beat} />
      {victim && <group ref={victimMotion} position={[-0.45, 0, 0.45]}><CinematicHuman person={victim} position={[0, 0, 0]} rotationY={-0.1} labelSide="left" active action="shortWalk" actionProgress={action} showLabel={consequence > 0.05} reducedMotion={reducedMotion} /></group>}
      {suspect && <CinematicReveal amount={beat.value("ESTABLISH")} reducedMotion={reducedMotion} position={[1.18, 0, -0.02]} from={[0.25, 0, -0.15]}><CinematicHuman person={suspect} position={[0, 0, 0]} rotationY={-0.34} labelSide="right" action="conversationIdle" actionProgress={action} showLabel={consequence > 0.05} reducedMotion={reducedMotion} /></CinematicReveal>}

      <AnimatedConnector points={[[3.35, 2.58, -2.88], [2.05, 2.12, -1.65], [0.2, 1.55, 0.24]]} color="#356edb" progress={clue} reducedMotion={reducedMotion} delay={0.05} opacity={0.9} />

      <FocusBeacon position={[0.05, 0.02, 0.34]} color="#d99a20" progress={consequence} reducedMotion={reducedMotion} radius={0.54} />

      <AnimatedConnector points={[[0.1, 1.58, 0.18], [0.2, 2.2, -1.45], [0.4, 2.82, -3.0], [2.45, 3.02, -3.2]]} color="#2baf83" progress={transition} reducedMotion={reducedMotion} delay={0.04} opacity={0.95} />
    </StationKit>
  );
}

function TornTicketScene({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  return (
    <ForensicLabKit>
      <BeatSlate beat={beat} />
      <EvidenceWorkbench event={event} beat={beat} reducedMotion={reducedMotion} />
    </ForensicLabKit>
  );
}

export function GoldStandardScene({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  return (
    <CinematicBeatController progress={progress}>
      {(beat) => {
        if (event.sourceTimelineId === "TL-002") return <><CinematicBeatCamera beat={beat} frames={INVESTIGATION_ROOM_KIT.cameraAnchors} reducedMotion={reducedMotion} /><BeatSlate beat={beat} /><RelationshipIntelligenceScene event={event} beat={beat} reducedMotion={reducedMotion} /></>;
        if (event.sourceTimelineId === "TL-003") return <><CinematicBeatCamera beat={beat} frames={FORENSIC_LAB_KIT.cameraAnchors} reducedMotion={reducedMotion} /><TornTicketScene event={event} beat={beat} reducedMotion={reducedMotion} /></>;
        return <><CinematicBeatCamera beat={beat} frames={STATION_KIT.cameraAnchors} reducedMotion={reducedMotion} /><PlatformHumanScene event={event} beat={beat} reducedMotion={reducedMotion} /></>;
      }}
    </CinematicBeatController>
  );
}
