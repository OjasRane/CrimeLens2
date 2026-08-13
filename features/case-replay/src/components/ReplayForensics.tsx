"use client";

import { Html } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EvidenceGeometry, ForensicAnnotation } from "@replay/entities/ReplayEntities";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import { AnimatedConnector, FocusBeacon, getPhaseProgress } from "@replay/components/SceneMotion";
import { REPLAY_COLORS, REPLAY_MATERIALS } from "@replay/engine/materialPalette";
import type { ReplayEvent } from "@replay/types";

export function PhysicalSign({
  label,
  detail,
  position,
  rotation = [0, 0, 0],
  width = 2.5,
}: {
  label: string;
  detail?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[width, 0.68, 0.09]} /><meshStandardMaterial color="#2f302c" roughness={0.66} metalness={0.12} /></mesh>
      <mesh position={[0, 0, 0.052]}><boxGeometry args={[width - 0.12, 0.56, 0.018]} /><meshStandardMaterial color="#f0ece2" roughness={0.84} /></mesh>
      <Html position={[0, 0, 0.07]} center transform distanceFactor={7.5}>
        <div className="case-replay-physical-sign"><strong>{label}</strong>{detail && <span>{detail}</span>}</div>
      </Html>
    </group>
  );
}

function BoardCard({
  title,
  detail,
  position,
  tone = "paper",
  delay,
  progress,
  reducedMotion,
  active = false,
  size = [1.48, 0.94],
}: {
  title: string;
  detail: string;
  position: [number, number, number];
  tone?: "paper" | "photo" | "note";
  delay: number;
  progress: number;
  reducedMotion: boolean;
  active?: boolean;
  size?: [number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const color = tone === "photo" ? "#d7d2c8" : tone === "note" ? "#e4d59d" : "#f3f0e8";
  useFrame(({ clock }) => {
    if (!group.current || !material.current) return;
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, delay, Math.min(1, delay + 0.2));
    const pulse = active && !reducedMotion ? 0.5 + Math.sin(clock.getElapsedTime() * 2.1) * 0.5 : 0;
    group.current.scale.setScalar(0.88 + reveal * 0.12 + pulse * 0.012);
    group.current.position.z = position[2] + reveal * 0.025;
    material.current.emissive.set(active ? "#d99a20" : "#000000");
    material.current.emissiveIntensity = active ? 0.05 + pulse * 0.1 : 0;
  });
  return (
    <group ref={group} position={position}>
      <mesh castShadow>
        <boxGeometry args={[size[0], size[1], 0.035]} />
        <meshStandardMaterial ref={material} color={color} roughness={0.92} />
      </mesh>
      <mesh position={[-size[0] * 0.38, size[1] * 0.38, 0.026]}><circleGeometry args={[0.045, 16]} /><meshStandardMaterial color="#9f7d3b" metalness={0.3} /></mesh>
      {tone === "photo" && <mesh position={[-0.36, 0, 0.026]}><boxGeometry args={[0.46, 0.52, 0.015]} /><meshStandardMaterial color="#868983" roughness={0.95} /></mesh>}
      <mesh position={[0, -size[1] * 0.37, 0.027]}><boxGeometry args={[size[0] * 0.86, 0.045, 0.01]} /><meshBasicMaterial color={active ? "#d99a20" : "#a8a197"} /></mesh>
      <Html position={[tone === "photo" ? 0.29 : 0, 0, 0.045]} center transform distanceFactor={6.8}>
        <InvestigationCard
          className="case-replay-board-document"
          title={title}
          subtitle={detail}
          tone={tone === "note" ? "finding" : tone === "photo" ? "record" : "neutral"}
          primary={active}
          compact
        />
      </Html>
    </group>
  );
}

export function ForensicBoard({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const phase = getPhaseProgress(progress);
  const evidence = event.evidence.slice(0, 3);
  const victim = event.people.find((person) => person.role === "victim") ?? event.people[0];
  const left = evidence[0] ?? { label: victim?.name ?? event.headline, sourceId: event.sourceTimelineId };
  const middle = evidence[1] ?? { label: event.category, sourceId: event.sourceTimelineId };
  const right = evidence[2] ?? { label: event.location?.label ?? "Case record", sourceId: event.location?.id ?? event.sourceTimelineId };
  return (
    <group position={[0, 2.35, -3]}>
      <mesh receiveShadow><boxGeometry args={[8.05, 3.72, 0.18]} /><meshStandardMaterial color="#776d5e" roughness={0.82} /></mesh>
      <mesh position={[0, 0, 0.1]}><boxGeometry args={[7.62, 3.3, 0.045]} /><meshStandardMaterial color="#d8ccb6" roughness={1} /></mesh>
      {[-3.93, 3.93].map((x) => <mesh key={x} position={[x, 0, 0.14]}><boxGeometry args={[0.14, 3.66, 0.16]} /><meshStandardMaterial color="#a28b69" roughness={0.8} /></mesh>)}
      {[-1.78, 1.78].map((y) => <mesh key={y} position={[0, y, 0.14]}><boxGeometry args={[8.02, 0.14, 0.16]} /><meshStandardMaterial color="#a28b69" roughness={0.8} /></mesh>)}
      <mesh position={[0, 1.48, 0.145]}><boxGeometry args={[2.25, 0.42, 0.04]} /><meshStandardMaterial color="#302f2b" /></mesh>
      <Html position={[0, 1.48, 0.18]} center transform distanceFactor={7}><div className="case-replay-board-heading"><strong>ACTIVE CASE BOARD</strong><span>THE FATAL LEDGER</span></div></Html>

      <AnimatedConnector points={[[-1.82, 0.76, 0.17], [-0.96, 0.4, 0.175]]} color="#8f846e" progress={phase} reducedMotion={reducedMotion} delay={0.25} />
      <AnimatedConnector points={[[0.96, 0.4, 0.175], [1.82, 0.76, 0.17]]} color="#8f846e" progress={phase} reducedMotion={reducedMotion} delay={0.34} />
      <AnimatedConnector points={[[-1.62, -0.72, 0.18], [-0.96, 0.02, 0.18]]} color="#2b8d6f" progress={phase} reducedMotion={reducedMotion} delay={0.44} />
      <AnimatedConnector points={[[0.96, 0.02, 0.185], [1.62, -0.74, 0.185]]} color="#b8892a" progress={phase} reducedMotion={reducedMotion} delay={0.56} />

      <BoardCard title={victim ? `${victim.name} / ${victim.role}` : left.label} detail={left.sourceId} position={[-2.65, 0.78, 0.18]} tone="photo" delay={0.02} progress={phase} reducedMotion={reducedMotion} size={[1.62, 1.06]} />
      <BoardCard title={event.headline} detail={`${event.category} · ${event.sourceTimelineId}`} position={[0, 0.18, 0.19]} tone="note" delay={0.14} progress={phase} reducedMotion={reducedMotion} active size={[1.9, 1.16]} />
      <BoardCard title={event.location?.label ?? right.label} detail={event.location?.id ?? right.sourceId} position={[2.65, 0.78, 0.18]} delay={0.24} progress={phase} reducedMotion={reducedMotion} size={[1.62, 1.06]} />
      <BoardCard title="TIMELINE RECORD" detail={`${event.date} · ${event.sourceTimelineId}`} position={[-2.45, -0.86, 0.18]} delay={0.34} progress={phase} reducedMotion={reducedMotion} size={[1.62, 1.04]} />
      <BoardCard title={middle.label} detail={middle.sourceId} position={[2.45, -0.88, 0.18]} tone="photo" delay={0.46} progress={phase} reducedMotion={reducedMotion} size={[1.62, 1.04]} />
      <FocusBeacon position={[0, 0.18, 0.22]} color="#d99a20" progress={phase} reducedMotion={reducedMotion} radius={0.8} />
    </group>
  );
}

function EvidenceMarker({ label, position }: { label: string; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><coneGeometry args={[0.24, 0.38, 3]} /><meshStandardMaterial color="#f4c94f" roughness={0.8} /></mesh>
      <Html position={[0, 0.18, 0]} center transform distanceFactor={6.5}><div className="case-replay-evidence-marker">{label}</div></Html>
    </group>
  );
}

function PaperRecord({
  position,
  rotation = 0,
  size = [1.55, 1.05],
  accent = REPLAY_COLORS.amber,
}: {
  position: [number, number, number];
  rotation?: number;
  size?: [number, number];
  accent?: string;
}) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow><boxGeometry args={[size[0], 0.035, size[1]]} /><meshStandardMaterial {...REPLAY_MATERIALS.paper} /></mesh>
      <mesh position={[-size[0] * 0.43, 0.025, 0]}><boxGeometry args={[0.075, 0.012, size[1] * 0.86]} /><meshBasicMaterial color={accent} /></mesh>
      {[-0.27, -0.08, 0.11, 0.3].map((z, index) => (
        <mesh key={z} position={[0.12, 0.027, z * size[1]]}>
          <boxGeometry args={[size[0] * (index === 0 ? 0.54 : 0.68), 0.008, 0.018]} />
          <meshBasicMaterial color={index === 0 ? REPLAY_COLORS.ink : "#9b968d"} />
        </mesh>
      ))}
    </group>
  );
}

