"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import type { ReplayEvent, ReplayView } from "@replay/types";
import { GOLD_STANDARD_EVENT_IDS, GoldStandardScene } from "@replay/scenes/GoldStandardScenes";
import { AnnotationLayoutManager } from "@replay/components/AnnotationLayoutManager";
import { EVENT_SCENE_FAMILY, ReplaySceneFamilyRenderer } from "@replay/scenes/ReplaySceneFamilies";
import { crimeLens3DTheme } from "@replay/engine/crimeLens3DTheme";
import { InvestigationRoomKit } from "@replay/components/SceneEnvironment";

function ReplayWorld({
  event,
  view,
  progress,
  reducedMotion,
  finalPresentation,
}: {
  event: ReplayEvent;
  view: ReplayView;
  progress: number;
  reducedMotion: boolean;
  finalPresentation: boolean;
}) {
  const isGoldStandard = GOLD_STANDARD_EVENT_IDS.has(event.sourceTimelineId);
  const isCinematicFamily = Boolean(EVENT_SCENE_FAMILY[event.sourceTimelineId]);
  return (
    <>
      <color attach="background" args={[crimeLens3DTheme.lighting.background]} />
      <fog attach="fog" args={[crimeLens3DTheme.lighting.fog, 14, 30]} />
      <hemisphereLight args={[crimeLens3DTheme.lighting.ambient, crimeLens3DTheme.colors.muted, 1.48]} />
      <ambientLight intensity={0.9} color={crimeLens3DTheme.lighting.ambient} />
      <directionalLight position={[5, 9, 7]} intensity={2.18} color={crimeLens3DTheme.lighting.key} />
      <directionalLight position={[-5, 4, -3]} intensity={0.62} color={crimeLens3DTheme.lighting.fill} />
      <Environment files="/assets/replay/textures/modern-buildings-night-1k.hdr" environmentIntensity={0.38} />
      {finalPresentation ? (
        <InvestigationRoomKit />
      ) : isGoldStandard ? (
        <GoldStandardScene event={event} progress={progress} reducedMotion={reducedMotion} />
      ) : isCinematicFamily ? (
        <ReplaySceneFamilyRenderer event={event} progress={progress} reducedMotion={reducedMotion} />
      ) : (
        <ReplaySceneFamilyRenderer event={event} progress={progress} reducedMotion={reducedMotion} />
      )}
      <ContactShadows position={[0, 0.015, 0]} opacity={0.3} scale={18} blur={3.1} far={7} color={crimeLens3DTheme.lighting.contactShadow} frames={1} />
    </>
  );
}

export function CaseReplayScene({
  event,
  view,
  progress,
  reducedMotion,
  finalPresentation = false,
}: {
  event: ReplayEvent;
  view: ReplayView;
  progress: number;
  reducedMotion: boolean;
  finalPresentation?: boolean;
}) {
  return (
    <Canvas
      shadows={false}
      dpr={reducedMotion ? 1 : [1, 1.5]}
      camera={{ position: [8, 5, 10], fov: 52, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      fallback={<div className="case-replay-webgl-fallback">Interactive 3D is unavailable. Event facts remain visible in the replay HUD.</div>}
    >
      <Suspense fallback={null}>
        <AnnotationLayoutManager layoutKey={`${event.sourceTimelineId}:${view}:${Math.floor(progress * 5)}`}>
          <ReplayWorld event={event} view={view} progress={progress} reducedMotion={reducedMotion} finalPresentation={finalPresentation} />
        </AnnotationLayoutManager>
      </Suspense>
    </Canvas>
  );
}
