from __future__ import annotations

import json
from uuid import uuid4

import httpx

from backend.app.services.connection_suggestion_provider import OpenAIConnectionSuggestionProvider


def test_openai_provider_can_only_refine_deterministic_candidates() -> None:
    source_id = str(uuid4())
    target_id = str(uuid4())
    invented_id = str(uuid4())
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured.update(json.loads(request.content))
        output = {
            "suggestions": [
                {
                    "sourceNodeId": target_id,
                    "targetNodeId": source_id,
                    "suggestedRelationship": "SEEN WITH",
                },
                {
                    "sourceNodeId": source_id,
                    "targetNodeId": invented_id,
                    "suggestedRelationship": "OWNS",
                },
            ]
        }
        return httpx.Response(
            200,
            json={
                "output": [
                    {"content": [{"type": "output_text", "text": json.dumps(output)}]}
                ]
            },
        )

    analysis = {
        "provider": "deterministic",
        "ai_available": False,
        "suggestions": [
            {
                "source_node_id": source_id,
                "target_node_id": target_id,
                "suggested_relationship": "ASSOCIATED WITH",
                "status": "PENDING",
                "reason_codes": ["SHARED_LOCATION"],
            }
        ],
    }
    workspace = {
        "nodes": [
            {"id": source_id, "type": "person", "label": "private", "description": "secret"},
            {"id": target_id, "type": "location", "label": "private", "source_ref": "secret"},
        ]
    }
    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAIConnectionSuggestionProvider(
        api_key="test-key",
        model="gpt-5.6-luna",
        timeout_seconds=5,
        client=client,
    )

    refined = provider.refine(analysis, workspace)

    assert refined["provider"] == "openai" and refined["ai_available"] is True
    assert len(refined["suggestions"]) == 1
    assert refined["suggestions"][0]["suggested_relationship"] == "SEEN WITH"
    assert "private" not in captured["input"] and "secret" not in captured["input"]
    assert captured["store"] is False
    assert captured["text"]["format"]["type"] == "json_schema"


def test_openai_provider_ignores_invalid_relationship_labels() -> None:
    source_id = str(uuid4())
    target_id = str(uuid4())

    def handler(_request: httpx.Request) -> httpx.Response:
        output = {
            "suggestions": [
                {
                    "sourceNodeId": source_id,
                    "targetNodeId": target_id,
                    "suggestedRelationship": "VERIFIED CRIMINAL LINK",
                }
            ]
        }
        return httpx.Response(200, json={"output": [{"content": [{"type": "output_text", "text": json.dumps(output)}]}]})

    analysis = {
        "provider": "deterministic",
        "ai_available": False,
        "suggestions": [
            {
                "source_node_id": source_id,
                "target_node_id": target_id,
                "suggested_relationship": "ASSOCIATED WITH",
                "status": "PENDING",
                "reason_codes": ["SHARED_LOCATION"],
            }
        ],
    }
    provider = OpenAIConnectionSuggestionProvider(
        api_key="test-key",
        model="gpt-5.6-luna",
        timeout_seconds=5,
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    refined = provider.refine(
        analysis,
        {"nodes": [{"id": source_id, "type": "person"}, {"id": target_id, "type": "person"}]},
    )

    assert refined["suggestions"][0]["suggested_relationship"] == "ASSOCIATED WITH"
