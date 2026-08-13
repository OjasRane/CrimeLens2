"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import { SceneTargetAnchor, ScreenSpaceAnnotation, type AnnotationAnchorType, type AnnotationLane } from "@replay/components/AnnotationLayoutManager";
import { InvestigationCard, type InvestigationCardTone } from "@replay/components/InvestigationCard";
import {
  EvidenceRoomKit,
  EVIDENCE_ROOM_KIT,
  ForensicLabKit,
  FORENSIC_LAB_KIT,
  InvestigationRoomKit,
  INVESTIGATION_ROOM_KIT,
  StreetKit,
  STREET_KIT,
} from "@replay/components/SceneEnvironment";
import { AnimatedConnector, FocusBeacon } from "@replay/components/SceneMotion";
import { CinematicHuman } from "@replay/entities/ReplayEntities";
import { CinematicBeatCamera, CinematicBeatController, CinematicReveal, type CinematicBeat } from "@replay/engine/CinematicBeatController";
import type { ReplayEvent } from "@replay/types";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";
import {
  COASTAL_CAMERA,
  CoastalLandingScene,
  MARITIME_CAMERA,
  MaritimeReconstructionScene,
  MUMBAI_MAP_CAMERA,
} from "@replay/scenes/OpeningChapterScenes";
import {
  CST_LEOPOLD_CAMERA,
  LEOPOLD_CAMERA,
  LANDMARK_CAMERA,
  CSTLeopoldReconstruction,
  CityResponseReconstruction,
  OberoiNarimanReconstruction,
  TajReconstruction,
} from "@replay/scenes/MumbaiChapterScenes";

export type ReplaySceneFamily =
  | "MARITIME_RECONSTRUCTION"
  | "COASTAL_LANDING_RECONSTRUCTION"
  | "MUMBAI_CASE_MAP"
  | "CST_LEOPOLD_RECONSTRUCTION"
  | "CITY_RESPONSE_RECONSTRUCTION"
  | "TAJ_RECONSTRUCTION"
  | "OBEROI_NARIMAN_RECONSTRUCTION"
  | "SPECIALIST_RESPONSE_RECONSTRUCTION"
  | "LOCATION_RECONSTRUCTION"
  | "RELATIONSHIP_INTELLIGENCE"
  | "FORENSIC_EVIDENCE"
  | "INVESTIGATION_BOARD"
  | "ACCESS_RECORD_REVIEW"
  | "MAP_ROUTE"
  | "DETENTION_OFFICER_INTERACTION"
  | "CASE_SYNTHESIS";

export const EVENT_SCENE_FAMILY: Record<string, ReplaySceneFamily> = {
  "TL-001": "MARITIME_RECONSTRUCTION",
  "TL-002": "COASTAL_LANDING_RECONSTRUCTION",
  "TL-003": "MUMBAI_CASE_MAP",
  "TL-004": "CST_LEOPOLD_RECONSTRUCTION",
  "TL-005": "CST_LEOPOLD_RECONSTRUCTION",
  "TL-006": "MUMBAI_CASE_MAP",
  "TL-007": "TAJ_RECONSTRUCTION",
  "TL-008": "OBEROI_NARIMAN_RECONSTRUCTION",
  "TL-009": "SPECIALIST_RESPONSE_RECONSTRUCTION",
  "TL-010": "INVESTIGATION_BOARD",
  "TL-011": "FORENSIC_EVIDENCE",
  "TL-012": "RELATIONSHIP_INTELLIGENCE",
  "TL-013": "FORENSIC_EVIDENCE",
  "TL-014": "MUMBAI_CASE_MAP",
  "TL-015": "INVESTIGATION_BOARD",
  "TL-016": "CASE_SYNTHESIS",
};

const CLUE_COPY: Record<string, { clue: string; detail: string; consequence: string; next: string }> = {
  "TL-001": { clue: "ARABIAN SEA APPROACH", detail: "VESSEL / NAVIGATION", consequence: "CASE TIMELINE BEGINS OFFSHORE", next: "LANDING ZONE" },
  "TL-002": { clue: "COASTAL LANDING ZONE", detail: "BADHWAR PARK", consequence: "SEA ROUTE MEETS CITY", next: "BRANCHING MOVEMENT" },
  "TL-003": { clue: "MULTIPLE CONFIRMED SITES", detail: "SOUTH MUMBAI", consequence: "DISTRIBUTED EMERGENCY", next: "CONTROL-ROOM RECORD" },
  "TL-004": { clue: "ATTACK BEGINS AT CST", detail: "PUBLIC REACTION / VERIFIED ALERT", consequence: "FIRST INCIDENT CONFIRMED", next: "LEOPOLD CAFE" },
  "TL-005": { clue: "LEOPOLD INCIDENT CONFIRMED", detail: "SECOND PUBLIC LOCATION", consequence: "CITY ALERT EXPANDS", next: "PROTECTED APPROACHES" },
  "TL-006": { clue: "PROTECTED CORRIDORS", detail: "LINKED RESPONSE ZONES", consequence: "ACCESS COORDINATED", next: "TAJ RESPONSE" },
  "TL-007": { clue: "TAJ RESPONSE LOCATION", detail: "SUSTAINED OPERATION", consequence: "SPECIALIST SUPPORT REQUIRED", next: "CONTINUING LOCATIONS" },
  "TL-008": { clue: "THREE CONTINUING LOCATIONS", detail: "TAJ / OBEROI / NARIMAN", consequence: "PARALLEL OPERATIONS", next: "SPECIALIST DEPLOYMENT" },
  "TL-009": { clue: "SPECIALIST DEPLOYMENT", detail: "COORDINATED ASSIGNMENT", consequence: "COMMAND STRUCTURE", next: "SHARED PICTURE" },
  "TL-010": { clue: "SHARED COMMAND PICTURE", detail: "VERIFIED STATUS", consequence: "STRUCTURED KNOWLEDGE", next: "RECOVERED ITEMS" },
  "TL-011": { clue: "RECOVERED DEVICES", detail: "CHAIN OF CUSTODY", consequence: "TECHNICAL EXAMINATION", next: "IDENTITY REVIEW" },
  "TL-012": { clue: "IDENTITY CONFIRMED", detail: "AFTER VERIFICATION", consequence: "AJMAL AMIR KASAB", next: "COMMUNICATION LINKS" },
  "TL-013": { clue: "DIGITAL COMMUNICATIONS", detail: "PHONE / CALL DATA", consequence: "RELATIONSHIP LEADS", next: "MARITIME EVIDENCE" },
  "TL-014": { clue: "MARITIME ROUTE", detail: "VESSEL / NAVIGATION", consequence: "ROUTE CORROBORATED", next: "OPERATION TIMELINE" },
  "TL-015": { clue: "OPERATIONS CONCLUDE", detail: "28–29 NOVEMBER", consequence: "LIVE RESPONSE CLOSES", next: "CASE SYNTHESIS" },
  "TL-016": { clue: "EVIDENCE CONVERGES", detail: "MULTI-SOURCE RECORD", consequence: "INVESTIGATIVE RECONSTRUCTION", next: "FREEZE + INSPECT" },
};