function TicketExamination({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const evidence = event.evidence[0] ?? { sourceId: event.sourceTimelineId };
  const ticket = useRef<THREE.Group>(null);
  const highlight = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ticket.current || !highlight.current) return;
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, 0.18, 0.58);
    ticket.current.position.y = 1.005 + reveal * 0.055;
    ticket.current.rotation.z = 0.02 - reveal * 0.045;
    highlight.current.emissive.set("#d99a20");
    highlight.current.emissiveIntensity = reducedMotion ? 0.08 : 0.06 + (0.5 + Math.sin(clock.getElapsedTime() * 2.4) * 0.5) * 0.13;
  });
  return (
    <>
      <group position={[-0.65, 0.86, 0.12]} rotation={[0, 0.17, -0.03]}>
        <mesh castShadow><boxGeometry args={[2.7, 0.14, 2.12]} /><meshStandardMaterial color="#364149" roughness={0.98} /></mesh>
        <mesh position={[-1.15, 0.02, 0.85]} rotation={[0, 0, -0.18]}><boxGeometry args={[1.2, 0.1, 0.46]} /><meshStandardMaterial color="#3d4950" /></mesh>
        <mesh position={[1.1, 0.02, 0.82]} rotation={[0, 0, 0.18]}><boxGeometry args={[1.2, 0.1, 0.46]} /><meshStandardMaterial color="#3d4950" /></mesh>
        <mesh position={[0.45, 0.095, 0.22]} castShadow><boxGeometry args={[1.22, 0.055, 0.72]} /><meshStandardMaterial color="#596167" roughness={0.95} /></mesh>
        <mesh position={[0.45, 0.13, -0.08]} rotation={[0, 0, 0.03]}><boxGeometry args={[1.1, 0.035, 0.14]} /><meshStandardMaterial color="#667178" /></mesh>
      </group>
      <group ref={ticket} position={[0.45, 1.04, 0.24]} rotation={[0, -0.18, 0.02]}>
        <mesh castShadow><boxGeometry args={[1.42, 0.045, 0.58]} /><meshStandardMaterial ref={highlight} color="#e4d19a" roughness={0.78} /></mesh>
        <mesh position={[0.64, 0.026, 0]} rotation={[0, 0, 0.2]}><boxGeometry args={[0.2, 0.014, 0.6]} /><meshStandardMaterial color="#f0e3bc" /></mesh>
        {[-0.38, -0.2, 0, 0.21].map((x) => <mesh key={x} position={[x, 0.028, 0]}><boxGeometry args={[0.06, 0.008, 0.38]} /><meshBasicMaterial color="#786f58" /></mesh>)}
      </group>
      <mesh position={[1.88, 0.85, -0.68]} rotation={[-Math.PI / 2, 0, 0.07]}><boxGeometry args={[1.85, 0.05, 0.25]} /><meshStandardMaterial color="#e1d6b7" roughness={0.82} /></mesh>
      {Array.from({ length: 10 }, (_, index) => <mesh key={index} position={[1.04 + index * 0.19, 0.887, -0.68]}><boxGeometry args={[0.012, 0.012, index % 2 === 0 ? 0.19 : 0.12]} /><meshBasicMaterial color="#4a4945" /></mesh>)}
      <mesh position={[0.48, 0.98, 0.22]}><boxGeometry args={[1.78, 0.035, 0.96]} /><meshPhysicalMaterial color="#fafafa" transparent opacity={0.16} transmission={0.3} roughness={0.14} /></mesh>
      <group position={[1.95, 0.9, 0.78]} rotation={[0, -0.12, 0]}>
        <mesh><boxGeometry args={[1.38, 0.035, 0.94]} /><meshStandardMaterial color="#f3f0e8" /></mesh>
        {[0.26, 0.08, -0.1, -0.28].map((z) => <mesh key={z} position={[0, 0.024, z]}><boxGeometry args={[1.05, 0.006, 0.025]} /><meshBasicMaterial color="#9a958b" /></mesh>)}
      </group>
      <group position={[-2.15, 0.95, 0.8]} rotation={[0, 0.35, 0]}>
        <mesh><capsuleGeometry args={[0.11, 0.45, 6, 14]} /><meshStandardMaterial color="#d8d4c9" /></mesh>
        <mesh position={[0.16, 0, 0]}><capsuleGeometry args={[0.1, 0.4, 6, 14]} /><meshStandardMaterial color="#d8d4c9" /></mesh>
      </group>
      <mesh position={[1.05, 0.92, 1.05]} rotation={[0, 0.25, Math.PI / 2]}><capsuleGeometry args={[0.035, 0.65, 4, 10]} /><meshStandardMaterial color="#4a4b47" metalness={0.45} /></mesh>
      <EvidenceMarker label={evidence.sourceId} position={[-2.05, 0.93, -0.92]} />
      <Html position={[0.52, 1.72, 0.18]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}><ForensicAnnotation title="TORN TICKET STUB" detail={`INNER COAT POCKET · ${evidence.sourceId}`} tone="evidence" /></Html>
      <FocusBeacon position={[0.48, 0.79, 0.22]} color="#d99a20" progress={progress} reducedMotion={reducedMotion} radius={0.75} />
    </>
  );
}

