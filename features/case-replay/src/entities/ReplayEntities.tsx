"use client";

import { Float } from "@react-three/drei";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import type { ReplayEvidence, ReplayPerson } from "@replay/types";
import { SceneTargetAnchor, ScreenSpaceAnnotation } from "@replay/components/AnnotationLayoutManager";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";

const ROLE_COLORS: Record<ReplayPerson["role"], string> = {
  victim: "#B8B3A8",
  suspect: "#66635D",
  witness: "#737A7E",
  investigator: "#D8D4CA",
  officer: "#34495C",
};

export type CinematicHumanAction = "idleShift" | "shortWalk" | "conversationIdle" | "inspectEvidence" | "officerApproach" | "stopAndFace" | "boardReview";

export function ForensicAnnotation({
  title,
  detail,
  tone = "neutral",
  side,
}: {
  title: string;
  detail: string;
  tone?: "neutral" | "evidence" | "location" | "communication" | "suspect";
  side?: "left" | "right";
}) {
  return (
    <InvestigationCard
      className="case-replay-forensic-annotation"
      title={title}
      subtitle={detail}
      tone={tone === "communication" ? "call" : tone}
      compact
      leaderSide={side}
    />
  );
}

export function CinematicHuman({
  person,
  position,
  rotationY = 0,
  labelSide = "left",
  active = false,
  reducedMotion = false,
  showLabel = true,
  action = "idleShift",
  actionProgress = 0,
}: {
  person: ReplayPerson;
  position: [number, number, number];
  rotationY?: number;
  labelSide?: "left" | "right";
  active?: boolean;
  reducedMotion?: boolean;
  showLabel?: boolean;
  action?: CinematicHumanAction;
  actionProgress?: number;
}) {
  const clothing = ROLE_COLORS[person.role];
  const trousers = person.role === "officer" ? "#263b4d" : person.role === "investigator" ? "#514c42" : "#414440";
  const skin = person.entityId === "sus-ada" ? "#8f6d59" : person.entityId === "sus-vale" ? "#c39b7e" : "#b79d87";
  const labelX = labelSide === "left" ? -0.64 : 0.64;
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!root.current || !body.current || !head.current || reducedMotion) return;
    const offset = person.entityId.split("").reduce((sum, value) => sum + value.charCodeAt(0), 0) * 0.03;
    const time = clock.getElapsedTime() + offset;
    root.current.position.x = position[0] + Math.sin(time * 0.38) * 0.006;
    root.current.position.y = position[1] + Math.sin(time * 1.18) * 0.008;
    root.current.rotation.y = rotationY + Math.sin(time * 0.34) * 0.035;
    body.current.scale.y = 1 + Math.sin(time * 1.18) * 0.008;
    const walking = action === "shortWalk" || action === "officerApproach";
    const gait = walking ? Math.sin(actionProgress * Math.PI * 4) * 0.38 : Math.sin(time * 0.74) * 0.025;
    const inspect = action === "inspectEvidence" || action === "boardReview";
    head.current.rotation.x = inspect ? 0.16 : 0;
    head.current.rotation.y = action === "conversationIdle" || action === "stopAndFace" ? Math.sin(time * 0.42) * 0.035 : Math.sin(time * 0.48) * 0.08;
    body.current.rotation.x = inspect ? 0.08 : 0;
    if (leftArm.current) leftArm.current.rotation.x = gait + (inspect ? -0.28 : 0);
    if (rightArm.current) rightArm.current.rotation.x = -gait + (inspect ? -0.2 : 0);
    if (leftLeg.current) leftLeg.current.rotation.x = -gait;
    if (rightLeg.current) rightLeg.current.rotation.x = gait;
  });

  return (
    <group ref={root} position={position} rotation={[0, rotationY, 0]}>
      <group ref={head}>
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.18, 28, 28]} />
          <meshStandardMaterial color={skin} roughness={0.86} />
        </mesh>
        <mesh position={[0, 1.735, -0.018]} scale={[1.04, 0.55, 1.03]} castShadow>
          <sphereGeometry args={[0.184, 24, 20, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
          <meshStandardMaterial color={person.role === "officer" ? "#263b4d" : "#4e4038"} roughness={0.94} />
        </mesh>
        {person.role === "officer" && <mesh position={[0, 1.77, 0.09]} castShadow><boxGeometry args={[0.34, 0.055, 0.22]} /><meshStandardMaterial color="#263b4d" /></mesh>}
        <mesh position={[0, 1.62, 0.169]}><sphereGeometry args={[0.024, 12, 12]} /><meshStandardMaterial color="#8f6f5e" /></mesh>
        {[-.064,.064].map(x=><group key={x} position={[x,1.665,.161]}><mesh><sphereGeometry args={[.026,12,10]} /><meshStandardMaterial color="#e6ded2" roughness={.8} /></mesh><mesh position={[0,0,.021]}><sphereGeometry args={[.011,10,8]} /><meshStandardMaterial color="#282a28" /></mesh></group>)}
        {[-.18,.18].map(x=><mesh key={x} position={[x,1.62,0]} scale={[.42,.72,.28]}><sphereGeometry args={[.075,12,10]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>)}
        <mesh position={[0,1.555,.165]} scale={[1,.42,.45]}><sphereGeometry args={[.055,14,10]} /><meshStandardMaterial color="#76564b" roughness={.9} /></mesh>
      </group>
      <mesh position={[0, 1.49, 0]} castShadow><cylinderGeometry args={[0.073, 0.085, 0.13, 18]} /><meshStandardMaterial color={skin} roughness={0.88} /></mesh>
      <group ref={body}>
        <mesh position={[0, 1.14, 0]} castShadow scale={[1, 1, 0.72]}>
          <capsuleGeometry args={[0.235, person.role === "victim" ? 0.52 : 0.43, 8, 20]} />
          <meshStandardMaterial color={clothing} roughness={0.78} />
        </mesh>
        <mesh position={[0, 1.34, 0]} castShadow><boxGeometry args={[0.54, 0.12, 0.27]} /><meshStandardMaterial color={clothing} roughness={0.8} /></mesh>
        <mesh position={[-.105,1.39,.145]} rotation={[0,0,-.65]}><boxGeometry args={[.18,.06,.025]} /><meshStandardMaterial color={person.role==="officer"?"#d9c278":"#e2ddd2"} /></mesh>
        <mesh position={[.105,1.39,.145]} rotation={[0,0,.65]}><boxGeometry args={[.18,.06,.025]} /><meshStandardMaterial color={person.role==="officer"?"#d9c278":"#e2ddd2"} /></mesh>
        <mesh position={[0, 0.98, 0]} castShadow scale={[1, 1, 0.72]}><cylinderGeometry args={[0.2, 0.17, 0.32, 18]} /><meshStandardMaterial color={clothing} roughness={0.82} /></mesh>
        {(person.role === "officer" || person.role === "investigator") && <mesh position={[0, 0.91, 0.17]}><boxGeometry args={[0.42, 0.065, 0.05]} /><meshStandardMaterial color="#252b29" roughness={0.7} /></mesh>}
        {person.role === "officer" && <><mesh position={[-0.23, 1.31, 0.15]}><boxGeometry args={[0.09, 0.12, 0.035]} /><meshStandardMaterial color="#d2b452" /></mesh><mesh position={[0.23, 1.31, 0.15]}><boxGeometry args={[0.09, 0.12, 0.035]} /><meshStandardMaterial color="#d2b452" /></mesh></>}
        {(person.role === "investigator" || person.role === "officer") && (
          <group>
            <mesh position={[0, 1.25, 0.18]} castShadow><boxGeometry args={[0.18, 0.25, 0.025]} /><meshStandardMaterial color="#f0ede4" roughness={0.8} /></mesh>
            <mesh position={[0, 1.42, 0.17]}><boxGeometry args={[0.018, 0.2, 0.015]} /><meshStandardMaterial color="#5d584e" /></mesh>
          </group>
        )}
        {person.role === "suspect" && <><mesh position={[-0.12, 1.27, 0.175]} rotation={[0, 0, -0.22]}><boxGeometry args={[0.13, 0.34, 0.025]} /><meshStandardMaterial color="#b53c3c" /></mesh><mesh position={[0.12, 1.27, 0.175]} rotation={[0, 0, 0.22]}><boxGeometry args={[0.13, 0.34, 0.025]} /><meshStandardMaterial color="#b53c3c" /></mesh></>}
      </group>
      {[-0.3, 0.3].map((x) => (
        <group ref={x < 0 ? leftArm : rightArm} key={x} position={[x, 1.19, 0]} rotation={[0, 0, x < 0 ? -0.055 : 0.055]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.43, 7, 14]} />
            <meshStandardMaterial color={clothing} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.47, 0]} castShadow>
            <sphereGeometry args={[0.072, 14, 14]} />
            <meshStandardMaterial color={skin} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.77, 0]} castShadow><capsuleGeometry args={[0.18, 0.08, 6, 16]} /><meshStandardMaterial color={trousers} roughness={0.88} /></mesh>
      {[-0.115, 0.115].map((x) => (
        <group ref={x < 0 ? leftLeg : rightLeg} key={x} position={[x, 0.72, 0]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.52, 7, 14]} />
            <meshStandardMaterial color={trousers} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.67, 0.055]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.3]} />
            <meshStandardMaterial color="#30322f" roughness={0.92} />
          </mesh>
        </group>
      ))}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.34, 0.39, 40]} />
          <meshBasicMaterial color={person.role === "suspect" ? crimeLens3DTheme.colors.suspectRed : crimeLens3DTheme.colors.evidenceYellow} transparent opacity={0.72} />
        </mesh>
      )}
      {showLabel && <SceneTargetAnchor id={`person-${person.entityId}-target`} position={[0, 1.62, 0]} avoidRadius={38} />}
      {showLabel && <ScreenSpaceAnnotation id={`person-${person.entityId}`} targetObjectId={`person-${person.entityId}-target`} anchorType="person" priority={person.role === "victim" ? 72 : person.role === "suspect" ? 68 : 48} lanes={labelSide === "left" ? ["TOP_LEFT", "LEFT", "TOP"] : ["TOP_RIGHT", "RIGHT", "TOP"]} width={142} height={50} gap={14} accent={clothing}>
        <ForensicAnnotation
          title={person.name}
          detail={person.entityId === "witness-visitor" ? "IDENTITY UNCONFIRMED" : person.entityId === "sus-marlowe" ? "NIGHT CLERK / SUSPECT" : person.role.toUpperCase()}
          tone={person.role === "suspect" ? "suspect" : person.role === "witness" ? "communication" : "neutral"}
          side={labelSide}
        />
      </ScreenSpaceAnnotation>}
    </group>
  );
}

