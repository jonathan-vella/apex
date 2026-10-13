"""Tests for generate_alz_baseline.py using a tiny synthetic library and built-in tree (no network)."""

from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path
from typing import Any

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import discover  # noqa: E402
import generate_alz_baseline as gen  # noqa: E402
from governance_baseline import default_subscription, load_governance_json  # noqa: E402

DENY_GUID = "11111111-1111-1111-1111-111111111111"
DINE_GUID = "22222222-2222-2222-2222-222222222222"
SET_GUID = "33333333-3333-3333-3333-333333333333"
TARGET_SUBSCRIPTION = "44444444-4444-4444-4444-444444444444"


def _write(path: Path, doc: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc), encoding="utf-8")


def _assignment(name: str, definition_id: str, **props: Any) -> dict[str, Any]:
    return {
        "name": name,
        "properties": {
            "displayName": name,
            "policyDefinitionId": definition_id,
            "enforcementMode": props.pop("enforcementMode", "Default"),
            "parameters": props.pop("parameters", {}),
            "scope": "/providers/Microsoft.Management/managementGroups/placeholder",
            **props,
        },
    }


@pytest.fixture
def sources(tmp_path: Path) -> tuple[Path, Path]:
    library = tmp_path / "lib"
    alz = library / "platform" / "alz"
    builtins = tmp_path / "builtin"

    for archetype, assignments in {
        "root": ["Enforce-Set"],
        "landing_zones": ["Deny-Thing"],
        "corp": ["Deploy-Thing", "Audit-Only"],
    }.items():
        _write(
            alz / "archetype_definitions" / f"{archetype}.alz_archetype_definition.json",
            {"name": archetype, "policy_assignments": assignments},
        )

    mg = "/providers/Microsoft.Management/managementGroups/placeholder/providers/Microsoft.Authorization"
    builtin = "/providers/Microsoft.Authorization"
    for assignment in (
        _assignment("Enforce-Set", f"{mg}/policySetDefinitions/Custom-Set", enforcementMode="DoNotEnforce"),
        _assignment("Deny-Thing", f"{builtin}/policyDefinitions/{DENY_GUID}"),
        _assignment("Deploy-Thing", f"{builtin}/policyDefinitions/{DINE_GUID}"),
        _assignment("Audit-Only", f"{builtin}/policyDefinitions/{DENY_GUID}", parameters={"effect": {"value": "Audit"}}),
    ):
        _write(alz / "policy_assignments" / f"{assignment['name']}.alz_policy_assignment.json", assignment)

    _write(
        alz / "policy_set_definitions" / "Custom-Set.alz_policy_set_definition.json",
        {
            "name": "Custom-Set",
            "properties": {
                "parameters": {"effect": {"type": "String", "defaultValue": "Deny"}},
                "policyDefinitions": [
                    {
                        "policyDefinitionReferenceId": "member",
                        "policyDefinitionId": "${current_scope_resource_id}/providers/Microsoft.Authorization/policyDefinitions/Custom-Def",
                        "parameters": {"effect": {"value": "[parameters('effect')]"}},
                    }
                ],
            },
        },
    )
    _write(
        alz / "policy_definitions" / "Custom-Def.alz_policy_definition.json",
        {
            "name": "Custom-Def",
            "properties": {
                "displayName": "Custom definition",
                "parameters": {"effect": {"type": "String", "defaultValue": "Deny"}},
                "policyRule": {
                    "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                    "then": {"effect": "[parameters('effect')]"},
                },
            },
        },
    )

    for guid, effect in ((DENY_GUID, "Deny"), (DINE_GUID, "DeployIfNotExists")):
        _write(
            builtins / "policyDefinitions" / "Cat" / f"{guid}.json",
            {
                "name": guid,
                "id": f"/providers/Microsoft.Authorization/policyDefinitions/{guid}",
                "properties": {
                    "displayName": f"Built-in {effect}",
                    "parameters": {"effect": {"type": "String", "defaultValue": effect}},
                    "policyRule": {
                        "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                        "then": {"effect": "[parameters('effect')]"},
                    },
                },
            },
        )
    (builtins / "policySetDefinitions").mkdir(parents=True)
    return library, builtins