function EntryLogExamination({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const evidence = event.evidence[0] ?? { sourceId: event.sourceTimelineId };
  const ledger = useRef<THREE.Group>(null);
  const targetRow = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!ledger.current || !targetRow.current) return;
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, 0.12, 0.55);
    ledger.current.rotation.x = -0.08 + reveal * 0.08;
    targetRow.current.emissive.set("#d99a20");
    targetRow.current.emissiveIntensity = reducedMotion ? 0.08 : 0.08 + (0.5 + Math.sin(clock.getElapsedTime() * 2.2) * 0.5) * 0.18;
  });
  return (
    <>
      <group ref={ledger} position={[-0.35, 0.94, 0.05]} rotation={[0, 0.08, 0]}>
        <mesh position={[-0.82, 0, 0]} castShadow><boxGeometry args={[1.55, 0.08, 2.05]} /><meshStandardMaterial color="#eee6d3" roughness={0.92} /></mesh>
        <mesh position={[0.82, 0, 0]} castShadow><boxGeometry args={[1.55, 0.08, 2.05]} /><meshStandardMaterial color="#eee6d3" roughness={0.92} /></mesh>
        <mesh position={[0, -0.02, 0]}><boxGeometry args={[0.12, 0.11, 2.08]} /><meshStandardMaterial color="#4b352a" /></mesh>
        {[-0.62, -0.32, -0.02, 0.28, 0.58].map((z, index) => <group key={z}><mesh position={[-0.82, 0.05, z]}><boxGeometry args={[1.28, 0.008, 0.025]} /><meshBasicMaterial color="#9c9587" /></mesh><mesh position={[0.82, 0.05, z]}><boxGeometry args={[1.28, 0.008, 0.025]} /><meshBasicMaterial color="#9c9587" /></mesh>{index === 3 && <mesh position={[0.82, 0.065, z]}><boxGeometry args={[1.28, 0.02, 0.22]} /><meshStandardMaterial ref={targetRow} color="#e5ca72" transparent opacity={0.7} /></mesh>}</group>)}
      </group>
      <group position={[1.95, 0.9, 0.62]} rotation={[0, -0.18, 0]}>
        <mesh><boxGeometry args={[1.32, 0.06, 1.72]} /><meshStandardMaterial color="#8f8a80" /></mesh>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[1.16, 0.035, 1.5]} /><meshStandardMaterial color="#f1ede4" /></mesh>
        <mesh position={[0, 0.1, -0.72]}><boxGeometry args={[0.34, 0.1, 0.16]} /><meshStandardMaterial color="#5b5b56" /></mesh>
      </group>
      <group position={[-2.2, 0.95, -0.65]} rotation={[0, 0.2, 0]}>
        <mesh><boxGeometry args={[0.82, 0.035, 0.52]} /><meshStandardMaterial color="#f4efe3" /></mesh>
        <mesh position={[0, 0.025, 0]}><boxGeometry args={[0.22, 0.008, 0.16]} /><meshBasicMaterial color="#356edb" /></mesh>
      </group>
      <mesh position={[1.62, 1.04, -0.72]}><cylinderGeometry args={[0.2, 0.24, 0.42, 18]} /><meshStandardMaterial color="#6c665e" /></mesh>
      <mesh position={[-1.78, 1.01, 0.62]} rotation={[0, -0.2, Math.PI / 2]}><capsuleGeometry args={[0.035, 0.72, 4, 10]} /><meshStandardMaterial color="#356edb" metalness={0.25} /></mesh>
      <mesh position={[2.24, 0.88, -0.75]}><boxGeometry args={[0.95, 0.12, 0.72]} /><meshStandardMaterial color="#b4aa98" /></mesh>
      <EvidenceMarker label={evidence.sourceId} position={[-2.18, 0.94, 0.9]} />
      <Html position={[0.55, 1.8, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}><ForensicAnnotation title="EVIDENCE ROOM ENTRY LOG" detail={`TARGET ENTRY HIGHLIGHTED · ${evidence.sourceId}`} tone="communication" /></Html>
      <FocusBeacon position={[0.48, 0.8, 0.28]} color="#356edb" progress={progress} reducedMotion={reducedMotion} radius={0.82} />
    </>
  );
}

