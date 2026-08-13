"use client";

import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CharacterAvatar,
  EvidenceObject,
  LocationMarker3D,
} from "@replay/entities/ReplayEntities";
import {
  EvidenceWorktable,
  ForensicBoard,
  InvestigationWorksurface,
  PhysicalSign,
} from "@replay/components/ReplayForensics";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import {
  AmbientDrift,
  AnimatedConnector,
  FocusBeacon,
  getPhaseProgress,
} from "@replay/components/SceneMotion";
import { placeSceneActors } from "@replay/engine/sceneLayout";
import { REPLAY_COLORS, REPLAY_MATERIALS } from "@replay/engine/materialPalette";
import type { ReplayEvent, ReplaySceneType } from "@replay/types";

type SceneProps = { event: ReplayEvent; reducedMotion: boolean; progress: number };

const FREIGHT_CRATE_POSITIONS: Array<[number, number, number]> = [
  [-0.48, 0.67, 0],
  [0.42, 0.63, 0.05],
  [-0.08, 1.18, -0.08],
];

function StageFloor({ color = REPLAY_COLORS.floor, grid = false }: { color?: string; grid?: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color={color} roughness={0.94} />
      </mesh>
      {grid && <gridHelper args={[30, 30, "#c6c1b7", "#ddd9d0"]} position={[0, 0.012, 0]} />}
    </group>
  );
}

