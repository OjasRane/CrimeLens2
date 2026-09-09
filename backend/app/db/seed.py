from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import psycopg
from psycopg.types.json import Jsonb

from ..core.config import get_settings
from ..schemas.investigations import (
    FactResponse,
    InvestigationMapResponse,
    InvestigationNetworkResponse,
    InvestigationTimelineResponse,
)


SEED_FILE = Path(__file__).with_name("seeds") / "investigations.json"
TIME_PATTERN = re.compile(r"(\d{1,2}):(\d{2})")


class SeedValidationError(ValueError):
    pass


def load_seed_payload(path: Path = SEED_FILE) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_seed_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    investigations = payload.get("investigations")
    if not isinstance(investigations, list) or not investigations:
        raise SeedValidationError("Seed payload must contain investigations")

    ids = {item["id"] for item in investigations}
    if ids != {"demo", "mumbai-2611"}:
        raise SeedValidationError("Demo and Mumbai investigations must both be present")

    for investigation in investigations:
        investigation_id = investigation["id"]
        location_ids = {item["id"] for item in investigation["map"]["locations"]}
        entity_ids = {item["id"] for item in investigation["graph"]["nodes"]}
        graph_location_ids = {
            item["id"]
            for item in investigation["graph"]["nodes"]
            if item["kind"] == "location"
        }
        event_ids = {item["id"] for item in investigation["timeline"]["events"]}

        InvestigationMapResponse.model_validate(
            {"investigationId": investigation_id, **investigation["map"]}
        )
        InvestigationNetworkResponse.model_validate(
            {
                "investigationId": investigation_id,
                "nodes": investigation["graph"]["nodes"],
                "edges": investigation["graph"]["links"],
            }
        )
        InvestigationTimelineResponse.model_validate(
            {"investigationId": investigation_id, **investigation["timeline"]}
        )
        for fact in investigation["facts"]:
            FactResponse.model_validate(fact)
            if not set(fact["linkedEntityIds"]).issubset(entity_ids):
                raise SeedValidationError(f"{fact['id']} references an unknown entity")
            if not set(fact["linkedLocationIds"]).issubset(
                location_ids | graph_location_ids
            ):
                raise SeedValidationError(f"{fact['id']} references an unknown location")
            if not set(fact["linkedTimelineEventIds"]).issubset(event_ids):
                raise SeedValidationError(f"{fact['id']} references an unknown event")

        for event in investigation["timeline"]["events"]:
            if not set(event["linkedEntityIds"]).issubset(entity_ids):
                raise SeedValidationError(f"{event['id']} references an unknown entity")
            if not set(event["linkedLocationIds"]).issubset(location_ids):
                raise SeedValidationError(f"{event['id']} references an unknown location")
            if not event.get("sourceRef"):
                raise SeedValidationError(f"{event['id']} is missing source metadata")

        for route in investigation["map"]["routes"]:
            if not set(route["memberEntityIds"]).issubset(entity_ids):
                raise SeedValidationError(f"{route['id']} references an unknown route member")
            if not set(route["locationIds"]).issubset(location_ids):
                raise SeedValidationError(f"{route['id']} references an unknown route location")

    mumbai = next(item for item in investigations if item["id"] == "mumbai-2611")
    attackers = [item for item in mumbai["graph"]["nodes"] if item["kind"] == "attacker"]
    teams = [item for item in mumbai["graph"]["nodes"] if item["kind"] == "team"]
    captured = [item for item in attackers if item.get("status") == "CAPTURED"]
    killed = sum(item["killed"] for item in mumbai["casualtyLedger"])
    injured = sum(item["injured"] for item in mumbai["casualtyLedger"])
    invariants = {
        "attacker count": (len(attackers), 10),
        "team count": (len(teams), 5),
        "captured attacker count": (len(captured), 1),
        "killed total": (killed, 166),
        "injured total": (injured, 238),
    }
    for label, (actual, expected) in invariants.items():
        if actual != expected:
            raise SeedValidationError(f"Mumbai {label} is {actual}; expected {expected}")
    return investigations


def _event_bounds(event: dict[str, Any]) -> tuple[datetime, datetime | None]:
    matches = TIME_PATTERN.findall(event["time"])
    hour, minute = (int(value) for value in matches[0]) if matches else (0, 0)
    timezone = ZoneInfo(event["timezone"])
    start = datetime.fromisoformat(event["date"]).replace(
        hour=hour, minute=minute, tzinfo=timezone
    )
    end = None
    if len(matches) > 1:
        end_hour, end_minute = (int(value) for value in matches[1])
        end = start.replace(hour=end_hour, minute=end_minute)
    return start, end


