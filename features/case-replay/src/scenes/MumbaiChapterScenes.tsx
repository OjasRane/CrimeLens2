"use client";

import { Html, RoundedBox, useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CinematicHuman } from "@replay/entities/ReplayEntities";
import type { CinematicBeat, CinematicCameraFrame } from "@replay/engine/CinematicBeatController";
import type { ReplayEvent } from "@replay/types";

export const CST_LEOPOLD_CAMERA: CinematicCameraFrame[] = [
  { position: [9, 4.8, 10.5], target: [0, 1.5, -1.2] },
  { position: [5.8, 2.8, 6.2], target: [-1.4, 1.2, -1.8] },
  { position: [2.2, 2.35, 4.1], target: [-.1, 1.75, -2.5] },
  { position: [7.8, 3.2, 7.2], target: [3.2, 1.2, -1.5] },
  { position: [9.2, 7.8, 10.2], target: [0, .5, -1.5] },
];

export const LEOPOLD_CAMERA: CinematicCameraFrame[] = [
  { position: [10.4, 4.5, 9.4], target: [3.8, 1.45, -1.9] },
  { position: [8.4, 2.9, 6.4], target: [4.7, 1.35, -2.25] },
  { position: [6.9, 2.45, 4.8], target: [5.15, 1.45, -2.55] },
  { position: [8.6, 3.2, 6.6], target: [3.7, 1.0, -1.55] },
  { position: [10.2, 7.4, 9.2], target: [1.8, .55, -1.8] },
];

export const LANDMARK_CAMERA: CinematicCameraFrame[] = [
  { position: [10, 5.2, 11], target: [0, 1.65, -1.8] },
  { position: [6.8, 3.0, 6.6], target: [0, 1.8, -2.3] },
  { position: [4.6, 2.6, 5.0], target: [0, 2.1, -2.5] },
  { position: [7.5, 3.4, 7], target: [1.2, 1.2, -1.2] },
  { position: [10, 8.5, 10], target: [0, .6, -2] },
];

function PhysicalSign({ position, eyebrow, title }: { position: [number, number, number]; eyebrow: string; title: string }) {
  return <Html center position={position} style={{ pointerEvents: "none" }}><div className="case-replay-physical-sign"><span>{eyebrow}</span><b>{title}</b></div></Html>;
}

function StreetGround() {
  const [diffuse, normal, arm] = useTexture([
    "/assets/replay/textures/concrete-pavement-diff-1k.jpg",
    "/assets/replay/textures/concrete-pavement-normal-1k.jpg",
    "/assets/replay/textures/concrete-pavement-arm-1k.jpg",
  ]);
  [diffuse, normal, arm].forEach((texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4.5, 3.2);
  });
  diffuse.colorSpace = THREE.SRGBColorSpace;
  return <group>
    <mesh position={[0,-.15,0]}><boxGeometry args={[18,.3,13]} /><meshStandardMaterial color="#8b8983" map={diffuse} normalMap={normal} normalScale={new THREE.Vector2(.35,.35)} aoMap={arm} roughnessMap={arm} roughness={.88} /></mesh>
    <mesh position={[0,.02,-3.9]}><boxGeometry args={[18,.28,3.3]} /><meshStandardMaterial color="#a9a397" roughness={.96} /></mesh>
    {[[-3,.01,1.1],[3,.01,1.1]].map((position,index)=><mesh key={index} position={position as [number,number,number]}><boxGeometry args={[4.2,.035,.13]} /><meshBasicMaterial color="#d8cfaa" /></mesh>)}
    {[-5.5,5.5].map(x=><group key={x} position={[x,0,-1.2]}><mesh position={[0,1.45,0]}><cylinderGeometry args={[.06,.09,2.9,12]} /><meshStandardMaterial color="#343936" /></mesh><mesh position={[0,2.95,0]}><sphereGeometry args={[.2,20,14]} /><meshStandardMaterial color="#e8ce77" emissive="#e8ce77" emissiveIntensity={.5} /></mesh></group>)}
  </group>;
}

const CAR_HALF_LENGTH_X = 1.78;
const CAR_HALF_WIDTH_Z = .92;
const HUMAN_CAR_CLEARANCE = .68;

function keepHumanOutsideCar(position: [number,number,number], carPosition?: [number,number,number]): [number,number,number] {
  if (!carPosition) return [position[0], 0, position[2]];
  const [x, , z] = position;
  const insideX = Math.abs(x - carPosition[0]) < CAR_HALF_LENGTH_X + HUMAN_CAR_CLEARANCE;
  const insideZ = Math.abs(z - carPosition[2]) < CAR_HALF_WIDTH_Z + HUMAN_CAR_CLEARANCE;
  if (!insideX || !insideZ) return [x, 0, z];
  return [carPosition[0] - CAR_HALF_LENGTH_X - HUMAN_CAR_CLEARANCE, 0, z];
}

