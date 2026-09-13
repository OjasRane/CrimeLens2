"""Additive private case creation; no seed data or legacy memberships are changed."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from copy import deepcopy

from psycopg.types.json import Jsonb
from fastapi import HTTPException


def empty_case(name: str, description: str) -> dict:
    case_id = str(uuid4())
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return dict(
        id=case_id, slug=case_id, caseId=case_id, name=name, shortName=name[:32],
        displayName=name, type="PRIVATE", deskLabel="PRIVATE INVESTIGATION", caseType="Private investigation",
        location="Not specified", start=start.isoformat(), end=end.isoformat(), timezone="UTC",
        overallStatus="OPEN", summary=description, badge="PRIVATE", classification="standard", isDemo=False,
        accessMode="private", roomId="private-board-" + str(uuid4()),
        sourceRef="Investigator-created case", timePrecision="NOT_APPLICABLE", confidence="HIGH",
        map=dict(center=[0, 0], zoom=2, boundsLabel="Your investigation", filterGroups=[], locations=[], routes=[]),
        graph=dict(nodes=[], links=[], filters=[]), timeline=dict(startDate=start.date().isoformat(), endDate=end.date().isoformat(), events=[]),
        casualtyLedger=[], facts=[],
    )


def create_private_case(repository, profile, payload):
    # Same owner + retry key is atomic, including simultaneous requests and membership.
    if hasattr(repository, "_connect"):
        with repository._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (str(profile.user_id) + str(payload.request_id),))
            cursor.execute("SELECT metadata FROM public.investigations WHERE owner_user_id=%s AND creation_key=%s", (profile.user_id, payload.request_id))
            existing = cursor.fetchone()
            if existing:
                return _retry(existing["metadata"], payload)
            case = empty_case(payload.name, payload.description)
            from .repository import _detail_from_seed
            metadata = _detail_from_seed(case) | {"mapConfig": {k:v for k,v in case["map"].items() if k not in ("locations","routes")}, "timelineConfig": {k:v for k,v in case["timeline"].items() if k != "events"}}
            cursor.execute("""INSERT INTO public.investigations
                (id,slug,name,short_name,investigation_type,description,location,start_time,end_time,timezone,status,classification,is_demo,metadata,owner_user_id,creation_key)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (case["id"],case["slug"],case["name"],case["shortName"],case["type"],case["summary"],case["location"],case["start"],case["end"],case["timezone"],case["overallStatus"],case["classification"],False,Jsonb(metadata),profile.user_id,payload.request_id))
            cursor.execute("INSERT INTO public.investigation_access(investigation_id,user_id,role,granted_by) VALUES (%s,%s,'owner',%s)", (case["id"],profile.user_id,profile.user_id))
            return _detail_from_seed(case)
    # Test repository: no hosted services.
    from .repository import _detail_from_seed
    for case in repository.investigations.values():
        if case.get("creationKey") == str(payload.request_id) and case.get("ownerUserId") == str(profile.user_id):
            return _retry(_detail_from_seed(case), payload)
    case = empty_case(payload.name, payload.description)
    case.update(creationKey=str(payload.request_id), ownerUserId=str(profile.user_id))
    repository.investigations[case["id"]] = deepcopy(case)
    repository.access[(case["id"],str(profile.user_id))] = True
    return _detail_from_seed(case)


def _retry(case, payload):
    if case["name"] != payload.name or case["summary"] != payload.description:
        raise HTTPException(409, detail={"code":"CREATION_KEY_REUSED", "message":"This retry key belongs to a different case request."})
    return {key:value for key,value in case.items() if key not in {"mapConfig", "timelineConfig"}}


def membership_role(repository, investigation_id, user_id):
    if hasattr(repository, "_connect"):
        with repository._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT role FROM public.investigation_access WHERE investigation_id=%s AND user_id=%s", (investigation_id,user_id))
            row = cursor.fetchone()
            return row["role"] if row else None
    case = repository.investigations.get(investigation_id, {})
    if case.get("ownerUserId") == str(user_id):
        return "owner"
    return "viewer"