function ScenePeople({
  event,
  reducedMotion,
  sceneType,
}: SceneProps & { sceneType: ReplaySceneType }) {
  const placements = useMemo(
    () => placeSceneActors(sceneType, event.people.slice(0, 3)),
    [event.people, sceneType],
  );
  return (
    <>
      {placements.map((placement, index) => (
        <CharacterAvatar
          key={placement.person.entityId}
          person={placement.person}
          position={placement.position}
          rotationY={placement.rotationY}
          labelSide={placement.labelSide}
          active={placement.person.entityId === "witness-visitor" || (index === 0 && event.people.every((person) => person.entityId !== "witness-visitor"))}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}

export function StationScene(props: SceneProps) {
  return (
    <group>
      <StageFloor color="#e8e5dc" />
      <mesh position={[0, 2.2, -3.35]} receiveShadow><boxGeometry args={[13.5, 4.4, 0.22]} /><meshStandardMaterial color="#d8d2c6" roughness={0.95} /></mesh>
      <mesh position={[0, 0.13, -1.9]} receiveShadow>
        <boxGeometry args={[13, 0.25, 2.2]} />
        <meshStandardMaterial color="#c9c2ae" roughness={0.9} />
      </mesh>
      {[-2.4, -1.7].map((z) => (
        <mesh key={z} position={[0, 0.18, z]} receiveShadow>
          <boxGeometry args={[14, 0.1, 0.1]} />
          <meshStandardMaterial color="#7b7d78" metalness={0.55} roughness={0.42} />
        </mesh>
      ))}
      <mesh position={[-3.3, 0.55, 0.3]} castShadow>
        <boxGeometry args={[1.65, 0.16, 0.55]} />
        <meshStandardMaterial color="#8d8a80" />
      </mesh>
      {[-5.35, -1.75, 1.85, 5.35].map((x) => (
        <group key={x} position={[x, 0, -2.75]}>
          <mesh position={[0, 1.7, 0]} castShadow><cylinderGeometry args={[0.18, 0.24, 3.4, 20]} /><meshStandardMaterial color="#aaa397" roughness={0.84} /></mesh>
          <mesh position={[0, 3.35, 0]}><boxGeometry args={[0.6, 0.15, 0.6]} /><meshStandardMaterial color="#817b72" /></mesh>
        </group>
      ))}
      <mesh position={[0, 3.62, -2.65]} receiveShadow><boxGeometry args={[13.3, 0.18, 1.55]} /><meshStandardMaterial color="#c1baad" roughness={0.88} /></mesh>
      <PhysicalSign label="PLATFORM 9" detail="EASTBOUND" position={[-3.35, 2.58, -3.17]} width={2.55} />
      <PhysicalSign label="WAY OUT" detail="STREET LEVEL / EAST" position={[3.55, 2.66, -3.17]} width={2.25} />
      <mesh position={[0, 0.23, -0.82]} receiveShadow><boxGeometry args={[12.8, 0.025, 0.14]} /><meshStandardMaterial color={REPLAY_COLORS.yellow} roughness={0.78} /></mesh>
      {[-3.2, 0, 3.2].map((x) => <group key={x} position={[x, 3.55, 0.1]}><mesh><boxGeometry args={[2.15, 0.1, 0.52]} /><meshStandardMaterial color="#cbc6ba" roughness={0.72} /></mesh><rectAreaLight position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} width={1.8} height={0.32} intensity={1.7} color="#fff2cf" /></group>)}
      <group position={[0.2, 2.45, -3.18]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.48, 0.48, 0.08, 36]} /><meshStandardMaterial color="#f5f2e9" roughness={0.86} /></mesh>
        <mesh><torusGeometry args={[0.46, 0.045, 12, 36]} /><meshStandardMaterial color="#353633" /></mesh>
        <mesh position={[0, 0, 0.06]} rotation={[0, 0, -0.55]}><boxGeometry args={[0.035, 0.3, 0.025]} /><meshBasicMaterial color="#353633" /></mesh>
        <mesh position={[0, 0, 0.065]} rotation={[0, 0, 1.15]}><boxGeometry args={[0.025, 0.21, 0.02]} /><meshBasicMaterial color="#353633" /></mesh>
      </group>
      <group position={[4.75, 1.45, -3.17]}>
        <mesh><boxGeometry args={[1.5, 1.85, 0.08]} /><meshStandardMaterial color="#ebe6da" /></mesh>
        {Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[0, 0.66 - index * 0.2, 0.05]}><boxGeometry args={[1.18, 0.025, 0.01]} /><meshBasicMaterial color={index === 0 ? "#d99a20" : "#77736c"} /></mesh>)}
      </group>
      <group position={[2.6, 0.55, -2.95]}>
        <mesh castShadow><cylinderGeometry args={[0.34, 0.4, 1.1, 20]} /><meshStandardMaterial color="#6f756f" roughness={0.75} /></mesh>
        <mesh position={[0, 0.54, 0]}><torusGeometry args={[0.31, 0.04, 8, 24]} /><meshStandardMaterial color="#3e4340" /></mesh>
      </group>
      {[-4.15, -2.45].map((x) => <mesh key={x} position={[x, 0.3, 0.3]} castShadow><boxGeometry args={[0.09, 0.6, 0.5]} /><meshStandardMaterial color="#6f6d67" /></mesh>)}
      <group position={[3.25, 2.5, 0]} rotation={[0, -0.65, 0]}>
        <mesh castShadow><boxGeometry args={[0.42, 0.28, 0.5]} /><meshStandardMaterial color="#b8b5ab" /></mesh>
        <mesh position={[0, 0, 0.33]}><cylinderGeometry args={[0.11, 0.16, 0.32, 18]} /><meshStandardMaterial color="#2c2d2b" /></mesh>
        <pointLight color="#356edb" intensity={0.8} distance={4} />
      </group>
      <Html position={[3.05, 3.05, 0.1]} center distanceFactor={10}><div className="case-replay-prop-label">CCTV / CAM-P9</div></Html>
      <FocusBeacon position={[-0.8, 0.02, 0.55]} color="#d99a20" progress={getPhaseProgress(props.progress)} reducedMotion={props.reducedMotion} radius={0.42} />
      <ScenePeople {...props} sceneType="station" />
    </group>
  );
}