function BeatSlate({ beat, eventId }: { beat: CinematicBeat; eventId: string }) {
  void beat;
  void eventId;
  return null;
}

function Annotation({ id, position, eyebrow, title, subtitle, metadata, tone = "neutral", priority = 60, lanes, primary = false }: {
  id: string; position: [number, number, number]; eyebrow: string; title: string; subtitle?: string; metadata?: string;
  tone?: InvestigationCardTone; priority?: number; lanes?: AnnotationLane[]; primary?: boolean;
}) {
  const accent = tone === "location" ? "#2baf83" : tone === "call" ? "#356edb" : tone === "person" || tone === "suspect" ? "#d64a4a" : tone === "evidence" || tone === "finding" ? "#d99a20" : "#77736c";
  const anchorType: AnnotationAnchorType = tone === "location" ? "location" : tone === "person" || tone === "suspect" ? "person" : tone === "evidence" || tone === "finding" ? "evidence" : "board-item";
  const targetObjectId = `${id}-target`;
  return <>
    <SceneTargetAnchor id={targetObjectId} position={position} avoidRadius={primary ? 58 : 46}>
      {anchorType === "location" ? <group><mesh position={[0,.11,0]}><coneGeometry args={[.12,.32,20]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={.22} /></mesh><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.16,.21,28]} /><meshBasicMaterial color={accent} /></mesh></group>
        : <group rotation={[0,0,(id.length%3-1)*.035]}><mesh><boxGeometry args={[primary?.72:.58,primary?.46:.38,.045]} /><meshStandardMaterial color="#f3efe4" roughness={.88} /></mesh><mesh position={[-(primary?.29:.22),0,.026]}><boxGeometry args={[.055,primary?.34:.28,.012]} /><meshBasicMaterial color={accent} /></mesh><mesh position={[0,primary?.18:.14,.035]}><cylinderGeometry args={[.04,.04,.035,16]} /><meshStandardMaterial color={accent} metalness={.2} /></mesh></group>}
    </SceneTargetAnchor>
    <ScreenSpaceAnnotation id={id} targetObjectId={targetObjectId} anchorType={anchorType} priority={priority} lanes={lanes} width={primary ? 244 : 218} height={primary ? 96 : 84} gap={primary ? 22 : 16} accent={accent}>
      <InvestigationCard eyebrow={eyebrow} title={title} subtitle={subtitle} metadata={metadata} tone={tone} primary={primary} />
    </ScreenSpaceAnnotation>
  </>;
}

function StageCard({ event, beat, cluePosition = [0, 1.15, 0] }: {
  event: ReplayEvent; beat: CinematicBeat; cluePosition?: [number, number, number]; consequencePosition?: [number, number, number]; transitionPosition?: [number, number, number];
}) {
  const copy = CLUE_COPY[event.sourceTimelineId];
  if (!copy) return null;
  return <>
    <CinematicReveal amount={beat.value("CLUE REVEAL")} reducedMotion={false}>
      <Annotation id={`${event.sourceTimelineId}-clue`} position={cluePosition} eyebrow="CLUE REVEAL" title={copy.clue} subtitle={copy.detail} tone="finding" priority={100} lanes={["TOP", "TOP_RIGHT", "LEFT"]} primary />
    </CinematicReveal>
  </>;
}

