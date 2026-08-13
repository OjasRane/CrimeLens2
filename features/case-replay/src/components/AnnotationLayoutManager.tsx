"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

export type AnnotationLane =
  | "TOP"
  | "TOP_RIGHT"
  | "RIGHT"
  | "BOTTOM_RIGHT"
  | "BOTTOM"
  | "BOTTOM_LEFT"
  | "LEFT"
  | "TOP_LEFT";

type AnnotationRecord = {
  id: string;
  targetObjectId: string;
  anchorType: AnnotationAnchorType;
  element: RefObject<HTMLDivElement | null>;
  priority: number;
  width: number;
  height: number;
  gap: number;
  lanes: AnnotationLane[];
};

type TargetRecord = {
  id: string;
  object: RefObject<THREE.Group | null>;
  avoidRadius: number;
};

export type AnnotationAnchorType = "person" | "evidence" | "vessel" | "landmark" | "location" | "board-item" | "relationship-node" | "scene-object";

type LayoutContextValue = {
  register: (record: AnnotationRecord) => () => void;
  registerTarget: (record: TargetRecord) => () => void;
};

const LayoutContext = createContext<LayoutContextValue | null>(null);
const FULLSCREEN_ORIGIN = (_: THREE.Object3D, __: THREE.Camera, size: { width: number; height: number }) => [size.width / 2, size.height / 2] as [number, number];

type Rect = { left: number; top: number; right: number; bottom: number };

const LANE_VECTORS: Record<AnnotationLane, [number, number]> = {
  TOP: [0, -1],
  TOP_RIGHT: [0.78, -0.72],
  RIGHT: [1, 0],
  BOTTOM_RIGHT: [0.78, 0.72],
  BOTTOM: [0, 1],
  BOTTOM_LEFT: [-0.78, 0.72],
  LEFT: [-1, 0],
  TOP_LEFT: [-0.78, -0.72],
};

const overlaps = (a: Rect, b: Rect, gap: number) =>
  a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

function exclusionRects(width: number, height: number): Rect[] {
  const narrativeTop = height * 0.56;
  return [
    { left: 0, top: 0, right: Math.min(340, width * 0.48), bottom: 100 },
    { left: Math.max(0, width - 332), top: 0, right: width, bottom: Math.min(268, height * 0.48) },
    { left: Math.max(0, width * 0.5 - 132), top: 0, right: Math.min(width, width * 0.5 + 132), bottom: 82 },
    { left: 0, top: narrativeTop, right: width, bottom: height },
  ];
}

function candidateRect(cx: number, cy: number, width: number, height: number): Rect {
  return { left: cx - width / 2, top: cy - height / 2, right: cx + width / 2, bottom: cy + height / 2 };
}