function AccelerantExamination({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const evidence = event.evidence[0] ?? { sourceId: event.sourceTimelineId };
  const sample = useRef<THREE.Group>(null);
  const result = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!sample.current || !result.current) return;
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, 0.16, 0.62);
    sample.current.position.y = 1.02 + reveal * 0.1;
    sample.current.rotation.y = reveal * 0.18;
    result.current.emissive.set(REPLAY_COLORS.amber);
    result.current.emissiveIntensity = reducedMotion ? 0.06 : 0.05 + (0.5 + Math.sin(clock.getElapsedTime() * 1.9) * 0.5) * 0.12;
  });
  return (
    <>
      <group position={[-0.72, 0.9, 0.02]}>
        <mesh castShadow><boxGeometry args={[2.5, 0.12, 1.62]} /><meshStandardMaterial {...REPLAY_MATERIALS.metal} /></mesh>
        <mesh position={[0, 0.09, 0]}><boxGeometry args={[2.22, 0.055, 1.34]} /><meshStandardMaterial color="#b8bbb7" roughness={0.36} metalness={0.52} /></mesh>
        <mesh position={[0, 0.13, 0]}><boxGeometry args={[1.88, 0.025, 1.02]} /><meshPhysicalMaterial {...REPLAY_MATERIALS.glass} /></mesh>
      </group>
      <group ref={sample} position={[-0.72, 1.08, 0]}>
        <mesh castShadow><cylinderGeometry args={[0.22, 0.24, 0.72, 24]} /><meshPhysicalMaterial color="#d7e1dc" roughness={0.12} transmission={0.5} transparent opacity={0.52} /></mesh>
        <mesh position={[0, -0.18, 0]}><cylinderGeometry args={[0.2, 0.21, 0.28, 24]} /><meshStandardMaterial color="#ad7d29" transparent opacity={0.74} roughness={0.5} /></mesh>
        <mesh position={[0, 0.43, 0]}><cylinderGeometry args={[0.19, 0.19, 0.16, 20]} /><meshStandardMaterial {...REPLAY_MATERIALS.darkMetal} /></mesh>
        <mesh position={[0, 0.06, 0.225]}><boxGeometry args={[0.34, 0.18, 0.012]} /><meshStandardMaterial {...REPLAY_MATERIALS.paper} /></mesh>
      </group>
      <group position={[1.62, 0.88, 0.28]} rotation={[0, -0.16, 0]}>
        <PaperRecord position={[0, 0, 0]} size={[1.72, 1.3]} accent={REPLAY_COLORS.amber} />
        <mesh position={[0.16, 0.035, -0.34]}><boxGeometry args={[1.05, 0.012, 0.24]} /><meshStandardMaterial ref={result} color="#e8d28d" roughness={0.82} /></mesh>
      </group>
      <group position={[2.13, 1.02, -0.92]} rotation={[0, -0.3, 0]}>
        <mesh><boxGeometry args={[0.72, 0.08, 1.18]} /><meshStandardMaterial color="#8f8a80" roughness={0.72} /></mesh>
        <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.62, 0.028, 1.02]} /><meshStandardMaterial {...REPLAY_MATERIALS.paper} /></mesh>
        <mesh position={[0, 0.11, -0.48]}><boxGeometry args={[0.2, 0.08, 0.13]} /><meshStandardMaterial {...REPLAY_MATERIALS.darkMetal} /></mesh>
      </group>
      <group position={[-2.05, 0.98, 0.95]} rotation={[0, 0.28, 0]}>
        <mesh><capsuleGeometry args={[0.11, 0.44, 6, 14]} /><meshStandardMaterial {...REPLAY_MATERIALS.plastic} /></mesh>
        <mesh position={[0.18, 0, 0]}><capsuleGeometry args={[0.1, 0.4, 6, 14]} /><meshStandardMaterial {...REPLAY_MATERIALS.plastic} /></mesh>
      </group>
      <mesh position={[-1.92, 0.98, -0.9]} rotation={[0, 0.25, Math.PI / 2]}><capsuleGeometry args={[0.038, 0.72, 4, 10]} /><meshStandardMaterial color={REPLAY_COLORS.blue} metalness={0.24} /></mesh>
      <group position={[0.62, 1.02, -0.96]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.05, 24]} /><meshPhysicalMaterial {...REPLAY_MATERIALS.glass} /></mesh>
        <mesh position={[0.2, 0, 0]}><torusGeometry args={[0.12, 0.025, 8, 18, Math.PI]} /><meshStandardMaterial {...REPLAY_MATERIALS.metal} /></mesh>
      </group>
      <EvidenceMarker label={evidence.sourceId} position={[-2.25, 0.94, -0.55]} />
      <Html position={[0.25, 1.85, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}><ForensicAnnotation title="ACCELERANT TRACE" detail={`LAB RESULT / ${evidence.sourceId}`} tone="evidence" /></Html>
      <FocusBeacon position={[-0.72, 0.8, 0]} color={REPLAY_COLORS.amber} progress={progress} reducedMotion={reducedMotion} radius={0.78} />
    </>
  );
}

