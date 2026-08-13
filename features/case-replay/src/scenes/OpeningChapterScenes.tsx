"use client";

import { Html, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AnimatedConnector } from "@replay/components/SceneMotion";
import { InvestigationCard } from "@replay/components/InvestigationCard";
import { SceneTargetAnchor, ScreenSpaceAnnotation } from "@replay/components/AnnotationLayoutManager";
import { CinematicHuman } from "@replay/entities/ReplayEntities";
import type { CinematicBeat, CinematicCameraFrame } from "@replay/engine/CinematicBeatController";
import type { ReplayEvent } from "@replay/types";
import { DINGHY_ROUTE, DINGHY_WATER_BOUNDARY, MV_KUBER_ROUTE, sampleConstrainedRoute } from "@replay/engine/SurfaceRouteConstraints";

export const MARITIME_CAMERA: CinematicCameraFrame[] = [
  { position: [11.5, 4.4, 10.5], target: [-1.3, 0.45, 0] },
  { position: [7.2, 2.8, 7.4], target: [-0.1, 0.55, 0] },
  { position: [5.4, 4.1, 7.5], target: [0.8, 0.25, -0.7] },
  { position: [4.2, 3.2, 5.2], target: [0.2, 0.6, -0.1] },
  { position: [7.8, 8.8, 10.8], target: [3.1, 0.1, -3.2] },
];

export const COASTAL_CAMERA: CinematicCameraFrame[] = [
  { position: [-9.4, 3.4, 9.2], target: [-0.6, 0.6, 0] },
  { position: [-6.2, 2.6, 6.3], target: [0.2, 0.65, -0.3] },
  { position: [5.8, 3.3, 7.2], target: [0.2, 0.55, -0.5] },
  { position: [6.8, 5.8, 8.0], target: [0.5, 0.2, -0.8] },
  { position: [7.6, 10.8, 9.2], target: [0.4, 0, -0.8] },
];

export const MUMBAI_MAP_CAMERA: CinematicCameraFrame[] = [
  { position: [7.8, 8.6, 9.5], target: [0.1, 0, 0.7] },
  { position: [7.2, 10.8, 8.0], target: [0.3, 0, 0] },
  { position: [8.8, 9.0, 8.3], target: [0.4, 0.2, 0] },
  { position: [7.0, 8.0, 7.2], target: [0.7, 0.2, -0.4] },
  { position: [4.0, 3.9, 4.8], target: [2.05, 0.25, -2.65] },
];

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);

function OceanSurface({ colorA = "#172b31", colorB = "#405d62", calm = false }: { colorA?: string; colorB?: string; calm?: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime; });
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(colorA) },
    uColorB: { value: new THREE.Color(colorB) },
    uAmplitude: { value: calm ? 0.075 : 0.14 },
    uFoam: { value: calm ? .12 : .29 },
  }), [calm, colorA, colorB]);
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 0]}>
    <planeGeometry args={[38, 30, 90, 72]} />
    <shaderMaterial ref={material} uniforms={uniforms} side={THREE.DoubleSide} transparent vertexShader={`
      uniform float uTime; uniform float uAmplitude; varying float vWave; varying vec2 vUv;
      void main(){ vUv=uv; vec3 p=position; float a=sin(p.x*.52+uTime*.8); float b=cos(p.y*.38-uTime*.58); float c=sin((p.x+p.y)*.22+uTime*.42); float chop=sin(p.x*1.7-p.y*.8+uTime*1.7)*.14; vWave=(a*.48+b*.34+c*.18+chop); p.z += vWave*uAmplitude; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }
    `} fragmentShader={`
      uniform vec3 uColorA; uniform vec3 uColorB; uniform float uFoam; varying float vWave; varying vec2 vUv;
      void main(){ float horizon=smoothstep(.05,.95,vUv.y); float crest=smoothstep(.42,.91,vWave)*uFoam; float glint=smoothstep(.75,.99,fract(sin(dot(vUv*310.,vec2(12.9898,78.233)))*43758.5453))*.14; vec3 color=mix(uColorA,uColorB,horizon*.76+glint); color=mix(color,vec3(.78,.86,.84),crest); gl_FragColor=vec4(color,1.0); }
    `} />
  </mesh>;
}

