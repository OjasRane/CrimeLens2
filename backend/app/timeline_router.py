from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Literal, Union

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field


AVERAGE_CITY_SPEED_KMH = 40.0
BLIND_SPOT_THRESHOLD = timedelta(minutes=15)
EARTH_RADIUS_KM = 6_371.0088

router = APIRouter(prefix="/api/v1/intel", tags=["investigation-intelligence"])


# Mock CCTV database: cameras are distributed across Pune and its outskirts.
MOCK_CCTV_CAMERAS: list[dict[str, str | float]] = [
    {"id": "CAM-T42", "lat": 18.6250, "lon": 73.8120},
    {"id": "CAM-S11", "lat": 18.5204, "lon": 73.8567},
    {"id": "CAM-K07", "lat": 18.5362, "lon": 73.8939},
    {"id": "CAM-R19", "lat": 18.5089, "lon": 73.9259},
    {"id": "CAM-P33", "lat": 18.5679, "lon": 73.9143},
    {"id": "CAM-H04", "lat": 18.5913, "lon": 73.7389},
    {"id": "CAM-B28", "lat": 18.5590, "lon": 73.7868},
    {"id": "CAM-V15", "lat": 18.4636, "lon": 73.8676},
    {"id": "CAM-D51", "lat": 18.4477, "lon": 73.8585},
    {"id": "CAM-N09", "lat": 18.6466, "lon": 73.7669},
]


# Mock temporal-event database. The 27-minute gap after EVT-002 produces a
# blind spot; the final 15-minute gap does not because the threshold is strict.
MOCK_TEMPORAL_EVENTS: list[dict[str, str | float | datetime]] = [
    {
        "id": "EVT-001",
        "suspect_id": "SUSPECT-001",
        "type": "EVENT",
        "timestamp": datetime(2026, 8, 12, 9, 5, tzinfo=timezone.utc),
        "location": "Shivajinagar Transit Gate",
        "lat": 18.5308,
        "lon": 73.8475,
    },
    {
        "id": "EVT-002",
        "suspect_id": "SUSPECT-001",
        "type": "EVENT",
        "timestamp": datetime(2026, 8, 12, 9, 17, tzinfo=timezone.utc),
        "location": "Central Evidence Annex",
        "lat": 18.5204,
        "lon": 73.8567,
    },
    {
        "id": "EVT-003",
        "suspect_id": "SUSPECT-001",
        "type": "EVENT",
        "timestamp": datetime(2026, 8, 12, 9, 44, tzinfo=timezone.utc),
        "location": "Hadapsar Toll Camera",
        "lat": 18.5089,
        "lon": 73.9259,
    },
    {
        "id": "EVT-004",
        "suspect_id": "SUSPECT-001",
        "type": "EVENT",
        "timestamp": datetime(2026, 8, 12, 9, 59, tzinfo=timezone.utc),
        "location": "Magarpatta Access Road",
        "lat": 18.5167,
        "lon": 73.9272,
    },
]


class CameraIntersection(BaseModel):
    id: str
    lat: float
    lon: float
    distance_km: float = Field(ge=0)


class TimelineEvent(BaseModel):
    id: str
    suspect_id: str
    type: Literal["EVENT"]
    timestamp: datetime
    location: str
    lat: float
    lon: float


class BlindSpot(BaseModel):
    id: str
    suspect_id: str
    type: Literal["BLIND_SPOT"]
    timestamp: datetime
    start_time: datetime
    end_time: datetime
    duration_minutes: float = Field(gt=15)
    max_travel_radius_km: float = Field(gt=0)
    origin_lat: float
    origin_lon: float
    intersecting_nodes: list[CameraIntersection]


TimelineItem = Union[TimelineEvent, BlindSpot]


def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Return the great-circle distance in kilometres between two points."""
    lat1_rad, lon1_rad, lat2_rad, lon2_rad = map(
        radians,
        (lat1, lon1, lat2, lon2),
    )
    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad

    haversine_value = (
        sin(delta_lat / 2) ** 2
        + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    )
    # Floating-point rounding can move the value just outside [0, 1].
    central_angle = 2 * asin(sqrt(min(1.0, max(0.0, haversine_value))))
    return EARTH_RADIUS_KM * central_angle


@router.get(
    "/timeline/{suspect_id}",
    response_model=list[TimelineItem],
    summary="Detect chronological blind spots in a suspect timeline",
)
def get_investigation_timeline(suspect_id: str) -> list[TimelineItem]:
    events = sorted(
        (
            TimelineEvent.model_validate(event)
            for event in MOCK_TEMPORAL_EVENTS
            if event["suspect_id"] == suspect_id
        ),
        key=lambda event: event.timestamp,
    )

    if not events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No timeline events found for suspect '{suspect_id}'",
        )

    combined_timeline: list[TimelineItem] = []

    for index, current_event in enumerate(events):
        combined_timeline.append(current_event)

        if index == len(events) - 1:
            continue

        next_event = events[index + 1]
        gap = next_event.timestamp - current_event.timestamp

        if gap <= BLIND_SPOT_THRESHOLD:
            continue

        gap_minutes = gap.total_seconds() / 60.0
        max_travel_radius_km = (gap_minutes / 60.0) * AVERAGE_CITY_SPEED_KMH
        intersecting_nodes: list[CameraIntersection] = []

        for camera in MOCK_CCTV_CAMERAS:
            distance_km = haversine_distance_km(
                current_event.lat,
                current_event.lon,
                float(camera["lat"]),
                float(camera["lon"]),
            )
            if distance_km <= max_travel_radius_km:
                intersecting_nodes.append(
                    CameraIntersection(
                        id=str(camera["id"]),
                        lat=float(camera["lat"]),
                        lon=float(camera["lon"]),
                        distance_km=round(distance_km, 3),
                    )
                )

        combined_timeline.append(
            BlindSpot(
                id=f"BLIND-{current_event.id}-{next_event.id}",
                suspect_id=suspect_id,
                type="BLIND_SPOT",
                timestamp=current_event.timestamp,
                start_time=current_event.timestamp,
                end_time=next_event.timestamp,
                duration_minutes=round(gap_minutes, 2),
                max_travel_radius_km=round(max_travel_radius_km, 2),
                origin_lat=current_event.lat,
                origin_lon=current_event.lon,
                intersecting_nodes=intersecting_nodes,
            )
        )

    return combined_timeline