export function ShopScene(props: SceneProps) {
  return (
    <group>
      <StageFloor color="#e8e5dc" />
      <mesh position={[0, 2, -3.1]} receiveShadow><boxGeometry args={[10, 4, 0.16]} /><meshStandardMaterial color="#e3ded4" roughness={0.94} /></mesh>
      <mesh position={[-5, 2, -0.2]} receiveShadow><boxGeometry args={[0.16, 4, 5.9]} /><meshStandardMaterial color="#e1ddd4" roughness={0.94} /></mesh>
      <mesh position={[0, 0.5, -0.6]} castShadow><boxGeometry args={[5, 1, 1]} /><meshStandardMaterial color="#bea985" roughness={0.82} /></mesh>
      <mesh position={[0, 1.04, -0.6]} castShadow><boxGeometry args={[5.2, 0.1, 1.08]} /><meshStandardMaterial color="#786f61" roughness={0.7} /></mesh>
      {[-3.3, 3.3].map((x) => (
        <group key={x} position={[x, 0, -2.55]}>
          <mesh position={[0, 1.35, -0.32]}><boxGeometry args={[1.8, 2.7, 0.08]} /><meshStandardMaterial color="#b5aa96" /></mesh>
          {[0.28, 1.08, 1.88, 2.62].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.8, 0.08, 0.72]} /><meshStandardMaterial color="#9b8c75" /></mesh>)}
          {[-0.55, 0, 0.55].map((itemX, index) => <mesh key={itemX} position={[itemX, 1.38 + (index % 2) * 0.8, 0]}><boxGeometry args={[0.3, 0.46, 0.36]} /><meshStandardMaterial color={index === 1 ? "#d7b34b" : "#8b9d93"} /></mesh>)}
        </group>
      ))}
      <group position={[4.15, 1.1, -3.0]}>
        <mesh><boxGeometry args={[1.45, 2.3, 0.12]} /><meshStandardMaterial color="#5f5b54" /></mesh>
        <mesh position={[0, 0, 0.08]}><boxGeometry args={[1.24, 2.08, 0.08]} /><meshStandardMaterial color="#d1c9ba" /></mesh>
        <mesh position={[-0.42, 0, 0.14]}><sphereGeometry args={[0.055, 12, 12]} /><meshStandardMaterial color="#3b3c39" /></mesh>
      </group>
      <mesh position={[1.45, 1.25, -0.54]} castShadow><boxGeometry args={[0.62, 0.32, 0.5]} /><meshStandardMaterial color="#555955" metalness={0.24} roughness={0.55} /></mesh>
      <group position={[-4.28, 3.25, -2.68]} rotation={[0, 0.72, 0]}>
        <mesh castShadow><boxGeometry args={[0.5, 0.28, 0.42]} /><meshStandardMaterial color="#aaa79f" /></mesh>
        <mesh position={[0, 0, 0.29]}><cylinderGeometry args={[0.1, 0.14, 0.28, 18]} /><meshStandardMaterial color="#30312f" /></mesh>
        <mesh position={[0, 0, 0.46]}><circleGeometry args={[0.075, 18]} /><meshBasicMaterial color="#356edb" /></mesh>
      </group>
      <Html position={[-4.15, 3.72, -2.55]} center distanceFactor={10}><div className="case-replay-prop-label">CCTV / CAM-02</div></Html>
      <FocusBeacon position={props.event.sourceTimelineId === "TL-005" ? [-0.85, 0.02, 0.66] : [1.05, 0.02, -1.62]} color="#356edb" progress={getPhaseProgress(props.progress)} reducedMotion={props.reducedMotion} radius={0.46} />
      <ScenePeople {...props} sceneType="shop" />
    </group>
  );
}