def _investigation_metadata(investigation: dict[str, Any]) -> dict[str, Any]:
    detail = {
        key: value
        for key, value in investigation.items()
        if key not in {"map", "graph", "timeline", "facts", "casualtyLedger"}
    }
    detail.update(
        {
            "classification": investigation.get("classification", "standard"),
            "isDemo": investigation["type"] == "DEMO",
            "graphFilters": investigation["graph"]["filters"],
            "mapConfig": {
                key: value
                for key, value in investigation["map"].items()
                if key not in {"locations", "routes"}
            },
            "timelineConfig": {
                "startDate": investigation["timeline"]["startDate"],
                "endDate": investigation["timeline"]["endDate"],
            },
            "casualtyLedger": investigation["casualtyLedger"],
        }
    )
    return detail


def seed_database(database_url: str, investigations: list[dict[str, Any]]) -> None:
    with psycopg.connect(database_url) as connection, connection.cursor() as cursor:
        for investigation in investigations:
            investigation_id = investigation["id"]
            timezone = ZoneInfo(investigation["timezone"])
            start_time = datetime.fromisoformat(investigation["start"]).replace(tzinfo=timezone)
            end_time = datetime.fromisoformat(investigation["end"]).replace(tzinfo=timezone)
            metadata = _investigation_metadata(investigation)
            cursor.execute(
                """
                INSERT INTO public.investigations (
                    id, slug, name, short_name, investigation_type, description,
                    location, start_time, end_time, timezone, status,
                    classification, is_demo, metadata, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    slug = EXCLUDED.slug, name = EXCLUDED.name,
                    short_name = EXCLUDED.short_name,
                    investigation_type = EXCLUDED.investigation_type,
                    description = EXCLUDED.description, location = EXCLUDED.location,
                    start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
                    timezone = EXCLUDED.timezone, status = EXCLUDED.status,
                    classification = EXCLUDED.classification, is_demo = EXCLUDED.is_demo,
                    metadata = EXCLUDED.metadata, updated_at = NOW()
                """,
                (
                    investigation_id,
                    investigation["slug"],
                    investigation["name"],
                    investigation["shortName"],
                    investigation["type"],
                    investigation["summary"],
                    investigation["location"],
                    start_time,
                    end_time,
                    investigation["timezone"],
                    investigation["overallStatus"],
                    metadata["classification"],
                    metadata["isDemo"],
                    Jsonb(metadata),
                ),
            )

            cursor.execute("DELETE FROM public.evidence_facts WHERE investigation_id = %s", (investigation_id,))
            cursor.execute("DELETE FROM public.timeline_events WHERE investigation_id = %s", (investigation_id,))
            cursor.execute("DELETE FROM public.investigation_relationships WHERE investigation_id = %s", (investigation_id,))
            cursor.execute("DELETE FROM public.investigation_routes WHERE investigation_id = %s", (investigation_id,))
            cursor.execute("DELETE FROM public.investigation_entities WHERE investigation_id = %s", (investigation_id,))
            cursor.execute("DELETE FROM public.investigation_locations WHERE investigation_id = %s", (investigation_id,))

            for index, location in enumerate(investigation["map"]["locations"]):
                coordinates = location.get("coordinates")
                cursor.execute(
                    """
                    INSERT INTO public.investigation_locations (
                        investigation_id, id, name, short_name, location_type,
                        latitude, longitude, coordinate_status, description,
                        killed, injured, importance, filter_groups, source_ref,
                        sort_order, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        investigation_id, location["id"], location["title"],
                        location.get("alternativeLabel") or location.get("expandedName"),
                        location["type"], coordinates[1] if coordinates else None,
                        coordinates[0] if coordinates else None, location["coordinateStatus"],
                        location["description"], location.get("killed"), location.get("injured"),
                        location["importance"], location["filterGroups"], location["sourceRef"],
                        index, Jsonb(location),
                    ),
                )

            for index, entity in enumerate(investigation["graph"]["nodes"]):
                cursor.execute(
                    """
                    INSERT INTO public.investigation_entities (
                        investigation_id, id, entity_type, name, short_name,
                        status, description, source_ref, sort_order, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        investigation_id, entity["id"], entity["kind"].upper(), entity["label"],
                        entity.get("subtitle"), entity.get("status"), entity.get("subtitle", ""),
                        entity["sourceRef"], index, Jsonb(entity),
                    ),
                )

            for index, route in enumerate(investigation["map"]["routes"]):
                cursor.execute(
                    "INSERT INTO public.investigation_routes (investigation_id, id, label, sort_order, source_ref, metadata) VALUES (%s, %s, %s, %s, %s, %s)",
                    (investigation_id, route["id"], route["label"], index, route["sourceRef"], Jsonb(route)),
                )

            for index, relationship in enumerate(investigation["graph"]["links"]):
                cursor.execute(
                    """
                    INSERT INTO public.investigation_relationships (
                        investigation_id, id, source_entity_id, target_entity_id,
                        relationship_type, label, confidence, source_ref, sort_order, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        investigation_id, relationship["id"], relationship["source"],
                        relationship["target"], relationship["linkKind"], relationship["label"],
                        relationship["confidence"], relationship["sourceRef"], index,
                        Jsonb(relationship),
                    ),
                )

            for event in investigation["timeline"]["events"]:
                event_time, end_time = _event_bounds(event)
                location_id = event["linkedLocationIds"][0] if event["linkedLocationIds"] else None
                cursor.execute(
                    """
                    INSERT INTO public.timeline_events (
                        investigation_id, id, event_type, title, description,
                        event_time, end_time, time_precision, timezone, location_id,
                        source_ref, confidence, sort_order, metadata
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        investigation_id, event["id"], event["category"], event["title"],
                        event["description"], event_time, end_time, event["timePrecision"],
                        event["timezone"], location_id, event["sourceRef"], event["confidence"],
                        event["sortOrder"], Jsonb(event),
                    ),
                )

            for index, fact in enumerate(investigation["facts"]):
                cursor.execute(
                    """
                    INSERT INTO public.evidence_facts (
                        investigation_id, id, fact_type, statement, verification_status,
                        source_title, source_ref, confidence, metadata, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        investigation_id, fact["id"], fact["type"], fact["text"], fact["status"],
                        fact["sourceTitle"], fact["sourceRef"], fact["confidence"], Jsonb(fact),
                        start_time.replace(microsecond=index),
                    ),
                )
                for entity_id in fact["linkedEntityIds"]:
                    cursor.execute(
                        "INSERT INTO public.evidence_fact_entities (investigation_id, fact_id, entity_id) VALUES (%s, %s, %s)",
                        (investigation_id, fact["id"], entity_id),
                    )
                for location_id in fact["linkedLocationIds"]:
                    if any(
                        location["id"] == location_id
                        for location in investigation["map"]["locations"]
                    ):
                        cursor.execute(
                            "INSERT INTO public.evidence_fact_locations (investigation_id, fact_id, location_id) VALUES (%s, %s, %s)",
                            (investigation_id, fact["id"], location_id),
                        )
                    else:
                        # The original demo uses graph-only location nodes. Preserve
                        # its payload while linking the normalized fact to the
                        # existing LOCATION entity instead of inventing a map point.
                        cursor.execute(
                            "INSERT INTO public.evidence_fact_entities (investigation_id, fact_id, entity_id) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                            (investigation_id, fact["id"], location_id),
                        )
                for event_id in fact["linkedTimelineEventIds"]:
                    cursor.execute(
                        "INSERT INTO public.evidence_fact_events (investigation_id, fact_id, event_id) VALUES (%s, %s, %s)",
                        (investigation_id, fact["id"], event_id),
                    )

        cursor.execute(
            "ALTER TABLE public.investigation_pins VALIDATE CONSTRAINT investigation_pins_investigation_fk"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate and seed CrimeLens investigations")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--database-url")
    arguments = parser.parse_args()
    investigations = validate_seed_payload(load_seed_payload())
    if arguments.validate_only:
        print(f"Validated {len(investigations)} CrimeLens investigations")
        return
    database_url = arguments.database_url or get_settings().database_url
    if not database_url:
        raise SystemExit("DATABASE_URL is required to seed Supabase Postgres")
    seed_database(database_url, investigations)
    print(f"Seeded {len(investigations)} CrimeLens investigations")


if __name__ == "__main__":
    main()
