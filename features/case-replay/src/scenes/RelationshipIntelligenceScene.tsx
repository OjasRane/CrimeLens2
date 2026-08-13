"use client";

import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InvestigationCard, type InvestigationCardTone } from "@replay/components/InvestigationCard";
import { InvestigationRoomKit } from "@replay/components/SceneEnvironment";
import { AnimatedConnector, FocusBeacon } from "@replay/components/SceneMotion";
import { CinematicReveal, type CinematicBeat } from "@replay/engine/CinematicBeatController";
import type { ReplayEvent } from "@replay/types";
import { ScreenSpaceAnnotation, type AnnotationLane } from "@replay/components/AnnotationLayoutManager";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";

function IntelligencePanel({
  position,
  title,
  eyebrow,
  metadata,
  tone,
  primary = false,
  amount,
  reducedMotion,
  priority = 60,
  lanes = ["TOP_RIGHT", "RIGHT", "TOP"],
}: {
  position: [number, number, number];
  title: string;
  eyebrow: string;
  metadata: string;
  tone: InvestigationCardTone;
  primary?: boolean;
  amount: number;
  reducedMotion: boolean;
  priority?: number;
  lanes?: AnnotationLane[];
}) {
  const width = primary ? 2.35 : 1.72;
  const height = primary ? 1.2 : 0.9;
  return (
    <CinematicReveal amount={amount} reducedMotion={reducedMotion} position={position} from={[0, -0.16, -0.24]}>
      <mesh position={[0, 0, -0.075]} castShadow><boxGeometry args={[width + 0.1, height + 0.1, 0.08]} /><meshStandardMaterial color={crimeLens3DTheme.edges.documentStrong} roughness={0.72} /></mesh>
      <mesh position={[0, 0, -0.015]} castShadow><boxGeometry args={[width, height, 0.08]} /><meshStandardMaterial {...crimeLens3DTheme.materials.paper} /></mesh>
      {primary && <mesh position={[0, height * 0.48, 0.035]}><boxGeometry args={[width * 0.9, 0.055, 0.025]} /><meshBasicMaterial color={crimeLens3DTheme.colors.evidenceYellow} /></mesh>}
      <mesh position={[-width * 0.47, 0, 0.02]}><boxGeometry args={[0.08, height * 0.82, 0.02]} /><meshBasicMaterial color={tone === "call" ? "#356edb" : tone === "location" ? "#2baf83" : tone === "evidence" ? "#d99a20" : "#8d8780"} /></mesh>
      <Html transform center position={[0.05, 0, 0.03]} distanceFactor={8.6} style={{ pointerEvents: "none" }}><div className="case-replay-spatial-card"><InvestigationCard eyebrow={eyebrow} title={title} metadata={metadata} tone={tone} primary={primary} /></div></Html>
    </CinematicReveal>
  );
}

export function RelationshipIntelligenceScene({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const pulse = useRef<THREE.Group>(null);
  const action = beat.value("ACTION");
  const clue = beat.value("CLUE REVEAL");
  const consequence = beat.value("CONSEQUENCE");
  const transition = beat.value("TRANSITION");
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const travel = reducedMotion ? action : (clock.getElapsedTime() * 0.34) % 1;
    pulse.current.position.lerpVectors(new THREE.Vector3(-3.05, 1.18, 0.2), new THREE.Vector3(0, 1.98, -0.85), travel * action);
    pulse.current.visible = action > 0.02;
  });
  return (
    <InvestigationRoomKit>
      {/* Recognizable switchboard handset, line keys and waveform establish the communication-analysis context. */}
      <group position={[-3.05, 1.12, 0.18]}>
        <mesh castShadow><boxGeometry args={[1.55, 0.46, 0.88]} /><meshStandardMaterial color="#555c59" roughness={0.56} metalness={0.18} /></mesh>
        <mesh position={[0, 0.13, 0.47]}><boxGeometry args={[1.25, 0.17, 0.04]} /><meshBasicMaterial color="#b5c9bd" /></mesh>
        <group position={[-0.05, 0.42, 0.05]} rotation={[0, 0.1, -0.08]}>
          <mesh><capsuleGeometry args={[0.105, 0.78, 7, 16]} /><meshStandardMaterial color="#303634" roughness={0.58} /></mesh>
          <mesh position={[-0.42, 0, 0]}><sphereGeometry args={[0.16, 18, 18]} /><meshStandardMaterial color="#303634" /></mesh>
          <mesh position={[0.42, 0, 0]}><sphereGeometry args={[0.16, 18, 18]} /><meshStandardMaterial color="#303634" /></mesh>
        </group>
        {Array.from({ length: 8 }, (_, index) => <mesh key={index} position={[-0.54 + index * 0.155, -0.08, 0.47]}><boxGeometry args={[0.09, 0.07, 0.025]} /><meshStandardMaterial color={index < Math.ceil(action * 8) ? "#356edb" : "#7c837f"} emissive={index < Math.ceil(action * 8) ? "#356edb" : "#000"} emissiveIntensity={0.45} /></mesh>)}
      </group>
      <group position={[-1.48, 1.62, -1.25]}>
        <mesh position={[0, 0, -0.03]}><boxGeometry args={[2.35, 0.82, 0.08]} /><meshStandardMaterial color="#ebeee8" /></mesh>
        {Array.from({ length: 18 }, (_, index) => {
          const height = 0.08 + Math.abs(Math.sin(index * 0.72 + action * 7)) * 0.38 * action;
          return <mesh key={index} position={[-1 + index * 0.118, 0, 0.03]}><boxGeometry args={[0.055, height, 0.025]} /><meshBasicMaterial color="#356edb" /></mesh>;
        })}
      </group>
      <AnimatedConnector points={[[ -3.05, 1.2, 0.18], [-2.15, 1.38, -0.35], [-1.48, 1.62, -1.22], [0, 1.98, -0.85]]} color="#356edb" progress={action} reducedMotion={reducedMotion} delay={0.04} opacity={0.9} />
      <group ref={pulse}><mesh><boxGeometry args={[0.18, 0.08, 0.08]} /><meshBasicMaterial color="#356edb" /></mesh><pointLight color="#356edb" intensity={1.2} distance={1.8} /></group>

      <IntelligencePanel position={[0, 1.98, -0.85]} eyebrow="CLUE REVEAL" title="ANONYMOUS TIP" metadata={`PRIMARY CALL / ${event.sourceTimelineId}`} tone="call" primary priority={100} lanes={["TOP", "TOP_LEFT", "RIGHT"]} amount={clue} reducedMotion={reducedMotion} />
      <IntelligencePanel position={[1.82, 2.46, -1.25]} eyebrow="LOCATION" title="PLATFORM 9" metadata="REFERENCED PLACE" tone="location" priority={80} lanes={["RIGHT", "BOTTOM_RIGHT", "TOP_RIGHT"]} amount={consequence} reducedMotion={reducedMotion} />
      <IntelligencePanel position={[-3.45, 1.72, -0.72]} eyebrow="REPORT" title="DISTURBANCE" metadata="CALL SUBJECT" tone="finding" priority={60} lanes={["LEFT", "TOP_LEFT", "TOP"]} amount={consequence} reducedMotion={reducedMotion} />
      <IntelligencePanel position={[1.72, 0.78, -0.7]} eyebrow="CONTEXT" title="VICTIM SIGHTING" metadata="CCTV / TL-001" tone="record" priority={55} lanes={["RIGHT", "TOP_RIGHT", "BOTTOM_RIGHT"]} amount={consequence} reducedMotion={reducedMotion} />
      <AnimatedConnector points={[[0, 1.98, -0.84], [1.58, 2.25, -1.02], [2.52, 2.38, -1.2]]} color="#2baf83" progress={consequence} reducedMotion={reducedMotion} delay={0.12} opacity={0.82} />
      <AnimatedConnector points={[[0, 1.98, -0.84], [-1.48, 1.4, -0.72], [-2.5, 0.9, -0.7]]} color="#b8892a" progress={consequence} reducedMotion={reducedMotion} delay={0.2} />
      <AnimatedConnector points={[[0, 1.98, -0.84], [1.48, 1.38, -0.72], [2.46, 0.9, -0.68]]} color="#8b8982" progress={consequence} reducedMotion={reducedMotion} delay={0.28} />
      <AnimatedConnector points={[[0.85, 2.02, -0.84], [2.2, 2.32, -1.03], [3.58, 2.42, -1.23], [4.75, 2.55, -2.1]]} color="#2baf83" progress={transition} reducedMotion={reducedMotion} delay={0.02} opacity={0.98} />
      <FocusBeacon position={[3.58, 1.86, -1.22]} color="#2baf83" progress={transition} reducedMotion={reducedMotion} radius={0.58} />
    </InvestigationRoomKit>
  );
}