def test_baseline_resolves_corp_archetypes_and_marks_provenance(sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    document = gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")

    assert document["baseline_kind"] == "alz-corp-default"
    assert document["alz_library_ref"] == gen.LIBRARY_REF
    entry = document["subscriptions"][gen.SYNTHETIC_SUBSCRIPTION_ID]
    assert entry["source"] == "alz-corp-default"
    assert entry["provenance"]["verified_against_tenant"] is False
    assert entry["provenance"]["archetypes"] == {
        "root": ["Enforce-Set"],
        "landing_zones": ["Deny-Thing"],
        "corp": ["Deploy-Thing", "Audit-Only"],
    }
    assert entry["discovery_status"] == "COMPLETE"
    assert document["summary"]["total_findings"] == len(entry["findings"])


def test_scopes_follow_the_archetype_and_enforcement_mode_is_kept(sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    entry = gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")["subscriptions"][
        gen.SYNTHETIC_SUBSCRIPTION_ID
    ]
    scopes = {a["displayName"]: a["scope"].rsplit("/", 1)[-1] for a in entry["assignment_inventory"]}
    assert scopes == {
        "Enforce-Set": "alz",
        "Deny-Thing": "alz-landingzones",
        "Deploy-Thing": "alz-corp",
        "Audit-Only": "alz-corp",
    }
    by_assignment = {f["assignment_display_name"]: f for f in entry["findings"]}
    # DoNotEnforce is included but never a blocker.
    assert by_assignment["Enforce-Set"]["enforcement_mode"] == "DoNotEnforce"
    assert by_assignment["Enforce-Set"]["classification"] == "informational"
    assert by_assignment["Deny-Thing"]["classification"] == "blocker"
    assert by_assignment["Deploy-Thing"]["classification"] == "auto-remediate"
    assert "Audit-Only" not in by_assignment


def test_unresolved_definition_fails_loudly(sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    (builtins / "policyDefinitions" / "Cat" / f"{DENY_GUID}.json").unlink()
    with pytest.raises(RuntimeError, match="unresolved"):
        gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")


def test_gzip_output_is_deterministic_and_preserves_timestamp(tmp_path: Path, sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    out = tmp_path / "baseline.json.gz"
    first = gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")
    gen._preserve_timestamp(out, first)
    gen.write_gzip_json(out, first)
    first_bytes = out.read_bytes()

    second = gen.build_baseline(library, builtins, "2026-10-20T00:00:00Z")
    gen._preserve_timestamp(out, second)
    gen.write_gzip_json(out, second)

    assert out.read_bytes() == first_bytes
    assert load_governance_json(out)["generated_at"] == "2026-10-13T00:00:00Z"


def test_default_subscription_requires_the_alz_kind(sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    document = gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")
    sub_id, envelope = default_subscription(document)
    assert sub_id == gen.SYNTHETIC_SUBSCRIPTION_ID
    assert envelope["source"] == "alz-corp-default"

    document.pop("baseline_kind")
    with pytest.raises(KeyError):
        default_subscription(document)


def test_conditional_effect_follows_the_resource_type_list() -> None:
    expression = "[if(contains(parameters('resourceTypeList'),'microsoft.sql/servers'),parameters('effect'),'Disabled')]"
    listed = {"resourceTypeList": ["Microsoft.SQL/servers"], "effect": "DeployIfNotExists"}
    unlisted = {"resourceTypeList": ["microsoft.web/sites"], "effect": "DeployIfNotExists"}
    assert discover._resolve_parameters(expression, listed) == "DeployIfNotExists"
    assert discover._resolve_parameters(expression, unlisted) == "Disabled"
    # A missing list is not evaluated; the expression stays unresolved instead of guessing.
    assert discover._resolve_parameters(expression, {"effect": "Deny"}) == expression


def test_enforce_setting_is_not_reported_as_unresolved(sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    path = builtins / "policyDefinitions" / "Cat" / f"{DENY_GUID}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["properties"]["parameters"]["effect"]["defaultValue"] = "enforceSetting"
    path.write_text(json.dumps(doc), encoding="utf-8")

    entry = gen.build_baseline(library, builtins, "2026-10-13T00:00:00Z")["subscriptions"][
        gen.SYNTHETIC_SUBSCRIPTION_ID
    ]
    assert entry["discovery_status"] == "COMPLETE"
    assert all(f["assignment_display_name"] != "Deny-Thing" for f in entry["findings"])


def test_gzip_roundtrip_is_plain_json(tmp_path: Path) -> None:
    out = tmp_path / "x.json.gz"
    gen.write_gzip_json(out, {"b": 1, "a": 2})
    assert json.loads(gzip.decompress(out.read_bytes())) == {"a": 2, "b": 1}


def test_cached_renderer_accepts_the_default_with_a_fresh_timestamp_and_assumed_banner(
    tmp_path: Path, sources: tuple[Path, Path]
) -> None:
    import render_cached_governance as renderer

    library, builtins = sources
    document = gen.build_baseline(library, builtins, "2020-01-01T00:00:00Z")
    _, envelope = default_subscription(document)
    source = tmp_path / "sub.json"
    source.write_text(json.dumps(envelope), encoding="utf-8")
    out = tmp_path / "agent-output" / "demo" / "04-governance-constraints.json"

    assert renderer.main(["--in", str(source), "--out", str(out), "--subscription", TARGET_SUBSCRIPTION]) == 0

    rendered = json.loads(out.read_text(encoding="utf-8"))
    assert rendered["source"] == "alz-corp-default"
    assert rendered["discovered_at"] > "2026-01-01"
    assert rendered["subscription_id"] == TARGET_SUBSCRIPTION
    assert rendered["discovery_metadata"]["scope"]["subscription_id"] == TARGET_SUBSCRIPTION
    assert rendered["provenance"]["baseline_subscription_id"] == gen.SYNTHETIC_SUBSCRIPTION_ID
    preview = (out.parent / "04-governance-constraints.preview.md").read_text(encoding="utf-8")
    assert "Assumed governance" in preview
    assert gen.SYNTHETIC_SUBSCRIPTION_ID not in preview


@pytest.mark.parametrize("extra", [[], ["--subscription", "not-a-guid"]])
def test_cached_renderer_rejects_the_default_without_a_valid_target_subscription(
    tmp_path: Path, sources: tuple[Path, Path], extra: list[str]
) -> None:
    import render_cached_governance as renderer

    library, builtins = sources
    _, envelope = default_subscription(gen.build_baseline(library, builtins, "2020-01-01T00:00:00Z"))
    source = tmp_path / "sub.json"
    source.write_text(json.dumps(envelope), encoding="utf-8")
    out = tmp_path / "agent-output" / "demo" / "04-governance-constraints.json"

    assert renderer.main(["--in", str(source), "--out", str(out), *extra]) == 2
    assert not out.exists()


def test_local_source_trees_require_explicit_refs(tmp_path: Path, sources: tuple[Path, Path]) -> None:
    library, builtins = sources
    out = tmp_path / "baseline.json.gz"
    base = ["--out", str(out), "--library-dir", str(library), "--builtins-dir", str(builtins)]

    with pytest.raises(SystemExit):
        gen.main(base)
    with pytest.raises(SystemExit):
        gen.main([*base, "--library-ref", "platform/alz/9.9.9"])
    assert not out.exists()

    assert gen.main([*base, "--library-ref", "platform/alz/9.9.9", "--azure-policy-ref", "abc123"]) == 0
    document = load_governance_json(out)
    assert document["alz_library_ref"] == "platform/alz/9.9.9"
    assert document["azure_policy_ref"] == "abc123"
    provenance = document["subscriptions"][gen.SYNTHETIC_SUBSCRIPTION_ID]["provenance"]
    assert provenance["alz_library_ref"] == "platform/alz/9.9.9"
    assert provenance["azure_policy_ref"] == "abc123"