function LoadingDockDetentionScene(props: SceneProps) {
  const phase = getPhaseProgress(props.progress);
  return (
    <group>
      <StageFloor color="#a9aaa5" />

      {/* Annex B warehouse shell and raised loading bay. */}
      <mesh position={[0, 2.45, -3.48]} receiveShadow>
        <boxGeometry args={[12.5, 4.9, 0.24]} />
        <meshStandardMaterial color="#777a76" roughness={0.96} />
      </mesh>
      <mesh position={[-5.65, 2.1, -0.75]} receiveShadow>
        <boxGeometry args={[0.22, 4.2, 5.6]} />
        <meshStandardMaterial color="#858781" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.36, -2.25]} receiveShadow castShadow>
        <boxGeometry args={[11.4, 0.72, 2.35]} />
        <meshStandardMaterial color="#8b8b84" roughness={0.92} />
      </mesh>
      <mesh position={[0, 0.74, -1.08]} receiveShadow>
        <boxGeometry args={[11.4, 0.08, 0.16]} />
        <meshStandardMaterial color="#d6a82c" roughness={0.78} />
      </mesh>

      {/* Roll-up bay door, service access, and industrial fixtures. */}
      <group position={[1.65, 2.35, -3.31]}>
        <mesh><boxGeometry args={[4.4, 3.55, 0.14]} /><meshStandardMaterial color="#555b5b" metalness={0.34} roughness={0.64} /></mesh>
        {Array.from({ length: 12 }, (_, index) => (
          <mesh key={index} position={[0, 1.48 - index * 0.27, 0.08]}>
            <boxGeometry args={[4.18, 0.035, 0.025]} />
            <meshStandardMaterial color="#858c8a" metalness={0.28} roughness={0.58} />
          </mesh>
        ))}
        <mesh position={[0, -1.62, 0.11]}><boxGeometry args={[4.5, 0.16, 0.12]} /><meshStandardMaterial color="#343937" /></mesh>
      </group>
      <group position={[-3.62, 1.5, -3.3]}>
        <mesh><boxGeometry args={[1.55, 2.75, 0.15]} /><meshStandardMaterial color="#3e4543" roughness={0.76} /></mesh>
        <mesh position={[0, 0.26, 0.09]}><boxGeometry args={[1.25, 1.65, 0.04]} /><meshStandardMaterial color="#737b78" roughness={0.82} /></mesh>
        <mesh position={[0.48, 0, 0.15]}><sphereGeometry args={[0.065, 14, 14]} /><meshStandardMaterial color="#d7b64e" metalness={0.45} /></mesh>
      </group>
      <PhysicalSign label="ANNEX B" detail="LOADING DOCK / BAY 02" position={[-2.2, 3.35, -3.18]} width={2.45} />

      {[-3.7, 0, 3.7].map((x) => (
        <group key={x} position={[x, 4.25, -2.95]}>
          <mesh><boxGeometry args={[1.65, 0.1, 0.7]} /><meshStandardMaterial color="#454b49" metalness={0.25} /></mesh>
          <rectAreaLight position={[0, -0.08, 0.18]} rotation={[-Math.PI / 2, 0, 0]} width={1.35} height={0.42} intensity={2.2} color="#f3dda8" />
        </group>
      ))}

      {/* Pallets and freight make the detention read as a working dock. */}
      <group position={[-3.72, 0.82, -1.92]}>
        {[0, 0.13, 0.26].map((y) => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[1.75, 0.09, 1.08]} /><meshStandardMaterial color="#7b5c3e" roughness={0.92} /></mesh>)}
        {FREIGHT_CRATE_POSITIONS.map((position, index) => (
          <mesh key={index} position={position} castShadow><boxGeometry args={[0.82, 0.72, 0.72]} /><meshStandardMaterial color={index === 2 ? "#8b7657" : "#9b8360"} roughness={0.94} /></mesh>
        ))}
      </group>
      <group position={[4.3, 0.46, -1.82]}>
        <mesh castShadow><boxGeometry args={[1.45, 0.92, 1.05]} /><meshStandardMaterial color="#806c51" roughness={0.94} /></mesh>
        <mesh position={[0, 0.47, 0]}><boxGeometry args={[1.5, 0.035, 0.08]} /><meshBasicMaterial color="#d4b45e" /></mesh>
      </group>

      {/* Controlled perimeter and response vehicle establish an active detention. */}
      <group position={[4.75, 0.48, 1.65]} rotation={[0, -0.3, 0]} scale={0.82}>
        <mesh position={[0, 0.52, 0]} castShadow><boxGeometry args={[2.7, 1.04, 1.32]} /><meshStandardMaterial color="#30465a" roughness={0.62} metalness={0.16} /></mesh>
        <mesh position={[-0.25, 1.13, 0]} castShadow><boxGeometry args={[1.55, 0.7, 1.18]} /><meshStandardMaterial color="#d8dbd8" roughness={0.52} /></mesh>
        <mesh position={[-0.3, 1.5, 0]}><boxGeometry args={[0.75, 0.09, 0.18]} /><meshStandardMaterial color="#356edb" emissive="#356edb" emissiveIntensity={0.65} /></mesh>
        {[-0.86, 0.86].flatMap((x) => [-0.68, 0.68].map((z) => <mesh key={`${x}-${z}`} position={[x, 0.2, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.25, 0.25, 0.18, 20]} /><meshStandardMaterial color="#292d2c" roughness={0.8} /></mesh>))}
      </group>
      <group position={[0.1, 0, 2.35]}>
        {[-2.1, 2.1].map((x) => <mesh key={x} position={[x, 0.58, 0]}><cylinderGeometry args={[0.065, 0.085, 1.16, 12]} /><meshStandardMaterial color="#505552" /></mesh>)}
        <mesh position={[0, 0.72, 0]}><boxGeometry args={[4.35, 0.14, 0.12]} /><meshStandardMaterial color="#e0b332" /></mesh>
        {[-1.55, -0.52, 0.52, 1.55].map((x) => <mesh key={x} position={[x, 0.72, 0.07]} rotation={[0, 0, -0.58]}><boxGeometry args={[0.12, 0.14, 0.025]} /><meshBasicMaterial color="#343735" /></mesh>)}
      </group>
      {[-2.45, 2.45].map((x) => (
        <group key={x} position={[x, 0.24, 1.55]}>
          <mesh><coneGeometry args={[0.24, 0.48, 20]} /><meshStandardMaterial color="#d77b2d" roughness={0.8} /></mesh>
          <mesh position={[0, 0.16, 0]}><torusGeometry args={[0.15, 0.035, 8, 20]} /><meshStandardMaterial color="#f0e6cd" /></mesh>
        </group>
      ))}

      <Html position={[0.1, 1.02, 2.22]} center distanceFactor={9} style={{ pointerEvents: "none" }}>
        <div className="case-replay-prop-label">CONTROLLED PERIMETER / TL-007</div>
      </Html>
      <ScenePeople {...props} sceneType="street" />
      <FocusBeacon position={[-1.05, 0.02, 0.65]} color={REPLAY_COLORS.red} progress={phase} reducedMotion={props.reducedMotion} radius={0.5} />
      <spotLight position={[-1.2, 6.8, 3.8]} angle={0.42} penumbra={0.72} intensity={2.4} color="#f2dfb5" />
    </group>
  );
}

