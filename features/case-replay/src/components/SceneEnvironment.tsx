"use client";

import { Html } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import type { CinematicCameraFrame } from "@replay/engine/CinematicBeatController";
import { ScreenSpaceAnnotation } from "@replay/components/AnnotationLayoutManager";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";

export type EnvironmentAnchor = {
  id: string;
  position: [number, number, number];
  rotationY: number;
};

export type EnvironmentKitDefinition = {
  actorAnchors: EnvironmentAnchor[];
  cameraAnchors: CinematicCameraFrame[];
};

export const STATION_KIT: EnvironmentKitDefinition = {
  actorAnchors: [
    { id: "platform-arrival", position: [-1.35, 0, 0.55], rotationY: -0.08 },
    { id: "platform-observer", position: [1.15, 0, -0.05], rotationY: -0.32 },
  ],
  cameraAnchors: [
    { position: [7.6, 4.2, 9.2], target: [0, 1.05, -0.55] },
    { position: [5.7, 3.15, 6.5], target: [-0.4, 1.1, -0.35] },
    { position: [3.8, 2.65, 5.1], target: [-0.9, 1.28, 0.1] },
    { position: [4.9, 2.9, 5.9], target: [0.05, 1.25, -0.55] },
    { position: [1.9, 2.25, 4.2], target: [0.2, 1.75, -2.75] },
  ],
};

export const INVESTIGATION_ROOM_KIT: EnvironmentKitDefinition = {
  actorAnchors: [],
  cameraAnchors: [
    { position: [7.4, 4.3, 8.6], target: [0, 1.4, -0.7] },
    { position: [5.4, 3.2, 6.4], target: [-1.1, 1.2, -0.3] },
    { position: [3.9, 2.75, 5.2], target: [0, 1.8, -1.15] },
    { position: [5.3, 3.15, 6.1], target: [0, 1.55, -1.15] },
    { position: [2.7, 2.35, 4.3], target: [2.25, 2.05, -1.1] },
  ],
};

export const FORENSIC_LAB_KIT: EnvironmentKitDefinition = {
  actorAnchors: [
    { id: "examiner", position: [-2.8, 0, 1.05], rotationY: -1.1 },
  ],
  cameraAnchors: [
    { position: [7.1, 4.3, 8.5], target: [0, 1.05, -0.35] },
    { position: [4.7, 3.05, 5.9], target: [-0.25, 1.05, 0] },
    { position: [2.8, 2.15, 4.25], target: [-0.25, 1.02, 0.08] },
    { position: [3.7, 2.55, 4.9], target: [0.65, 1.18, -0.25] },
    { position: [2.45, 1.95, 3.8], target: [1.8, 1.2, -0.35] },
  ],
};

export const STREET_KIT: EnvironmentKitDefinition = {
  actorAnchors: [
    { id: "street-left", position: [-1.05, 0, 0.65], rotationY: 0.25 },
    { id: "street-right", position: [1.05, 0, 0.15], rotationY: -0.25 },
  ],
  cameraAnchors: [
    { position: [7.3, 3.8, 8.8], target: [0, 1, -0.5] },
    { position: [5.8, 3.0, 6.6], target: [-0.4, 1.05, -0.4] },
    { position: [4.1, 2.45, 5.2], target: [0, 1.2, -0.5] },
    { position: [5.0, 2.8, 5.8], target: [0.3, 1.15, -0.65] },
    { position: [3.0, 2.2, 4.5], target: [2.2, 1.35, -1.6] },
  ],
};

export const EVIDENCE_ROOM_KIT: EnvironmentKitDefinition = {
  actorAnchors: [],
  cameraAnchors: [
    { position: [6.8, 3.8, 8.0], target: [0, 1.1, -0.5] },
    { position: [5.0, 3.0, 6.1], target: [-0.4, 1.1, -0.2] },
    { position: [3.5, 2.4, 4.8], target: [0, 1.05, 0] },
    { position: [4.2, 2.65, 5.2], target: [0.7, 1.2, -0.2] },
    { position: [2.8, 2.1, 4.0], target: [2.1, 1.3, -1.4] },
  ],
};

function CreamFloor({ color = "#dedbd2" }: { color?: string }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[24, 24]} /><meshStandardMaterial color={color} roughness={0.96} /></mesh>;
}

function AnalyticalDotGrid() {
  const positions = useMemo(() => {
    const values: number[] = [];
    for (let x = -6; x <= 6; x += 0.48) for (let z = -4; z <= 4; z += 0.48) values.push(x, 0.012, z);
    return new Float32Array(values);
  }, []);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color={crimeLens3DTheme.colors.charcoal} size={0.022} transparent opacity={0.14} sizeAttenuation /></points>;
}