function ResponderActors({ event, beat, spread = 1, evacuating = false, anchors, vehiclePosition }: { event: ReplayEvent; beat: CinematicBeat; spread?: number; evacuating?: boolean; anchors?: [number,number,number][]; vehiclePosition?: [number,number,number] }) {
  const action = beat.value("ACTION");
  return <>{event.people.slice(0,3).map((person,index)=>{
    const isCivilian = person.role === "witness" || person.role === "victim";
    const travel = isCivilian && evacuating ? action * (-.85 - index * .18) : person.role === "officer" ? action * .42 : 0;
    const anchor = anchors?.[index] ?? [-1.4*spread+index*1.25*spread,0,.55+(index%2)*.45];
    const safePosition = keepHumanOutsideCar([anchor[0]+travel,0,anchor[2]+travel*.18], vehiclePosition);
    return <CinematicHuman key={`${person.entityId}-${index}`} person={person} position={safePosition} rotationY={isCivilian && evacuating ? -1.08 : index===0?.28:-.35} showLabel={false} action={isCivilian || person.role === "officer" ? "shortWalk":"conversationIdle"} actionProgress={action} />;
  })}</>;
}

function IncidentCue({ position, amount, color = "#d99a20" }: { position: [number,number,number]; amount: number; color?: string }) {
  const ring = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({clock})=>{
    const pulse = .55 + Math.sin(clock.elapsedTime * 5.2) * .22;
    if (ring.current) ring.current.scale.setScalar(1 + amount * pulse * .42);
    if (light.current) light.current.intensity = amount * (1.1 + pulse * 1.6);
  });
  return <group position={position} visible={amount > .015}>
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.24,.29,36]} /><meshBasicMaterial color={color} transparent opacity={amount*.82} /></mesh>
    <pointLight ref={light} position={[0,.65,0]} color={color} distance={4.2} />
  </group>;
}

function StationHall() {
  return <group position={[-1.25,0,-3.1]}>
    <mesh position={[0,2.15,0]}><boxGeometry args={[8.8,4.3,.7]} /><meshStandardMaterial color="#a98963" roughness={.95} /></mesh>
    {[-3,-1.5,0,1.5,3].map(x=><group key={x} position={[x,1.65,.38]}><mesh><boxGeometry args={[1.12,2.45,.16]} /><meshStandardMaterial color="#342f2a" /></mesh><mesh position={[0,1.14,0]}><torusGeometry args={[.56,.17,10,32,Math.PI]} /><meshStandardMaterial color="#c3a076" /></mesh><mesh position={[0,.02,.1]}><boxGeometry args={[.78,1.72,.08]} /><meshPhysicalMaterial color="#738d8f" transparent opacity={.58} /></mesh></group>)}
    <mesh position={[0,3.45,.48]}><boxGeometry args={[3.2,.62,.1]} /><meshStandardMaterial color="#efe6d2" /></mesh>
    <PhysicalSign position={[0,3.45,.58]} eyebrow="RAILWAY TERMINUS" title="CHHATRAPATI SHIVAJI TERMINUS" />
    <group position={[3.1,3.1,.58]}><mesh><circleGeometry args={[.38,32]} /><meshStandardMaterial color="#f3efe5" /></mesh><mesh position={[0,0,.02]} rotation={[0,0,-.65]}><boxGeometry args={[.025,.27,.02]} /><meshBasicMaterial color="#111" /></mesh></group>
    {[-2.6,0,2.6].map(x=><group key={x} position={[x,.3,1.75]}><mesh position={[0,.32,0]}><boxGeometry args={[1.5,.12,.42]} /><meshStandardMaterial color="#4b4035" /></mesh>{[-.58,.58].map(leg=><mesh key={leg} position={[leg,.15,0]}><boxGeometry args={[.09,.34,.3]} /><meshStandardMaterial color="#34322f" /></mesh>)}</group>)}
  </group>;
}

