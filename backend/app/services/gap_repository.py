from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


class GapRepository:
    def list_cameras(self, investigation_id: str) -> list[dict[str, Any]]: raise NotImplementedError
    def create_camera(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]: raise NotImplementedError
    def update_camera(self, investigation_id: str, camera_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None: raise NotImplementedError
    def save_run(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]: raise NotImplementedError
    def list_runs(self, investigation_id: str) -> list[dict[str, Any]]: raise NotImplementedError
    def get_run(self, investigation_id: str, run_id: UUID) -> dict[str, Any] | None: raise NotImplementedError
    def update_review(self, investigation_id: str, run_id: UUID, camera_id: UUID, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None: raise NotImplementedError


class MemoryGapRepository(GapRepository):
    def __init__(self) -> None:
        self.cameras: dict[str, dict[str, Any]] = {}
        self.runs: dict[str, dict[str, Any]] = {}
        self.reviews: dict[tuple[str, str], dict[str, Any]] = {}

    def list_cameras(self, investigation_id: str) -> list[dict[str, Any]]:
        return deepcopy([item for item in self.cameras.values() if item["investigationId"] == investigation_id])

    def create_camera(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc)
        camera = {**deepcopy(payload), "id": str(uuid4()), "investigationId": investigation_id, "createdAt": now, "updatedAt": now}
        self.cameras[camera["id"]] = camera
        return deepcopy(camera)

    def update_camera(self, investigation_id: str, camera_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None:
        existing = self.cameras.get(str(camera_id))
        if not existing or existing["investigationId"] != investigation_id: return None
        existing.update(deepcopy(payload)); existing["updatedAt"] = datetime.now(timezone.utc)
        return deepcopy(existing)

    def save_run(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        run = {**deepcopy(payload), "id": str(uuid4()), "investigatorUserId": str(actor_id), "createdAt": datetime.now(timezone.utc), "reviews": []}
        self.runs[run["id"]] = run
        return deepcopy(run)

    def list_runs(self, investigation_id: str) -> list[dict[str, Any]]:
        return deepcopy([run for run in self.runs.values() if run["investigationId"] == investigation_id])

    def get_run(self, investigation_id: str, run_id: UUID) -> dict[str, Any] | None:
        run = self.runs.get(str(run_id))
        if not run or run["investigationId"] != investigation_id: return None
        result = deepcopy(run)
        result["reviews"] = deepcopy([review for (saved_run, _), review in self.reviews.items() if saved_run == str(run_id)])
        return result

    def update_review(self, investigation_id: str, run_id: UUID, camera_id: UUID, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None:
        run = self.get_run(investigation_id, run_id)
        if not run or str(camera_id) not in {item["camera"]["id"] for item in run["candidates"]}: return None
        review = {"runId": str(run_id), "cameraId": str(camera_id), "investigationId": investigation_id, **deepcopy(payload), "reviewedBy": str(actor_id), "updatedAt": datetime.now(timezone.utc)}
        self.reviews[(str(run_id), str(camera_id))] = review
        return deepcopy(review)


class PostgresGapRepository(GapRepository):
    def __init__(self, database_url: str) -> None: self.database_url = database_url
    def _connect(self): return psycopg.connect(self.database_url, row_factory=dict_row)

    @staticmethod
    def _camera(row: dict[str, Any]) -> dict[str, Any]:
        return {"id": str(row["id"]), "investigationId": row["investigation_id"], "label": row["label"], "coordinates": {"latitude": row["latitude"], "longitude": row["longitude"]}, "sourceRef": row["source_ref"], "isSynthetic": row["is_synthetic"], "operationalFrom": row["operational_from"], "operationalTo": row["operational_to"], "recordingAvailability": row["recording_availability"], "retentionInformation": row["retention_information"], "verifiedOrientation": row["verified_orientation"], "createdAt": row["created_at"], "updatedAt": row["updated_at"]}

    def list_cameras(self, investigation_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM public.investigation_cameras WHERE investigation_id=%s ORDER BY label,id", (investigation_id,))
            return [self._camera(row) for row in cursor.fetchall()]

    def create_camera(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        c = payload["coordinates"]
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("""INSERT INTO public.investigation_cameras (investigation_id,label,latitude,longitude,source_ref,is_synthetic,operational_from,operational_to,recording_availability,retention_information,verified_orientation,created_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""", (investigation_id,payload["label"],c["latitude"],c["longitude"],payload["sourceRef"],payload["isSynthetic"],payload.get("operationalFrom"),payload.get("operationalTo"),payload["recordingAvailability"],payload.get("retentionInformation"),Jsonb(payload.get("verifiedOrientation")) if payload.get("verifiedOrientation") is not None else None,actor_id))
            return self._camera(cursor.fetchone())

    def update_camera(self, investigation_id: str, camera_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None:
        columns={"label":"label","sourceRef":"source_ref","isSynthetic":"is_synthetic","recordingAvailability":"recording_availability","retentionInformation":"retention_information","operationalFrom":"operational_from","operationalTo":"operational_to","verifiedOrientation":"verified_orientation"}
        if not payload:
            with self._connect() as connection, connection.cursor() as cursor:
                cursor.execute("SELECT * FROM public.investigation_cameras WHERE investigation_id=%s AND id=%s",(investigation_id,camera_id)); row=cursor.fetchone(); return self._camera(row) if row else None
        assignments=[]; values=[]
        for key,value in payload.items():
            if key == "coordinates":
                assignments.extend(["latitude=%s", "longitude=%s"]); values.extend([value["latitude"], value["longitude"]])
            else:
                assignments.append(f"{columns[key]}=%s"); values.append(Jsonb(value) if key=="verifiedOrientation" and value is not None else value)
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute(f"UPDATE public.investigation_cameras SET {','.join(assignments)},updated_at=NOW() WHERE investigation_id=%s AND id=%s RETURNING *",(*values,investigation_id,camera_id)); row=cursor.fetchone(); return self._camera(row) if row else None

    def save_run(self, investigation_id: str, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any]:
        run_id=uuid4()
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("INSERT INTO public.gap_reconstruction_runs (id,investigation_id,investigator_user_id,entity_id,algorithm_version,input_snapshot,result_snapshot) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING created_at",(run_id,investigation_id,actor_id,payload["inputs"]["entityId"],payload["algorithmVersion"],Jsonb(payload["inputs"]),Jsonb(payload)))
            created=cursor.fetchone()["created_at"]
        return {**payload,"id":str(run_id),"investigatorUserId":str(actor_id),"createdAt":created,"reviews":[]}

    def list_runs(self, investigation_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT id,investigator_user_id,created_at,result_snapshot FROM public.gap_reconstruction_runs WHERE investigation_id=%s ORDER BY created_at DESC",(investigation_id,))
            return [{**row["result_snapshot"],"id":str(row["id"]),"investigatorUserId":str(row["investigator_user_id"]),"createdAt":row["created_at"],"reviews":[]} for row in cursor.fetchall()]

    def get_run(self, investigation_id: str, run_id: UUID) -> dict[str, Any] | None:
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("SELECT investigator_user_id,created_at,result_snapshot FROM public.gap_reconstruction_runs WHERE investigation_id=%s AND id=%s",(investigation_id,run_id)); row=cursor.fetchone()
            if not row: return None
            cursor.execute("SELECT camera_id,status,notes,evidence_id,reviewed_by,updated_at FROM public.gap_camera_reviews WHERE run_id=%s ORDER BY updated_at",(run_id,))
            reviews=[{"runId":str(run_id),"cameraId":str(item["camera_id"]),"investigationId":investigation_id,"status":item["status"],"notes":item["notes"],"evidenceId":str(item["evidence_id"]) if item["evidence_id"] else None,"reviewedBy":str(item["reviewed_by"]),"updatedAt":item["updated_at"]} for item in cursor.fetchall()]
            return {**row["result_snapshot"],"id":str(run_id),"investigatorUserId":str(row["investigator_user_id"]),"createdAt":row["created_at"],"reviews":reviews}

    def update_review(self, investigation_id: str, run_id: UUID, camera_id: UUID, actor_id: UUID, payload: dict[str, Any]) -> dict[str, Any] | None:
        run=self.get_run(investigation_id,run_id)
        if not run or str(camera_id) not in {item["camera"]["id"] for item in run["candidates"]}: return None
        with self._connect() as connection, connection.cursor() as cursor:
            cursor.execute("""INSERT INTO public.gap_camera_reviews (run_id,camera_id,status,notes,evidence_id,reviewed_by) VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (run_id,camera_id) DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,evidence_id=EXCLUDED.evidence_id,reviewed_by=EXCLUDED.reviewed_by,updated_at=NOW() RETURNING updated_at""",(run_id,camera_id,payload["status"],payload["notes"],payload.get("evidenceId"),actor_id)); updated=cursor.fetchone()["updated_at"]
        return {"runId":str(run_id),"cameraId":str(camera_id),"investigationId":investigation_id,**payload,"reviewedBy":str(actor_id),"updatedAt":updated}
