"""Unit tests for discover.py — no Azure account needed.

Tests exercise the pure-Python `discover()` entry point by injecting a fake
`az_rest` callable that returns hand-rolled JSON modelled on real Azure
Policy REST responses.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Callable

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FIXTURES = HERE / "fixtures"

import discover  # noqa: E402

# --------------------------------------------------------------------------- #
# Helpers                                                                     #
# --------------------------------------------------------------------------- #


def _load(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES / name).read_text())


def _router(mapping: dict[str, dict[str, Any]]) -> Callable[[str], dict[str, Any]]:
    """Return an `az_rest` fake that matches URL by longest-substring wins."""

    ordered = sorted(mapping.keys(), key=len, reverse=True)

    def call(url: str) -> dict[str, Any]:
        for key in ordered:
            if key in url:
                return mapping[key]
        return {"value": []}

    return call


EMPTY = {"value": []}


# --------------------------------------------------------------------------- #
# Pure-classification tests                                                   #
# --------------------------------------------------------------------------- #


def test_empty_tenant_returns_zero_findings():
    env = discover.discover(
        "00000000-0000-0000-0000-000000000000",
        project="empty",
        az_rest=_router({}),
    )
    assert env["discovery_status"] == "COMPLETE"
    assert env["findings"] == []
    assert env["discovery_summary"]["assignment_total"] == 0


def test_defender_auto_assignments_filtered_by_default():
    defender_assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/defender-123",
        "name": "defender-123",
        "properties": {
            "displayName": "ASC Default",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policySetDefinitions/asc",
            "scope": "/subscriptions/s",
            "metadata": {"assignedBy": "Security Center"},
        },
    }
    mapping = {
        "policyAssignments": {"value": [defender_assignment]},
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    assert env["discovery_summary"]["defender_auto_filtered"] == 1
    assert env["discovery_summary"]["assignment_kept"] == 0
    assert env["findings"] == []


def test_defender_auto_retained_with_opt_in():
    defender_assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/defender-123",
        "name": "defender-123",
        "properties": {
            "displayName": "ASC Default",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/deny-public-blob",
            "scope": "/subscriptions/s",
            "metadata": {"assignedBy": "Security Center"},
        },
    }
    definition = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/deny-public-blob",
        "name": "deny-public-blob",
        "properties": {
            "displayName": "Deny public blob access",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {
                    "allOf": [
                        {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                        {
                            "field": "Microsoft.Storage/storageAccounts/allowBlobPublicAccess",
                            "equals": "true",
                        },
                    ]
                },
                "then": {"effect": "Deny"},
            },
        },
    }
    mapping = {
        "policyAssignments": {"value": [defender_assignment]},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": {
            "value": [definition]
        },
        "/providers/Microsoft.Authorization/policyDefinitions": {"value": []},
    }
    env = discover.discover(
        "s", project="p", include_defender_auto=True, az_rest=_router(mapping)
    )
    assert env["discovery_summary"]["defender_auto_filtered"] == 0
    assert env["discovery_summary"]["assignment_kept"] == 1
    assert len(env["findings"]) == 1
    assert env["findings"][0]["classification"] == "blocker"


def test_exempted_deny_downgrades_to_informational():
    assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/tls",
        "name": "tls",
        "properties": {
            "displayName": "Require TLS 1.2",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/tls",
            "scope": "/subscriptions/s",
        },
    }
    definition = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/tls",
        "name": "tls",
        "properties": {
            "displayName": "Require TLS 1.2 for Storage",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {
                    "allOf": [
                        {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                        {
                            "field": "Microsoft.Storage/storageAccounts/minimumTlsVersion",
                            "notEquals": "TLS1_2",
                        },
                    ]
                },
                "then": {"effect": "Deny"},
            },
        },
    }
    exemption = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyExemptions/e1",
        "properties": {
            "policyAssignmentId": assignment["id"],
            "exemptionCategory": "Waiver",
            "expiresOn": "2099-12-31T23:59:59Z",
            "description": "Legacy workload waiver",
        },
    }
    mapping = {
        "policyAssignments": {"value": [assignment]},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": {
            "value": [definition]
        },
        "/providers/Microsoft.Authorization/policyDefinitions": {"value": []},
        "policyExemptions": {"value": [exemption]},
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    f = env["findings"][0]
    assert f["classification"] == "informational"
    assert f["exemption"]["exemptionCategory"] == "Waiver"
    assert env["discovery_summary"]["exempted_count"] == 1
    assert env["discovery_summary"]["blocker_count"] == 0


def test_initiative_inherited_from_management_group():
    assignment = {
        "id": "/providers/Microsoft.Management/managementGroups/corp/providers/Microsoft.Authorization/policyAssignments/baseline",
        "name": "baseline",
        "properties": {
            "displayName": "Corp Baseline",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policySetDefinitions/corp-baseline",
            "scope": "/providers/Microsoft.Management/managementGroups/corp",
        },
    }
    member_def = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/req-tags",
        "name": "req-tags",
        "properties": {
            "displayName": "Require tag Environment",
            "metadata": {"category": "Tags"},
            "policyRule": {
                "if": {
                    "field": "tags['Environment']",
                    "exists": "false",
                },
                "then": {"effect": "Deny"},
            },
        },
    }
    initiative = {
        "id": "/providers/Microsoft.Authorization/policySetDefinitions/corp-baseline",
        "name": "corp-baseline",
        "properties": {
            "policyDefinitions": [
                {
                    "policyDefinitionId": member_def["id"],
                    "policyDefinitionReferenceId": "m1",
                }
            ]
        },
    }
    mapping = {
        "policyAssignments": {"value": [assignment]},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
        "/subscriptions/s/providers/Microsoft.Authorization/policySetDefinitions": EMPTY,
        # MG-inherited initiative lives at tenant scope; discover.py fetches
        # it individually after seeing the assignment reference it.
        "/providers/Microsoft.Authorization/policySetDefinitions/corp-baseline": initiative,
        "/providers/Microsoft.Authorization/policyDefinitions/req-tags": member_def,
        "policyExemptions": EMPTY,
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    assert env["discovery_summary"]["management_group_inherited_count"] == 1
    assert len(env["findings"]) == 1
    f = env["findings"][0]
    assert f["classification"] == "blocker"
    assert f["category"] == "Tags"
    assert f["bicepPropertyPath"] == "resourceGroups::tags"
    assert f["pathSemantics"] == "tag-policy-non-property"


def test_category_defaults_to_uncategorized_when_missing():
    assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/custom",
        "name": "custom",
        "properties": {
            "displayName": "Custom",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/custom",
            "scope": "/subscriptions/s",
        },
    }
    definition = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/custom",
        "name": "custom",
        "properties": {
            "displayName": "Legacy custom def",
            # No metadata.category
            "policyRule": {
                "if": {"field": "type", "equals": "Microsoft.KeyVault/vaults"},
                "then": {"effect": "Deny"},
            },
        },
    }
    mapping = {
        "policyAssignments": {"value": [assignment]},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": {
            "value": [definition]
        },
        "/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    assert env["findings"][0]["category"] == "Uncategorized"


def test_audit_and_disabled_excluded_from_findings_but_counted():
    definition_audit = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/audit",
        "name": "audit",
        "properties": {
            "displayName": "Audit storage",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                "then": {"effect": "Audit"},
            },
        },
    }
    definition_disabled = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/disabled",
        "name": "disabled",
        "properties": {
            "displayName": "Disabled",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                "then": {"effect": "Disabled"},
            },
        },
    }
    assignments = [
        {
            "id": f"/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/{suffix}",
            "name": suffix,
            "properties": {
                "displayName": suffix,
                "policyDefinitionId": d["id"],
                "scope": "/subscriptions/s",
            },
        }
        for suffix, d in (("audit", definition_audit), ("disabled", definition_disabled))
    ]
    mapping = {
        "policyAssignments": {"value": assignments},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": {
            "value": [definition_audit, definition_disabled]
        },
        "/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    assert env["findings"] == []
    assert env["discovery_summary"]["audit_count"] == 1
    assert env["discovery_summary"]["disabled_count"] == 1


def test_pagination_follows_next_link():
    page1 = {
        "value": [
            {
                "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/a1",
                "name": "a1",
                "properties": {
                    "displayName": "a1",
                    "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/p1",
                    "scope": "/subscriptions/s",
                },
            }
        ],
        "nextLink": "https://management.azure.com/next-page-2",
    }
    page2 = {
        "value": [
            {
                "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/a2",
                "name": "a2",
                "properties": {
                    "displayName": "a2",
                    "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/p1",
                    "scope": "/subscriptions/s",
                },
            }
        ]
    }
    defn = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/p1",
        "name": "p1",
        "properties": {
            "displayName": "p1",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                "then": {"effect": "Deny"},
            },
        },
    }

    calls: list[str] = []

    def fake(url: str) -> dict[str, Any]:
        calls.append(url)
        if "next-page-2" in url:
            return page2
        if "policyAssignments" in url:
            return page1
        if "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions" in url:
            return {"value": [defn]}
        return EMPTY

    env = discover.discover("s", project="p", az_rest=fake)
    assert len(env["assignment_inventory"]) == 2
    assert len(env["findings"]) == 2
    assert any("next-page-2" in u for u in calls)


def test_property_path_extraction_for_storage_tls():
    assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/tls",
        "name": "tls",
        "properties": {
            "displayName": "TLS",
            "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/tls",
            "scope": "/subscriptions/s",
        },
    }
    definition = {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/tls",
        "name": "tls",
        "properties": {
            "displayName": "Require TLS 1.2",
            "metadata": {"category": "Storage"},
            "parameters": {
                "minimumTlsVersion": {"defaultValue": "TLS1_2"},
            },
            "policyRule": {
                "if": {
                    "allOf": [
                        {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                        {
                            "field": "Microsoft.Storage/storageAccounts/minimumTlsVersion",
                            "notEquals": "TLS1_2",
                        },
                    ]
                },
                "then": {"effect": "Deny"},
            },
        },
    }
    mapping = {
        "policyAssignments": {"value": [assignment]},
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": {
            "value": [definition]
        },
        "/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
    }
    env = discover.discover("s", project="p", az_rest=_router(mapping))
    f = env["findings"][0]
    assert f["azurePropertyPath"] == "storageAccounts.minimumTlsVersion"
    assert f["bicepPropertyPath"] == "storageAccounts::minimumTlsVersion"
    assert f["required_value"] == "TLS1_2"


# --------------------------------------------------------------------------- #
# CLI-level tests                                                             #
# --------------------------------------------------------------------------- #


def test_cli_cache_hit_short_circuits(tmp_path, capsys, monkeypatch):
    out = tmp_path / "04-governance-constraints.json"
    out.write_text(
        json.dumps(
            {
                "schema_version": "governance-constraints-v1",
                "subscription_id": "s",
                "discovered_at": "2026-01-01T00:00:00Z",
                "discovery_status": "COMPLETE",
                "discovery_summary": {
                    "assignment_total": 5,
                    "blocker_count": 1,
                    "auto_remediate_count": 1,
                    "exempted_count": 0,
                },
                "findings": [],
            }
        )
    )
    # Guard against ever calling az — the cache hit must short-circuit.
    monkeypatch.setattr(discover, "_default_get_subscription", lambda: pytest.fail("should not call az"))
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("should not call az"))

    rc = discover.main(["--project", "p", "--out", str(out)])
    captured = capsys.readouterr()
    first_line = captured.out.splitlines()[0]
    status = json.loads(first_line)
    assert rc == 0
    assert status["status"] == "COMPLETE"
    assert status["cache_hit"] is True
    assert status["blockers"] == 1
    assert status["auto_remediate"] == 1


def test_cli_refresh_bypasses_cache_and_writes_fresh_envelope(tmp_path, capsys, monkeypatch):
    out = tmp_path / "04-governance-constraints.json"
    out.write_text('{"discovery_status":"COMPLETE","findings":[]}')

    mapping = {
        "policyAssignments": EMPTY,
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
        "/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
        "policyExemptions": EMPTY,
    }
    monkeypatch.setattr(discover, "_default_get_subscription", lambda: "s")
    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    monkeypatch.setattr(discover, "_default_az_rest", _router(mapping))

    rc = discover.main(["--project", "p", "--out", str(out), "--refresh"])
    captured = capsys.readouterr()
    status = json.loads(captured.out.splitlines()[0])
    assert rc == 0
    assert status["cache_hit"] is False
    assert status["assignment_total"] == 0

    # Fresh envelope includes schema_version.
    fresh = json.loads(out.read_text())
    assert fresh["schema_version"] == "governance-constraints-v1"
    assert fresh["project"] == "p"


def test_status_line_is_valid_json_and_first(tmp_path, capsys, monkeypatch):
    out = tmp_path / "04-governance-constraints.json"
    mapping = {
        "policyAssignments": EMPTY,
        "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
        "/providers/Microsoft.Authorization/policyDefinitions": EMPTY,
        "policyExemptions": EMPTY,
    }
    monkeypatch.setattr(discover, "_default_get_subscription", lambda: "s")
    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    monkeypatch.setattr(discover, "_default_az_rest", _router(mapping))

    rc = discover.main(["--project", "p", "--out", str(out)])
    captured = capsys.readouterr()
    lines = captured.out.splitlines()
    assert rc == 0
    # First line must parse as JSON with a `status` field.
    parsed = json.loads(lines[0])
    assert parsed["status"] in {"COMPLETE", "PARTIAL", "FAILED"}
    # No JSON envelopes or raw REST payloads in stdout.
    joined = "\n".join(lines[1:])
    assert not re.search(r'"policyAssignments"', joined)


# --------------------------------------------------------------------------- #
# Perf-optimization tests (parallel fetch + skip tenant-wide list)            #
# --------------------------------------------------------------------------- #


def test_skips_tenant_wide_definition_list_when_no_tenant_refs():
    """When every assignment references sub-scope definitions, discover.py
    must NOT issue a tenant-wide `policyDefinitions` list call.
    """
    assignment = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/local",
        "name": "local",
        "properties": {
            "displayName": "Local",
            "policyDefinitionId": "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions/local-deny",
            "scope": "/subscriptions/s",
        },
    }
    definition = {
        "id": "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions/local-deny",
        "name": "local-deny",
        "properties": {
            "displayName": "Local deny",
            "metadata": {"category": "Storage"},
            "policyRule": {
                "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                "then": {"effect": "Deny"},
            },
        },
    }
    calls: list[str] = []

    def spy(url: str) -> dict[str, Any]:
        calls.append(url)
        if "policyAssignments" in url:
            return {"value": [assignment]}
        if "/subscriptions/s/providers/Microsoft.Authorization/policyDefinitions" in url:
            return {"value": [definition]}
        if "/subscriptions/s/providers/Microsoft.Authorization/policySetDefinitions" in url:
            return EMPTY
        if "policyExemptions" in url:
            return EMPTY
        return EMPTY

    env = discover.discover("s", project="p", az_rest=spy)
    assert len(env["findings"]) == 1
    # Zero calls against the tenant-wide built-in list — that's the win.
    tenant_list_calls = [
        u for u in calls
        if "/providers/Microsoft.Authorization/policyDefinitions?" in u
        and "/subscriptions/" not in u
    ]
    assert tenant_list_calls == [], f"unexpected tenant-wide list calls: {tenant_list_calls}"


def test_fetches_only_referenced_tenant_definitions():
    """Two assignments referencing two distinct tenant-built-in definitions
    must trigger exactly two individual GETs — not a list scan.
    """
    def _assignment(suffix: str, ref: str) -> dict[str, Any]:
        return {
            "id": f"/subscriptions/s/providers/Microsoft.Authorization/policyAssignments/{suffix}",
            "name": suffix,
            "properties": {
                "displayName": suffix,
                "policyDefinitionId": ref,
                "scope": "/subscriptions/s",
            },
        }

    def _definition(name: str) -> dict[str, Any]:
        return {
            "id": f"/providers/Microsoft.Authorization/policyDefinitions/{name}",
            "name": name,
            "properties": {
                "displayName": name,
                "metadata": {"category": "Security"},
                "policyRule": {
                    "if": {"field": "type", "equals": "Microsoft.KeyVault/vaults"},
                    "then": {"effect": "Deny"},
                },
            },
        }

    refs = [
        "/providers/Microsoft.Authorization/policyDefinitions/require-kv-purge",
        "/providers/Microsoft.Authorization/policyDefinitions/require-kv-rbac",
    ]
    calls: list[str] = []

    def spy(url: str) -> dict[str, Any]:
        calls.append(url)
        if "policyAssignments" in url:
            return {"value": [_assignment("a1", refs[0]), _assignment("a2", refs[1])]}
        for ref in refs:
            if ref in url:
                return _definition(ref.rsplit("/", 1)[-1])
        return EMPTY

    env = discover.discover("s", project="p", az_rest=spy)
    assert len(env["findings"]) == 2
    individual_gets = [
        u for u in calls
        if any(ref in u for ref in refs)
    ]
    assert len(individual_gets) == 2, f"expected 2 individual GETs, got {individual_gets}"
