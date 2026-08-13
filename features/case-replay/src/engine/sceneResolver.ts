import type {
  CameraPreset,
  ReplaySceneType,
  ReplayView,
} from "@replay/types";

const CATEGORY_SCENES: Record<string, ReplaySceneType> = {
  CCTV: "station",
  CALL: "map",
  EVIDENCE: "evidence",
  FORENSIC: "analysis",
  ARREST: "street",
  ANALYSIS: "network",
};

const CATEGORY_CAMERAS: Record<string, CameraPreset> = {
  CCTV: "wide",
  CALL: "map-rise",
  EVIDENCE: "evidence-focus",
  FORENSIC: "close-up",
  ARREST: "medium",
  ANALYSIS: "graph-orbit",
};

export function resolveSceneType(category: string, title: string): ReplaySceneType {
  const normalized = title.toLowerCase();
  if (normalized.includes("suspect b identified")) return "analysis";
  if (normalized.includes("accelerant")) return "evidence";
  if (normalized.includes("clerk") || normalized.includes("annex")) return "shop";
  if (normalized.includes("station") || normalized.includes("platform")) return "station";
  return CATEGORY_SCENES[category] ?? "fallback";
}

export function resolveCameraPreset(category: string): CameraPreset {
  return CATEGORY_CAMERAS[category] ?? "medium";
}

export function resolveViewSequence(category: string): ReplayView[] {
  if (category === "CCTV") return ["timeline", "environment", "map"];
  if (category === "CALL") return ["timeline", "map", "network"];
  if (category === "EVIDENCE") return ["timeline", "environment", "evidence"];
  if (category === "FORENSIC") return ["evidence", "environment", "network"];
  if (category === "ARREST") return ["timeline", "environment", "map"];
  if (category === "ANALYSIS") return ["timeline", "network", "evidence"];
  return ["timeline", "environment", "evidence"];
}

export function resolveViewScene(
  eventScene: ReplaySceneType,
  view: ReplayView,
): ReplaySceneType {
  if (view === "map") return "map";
  if (view === "network") return "network";
  if (view === "evidence") return "evidence";
  if (view === "timeline") return "analysis";
  return eventScene;
}
