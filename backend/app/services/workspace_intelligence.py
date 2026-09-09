from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


def find_documented_path(
    workspace: dict[str, Any],
    from_node_id: UUID,
    to_node_id: UUID,
    max_hops: int,
    relationship_types: list[str] | None = None,
) -> dict[str, Any]:
    if from_node_id == to_node_id:
        return {"found": True, "node_ids": [from_node_id], "edge_ids": [], "hops": 0}
    allowed = set(relationship_types or [])
    adjacency: dict[UUID, list[tuple[UUID, UUID]]] = {}
    for edge in workspace.get("edges", []):
        relationship = edge.get("relationship_type", edge.get("relationshipType"))
        if allowed and relationship not in allowed:
            continue
        source = UUID(str(edge["source"]))
        target = UUID(str(edge["target"]))
        edge_id = UUID(str(edge["id"]))
        adjacency.setdefault(source, []).append((target, edge_id))
        adjacency.setdefault(target, []).append((source, edge_id))
    queue: deque[tuple[UUID, list[UUID], list[UUID]]] = deque([(from_node_id, [from_node_id], [])])
    visited = {from_node_id}
    while queue:
        current, nodes, edges = queue.popleft()
        if len(edges) >= max_hops:
            continue
        for neighbor, edge_id in adjacency.get(current, []):
            if neighbor in visited:
                continue
            next_nodes = [*nodes, neighbor]
            next_edges = [*edges, edge_id]
            if neighbor == to_node_id:
                return {"found": True, "node_ids": next_nodes, "edge_ids": next_edges, "hops": len(next_edges)}
            visited.add(neighbor)
            queue.append((neighbor, next_nodes, next_edges))
    return {"found": False, "node_ids": [], "edge_ids": [], "hops": 0}


def _value(item: dict[str, Any], snake: str, camel: str) -> Any:
    return item.get(snake, item.get(camel))


def _source_ref(node: dict[str, Any]) -> str | None:
    for snake, camel in (
        ("source_entity_id", "sourceEntityId"),
        ("source_location_id", "sourceLocationId"),
        ("source_event_id", "sourceEventId"),
        ("source_fact_id", "sourceFactId"),
    ):
        value = _value(node, snake, camel)
        if value:
            return str(value)
    return None


def _signals(node: dict[str, Any], investigation: dict[str, Any]) -> dict[str, set[str]]:
    entities = {value for value in [_value(node, "source_entity_id", "sourceEntityId")] if value}
    locations = {value for value in [_value(node, "source_location_id", "sourceLocationId")] if value}
    events = {value for value in [_value(node, "source_event_id", "sourceEventId")] if value}
    facts = {value for value in [_value(node, "source_fact_id", "sourceFactId")] if value}
    for event in investigation["timeline"]["events"]:
        if event["id"] in events or entities.intersection(event.get("linkedEntityIds", [])) or locations.intersection(event.get("linkedLocationIds", [])):
            events.add(event["id"])
            locations.update(event.get("linkedLocationIds", []))
    for location in investigation["map"]["locations"]:
        if location["id"] in locations or entities.intersection(location.get("linkedEntityIds", [])):
            locations.add(location["id"])
    for fact in investigation["facts"]:
        if (
            fact["id"] in facts
            or entities.intersection(fact.get("linkedEntityIds", []))
            or locations.intersection(fact.get("linkedLocationIds", []))
            or events.intersection(fact.get("linkedTimelineEventIds", []))
        ):
            facts.add(fact["id"])
    return {"locations": locations, "events": events, "facts": facts}


def _suggestion_signature(source_id: str, target_id: str, reasons: list[str]) -> str:
    return f"suggestion:{':'.join(sorted([source_id, target_id]))}:{':'.join(sorted(reasons))}"


def _has_bounded_case_path(
    graph: dict[str, Any], source_id: str, target_id: str, max_hops: int = 2
) -> bool:
    if source_id == target_id:
        return False
    adjacency: dict[str, list[str]] = {}
    for edge in graph.get("edges", graph.get("links", [])):
        source = str(edge["source"])
        target = str(edge["target"])
        adjacency.setdefault(source, []).append(target)
        adjacency.setdefault(target, []).append(source)
    queue: deque[tuple[str, int]] = deque([(source_id, 0)])
    visited = {source_id}
    while queue:
        current, hops = queue.popleft()
        if hops >= max_hops:
            continue
        for neighbor in adjacency.get(current, []):
            if neighbor == target_id:
                return True
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, hops + 1))
    return False