function WorkSurface({ children }: { children: ReactNode }) {
  return <group><mesh position={[0, 0.76, 0]}><boxGeometry args={[6.4, 0.18, 3.3]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh><mesh position={[0, 0.88, 0]}><boxGeometry args={[6.12, 0.08, 3.02]} /><meshStandardMaterial {...crimeLens3DTheme.materials.paper} /></mesh>{[-2.8, 2.8].flatMap(x => [-1.3, 1.3].map(z => <mesh key={`${x}-${z}`} position={[x, 0.34, z]}><boxGeometry args={[0.13, 0.72, 0.13]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh>))}{children}</group>;
}

function CrimeLensCaseBoard({ width = 7.5 }: { width?: number }) {
  const half = width / 2;
  return <group position={[0, 2.15, -3.18]}>
    <mesh><boxGeometry args={[width, 3.4, 0.16]} /><meshStandardMaterial color="#B9AD94" roughness={0.92} /></mesh>
    <mesh position={[0, 1.72, 0.05]}><boxGeometry args={[width + 0.18, 0.12, 0.2]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh>
    <mesh position={[0, -1.72, 0.05]}><boxGeometry args={[width + 0.18, 0.12, 0.2]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh>
    {[-half - 0.04, half + 0.04].map(x => <mesh key={x} position={[x, 0, 0.05]}><boxGeometry args={[0.12, 3.52, 0.2]} /><meshStandardMaterial {...crimeLens3DTheme.materials.charcoalMetal} /></mesh>)}
  </group>;
}

function ForensicObject({ event, action, reveal }: { event: ReplayEvent; action: number; reveal: number }) {
  const id = event.sourceTimelineId;
  if (id === "TL-014") return <group position={[0, 1.03, 0]} rotation={[0, action * 0.08, 0]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.2, 1.45]} /><meshStandardMaterial color="#e7e1d2" /></mesh>
    <AnimatedConnector points={[[-0.82, 0.04, 0.42], [-0.2, 0.07, 0.05], [0.78, 0.09, -0.46]]} color="#356edb" progress={reveal} reducedMotion={false} />
    <group position={[0.72, 0.16, -0.36]}><mesh><boxGeometry args={[0.58, 0.16, 0.38]} /><meshStandardMaterial color="#303633" /></mesh><mesh position={[0, 0.09, 0]}><boxGeometry args={[0.42, 0.025, 0.25]} /><meshBasicMaterial color="#9db6a8" /></mesh></group>
  </group>;
  const count = id === "TL-011" ? 3 : 2;
  return <group position={[0, 1.05, 0]} rotation={[0, action * 0.08, 0]}>
    {Array.from({ length: count }, (_, index) => <group key={index} position={[(index - (count - 1) / 2) * 0.78, reveal * 0.08 * index, index % 2 ? 0.12 : -0.08]} rotation={[0, 0.06 * (index - 1), 0]}>
      <mesh><boxGeometry args={[0.56, 0.11, 1.05]} /><meshStandardMaterial color="#272b2a" metalness={0.25} roughness={0.5} /></mesh>
      <mesh position={[0, 0.065, -0.04]}><boxGeometry args={[0.43, 0.016, 0.72]} /><meshBasicMaterial color={index === 0 ? "#9fb9ad" : "#bbb8ad"} /></mesh>
    </group>)}
  </group>;
}

function ForensicFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const scanner = useRef<THREE.Mesh>(null);
  const action = beat.value("ACTION");
  const reveal = beat.value("CLUE REVEAL");
  useFrame(() => { if (scanner.current) scanner.current.position.x = -1.4 + reveal * 2.8; });
  return <ForensicLabKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} /><WorkSurface>
    <ForensicObject event={event} action={action} reveal={reveal} />
    <mesh position={[-1.72, 0.96, 0.72]} rotation={[-Math.PI / 2, 0, 0.08]}><planeGeometry args={[1.45, 0.92]} /><meshPhysicalMaterial color="#dfe5df" transparent opacity={0.42} /></mesh>
    <mesh position={[1.55, 0.96, 0.76]}><boxGeometry args={[1.8, 0.055, 0.34]} /><meshStandardMaterial color="#eee9df" /></mesh>
    {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[0.82 + i * 0.09, 1.005, 0.84]}><boxGeometry args={[0.01, 0.008, i % 5 === 0 ? 0.19 : 0.12]} /><meshBasicMaterial color="#333633" /></mesh>)}
    <group position={[-1.1, 1.22, -0.72]} rotation={[0.1, 0, 0.25]}><mesh><torusGeometry args={[0.3, 0.05, 12, 32]} /><meshStandardMaterial color="#626966" metalness={0.4} /></mesh><mesh position={[0, -0.42, 0]}><cylinderGeometry args={[0.035, 0.035, 0.56, 12]} /><meshStandardMaterial color="#626966" /></mesh></group>
    <mesh ref={scanner} position={[-1.4, 1.17, 0]}><boxGeometry args={[0.075, 0.018, 1.0]} /><meshBasicMaterial color="#f3c74b" transparent opacity={0.72} /></mesh>
  </WorkSurface><StageCard event={event} beat={beat} cluePosition={[0,1.08,0]} /><FocusBeacon position={[0, 0.92, 0]} color="#d99a20" progress={reveal} reducedMotion={reducedMotion} radius={0.72} /></ForensicLabKit>;
}

function AccessRecordFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const highlight = beat.value("ACTION");
  return <EvidenceRoomKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} /><WorkSurface>
    <group position={[-0.35, 1.0, 0]} rotation={[0, -0.08, 0]}><mesh><boxGeometry args={[2.7, 0.12, 1.85]} /><meshStandardMaterial color="#4e382b" /></mesh><mesh position={[0, 0.08, 0]}><boxGeometry args={[2.38, 0.045, 1.56]} /><meshStandardMaterial color="#e4dcc8" /></mesh>{Array.from({ length: 6 }, (_, i) => <mesh key={i} position={[0, 0.115, -0.58 + i * 0.23]}><boxGeometry args={[2.1, i === 3 ? 0.035 + highlight * 0.025 : 0.018, 0.035]} /><meshBasicMaterial color={i === 3 ? "#d99a20" : "#89857b"} /></mesh>)}</group>
    <group position={[1.62, 1.12, 0.45]} rotation={[0, -0.16, 0]}><mesh><boxGeometry args={[0.72, 0.08, 1.08]} /><meshStandardMaterial color="#405b78" /></mesh><mesh position={[0, 0.055, 0]}><boxGeometry args={[0.52, 0.02, 0.78]} /><meshBasicMaterial color="#f0ede3" /></mesh></group>
    <group position={[-2.1, 1.05, -0.65]}><mesh><boxGeometry args={[0.82, 0.12, 0.64]} /><meshStandardMaterial color="#777d79" /></mesh><mesh position={[0, 0.08, 0.12]}><boxGeometry args={[0.58, 0.02, 0.18]} /><meshBasicMaterial color="#9ec2ac" /></mesh></group>
  </WorkSurface><StageCard event={event} beat={beat} cluePosition={[-.35,1.12,0]} /></EvidenceRoomKit>;
}

function LocationFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const action = beat.value("ACTION");
  const people = event.people.slice(0, 2);
  return <StreetKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    {people.map((person, i) => <CinematicReveal key={person.entityId} amount={beat.value("ESTABLISH")} reducedMotion={reducedMotion} position={[i === 0 ? -0.9 + action * 0.18 : 1.1, 0, i === 0 ? 0.55 : 0.18]}><CinematicHuman person={person} position={[0, 0, 0]} rotationY={i === 0 ? 0.22 : -0.3} labelSide={i === 0 ? "left" : "right"} action={i === 0 ? "shortWalk" : "conversationIdle"} actionProgress={action} showLabel={beat.value("CONSEQUENCE") > 0.03} reducedMotion={reducedMotion} /></CinematicReveal>)}
    <group position={[2.8, 2.6, -2.75]} rotation={[0, -0.3, 0]}><mesh><boxGeometry args={[0.48, 0.3, 0.42]} /><meshStandardMaterial color="#6f7572" /></mesh><mesh position={[0, 0, 0.28]}><cylinderGeometry args={[0.11, 0.15, 0.26, 16]} /><meshStandardMaterial color="#292d2b" /></mesh></group>
    <StageCard event={event} beat={beat} cluePosition={[2.75, 2.55, -2.6]} consequencePosition={[-2.7, 2.0, -2.5]} transitionPosition={[3.55, 1.7, -1.7]} />
    <FocusBeacon position={[0.2, 0.03, -0.35]} color="#d99a20" progress={beat.value("CLUE REVEAL")} reducedMotion={reducedMotion} radius={0.68} />
  </StreetKit>;
}

function DetentionFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const primary = event.people[0];
  const supporting = event.people[1];
  const action = beat.value("ACTION");
  return <StreetKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    {primary && <group position={[-0.75 + action * 0.12, 0, 0.45]}><CinematicHuman person={primary} position={[0, 0, 0]} rotationY={0.34} labelSide="left" active action="conversationIdle" actionProgress={action} showLabel={beat.value("CONSEQUENCE") > 0.02} reducedMotion={reducedMotion} /></group>}
    {supporting && <group position={[1.2 - action * 0.24, 0, 0.05]}><CinematicHuman person={supporting} position={[0, 0, 0]} rotationY={-0.34} labelSide="right" action="officerApproach" actionProgress={action} showLabel={beat.value("CONSEQUENCE") > 0.02} reducedMotion={reducedMotion} /></group>}
    <group position={[3.1, 0, 0.85]}>
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[2.75, 0.82, 1.18]} /><meshStandardMaterial color="#59615f" roughness={0.72} /></mesh>
      <mesh position={[-0.35, 1.05, 0]}><boxGeometry args={[1.45, 0.5, 1.02]} /><meshStandardMaterial color="#64706e" roughness={0.68} /></mesh>
      {[-0.88, 0.86].map(x => [-0.56, 0.56].map(z => <mesh key={`${x}-${z}`} position={[x, 0.28, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.25, 0.25, 0.18, 20]} /><meshStandardMaterial color="#282c2a" /></mesh>))}
      <mesh position={[-0.38, 1.08, 0.52]}><boxGeometry args={[1.12, 0.32, 0.035]} /><meshPhysicalMaterial color="#abc1c1" transparent opacity={0.72} /></mesh>
    </group>
    <group position={[-4.25, 0, -1.75]}>{[-0.55,0,0.55].map(x => <mesh key={x} position={[x,0.62,0]}><cylinderGeometry args={[0.09,0.12,1.24,14]} /><meshStandardMaterial color="#ab8a35" /></mesh>)}<mesh position={[0,1.16,0]}><boxGeometry args={[1.4,0.3,0.08]} /><meshStandardMaterial color="#4d514e" /></mesh><Html transform center position={[0,1.16,0.05]} distanceFactor={8}><div className="case-replay-restricted-sign">RESPONSE ZONE / COORDINATION</div></Html></group>
    <group position={[-2.45,0,-2.85]}>{[-1,0,1].map(x => <mesh key={x} position={[x,0.55,0]}><boxGeometry args={[0.08,1.1,0.08]} /><meshStandardMaterial color="#666d69" /></mesh>)}<mesh position={[0,1.05,0]}><boxGeometry args={[2.1,0.08,0.08]} /><meshStandardMaterial color="#666d69" /></mesh></group>
    <StageCard event={event} beat={beat} cluePosition={[0.1, 2.5, -1.1]} consequencePosition={[-2.8, 1.9, -1.8]} transitionPosition={[3.2, 2.0, -1.7]} />
  </StreetKit>;
}

function BoardFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const copy = CLUE_COPY[event.sourceTimelineId];
  const supporting = event.sourceTimelineId === "TL-004"
    ? ["EMERGENCY CALLS", "CONFIRMED SITES"]
    : event.sourceTimelineId === "TL-010"
      ? ["DEPLOYMENT RECORD", "LOCATION STATUS"]
      : ["OPERATION LOG", "SITE STATUS"];
  return <InvestigationRoomKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} /><CrimeLensCaseBoard />
    <group position={[-2.7,.93,.12]}>
      <group position={[-.78,.04,.18]} rotation={[0,-.12,0]}>{[0,.08,.16].map((y,index)=><mesh key={y} position={[0,y,0]}><boxGeometry args={[1.15,.07,.78]} /><meshStandardMaterial color={index===2?"#e6dfcf":index===1?"#83765f":"#5e5549"} roughness={.86} /></mesh>)}</group>
      <group position={[.52,.16,-.28]} rotation={[0,.18,0]}><mesh><boxGeometry args={[.72,.32,.48]} /><meshStandardMaterial color="#394441" roughness={.62} metalness={.2} /></mesh><mesh position={[0,.18,0]}><cylinderGeometry args={[.035,.035,.55,10]} /><meshStandardMaterial color="#272d2b" /></mesh><mesh position={[0,.05,.25]}><boxGeometry args={[.48,.08,.025]} /><meshBasicMaterial color="#8eb2a1" /></mesh></group>
      <mesh position={[.28,.02,.62]} rotation={[-Math.PI/2,0,-.12]}><planeGeometry args={[1.35,.82]} /><meshStandardMaterial color="#eee8da" /></mesh>
      <mesh position={[.28,.035,.62]} rotation={[-Math.PI/2,0,-.12]}><ringGeometry args={[.2,.23,28]} /><meshBasicMaterial color="#d99a20" /></mesh>
    </group>
    <Annotation id={`${event.sourceTimelineId}-board-record`} position={[-2.45, 2.55, -3.0]} eyebrow="RECORD" title={supporting[0]} subtitle="DOCUMENTED SOURCE" tone="record" priority={70} lanes={["LEFT", "TOP_LEFT"]} />
    <Annotation id={`${event.sourceTimelineId}-board-status`} position={[0.95, 2.75, -3.0]} eyebrow="CORROBORATION" title={supporting[1]} subtitle="VERIFIED STATUS" tone="evidence" priority={65} lanes={["RIGHT", "TOP_RIGHT"]} />
    <CinematicReveal amount={beat.value("CLUE REVEAL")} reducedMotion={reducedMotion}><Annotation id={`${event.sourceTimelineId}-board-clue`} position={[0, 2.1, -2.95]} eyebrow="CLUE REVEAL" title={copy.clue} subtitle={copy.detail} tone="finding" priority={100} lanes={["TOP", "LEFT", "RIGHT"]} primary /></CinematicReveal>
    <AnimatedConnector points={[[-2.2, 2.5, -3], [0, 2.16, -2.94], [2.2, 2.5, -3]]} color="#d99a20" progress={beat.value("ACTION")} reducedMotion={reducedMotion} />
  </InvestigationRoomKit>;
}

function RelationshipFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const copy = CLUE_COPY[event.sourceTimelineId];
  const evidenceTitle = event.evidence[0]?.label ?? "EMERGENCY REPORTS";
  const subjectTitle = event.knowledgeLabel ?? event.people[0]?.name ?? "IDENTITY UNDER REVIEW";
  const contextTitle = event.location?.label ?? event.people.at(-1)?.name ?? "SUPPORTING RECORD";
  return <InvestigationRoomKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    <Annotation id={`${event.sourceTimelineId}-source`} position={[-3.2, 2.4, -1.5]} eyebrow="SOURCE RECORD" title={evidenceTitle} subtitle={event.category} tone="evidence" priority={72} lanes={["LEFT", "TOP_LEFT"]} />
    <CinematicReveal amount={beat.value("CLUE REVEAL")} reducedMotion={reducedMotion}><Annotation id={`${event.sourceTimelineId}-identity`} position={[0, 2.05, -1.0]} eyebrow="CLUE REVEAL" title={copy.clue} subtitle={subjectTitle} tone="person" priority={100} lanes={["TOP", "TOP_RIGHT", "LEFT"]} primary /></CinematicReveal>
    <CinematicReveal amount={beat.value("CONSEQUENCE")} reducedMotion={reducedMotion}><Annotation id={`${event.sourceTimelineId}-context`} position={[3.15, 2.38, -1.45]} eyebrow="CONSEQUENCE" title={copy.consequence} subtitle={contextTitle} tone="record" priority={70} lanes={["RIGHT", "TOP_RIGHT"]} /></CinematicReveal>
    <AnimatedConnector points={[[-3.15, 2.38, -1.45], [0, 2.05, -0.98], [3.15, 2.38, -1.43]]} color="#d64a4a" progress={beat.value("CONSEQUENCE")} reducedMotion={reducedMotion} />
    <CinematicReveal amount={beat.value("TRANSITION")} reducedMotion={reducedMotion}><Annotation id={`${event.sourceTimelineId}-next`} position={[3.45, 0.95, -0.65]} eyebrow="CLUE HANDOFF" title={copy.next} subtitle="NEXT INVESTIGATIVE VIEW" tone="location" priority={40} lanes={["RIGHT", "BOTTOM_RIGHT"]} /></CinematicReveal>
  </InvestigationRoomKit>;
}

function MapRouteFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const route = beat.value("ACTION");
  return <StreetKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    {event.sourceTimelineId === "TL-001" && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.8, 0.035, -0.4]}><planeGeometry args={[3.1, 8]} /><meshStandardMaterial color="#667d80" roughness={0.86} /></mesh>}
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, -0.4]}><mesh><planeGeometry args={[8.6, 5.1]} /><meshStandardMaterial color="#c8c4b9" /></mesh><mesh position={[0, 0, 0.02]}><planeGeometry args={[1.5, 5.1]} /><meshBasicMaterial color="#707673" /></mesh>{[-1.6, 0, 1.6].map(z => <mesh key={z} position={[0, z, 0.04]}><planeGeometry args={[0.08, 0.58]} /><meshBasicMaterial color="#e8dfb7" /></mesh>)}</group>
    {[[-3.2,-2.2],[-3.15,1.45],[2.95,-2.15],[3.1,1.4]].map(([x,z],i)=><group key={i} position={[x,0.7,z]}><mesh><boxGeometry args={[1.7,1.4,1.2]} /><meshStandardMaterial color={i===3?"#b9aa8c":"#b4b3ad"} /></mesh><mesh position={[0,0.1,0.62]}><boxGeometry args={[1.1,0.45,0.05]} /><meshBasicMaterial color={i===3?"#d9c48e":"#d7ddd8"} /></mesh></group>)}
    <AnimatedConnector points={[[-2.6, 0.16, 1.4], [-1.2, 0.18, 0.7], [0, 0.2, -0.2], [1.45, 0.22, -0.9], [3.0, 0.25, -1.4]]} color="#d99a20" progress={route} reducedMotion={reducedMotion} opacity={0.96} />
    <StageCard event={event} beat={beat} cluePosition={[3.0, 2.2, -1.45]} consequencePosition={[-2.8, 1.8, 0.8]} transitionPosition={[2.5, 1.2, 1.2]} />
  </StreetKit>;
}

function MaritimeFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const route = beat.value("ACTION");
  return <group>
    <BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}><planeGeometry args={[30, 24, 28, 28]} /><meshStandardMaterial color="#263d44" roughness={0.86} metalness={0.08} /></mesh>
    {Array.from({ length: 9 }, (_, index) => <mesh key={index} position={[-7 + index * 1.8, -0.06, -2.8 + (index % 3) * 2.5]} rotation={[-Math.PI / 2, 0, 0.2]}><planeGeometry args={[1.2, 0.035]} /><meshBasicMaterial color="#a9c2c1" transparent opacity={0.18} /></mesh>)}
    <group position={[-0.75 + route * 0.8, 0.42, -0.25]} rotation={[0, -0.28, 0]}>
      <mesh><boxGeometry args={[3.6, 0.52, 1.28]} /><meshStandardMaterial color="#4f5858" metalness={0.22} roughness={0.62} /></mesh>
      <mesh position={[0.42, 0.58, 0]}><boxGeometry args={[1.32, 0.72, 1.0]} /><meshStandardMaterial color="#697270" roughness={0.7} /></mesh>
      <mesh position={[-0.86, 0.54, 0]}><boxGeometry args={[0.12, 1.3, 0.12]} /><meshStandardMaterial color="#292f2f" /></mesh>
      <mesh position={[0.42, 0.64, 0.52]}><boxGeometry args={[0.82, 0.3, 0.035]} /><meshPhysicalMaterial color="#b9d5d1" transparent opacity={0.5} /></mesh>
    </group>
    <group position={[4.8, 0, -3.2]}>{[0, 0.8, 1.6, 2.4].map((y, index) => <mesh key={y} position={[0, y + 0.48, 0]}><boxGeometry args={[1.7 - index * 0.18, 0.72, 0.7]} /><meshStandardMaterial color="#c4b994" roughness={0.85} /></mesh>)}<mesh position={[0, 3.42, 0]}><sphereGeometry args={[0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#c6b78a" /></mesh></group>
    <AnimatedConnector points={[[-5.5, 0.14, 2.5], [-2.4, 0.22, 1.0], [0, 0.3, -0.25], [2.6, 0.36, -1.8], [4.6, 0.42, -3.05]]} color="#f4c94f" progress={route} reducedMotion={reducedMotion} opacity={0.96} />
    <StageCard event={event} beat={beat} cluePosition={[0, 2.7, -1.1]} consequencePosition={[-3.8, 2.0, 0.4]} transitionPosition={[4.5, 2.0, -2.8]} />
  </group>;
}

function CoastalLandingFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const action = beat.value("ACTION");
  return <group>
    <BeatSlate beat={beat} eventId={event.sourceTimelineId} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, -0.12, 0]}><planeGeometry args={[7, 18]} /><meshStandardMaterial color="#344e54" roughness={0.88} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2.8, -0.06, 0]}><planeGeometry args={[8, 18]} /><meshStandardMaterial color="#777b76" roughness={0.94} /></mesh>
    <mesh position={[-0.65, 0.12, 0]}><boxGeometry args={[0.42, 0.24, 16]} /><meshStandardMaterial color="#b8b0a0" /></mesh>
    {[-3.2, -1.7, -0.15].map((z, index) => <group key={z} position={[2.5 + index * 1.25, 0.7, z]}><mesh><boxGeometry args={[1.75, 1.4 + index * 0.45, 1.35]} /><meshStandardMaterial color={index === 1 ? "#a99776" : "#b8b4aa"} /></mesh><mesh position={[0, 0.05, 0.69]}><boxGeometry args={[1.05, 0.36, 0.04]} /><meshBasicMaterial color="#d7ddd8" /></mesh></group>)}
    <group position={[-2.6 + action * 0.55, 0.16, 0.8]} rotation={[0, -0.2, 0]}><mesh><boxGeometry args={[1.9, 0.28, 0.82]} /><meshStandardMaterial color="#4b5555" /></mesh><mesh position={[0.35, 0.33, 0]}><boxGeometry args={[0.72, 0.45, 0.62]} /><meshStandardMaterial color="#66706e" /></mesh></group>
    <AnimatedConnector points={[[-3.3, 0.18, 0.8], [-1.2, 0.28, 0.3], [0.4, 0.32, -0.1], [2.4, 0.34, -1.6], [4.2, 0.38, -2.8]]} color="#f4c94f" progress={action} reducedMotion={reducedMotion} />
    <StageCard event={event} beat={beat} cluePosition={[-0.6, 2.55, -0.8]} consequencePosition={[-3.4, 1.85, 0.9]} transitionPosition={[3.8, 2.1, -2.6]} />
  </group>;
}