export function StationKit({ children }: { children?: ReactNode }) {
  return (
    <group>
      <CreamFloor color={crimeLens3DTheme.colors.floor} />
      <mesh position={[0, 2.35, -3.48]} receiveShadow><boxGeometry args={[13.8, 4.7, 0.24]} /><meshStandardMaterial {...crimeLens3DTheme.materials.wall} /></mesh>
      <mesh position={[0, 0.24, -1.65]} receiveShadow><boxGeometry args={[13.5, 0.46, 2.2]} /><meshStandardMaterial color="#b6b1a7" roughness={0.9} /></mesh>
      <mesh position={[0, 0.5, -0.63]}><boxGeometry args={[13.2, 0.08, 0.16]} /><meshStandardMaterial {...crimeLens3DTheme.materials.yellowTag} /></mesh>
      {[-2.22, -1.52].map((z) => <mesh key={z} position={[0, 0.1, z]}><boxGeometry args={[14, 0.08, 0.1]} /><meshStandardMaterial color="#676c69" metalness={0.55} roughness={0.4} /></mesh>)}
      {[-5.25, -1.75, 1.75, 5.25].map((x) => <group key={x} position={[x, 0, -3.02]}><mesh position={[0, 1.75, 0]}><cylinderGeometry args={[0.17, 0.22, 3.5, 18]} /><meshStandardMaterial color="#9a948a" /></mesh><mesh position={[0, 3.48, 0]}><boxGeometry args={[0.62, 0.13, 0.58]} /><meshStandardMaterial color="#77736d" /></mesh></group>)}
      <group position={[-3.72, 0.48, 0.22]}>
        <mesh castShadow><boxGeometry args={[2.45, 0.14, 0.68]} /><meshStandardMaterial color="#77736b" roughness={0.78} /></mesh>
        {[-0.92, 0.92].map((x) => <mesh key={x} position={[x, -0.25, 0]}><boxGeometry args={[0.11, 0.5, 0.52]} /><meshStandardMaterial color="#5e615e" /></mesh>)}
      </group>
      <group position={[3.4, 2.75, -3.23]} rotation={[0, -0.28, 0]}>
        <mesh><boxGeometry args={[0.46, 0.3, 0.42]} /><meshStandardMaterial color="#777b78" /></mesh>
        <mesh position={[0, 0, 0.29]}><cylinderGeometry args={[0.11, 0.15, 0.28, 18]} /><meshStandardMaterial color="#292c2a" /></mesh>
        <pointLight color="#356edb" intensity={0.9} distance={3} />
      </group>
      <group position={[0.2, 2.82, -3.2]}>
        <mesh><boxGeometry args={[2.15, 0.62, 0.09]} /><meshStandardMaterial color="#34413e" roughness={0.72} /></mesh>
        <Html transform center position={[0, 0, 0.06]} distanceFactor={8.4} style={{ pointerEvents: "none" }}><div className="case-replay-physical-sign"><span>EASTBOUND</span><strong>PLATFORM 9</strong></div></Html>
      </group>
      {[-3.2, 0, 3.2].map((x) => <group key={x} position={[x, 3.7, 0.25]}><mesh><boxGeometry args={[2.2, 0.1, 0.56]} /><meshStandardMaterial color="#bcb8ae" /></mesh><rectAreaLight position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} width={1.85} height={0.36} intensity={1.8} color="#fff0cd" /></group>)}
      {children}
    </group>
  );
}