export function StreetScene(props: SceneProps) {
  if (props.event.sourceTimelineId === "TL-007") {
    return <LoadingDockDetentionScene {...props} />;
  }

  return (
    <group>
      <StageFloor color="#e8e5dc" grid={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}><planeGeometry args={[5.5, 20]} /><meshStandardMaterial color="#aaa9a4" /></mesh>
      {[-2.3, 2.3].map((x) => <mesh key={x} position={[x, 0.08, 0]}><boxGeometry args={[1.1, 0.16, 20]} /><meshStandardMaterial color="#d8d4ca" /></mesh>)}
      {[-4, 0, 4].map((z) => <mesh key={z} position={[0, 0.04, z]}><boxGeometry args={[0.13, 0.03, 1.35]} /><meshBasicMaterial color="#d2c9a7" /></mesh>)}
      {[-2.8, 2.8].map((x) => (
        <group key={x} position={[x, 0, -0.8]}>
          <mesh position={[0, 1.6, 0]}><cylinderGeometry args={[0.05, 0.07, 3.2, 10]} /><meshStandardMaterial color="#555b5b" /></mesh>
          <pointLight position={[0, 3.1, 0]} color="#e7d7a2" intensity={3} distance={5} />
          <mesh position={[0, 3.05, 0]}><sphereGeometry args={[0.16, 16, 16]} /><meshStandardMaterial color="#f3d98f" emissive="#f3d98f" emissiveIntensity={1.5} /></mesh>
        </group>
      ))}
      <ScenePeople {...props} sceneType="street" />
      <FocusBeacon position={[-1.05, 0.02, 0.65]} color="#d64a4a" progress={getPhaseProgress(props.progress)} reducedMotion={props.reducedMotion} radius={0.44} />
      {props.event.location && <LocationMarker3D label={props.event.location.label} position={[3.8, 0, 1.5]} />}
    </group>
  );
}