export function AnnotationLayoutManager({ children, layoutKey }: { children: ReactNode; layoutKey: string }) {
  const { camera, size } = useThree();
  const records = useRef(new Map<string, AnnotationRecord>());
  const targets = useRef(new Map<string, TargetRecord>());
  const timers = useRef<number[]>([]);

  const reflow = useCallback(() => {
    const occupied = exclusionRects(size.width, size.height);
    const placed: Rect[] = [];
    const world = new THREE.Vector3();
    const projected = new THREE.Vector3();
    const ordered = [...records.current.values()].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

    for (const target of targets.current.values()) {
      const node = target.object.current;
      if (!node) continue;
      node.getWorldPosition(world);
      projected.copy(world).project(camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      occupied.push({ left: x - target.avoidRadius, top: y - target.avoidRadius, right: x + target.avoidRadius, bottom: y + target.avoidRadius });
    }

    for (const record of ordered) {
      const node = targets.current.get(record.targetObjectId)?.object.current;
      const element = record.element.current;
      let visibleNode: THREE.Object3D | null = node ?? null;
      let hierarchyVisible = true;
      while (visibleNode) {
        hierarchyVisible = hierarchyVisible && visibleNode.visible;
        visibleNode = visibleNode.parent;
      }
      if (!node || !element || !hierarchyVisible) {
        if (element) element.dataset.visible = "false";
        continue;
      }
      node.getWorldPosition(world);
      projected.copy(world).project(camera);
      if (projected.z < -1 || projected.z > 1) {
        element.dataset.visible = "false";
        continue;
      }
      element.dataset.visible = "true";
      const anchorX = (projected.x * 0.5 + 0.5) * size.width;
      const anchorY = (-projected.y * 0.5 + 0.5) * size.height;
      const distances = [28, 54, 84, 118, 154];
      const candidates = record.lanes.flatMap((lane) => distances.map((distance) => {
        const [dx, dy] = LANE_VECTORS[lane];
        return {
          lane,
          cx: anchorX + dx * (record.width / 2 + distance),
          cy: anchorY + dy * (record.height / 2 + distance),
        };
      }));
      const previousX = Number.parseFloat(element.style.left);
      const previousY = Number.parseFloat(element.style.top);
      if (Number.isFinite(previousX) && Number.isFinite(previousY)) {
        candidates.unshift({
          lane: (element.dataset.lane as AnnotationLane | undefined) ?? record.lanes[0],
          cx: previousX,
          cy: previousY,
        });
      }
      const gridCandidates = [
        record.width / 2 + 18,
        size.width * 0.12,
        size.width * 0.32,
        size.width * 0.52,
        size.width * 0.72,
        size.width - record.width / 2 - 18,
      ].flatMap((cx) => [
        126 + record.height / 2,
        144 + record.height * 1.5,
        158 + record.height * 2.5,
      ].map((cy) => ({ lane: "TOP" as AnnotationLane, cx, cy })))
        .filter((candidate) => candidate.cy + record.height / 2 < size.height * 0.56)
        .sort((a, b) => Math.hypot(a.cx - anchorX, a.cy - anchorY) - Math.hypot(b.cx - anchorX, b.cy - anchorY));
      candidates.push(...gridCandidates);
      let selected = candidates.find((candidate) => {
        const rect = candidateRect(candidate.cx, candidate.cy, record.width, record.height);
        const inside = rect.left >= 14 && rect.top >= 14 && rect.right <= size.width - 14 && rect.bottom <= size.height - 14;
        return inside && !occupied.some((item) => overlaps(rect, item, record.gap)) && !placed.some((item) => overlaps(rect, item, record.gap));
      });
      if (!selected) {
        selected = candidates
          .map((candidate) => {
            const rect = candidateRect(candidate.cx, candidate.cy, record.width, record.height);
            const penalty = [...occupied, ...placed].reduce((total, item) => total + (overlaps(rect, item, record.gap) ? 1000 : 0), 0)
              + Math.max(0, 14 - rect.left) + Math.max(0, 14 - rect.top)
              + Math.max(0, rect.right - size.width + 14) + Math.max(0, rect.bottom - size.height + 14);
            return { ...candidate, penalty };
          })
          .sort((a, b) => a.penalty - b.penalty)[0];
      }
      if (!selected) continue;
      const rect = candidateRect(selected.cx, selected.cy, record.width, record.height);
      placed.push(rect);
      const leaderX = anchorX - selected.cx;
      const leaderY = anchorY - selected.cy;
      const absoluteX = Math.abs(leaderX);
      const absoluteY = Math.abs(leaderY);
      const edgeScale = Math.min(
        absoluteX > 0.001 ? record.width / 2 / absoluteX : Number.POSITIVE_INFINITY,
        absoluteY > 0.001 ? record.height / 2 / absoluteY : Number.POSITIVE_INFINITY,
      );
      const edgeX = Number.isFinite(edgeScale) ? leaderX * edgeScale : 0;
      const edgeY = Number.isFinite(edgeScale) ? leaderY * edgeScale : 0;
      element.style.left = `${selected.cx}px`;
      element.style.top = `${selected.cy}px`;
      element.style.setProperty("--annotation-leader-origin-x", `${record.width / 2 + edgeX}px`);
      element.style.setProperty("--annotation-leader-origin-y", `${record.height / 2 + edgeY}px`);
      element.style.setProperty("--annotation-leader-length", `${Math.max(10, Math.hypot(leaderX - edgeX, leaderY - edgeY))}px`);
      element.style.setProperty("--annotation-leader-angle", `${Math.atan2(leaderY, leaderX)}rad`);
      element.dataset.lane = selected.lane;
      element.dataset.anchorType = record.anchorType;
      element.dataset.targetObjectId = record.targetObjectId;
    }
  }, [camera, size.height, size.width]);

  const schedule = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [40, 360, 700].map((delay) => window.setTimeout(reflow, delay));
  }, [reflow]);

  const register = useCallback((record: AnnotationRecord) => {
    records.current.set(record.id, record);
    schedule();
    return () => {
      records.current.delete(record.id);
      schedule();
    };
  }, [schedule]);

  const registerTarget = useCallback((record: TargetRecord) => {
    targets.current.set(record.id, record);
    schedule();
    return () => {
      targets.current.delete(record.id);
      schedule();
    };
  }, [schedule]);

  useEffect(() => schedule(), [layoutKey, schedule]);
  useEffect(() => {
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [schedule]);

  const value = useMemo(() => ({ register, registerTarget }), [register, registerTarget]);
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function ScreenSpaceAnnotation({
  id,
  targetObjectId,
  anchorType,
  priority = 60,
  lanes = ["TOP_RIGHT", "RIGHT", "TOP", "LEFT"],
  width = 218,
  height = 88,
  gap = 16,
  accent = "#6f756f",
  children,
}: {
  id: string;
  targetObjectId: string;
  anchorType: AnnotationAnchorType;
  priority?: number;
  lanes?: AnnotationLane[];
  width?: number;
  height?: number;
  gap?: number;
  accent?: string;
  children: ReactNode;
}) {
  const context = useContext(LayoutContext);
  const element = useRef<HTMLDivElement>(null);
  const laneKey = lanes.join(":");
  useLayoutEffect(() => context?.register({ id, targetObjectId, anchorType, element, priority, width, height, gap, lanes }), [anchorType, context, gap, height, id, laneKey, priority, targetObjectId, width]);
  return (
    <group>
      <Html fullscreen calculatePosition={FULLSCREEN_ORIGIN} style={{ pointerEvents: "none" }}>
        <div ref={element} className="case-replay-screen-annotation" data-visible="false" style={{ width, minHeight: height, "--annotation-accent": accent } as React.CSSProperties}>
          <span className="case-replay-annotation-leader" aria-hidden="true" />
          <div className="case-replay-annotation-content">{children}</div>
        </div>
      </Html>
    </group>
  );
}

export function SceneTargetAnchor({ id, position = [0, 0, 0], avoidRadius = 44, children }: {
  id: string;
  position?: [number, number, number];
  avoidRadius?: number;
  children?: ReactNode;
}) {
  const context = useContext(LayoutContext);
  const object = useRef<THREE.Group>(null);
  useLayoutEffect(() => context?.registerTarget({ id, object, avoidRadius }), [avoidRadius, context, id]);
  return <group ref={object} position={position}>{children}</group>;
}