export function InvestigationRoomKit({ children }: { children?: ReactNode }) {
  return (
    <group>
      <CreamFloor color={crimeLens3DTheme.colors.paper} />
      <AnalyticalDotGrid />
      <mesh position={[0, 2.4, -3.55]} receiveShadow><boxGeometry args={[13.4, 4.8, 0.24]} /><meshStandardMaterial {...crimeLens3DTheme.materials.wall} /></mesh>
      <mesh position={[-5.7, 2.15, -0.7]} receiveShadow><boxGeometry args={[0.22, 4.3, 5.8]} /><meshStandardMaterial color="#d2cec4" roughness={0.96} /></mesh>
      {[-4.15, 4.15].map((x) => <group key={x} position={[x, 2.18, -3.34]}>{[0, 0.72, 1.44].map((y) => <mesh key={y} position={[0, y - 0.72, 0]}><boxGeometry args={[2.6, 0.52, 0.12]} /><meshStandardMaterial color="#6d7370" metalness={0.28} roughness={0.56} /></mesh>)}</group>)}
      <group position={[-2.7, 0.74, 0.15]}>
        <mesh castShadow><boxGeometry args={[3.65, 0.18, 2.1]} /><meshStandardMaterial color="#8e7b60" roughness={0.78} /></mesh>
        <mesh position={[0, 0.12, 0]}><boxGeometry args={[3.38, 0.06, 1.86]} /><meshStandardMaterial color="#d7d1c4" roughness={0.88} /></mesh>
        {[-1.55, 1.55].flatMap((x) => [-0.82, 0.82].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.4, z]}><boxGeometry args={[0.12, 0.82, 0.12]} /><meshStandardMaterial color="#595d5a" /></mesh>))}
      </group>
      <group position={[-2.55, 1.12, -0.05]}>
        <mesh><boxGeometry args={[1.48, 0.5, 0.72]} /><meshStandardMaterial color="#555c59" metalness={0.18} roughness={0.58} /></mesh>
        <mesh position={[0, 0.08, 0.38]}><boxGeometry args={[1.22, 0.22, 0.04]} /><meshBasicMaterial color="#b7cdbf" /></mesh>
        {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-0.5 + index * 0.17, -0.13, 0.39]}><boxGeometry args={[0.09, 0.08, 0.025]} /><meshStandardMaterial color={index === 2 ? "#d99a20" : "#838b86"} /></mesh>)}
      </group>
      {[-3.1, 0, 3.1].map((x) => <group key={x} position={[x, 4.02, -1.4]}><mesh><boxGeometry args={[2.15, 0.1, 0.55]} /><meshStandardMaterial color="#a8a49a" /></mesh><rectAreaLight position={[0, -0.09, 0]} rotation={[-Math.PI / 2, 0, 0]} width={1.8} height={0.34} intensity={1.8} color="#f5e3bd" /></group>)}
      {children}
    </group>
  );
}

export function ForensicLabKit({ children }: { children?: ReactNode }) {
  return (
    <group>
      <CreamFloor color={crimeLens3DTheme.colors.paper} />
      <mesh position={[0, 2.3, -3.5]} receiveShadow><boxGeometry args={[12.8, 4.6, 0.24]} /><meshStandardMaterial {...crimeLens3DTheme.materials.wall} /></mesh>
      <mesh position={[-5.55, 2.05, -0.65]} receiveShadow><boxGeometry args={[0.22, 4.1, 5.7]} /><meshStandardMaterial color="#d8d5cd" roughness={0.96} /></mesh>
      <group position={[-4.15, 2.1, -3.3]}>{[0, 0.82, 1.64].map((y) => <mesh key={y} position={[0, y - 0.82, 0]}><boxGeometry args={[1.95, 0.65, 0.14]} /><meshStandardMaterial color="#8b918e" metalness={0.16} roughness={0.62} /></mesh>)}</group>
      <group position={[4.25, 1.65, -3.28]}>
        <mesh><boxGeometry args={[2.2, 2.8, 0.12]} /><meshStandardMaterial color="#eef0eb" roughness={0.7} /></mesh>
        {Array.from({ length: 6 }, (_, index) => <mesh key={index} position={[0, 1.05 - index * 0.4, 0.075]}><boxGeometry args={[1.78, 0.028, 0.02]} /><meshBasicMaterial color={index === 0 ? "#c58d25" : "#8f938f"} /></mesh>)}
      </group>
      <group position={[2.6, 2.15, -1.45]} rotation={[0, -0.3, 0]}>
        <mesh><cylinderGeometry args={[0.07, 0.1, 2.1, 16]} /><meshStandardMaterial color="#666b68" metalness={0.3} /></mesh>
        <mesh position={[0, 1.05, 0.22]} rotation={[0.2, 0, 0]}><coneGeometry args={[0.44, 0.56, 24, 1, true]} /><meshStandardMaterial color="#c7b078" side={2} /></mesh>
        <pointLight position={[0, 0.78, 0.35]} color="#f5dfae" intensity={1.8} distance={4} />
      </group>
      {[-3.2, 0, 3.2].map((x) => <group key={x} position={[x, 4.0, 0.2]}><mesh><boxGeometry args={[2.1, 0.1, 0.52]} /><meshStandardMaterial color="#acaaa3" /></mesh><rectAreaLight position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} width={1.7} height={0.32} intensity={2} color="#fff0ce" /></group>)}
      {children}
    </group>
  );
}