export function EvidenceRevealScene(props: SceneProps) {
  const entryLog = props.event.sourceTimelineId === "TL-008";
  return (
    <group>
      <StageFloor color="#ebe7de" />
      <mesh position={[0, 2.1, -3.35]} receiveShadow><boxGeometry args={[9.5, 4.2, 0.18]} /><meshStandardMaterial color="#ded9cf" roughness={0.95} /></mesh>
      <mesh position={[-4.65, 2.05, -0.5]} receiveShadow><boxGeometry args={[0.16, 4.1, 5.7]} /><meshStandardMaterial color="#e3ded4" roughness={0.96} /></mesh>
      <group position={[-3.65, 0, -3.05]}>
        {[0.45, 1.28, 2.12, 2.95].map((y) => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[1.6, 0.1, 0.62]} /><meshStandardMaterial color="#90877a" roughness={0.82} /></mesh>)}
        {[-0.48, 0, 0.48].map((x, index) => <mesh key={x} position={[x, 1.58 + (index % 2) * 0.83, 0.02]}><boxGeometry args={[0.34, 0.48, 0.42]} /><meshStandardMaterial color={index === 1 ? "#b8aa8c" : "#8c9992"} roughness={0.9} /></mesh>)}
      </group>
      <group position={[3.78, 1.35, -3.18]}>
        <mesh><boxGeometry args={[1.45, 2.72, 0.1]} /><meshStandardMaterial color="#63615a" /></mesh>
        <mesh position={[0, 0, 0.065]}><boxGeometry args={[1.22, 2.48, 0.04]} /><meshStandardMaterial color="#d4cec1" /></mesh>
        <mesh position={[-0.42, 0, 0.1]}><sphereGeometry args={[0.055, 12, 12]} /><meshStandardMaterial color="#343633" /></mesh>
        {entryLog && <group position={[0.82, 0.25, 0.12]}><mesh><boxGeometry args={[0.28, 0.48, 0.08]} /><meshStandardMaterial color="#434844" /></mesh><mesh position={[0, 0.08, 0.05]}><boxGeometry args={[0.14, 0.06, 0.02]} /><meshBasicMaterial color="#356edb" /></mesh></group>}
      </group>
      <AmbientDrift reducedMotion={props.reducedMotion} amplitude={0.008} rotation={0.006}>
        <group position={[2.58, 1.42, -1.2]} rotation={[0, -0.35, 0]}>
          <mesh><cylinderGeometry args={[0.08, 0.11, 1.1, 16]} /><meshStandardMaterial color="#5d5d58" metalness={0.3} /></mesh>
          <mesh position={[0, 0.62, 0]} rotation={[0.18, 0, 0]}><coneGeometry args={[0.42, 0.52, 24, 1, true]} /><meshStandardMaterial color="#c9b47d" side={THREE.DoubleSide} /></mesh>
          <pointLight position={[0, 0.45, 0.25]} color="#f4dfaa" intensity={1.2} distance={3} />
        </group>
      </AmbientDrift>
      <EvidenceWorktable event={props.event} progress={props.progress} reducedMotion={props.reducedMotion} />
      <spotLight position={[2.5, 5.5, 4]} angle={0.34} penumbra={0.78} intensity={3.2} color="#f1d99d" castShadow />
    </group>
  );
}

export function MapScene3D(props: SceneProps) {
  const pinLabel = props.event.location?.label ?? "EVENT LOCATION";
  const phase = getPhaseProgress(props.progress);
  return (
    <group rotation={[0.06, 0, 0]}>
      <StageFloor color="#e8e5dc" />
      {Array.from({ length: 8 }, (_, index) => {
        const x = -5.3 + (index % 4) * 3.5;
        const z = -4 + Math.floor(index / 4) * 6.5;
        const height = 0.35 + (index % 3) * 0.28;
        return <mesh key={index} position={[x, height / 2, z]}><boxGeometry args={[2.15, height, 1.35]} /><meshStandardMaterial color="#d3cec2" roughness={0.9} /></mesh>;
      })}
      <AnimatedConnector points={[[-4, 0.1, 2.2], [-1.2, 0.1, 0.2], [1.4, 0.1, 1.1], [4.1, 0.1, -2.2]]} color="#2baf83" progress={phase} reducedMotion={props.reducedMotion} delay={0.1} opacity={0.84} />
      <FocusBeacon position={[1.4, 0.04, 1.1]} color="#2baf83" progress={phase} reducedMotion={props.reducedMotion} radius={0.5} />
      <LocationMarker3D label={pinLabel} position={[1.4, 0.1, 1.1]} />
      <LocationMarker3D label="RELATED SITE" position={[-1.2, 0.1, 0.2]} />
    </group>
  );
}

type NetworkDisplayNode = {
  id: string;
  title: string;
  detail: string;
  color: string;
  kind: "call" | "person" | "location" | "evidence" | "record" | "finding";
  position: [number, number, number];
  primary?: boolean;
};

