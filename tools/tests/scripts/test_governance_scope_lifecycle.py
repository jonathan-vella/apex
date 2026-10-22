"""Planned group guidance preserves collection scope and policy freshness."""

import copy
import importlib
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import ModuleType

import pytest


@pytest.fixture
def modules(monkeypatch: pytest.MonkeyPatch) -> tuple[ModuleType, ModuleType]:
    scripts = Path(__file__).resolve().parents[3] / ".github/skills/apex-azure-governance-discovery/scripts"
    monkeypatch.syspath_prepend(str(scripts))
    return importlib.import_module("render_governance"), importlib.import_module("discover")


@pytest.mark.parametrize("source", ["live", "cached_baseline", "alz-corp-default"])
def test_preview_distinguishes_planned_group_lifecycle_from_missing_evidence(
    tmp_path: Path,
    modules: tuple[ModuleType, ModuleType],
    source: str,
) -> None:
    renderer, _ = modules
    envelope = {
        "project": "synthetic",
        "source": source,
        "subscription_id": "00000000-0000-0000-0000-000000000001",
        "discovery_status": "COMPLETE",
        "discovered_at": "2026-10-01T00:00:00Z",
        "discovery_summary": {},
        "findings": [],
        "tags_required": [],
    }
    before = copy.deepcopy(envelope)
    preview = renderer.emit_preview_md(envelope, tmp_path / "04-governance-constraints.json")
    assert preview is not None
    text = preview.read_text()
    assert "**Resource-group lifecycle**" in text
    assert "planned groups do not need to exist during Governance or IaC planning" in text
    assert "not a should-fix finding or an approval question" in text
    assert "Existing target groups still require actual scope evidence" in text
    assert "TTL expiry and policy/scope changes remain separate refresh triggers" in text
    assert envelope == before


def test_planned_group_guidance_does_not_hide_inherited_policy_or_partial_collection(
    tmp_path: Path,
    modules: tuple[ModuleType, ModuleType],
) -> None:
    renderer, _ = modules
    policy = {
        "policy_id": "synthetic-policy",
        "display_name": "Inherited private-access constraint",
        "scope": "/providers/Microsoft.Management/managementGroups/synthetic",
        "effect": "deny",
        "classification": "blocker",
        "azurePropertyPath": "properties.publicNetworkAccess",
        "bicepPropertyPath": "publicNetworkAccess",
    }
    envelope = {
        "project": "synthetic",
        "discovery_status": "PARTIAL",
        "discovery_summary": {"blocker_count": 1},
        "findings": [policy],
    }
    before = copy.deepcopy(envelope)
    preview = renderer.emit_preview_md(envelope, tmp_path / "04-governance-constraints.json")
    assert preview is not None
    text = preview.read_text()
    assert "Inherited private-access constraint" in text
    assert "deployment blocker(s)" in text
    assert "**Resource-group lifecycle**" in text
    assert envelope == before


def test_planned_group_note_does_not_extend_or_waive_snapshot_ttl(modules: tuple[ModuleType, ModuleType]) -> None:
    _, discover = modules
    now = datetime(2026, 10, 22, tzinfo=UTC)
    for age, expected in [(1, True), (8, False)]:
        envelope = {
            "discovery_metadata": {
                "discovery_status": "COMPLETE",
                "discovered_at": (now - timedelta(days=age)).isoformat(),
                "ttl_days": 7,
            },
            "findings": [],
        }
        assert discover._cache_is_fresh(envelope, now=now) is expected