export function InvestigationWorksurface({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const phase = getPhaseProgress(progress);
  const isIdentification = event.sourceTimelineId === "TL-011";
  const evidence = event.evidence[0] ?? { sourceId: event.sourceTimelineId, label: event.headline };
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow><boxGeometry args={[5.4, 0.18, 2.52]} /><meshStandardMaterial {...REPLAY_MATERIALS.wood} /></mesh>
      <mesh position={[0, 0.84, 0]} receiveShadow><boxGeometry args={[5.08, 0.035, 2.22]} /><meshStandardMaterial color="#d8cfbf" roughness={0.88} /></mesh>
      {[-2.35, 2.35].flatMap((x) => [-0.98, 0.98].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.35, z]} castShadow><boxGeometry args={[0.12, 0.7, 0.12]} /><meshStandardMaterial {...REPLAY_MATERIALS.darkMetal} /></mesh>))}
      <PaperRecord position={[-1.45, 0.88, 0.1]} rotation={0.16} size={[1.6, 1.2]} accent={isIdentification ? REPLAY_COLORS.red : REPLAY_COLORS.amber} />
      <group position={[0.2, 0.89, -0.18]} rotation={[0, -0.08, 0]}>
        <mesh castShadow><boxGeometry args={[1.35, 0.07, 1.55]} /><meshStandardMaterial color={isIdentification ? "#4c3d38" : REPLAY_COLORS.woodDark} roughness={0.8} /></mesh>
        <mesh position={[0, 0.055, 0]}><boxGeometry args={[1.18, 0.028, 1.38]} /><meshStandardMaterial {...REPLAY_MATERIALS.agedPaper} /></mesh>
        <mesh position={[-0.34, 0.08, 0.28]}><boxGeometry args={[0.36, 0.018, 0.46]} /><meshStandardMaterial color="#777a76" roughness={0.95} /></mesh>
        {[-0.34, -0.12, 0.1].map((z) => <mesh key={z} position={[0.26, 0.08, z]}><boxGeometry args={[0.45, 0.01, 0.024]} /><meshBasicMaterial color="#79756d" /></mesh>)}
      </group>
      <PaperRecord position={[1.72, 0.89, 0.28]} rotation={-0.19} size={[1.38, 1.08]} accent={isIdentification ? REPLAY_COLORS.red : REPLAY_COLORS.green} />
      <mesh position={[1.6, 0.94, -0.52]} rotation={[0, -0.18, 0]}><boxGeometry args={[0.86, 0.035, 0.23]} /><meshStandardMaterial color={isIdentification ? "#e7b5ad" : "#e6d28e"} roughness={0.88} /></mesh>
      <mesh position={[-2.05, 0.96, -0.72]} rotation={[0, 0.25, Math.PI / 2]}><capsuleGeometry args={[0.035, 0.7, 4, 10]} /><meshStandardMaterial color={REPLAY_COLORS.blue} metalness={0.2} /></mesh>
      <EvidenceMarker label={evidence.sourceId} position={[-2.18, 0.94, 0.76]} />
      <Html position={[0.12, 1.72, 0]} center distanceFactor={7.6} style={{ pointerEvents: "none" }}>
        <ForensicAnnotation title={isIdentification ? "PARTIAL PRINT MATCH" : "ACTIVE CASE REVIEW"} detail={isIdentification ? `IDENTITY LEAD + WARRANT / ${evidence.sourceId}` : `${event.sourceTimelineId} / ${evidence.label}`} tone={isIdentification ? "evidence" : "location"} />
      </Html>
      <FocusBeacon position={isIdentification ? [-1.45, 0.8, 0.1] : [0.2, 0.8, -0.18]} color={isIdentification ? REPLAY_COLORS.red : REPLAY_COLORS.amber} progress={phase} reducedMotion={reducedMotion} radius={0.72} />
    </group>
  );
}