function CinematicNetworkNode({ node, index, progress, reducedMotion }: { node: NetworkDisplayNode; index: number; progress: number; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const panel = useRef<THREE.MeshStandardMaterial>(null);
  const delay = index * 0.1;
  useFrame(({ clock }) => {
    if (!group.current || !panel.current) return;
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, delay, Math.min(1, delay + 0.28));
    const float = reducedMotion ? 0 : Math.sin(clock.getElapsedTime() * 0.55 + index * 0.9) * 0.022;
    group.current.scale.setScalar(0.72 + reveal * 0.28);
    group.current.position.y = node.position[1] + float;
    group.current.position.z = node.position[2] + (1 - reveal) * -0.3;
    panel.current.opacity = 0.28 + reveal * 0.72;
    panel.current.emissive.set(node.primary ? node.color : "#000000");
    panel.current.emissiveIntensity = node.primary && !reducedMotion ? 0.025 + (0.5 + Math.sin(clock.getElapsedTime() * 1.4) * 0.5) * 0.035 : 0.015;
  });
  const width = node.primary ? 2.35 : 1.92;
  const height = node.primary ? 1.18 : 0.96;
  return (
    <group ref={group} position={node.position}>
      <mesh castShadow position={[0, 0, -0.05]}><boxGeometry args={[width, height, 0.09]} /><meshStandardMaterial ref={panel} {...REPLAY_MATERIALS.paper} transparent opacity={0.92} /></mesh>
      <mesh position={[-width * 0.47, 0, 0.006]}><boxGeometry args={[0.075, height * 0.82, 0.018]} /><meshBasicMaterial color={node.color} /></mesh>
      <mesh position={[0, -height * 0.42, 0.008]}><boxGeometry args={[width * 0.9, 0.025, 0.016]} /><meshBasicMaterial color={node.color} transparent opacity={node.primary ? 0.72 : 0.34} /></mesh>
      <Html position={[0.04, 0, 0.02]} center distanceFactor={7.2} style={{ pointerEvents: "none" }}>
        <InvestigationCard className="case-replay-network-card" eyebrow={node.kind} title={node.title} metadata={node.detail} tone={node.kind} primary={node.primary} />
      </Html>
    </group>
  );
}

function SignalPulse({ from, to, progress, reducedMotion }: { from: [number, number, number]; to: [number, number, number]; progress: number; reducedMotion: boolean }) {
  const pulse = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!pulse.current) return;
    const travel = reducedMotion ? 0.72 : (clock.getElapsedTime() * 0.22 + progress * 0.5) % 1;
    pulse.current.position.lerpVectors(new THREE.Vector3(...from), new THREE.Vector3(...to), travel);
  });
  return <group ref={pulse}><mesh><boxGeometry args={[0.16, 0.07, 0.07]} /><meshBasicMaterial color={REPLAY_COLORS.blue} /></mesh><pointLight color={REPLAY_COLORS.blue} intensity={0.75} distance={1.2} /></group>;
}

function curvedRoute(from: [number, number, number], to: [number, number, number], index: number): Array<[number, number, number]> {
  return [
    from,
    [
      (from[0] + to[0]) / 2 + (index % 2 === 0 ? -0.16 : 0.16),
      (from[1] + to[1]) / 2 + 0.34 + index * 0.035,
      (from[2] + to[2]) / 2 + 0.2,
    ],
    to,
  ];
}