export function StreetKit({ children }: { children?: ReactNode }) {
  return <group>
    <CreamFloor color={crimeLens3DTheme.colors.concrete} />
    <mesh position={[0, 2.35, -3.62]}><boxGeometry args={[13.8, 4.7, 0.3]} /><meshStandardMaterial {...crimeLens3DTheme.materials.wall} /></mesh>
    <mesh position={[-3.55, 1.55, -3.38]}><boxGeometry args={[3.25, 3.0, 0.22]} /><meshStandardMaterial color="#b9b4aa" /></mesh>
    <mesh position={[-3.55, 1.5, -3.22]}><boxGeometry args={[2.45, 2.35, 0.12]} /><meshStandardMaterial color="#606663" metalness={0.24} roughness={0.58} /></mesh>
    {[-0.75, 0, 0.75].map(x => <mesh key={x} position={[-3.55 + x, 1.5, -3.12]}><boxGeometry args={[0.08, 2.08, 0.06]} /><meshStandardMaterial color="#8f9591" /></mesh>)}
    <mesh position={[2.55, 1.55, -3.36]}><boxGeometry args={[3.8, 2.9, 0.24]} /><meshStandardMaterial color="#d2cec4" /></mesh>
    <mesh position={[2.55, 1.52, -3.18]}><boxGeometry args={[1.25, 2.45, 0.12]} /><meshStandardMaterial color="#666c68" /></mesh>
    <mesh position={[2.55, 2.4, -3.08]}><boxGeometry args={[1.0, 0.36, 0.05]} /><meshBasicMaterial color="#d9c58f" /></mesh>
    <mesh position={[0, 0.075, 1.6]}><boxGeometry args={[13.8, 0.12, 3.15]} /><meshStandardMaterial color={crimeLens3DTheme.colors.charcoalSoft} roughness={0.92} /></mesh>
    <mesh position={[0, 0.15, 0.0]}><boxGeometry args={[13.8, 0.28, 0.32]} /><meshStandardMaterial color="#b9b5ac" /></mesh>
    <mesh position={[0, 0.19, 1.6]}><boxGeometry args={[0.12, 0.02, 2.0]} /><meshBasicMaterial color="#ded5ae" /></mesh>
    {[-4.6, 4.6].map(x => <group key={x} position={[x, 0, -0.4]}><mesh position={[0, 1.65, 0]}><cylinderGeometry args={[0.08, 0.1, 3.3, 14]} /><meshStandardMaterial color="#535a57" /></mesh><mesh position={[0, 3.18, 0.12]}><boxGeometry args={[0.55, 0.22, 0.38]} /><meshStandardMaterial color="#858b87" /></mesh><pointLight position={[0, 3.05, 0.3]} color="#f4dfb2" intensity={1.1} distance={4.5} /></group>)}
    <mesh position={[-5.2, 0.75, 0.3]}><boxGeometry args={[1.15, 1.5, 0.12]} /><meshStandardMaterial color="#b8a573" /></mesh>
    {children}
  </group>;
}

export function EvidenceRoomKit({ children }: { children?: ReactNode }) {
  return <group><CreamFloor color={crimeLens3DTheme.colors.paper} /><mesh position={[0, 2.2, -3.5]}><boxGeometry args={[12, 4.4, 0.22]} /><meshStandardMaterial {...crimeLens3DTheme.materials.wall} /></mesh>
    <group position={[-4.25, 1.75, -3.24]}>{[-0.95, 0, 0.95].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[2.25, 0.7, 0.18]} /><meshStandardMaterial color="#7f8582" metalness={0.22} roughness={0.56} /></mesh>)}</group>
    <group position={[4.0, 1.5, -3.25]}><mesh><boxGeometry args={[1.9, 2.9, 0.18]} /><meshStandardMaterial color="#666c69" /></mesh><mesh position={[0, 0.45, 0.12]}><boxGeometry args={[0.38, 0.5, 0.05]} /><meshBasicMaterial color="#98b7a6" /></mesh><mesh position={[-0.58, 0.62, 0.13]}><boxGeometry args={[0.36, 0.12, 0.04]} /><meshBasicMaterial color="#d8c68f" /></mesh></group>
    <mesh position={[3.95, 3.25, -3.08]}><boxGeometry args={[2.4, 0.42, 0.05]} /><meshBasicMaterial color="#d8c68f" /></mesh>
    {[-3.1, 0, 3.1].map(x => <group key={x} position={[x, 4.0, 0]}><mesh><boxGeometry args={[2.1, 0.1, 0.5]} /><meshStandardMaterial color="#aaa79f" /></mesh><rectAreaLight position={[0,-0.08,0]} rotation={[-Math.PI/2,0,0]} width={1.7} height={0.32} intensity={1.8} color="#f7e8c9" /></group>)}
    {children}</group>;
}
