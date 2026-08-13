import * as THREE from "three";
import type { ReplayPerson, ReplaySceneType } from "@replay/types";

export type SceneAnchor = {
  id: string;
  position: [number, number, number];
  rotationY: number;
  labelSide: "left" | "right";
};

export type ActorPlacement = SceneAnchor & {
  person: ReplayPerson;
};

type SceneObstacle = {
  id: string;
  center: [number, number, number];
  size: [number, number, number];
};

type CameraFrame = {
  id: string;
  position: [number, number, number];
  target: [number, number, number];
};

type SceneLayout = {
  anchors: SceneAnchor[];
  obstacles: SceneObstacle[];
  cameras: CameraFrame[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

const HUMAN_SIZE: [number, number, number] = [0.62, 1.78, 0.46];
const MIN_ACTOR_CLEARANCE = 0.88;

const SCENE_LAYOUTS: Partial<Record<ReplaySceneType, SceneLayout>> = {
  station: {
    anchors: [
      { id: "platform-center", position: [-0.8, 0, 0.55], rotationY: -0.18, labelSide: "left" },
      { id: "platform-right", position: [1.35, 0, 0.15], rotationY: -0.35, labelSide: "right" },
      { id: "ticket-machine", position: [3.15, 0, 1.35], rotationY: -0.7, labelSide: "right" },
    ],
    obstacles: [
      { id: "bench", center: [-3.3, 0.48, 0.3], size: [1.8, 0.96, 0.72] },
      { id: "platform-edge", center: [0, 0.18, -1.9], size: [13, 0.36, 2.2] },
    ],
    cameras: [
      { id: "wide", position: [7.6, 4.4, 9.4], target: [0, 1.05, -0.35] },
      { id: "left", position: [-6.4, 3.2, 7.2], target: [0, 1.05, -0.25] },
    ],
    bounds: { minX: -5.5, maxX: 5.5, minZ: -0.65, maxZ: 3.2 },
  },
  shop: {
    anchors: [
      { id: "counter-behind", position: [1.05, 0, -1.62], rotationY: 0.05, labelSide: "right" },
      { id: "counter-front", position: [-0.85, 0, 0.66], rotationY: Math.PI, labelSide: "left" },
      { id: "entrance", position: [3.55, 0, 1.65], rotationY: -2.35, labelSide: "right" },
      { id: "aisle-left", position: [-3.2, 0, 0.45], rotationY: 1.1, labelSide: "left" },
      { id: "aisle-right", position: [3.15, 0, 0.3], rotationY: -1.05, labelSide: "right" },
    ],
    obstacles: [
      { id: "counter", center: [0, 0.5, -0.6], size: [5, 1, 1] },
      { id: "left-shelves", center: [-3.3, 1.35, -2.55], size: [1.8, 2.7, 0.72] },
      { id: "right-shelves", center: [3.3, 1.35, -2.55], size: [1.8, 2.7, 0.72] },
    ],
    cameras: [
      { id: "wide", position: [7.2, 4.25, 8.8], target: [0, 1.05, -0.55] },
      { id: "counter", position: [4.65, 2.75, 5.7], target: [0.1, 1.12, -0.52] },
      { id: "left", position: [-6.2, 3.25, 6.4], target: [0, 1.1, -0.45] },
    ],
    bounds: { minX: -4.6, maxX: 4.6, minZ: -2.05, maxZ: 3.2 },
  },
  street: {
    anchors: [
      { id: "curb-left", position: [-1.05, 0, 0.65], rotationY: 0.25, labelSide: "left" },
      { id: "curb-right", position: [1.05, 0, 0.15], rotationY: -0.25, labelSide: "right" },
      { id: "sidewalk", position: [3.35, 0, 1.5], rotationY: -0.8, labelSide: "right" },
    ],
    obstacles: [],
    cameras: [
      { id: "wide", position: [7.3, 3.8, 8.8], target: [0, 1, 0] },
      { id: "left", position: [-6.2, 3, 6.5], target: [0, 1, 0] },
    ],
    bounds: { minX: -4.8, maxX: 4.8, minZ: -4.8, maxZ: 4.8 },
  },
  analysis: {
    anchors: [
      { id: "desk-front", position: [-1.15, 0, 2.05], rotationY: Math.PI, labelSide: "left" },
      { id: "desk-side", position: [3.15, 0, 0.35], rotationY: -1.2, labelSide: "right" },
      { id: "board-side", position: [-3.1, 0, -0.7], rotationY: 1.2, labelSide: "left" },
    ],
    obstacles: [
      { id: "analysis-table", center: [0, 0.72, 0], size: [5, 1.44, 2.4] },
    ],
    cameras: [
      { id: "wide", position: [7.4, 4.1, 8.7], target: [0, 1.2, -0.6] },
      { id: "left", position: [-6.4, 3.4, 6.8], target: [0, 1.2, -0.7] },
    ],
    bounds: { minX: -4.4, maxX: 4.4, minZ: -2.2, maxZ: 3.2 },
  },
  fallback: {
    anchors: [
      { id: "focus-left", position: [-1.1, 0, 0.35], rotationY: 0, labelSide: "left" },
      { id: "focus-right", position: [1.1, 0, 0], rotationY: 0, labelSide: "right" },
      { id: "rear", position: [2.8, 0, -1.4], rotationY: -0.4, labelSide: "right" },
    ],
    obstacles: [],
    cameras: [{ id: "wide", position: [7, 4, 8], target: [0, 1, 0] }],
    bounds: { minX: -4.5, maxX: 4.5, minZ: -4.5, maxZ: 4.5 },
  },
};

function toBox(center: [number, number, number], size: [number, number, number]) {
  const half = new THREE.Vector3(...size).multiplyScalar(0.5);
  const point = new THREE.Vector3(...center);
  return new THREE.Box3(point.clone().sub(half), point.clone().add(half));
}

function actorBox(position: [number, number, number]) {
  return toBox(
    [position[0], position[1] + HUMAN_SIZE[1] / 2, position[2]],
    HUMAN_SIZE,
  );
}

function cameraHasClearView(
  camera: CameraFrame,
  layout: SceneLayout,
  placements: ActorPlacement[],
) {
  const origin = new THREE.Vector3(...camera.position);
  if (layout.obstacles.some((obstacle) => toBox(obstacle.center, obstacle.size).containsPoint(origin))) {
    return false;
  }
  return placements.every((actor) => {
    const subject = new THREE.Vector3(actor.position[0], 1.42, actor.position[2]);
    const direction = subject.clone().sub(origin);
    const subjectDistance = direction.length();
    const ray = new THREE.Ray(origin, direction.normalize());
    return layout.obstacles.every((obstacle) => {
      const hit = ray.intersectBox(toBox(obstacle.center, obstacle.size), new THREE.Vector3());
      return !hit || hit.distanceTo(origin) >= subjectDistance - 0.18;
    });
  });
}

function validateObstacleLayout(sceneType: ReplaySceneType, layout: SceneLayout) {
  for (let left = 0; left < layout.obstacles.length; left += 1) {
    for (let right = left + 1; right < layout.obstacles.length; right += 1) {
      if (toBox(layout.obstacles[left].center, layout.obstacles[left].size).intersectsBox(toBox(layout.obstacles[right].center, layout.obstacles[right].size))) {
        console.warn('[CaseReplay] Prop "' + layout.obstacles[left].id + '" intersects "' + layout.obstacles[right].id + '" in "' + sceneType + '".');
      }
    }
  }
}

function preferredAnchorIds(sceneType: ReplaySceneType, person: ReplayPerson) {
  if (sceneType === "shop") {
    if (person.entityId === "sus-marlowe") return ["counter-behind", "aisle-right"];
    if (person.entityId === "witness-visitor") return ["counter-front", "entrance"];
    if (person.role === "officer") return ["entrance", "aisle-right"];
    return ["aisle-left", "entrance", "aisle-right"];
  }
  if (sceneType === "analysis" && person.role === "investigator") {
    return ["desk-front", "board-side"];
  }
  return [];
}

function anchorIsValid(
  anchor: SceneAnchor,
  layout: SceneLayout,
  placed: ActorPlacement[],
) {
  const bounds = actorBox(anchor.position);
  const insideEnvironment =
    bounds.min.x >= layout.bounds.minX &&
    bounds.max.x <= layout.bounds.maxX &&
    bounds.min.z >= layout.bounds.minZ &&
    bounds.max.z <= layout.bounds.maxZ;
  if (!insideEnvironment || Math.abs(bounds.min.y) > 0.001) return false;
  if (layout.obstacles.some((obstacle) => bounds.intersectsBox(toBox(obstacle.center, obstacle.size)))) return false;
  return placed.every((actor) => {
    const dx = actor.position[0] - anchor.position[0];
    const dz = actor.position[2] - anchor.position[2];
    return Math.hypot(dx, dz) >= MIN_ACTOR_CLEARANCE;
  });
}

export function placeSceneActors(
  sceneType: ReplaySceneType,
  people: ReplayPerson[],
): ActorPlacement[] {
  const layout = SCENE_LAYOUTS[sceneType] ?? SCENE_LAYOUTS.fallback!;
  const placed: ActorPlacement[] = [];

  for (const person of people) {
    const preferred = preferredAnchorIds(sceneType, person);
    const candidates = [
      ...preferred.map((id) => layout.anchors.find((anchor) => anchor.id === id)).filter((anchor): anchor is SceneAnchor => Boolean(anchor)),
      ...layout.anchors.filter((anchor) => !preferred.includes(anchor.id)),
    ];
    const anchor = candidates.find((candidate) => anchorIsValid(candidate, layout, placed));
    if (!anchor) {
      if (process.env.NODE_ENV !== "production") {
        console.warn('[CaseReplay] No collision-free anchor for actor "' + person.name + '" in "' + sceneType + '".');
      }
      continue;
    }
    placed.push({ ...anchor, person });
  }

  if (process.env.NODE_ENV !== "production") {
    validateObstacleLayout(sceneType, layout);
    validateSceneActors(sceneType, placed);
  }
  return placed;
}

export function validateSceneActors(
  sceneType: ReplaySceneType,
  placements: ActorPlacement[],
) {
  const layout = SCENE_LAYOUTS[sceneType] ?? SCENE_LAYOUTS.fallback!;
  for (const actor of placements) {
    const bounds = actorBox(actor.position);
    for (const obstacle of layout.obstacles) {
      if (bounds.intersectsBox(toBox(obstacle.center, obstacle.size))) {
        console.warn('[CaseReplay] Actor "' + actor.person.name + '" intersects "' + obstacle.id + '".');
      }
    }
    if (bounds.min.y < -0.01) {
      console.warn('[CaseReplay] Actor "' + actor.person.name + '" is below the floor.');
    } else if (bounds.min.y > 0.01) {
      console.warn('[CaseReplay] Actor "' + actor.person.name + '" is floating above the floor.');
    }
  }
  for (let left = 0; left < placements.length; left += 1) {
    for (let right = left + 1; right < placements.length; right += 1) {
      if (actorBox(placements[left].position).intersectsBox(actorBox(placements[right].position))) {
        console.warn('[CaseReplay] Actor "' + placements[left].person.name + '" intersects actor "' + placements[right].person.name + '".');
      }
    }
  }
}

export function getSceneCameraFrame(
  sceneType: ReplaySceneType,
  progress: number,
  people: ReplayPerson[] = [],
) {
  const layout = SCENE_LAYOUTS[sceneType] ?? SCENE_LAYOUTS.fallback!;
  const preferredId = sceneType === "shop" && progress > 0.48 ? "counter" : "wide";
  const preferred = layout.cameras.find((camera) => camera.id === preferredId) ?? layout.cameras[0];
  const placements = people.length > 0 ? placeSceneActors(sceneType, people.slice(0, 3)) : [];
  const selected = [preferred, ...layout.cameras.filter((camera) => camera.id !== preferred.id)]
    .find((camera) => cameraHasClearView(camera, layout, placements));
  if (!selected && process.env.NODE_ENV !== "production") {
    console.warn('[CaseReplay] No camera anchor has a clear view of all active actors in "' + sceneType + '".');
  }
  return selected ?? preferred;
}
