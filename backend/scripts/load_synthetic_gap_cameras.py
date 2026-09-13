"""Opt-in, idempotent loader for local-only synthetic Gap Reconstruction cameras."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID

import psycopg


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--actor-user-id", required=True, type=UUID)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL or --database-url is required")
    host = (urlparse(args.database_url).hostname or "").lower()
    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Refusing fixture write: only a local Postgres host is allowed")
    fixture = json.loads((Path(__file__).parents[1] / "fixtures" / "synthetic_gap_cameras.json").read_text())
    with psycopg.connect(args.database_url) as connection, connection.cursor() as cursor:
        for camera in fixture["cameras"]:
            cursor.execute(
                """INSERT INTO public.investigation_cameras (id,investigation_id,label,latitude,longitude,source_ref,is_synthetic,recording_availability,retention_information,created_by)
                VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source_ref=EXCLUDED.source_ref,is_synthetic=TRUE,recording_availability=EXCLUDED.recording_availability,retention_information=EXCLUDED.retention_information,updated_at=NOW()""",
                (camera["id"], fixture["investigationId"], camera["label"], camera["latitude"], camera["longitude"], camera["sourceRef"], camera["recordingAvailability"], camera["retentionInformation"], args.actor_user_id),
            )
    print(f"Loaded {len(fixture['cameras'])} synthetic cameras into local investigation {fixture['investigationId']}")


if __name__ == "__main__":
    main()