function CaseEvidenceChain({ beat, reducedMotion }: { beat: CinematicBeat; reducedMotion: boolean }) {
  const establish = beat.value("ESTABLISH");
  const action = beat.value("ACTION");
  const clue = beat.value("CLUE REVEAL");
  const consequence = beat.value("CONSEQUENCE");
  const transition = beat.value("TRANSITION");
  return <InvestigationRoomKit><CrimeLensCaseBoard width={9.1} />
    <CinematicReveal amount={establish} reducedMotion={reducedMotion}>
      <Annotation id="chain-kuber" position={[-3.4,3.42,-3]} eyebrow="MARITIME EVIDENCE" title="MV KUBER" subtitle="VESSEL / ROUTE RECORD" tone="evidence" priority={94} lanes={["TOP_LEFT","LEFT","TOP"]} />
      <Annotation id="chain-badhwar" position={[-3.4,2.75,-3]} eyebrow="LANDING / MOVEMENT" title="BADHWAR PARK" subtitle="COASTAL LANDING" tone="location" priority={92} lanes={["LEFT","TOP_LEFT"]} />
    </CinematicReveal>
    <AnimatedConnector points={[[ -3.4,3.27,-2.92],[-3.4,2.9,-2.92]]} color="#356edb" progress={establish} reducedMotion={reducedMotion} />
    <CinematicReveal amount={action} reducedMotion={reducedMotion}>
      <Annotation id="chain-kasab" position={[-3.4,2.08,-3]} eyebrow="IDENTITY RECORD" title="AJMAL KASAB" subtitle="CONFIRMED IDENTITY" tone="suspect" priority={96} lanes={["LEFT","TOP_LEFT"]} />
      <Annotation id="chain-ismail" position={[-.72,2.08,-3]} eyebrow="RELATED ENTITY" title="ISMAIL KHAN" subtitle="DOCUMENTED ASSOCIATION" tone="person" priority={84} lanes={["TOP","RIGHT"]} />
    </CinematicReveal>
    <AnimatedConnector points={[[ -3.4,2.62,-2.92],[-3.4,2.2,-2.92]]} color="#d99a20" progress={action} reducedMotion={reducedMotion} />
    <AnimatedConnector points={[[ -3.18,2.08,-2.92],[-.94,2.08,-2.92]]} color="#d64545" progress={action} reducedMotion={reducedMotion} />
    <CinematicReveal amount={clue} reducedMotion={reducedMotion}>
      <Annotation id="chain-cst" position={[-3.4,1.4,-3]} eyebrow="ATTACK SITE" title="CST" subtitle="INITIAL INCIDENT RECORD" tone="location" priority={98} lanes={["LEFT","BOTTOM_LEFT"]} />
      <Annotation id="chain-cctv" position={[-.72,1.4,-3]} eyebrow="VISUAL EVIDENCE" title="CCTV / PHOTO" subtitle="LOCATION CORROBORATION" tone="evidence" priority={90} lanes={["RIGHT","TOP_RIGHT"]} />
    </CinematicReveal>
    <AnimatedConnector points={[[ -3.4,1.96,-2.92],[-3.4,1.52,-2.92]]} color="#d64545" progress={clue} reducedMotion={reducedMotion} />
    <AnimatedConnector points={[[ -.72,1.96,-2.92],[-.72,1.52,-2.92]]} color="#d99a20" progress={clue} reducedMotion={reducedMotion} />
    <AnimatedConnector points={[[ -3.18,1.4,-2.92],[-.94,1.4,-2.92]]} color="#d99a20" progress={clue} reducedMotion={reducedMotion} />
    <CinematicReveal amount={consequence} reducedMotion={reducedMotion}>
      <Annotation id="chain-cama" position={[-3.4,.74,-3]} eyebrow="MOVEMENT" title="CAMA HOSPITAL" subtitle="LOCATION SEQUENCE" tone="location" priority={86} lanes={["LEFT","BOTTOM_LEFT"]} />
      <Annotation id="chain-chowpatty" position={[-.72,.74,-3]} eyebrow="CAPTURE / RESPONSE" title="GIRGAUM CHOWPATTY" subtitle="DOCUMENTED END POINT" tone="location" priority={100} lanes={["BOTTOM","RIGHT"]} />
    </CinematicReveal>
    <AnimatedConnector points={[[ -3.4,1.28,-2.92],[-3.4,.86,-2.92],[-.94,.74,-2.92]]} color="#2baf83" progress={consequence} reducedMotion={reducedMotion} />
    <CinematicReveal amount={transition} reducedMotion={reducedMotion}>
      <Annotation id="chain-communications" position={[2.45,.86,-2.9]} eyebrow="COMMUNICATION EVIDENCE" title="RECOVERED DIGITAL LINKS" subtitle="CALL / DEVICE RECORDS" tone="call" priority={100} lanes={["RIGHT","TOP_RIGHT"]} primary />
    </CinematicReveal>
    <AnimatedConnector points={[[ -.5,.74,-2.9],[.85,.78,-2.86],[2.2,.86,-2.82]]} color="#356edb" progress={transition} reducedMotion={reducedMotion} />
  </InvestigationRoomKit>;
}