def analyze_workspace(workspace: dict[str, Any], investigation: dict[str, Any]) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    nodes = workspace.get("nodes", [])
    edges = workspace.get("edges", [])
    connected = {
        pair
        for edge in edges
        for pair in ((str(edge["source"]), str(edge["target"])), (str(edge["target"]), str(edge["source"])))
    }
    node_signals = {str(node["id"]): _signals(node, investigation) for node in nodes}
    existing_suggestions = {item["signature"]: item for item in workspace.get("suggestions", [])}
    suggestions: list[dict[str, Any]] = []
    reason_labels = {
        "SHARED_LOCATION": "a shared location reference",
        "TEMPORAL_OVERLAP": "overlapping timeline material",
        "COMMON_EVIDENCE_REFERENCE": "common evidence",
        "EXISTING_CASE_PATH": "an existing case relationship path",
    }
    for left, source in enumerate(nodes):
        for target in nodes[left + 1 :]:
            source_id, target_id = str(source["id"]), str(target["id"])
            if (source_id, target_id) in connected:
                continue
            source_signals, target_signals = node_signals[source_id], node_signals[target_id]
            reasons: list[str] = []
            if source_signals["locations"].intersection(target_signals["locations"]):
                reasons.append("SHARED_LOCATION")
            if source_signals["events"].intersection(target_signals["events"]):
                reasons.append("TEMPORAL_OVERLAP")
            if source_signals["facts"].intersection(target_signals["facts"]):
                reasons.append("COMMON_EVIDENCE_REFERENCE")
            source_entity_id = _value(source, "source_entity_id", "sourceEntityId")
            target_entity_id = _value(target, "source_entity_id", "sourceEntityId")
            if (
                source_entity_id
                and target_entity_id
                and _has_bounded_case_path(
                    investigation.get("graph", {}),
                    str(source_entity_id),
                    str(target_entity_id),
                )
            ):
                reasons.append("EXISTING_CASE_PATH")
            if not reasons:
                continue
            signature = _suggestion_signature(source_id, target_id, reasons)
            suggestions.append(existing_suggestions.get(signature) or {
                "id": uuid4(),
                "signature": signature,
                "source_node_id": UUID(source_id),
                "target_node_id": UUID(target_id),
                "suggested_relationship": "ASSOCIATED WITH",
                "status": "PENDING",
                "reason_codes": reasons,
                "explanation": f"{source['label']} and {target['label']} were flagged because current case data contains {', '.join(reason_labels[reason] for reason in reasons)}. Review the basis before adding any hypothesis.",
                "signal_strength": "HIGH" if len(reasons) >= 3 else "MEDIUM" if len(reasons) == 2 else "LOW",
                "created_at": now,
                "reviewed_at": None,
            })

    existing_conflicts = {item["signature"]: item for item in workspace.get("conflicts", [])}
    conflicts: list[dict[str, Any]] = []
    for left, source in enumerate(nodes):
        for target in nodes[left + 1 :]:
            source_ref = _source_ref(source)
            target_ref = _source_ref(target)
            labels_differ = source["label"].strip().casefold() != target["label"].strip().casefold()
            if source_ref and source_ref == target_ref and (source["type"] != target["type"] or labels_differ):
                signature = f"attribute:{':'.join(sorted([str(source['id']), str(target['id'])]))}"
                conflicts.append(existing_conflicts.get(signature) or {
                    "id": uuid4(), "signature": signature, "conflict_type": "ATTRIBUTE_CONFLICT",
                    "resource_a_type": "node", "resource_a_id": str(source["id"]),
                    "resource_b_type": "node", "resource_b_id": str(target["id"]),
                    "status": "OPEN", "explanation": "Two workspace references to the same case record disagree on identity attributes. Review the imported data and any analyst edits.",
                    "created_at": now, "reviewed_at": None,
                })
                continue
            if source["label"].strip().casefold() != target["label"].strip().casefold():
                continue
            if source_ref == target_ref:
                continue
            signature = f"duplicate:{':'.join(sorted([str(source['id']), str(target['id'])]))}"
            conflicts.append(existing_conflicts.get(signature) or {
                "id": uuid4(), "signature": signature, "conflict_type": "DUPLICATE_IDENTITY",
                "resource_a_type": "node", "resource_a_id": str(source["id"]),
                "resource_b_type": "node", "resource_b_id": str(target["id"]),
                "status": "OPEN", "explanation": f"Potential duplicate identity: {source['label']} appears as separate workspace records.",
                "created_at": now, "reviewed_at": None,
            })
    events_by_id = {event["id"]: event for event in investigation["timeline"]["events"]}
    event_nodes = [(node, events_by_id.get(_value(node, "source_event_id", "sourceEventId"))) for node in nodes]
    event_nodes = [(node, event) for node, event in event_nodes if event]
    for left, (source_node, source_event) in enumerate(event_nodes):
        for target_node, target_event in event_nodes[left + 1 :]:
            if not set(source_event.get("linkedEntityIds", [])).intersection(target_event.get("linkedEntityIds", [])):
                continue
            if set(source_event.get("linkedLocationIds", [])).intersection(target_event.get("linkedLocationIds", [])):
                continue
            try:
                source_label = source_event["time"] if ":" in source_event["time"] else "00:00"
                target_label = target_event["time"] if ":" in target_event["time"] else "00:00"
                source_time = datetime.fromisoformat(f"{source_event['date']}T{source_label}")
                target_time = datetime.fromisoformat(f"{target_event['date']}T{target_label}")
            except (TypeError, ValueError):
                continue
            minutes = round(abs((source_time - target_time).total_seconds()) / 60)
            if minutes > 5:
                continue
            signature = f"temporal:{':'.join(sorted([str(source_node['id']), str(target_node['id'])]))}"
            conflicts.append(existing_conflicts.get(signature) or {
                "id": uuid4(), "signature": signature, "conflict_type": "TEMPORAL_CONFLICT",
                "resource_a_type": "node", "resource_a_id": str(source_node["id"]),
                "resource_b_type": "node", "resource_b_id": str(target_node["id"]),
                "status": "OPEN", "explanation": f"Potential timeline conflict: linked events occur at different locations {minutes} minutes apart. Travel feasibility requires analyst review.",
                "created_at": now, "reviewed_at": None,
            })
    ownership_edges = [edge for edge in edges if _value(edge, "relationship_type", "relationshipType") in {"OWNS", "MEMBER OF"}]
    for left, source in enumerate(ownership_edges):
        for target in ownership_edges[left + 1 :]:
            if str(source["source"]) != str(target["source"]) or str(source["target"]) == str(target["target"]):
                continue
            if _value(source, "verification_status", "verificationStatus") != "verified" or _value(target, "verification_status", "verificationStatus") != "verified":
                continue
            signature = f"relationship:{':'.join(sorted([str(source['id']), str(target['id'])]))}"
            conflicts.append(existing_conflicts.get(signature) or {
                "id": uuid4(), "signature": signature, "conflict_type": "RELATIONSHIP_CONFLICT",
                "resource_a_type": "edge", "resource_a_id": str(source["id"]),
                "resource_b_type": "edge", "resource_b_id": str(target["id"]),
                "status": "OPEN", "explanation": "Two verified records assign the same exclusive relationship to different targets. Review their sources.",
                "created_at": now, "reviewed_at": None,
            })
    for edge in edges:
        disputed_basis = next((basis for basis in edge.get("basis", []) if basis.get("resource_type", basis.get("resourceType")) == "fact" and not basis.get("verified", False)), None)
        if not disputed_basis:
            continue
        signature = f"source:{edge['id']}:{disputed_basis['id']}"
        conflicts.append(existing_conflicts.get(signature) or {
            "id": uuid4(), "signature": signature, "conflict_type": "SOURCE_DISAGREEMENT",
            "resource_a_type": "edge", "resource_a_id": str(edge["id"]),
            "resource_b_type": "fact", "resource_b_id": str(disputed_basis["id"]),
            "status": "OPEN", "explanation": "A relationship basis includes a disputed or pending source record and requires analyst review.",
            "created_at": now, "reviewed_at": None,
        })

    evidence_ids = {fact_id for item in node_signals.values() for fact_id in item["facts"]}
    return {
        "provider": "deterministic",
        "ai_available": False,
        "suggestions": suggestions,
        "conflicts": conflicts,
        "analyzed_node_count": len(nodes),
        "analyzed_edge_count": len(edges),
        "evidence_reference_count": len(evidence_ids),
    }