export function EvidenceWorktable({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const evidence = event.evidence[0] ?? { id: event.sourceTimelineId, sourceId: event.sourceTimelineId, label: event.headline, status: event.status };
  const isTicket = evidence.label.toLowerCase().includes("ticket") || evidence.id.includes("ticket");
  const isEntryLog = event.sourceTimelineId === "TL-008" || evidence.id.includes("entry-log");
  const isAccelerant = event.sourceTimelineId === "TL-014" || evidence.id.includes("accelerant");
  const phase = getPhaseProgress(progress);
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow><boxGeometry args={[6.15, 0.16, 3.5]} /><meshStandardMaterial {...REPLAY_MATERIALS.wood} /></mesh>
      <mesh position={[0, 0.78, 0]}><boxGeometry args={[5.75, 0.035, 3.12]} /><meshStandardMaterial color="#d9d1c2" roughness={0.86} /></mesh>
      {[-2.72, 2.72].flatMap((x) => [-1.46, 1.46].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.34, z]} castShadow><boxGeometry args={[0.12, 0.7, 0.12]} /><meshStandardMaterial color="#6c675f" roughness={0.78} /></mesh>))}
      {isTicket ? <TicketExamination event={event} progress={phase} reducedMotion={reducedMotion} /> : isEntryLog ? <EntryLogExamination event={event} progress={phase} reducedMotion={reducedMotion} /> : isAccelerant ? <AccelerantExamination event={event} progress={phase} reducedMotion={reducedMotion} /> : (
        <>
          <group position={[0, 1.04, 0]}><EvidenceGeometry label={evidence.label} /></group>
          <mesh position={[1.7, 0.89, 0.4]}><boxGeometry args={[1.45, 0.045, 1.05]} /><meshStandardMaterial color="#f1ede4" /></mesh>
          <EvidenceMarker label={evidence.sourceId} position={[-1.75, 0.92, -0.75]} />
          <Html position={[0, 1.72, 0]} center distanceFactor={7.5} style={{ pointerEvents: "none" }}><ForensicAnnotation title={evidence.label} detail={evidence.sourceId} tone="evidence" /></Html>
          <FocusBeacon position={[0, 0.78, 0]} color="#d99a20" progress={phase} reducedMotion={reducedMotion} radius={0.72} />
        </>
      )}
      <PhysicalSign label={isEntryLog ? "ACCESS REVIEW" : isAccelerant ? "FORENSIC TRACE" : "EVIDENCE"} detail={`${isEntryLog ? "RESTRICTED LOG" : isAccelerant ? "MATERIAL ANALYSIS" : "EXAM"} / ${event.sourceTimelineId}`} position={[0, 2.55, -3.22]} width={isEntryLog || isAccelerant ? 2.45 : 2.15} />
    </group>
  );
}