function SynthesisFamily({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  if (event.sourceTimelineId === "TL-016") return <CaseEvidenceChain beat={beat} reducedMotion={reducedMotion} />;
  const copy = CLUE_COPY[event.sourceTimelineId];
  const convergence = beat.value("ACTION");
  return <InvestigationRoomKit><BeatSlate beat={beat} eventId={event.sourceTimelineId} /><CrimeLensCaseBoard width={8.2} />
    <Annotation id="synth-locations" position={[-3.1, 2.65, -3]} eyebrow="LOCATION RECORD" title="MAJOR MUMBAI SITES" subtitle="DOCUMENTED SEQUENCE" tone="record" priority={70} lanes={["LEFT", "TOP_LEFT"]} />
    <Annotation id="synth-devices" position={[0.9, 2.72, -3]} eyebrow="DIGITAL EVIDENCE" title="RECOVERED PHONES" subtitle="COMMUNICATION LINKS" tone="evidence" priority={70} lanes={["RIGHT", "TOP_RIGHT"]} />
    <Annotation id="synth-route" position={[-2.6, 1.15, -2.8]} eyebrow="MARITIME EVIDENCE" title="VESSEL + NAVIGATION" subtitle="ROUTE CORROBORATION" tone="evidence" priority={68} lanes={["LEFT", "BOTTOM_LEFT"]} />
    <Annotation id="synth-timeline" position={[2.8, 1.18, -2.8]} eyebrow="TIMELINE" title="26–29 NOVEMBER" subtitle="EVENT PROGRESSION" tone="record" priority={66} lanes={["RIGHT", "BOTTOM_RIGHT"]} />
    <Annotation id="synth-relationships" position={[3.05, 2.62, -2.96]} eyebrow="RELATIONSHIPS" title="COMMUNICATION + IDENTITY" subtitle="SUPPORTED LINKS" tone="person" priority={69} lanes={["RIGHT", "TOP_RIGHT"]} />
    <AnimatedConnector points={[[-3,2.6,-3],[0,2,-2.85],[3,2.6,-3]]} color="#d99a20" progress={convergence} reducedMotion={reducedMotion} />
    <AnimatedConnector points={[[-2.5,1.2,-2.8],[0,2,-2.85]]} color="#356edb" progress={convergence} reducedMotion={reducedMotion} />
    <CinematicReveal amount={beat.value("CLUE REVEAL")} reducedMotion={reducedMotion}><Annotation id="synth-active" position={[0, 2.0, -2.75]} eyebrow="CLUE REVEAL" title={copy.clue} subtitle={copy.detail} tone="finding" priority={100} lanes={["TOP", "RIGHT", "LEFT"]} primary /></CinematicReveal>
    <CinematicReveal amount={beat.value("CONSEQUENCE")} reducedMotion={reducedMotion}><Annotation id="synth-result" position={[0.82, 0.98, -2.6]} eyebrow="CONSEQUENCE" title={copy.consequence} subtitle="SUPPORTED RECONSTRUCTION" tone="location" priority={76} lanes={["RIGHT", "BOTTOM_RIGHT"]} /></CinematicReveal>
  </InvestigationRoomKit>;
}

export function ReplaySceneFamilyRenderer({ event, progress, reducedMotion }: { event: ReplayEvent; progress: number; reducedMotion: boolean }) {
  const family = EVENT_SCENE_FAMILY[event.sourceTimelineId];
  return <CinematicBeatController progress={progress}>{beat => {
    const cameraFrames = family === "MARITIME_RECONSTRUCTION" ? MARITIME_CAMERA : family === "COASTAL_LANDING_RECONSTRUCTION" ? COASTAL_CAMERA : family === "MUMBAI_CASE_MAP" ? MUMBAI_MAP_CAMERA : family === "CST_LEOPOLD_RECONSTRUCTION" ? event.sourceTimelineId === "TL-005" ? LEOPOLD_CAMERA : CST_LEOPOLD_CAMERA : family === "TAJ_RECONSTRUCTION" || family === "OBEROI_NARIMAN_RECONSTRUCTION" ? LANDMARK_CAMERA : family === "FORENSIC_EVIDENCE" ? FORENSIC_LAB_KIT.cameraAnchors : family === "ACCESS_RECORD_REVIEW" ? EVIDENCE_ROOM_KIT.cameraAnchors : family === "LOCATION_RECONSTRUCTION" || family === "DETENTION_OFFICER_INTERACTION" || family === "MAP_ROUTE" || family === "CITY_RESPONSE_RECONSTRUCTION" || family === "SPECIALIST_RESPONSE_RECONSTRUCTION" ? STREET_KIT.cameraAnchors : INVESTIGATION_ROOM_KIT.cameraAnchors;
    return <><CinematicBeatCamera beat={beat} frames={cameraFrames} reducedMotion={reducedMotion} />
      {family === "MARITIME_RECONSTRUCTION" && <MaritimeReconstructionScene event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "COASTAL_LANDING_RECONSTRUCTION" && <CoastalLandingScene event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "MUMBAI_CASE_MAP" && <color attach="background" args={["#e9e5da"]} />}
      {family === "CST_LEOPOLD_RECONSTRUCTION" && <CSTLeopoldReconstruction event={event} beat={beat} />}
      {family === "CITY_RESPONSE_RECONSTRUCTION" && <CityResponseReconstruction event={event} beat={beat} />}
      {family === "TAJ_RECONSTRUCTION" && <TajReconstruction event={event} beat={beat} />}
      {family === "OBEROI_NARIMAN_RECONSTRUCTION" && <OberoiNarimanReconstruction event={event} beat={beat} />}
      {family === "SPECIALIST_RESPONSE_RECONSTRUCTION" && <CityResponseReconstruction event={event} beat={beat} specialist />}
      {family === "FORENSIC_EVIDENCE" && <ForensicFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "ACCESS_RECORD_REVIEW" && <AccessRecordFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "LOCATION_RECONSTRUCTION" && <LocationFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "DETENTION_OFFICER_INTERACTION" && <DetentionFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "INVESTIGATION_BOARD" && <BoardFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "RELATIONSHIP_INTELLIGENCE" && <RelationshipFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "MAP_ROUTE" && <MapRouteFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
      {family === "CASE_SYNTHESIS" && <SynthesisFamily event={event} beat={beat} reducedMotion={reducedMotion} />}
    </>;
  }}</CinematicBeatController>;
}