export function NetworkScene3D({ event, progress, reducedMotion }: SceneProps) {
  const phase = getPhaseProgress(progress);
  const nodes = useMemo<NetworkDisplayNode[]>(() => {
    const isAnonymousTip = event.sourceTimelineId === "TL-002";
    const candidates = isAnonymousTip ? [
      { id: "anonymous-tip", title: "ANONYMOUS TIP", detail: `PRIMARY CALL / ${event.sourceTimelineId}`, color: REPLAY_COLORS.blue, kind: "call" as const, primary: true },
      { id: "switchboard", title: event.people[0]?.name ?? "SWITCHBOARD SOURCE", detail: "COMMUNICATION SOURCE", color: REPLAY_COLORS.blue, kind: "person" as const },
      { id: event.location?.id ?? "platform-9", title: event.location?.label ?? "PLATFORM 9", detail: "REFERENCED LOCATION", color: REPLAY_COLORS.green, kind: "location" as const },
      { id: "disturbance-report", title: "DISTURBANCE REPORT", detail: "CALL SUBJECT", color: REPLAY_COLORS.amber, kind: "finding" as const },
      { id: "victim-context", title: "VICTIM CONTEXT", detail: "PRIOR CONFIRMED SIGHTING", color: "#8b8982", kind: "record" as const },
      { id: event.sourceTimelineId, title: "CALL RECORD", detail: event.sourceTimelineId, color: "#b8892a", kind: "record" as const },
    ] : [
      { id: `${event.id}-focus`, title: event.headline, detail: `PRIMARY ${event.category}`, color: event.category === "ANALYSIS" ? REPLAY_COLORS.amber : REPLAY_COLORS.blue, kind: "finding" as const, primary: true },
      ...event.people.map((person) => ({ id: person.entityId, title: person.name, detail: person.role.toUpperCase(), color: person.role === "suspect" ? REPLAY_COLORS.red : REPLAY_COLORS.blue, kind: "person" as const })),
      ...(event.location ? [{ id: event.location.id, title: event.location.label, detail: "LOCATION", color: REPLAY_COLORS.green, kind: "location" as const }] : []),
      ...event.evidence.map((item) => ({ id: item.id, title: item.label, detail: item.sourceId, color: REPLAY_COLORS.amber, kind: "evidence" as const })),
      ...event.relatedNodeIds.map((id) => ({ id, title: id.replaceAll("-", " "), detail: "RELATED CASE RECORD", color: "#7e817b", kind: "record" as const })),
      { id: event.sourceTimelineId, title: "TIMELINE RECORD", detail: event.sourceTimelineId, color: "#8b8982", kind: "record" as const },
    ];
    const unique = candidates.filter((candidate, index, items) => items.findIndex((item) => item.id === candidate.id) === index).slice(0, 6);
    const fallbackLabels = ["CASE CONTEXT", "SOURCE RECORD", "SUPPORTED LINK", "LOCATION TRACE"];
    while (unique.length < 5) {
      const index = unique.length;
      unique.push({ id: `support-${index}`, title: fallbackLabels[index % fallbackLabels.length], detail: event.sourceTimelineId, color: "#8b8982", kind: "record" });
    }
    const positions: Array<[number, number, number]> = [[0, 2.05, 0.3], [-3.45, 2.55, -0.72], [3.45, 2.45, -0.92], [-3.3, 0.95, 0.15], [3.3, 0.9, -0.12], [0.1, 0.72, -1.55]];
    return unique.map((node, index) => ({ ...node, position: positions[index] }));
  }, [event]);

  return (
    <group>
      <StageFloor color="#ede9e0" />
      <mesh position={[0, 2.1, -3.6]}><planeGeometry args={[11, 5.4]} /><meshPhysicalMaterial color="#dcd8ce" transparent opacity={0.2} transmission={0.06} roughness={0.76} /></mesh>
      {[0.55, 2.05, 3.55].map((y) => <mesh key={y} position={[0, y, -3.48]}><boxGeometry args={[10.2, 0.035, 0.035]} /><meshStandardMaterial {...REPLAY_MATERIALS.metal} transparent opacity={0.24} /></mesh>)}
      {nodes.slice(1).map((node, index) => <AnimatedConnector key={node.id} points={curvedRoute(nodes[0].position, node.position, index)} color={index === 0 ? REPLAY_COLORS.blue : index === 1 ? REPLAY_COLORS.green : "#9a8f78"} progress={phase} reducedMotion={reducedMotion} delay={0.14 + index * 0.1} opacity={index < 2 ? 0.82 : 0.52} />)}
      {nodes.length > 3 && <AnimatedConnector points={[nodes[1].position, nodes[2].position, nodes[3].position]} color="#a4a097" progress={phase} reducedMotion={reducedMotion} delay={0.48} opacity={0.34} />}
      {nodes.map((node, index) => <CinematicNetworkNode key={node.id} node={node} index={index} progress={phase} reducedMotion={reducedMotion} />)}
      {nodes[1] && <SignalPulse from={nodes[0].position} to={nodes[1].position} progress={phase} reducedMotion={reducedMotion} />}
      <Html position={[0, 3.58, -2.7]} center transform distanceFactor={8}><div className="case-replay-network-heading"><span>RELATIONSHIP INTELLIGENCE</span><strong>{event.category === "CALL" ? "COMMUNICATION TRACE" : "CURATED CASE LINK"}</strong></div></Html>
    </group>
  );
}

export function InvestigationRoomScene(props: SceneProps) {
  return (
    <group>
      <StageFloor color="#e8e5dc" />
      <mesh position={[0, 2.25, -3.15]} receiveShadow><boxGeometry args={[9, 4.5, 0.18]} /><meshStandardMaterial color={REPLAY_COLORS.wall} roughness={0.94} /></mesh>
      <ForensicBoard event={props.event} progress={props.progress} reducedMotion={props.reducedMotion} />
      <InvestigationWorksurface event={props.event} progress={props.progress} reducedMotion={props.reducedMotion} />
      <ScenePeople {...props} sceneType="analysis" />
    </group>
  );
}

export function FallbackScene(props: SceneProps) {
  return (
    <group>
      <StageFloor color="#e8e5dc" />
      <ScenePeople {...props} sceneType="fallback" />
      {props.event.evidence[0] && <EvidenceObject evidence={props.event.evidence[0]} position={[2.2, 1.1, 0]} reducedMotion={props.reducedMotion} />}
      {props.event.location && <LocationMarker3D label={props.event.location.label} position={[-2.7, 0, -0.4]} />}
    </group>
  );
}
