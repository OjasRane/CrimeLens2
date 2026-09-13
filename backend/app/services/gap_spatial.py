from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from math import asin, atan2, cos, degrees, isfinite, radians, sin, sqrt


EARTH_RADIUS_KM = 6_371.0088
MAX_SPEED_KMH = 400.0
MAX_INTERVAL_HOURS = 72.0


@dataclass(frozen=True)
class GeoPoint:
    latitude: float
    longitude: float


@dataclass(frozen=True)
class ReachabilityRegion:
    at: datetime
    forward_radius_km: float
    backward_radius_km: float
    feasible: bool
    reason: str


@dataclass(frozen=True)
class CameraFeasibility:
    included: bool
    reason: str
    distance_from_start_km: float
    distance_to_end_km: float
    earliest_arrival: datetime | None
    latest_departure: datetime | None


def validate_point(point: GeoPoint) -> None:
    if not isfinite(point.latitude) or not isfinite(point.longitude):
        raise ValueError("Coordinates must be finite")
    if not -90 <= point.latitude <= 90 or not -180 <= point.longitude <= 180:
        raise ValueError("Coordinates are outside valid latitude/longitude ranges")


def validate_inputs(start: GeoPoint, end: GeoPoint, start_time: datetime, end_time: datetime, speed_kmh: float) -> None:
    validate_point(start)
    validate_point(end)
    if not isfinite(speed_kmh) or not 0 < speed_kmh <= MAX_SPEED_KMH:
        raise ValueError(f"Speed must be greater than 0 and at most {MAX_SPEED_KMH:g} km/h")
    if start_time.tzinfo is None or end_time.tzinfo is None:
        raise ValueError("Timestamps must include timezone offsets")
    elapsed = (end_time - start_time).total_seconds() / 3600
    if elapsed <= 0:
        raise ValueError("End time must be after start time")
    if elapsed > MAX_INTERVAL_HOURS:
        raise ValueError(f"Analysis interval cannot exceed {MAX_INTERVAL_HOURS:g} hours")


def haversine_distance_km(a: GeoPoint, b: GeoPoint) -> float:
    validate_point(a)
    validate_point(b)
    lat1, lon1, lat2, lon2 = map(radians, (a.latitude, a.longitude, b.latitude, b.longitude))
    delta_lat = lat2 - lat1
    delta_lon = lon2 - lon1
    value = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * asin(sqrt(min(1.0, max(0.0, value))))


def assess_camera(start: GeoPoint, end: GeoPoint, camera: GeoPoint, start_time: datetime, end_time: datetime, speed_kmh: float) -> CameraFeasibility:
    validate_inputs(start, end, start_time, end_time, speed_kmh)
    validate_point(camera)
    distance_a = haversine_distance_km(start, camera)
    distance_b = haversine_distance_km(camera, end)
    budget = speed_kmh * (end_time - start_time).total_seconds() / 3600
    earliest = start_time + timedelta(hours=distance_a / speed_kmh)
    latest = end_time - timedelta(hours=distance_b / speed_kmh)
    included = distance_a + distance_b <= budget + 1e-9 and earliest <= latest
    return CameraFeasibility(
        included=included,
        reason=(
            "Camera satisfies the straight-line travel-budget condition; review window is geometrically feasible."
            if included
            else "Camera is outside the straight-line travel budget or has an empty feasible review window."
        ),
        distance_from_start_km=distance_a,
        distance_to_end_km=distance_b,
        earliest_arrival=earliest if included else None,
        latest_departure=latest if included else None,
    )


def region_at(start: GeoPoint, end: GeoPoint, start_time: datetime, end_time: datetime, speed_kmh: float, at: datetime) -> ReachabilityRegion:
    validate_inputs(start, end, start_time, end_time, speed_kmh)
    if at.tzinfo is None or not start_time <= at <= end_time:
        raise ValueError("Intermediate time must be timezone-aware and within the observation interval")
    forward = speed_kmh * (at - start_time).total_seconds() / 3600
    backward = speed_kmh * (end_time - at).total_seconds() / 3600
    separation = haversine_distance_km(start, end)
    feasible = separation <= forward + backward + 1e-9
    return ReachabilityRegion(
        at=at,
        forward_radius_km=forward,
        backward_radius_km=backward,
        feasible=feasible,
        reason=("Forward and backward geodesic disks overlap." if feasible else "The selected speed cannot connect the observations; the disk intersection is empty."),
    )


def geodesic_circle(center: GeoPoint, radius_km: float, vertices: int = 96) -> list[list[float]]:
    """Return a closed GeoJSON ring as [longitude, latitude] pairs."""
    validate_point(center)
    if not isfinite(radius_km) or radius_km < 0 or vertices < 12 or vertices > 360:
        raise ValueError("Invalid geodesic circle parameters")
    angular = radius_km / EARTH_RADIUS_KM
    lat1 = radians(center.latitude)
    lon1 = radians(center.longitude)
    ring: list[list[float]] = []
    for index in range(vertices + 1):
        bearing = radians(index * 360 / vertices)
        lat2 = asin(sin(lat1) * cos(angular) + cos(lat1) * sin(angular) * cos(bearing))
        lon2 = lon1 + atan2(sin(bearing) * sin(angular) * cos(lat1), cos(angular) - sin(lat1) * sin(lat2))
        ring.append([((degrees(lon2) + 540) % 360) - 180, degrees(lat2)])
    return ring