function CafeFrontage({ reveal }: { reveal: number }) {
  return <group position={[5.2,0,-2.85]} scale={.82+.18*reveal}>
    <mesh position={[0,1.75,0]}><boxGeometry args={[4.2,3.5,.8]} /><meshStandardMaterial color="#9c7a5e" roughness={.96} /></mesh>
    <mesh position={[0,2.7,.46]}><boxGeometry args={[3.35,.62,.12]} /><meshStandardMaterial color="#f1e5c9" /></mesh>
    <PhysicalSign position={[0,2.7,.55]} eyebrow="COLABA STREET FRONTAGE" title="LEOPOLD CAFE" />
    {[-1.15,0,1.15].map(x=><mesh key={x} position={[x,1.35,.46]}><boxGeometry args={[.78,1.6,.1]} /><meshPhysicalMaterial color="#607f82" transparent opacity={.62} /></mesh>)}
    <mesh position={[0,.42,.62]}><boxGeometry args={[4.8,.18,1.3]} /><meshStandardMaterial color="#aaa397" /></mesh>
  </group>;
}

export function CSTLeopoldReconstruction({ event, beat }: { event: ReplayEvent; beat: CinematicBeat }) {
  const leopoldFocus = event.sourceTimelineId === "TL-005";
  const incident = beat.value("ACTION");
  const response = beat.value("CONSEQUENCE");
  const vehiclePosition: [number,number,number] = leopoldFocus ? [2.9,0,.9] : [3.8,0,1.25];
  const actorAnchors: [number,number,number][] = leopoldFocus
    ? [[-3.35,0,.55],[-1.55,0,-.62]]
    : [[-3.4,0,.5],[-1.7,0,-.62],[.05,0,-1.18]];
  return <group><color attach="background" args={["#d8d1c3"]} /><fog attach="fog" args={["#d8d1c3",13,30]} /><ambientLight intensity={1.0} /><directionalLight position={[6,10,6]} intensity={1.7} color="#f1dfba" />
    <StreetGround /><StationHall /><CafeFrontage reveal={leopoldFocus ? 1 : beat.value("CONSEQUENCE")} /><ResponderActors event={event} beat={beat} evacuating anchors={actorAnchors} vehiclePosition={vehiclePosition} />
    <group position={[-.1,2.85,-2.2]}><mesh><boxGeometry args={[.42,.32,.5]} /><meshStandardMaterial color="#343a38" /></mesh><mesh position={[0,0,.32]}><cylinderGeometry args={[.1,.14,.24,14]} /><meshStandardMaterial color="#171a19" /></mesh></group>
    <IncidentCue position={leopoldFocus ? [5.05,.15,-1.45] : [-1.1,.15,-1.2]} amount={incident} color={leopoldFocus ? "#d64545" : "#d99a20"} />
    <ResponseVehicle position={vehiclePosition} phase={1.5} arrival={response} arrivalOffset={5.2} />
    <PhysicalSign position={leopoldFocus ? [4.4,3.5,-2.15] : [-3.65,2.65,-1.45]} eyebrow={leopoldFocus ? "SECOND VERIFIED LOCATION" : "EVIDENCE VIEW"} title={leopoldFocus ? "LEOPOLD / CITY ALERT" : "CCTV / ALERT CHRONOLOGY"} />
  </group>;
}

function ResponseVehicle({ position, variant = "police", phase = 0, arrival = 1, arrivalOffset = 5.2 }: { position: [number,number,number]; variant?: "police" | "ambulance"; phase?: number; arrival?: number; arrivalOffset?: number }) {
  const root = useRef<THREE.Group>(null);
  const vehicleAsset = useGLTF(variant === "ambulance" ? "/assets/replay/vehicles/ambulance-response.glb" : "/assets/replay/vehicles/police-response.glb");
  const vehicle = useMemo(() => vehicleAsset.scene.clone(true), [vehicleAsset.scene]);
  useFrame(({ clock }) => {
    if (root.current) {
      root.current.position.x = position[0] + (1 - arrival) * arrivalOffset;
      root.current.position.y = position[1] + Math.sin(clock.elapsedTime * .65 + phase) * .004;
      root.current.position.z = position[2];
    }
  });
  return <group ref={root} position={position} rotation={[0,phase ? -.08 : .06,0]}>
    <primitive object={vehicle} scale={1.22} rotation={[0,Math.PI / 2,0]} />
    <pointLight position={[0,1.1,0]} color={variant === "ambulance" ? "#d64a4a" : "#356fd6"} intensity={.9 + (Math.sin(phase * 5) + 1) * .4} distance={3.5} />
  </group>;
}

