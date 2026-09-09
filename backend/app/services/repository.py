from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..schemas.auth import AuthorizedProfile


SeedPayload = dict[str, Any]


def _detail_from_seed(investigation: SeedPayload) -> dict[str, Any]:
    return {
        key: deepcopy(value)
        for key, value in investigation.items()
        if key not in {"map", "graph", "timeline", "casualtyLedger", "facts"}
    } | {
        "classification": investigation.get("classification", "standard"),
        "isDemo": investigation.get("type") == "DEMO",
        "graphFilters": deepcopy(investigation["graph"]["filters"]),
        "casualtyLedger": deepcopy(investigation["casualtyLedger"]),
    }


def _summary_from_detail(detail: SeedPayload) -> dict[str, Any]:
    return {
        "id": detail["id"],
        "slug": detail["slug"],
        "name": detail["name"],
        "shortName": detail["shortName"],
        "type": detail["type"],
        "description": detail["summary"],
        "location": detail["location"],
        "startTime": detail["start"],
        "endTime": detail["end"],
        "timezone": detail["timezone"],
        "status": detail["overallStatus"],
        "classification": detail.get("classification", "standard"),
        "isDemo": detail.get("isDemo", detail["type"] == "DEMO"),
    }


class InvestigationRepository:
    """Repository contract shared by Postgres and deterministic API tests."""

    def ready(self) -> bool:
        raise NotImplementedError

    def get_profile(self, user_id: UUID) -> AuthorizedProfile | None:
        raise NotImplementedError

    def list_investigations(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    def get_investigation(self, investigation_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def has_explicit_access(self, investigation_id: str, user_id: UUID) -> bool | None:
        raise NotImplementedError

    def get_map(
        self,
        investigation_id: str,
        *,
        types: list[str] | None = None,
        importance: list[str] | None = None,
        bounds: tuple[float, float, float, float] | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    def get_network(
        self,
        investigation_id: str,
        *,
        layers: list[str] | None = None,
        entity_id: str | None = None,
        hops: int = 1,
    ) -> dict[str, Any]:
        raise NotImplementedError

    def get_timeline(
        self,
        investigation_id: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        types: list[str] | None = None,
        entity_id: str | None = None,
        location_id: str | None = None,
    ) -> dict[str, Any]:
        raise NotImplementedError

    def get_facts(
        self,
        investigation_id: str,
        *,
        fact_type: str | None = None,
        status: str | None = None,
        entity_id: str | None = None,
        location_id: str | None = None,
        event_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        raise NotImplementedError

    def counts(self, investigation_id: str) -> dict[str, int]:
        raise NotImplementedError

    def entity_details(self, investigation_id: str, entity_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def location_details(self, investigation_id: str, location_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    def record_audit(
        self,
        *,
        profile: AuthorizedProfile,
        action: str,
        resource_type: str,
        resource_id: str | None,
        investigation_id: str | None,
        success: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        raise NotImplementedError

    def recent_audit(self, limit: int, offset: int) -> list[dict[str, Any]]:
        raise NotImplementedError

    def list_graph_workspaces(self, investigation_id: str, owner_user_id: UUID) -> list[dict[str, Any]]:
        raise NotImplementedError

    def create_graph_workspace(self, investigation_id: str, owner_user_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def get_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> dict[str, Any] | None:
        raise NotImplementedError

    def save_graph_workspace(self, payload: dict[str, Any], owner_user_id: UUID) -> dict[str, Any]:
        raise NotImplementedError

    def delete_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> bool:
        raise NotImplementedError


class MemoryInvestigationRepository(InvestigationRepository):
    def __init__(self, investigations: list[SeedPayload]) -> None:
        self.investigations = {item["id"]: deepcopy(item) for item in investigations}
        self.profiles: dict[str, AuthorizedProfile] = {}
        self.access: dict[tuple[str, str], bool] = {}
        self.audit: list[dict[str, Any]] = []
        self.graph_workspaces: dict[str, dict[str, Any]] = {}

    @classmethod
    def from_seed_file(cls, path: Path | None = None) -> "MemoryInvestigationRepository":
        seed_path = path or Path(__file__).parents[1] / "db" / "seeds" / "investigations.json"
        payload = json.loads(seed_path.read_text(encoding="utf-8"))
        return cls(payload["investigations"])

    def add_profile(self, profile: AuthorizedProfile) -> None:
        self.profiles[str(profile.user_id)] = profile

    def ready(self) -> bool:
        return True

    def get_profile(self, user_id: UUID) -> AuthorizedProfile | None:
        return self.profiles.get(str(user_id))

    def list_investigations(self) -> list[dict[str, Any]]:
        return [
            _summary_from_detail(_detail_from_seed(item))
            for item in self.investigations.values()
        ]

    def get_investigation(self, investigation_id: str) -> dict[str, Any] | None:
        investigation = self.investigations.get(investigation_id)
        return _detail_from_seed(investigation) if investigation else None

    def has_explicit_access(self, investigation_id: str, user_id: UUID) -> bool | None:
        return self.access.get((investigation_id, str(user_id)))

    def get_map(
        self,
        investigation_id: str,
        *,
        types: list[str] | None = None,
        importance: list[str] | None = None,
        bounds: tuple[float, float, float, float] | None = None,
    ) -> dict[str, Any]:
        investigation = self.investigations[investigation_id]
        map_data = deepcopy(investigation["map"])
        locations = map_data["locations"]
        if types:
            requested = {item.casefold() for item in types}
            locations = [
                item
                for item in locations
                if item["type"].casefold() in requested
                or any(group.casefold() in requested for group in item["filterGroups"])
            ]
        if importance:
            requested_importance = {item.upper() for item in importance}
            locations = [item for item in locations if item["importance"].upper() in requested_importance]
        if bounds:
            west, south, east, north = bounds
            locations = [
                item
                for item in locations
                if not item.get("coordinates")
                or west <= item["coordinates"][0] <= east
                and south <= item["coordinates"][1] <= north
            ]
        map_data["locations"] = locations
        return {"investigationId": investigation_id, **map_data}

    def get_network(
        self,
        investigation_id: str,
        *,
        layers: list[str] | None = None,
        entity_id: str | None = None,
        hops: int = 1,
    ) -> dict[str, Any]:
        graph = deepcopy(self.investigations[investigation_id]["graph"])
        nodes = graph["nodes"]
        edges = graph["links"]
        if layers:
            requested = {layer.casefold() for layer in layers}
            edges = [edge for edge in edges if edge["linkKind"].casefold() in requested]
        if entity_id:
            visible = {entity_id}
            for _ in range(max(0, hops)):
                visible |= {
                    endpoint
                    for edge in edges
                    if edge["source"] in visible or edge["target"] in visible
                    for endpoint in (edge["source"], edge["target"])
                }
            nodes = [node for node in nodes if node["id"] in visible]
            edges = [edge for edge in edges if edge["source"] in visible and edge["target"] in visible]
        valid_ids = {node["id"] for node in nodes}
        edges = [edge for edge in edges if edge["source"] in valid_ids and edge["target"] in valid_ids]
        return {"investigationId": investigation_id, "nodes": nodes, "edges": edges}

    def get_timeline(
        self,
        investigation_id: str,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        types: list[str] | None = None,
        entity_id: str | None = None,
        location_id: str | None = None,
    ) -> dict[str, Any]:
        timeline = deepcopy(self.investigations[investigation_id]["timeline"])
        events = timeline["events"]
        requested_types = {item.upper() for item in types or []}
        events = [
            event
            for event in events
            if (not date_from or event["date"] >= date_from)
            and (not date_to or event["date"] <= date_to)
            and (not requested_types or event["category"].upper() in requested_types)
            and (not entity_id or entity_id in event["linkedEntityIds"])
            and (not location_id or location_id in event["linkedLocationIds"])
        ]
        events.sort(key=lambda event: (event["date"], event["sortOrder"]))
        return {"investigationId": investigation_id, **timeline, "events": events}

    def get_facts(
        self,
        investigation_id: str,
        *,
        fact_type: str | None = None,
        status: str | None = None,
        entity_id: str | None = None,
        location_id: str | None = None,
        event_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        facts = deepcopy(self.investigations[investigation_id]["facts"])
        facts = [
            fact
            for fact in facts
            if (not fact_type or fact["type"].casefold() == fact_type.casefold())
            and (not status or fact["status"].casefold() == status.casefold())
            and (not entity_id or entity_id in fact["linkedEntityIds"])
            and (not location_id or location_id in fact["linkedLocationIds"])
            and (not event_id or event_id in fact["linkedTimelineEventIds"])
        ]
        return facts[offset : offset + limit], len(facts)

    def counts(self, investigation_id: str) -> dict[str, int]:
        investigation = self.investigations[investigation_id]
        return {
            "locations": len(investigation["map"]["locations"]),
            "entities": len(investigation["graph"]["nodes"]),
            "relationships": len(investigation["graph"]["links"]),
            "timelineEvents": len(investigation["timeline"]["events"]),
            "facts": len(investigation["facts"]),
        }

    def entity_details(self, investigation_id: str, entity_id: str) -> dict[str, Any] | None:
        investigation = self.investigations[investigation_id]
        entity = next((item for item in investigation["graph"]["nodes"] if item["id"] == entity_id), None)
        if not entity:
            return None
        relationships = [
            edge
            for edge in investigation["graph"]["links"]
            if entity_id in {edge["source"], edge["target"]}
        ]
        return {
            "entity": deepcopy(entity),
            "relationships": deepcopy(relationships),
            "locations": [
                deepcopy(item)
                for item in investigation["map"]["locations"]
                if entity_id in item["linkedEntityIds"] or item.get("graphNodeId") == entity_id
            ],
            "timelineEvents": [
                deepcopy(item)
                for item in investigation["timeline"]["events"]
                if entity_id in item["linkedEntityIds"]
            ],
            "facts": [
                deepcopy(item)
                for item in investigation["facts"]
                if entity_id in item["linkedEntityIds"]
            ],
        }

    def location_details(self, investigation_id: str, location_id: str) -> dict[str, Any] | None:
        investigation = self.investigations[investigation_id]
        location = next((item for item in investigation["map"]["locations"] if item["id"] == location_id), None)
        if not location:
            return None
        entity_ids = set(location["linkedEntityIds"])
        return {
            "location": deepcopy(location),
            "relatedEntities": [
                deepcopy(item)
                for item in investigation["graph"]["nodes"]
                if item["id"] in entity_ids or item["id"] == location.get("graphNodeId")
            ],
            "timelineEvents": [
                deepcopy(item)
                for item in investigation["timeline"]["events"]
                if location_id in item["linkedLocationIds"]
            ],
            "facts": [
                deepcopy(item)
                for item in investigation["facts"]
                if location_id in item["linkedLocationIds"]
            ],
        }

    def record_audit(
        self,
        *,
        profile: AuthorizedProfile,
        action: str,
        resource_type: str,
        resource_id: str | None,
        investigation_id: str | None,
        success: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.audit.insert(
            0,
            {
                "id": str(uuid4()),
                "userId": str(profile.user_id),
                "agentId": profile.agent_id,
                "action": action,
                "resourceType": resource_type,
                "resourceId": resource_id,
                "investigationId": investigation_id,
                "success": success,
                "metadata": deepcopy(metadata or {}),
                "createdAt": datetime.now(timezone.utc),
            },
        )

    def recent_audit(self, limit: int, offset: int) -> list[dict[str, Any]]:
        return deepcopy(self.audit[offset : offset + limit])

    def list_graph_workspaces(self, investigation_id: str, owner_user_id: UUID) -> list[dict[str, Any]]:
        fields = {"id", "investigation_id", "name", "description", "version", "created_at", "updated_at"}
        return [
            {key: deepcopy(value) for key, value in workspace.items() if key in fields}
            for workspace in self.graph_workspaces.values()
            if workspace["investigation_id"] == investigation_id and workspace["owner_user_id"] == owner_user_id
        ]

    def create_graph_workspace(self, investigation_id: str, owner_user_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        workspace = {
            "id": uuid4(), "investigation_id": investigation_id, "owner_user_id": owner_user_id,
            "name": payload["name"], "description": payload.get("description", ""),
            "nodes": [], "edges": [], "groups": [], "questions": [],
            "suggestions": [], "conflicts": [], "snapshots": [],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
            "filters": {"verification": ["verified", "manual", "hypothesis"]},
            "version": 1, "created_at": now, "updated_at": now,
        }
        self.graph_workspaces[str(workspace["id"])] = workspace
        return deepcopy(workspace)

    def get_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> dict[str, Any] | None:
        workspace = self.graph_workspaces.get(str(workspace_id))
        if not workspace or workspace["owner_user_id"] != owner_user_id:
            return None
        return deepcopy(workspace)

    def save_graph_workspace(self, payload: dict[str, Any], owner_user_id: UUID) -> dict[str, Any]:
        workspace_id = str(payload["id"])
        existing = self.graph_workspaces.get(workspace_id)
        if existing and existing["owner_user_id"] != owner_user_id:
            raise PermissionError("workspace owner mismatch")
        now = datetime.now(timezone.utc)
        saved = deepcopy(payload) | {
            "owner_user_id": owner_user_id,
            "version": max(int(payload.get("version", 1)), int(existing["version"]) + 1 if existing else 1),
            "created_at": existing["created_at"] if existing else payload.get("created_at", now),
            "updated_at": now,
        }
        self.graph_workspaces[workspace_id] = saved
        return deepcopy(saved)

    def delete_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> bool:
        workspace = self.graph_workspaces.get(str(workspace_id))
        if not workspace or workspace["owner_user_id"] != owner_user_id:
            return False
        del self.graph_workspaces[str(workspace_id)]
        return True


class PostgresInvestigationRepository(InvestigationRepository):
    def __init__(self, database_url: str) -> None:
        self.database_url = database_url

    def _connect(self):
        return psycopg.connect(self.database_url, row_factory=dict_row)

    def ready(self) -> bool:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            return cursor.fetchone() is not None

    def get_profile(self, user_id: UUID) -> AuthorizedProfile | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT user_id, agent_id, display_name, role,
                       COALESCE(clearance_level, clearance) AS clearance_level,
                       active
                FROM public.profiles WHERE user_id = %s
                """,
                (user_id,),
            )
            row = cursor.fetchone()
        return AuthorizedProfile.model_validate(row) if row else None

    def list_investigations(self) -> list[dict[str, Any]]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT metadata FROM public.investigations ORDER BY is_demo DESC, name")
            return [_summary_from_detail(row["metadata"]) for row in cursor.fetchall()]

    def get_investigation(self, investigation_id: str) -> dict[str, Any] | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT metadata FROM public.investigations WHERE id = %s", (investigation_id,))
            row = cursor.fetchone()
        if not row:
            return None
        return {
            key: deepcopy(value)
            for key, value in row["metadata"].items()
            if key not in {"mapConfig", "timelineConfig"}
        }

    def _metadata(self, investigation_id: str) -> dict[str, Any] | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT metadata FROM public.investigations WHERE id = %s", (investigation_id,))
            row = cursor.fetchone()
        return deepcopy(row["metadata"]) if row else None

    def has_explicit_access(self, investigation_id: str, user_id: UUID) -> bool | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 AS granted FROM public.investigation_access WHERE investigation_id = %s AND user_id = %s",
                (investigation_id, user_id),
            )
            return True if cursor.fetchone() else None

    def get_map(self, investigation_id: str, *, types=None, importance=None, bounds=None) -> dict[str, Any]:
        detail = self._metadata(investigation_id)
        assert detail is not None
        clauses = ["investigation_id = %s"]
        params: list[Any] = [investigation_id]
        if types:
            clauses.append("(lower(location_type) = ANY(%s) OR filter_groups && %s)")
            params.extend([[item.lower() for item in types], types])
        if importance:
            clauses.append("importance = ANY(%s)")
            params.append([item.upper() for item in importance])
        if bounds:
            west, south, east, north = bounds
            clauses.append("(longitude IS NULL OR (longitude BETWEEN %s AND %s AND latitude BETWEEN %s AND %s))")
            params.extend([west, east, south, north])
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"SELECT metadata FROM public.investigation_locations WHERE {' AND '.join(clauses)} ORDER BY sort_order, id",
                params,
            )
            locations = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute(
                "SELECT metadata FROM public.investigation_routes WHERE investigation_id = %s ORDER BY sort_order, id",
                (investigation_id,),
            )
            routes = [row["metadata"] for row in cursor.fetchall()]
        map_config = detail["mapConfig"]
        return {"investigationId": investigation_id, **map_config, "locations": locations, "routes": routes}

    def get_network(self, investigation_id: str, *, layers=None, entity_id=None, hops=1) -> dict[str, Any]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT metadata FROM public.investigation_entities WHERE investigation_id = %s ORDER BY sort_order, id",
                (investigation_id,),
            )
            nodes = [row["metadata"] for row in cursor.fetchall()]
            if layers:
                cursor.execute(
                    "SELECT metadata FROM public.investigation_relationships WHERE investigation_id = %s AND lower(relationship_type) = ANY(%s) ORDER BY sort_order, id",
                    (investigation_id, [item.lower() for item in layers]),
                )
            else:
                cursor.execute(
                    "SELECT metadata FROM public.investigation_relationships WHERE investigation_id = %s ORDER BY sort_order, id",
                    (investigation_id,),
                )
            edges = [row["metadata"] for row in cursor.fetchall()]
        if entity_id:
            visible = {entity_id}
            for _ in range(max(0, hops)):
                visible |= {
                    endpoint
                    for edge in edges
                    if edge["source"] in visible or edge["target"] in visible
                    for endpoint in (edge["source"], edge["target"])
                }
            nodes = [node for node in nodes if node["id"] in visible]
            edges = [edge for edge in edges if edge["source"] in visible and edge["target"] in visible]
        valid = {node["id"] for node in nodes}
        edges = [edge for edge in edges if edge["source"] in valid and edge["target"] in valid]
        return {"investigationId": investigation_id, "nodes": nodes, "edges": edges}

    def get_timeline(self, investigation_id: str, *, date_from=None, date_to=None, types=None, entity_id=None, location_id=None) -> dict[str, Any]:
        detail = self._metadata(investigation_id)
        assert detail is not None
        clauses = ["investigation_id = %s"]
        params: list[Any] = [investigation_id]
        if date_from:
            clauses.append("event_time::date >= %s")
            params.append(date_from)
        if date_to:
            clauses.append("event_time::date <= %s")
            params.append(date_to)
        if types:
            clauses.append("event_type = ANY(%s)")
            params.append([item.upper() for item in types])
        if entity_id:
            clauses.append("metadata->'linkedEntityIds' ? %s")
            params.append(entity_id)
        if location_id:
            clauses.append("metadata->'linkedLocationIds' ? %s")
            params.append(location_id)
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                f"SELECT metadata, event_time, end_time FROM public.timeline_events WHERE {' AND '.join(clauses)} ORDER BY event_time, sort_order, id",
                params,
            )
            events = [row["metadata"] | {"eventTime": row["event_time"], "endTime": row["end_time"]} for row in cursor.fetchall()]
        return {
            "investigationId": investigation_id,
            "startDate": detail["timelineConfig"]["startDate"],
            "endDate": detail["timelineConfig"]["endDate"],
            "events": events,
        }

    def get_facts(self, investigation_id: str, *, fact_type=None, status=None, entity_id=None, location_id=None, event_id=None, limit=100, offset=0):
        clauses = ["fact.investigation_id = %s"]
        params: list[Any] = [investigation_id]
        if fact_type:
            clauses.append("lower(fact.fact_type) = %s")
            params.append(fact_type.lower())
        if status:
            clauses.append("lower(fact.verification_status) = %s")
            params.append(status.lower())
        joins = ""
        if entity_id:
            joins += " JOIN public.evidence_fact_entities link_entity ON link_entity.fact_id = fact.id AND link_entity.investigation_id = fact.investigation_id"
            clauses.append("link_entity.entity_id = %s")
            params.append(entity_id)
        if location_id:
            joins += " JOIN public.evidence_fact_locations link_location ON link_location.fact_id = fact.id AND link_location.investigation_id = fact.investigation_id"
            clauses.append("link_location.location_id = %s")
            params.append(location_id)
        if event_id:
            joins += " JOIN public.evidence_fact_events link_event ON link_event.fact_id = fact.id AND link_event.investigation_id = fact.investigation_id"
            clauses.append("link_event.event_id = %s")
            params.append(event_id)
        where = " AND ".join(clauses)
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(DISTINCT fact.id) AS count FROM public.evidence_facts fact {joins} WHERE {where}", params)
            total = int(cursor.fetchone()["count"])
            cursor.execute(
                f"SELECT DISTINCT fact.metadata, fact.created_at, fact.id FROM public.evidence_facts fact {joins} WHERE {where} ORDER BY fact.created_at, fact.id LIMIT %s OFFSET %s",
                [*params, limit, offset],
            )
            facts = [row["metadata"] for row in cursor.fetchall()]
        return facts, total

    def counts(self, investigation_id: str) -> dict[str, int]:
        tables = {
            "locations": "investigation_locations",
            "entities": "investigation_entities",
            "relationships": "investigation_relationships",
            "timelineEvents": "timeline_events",
            "facts": "evidence_facts",
        }
        result: dict[str, int] = {}
        with self._connect() as connection, connection.cursor() as cursor:
            for key, table in tables.items():
                cursor.execute(f"SELECT COUNT(*) AS count FROM public.{table} WHERE investigation_id = %s", (investigation_id,))
                result[key] = int(cursor.fetchone()["count"])
        return result

    def entity_details(self, investigation_id: str, entity_id: str) -> dict[str, Any] | None:
        network = self.get_network(investigation_id, entity_id=entity_id, hops=1)
        entity = next((node for node in network["nodes"] if node["id"] == entity_id), None)
        if not entity:
            return None
        map_data = self.get_map(investigation_id)
        timeline = self.get_timeline(investigation_id, entity_id=entity_id)
        facts, _ = self.get_facts(investigation_id, entity_id=entity_id)
        return {
            "entity": entity,
            "relationships": network["edges"],
            "locations": [item for item in map_data["locations"] if entity_id in item["linkedEntityIds"] or item.get("graphNodeId") == entity_id],
            "timelineEvents": timeline["events"],
            "facts": facts,
        }

    def location_details(self, investigation_id: str, location_id: str) -> dict[str, Any] | None:
        map_data = self.get_map(investigation_id)
        location = next((item for item in map_data["locations"] if item["id"] == location_id), None)
        if not location:
            return None
        network = self.get_network(investigation_id)
        entity_ids = set(location["linkedEntityIds"])
        timeline = self.get_timeline(investigation_id, location_id=location_id)
        facts, _ = self.get_facts(investigation_id, location_id=location_id)
        return {
            "location": location,
            "relatedEntities": [item for item in network["nodes"] if item["id"] in entity_ids or item["id"] == location.get("graphNodeId")],
            "timelineEvents": timeline["events"],
            "facts": facts,
        }

    def record_audit(self, *, profile, action, resource_type, resource_id, investigation_id, success=True, metadata=None) -> None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO public.audit_logs (user_id, agent_id, action, resource_type, resource_id, investigation_id, success, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (profile.user_id, profile.agent_id, action, resource_type, resource_id, investigation_id, success, Jsonb(metadata or {})),
            )

    def recent_audit(self, limit: int, offset: int) -> list[dict[str, Any]]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id::text, user_id::text, agent_id, action, resource_type, resource_id,
                       investigation_id, success, metadata, created_at
                FROM public.audit_logs ORDER BY created_at DESC LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            return list(cursor.fetchall())

    def list_graph_workspaces(self, investigation_id: str, owner_user_id: UUID) -> list[dict[str, Any]]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """SELECT id, investigation_id, name, description, version, created_at, updated_at
                   FROM public.graph_workspaces
                   WHERE investigation_id = %s AND owner_user_id = %s
                   ORDER BY updated_at DESC""",
                (investigation_id, owner_user_id),
            )
            return list(cursor.fetchall())

    def create_graph_workspace(self, investigation_id: str, owner_user_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        workspace_id = uuid4()
        now = datetime.now(timezone.utc)
        workspace = {
            "id": workspace_id, "investigation_id": investigation_id, "owner_user_id": owner_user_id,
            "name": payload["name"], "description": payload.get("description", ""),
            "nodes": [], "edges": [], "groups": [], "questions": [],
            "suggestions": [], "conflicts": [], "snapshots": [], "viewport": {"x": 0, "y": 0, "zoom": 1},
            "filters": {"verification": ["verified", "manual", "hypothesis"]},
            "version": 1, "created_at": now, "updated_at": now,
        }
        return self.save_graph_workspace(workspace, owner_user_id)

    def get_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> dict[str, Any] | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """SELECT id, investigation_id, owner_user_id, name, description,
                          viewport, filters, version, created_at, updated_at
                   FROM public.graph_workspaces WHERE id = %s AND owner_user_id = %s""",
                (workspace_id, owner_user_id),
            )
            workspace = cursor.fetchone()
            if not workspace:
                return None
            cursor.execute("SELECT metadata FROM public.graph_workspace_nodes WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            nodes = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.graph_workspace_edges WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            edges = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.graph_workspace_groups WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            groups = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.workspace_questions WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            questions = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.workspace_ai_suggestions WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            suggestions = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.workspace_conflicts WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            conflicts = [row["metadata"] for row in cursor.fetchall()]
            cursor.execute("SELECT metadata FROM public.workspace_snapshots WHERE workspace_id = %s ORDER BY created_at, id", (workspace_id,))
            snapshots = [row["metadata"] for row in cursor.fetchall()]
        return workspace | {"nodes": nodes, "edges": edges, "groups": groups, "questions": questions, "suggestions": suggestions, "conflicts": conflicts, "snapshots": snapshots}

    def save_graph_workspace(self, payload: dict[str, Any], owner_user_id: UUID) -> dict[str, Any]:
        workspace_id = payload["id"]
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT owner_user_id, created_at, version FROM public.graph_workspaces WHERE id = %s FOR UPDATE", (workspace_id,))
            existing = cursor.fetchone()
            if existing and existing["owner_user_id"] != owner_user_id:
                raise PermissionError("workspace owner mismatch")
            next_version = max(int(payload.get("version", 1)), int(existing["version"]) + 1 if existing else 1)
            cursor.execute(
                """INSERT INTO public.graph_workspaces
                       (id, investigation_id, owner_user_id, name, description, viewport, filters, version, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, COALESCE(%s, NOW()), NOW())
                   ON CONFLICT (id) DO UPDATE SET
                       name = EXCLUDED.name, description = EXCLUDED.description,
                       viewport = EXCLUDED.viewport, filters = EXCLUDED.filters,
                       version = EXCLUDED.version, updated_at = NOW()""",
                (workspace_id, payload["investigation_id"], owner_user_id, payload["name"], payload.get("description", ""), Jsonb(payload.get("viewport", {})), Jsonb(payload.get("filters", {})), next_version, payload.get("created_at")),
            )
            cursor.execute("DELETE FROM public.workspace_question_links WHERE question_id IN (SELECT id FROM public.workspace_questions WHERE workspace_id = %s)", (workspace_id,))
            cursor.execute("DELETE FROM public.workspace_questions WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.workspace_ai_suggestions WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.workspace_conflicts WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.workspace_snapshots WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.graph_workspace_edges WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.graph_workspace_groups WHERE workspace_id = %s", (workspace_id,))
            cursor.execute("DELETE FROM public.graph_workspace_nodes WHERE workspace_id = %s", (workspace_id,))
            for node in payload.get("nodes", []):
                cursor.execute(
                    """INSERT INTO public.graph_workspace_nodes
                           (id, workspace_id, node_type, label, origin, verification_status, source_entity_id,
                            source_event_id, source_location_id, source_fact_id, description, x, y, metadata, created_by)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (node["id"], workspace_id, node["type"], node["label"], node["origin"], node["verification_status"], node.get("source_entity_id"), node.get("source_event_id"), node.get("source_location_id"), node.get("source_fact_id"), node.get("description", ""), node["position"]["x"], node["position"]["y"], Jsonb(node), owner_user_id),
                )
            for edge in payload.get("edges", []):
                cursor.execute(
                    """INSERT INTO public.graph_workspace_edges
                           (id, workspace_id, source_node_id, target_node_id, relationship_type, label,
                            confidence, verification_status, reason, source_ref, metadata, created_by)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (edge["id"], workspace_id, edge["source"], edge["target"], edge["relationship_type"], edge["label"], edge["confidence"], edge["verification_status"], edge.get("reason", ""), edge.get("source_ref"), Jsonb(edge), owner_user_id),
                )
            for group in payload.get("groups", []):
                cursor.execute(
                    """INSERT INTO public.graph_workspace_groups (id, workspace_id, name, group_type, metadata, created_by)
                       VALUES (%s, %s, %s, %s, %s, %s)""",
                    (group["id"], workspace_id, group["name"], group["group_type"], Jsonb(group), owner_user_id),
                )
                for node_id in group.get("node_ids", []):
                    cursor.execute("INSERT INTO public.graph_workspace_group_nodes (group_id, node_id) VALUES (%s, %s)", (group["id"], node_id))
            for question in payload.get("questions", []):
                cursor.execute(
                    """INSERT INTO public.workspace_questions
                           (id, workspace_id, question_text, status, notes, resolved_at, metadata, created_by, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (question["id"], workspace_id, question["question_text"], question["status"], question.get("notes", ""), question.get("resolved_at"), Jsonb(question), owner_user_id, question.get("created_at"), question.get("updated_at")),
                )
                for link in question.get("links", []):
                    cursor.execute(
                        "INSERT INTO public.workspace_question_links (question_id, resource_type, resource_id, relationship_to_question) VALUES (%s, %s, %s, %s)",
                        (question["id"], link["resource_type"], link["resource_id"], link["relationship"]),
                    )
            for suggestion in payload.get("suggestions", []):
                cursor.execute(
                    """INSERT INTO public.workspace_ai_suggestions
                           (id, workspace_id, source_node_id, target_node_id, suggested_relationship, status, reason_codes, explanation, signal_strength, reviewed_by, reviewed_at, metadata, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (suggestion["id"], workspace_id, suggestion["source_node_id"], suggestion["target_node_id"], suggestion["suggested_relationship"], suggestion["status"], suggestion.get("reason_codes", []), suggestion["explanation"], suggestion["signal_strength"], owner_user_id if suggestion.get("reviewed_at") else None, suggestion.get("reviewed_at"), Jsonb(suggestion), suggestion.get("created_at")),
                )
            for conflict in payload.get("conflicts", []):
                cursor.execute(
                    """INSERT INTO public.workspace_conflicts
                           (id, workspace_id, conflict_type, resource_a_type, resource_a_id, resource_b_type, resource_b_id, status, explanation, reviewed_by, reviewed_at, metadata, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (conflict["id"], workspace_id, conflict["conflict_type"], conflict["resource_a_type"], conflict["resource_a_id"], conflict["resource_b_type"], conflict["resource_b_id"], conflict["status"], conflict["explanation"], owner_user_id if conflict.get("reviewed_at") else None, conflict.get("reviewed_at"), Jsonb(conflict), conflict.get("created_at")),
                )
            for item in payload.get("snapshots", []):
                cursor.execute(
                    """INSERT INTO public.workspace_snapshots
                           (id, workspace_id, name, description, snapshot_data, metadata, created_by, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                    (item["id"], workspace_id, item["name"], item.get("description", ""), Jsonb(item["snapshot_data"]), Jsonb(item), owner_user_id, item.get("created_at")),
                )
        saved = self.get_graph_workspace(workspace_id, owner_user_id)
        assert saved is not None
        return saved

    def delete_graph_workspace(self, workspace_id: UUID, owner_user_id: UUID) -> bool:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("DELETE FROM public.graph_workspaces WHERE id = %s AND owner_user_id = %s RETURNING id", (workspace_id, owner_user_id))
            return cursor.fetchone() is not None
