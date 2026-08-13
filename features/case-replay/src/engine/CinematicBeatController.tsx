"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const CINEMATIC_STAGES = [
  "ESTABLISH",
  "ACTION",
  "CLUE REVEAL",
  "CONSEQUENCE",
  "TRANSITION",
] as const;

export type CinematicStage = (typeof CINEMATIC_STAGES)[number];

export type CinematicBeat = {
  stage: CinematicStage;
  stageIndex: number;
  stageProgress: number;
  progress: number;
  value: (stage: CinematicStage) => number;
};

export type CinematicCameraFrame = {
  position: [number, number, number];
  target: [number, number, number];
};

export function getCinematicBeat(progress: number): CinematicBeat {
  const safeProgress = THREE.MathUtils.clamp(progress, 0, 1);
  const scaled = safeProgress * CINEMATIC_STAGES.length;
  const stageIndex = Math.min(CINEMATIC_STAGES.length - 1, Math.floor(scaled));
  const stageProgress = safeProgress >= 1 ? 1 : scaled - stageIndex;
  return {
    stage: CINEMATIC_STAGES[stageIndex],
    stageIndex,
    stageProgress,
    progress: safeProgress,
    value(stage) {
      const index = CINEMATIC_STAGES.indexOf(stage);
      if (stageIndex > index) return 1;
      if (stageIndex < index) return 0;
      return stageProgress;
    },
  };
}

export function CinematicBeatController({
  progress,
  children,
}: {
  progress: number;
  children: (beat: CinematicBeat) => React.ReactNode;
}) {
  const beat = useMemo(() => getCinematicBeat(progress), [progress]);
  return <>{children(beat)}</>;
}

export function CinematicReveal({
  amount,
  reducedMotion,
  position = [0, 0, 0],
  from = [0, -0.12, -0.18],
  children,
}: {
  amount: number;
  reducedMotion: boolean;
  position?: [number, number, number];
  from?: [number, number, number];
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = THREE.MathUtils.smoothstep(amount, 0, 1);
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 8);
    const scale = Math.max(0.001, 0.82 + target * 0.18);
    group.current.scale.lerp(new THREE.Vector3(scale, scale, scale), alpha);
    group.current.position.lerp(
      new THREE.Vector3(
        position[0] + from[0] * (1 - target),
        position[1] + from[1] * (1 - target),
        position[2] + from[2] * (1 - target),
      ),
      alpha,
    );
    group.current.visible = amount > 0.002;
  });
  return <group ref={group} position={position}>{children}</group>;
}

export function CinematicBeatCamera({
  beat,
  frames,
  reducedMotion,
}: {
  beat: CinematicBeat;
  frames: CinematicCameraFrame[];
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const cameraTarget = useRef(new THREE.Vector3(...frames[0].target));
  useFrame((_, delta) => {
    const current = frames[Math.min(beat.stageIndex, frames.length - 1)] ?? frames[0];
    const next = frames[Math.min(beat.stageIndex + 1, frames.length - 1)] ?? current;
    const travel = THREE.MathUtils.smootherstep(beat.stageProgress, 0.68, 1);
    const desiredPosition = new THREE.Vector3(...current.position).lerp(new THREE.Vector3(...next.position), travel);
    const desiredTarget = new THREE.Vector3(...current.target).lerp(new THREE.Vector3(...next.target), travel);
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-delta * 2.25);
    camera.position.lerp(desiredPosition, alpha);
    cameraTarget.current.lerp(desiredTarget, alpha);
    camera.lookAt(cameraTarget.current);
  });
  return null;
}
