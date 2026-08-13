import {
  MUMBAI_BOARD_NODES,
  MUMBAI_CASE_TITLE,
  MUMBAI_GRAPH_LINKS,
  MUMBAI_GRAPH_NODES,
  MUMBAI_MAP_INCIDENTS,
  MUMBAI_TIMELINE_EVENTS,
} from "@replay/data/mumbai2611-case";
import type { ReplayCaseData } from "@replay/types";

export const DEFAULT_REPLAY_CASE_DATA: ReplayCaseData = {
  caseId: "mumbai-2611",
  title: MUMBAI_CASE_TITLE,
  timelineEvents: MUMBAI_TIMELINE_EVENTS.map((event) => ({ ...event })),
  evidenceNodes: MUMBAI_BOARD_NODES.map((node) => ({ id: node.id, data: { ...node.data } })),
  mapIncidents: MUMBAI_MAP_INCIDENTS.map((incident) => ({
    id: incident.id,
    title: incident.title,
    date: incident.date,
    coordinates: [...incident.coordinates] as [number, number],
  })),
  graphNodes: MUMBAI_GRAPH_NODES.map((node) => ({
    id: node.id,
    label: node.label,
    kind: node.kind,
    subtitle: node.subtitle,
  })),
  graphLinks: MUMBAI_GRAPH_LINKS.map((link) => ({
    id: link.id,
    source: link.source,
    target: link.target,
    label: link.label,
  })),
};