export function CharacterAvatar(props: React.ComponentProps<typeof CinematicHuman>) {
  return <CinematicHuman {...props} />;
}

export function EvidenceGeometry({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("ticket")) {
    return (
      <mesh castShadow>
        <boxGeometry args={[1.35, 0.06, 0.55]} />
        <meshStandardMaterial color="#e8d7a5" roughness={0.72} />
      </mesh>
    );
  }
  if (lower.includes("print") || lower.includes("dna") || lower.includes("sample")) {
    return (
      <group>
        <mesh castShadow>
          <cylinderGeometry args={[0.26, 0.26, 0.9, 24]} />
          <meshPhysicalMaterial color="#7bb6b4" roughness={0.35} transmission={0.16} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.12, 24]} />
          <meshStandardMaterial color="#242929" />
        </mesh>
      </group>
    );
  }
  if (lower.includes("ledger") || lower.includes("log")) {
    return (
      <group rotation={[-0.15, 0.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.1, 0.16, 1.45]} />
          <meshStandardMaterial color="#442f25" roughness={0.82} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[0.86, 0.02, 1.16]} />
          <meshStandardMaterial color="#d7ccb2" />
        </mesh>
      </group>
    );
  }
  return (
    <mesh castShadow>
      <boxGeometry args={[0.9, 0.42, 0.62]} />
      <meshStandardMaterial color="#666963" roughness={0.62} metalness={0.22} />
    </mesh>
  );
}