export function CityResponseReconstruction({ event, beat, specialist = false }: { event: ReplayEvent; beat: CinematicBeat; specialist?: boolean }) {
  const arrival = beat.value("ACTION");
  return <group><color attach="background" args={["#cbc6bb"]} /><fog attach="fog" args={["#cbc6bb",14,30]} /><ambientLight intensity={.9} /><directionalLight position={[7,9,5]} intensity={1.6} />
    <StreetGround />
    <group position={[0,2.1,-4]}><mesh><boxGeometry args={[13,4.2,.65]} /><meshStandardMaterial color="#908b82" /></mesh>{[-4.8,-2.4,0,2.4,4.8].map(x=><mesh key={x} position={[x,.2,.36]}><boxGeometry args={[1.45,2.6,.1]} /><meshPhysicalMaterial color="#789092" transparent opacity={.55} /></mesh>)}</group>
    <ResponseVehicle position={[3.5,0,.8]} phase={0} arrival={arrival} arrivalOffset={5.2} /><ResponseVehicle position={[-3.8,0,1.6]} variant="ambulance" phase={2.4} arrival={arrival} arrivalOffset={-5.2} />
    {[-2.1,-1.4,-.7,.7,1.4,2.1].map((x,index)=><group key={x} position={[x,.45,-.4]} rotation={[0,0,index%2?.08:-.08]}><mesh><boxGeometry args={[.58,.68,.08]} /><meshStandardMaterial color={index%2?"#f0d054":"#303532"} /></mesh></group>)}
    {[-2.6,-1.3,0,1.3,2.6].map((x,index)=><group key={`cone-${x}`} position={[x,.24,.18]}><mesh><coneGeometry args={[.16,.48,16]} /><meshStandardMaterial color="#c96d35" /></mesh><mesh position={[0,-.21,0]}><cylinderGeometry args={[.23,.23,.05,18]} /><meshStandardMaterial color="#2d302e" /></mesh>{index<4&&<mesh position={[.65,.33,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.018,.018,1.3,8]} /><meshBasicMaterial color="#e2bd4f" /></mesh>}</group>)}
    <ResponderActors event={event} beat={beat} spread={.8} />
    <PhysicalSign position={[0,3.2,-3.55]} eyebrow={specialist?"SPECIALIST CONTAINMENT":"CITY RESPONSE"} title={specialist?"COORDINATED SITE ASSIGNMENT":"RESPONSE CORRIDORS / PERIMETERS"} />
  </group>;
}

function TajFacade() {
  return <group position={[0,0,-3]}>
    <RoundedBox args={[9.6,3.65,1.15]} radius={.14} smoothness={4} position={[0,2.02,0]}><meshPhysicalMaterial color="#bda17e" roughness={.68} clearcoat={.12} /></RoundedBox>
    <RoundedBox args={[3.05,4.65,1.35]} radius={.12} smoothness={4} position={[0,2.62,.05]}><meshPhysicalMaterial color="#b49370" roughness={.66} clearcoat={.14} /></RoundedBox>
    {[-4.2,4.2].map(x=><group key={x} position={[x,3.68,0]}><mesh><boxGeometry args={[1.15,1.3,1.18]} /><meshStandardMaterial color="#aa8b6c" /></mesh><mesh position={[0,.73,0]}><coneGeometry args={[.8,1.0,8]} /><meshStandardMaterial color="#795043" roughness={.7} /></mesh></group>)}
    <mesh position={[0,5.02,.03]}><cylinderGeometry args={[1.08,1.52,.78,32]} /><meshStandardMaterial color="#8c5742" roughness={.64} /></mesh>
    <mesh position={[0,5.47,.03]}><sphereGeometry args={[.86,36,20,0,Math.PI*2,0,Math.PI/2]} /><meshPhysicalMaterial color="#75473c" roughness={.58} clearcoat={.16} /></mesh>
    <mesh position={[0,6.02,.03]}><cylinderGeometry args={[.055,.08,.55,12]} /><meshStandardMaterial color="#3e4543" metalness={.48} /></mesh>
    {[-3.8,-2.8,-1.85,-.92,0,.92,1.85,2.8,3.8].map((x,index)=><group key={x} position={[x,2.1,.61]}>
      <mesh><boxGeometry args={[.52,1.52,.08]} /><meshPhysicalMaterial color="#58787b" transparent opacity={.74} roughness={.24} /></mesh>
      <mesh position={[0,.86,0]}><torusGeometry args={[.27,.075,10,28,Math.PI]} /><meshStandardMaterial color="#d5bb95" /></mesh>
      <mesh position={[0,-.92,.03]}><boxGeometry args={[.64,.07,.05]} /><meshBasicMaterial color={index%2?"#c8a672":"#d9bf93"} /></mesh>
    </group>)}
    {[-3.45,-2.45,2.45,3.45].map(x=><group key={`balcony-${x}`} position={[x,3.28,.7]}><mesh><boxGeometry args={[.85,.06,.3]} /><meshStandardMaterial color="#6a5140" /></mesh>{[-.32,0,.32].map(pin=><mesh key={pin} position={[pin,.18,.12]}><boxGeometry args={[.035,.36,.035]} /><meshStandardMaterial color="#4d4941" /></mesh>)}</group>)}
    <group position={[0,.72,.72]}><mesh><boxGeometry args={[2.05,1.36,.1]} /><meshStandardMaterial color="#3f4948" /></mesh><mesh position={[0,.72,0]}><torusGeometry args={[1.02,.18,12,40,Math.PI]} /><meshStandardMaterial color="#d3b28c" /></mesh></group>
    <PhysicalSign position={[0,3.65,.78]} eyebrow="COLABA LANDMARK" title="TAJ MAHAL PALACE" />
    <pointLight position={[0,2.5,2]} color="#e7c777" intensity={2.6} distance={9} />
    <pointLight position={[-3.8,2.2,1.2]} color="#e5c88b" intensity={1.4} distance={6} />
    <pointLight position={[3.8,2.2,1.2]} color="#e5c88b" intensity={1.4} distance={6} />
  </group>;
}

