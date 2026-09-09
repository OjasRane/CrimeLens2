from __future__ import annotations

import json
from copy import deepcopy
from typing import Any, Protocol

import httpx

from ..core.config import Settings


ALLOWED_RELATIONSHIPS = {
    "ASSOCIATED WITH",
    "CONTACTED",
    "SEEN WITH",
    "LOCATED AT",
    "OWNS",
    "USES",
    "TRANSFERRED TO",
    "TRAVELLED TO",
    "MEMBER OF",
    "LINKED TO",
    "SUPPORTS",
    "CONTRADICTS",
    "RELATED TO",
}


class ConnectionSuggestionProvider(Protocol):
    def refine(self, analysis: dict[str, Any], workspace: dict[str, Any]) -> dict[str, Any]: ...


class OpenAIConnectionSuggestionProvider:
    """Refines deterministic candidates without creating facts, nodes, or candidates."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        client: httpx.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._client = client

    @staticmethod
    def _schema() -> dict[str, Any]:
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "suggestions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "sourceNodeId": {"type": "string"},
                            "targetNodeId": {"type": "string"},
                            "suggestedRelationship": {
                                "type": "string",
                                "enum": sorted(ALLOWED_RELATIONSHIPS),
                            },
                        },
                        "required": ["sourceNodeId", "targetNodeId", "suggestedRelationship"],
                    },
                }
            },
            "required": ["suggestions"],
        }

    @staticmethod
    def _candidate_payload(analysis: dict[str, Any], workspace: dict[str, Any]) -> list[dict[str, Any]]:
        node_types = {str(node["id"]): node["type"] for node in workspace.get("nodes", [])}
        return [
            {
                "sourceNodeId": str(item["source_node_id"]),
                "sourceType": node_types.get(str(item["source_node_id"]), "custom"),
                "targetNodeId": str(item["target_node_id"]),
                "targetType": node_types.get(str(item["target_node_id"]), "custom"),
                "reasonCodes": list(item.get("reason_codes", [])),
            }
            for item in analysis.get("suggestions", [])
            if item.get("status") == "PENDING"
        ]

    @staticmethod
    def _output_text(response: dict[str, Any]) -> str:
        for item in response.get("output", []):
            for content in item.get("content", []):
                if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                    return content["text"]
        raise ValueError("OpenAI response did not contain structured output text")

    def refine(self, analysis: dict[str, Any], workspace: dict[str, Any]) -> dict[str, Any]:
        candidates = self._candidate_payload(analysis, workspace)
        refined = deepcopy(analysis)
        refined["provider"] = "openai"
        refined["ai_available"] = True
        if not candidates:
            return refined

        request = {
            "model": self._model,
            "store": False,
            "instructions": (
                "You refine relationship labels for precomputed investigation-graph candidates. "
                "Use only the supplied candidates and reason codes. Return each candidate at most once. "
                "Do not infer facts, create nodes, change verification, or add candidates."
            ),
            "input": json.dumps({"candidates": candidates}, separators=(",", ":")),
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "workspace_connection_refinement",
                    "strict": True,
                    "schema": self._schema(),
                }
            },
        }
        if self._client is not None:
            response = self._client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                json=request,
            )
        else:
            with httpx.Client(timeout=self._timeout_seconds) as client:
                response = client.post(
                    "https://api.openai.com/v1/responses",
                    headers={"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"},
                    json=request,
                )
        response.raise_for_status()
        payload = json.loads(self._output_text(response.json()))
        if not isinstance(payload, dict) or not isinstance(payload.get("suggestions"), list):
            raise ValueError("OpenAI response did not match the suggestion schema")

        deterministic = {
            (str(item["source_node_id"]), str(item["target_node_id"])): item
            for item in refined.get("suggestions", [])
            if item.get("status") == "PENDING"
        }
        for item in payload.get("suggestions", []):
            if not isinstance(item, dict):
                continue
            relationship = item.get("suggestedRelationship")
            key = (str(item.get("sourceNodeId")), str(item.get("targetNodeId")))
            reverse_key = (key[1], key[0])
            candidate = deterministic.get(key) or deterministic.get(reverse_key)
            if candidate is not None and relationship in ALLOWED_RELATIONSHIPS:
                candidate["suggested_relationship"] = relationship
        return refined


def configured_connection_provider(settings: Settings) -> ConnectionSuggestionProvider | None:
    api_key = (settings.openai_api_key or "").strip()
    if not api_key:
        return None
    return OpenAIConnectionSuggestionProvider(
        api_key=api_key,
        model=settings.openai_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )
