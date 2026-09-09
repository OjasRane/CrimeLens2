from __future__ import annotations

import re
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from ..schemas.auth import AuthorizedProfile
from .repository import InvestigationRepository, MemoryInvestigationRepository, PostgresInvestigationRepository


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _counts(candidates: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"entities": 0, "locations": 0, "events": 0, "datesTimes": 0, "relationships": 0, "conflicts": 0}
    mapping = {"ENTITY": "entities", "LOCATION": "locations", "EVENT": "events", "DATE_TIME": "datesTimes", "RELATIONSHIP": "relationships", "CONFLICT": "conflicts"}
    for candidate in candidates:
        key = mapping.get(candidate["candidate_type"])
        if key:
            counts[key] += 1
    return counts


def _source_ref(evidence: dict[str, Any], payload: dict[str, Any]) -> str:
    locator = payload.get("sourceLocator") or {}
    suffix = ", ".join(f"{key} {value}" for key, value in locator.items())
    return evidence["display_id"] + (f" / {suffix}" if suffix else "")


class EvidenceRepository:
    def create_evidence(self, investigation_id: str, profile: AuthorizedProfile, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def list_evidence(self, investigation_id: str) -> list[dict[str, Any]]:
        raise NotImplementedError

    def get_evidence(self, evidence_id: UUID) -> dict[str, Any] | None:
        raise NotImplementedError

    def set_processing(self, evidence_id: UUID, status: str, failure_reason: str | None = None) -> None:
        raise NotImplementedError

    def save_extraction(self, evidence_id: UUID, result: dict[str, Any], provider: str, model: str, derived_content: str, locator_kind: str) -> dict[str, Any]:
        raise NotImplementedError

    def get_extraction(self, evidence_id: UUID) -> dict[str, Any] | None:
        raise NotImplementedError

    def review_candidate(self, evidence_id: UUID, candidate_id: UUID, payload: dict[str, Any], profile: AuthorizedProfile) -> dict[str, Any] | None:
        raise NotImplementedError

    def commit(self, evidence_id: UUID, profile: AuthorizedProfile) -> dict[str, Any]:
        raise NotImplementedError

    def count_open_conflicts(self, investigation_id: str) -> int:
        raise NotImplementedError

    def save_report(self, report: dict[str, Any], include: list[str], profile: AuthorizedProfile) -> None:
        raise NotImplementedError


class MemoryEvidenceRepository(EvidenceRepository):
    def __init__(self, investigations: MemoryInvestigationRepository) -> None:
        self.investigations = investigations
        self.evidence: dict[str, dict[str, Any]] = {}
        self.extractions: dict[str, dict[str, Any]] = {}
        self.candidates: dict[str, dict[str, Any]] = {}
        self.commits: dict[str, dict[str, Any]] = {}
        self.reports: dict[str, dict[str, Any]] = {}

    def _audit(self, profile: AuthorizedProfile, action: str, evidence: dict[str, Any], resource_type: str = "evidence", resource_id: str | None = None, metadata: dict[str, Any] | None = None) -> None:
        self.investigations.record_audit(
            profile=profile, action=action, resource_type=resource_type,
            resource_id=resource_id or str(evidence["id"]),
            investigation_id=evidence["investigation_id"],
            metadata={"evidenceId": str(evidence["id"]), **(metadata or {})},
        )

    def create_evidence(self, investigation_id: str, profile: AuthorizedProfile, payload: dict[str, Any]) -> dict[str, Any]:
        now = _now()
        evidence_id = payload.get("id") or uuid4()
        item = {
            "id": evidence_id, "investigation_id": investigation_id,
            "display_id": f"EV-{len(self.evidence) + 1:06d}",
            "source_type": payload["source_type"], "original_filename": payload["original_filename"],
            "storage_reference": payload["storage_reference"], "mime_type": payload["mime_type"],
            "size_bytes": payload["size_bytes"], "sha256": payload["sha256"],
            "description": payload.get("description", ""), "processing_status": "UPLOADED",
            "uploaded_by": profile.agent_id, "uploaded_by_name": profile.display_name,
            "uploaded_user_id": profile.user_id, "uploaded_at": now,
            "extraction_counts": {}, "failure_reason": None, "created_at": now, "updated_at": now,
        }
        self.evidence[str(evidence_id)] = item
        self._audit(profile, "EVIDENCE_UPLOADED", item, metadata={"displayId": item["display_id"], "mimeType": item["mime_type"], "sizeBytes": item["size_bytes"]})
        return deepcopy(item)

    def list_evidence(self, investigation_id: str) -> list[dict[str, Any]]:
        return [deepcopy(item) for item in sorted(self.evidence.values(), key=lambda value: value["uploaded_at"], reverse=True) if item["investigation_id"] == investigation_id]

    def get_evidence(self, evidence_id: UUID) -> dict[str, Any] | None:
        item = self.evidence.get(str(evidence_id))
        return deepcopy(item) if item else None

    def set_processing(self, evidence_id: UUID, status: str, failure_reason: str | None = None) -> None:
        item = self.evidence[str(evidence_id)]
        item.update(processing_status=status, failure_reason=failure_reason, updated_at=_now())

    def save_extraction(self, evidence_id: UUID, result: dict[str, Any], provider: str, model: str, derived_content: str, locator_kind: str) -> dict[str, Any]:
        # A retry replaces unreviewed candidates but never rewrites review history.
        previous = self.extractions.get(str(evidence_id))
        if previous and any(candidate["review_status"] != "PENDING" for candidate in previous["candidates"]):
            raise ValueError("Reviewed extraction cannot be replaced")
        for candidate in (previous or {}).get("candidates", []):
            self.candidates.pop(str(candidate["id"]), None)
        extraction_id = uuid4()
        now = _now()
        candidates: list[dict[str, Any]] = []
        groups = (("entities", "ENTITY"), ("locations", "LOCATION"), ("events", "EVENT"), ("datesTimes", "DATE_TIME"), ("relationships", "RELATIONSHIP"), ("potentialConflicts", "CONFLICT"))
        for field, candidate_type in groups:
            for raw_payload in result.get(field, []):
                candidate = {
                    "id": uuid4(), "extraction_id": extraction_id, "candidate_type": candidate_type,
                    "candidate_payload": deepcopy(raw_payload), "review_status": "PENDING",
                    "reviewed_by": None, "reviewed_at": None, "created_resource_type": None,
                    "created_resource_id": None, "created_at": now,
                }
                candidates.append(candidate)
                self.candidates[str(candidate["id"])] = candidate
        extraction = {
            "id": extraction_id, "evidence_id": evidence_id, "status": "PENDING_REVIEW",
            "provider": provider, "model_identifier": model, "candidates": candidates,
            "counts": _counts(candidates), "created_at": now, "completed_at": now,
            "failure_reason": None, "derived_content": derived_content,
            "derived_locator_kind": locator_kind,
        }
        self.extractions[str(evidence_id)] = extraction
        self.evidence[str(evidence_id)].update(processing_status="PENDING_REVIEW", extraction_counts=extraction["counts"], updated_at=now)
        return deepcopy(extraction)

    def get_extraction(self, evidence_id: UUID) -> dict[str, Any] | None:
        extraction = self.extractions.get(str(evidence_id))
        return deepcopy(extraction) if extraction else None

    def review_candidate(self, evidence_id: UUID, candidate_id: UUID, payload: dict[str, Any], profile: AuthorizedProfile) -> dict[str, Any] | None:
        extraction = self.extractions.get(str(evidence_id))
        candidate = self.candidates.get(str(candidate_id))
        if not extraction or not candidate or str(candidate["extraction_id"]) != str(extraction["id"]):
            return None
        if self.evidence[str(evidence_id)]["processing_status"] == "APPROVED":
            raise ValueError("Committed evidence cannot be reviewed again")
        status = payload["review_status"]
        if status == "EDITED_ACCEPTED":
            if not isinstance(payload.get("candidate_payload"), dict):
                raise ValueError("Edited candidates require a complete candidate payload")
            candidate["candidate_payload"] = deepcopy(payload["candidate_payload"])
        candidate.update(review_status=status, reviewed_by=profile.agent_id, reviewed_at=_now())
        pending = sum(item["review_status"] == "PENDING" for item in extraction["candidates"])
        evidence_status = "PENDING_REVIEW" if pending else "PARTIALLY_REVIEWED"
        extraction["status"] = evidence_status
        self.evidence[str(evidence_id)].update(processing_status=evidence_status, updated_at=_now())
        self._audit(profile, "EXTRACTION_REVIEWED", self.evidence[str(evidence_id)], "extraction_candidate", str(candidate_id), {"reviewStatus": status})
        return deepcopy(candidate)

    def _create_fact(self, investigation: dict[str, Any], evidence: dict[str, Any], candidate: dict[str, Any], resource_ids: dict[str, str]) -> None:
        payload = candidate["candidate_payload"]
        fact_id = f"fact-{evidence['display_id'].lower()}-{str(candidate['id'])[:8]}"
        investigation["facts"].append({
            "investigationId": evidence["investigation_id"], "id": fact_id,
            "type": "investigative", "text": payload.get("sourceText") or payload.get("description") or payload.get("label") or payload.get("title") or "Reviewed extraction candidate",
            "status": "verified", "sourceTitle": evidence["original_filename"],
            "linkedEntityIds": [resource_ids[str(candidate["id"])] ] if candidate["candidate_type"] == "ENTITY" and str(candidate["id"]) in resource_ids else [],
            "linkedTimelineEventIds": [resource_ids[str(candidate["id"])] ] if candidate["candidate_type"] == "EVENT" and str(candidate["id"]) in resource_ids else [],
            "linkedLocationIds": [resource_ids[str(candidate["id"])] ] if candidate["candidate_type"] == "LOCATION" and str(candidate["id"]) in resource_ids else [],
            "sourceRef": _source_ref(evidence, payload), "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED",
            "sourceEvidenceId": str(evidence["id"]), "sourceLocator": payload.get("sourceLocator"),
        })

    def commit(self, evidence_id: UUID, profile: AuthorizedProfile) -> dict[str, Any]:
        key = str(evidence_id)
        if key in self.commits:
            return deepcopy(self.commits[key] | {"already_committed": True})
        evidence = self.evidence[key]
        extraction = self.extractions.get(key)
        if not extraction:
            raise ValueError("No extraction is available to commit")
        if any(candidate["review_status"] == "PENDING" for candidate in extraction["candidates"]):
            raise ValueError("Every extraction candidate must be reviewed before commit")
        accepted = [candidate for candidate in extraction["candidates"] if candidate["review_status"] in {"ACCEPTED", "EDITED_ACCEPTED"}]
        unresolved = [candidate for candidate in accepted if candidate["candidate_type"] == "ENTITY" and (candidate["candidate_payload"].get("possibleDuplicate") or {}).get("resolutionStatus") == "PENDING"]
        if unresolved:
            raise ValueError("Possible duplicate entities require an explicit merge or keep-separate decision")
        investigation = self.investigations.investigations[evidence["investigation_id"]]
        result = {"evidence_id": key, "already_committed": False, "entities_created": 0, "entities_merged": 0, "locations_created": 0, "events_created": 0, "relationships_created": 0, "facts_created": 0}
        resource_ids: dict[str, str] = {}

        for candidate in accepted:
            payload = candidate["candidate_payload"]
            ref = _source_ref(evidence, payload)
            cid = str(candidate["id"])
            if candidate["candidate_type"] == "ENTITY":
                duplicate = payload.get("possibleDuplicate") or {}
                if duplicate.get("resolutionStatus") == "MERGE":
                    resource_id = duplicate["existingEntityId"]
                    result["entities_merged"] += 1
                    action = "ENTITY_MERGED"
                else:
                    resource_id = f"entity-{evidence['display_id'].lower()}-{cid[:8]}"
                    kinds = {"PERSON": "suspect", "ORGANIZATION": "organization", "VEHICLE": "evidence", "DEVICE": "evidence", "PHONE": "evidence", "ACCOUNT": "transaction", "DOCUMENT": "evidence"}
                    investigation["graph"]["nodes"].append({
                        "investigationId": evidence["investigation_id"], "id": resource_id,
                        "label": payload.get("label", "Unnamed candidate"), "kind": kinds.get(payload.get("type", "OTHER"), "evidence"),
                        "subtitle": f"REVIEWED / {evidence['display_id']}", "status": "REVIEWED",
                        "position": {"x": 180 + (len(investigation["graph"]["nodes"]) % 5) * 170, "y": 180 + (len(investigation["graph"]["nodes"]) // 5) * 130},
                        "sourceRef": ref, "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED",
                        "sourceEvidenceId": key, "sourceLocator": payload.get("sourceLocator"),
                    })
                    result["entities_created"] += 1
                    action = "ENTITY_CREATED"
                resource_ids[cid] = resource_id
                candidate.update(created_resource_type="entity", created_resource_id=resource_id)
                self._audit(profile, action, evidence, "entity", resource_id)

            elif candidate["candidate_type"] == "LOCATION":
                resource_id = f"location-{evidence['display_id'].lower()}-{cid[:8]}"
                investigation["map"]["locations"].append({
                    "investigationId": evidence["investigation_id"], "id": resource_id,
                    "title": payload.get("label", "Unresolved location"), "type": "EVIDENCE LOCATION",
                    "filterGroups": ["EVIDENCE"], "date": evidence["uploaded_at"].date().isoformat(),
                    "timeLabel": "UNRESOLVED", "importance": "MED", "coordinateStatus": "NEEDS_VERIFICATION",
                    "intensity": 1, "description": payload.get("sourceText", "Reviewed location candidate"),
                    "linkedEntityIds": [], "linkedTimelineEventIds": [], "sourceRef": ref,
                    "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED",
                    "sourceEvidenceId": key, "sourceLocator": payload.get("sourceLocator"),
                })
                if "EVIDENCE" not in investigation["map"]["filterGroups"]:
                    investigation["map"]["filterGroups"].append("EVIDENCE")
                resource_ids[cid] = resource_id
                candidate.update(created_resource_type="location", created_resource_id=resource_id)
                result["locations_created"] += 1

            elif candidate["candidate_type"] == "EVENT":
                resource_id = f"event-{evidence['display_id'].lower()}-{cid[:8]}"
                event_date = payload.get("date") or evidence["uploaded_at"].date().isoformat()
                time_label = payload.get("time") or "DATE ONLY"
                investigation["timeline"]["events"].append({
                    "investigationId": evidence["investigation_id"], "id": resource_id,
                    "date": event_date, "time": ("≈ " if payload.get("timePrecision") == "APPROX" else "") + time_label,
                    "sortOrder": len(investigation["timeline"]["events"]) + 1,
                    "timezone": investigation["timezone"], "category": "EVIDENCE",
                    "title": payload.get("title", "Reviewed evidence event"), "description": payload.get("description", ""),
                    "severity": 2, "linkedEntityIds": [], "linkedLocationIds": [], "sourceRef": ref,
                    "timePrecision": payload.get("timePrecision", "DATE"), "confidence": "VERIFIED",
                    "sourceEvidenceId": key, "sourceLocator": payload.get("sourceLocator"),
                })
                investigation["timeline"]["events"].sort(key=lambda item: (item["date"], item["sortOrder"]))
                investigation["timeline"]["startDate"] = min(investigation["timeline"]["startDate"], event_date)
                investigation["timeline"]["endDate"] = max(investigation["timeline"]["endDate"], event_date)
                resource_ids[cid] = resource_id
                candidate.update(created_resource_type="event", created_resource_id=resource_id)
                result["events_created"] += 1
                self._audit(profile, "EVENT_CREATED", evidence, "timeline_event", resource_id)

        temporary_to_resource = {
            candidate["candidate_payload"].get("temporaryId"): resource_ids.get(str(candidate["id"]))
            for candidate in accepted
        }
        for candidate in accepted:
            if candidate["candidate_type"] != "RELATIONSHIP":
                continue
            payload = candidate["candidate_payload"]
            source = temporary_to_resource.get(payload.get("sourceCandidateId"))
            target = temporary_to_resource.get(payload.get("targetCandidateId"))
            if not source or not target:
                continue
            cid = str(candidate["id"])
            resource_id = f"relationship-{evidence['display_id'].lower()}-{cid[:8]}"
            investigation["graph"]["links"].append({
                "investigationId": evidence["investigation_id"], "id": resource_id,
                "source": source, "target": target, "linkKind": "evidence",
                "label": payload.get("relationshipType", "ASSOCIATED_WITH").replace("_", " "),
                "sourceRef": _source_ref(evidence, payload), "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED",
                "sourceEvidenceId": key, "sourceLocator": payload.get("sourceLocator"),
            })
            candidate.update(created_resource_type="relationship", created_resource_id=resource_id)
            result["relationships_created"] += 1
            self._audit(profile, "RELATIONSHIP_CREATED", evidence, "relationship", resource_id)

        for candidate in accepted:
            if candidate["candidate_type"] in {"ENTITY", "LOCATION", "EVENT"}:
                self._create_fact(investigation, evidence, candidate, resource_ids)
                result["facts_created"] += 1
        evidence.update(processing_status="APPROVED", updated_at=_now())
        extraction["status"] = "APPROVED"
        self._audit(profile, "REVIEW_COMMITTED", evidence, metadata=result)
        self.commits[key] = result
        return deepcopy(result)

    def count_open_conflicts(self, investigation_id: str) -> int:
        evidence_ids = {key for key, item in self.evidence.items() if item["investigation_id"] == investigation_id}
        return sum(
            candidate["candidate_type"] == "CONFLICT" and candidate["review_status"] == "PENDING"
            for evidence_id, extraction in self.extractions.items()
            if evidence_id in evidence_ids
            for candidate in extraction["candidates"]
        )

    def save_report(self, report: dict[str, Any], include: list[str], profile: AuthorizedProfile) -> None:
        self.reports[str(report["id"])] = deepcopy(report) | {"requested_sections": list(include), "generated_by": profile.user_id}


class PostgresEvidenceRepository(EvidenceRepository):
    def __init__(self, investigations: PostgresInvestigationRepository) -> None:
        self.investigations = investigations

    @staticmethod
    def _item(row: dict[str, Any]) -> dict[str, Any]:
        return dict(row) | {
            "id": row["id"],
            "uploaded_by": row.get("uploaded_by_agent") or str(row["uploaded_by"]),
        }

    def create_evidence(self, investigation_id: str, profile: AuthorizedProfile, payload: dict[str, Any]) -> dict[str, Any]:
        evidence_id = payload.get("id") or uuid4()
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("LOCK TABLE public.evidence_items IN SHARE ROW EXCLUSIVE MODE")
            cursor.execute("SELECT COALESCE(MAX(display_sequence), 0) + 1 AS sequence FROM public.evidence_items")
            sequence = int(cursor.fetchone()["sequence"])
            cursor.execute(
                """INSERT INTO public.evidence_items
                (id, investigation_id, display_sequence, display_id, source_type, original_filename, storage_reference,
                 mime_type, size_bytes, sha256, description, processing_status, uploaded_by, uploaded_by_agent, uploaded_by_name)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'UPLOADED',%s,%s,%s) RETURNING *""",
                (evidence_id, investigation_id, sequence, f"EV-{sequence:06d}", payload["source_type"], payload["original_filename"], payload["storage_reference"], payload["mime_type"], payload["size_bytes"], payload["sha256"], payload.get("description", ""), profile.user_id, profile.agent_id, profile.display_name),
            )
            row = cursor.fetchone()
        self.investigations.record_audit(profile=profile, action="EVIDENCE_UPLOADED", resource_type="evidence", resource_id=str(evidence_id), investigation_id=investigation_id, metadata={"displayId": row["display_id"], "mimeType": row["mime_type"], "sizeBytes": row["size_bytes"]})
        return self._item(row)

    def list_evidence(self, investigation_id: str) -> list[dict[str, Any]]:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.evidence_items WHERE investigation_id=%s ORDER BY uploaded_at DESC", (investigation_id,))
            return [self._item(row) for row in cursor.fetchall()]

    def get_evidence(self, evidence_id: UUID) -> dict[str, Any] | None:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.evidence_items WHERE id=%s", (evidence_id,))
            row = cursor.fetchone()
        return self._item(row) if row else None

    def set_processing(self, evidence_id: UUID, status: str, failure_reason: str | None = None) -> None:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("UPDATE public.evidence_items SET processing_status=%s, failure_reason=%s, updated_at=NOW() WHERE id=%s", (status, failure_reason, evidence_id))

    def save_extraction(self, evidence_id: UUID, result: dict[str, Any], provider: str, model: str, derived_content: str, locator_kind: str) -> dict[str, Any]:
        extraction_id = uuid4()
        now = _now()
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM public.extraction_candidates c JOIN public.evidence_extractions e ON e.id=c.extraction_id WHERE e.evidence_id=%s AND c.review_status <> 'PENDING' LIMIT 1", (evidence_id,))
            if cursor.fetchone():
                raise ValueError("Reviewed extraction cannot be replaced")
            cursor.execute("DELETE FROM public.evidence_extractions WHERE evidence_id=%s", (evidence_id,))
            cursor.execute("DELETE FROM public.potential_conflicts WHERE evidence_id=%s", (evidence_id,))
            cursor.execute("INSERT INTO public.evidence_extractions (id,evidence_id,status,raw_extraction_json,derived_content,derived_locator_kind,model_provider,model_identifier,completed_at) VALUES (%s,%s,'PENDING_REVIEW',%s,%s,%s,%s,%s,NOW())", (extraction_id, evidence_id, Jsonb(result), derived_content, locator_kind, provider, model))
            groups = (("entities", "ENTITY"), ("locations", "LOCATION"), ("events", "EVENT"), ("datesTimes", "DATE_TIME"), ("relationships", "RELATIONSHIP"), ("potentialConflicts", "CONFLICT"))
            for field, candidate_type in groups:
                for item in result.get(field, []):
                    candidate_id = uuid4()
                    cursor.execute("INSERT INTO public.extraction_candidates (id,extraction_id,candidate_type,candidate_payload) VALUES (%s,%s,%s,%s)", (candidate_id, extraction_id, candidate_type, Jsonb(item)))
                    if candidate_type == "CONFLICT":
                        cursor.execute(
                            """INSERT INTO public.potential_conflicts
                            (investigation_id,evidence_id,conflict_type,payload)
                            SELECT investigation_id,id,%s,%s FROM public.evidence_items WHERE id=%s""",
                            (item.get("conflictType", "SOURCE_DISAGREEMENT"), Jsonb(item | {"candidateId": str(candidate_id)}), evidence_id),
                        )
            cursor.execute("UPDATE public.evidence_items SET processing_status='PENDING_REVIEW', extraction_counts=%s, updated_at=NOW() WHERE id=%s", (Jsonb({field: len(result.get(field, [])) for field, _ in groups}), evidence_id))
        return self.get_extraction(evidence_id) or {}

    def get_extraction(self, evidence_id: UUID) -> dict[str, Any] | None:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.evidence_extractions WHERE evidence_id=%s ORDER BY created_at DESC LIMIT 1", (evidence_id,))
            extraction = cursor.fetchone()
            if not extraction:
                return None
            cursor.execute("SELECT * FROM public.extraction_candidates WHERE extraction_id=%s ORDER BY created_at,id", (extraction["id"],))
            candidates = list(cursor.fetchall())
        return {"id": extraction["id"], "evidence_id": evidence_id, "status": extraction["status"], "provider": extraction["model_provider"], "model_identifier": extraction["model_identifier"], "candidates": candidates, "counts": _counts(candidates), "created_at": extraction["created_at"], "completed_at": extraction["completed_at"], "failure_reason": extraction["failure_reason"]}

    def review_candidate(self, evidence_id: UUID, candidate_id: UUID, payload: dict[str, Any], profile: AuthorizedProfile) -> dict[str, Any] | None:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT processing_status FROM public.evidence_items WHERE id=%s FOR UPDATE",
                (evidence_id,),
            )
            evidence_status = cursor.fetchone()
            if evidence_status and evidence_status["processing_status"] == "APPROVED":
                raise ValueError("Committed evidence cannot be reviewed again")
            cursor.execute("SELECT c.* FROM public.extraction_candidates c JOIN public.evidence_extractions e ON e.id=c.extraction_id WHERE c.id=%s AND e.evidence_id=%s", (candidate_id, evidence_id))
            existing = cursor.fetchone()
            if not existing:
                return None
            next_payload = payload.get("candidate_payload") if payload["review_status"] == "EDITED_ACCEPTED" else existing["candidate_payload"]
            if not isinstance(next_payload, dict):
                raise ValueError("Edited candidates require a complete candidate payload")
            cursor.execute("UPDATE public.extraction_candidates SET review_status=%s,candidate_payload=%s,reviewed_by=%s,reviewed_at=NOW() WHERE id=%s RETURNING *", (payload["review_status"], Jsonb(next_payload), profile.user_id, candidate_id))
            candidate = cursor.fetchone()
            if candidate["candidate_type"] == "CONFLICT":
                conflict_status = "DISMISSED" if payload["review_status"] == "REJECTED" else "REVIEWED"
                cursor.execute(
                    """UPDATE public.potential_conflicts SET status=%s,reviewed_by=%s,reviewed_at=NOW()
                    WHERE evidence_id=%s AND payload->>'candidateId'=%s""",
                    (conflict_status, profile.user_id, evidence_id, str(candidate_id)),
                )
            duplicate = next_payload.get("possibleDuplicate") or {}
            if duplicate.get("resolutionStatus") in {"MERGE", "CREATE_SEPARATE"}:
                cursor.execute(
                    """INSERT INTO public.entity_resolution_reviews
                    (candidate_id,existing_entity_id,decision,reviewed_by)
                    VALUES (%s,%s,%s,%s)
                    ON CONFLICT (candidate_id) DO UPDATE SET decision=EXCLUDED.decision,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=NOW()""",
                    (candidate_id, duplicate.get("existingEntityId"), duplicate["resolutionStatus"], profile.user_id),
                )
            cursor.execute("SELECT COUNT(*) AS count FROM public.extraction_candidates WHERE extraction_id=%s AND review_status='PENDING'", (existing["extraction_id"],))
            status = "PENDING_REVIEW" if cursor.fetchone()["count"] else "PARTIALLY_REVIEWED"
            cursor.execute("UPDATE public.evidence_extractions SET status=%s WHERE id=%s", (status, existing["extraction_id"]))
            cursor.execute("UPDATE public.evidence_items SET processing_status=%s,updated_at=NOW() WHERE id=%s", (status, evidence_id))
        evidence = self.get_evidence(evidence_id)
        assert evidence
        self.investigations.record_audit(profile=profile, action="EXTRACTION_REVIEWED", resource_type="extraction_candidate", resource_id=str(candidate_id), investigation_id=evidence["investigation_id"], metadata={"evidenceId": str(evidence_id), "reviewStatus": payload["review_status"]})
        return candidate

    def commit(self, evidence_id: UUID, profile: AuthorizedProfile) -> dict[str, Any]:
        # Postgres commit uses one transaction and the same canonical investigation tables.
        evidence = self.get_evidence(evidence_id)
        extraction = self.get_extraction(evidence_id)
        if not evidence or not extraction:
            raise ValueError("No extraction is available to commit")
        if evidence["processing_status"] == "APPROVED":
            return {"evidence_id": str(evidence_id), "already_committed": True, "entities_created": 0, "entities_merged": 0, "locations_created": 0, "events_created": 0, "relationships_created": 0, "facts_created": 0}
        if any(item["review_status"] == "PENDING" for item in extraction["candidates"]):
            raise ValueError("Every extraction candidate must be reviewed before commit")
        accepted = [item for item in extraction["candidates"] if item["review_status"] in {"ACCEPTED", "EDITED_ACCEPTED"}]
        unresolved = [item for item in accepted if item["candidate_type"] == "ENTITY" and (item["candidate_payload"].get("possibleDuplicate") or {}).get("resolutionStatus") == "PENDING"]
        if unresolved:
            raise ValueError("Possible duplicate entities require an explicit merge or keep-separate decision")
        result = {"evidence_id": str(evidence_id), "already_committed": False, "entities_created": 0, "entities_merged": 0, "locations_created": 0, "events_created": 0, "relationships_created": 0, "facts_created": 0}
        resource_ids: dict[str, str] = {}
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.evidence_items WHERE id=%s FOR UPDATE", (evidence_id,))
            locked_evidence = cursor.fetchone()
            if not locked_evidence:
                raise ValueError("Evidence item is no longer available")
            if locked_evidence["processing_status"] == "APPROVED":
                return {"evidence_id": str(evidence_id), "already_committed": True, "entities_created": 0, "entities_merged": 0, "locations_created": 0, "events_created": 0, "relationships_created": 0, "facts_created": 0}
            evidence = self._item(locked_evidence)
            cursor.execute(
                "SELECT * FROM public.evidence_extractions WHERE evidence_id=%s ORDER BY created_at DESC LIMIT 1",
                (evidence_id,),
            )
            locked_extraction = cursor.fetchone()
            if not locked_extraction:
                raise ValueError("No extraction is available to commit")
            cursor.execute(
                "SELECT * FROM public.extraction_candidates WHERE extraction_id=%s ORDER BY created_at,id",
                (locked_extraction["id"],),
            )
            candidates = list(cursor.fetchall())
            if any(item["review_status"] == "PENDING" for item in candidates):
                raise ValueError("Every extraction candidate must be reviewed before commit")
            accepted = [item for item in candidates if item["review_status"] in {"ACCEPTED", "EDITED_ACCEPTED"}]
            unresolved = [item for item in accepted if item["candidate_type"] == "ENTITY" and (item["candidate_payload"].get("possibleDuplicate") or {}).get("resolutionStatus") == "PENDING"]
            if unresolved:
                raise ValueError("Possible duplicate entities require an explicit merge or keep-separate decision")
            cursor.execute("SELECT metadata FROM public.investigations WHERE id=%s", (evidence["investigation_id"],))
            investigation_meta = cursor.fetchone()["metadata"]
            committed_event_dates: list[str] = []
            created_location = False
            for candidate in accepted:
                payload = candidate["candidate_payload"]
                cid = str(candidate["id"])
                ref = _source_ref(evidence, payload)
                if candidate["candidate_type"] == "ENTITY":
                    duplicate = payload.get("possibleDuplicate") or {}
                    if duplicate.get("resolutionStatus") == "MERGE":
                        resource_id = duplicate["existingEntityId"]
                        result["entities_merged"] += 1
                    else:
                        resource_id = f"entity-{evidence['display_id'].lower()}-{cid[:8]}"
                        metadata = {"investigationId": evidence["investigation_id"], "id": resource_id, "label": payload.get("label", "Unnamed candidate"), "kind": "evidence", "subtitle": f"REVIEWED / {evidence['display_id']}", "status": "REVIEWED", "position": {"x": 180, "y": 180}, "sourceRef": ref, "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED", "sourceEvidenceId": str(evidence_id), "sourceLocator": payload.get("sourceLocator")}
                        cursor.execute("INSERT INTO public.investigation_entities (investigation_id,id,entity_type,name,status,description,source_ref,source_evidence_id,source_locator,metadata) VALUES (%s,%s,%s,%s,'REVIEWED',%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING", (evidence["investigation_id"], resource_id, payload.get("type", "OTHER"), payload.get("label", "Unnamed candidate"), payload.get("sourceText", ""), ref, evidence_id, Jsonb(payload.get("sourceLocator")), Jsonb(metadata)))
                        result["entities_created"] += cursor.rowcount
                    resource_ids[cid] = resource_id
                    cursor.execute("UPDATE public.extraction_candidates SET created_resource_type='entity',created_resource_id=%s WHERE id=%s", (resource_id, candidate["id"]))
                elif candidate["candidate_type"] == "LOCATION":
                    resource_id = f"location-{evidence['display_id'].lower()}-{cid[:8]}"
                    metadata = {"investigationId": evidence["investigation_id"], "id": resource_id, "title": payload.get("label", "Unresolved location"), "type": "EVIDENCE LOCATION", "filterGroups": ["EVIDENCE"], "date": evidence["uploaded_at"].date().isoformat(), "timeLabel": "UNRESOLVED", "importance": "MED", "coordinateStatus": "NEEDS_VERIFICATION", "intensity": 1, "description": payload.get("sourceText", "Reviewed location candidate"), "linkedEntityIds": [], "linkedTimelineEventIds": [], "sourceRef": ref, "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED", "sourceEvidenceId": str(evidence_id), "sourceLocator": payload.get("sourceLocator")}
                    cursor.execute("INSERT INTO public.investigation_locations (investigation_id,id,name,location_type,coordinate_status,description,importance,filter_groups,source_ref,source_evidence_id,source_locator,metadata) VALUES (%s,%s,%s,'EVIDENCE LOCATION','NEEDS_VERIFICATION',%s,'MED',ARRAY['EVIDENCE'],%s,%s,%s,%s) ON CONFLICT DO NOTHING", (evidence["investigation_id"], resource_id, payload.get("label", "Unresolved location"), payload.get("sourceText", ""), ref, evidence_id, Jsonb(payload.get("sourceLocator")), Jsonb(metadata)))
                    result["locations_created"] += cursor.rowcount
                    created_location = True
                    resource_ids[cid] = resource_id
                    cursor.execute("UPDATE public.extraction_candidates SET created_resource_type='location',created_resource_id=%s WHERE id=%s", (resource_id, candidate["id"]))
                elif candidate["candidate_type"] == "EVENT":
                    resource_id = f"event-{evidence['display_id'].lower()}-{cid[:8]}"
                    event_date, event_time = payload.get("date") or evidence["uploaded_at"].date().isoformat(), payload.get("time") or "00:00"
                    if not re.match(r"^\d{2}:\d{2}", event_time): event_time = "00:00"
                    timestamp = f"{event_date}T{event_time}:00" if len(event_time) == 5 else f"{event_date}T{event_time}"
                    metadata = {"investigationId": evidence["investigation_id"], "id": resource_id, "date": event_date, "time": ("≈ " if payload.get("timePrecision") == "APPROX" else "") + (payload.get("time") or "DATE ONLY"), "sortOrder": 9999, "timezone": investigation_meta["timezone"], "category": "EVIDENCE", "title": payload.get("title", "Reviewed evidence event"), "description": payload.get("description", ""), "severity": 2, "linkedEntityIds": [], "linkedLocationIds": [], "sourceRef": ref, "timePrecision": payload.get("timePrecision", "DATE"), "confidence": "VERIFIED", "sourceEvidenceId": str(evidence_id), "sourceLocator": payload.get("sourceLocator")}
                    cursor.execute("INSERT INTO public.timeline_events (investigation_id,id,event_type,title,description,event_time,time_precision,timezone,source_ref,confidence,sort_order,source_evidence_id,source_locator,metadata) VALUES (%s,%s,'EVIDENCE',%s,%s,%s,%s,%s,%s,'VERIFIED',9999,%s,%s,%s) ON CONFLICT DO NOTHING", (evidence["investigation_id"], resource_id, metadata["title"], metadata["description"], timestamp, metadata["timePrecision"], metadata["timezone"], ref, evidence_id, Jsonb(payload.get("sourceLocator")), Jsonb(metadata)))
                    result["events_created"] += cursor.rowcount
                    committed_event_dates.append(event_date)
                    resource_ids[cid] = resource_id
                    cursor.execute("UPDATE public.extraction_candidates SET created_resource_type='event',created_resource_id=%s WHERE id=%s", (resource_id, candidate["id"]))
            if committed_event_dates or created_location:
                updated_metadata = deepcopy(investigation_meta)
                if committed_event_dates:
                    timeline_config = updated_metadata["timelineConfig"]
                    timeline_config["startDate"] = min(timeline_config["startDate"], *committed_event_dates)
                    timeline_config["endDate"] = max(timeline_config["endDate"], *committed_event_dates)
                if created_location and "EVIDENCE" not in updated_metadata["mapConfig"]["filterGroups"]:
                    updated_metadata["mapConfig"]["filterGroups"].append("EVIDENCE")
                cursor.execute("UPDATE public.investigations SET metadata=%s,updated_at=NOW() WHERE id=%s", (Jsonb(updated_metadata), evidence["investigation_id"]))
            temp_map = {item["candidate_payload"].get("temporaryId"): resource_ids.get(str(item["id"])) for item in accepted}
            for candidate in accepted:
                if candidate["candidate_type"] != "RELATIONSHIP": continue
                payload, cid = candidate["candidate_payload"], str(candidate["id"])
                source, target = temp_map.get(payload.get("sourceCandidateId")), temp_map.get(payload.get("targetCandidateId"))
                if not source or not target: continue
                resource_id = f"relationship-{evidence['display_id'].lower()}-{cid[:8]}"
                ref = _source_ref(evidence, payload)
                metadata = {"investigationId": evidence["investigation_id"], "id": resource_id, "source": source, "target": target, "linkKind": "evidence", "label": payload.get("relationshipType", "ASSOCIATED_WITH").replace("_", " "), "sourceRef": ref, "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED", "sourceEvidenceId": str(evidence_id), "sourceLocator": payload.get("sourceLocator")}
                cursor.execute("INSERT INTO public.investigation_relationships (investigation_id,id,source_entity_id,target_entity_id,relationship_type,label,confidence,source_ref,source_evidence_id,source_locator,metadata) VALUES (%s,%s,%s,%s,'evidence',%s,'VERIFIED',%s,%s,%s,%s) ON CONFLICT DO NOTHING", (evidence["investigation_id"], resource_id, source, target, metadata["label"], ref, evidence_id, Jsonb(payload.get("sourceLocator")), Jsonb(metadata)))
                result["relationships_created"] += cursor.rowcount
                cursor.execute("UPDATE public.extraction_candidates SET created_resource_type='relationship',created_resource_id=%s WHERE id=%s", (resource_id, candidate["id"]))
            for candidate in accepted:
                if candidate["candidate_type"] not in {"ENTITY", "LOCATION", "EVENT"}: continue
                payload, cid = candidate["candidate_payload"], str(candidate["id"])
                fact_id, ref = f"fact-{evidence['display_id'].lower()}-{cid[:8]}", _source_ref(evidence, payload)
                metadata = {"investigationId": evidence["investigation_id"], "id": fact_id, "type": "investigative", "text": payload.get("sourceText") or payload.get("description") or payload.get("label") or payload.get("title") or "Reviewed extraction candidate", "status": "verified", "sourceTitle": evidence["original_filename"], "linkedEntityIds": [resource_ids[cid]] if candidate["candidate_type"] == "ENTITY" and cid in resource_ids else [], "linkedTimelineEventIds": [resource_ids[cid]] if candidate["candidate_type"] == "EVENT" and cid in resource_ids else [], "linkedLocationIds": [resource_ids[cid]] if candidate["candidate_type"] == "LOCATION" and cid in resource_ids else [], "sourceRef": ref, "timePrecision": "NOT_APPLICABLE", "confidence": "VERIFIED", "sourceEvidenceId": str(evidence_id), "sourceLocator": payload.get("sourceLocator")}
                cursor.execute("INSERT INTO public.evidence_facts (investigation_id,id,fact_type,statement,verification_status,source_title,source_ref,confidence,source_evidence_id,source_locator,reviewed_by,reviewed_at,metadata) VALUES (%s,%s,'investigative',%s,'VERIFIED',%s,%s,'VERIFIED',%s,%s,%s,NOW(),%s) ON CONFLICT DO NOTHING", (evidence["investigation_id"], fact_id, metadata["text"], evidence["original_filename"], ref, evidence_id, Jsonb(payload.get("sourceLocator")), profile.user_id, Jsonb(metadata)))
                result["facts_created"] += cursor.rowcount
                resource_id = resource_ids.get(cid)
                if candidate["candidate_type"] == "ENTITY" and resource_id:
                    cursor.execute(
                        "INSERT INTO public.evidence_fact_entities (investigation_id,fact_id,entity_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (evidence["investigation_id"], fact_id, resource_id),
                    )
                elif candidate["candidate_type"] == "LOCATION" and resource_id:
                    cursor.execute(
                        "INSERT INTO public.evidence_fact_locations (investigation_id,fact_id,location_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (evidence["investigation_id"], fact_id, resource_id),
                    )
                elif candidate["candidate_type"] == "EVENT" and resource_id:
                    cursor.execute(
                        "INSERT INTO public.evidence_fact_events (investigation_id,fact_id,event_id) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (evidence["investigation_id"], fact_id, resource_id),
                    )
            cursor.execute("UPDATE public.evidence_items SET processing_status='APPROVED',updated_at=NOW() WHERE id=%s", (evidence_id,))
            cursor.execute("UPDATE public.evidence_extractions SET status='APPROVED' WHERE evidence_id=%s", (evidence_id,))
        for candidate in accepted:
            resource_id = resource_ids.get(str(candidate["id"]))
            if not resource_id:
                continue
            if candidate["candidate_type"] == "ENTITY":
                duplicate = candidate["candidate_payload"].get("possibleDuplicate") or {}
                action = "ENTITY_MERGED" if duplicate.get("resolutionStatus") == "MERGE" else "ENTITY_CREATED"
            elif candidate["candidate_type"] == "EVENT":
                action = "EVENT_CREATED"
            elif candidate["candidate_type"] == "RELATIONSHIP":
                action = "RELATIONSHIP_CREATED"
            else:
                continue
            self.investigations.record_audit(profile=profile, action=action, resource_type=candidate["candidate_type"].lower(), resource_id=resource_id, investigation_id=evidence["investigation_id"], metadata={"evidenceId": str(evidence_id)})
        self.investigations.record_audit(profile=profile, action="REVIEW_COMMITTED", resource_type="evidence", resource_id=str(evidence_id), investigation_id=evidence["investigation_id"], metadata={"evidenceId": str(evidence_id), **result})
        return result

    def count_open_conflicts(self, investigation_id: str) -> int:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS count FROM public.potential_conflicts WHERE investigation_id=%s AND status='PENDING'",
                (investigation_id,),
            )
            return int(cursor.fetchone()["count"])

    def save_report(self, report: dict[str, Any], include: list[str], profile: AuthorizedProfile) -> None:
        with self.investigations._connect() as connection, connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO public.case_report_drafts
                (id,investigation_id,status,title,content,requested_sections,generated_by,created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (report["id"], report["investigation_id"], report["status"], report["title"], report["content"], Jsonb(include), profile.user_id, report["created_at"]),
            )


def build_evidence_repository(repository: InvestigationRepository) -> EvidenceRepository:
    if isinstance(repository, PostgresInvestigationRepository):
        return PostgresEvidenceRepository(repository)
    if isinstance(repository, MemoryInvestigationRepository):
        return MemoryEvidenceRepository(repository)
    raise TypeError("The configured investigation repository cannot store evidence")
