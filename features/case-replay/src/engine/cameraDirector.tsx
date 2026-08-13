"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSceneCameraFrame } from "@replay/engine/sceneLayout";
import type { CameraPreset, ReplayPerson, ReplaySceneType, ReplayView } from "@replay/types";

const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  wide: [8, 5, 10],
  medium: [6, 3.4, 7.5],
  "close-up": [3.6, 2.4, 4.6],
  overhead: [0, 10, 4],
  "follow-character": [4.8, 2.4, 6],
  "evidence-focus": [2.8, 2, 4.2],
  "map-rise": [0, 9, 6],
  "graph-orbit": [7, 4.5, 8],
};

export function CameraDirector({
  preset,
  view,
  sceneType,
  progress,
  people,
  reducedMotion,
}: {
  preset: CameraPreset;
  view: ReplayView;
  sceneType: ReplaySceneType;
  progress: number;
  people: ReplayPerson[];
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 1, 0));
  const frame = useMemo(() => {
    if (view === "map") return { position: new THREE.Vector3(0, 10, 5), target: new THREE.Vector3(0, 0, 0) };
    if (view === "network") return { position: new THREE.Vector3(0.9, 3.35, 9.2), target: new THREE.Vector3(0, 1.55, -0.35) };
    if (view === "evidence") return { position: new THREE.Vector3(3.25, 2.35, 4.85), target: new THREE.Vector3(-0.15, 1.08, 0) };
    const sceneFrame = getSceneCameraFrame(sceneType, progress, people);
    return {
      position: new THREE.Vector3(...(sceneFrame?.position ?? CAMERA_POSITIONS[preset])),
      target: new THREE.Vector3(...(sceneFrame?.target ?? [0, 1, 0])),
    };
  }, [people, preset, progress, sceneType, view]);

  useEffect(() => {
    if (!reducedMotion) return;
    target.current.copy(frame.target);
    camera.position.copy(frame.position);
    camera.lookAt(target.current);
  }, [camera, frame.position, frame.target, reducedMotion]);

  useFrame(({ clock }, delta) => {
    if (reducedMotion) return;
    const time = clock.getElapsedTime();
    const desired = frame.position.clone();
    const towardSubject = frame.target.clone().sub(frame.position).normalize();
    desired.addScaledVector(towardSubject, 0.18 + progress * 0.42);
    desired.x += Math.sin(time * 0.22) * 0.11;
    desired.y += Math.sin(time * 0.18 + 0.7) * 0.045;
    const desiredTarget = frame.target.clone();
    desiredTarget.x += Math.sin(time * 0.19) * 0.055;
    desiredTarget.y += Math.sin(time * 0.16) * 0.025;
    camera.position.lerp(desired, 1 - Math.exp(-delta * 1.65));
    target.current.lerp(desiredTarget, 1 - Math.exp(-delta * 2.1));
    camera.lookAt(target.current);
  });

  return null;
}
