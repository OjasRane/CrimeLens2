from datetime import datetime, timedelta, timezone

import pytest

from backend.app.services.gap_spatial import GeoPoint, assess_camera, geodesic_circle, haversine_distance_km, region_at


def test_haversine_zero_and_known_distance():
    origin = GeoPoint(0, 0)
    assert haversine_distance_km(origin, origin) == 0
    assert haversine_distance_km(origin, GeoPoint(0, 1)) == pytest.approx(111.195, rel=1e-4)


def test_camera_boundary_equality_and_review_window():
    start = GeoPoint(0, 0); end = GeoPoint(0, 0.02); camera = GeoPoint(0, 0.01)
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    distance = haversine_distance_km(start, camera) + haversine_distance_km(camera, end)
    end_time = start_time + timedelta(hours=1)
    result = assess_camera(start, end, camera, start_time, end_time, distance)
    assert result.included
    assert result.earliest_arrival == result.latest_departure


def test_zero_distance_observations_remain_feasible():
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    result = region_at(GeoPoint(12, 77), GeoPoint(12, 77), start_time, start_time + timedelta(hours=1), 5, start_time)
    assert result.feasible
    assert result.forward_radius_km == 0


def test_intermediate_region_empty_for_impossible_speed_and_geodesic_ring():
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc); end_time = start_time + timedelta(hours=1)
    result = region_at(GeoPoint(0, 0), GeoPoint(0, 2), start_time, end_time, 10, start_time + timedelta(minutes=30))
    assert not result.feasible
    ring = geodesic_circle(GeoPoint(80, 170), 10)
    assert ring[0] == pytest.approx(ring[-1])
    assert all(-180 <= longitude <= 180 and -90 <= latitude <= 90 for longitude, latitude in ring)


@pytest.mark.parametrize("point", [GeoPoint(float("nan"), 0), GeoPoint(91, 0), GeoPoint(0, 181)])
def test_invalid_coordinates_are_rejected(point):
    with pytest.raises(ValueError):
        haversine_distance_km(point, GeoPoint(0, 0))


def test_naive_or_reversed_times_are_rejected():
    aware = datetime(2026, 1, 1, tzinfo=timezone.utc)
    with pytest.raises(ValueError): assess_camera(GeoPoint(0, 0), GeoPoint(0, 1), GeoPoint(0, .5), aware, aware, 20)
    with pytest.raises(ValueError): region_at(GeoPoint(0, 0), GeoPoint(0, 1), aware.replace(tzinfo=None), aware + timedelta(hours=1), 20, aware)
