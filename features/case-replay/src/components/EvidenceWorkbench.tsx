"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import { CinematicReveal, type CinematicBeat } from "@replay/engine/CinematicBeatController";
import { AnimatedConnector, FocusBeacon } from "@replay/components/SceneMotion";
import type { ReplayEvent } from "@replay/types";
import { ScreenSpaceAnnotation } from "@replay/components/AnnotationLayoutManager";
import { Html } from "@react-three/drei";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";

export function EvidenceWorkbench({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const examiner = useRef<THREE.Group>(null);
  const scanLight = useRef<THREE.Mesh>(null);
  const action = beat.value("ACTION");
  const reveal = beat.value("CLUE REVEAL");
  const consequence = beat.value("CONSEQUENCE");
  const transition = beat.value("TRANSITION");
  useFrame(({ clock }) => {
    if (examiner.current) {
      examiner.current.position.x = -0.68 + action * 0.82;
      examiner.current.rotation.z = -0.24 + action * 0.15 + (reducedMotion ? 0 : Math.sin(clock.getElapsedTime() * 1.2) * 0.015);
    }
    if (scanLight.current) scanLight.current.position.x = -0.74 + reveal * 1.5;
  });
  const evidence = event.evidence[0] ?? { sourceId: "ev-ticket", label: "TORN TICKET" };
  return (
    <group>
      <mesh position={[0, 0.76, 0]} castShadow receiveShadow><boxGeometry args={[6.5, 0.18, 3.4]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh>
      <mesh position={[0, 0.88, 0]} receiveShadow><boxGeometry args={[6.18, 0.08, 3.08]} /><meshStandardMaterial {...crimeLens3DTheme.materials.paper} /></mesh>
      {[-2.82, 2.82].flatMap((x) => [-1.35, 1.35].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.34, z]}><boxGeometry args={[0.13, 0.72, 0.13]} /><meshStandardMaterial color="#545955" /></mesh>))}

      {/* Evidence bag, scale, ticket, loupe and tweezers are the only examination props. */}
      <mesh position={[-1.82, 0.96, 0.72]} rotation={[-Math.PI / 2, 0, 0.12]}><planeGeometry args={[1.32, 0.88]} /><meshPhysicalMaterial color="#dfe5df" transparent opacity={0.45} transmission={0.16} roughness={0.22} /></mesh>
      <mesh position={[-1.82, 0.98, 0.3]} rotation={[-Math.PI / 2, 0, 0.12]}><planeGeometry args={[1.12, 0.06]} /><meshBasicMaterial color="#d99a20" /></mesh>
      <group position={[0, 0.99, 0.05]} rotation={[0, -0.08, 0]}>
        <mesh castShadow><boxGeometry args={[1.72, 0.045, 0.72]} /><meshStandardMaterial color="#e4d5a7" roughness={0.82} /></mesh>
        <mesh position={[0.58, 0.027, 0]}><boxGeometry args={[0.08, 0.01, 0.64]} /><meshBasicMaterial color="#b98a28" /></mesh>
        {[-0.52, -0.34, -0.16, 0.02].map((x) => <mesh key={x} position={[x, 0.028, 0.18]}><boxGeometry args={[0.1, 0.008, 0.018]} /><meshBasicMaterial color="#68645d" /></mesh>)}
      </group>
      <group position={[1.55, 0.95, 0.85]} rotation={[0, 0.18, 0]}>
        <mesh><boxGeometry args={[1.75, 0.06, 0.34]} /><meshStandardMaterial color="#ede9df" /></mesh>
        {Array.from({ length: 18 }, (_, index) => <mesh key={index} position={[-0.78 + index * 0.092, 0.045, 0.13]}><boxGeometry args={[0.012, 0.01, index % 5 === 0 ? 0.18 : 0.11]} /><meshBasicMaterial color="#383a37" /></mesh>)}
      </group>
      <group ref={examiner} position={[-0.68, 1.45, 0.28]} rotation={[0, 0, -0.24]}>
        <mesh><torusGeometry args={[0.32, 0.055, 12, 36]} /><meshPhysicalMaterial color="#5f6865" roughness={0.26} metalness={0.38} transmission={0.16} /></mesh>
        <mesh position={[0, -0.46, 0]}><cylinderGeometry args={[0.035, 0.035, 0.6, 12]} /><meshStandardMaterial color="#555b58" metalness={0.5} /></mesh>
      </group>
      <group position={[-1.05, 1.12, -0.82]} rotation={[0.12, 0, 0.28]}>
        <mesh><capsuleGeometry args={[0.035, 0.85, 4, 10]} /><meshStandardMaterial color="#666b68" metalness={0.62} roughness={0.32} /></mesh>
        <mesh position={[0.16, 0, 0]}><capsuleGeometry args={[0.035, 0.85, 4, 10]} /><meshStandardMaterial color="#666b68" metalness={0.62} roughness={0.32} /></mesh>
      </group>
      <mesh ref={scanLight} position={[-0.74, 1.08, 0.05]}><boxGeometry args={[0.08, 0.018, 0.82]} /><meshBasicMaterial color="#f3c74b" transparent opacity={0.68} /></mesh>
      <Html transform center position={[1.8, 1.03, -0.78]} rotation={[-Math.PI / 2, 0, 0]} distanceFactor={7.8} style={{ pointerEvents: "none" }}><InvestigationCard eyebrow="PHYSICAL EVIDENCE" title="TORN TICKET" metadata="SERIAL 58-14" tone="evidence" compact /></Html>

      <AnimatedConnector points={[[0.78, 1.04, 0.04], [1.35, 1.32, -0.2], [2.05, 1.52, -0.68]]} color="#d99a20" progress={consequence} reducedMotion={reducedMotion} delay={0.12} opacity={0.8} />
      <AnimatedConnector points={[[2.2, 1.52, -0.68], [3.25, 1.7, -1.4], [4.25, 1.82, -2.3]]} color="#b8892a" progress={transition} reducedMotion={reducedMotion} delay={0.05} opacity={0.88} />
      <FocusBeacon position={[0, 0.92, 0.05]} color="#d99a20" progress={reveal} reducedMotion={reducedMotion} radius={0.76} />
    </group>
  );
}