export function EvidenceObject({
  evidence,
  position = [0, 1, 0],
  reducedMotion = false,
}: {
  evidence: ReplayEvidence;
  position?: [number, number, number];
  reducedMotion?: boolean;
}) {
  return (
    <group position={position}>
      <SceneTargetAnchor id={`evidence-${evidence.id}-target`} position={[0, .18, 0]} avoidRadius={46} />
      <Float speed={reducedMotion ? 0 : 1.25} rotationIntensity={reducedMotion ? 0 : 0.08} floatIntensity={reducedMotion ? 0 : 0.18}>
        <EvidenceGeometry label={evidence.label} />
      </Float>
      <pointLight color="#f3c74b" intensity={2.4} distance={4} position={[0, 0.7, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]}>
        <ringGeometry args={[0.7, 0.77, 48]} />
        <meshBasicMaterial color="#f3c74b" transparent opacity={0.7} />
      </mesh>
      <ScreenSpaceAnnotation id={`evidence-${evidence.id}`} targetObjectId={`evidence-${evidence.id}-target`} anchorType="evidence" priority={78} lanes={["TOP_RIGHT", "RIGHT", "TOP"]} width={206} height={76} accent="#d99a20">
        <ForensicAnnotation title={evidence.label} detail={evidence.sourceId} tone="evidence" />
      </ScreenSpaceAnnotation>
    </group>
  );
}

export function LocationMarker3D({
  label,
  position,
}: {
  label: string;
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <SceneTargetAnchor id={`location-${label.toLowerCase().replaceAll(" ", "-")}-target`} position={[0, .45, 0]} avoidRadius={40} />
      <mesh position={[0, 0.45, 0]} castShadow>
        <coneGeometry args={[0.28, 0.72, 24]} />
        <meshStandardMaterial color="#4d9b75" emissive="#143a2a" emissiveIntensity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.43, 36]} />
        <meshBasicMaterial color="#87d3aa" transparent opacity={0.8} />
      </mesh>
      <ScreenSpaceAnnotation id={`location-${label.toLowerCase().replaceAll(" ", "-")}`} targetObjectId={`location-${label.toLowerCase().replaceAll(" ", "-")}-target`} anchorType="location" priority={80} lanes={["TOP_RIGHT", "RIGHT", "TOP"]} width={190} height={70} accent="#2baf83">
        <ForensicAnnotation title={label} detail="LOCATION" tone="location" />
      </ScreenSpaceAnnotation>
    </group>
  );
}