function SkyDome({ zenith = "#172b31", horizon = "#849294" }: { zenith?: string; horizon?: string }) {
  const uniforms = useMemo(() => ({ uZenith: { value: new THREE.Color(zenith) }, uHorizon: { value: new THREE.Color(horizon) } }), [horizon, zenith]);
  return <mesh scale={42}><sphereGeometry args={[1, 36, 20]} /><shaderMaterial uniforms={uniforms} side={THREE.BackSide} depthWrite={false} vertexShader={`varying float vY; void main(){vY=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`uniform vec3 uZenith; uniform vec3 uHorizon; varying float vY; void main(){float t=smoothstep(-.18,.78,vY); gl_FragColor=vec4(mix(uHorizon,uZenith,t),1.0);}`} /></mesh>;
}

function Wake({ amount }: { amount: number }) {
  return <group position={[-2.6, -0.03, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
    {[0, 1, 2].map((index) => <mesh key={index} position={[-index * 1.1, 0, 0]} scale={[1 + index * .45, 1, 1]}>
      <ringGeometry args={[0.48 + index * .18, 0.51 + index * .18, 48, 1, 0.25, Math.PI * 1.5]} />
      <meshBasicMaterial color="#c7d7d4" transparent opacity={amount * (0.24 - index * .05)} />
    </mesh>)}
  </group>;
}

function VesselDetails() {
  return <>
    {/* purpose-built fishing gear, rails and deck hardware make the vessel legible at replay distance */}
    {[-1.65,-1.08,-.5,.08,.66].map((x) => <group key={x} position={[x,.58,.67]}>
      <mesh><cylinderGeometry args={[.021,.021,.52,8]} /><meshStandardMaterial color="#303a3a" metalness={.48} roughness={.42} /></mesh>
      <mesh position={[.28,.22,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.016,.016,.58,8]} /><meshStandardMaterial color="#303a3a" metalness={.48} roughness={.42} /></mesh>
    </group>)}
    {[-.4,.18,.76].map((x) => <group key={x} position={[x,.37,.18]} rotation={[Math.PI/2,0,0]}>
      <mesh><torusGeometry args={[.24,.028,8,24]} /><meshStandardMaterial color="#bd7b4e" roughness={.52} /></mesh>
      <mesh position={[0,0,.05]}><cylinderGeometry args={[.035,.035,.22,10]} /><meshStandardMaterial color="#364140" metalness={.5} /></mesh>
    </group>)}
    <group position={[-1.62,.52,-.18]}><mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.27,.27,.65,20]} /><meshStandardMaterial color="#9c7551" roughness={.84} /></mesh><mesh position={[0,.34,0]}><boxGeometry args={[.66,.05,.08]} /><meshStandardMaterial color="#c6b185" /></mesh></group>
    <group position={[.52,1.48,.12]}><mesh rotation={[0,0,.15]}><cylinderGeometry args={[.025,.025,1.85,8]} /><meshStandardMaterial color="#27302f" metalness={.48} /></mesh><mesh position={[.13,.82,0]} rotation={[0,0,.15]}><planeGeometry args={[.58,.34]} /><meshStandardMaterial color="#d4b45b" side={THREE.DoubleSide} /></mesh></group>
  </>;
}

function TrawlerVessel({ amount }: { amount: number }) {
  const root = useRef<THREE.Group>(null);
  const vesselAsset = useGLTF("/assets/replay/boats/fishing-vessel.glb");
  const vessel = useMemo(() => vesselAsset.scene.clone(true), [vesselAsset.scene]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const time = clock.elapsedTime;
    root.current.position.y = .52 + Math.sin(time * .9) * .055;
    root.current.rotation.z = Math.sin(time * .62) * .018;
    root.current.rotation.x = Math.cos(time * .48) * .012;
    root.current.position.fromArray(sampleConstrainedRoute(MV_KUBER_ROUTE, Math.min(amount, 1)));
  });
  return <group ref={root} position={MV_KUBER_ROUTE[0].position} rotation={[0, -.18, 0]}>
    <primitive object={vessel} scale={1.45} rotation={[0,Math.PI,0]} />
    <pointLight position={[-.4,1.55,.03]} color="#f0d784" intensity={1.7} distance={5} />
    <Wake amount={amount} />
  </group>;
}

function InflatableDinghy({ progress }: { progress: number }) {
  const root = useRef<THREE.Group>(null);
  const dinghyAsset = useGLTF("/assets/replay/boats/landing-dinghy.glb");
  const dinghy = useMemo(() => dinghyAsset.scene.clone(true), [dinghyAsset.scene]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    root.current.position.fromArray(sampleConstrainedRoute(DINGHY_ROUTE, Math.min(progress / .58, 1), DINGHY_WATER_BOUNDARY));
    root.current.position.y += Math.sin(clock.elapsedTime * 1.25) * .025;
    root.current.rotation.z = Math.sin(clock.elapsedTime * .8) * .012;
    const exitScale = THREE.MathUtils.clamp(1 - (progress - .8) / .14, 0, 1);
    root.current.scale.setScalar(exitScale);
  });
  return <group ref={root} position={DINGHY_ROUTE[0].position} rotation={[0, -.34, 0]}>
    <primitive object={dinghy} scale={1.05} rotation={[0,Math.PI/2,0]} />
    <Wake amount={Math.min(1, progress/.55)} />
  </group>;
}

function DistantMumbai({ amount }: { amount: number }) {
  return <group position={[6.2, 0, -6.5]} scale={[.76,.76,.76]}>
    {Array.from({ length: 16 }, (_, index) => {
      const x = (index % 8) * .72 - 2.5; const z = Math.floor(index / 8) * .8; const h = .9 + ((index * 7) % 9) * .17;
      return <group key={index} position={[x,h/2,z]}><mesh><boxGeometry args={[.55,h,.6]} /><meshStandardMaterial color="#9b927f" roughness={.92} transparent opacity={.015 + amount * .82} /></mesh>{[.18,.5,.82].filter(y=>y<h).map(y=><mesh key={y} position={[0,y-h/2,.305]}><boxGeometry args={[.28,.06,.012]} /><meshBasicMaterial color="#e6c45f" transparent opacity={amount*.7} /></mesh>)}</group>;
    })}
  </group>;
}

export function MaritimeReconstructionScene({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const route = clamp01((beat.progress - .18) / .68);
  return <group>
    <SkyDome zenith="#12252c" horizon="#718084" />
    <ambientLight intensity={.45} color="#789296" /><directionalLight position={[-5,8,4]} intensity={1.25} color="#d7ded2" />
    <OceanSurface /><TrawlerVessel amount={beat.value("ACTION")} />
    <DistantMumbai amount={beat.value("TRANSITION")} />
    <AnimatedConnector points={[[-5.8,.02,2.8],[-3,.1,1.25],[-.7,.16,0],[1.8,.22,-1.8],[5.5,.3,-5.2]]} color="#f4c94f" progress={route} reducedMotion={reducedMotion} opacity={.92} />
    <Html center position={[-.1,2.1,0]} style={{ pointerEvents: "none" }}><div className="case-replay-object-tag" data-visible={beat.progress > .18}><b>MV KUBER</b><span>VESSEL / RECOVERED RECORD</span></div></Html>
  </group>;
}

function ShorelineBuildings({ morph }: { morph: number }) {
  const root = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (root.current) root.current.scale.y = THREE.MathUtils.damp(root.current.scale.y, 1 - morph * .68, 5, delta); });
  return <group ref={root} position={[4.35,0,-2.45]}>
    {Array.from({ length: 18 }, (_, index) => { const x=(index%6)*1.1-2.6; const z=Math.floor(index/6)*1.05; const h=1.7+((index*5)%8)*.32; return <group key={index} position={[x,h/2,z]}><mesh><boxGeometry args={[.86,h,.82]} /><meshStandardMaterial color={index%4===0?"#8f816b":"#a6a095"} roughness={.9} /></mesh>{[.3,.75,1.2,1.65,2.1].filter(y=>y<h-.15).map(y=><mesh key={y} position={[0,y-h/2,.42]}><boxGeometry args={[.5,.12,.02]} /><meshBasicMaterial color="#e2c773" /></mesh>)}</group>; })}
  </group>;
}

export function CoastalLandingScene({ event, beat, reducedMotion }: { event: ReplayEvent; beat: CinematicBeat; reducedMotion: boolean }) {
  const morph = beat.value("TRANSITION"); const person = event.people[0];
  return <group>
    <SkyDome zenith="#253a40" horizon="#899492" />
    <ambientLight intensity={.7} color="#a8b7b1" /><directionalLight position={[6,9,4]} intensity={1.6} color="#ecd8aa" />
    <OceanSurface colorA="#20383e" colorB="#657678" calm />
    <mesh position={[3.1,.08,0]}><boxGeometry args={[7.4,.38,12]} /><meshStandardMaterial color="#77766f" roughness={.94} /></mesh>
    <mesh position={[.55,.31,0]}><boxGeometry args={[2.0,.12,11.4]} /><meshStandardMaterial color="#aaa397" roughness={.92} /></mesh>
    <mesh position={[-.65,.32,0]}><boxGeometry args={[.42,.72,12]} /><meshStandardMaterial color="#a49e91" roughness={.92} /></mesh>
    <group position={[-.7,.6,0]}>{[-4,-2,0,2,4].map(z=><mesh key={z} position={[0,.25,z]}><boxGeometry args={[.12,.8,.12]} /><meshStandardMaterial color="#343a38" /></mesh>)}<mesh position={[0,.7,0]}><boxGeometry args={[.12,.1,9]} /><meshStandardMaterial color="#343a38" /></mesh></group>
    {[[-.35,0.0],[-.35,-1.1],[-.35,1.1]].map(([x,z])=><mesh key={z} position={[x,.15,z]}><boxGeometry args={[1.2,.2,.78]} /><meshStandardMaterial color="#89867e" /></mesh>)}
    {[-1.8,-.35,1.1].map(z=><group key={z} position={[.05,.6,z]}><mesh><cylinderGeometry args={[.12,.14,1.2,14]} /><meshStandardMaterial color="#3c4544" /></mesh><mesh position={[0,.58,0]}><torusGeometry args={[.2,.05,12,24]} /><meshStandardMaterial color="#454d4c" /></mesh></group>)}
    <InflatableDinghy progress={beat.progress} /><ShorelineBuildings morph={morph} />
    {person && [0,1,2].map(index=><CinematicHuman key={index} person={person} position={[-.05+index*.42,.38,.42-index*.34]} rotationY={-.45} showLabel={false} action="shortWalk" actionProgress={clamp01((beat.progress-.56)/.28)} reducedMotion={reducedMotion} />)}
    <AnimatedConnector points={[[-4.8,.08,1.8],[-3.2,.14,1.05],[-2.25,.18,.52],[-1.76,.2,.18]]} color="#7faaa9" progress={Math.min(1,beat.progress/.58)} reducedMotion={reducedMotion} />
    <AnimatedConnector points={[[-.48,.42,.18],[.18,.43,.05],[.68,.44,-.55],[.92,.45,-1.42]]} color="#f4c94f" progress={clamp01((beat.progress-.56)/.38)} reducedMotion={reducedMotion} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[1.5,.42,-.4]}><planeGeometry args={[9,8,12,12]} /><meshBasicMaterial color="#191b19" wireframe transparent opacity={morph*.16} /></mesh>
    <SceneTargetAnchor id="badhwar-landing-edge" position={[-.62,.42,.18]} avoidRadius={44}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.2,.27,32]} /><meshBasicMaterial color="#2baf83" /></mesh></SceneTargetAnchor>
    <ScreenSpaceAnnotation id="badhwar-landing-card" targetObjectId="badhwar-landing-edge" anchorType="location" priority={92} lanes={["TOP_RIGHT","RIGHT","TOP"]} width={218} height={78} gap={18} accent="#2baf83"><InvestigationCard eyebrow="LANDING POINT" title="BADHWAR PARK COASTAL EDGE" subtitle="DINGHY STOPS / PEOPLE CONTINUE ON LAND" tone="location" /></ScreenSpaceAnnotation>
  </group>;
}

const SITE_CONFIG = [
  { id:"landing", label:"LANDING POINT", coordinates:[72.8258,18.9102], threshold:0, tone:"green" },
  { id:"cst", label:"CST", coordinates:[72.8355,18.9398], threshold:.18, tone:"red" },
  { id:"leopold", label:"LEOPOLD CAFE", coordinates:[72.8315,18.922], threshold:.32, tone:"red" },
  { id:"taj", label:"TAJ MAHAL PALACE", coordinates:[72.8332,18.9217], threshold:.46, tone:"red" },
  { id:"oberoi", label:"OBEROI-TRIDENT", coordinates:[72.8208,18.9283], threshold:.60, tone:"red" },
  { id:"nariman", label:"NARIMAN HOUSE", coordinates:[72.8291,18.9109], threshold:.72, tone:"red" },
] as const;

const sitePosition = (coordinates: readonly [number,number]): [number,number,number] => [(coordinates[0]-72.824)*180,.2,-(coordinates[1]-18.925)*180];

function MapMarker({ site, visible, focus, labelVisible }: { site: typeof SITE_CONFIG[number]; visible: number; focus: boolean; labelVisible: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({clock})=>{ if(ring.current){ const s=1+Math.sin(clock.elapsedTime*2.2)*.12; ring.current.scale.setScalar(s); }});
  const color = site.tone === "green" ? "#2baf83" : "#d64545";
  return <group position={sitePosition(site.coordinates)} scale={Math.max(.001,visible)}>
    <mesh position={[0,.15,0]}><cylinderGeometry args={[.07,.13,.31,20]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={focus?.75:.35} /></mesh>
    <mesh ref={ring} rotation={[-Math.PI/2,0,0]} position={[0,.02,0]}><ringGeometry args={[.2,.26,36]} /><meshBasicMaterial color={focus?"#f4c94f":color} transparent opacity={.82} /></mesh>
    <Html center position={[0,.58,0]} style={{ pointerEvents: "none" }}><div className="case-replay-map-site-label" data-focus={focus} data-visible={labelVisible}><b>{site.label}</b><span>{site.id === "landing" ? "ORIGIN" : "CONFIRMED SITE"}</span></div></Html>
  </group>;
}

function CityExtrusions() {
  const ref = useRef<THREE.InstancedMesh>(null); const count=48;
  useLayoutEffect(()=>{ if(!ref.current)return; const matrix=new THREE.Matrix4(); const rotation=new THREE.Quaternion(); for(let i=0;i<count;i++){ const column=i%8,row=Math.floor(i/8); const x=-2.45+column*.78+(row%2)*.18,z=-3.1+row*1.16; const shoreline=-2.45+z*.28; if(x<shoreline){ matrix.makeScale(.001,.001,.001); }else{ const h=.07+((i*13)%8)*.032; const sx=.36+((i*7)%5)*.09; const sz=.38+((i*11)%4)*.12; rotation.setFromEuler(new THREE.Euler(0,((i%3)-1)*.035,0)); matrix.compose(new THREE.Vector3(x,h/2,z),rotation,new THREE.Vector3(sx,h,sz)); } ref.current.setMatrixAt(i,matrix);} ref.current.instanceMatrix.needsUpdate=true; },[]);
  return <instancedMesh ref={ref} args={[undefined,undefined,count]}><boxGeometry args={[1,1,1]} /><meshStandardMaterial color="#aaa79d" roughness={.94} /></instancedMesh>;
}

function Road({ points }: { points: [number,number,number][] }) { const curve=useMemo(()=>new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),[points]); return <mesh><tubeGeometry args={[curve,32,.025,6,false]} /><meshBasicMaterial color="#363936" /></mesh>; }

export function MumbaiCaseMapScene({ beat, reducedMotion }: { beat: CinematicBeat; reducedMotion: boolean }) {
  const landShape=useMemo(()=>{ const shape=new THREE.Shape(); shape.moveTo(-3.1,4.1); shape.lineTo(1.1,4.1); shape.lineTo(2.05,3.25); shape.lineTo(1.65,1.8); shape.lineTo(2.55,.1); shape.lineTo(2.65,-4.1); shape.lineTo(-3.1,-4.1); shape.closePath(); return shape; },[]);
  const landing=sitePosition(SITE_CONFIG[0].coordinates);
  return <group>
    <color attach="background" args={["#d9d5ca"]} /><fog attach="fog" args={["#d9d5ca",12,28]} />
    <mesh rotation={[-Math.PI/2,0,0]} position={[-1.3,-.14,0]}><planeGeometry args={[16,14]} /><meshStandardMaterial color="#526c70" roughness={.9} /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]}><shapeGeometry args={[landShape]} /><meshStandardMaterial color="#dedbd1" roughness={.96} /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.018,0]}><shapeGeometry args={[landShape]} /><meshBasicMaterial color="#303330" wireframe transparent opacity={.08} /></mesh>
    <CityExtrusions />
    <Road points={[[-.1,.08,3.6],[.4,.1,1.8],[.8,.1,0],[1.4,.1,-1.6],[2.1,.1,-3.5]]} />
    <Road points={[[-1.8,.08,2.4],[-.4,.1,1.2],[.7,.1,.1],[1.8,.1,-.8]]} />
    <Road points={[[-.9,.08,3.1],[-.55,.1,1.4],[-.25,.1,-.4],[.1,.1,-2.8]]} />
    <Road points={[[-1.15,.08,-2.5],[.1,.1,-2.35],[1.2,.1,-2.6],[2.1,.1,-2.85]]} />
    <Road points={[[-1.45,.08,.15],[-.15,.1,.25],[1.05,.1,.12],[2.05,.1,-.15]]} />
    {SITE_CONFIG.slice(1).map((site,index)=>{ const amount=clamp01((beat.progress-site.threshold)/.11); const target=sitePosition(site.coordinates); return <group key={site.id}>
      <AnimatedConnector points={[landing,[(landing[0]+target[0])*.5,.25,(landing[2]+target[2])*.5],target]} color="#f4c94f" progress={amount} reducedMotion={reducedMotion} opacity={.78} />
      <MapMarker site={site} visible={amount} focus={site.id==="cst" && beat.progress>.84} labelVisible={amount>.04 && beat.progress < site.threshold + .22} />
    </group>;})}
    <MapMarker site={SITE_CONFIG[0]} visible={1} focus={false} labelVisible={beat.progress < .16} />
    <Html center position={[2.05,1.45,-2.65]} style={{ pointerEvents: "none" }}><div className="case-replay-next-focus" data-visible={beat.progress>.84}><span>NEXT FOCUS</span><b>CHHATRAPATI SHIVAJI TERMINUS</b></div></Html>
  </group>;
}

// Keep only current + immediate-next hero assets warm; Suspense never has to reveal a blank scene.
useGLTF.preload("/assets/replay/boats/fishing-vessel.glb");
useGLTF.preload("/assets/replay/boats/landing-dinghy.glb");