export function TajReconstruction({ event, beat }: { event: ReplayEvent; beat: CinematicBeat }) {
  return <group><color attach="background" args={["#77756f"]} /><fog attach="fog" args={["#77756f",17,35]} /><ambientLight intensity={.76} color="#c7c2b7" /><directionalLight position={[7,11,6]} intensity={2.1} color="#f0dfbd" /><StreetGround /><TajFacade /><ResponderActors event={event} beat={beat} spread={.8} /><ResponseVehicle position={[3.6,0,1.2]} phase={1.1} /></group>;
}

function OberoiFacade() { return <group position={[-3,0,-3]}><mesh position={[0,3.4,0]}><boxGeometry args={[3.9,6.8,1.15]} /><meshStandardMaterial color="#8f9692" /></mesh>{[-1.35,-.45,.45,1.35].flatMap(x=>[1.1,2,2.9,3.8,4.7,5.6].map(y=><mesh key={`${x}-${y}`} position={[x,y,.59]}><boxGeometry args={[.48,.35,.05]} /><meshBasicMaterial color="#92afb1" /></mesh>))}<PhysicalSign position={[0,5.7,.68]} eyebrow="NARIMAN POINT" title="OBEROI-TRIDENT" /></group>; }
function NarimanFacade() { return <group position={[3.6,0,-3]}><mesh position={[0,2.8,0]}><boxGeometry args={[2.5,5.6,.9]} /><meshStandardMaterial color="#a98f73" /></mesh>{[-.72,0,.72].flatMap(x=>[.9,1.8,2.7,3.6,4.5].map(y=><mesh key={`${x}-${y}`} position={[x,y,.47]}><boxGeometry args={[.38,.42,.06]} /><meshBasicMaterial color="#718889" /></mesh>))}{[-2.1,2.1].map(x=><mesh key={x} position={[x,2,-.35]}><boxGeometry args={[1.25,4,.8]} /><meshStandardMaterial color="#91897e" /></mesh>)}<PhysicalSign position={[0,4.7,.58]} eyebrow="DENSE COLABA NEIGHBOURHOOD" title="NARIMAN HOUSE" /></group>; }

export function OberoiNarimanReconstruction({ event, beat }: { event: ReplayEvent; beat: CinematicBeat }) {
  return <group><color attach="background" args={["#cbc6ba"]} /><fog attach="fog" args={["#cbc6ba",15,32]} /><ambientLight intensity={1} /><directionalLight position={[5,10,7]} intensity={1.7} /><StreetGround /><OberoiFacade /><NarimanFacade /><ResponderActors event={event} beat={beat} spread={.72} />
    {[-5.4,-4.9,5.35].map(x=><group key={x} position={[x,0,-1.4]}><mesh position={[0,1.2,0]}><cylinderGeometry args={[.05,.08,2.4,12]} /><meshStandardMaterial color="#353a38" /></mesh><mesh position={[0,2.45,0]}><sphereGeometry args={[.16,16,12]} /><meshStandardMaterial color="#efd57b" emissive="#efd57b" emissiveIntensity={.35} /></mesh></group>)}
  </group>;
}

useGLTF.preload("/assets/replay/vehicles/police-response.glb");
useGLTF.preload("/assets/replay/vehicles/ambulance-response.glb");
