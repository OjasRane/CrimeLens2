"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function getPhaseProgress(progress: number) {
  if (progress >= 1) return 1;
  return Math.max(0, Math.min(1, progress * 3 - Math.floor(progress * 3)));
}

export function AmbientDrift({
  children,
  reducedMotion,
  amplitude = 0.018,
  rotation = 0.012,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
  amplitude?: number;
  rotation?: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return;
    const time = clock.getElapsedTime();
    group.current.position.y = Math.sin(time * 0.72) * amplitude;
    group.current.rotation.y = Math.sin(time * 0.24) * rotation;
  });
  return <group ref={group}>{children}</group>;
}

export function FocusBeacon({
  position,
  color = "#d99a20",
  reducedMotion,
  progress = 0.5,
  radius = 0.48,
}: {
  position: [number, number, number];
  color?: string;
  reducedMotion: boolean;
  progress?: number;
  radius?: number;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ring.current || !material.current || !light.current) return;
    const pulse = reducedMotion ? 0.45 : 0.5 + Math.sin(clock.getElapsedTime() * 2.2) * 0.18;
    const emphasis = 0.5 + Math.min(1, progress) * 0.5;
    ring.current.scale.setScalar(0.94 + pulse * 0.12);
    material.current.opacity = pulse * emphasis;
    light.current.intensity = 0.45 + pulse * 0.9;
  });
  return (
    <group position={position}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + 0.045, 48]} />
        <meshBasicMaterial ref={material} color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color={color} intensity={0.8} distance={3.2} position={[0, 0.55, 0]} />
    </group>
  );
}

export function AnimatedConnector({
  points,
  color,
  progress,
  reducedMotion,
  delay = 0,
  opacity = 0.72,
}: {
  points: Array<[number, number, number]>;
  color: string;
  progress: number;
  reducedMotion: boolean;
  delay?: number;
  opacity?: number;
}) {
  const pointsKey = points.flat().join("|");
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    geometry.setDrawRange(0, reducedMotion ? points.length : 0);
    return new THREE.Line(geometry, material);
  }, [color, opacity, pointsKey, reducedMotion]);

  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }, [line]);

  useFrame(({ clock }) => {
    const reveal = reducedMotion ? 1 : THREE.MathUtils.smoothstep(progress, delay, Math.min(1, delay + 0.34));
    line.geometry.setDrawRange(0, Math.max(0, Math.ceil(reveal * points.length)));
    const material = line.material as THREE.LineBasicMaterial;
    material.opacity = opacity * (reducedMotion ? 1 : 0.88 + Math.sin(clock.getElapsedTime() * 1.8 + delay * 5) * 0.12);
  });

  return <primitive object={line} />;
}
