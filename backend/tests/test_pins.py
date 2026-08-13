from unittest import TestCase

from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import main
from backend.app import pins_router


class InvestigationPinValidationTests(TestCase):
    def setUp(self):
        self.profile = pins_router.PinAuthorizedProfile(
            user_id="0db89f00-6d85-45ec-a927-ae911413ece7",
            agent_id="CR-0174",
            display_name="Investigator One",
            role="investigator",
            clearance="LEVEL RED",
            active=True,
        )

    def test_unauthenticated_pin_reads_are_rejected_before_database_access(self):
        response = TestClient(main.app).get("/api/v1/cases/demo/pins")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Supabase bearer token required")

    def test_coordinate_ranges_are_validated(self):
        with self.assertRaises(ValidationError):
            pins_router.PinCreate(
                latitude=91,
                longitude=72.8347,
                title="Out-of-range pin",
                category="lead",
            )

    def test_client_cannot_supply_creator_or_case_ownership(self):
        with self.assertRaises(ValidationError):
            pins_router.PinCreate.model_validate(
                {
                    "latitude": 18.922,
                    "longitude": 72.8347,
                    "title": "Gateway review point",
                    "category": "point_of_interest",
                    "createdBy": "attacker-controlled-value",
                    "caseId": "mumbai-2611",
                },
            )

    def test_cross_case_link_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            pins_router._validate_links(
                "demo",
                "evidence-judgment",
                None,
                None,
            )
        self.assertEqual(context.exception.status_code, 422)

    def test_read_only_profile_cannot_write(self):
        viewer = self.profile.model_copy(update={"role": "viewer"})
        self.assertFalse(pins_router._can_write(viewer))
        self.assertTrue(pins_router._can_write(self.profile))

    def test_unknown_case_is_not_exposed(self):
        with self.assertRaises(HTTPException) as context:
            pins_router._require_case_access("unknown-case", self.profile)
        self.assertEqual(context.exception.status_code, 404)
