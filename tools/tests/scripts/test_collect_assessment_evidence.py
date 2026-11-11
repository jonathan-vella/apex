"""Unit tests for tools/scripts/collect-assessment-evidence.py and scope.rg_attribution."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location(
    "collect_assessment_evidence",
    ROOT / "tools/scripts/collect-assessment-evidence.py",
)
assert SPEC and SPEC.loader
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)

SUB1 = "706f47e8-f430-4395-8dfc-fafba699c850"
SUB2 = "582da6a2-2ecc-4cba-8495-7b3564a46284"


def test_collector_enforces_rg_and_category_bounds_handles_diag_arrays_and_redacts_errors(tmp_path: Path) -> None:
    project = tmp_path / "agent-output/factory-test"
    (project / "_meta").mkdir(parents=True)
    scope_request = {
        "scenario": "requirements_led",
        "source": "azure",
        "receipt": {"owner": "tester", "request_id": "req-1", "approved": True},
        "scope": {
            "categories": ["topology", "configuration", "operations", "policy"],
            "iac_paths": [],
            "azure_scopes": [
                f"/subscriptions/{SUB1}",
                f"/subscriptions/{SUB2}/resourceGroups/rg-spoke",
            ],
            "rg_attribution": {
                "shared_rgs": ["rg-hub"],
                "workload_rgs": ["rg-spoke"],
                "excluded_rgs": ["rg-unrelated"],
            },
        },
        "reporting": {
            "as_of": "2026-11-11T09:00:00.000Z",
            "currency": "USD",
            "periods": [{"id": "previous_month", "kind": "closed_month", "from": "2026-10-01", "to": "2026-10-31"}],
        },
    }
    calls: list[list[str]] = []

    def fake_runner(cmd: list[str]) -> tuple[int, str, str]:
        calls.append(cmd)
        joined = " ".join(cmd)
        if "management.azure.com/subscriptions/" in joined:
            return 0, json.dumps({"subscriptionId": SUB1, "tenantId": "t", "state": "Enabled"}), ""
        if "summarize total=count()" in joined:
            assert "rg-unrelated" in joined or "resourceGroup =~ 'rg-spoke'" in joined
            return 0, json.dumps({"data": [{"total": 1}]}), ""
        if "az" in cmd[0] and cmd[1] == "graph":
            q = cmd[cmd.index("-q") + 1]
            assert "recoveryservices" not in q  # recovery category was NOT authorized!
            if "order by id asc" in q and "skuTier" in q:
                rg = "rg-hub" if SUB1 in cmd else "rg-spoke"
                sub = SUB1 if SUB1 in cmd else SUB2
                return (
                    0,
                    json.dumps(
                        {
                            "data": [
                                {
                                    "id": f"/subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Web/sites/app1",
                                    "name": "app1",
                                    "type": "Microsoft.Web/sites",
                                    "location": "swedencentral",
                                    "subscriptionId": sub,
                                    "resourceGroup": rg,
                                    "skuName": "P0v3",
                                    "skuTier": "Premium0V3",
                                }
                            ]
                        }
                    ),
                    "",
                )
            return 0, json.dumps({"data": []}), ""
        if cmd[:3] == ["az", "monitor", "diagnostic-settings"]:
            # Bare array response shape from Azure CLI
            return (
                0,
                json.dumps(
                    [
                        {
                            "name": "send-to-law",
                            "workspaceId": f"/subscriptions/{SUB1}/resourceGroups/rg-hub/providers/Microsoft.OperationalInsights/workspaces/law",
                            "logs": [{"category": "AppServiceHTTPLogs", "enabled": True}],
                            "metrics": [{"category": "AllMetrics", "enabled": False}],
                        }
                    ]
                ),
                "",
            )
        if cmd[:3] == ["az", "policy", "assignment"]:
            if SUB2 in cmd:
                return 1, "", f"AuthorizationFailed for {SUB2} Bearer secret.jwt.token AccountKey=supersecret"
            return 0, json.dumps([{"id": "p1", "name": "pol", "enforcementMode": "Default"}]), ""
        raise AssertionError(f"Unexpected command: {cmd}")

    contract = collector.collect_assessment_evidence(
        project,
        scope_request,
        runner=fake_runner,
        collected_at="2026-11-11T09:00:00.000Z",
    )
    assert contract["coverage"] == "partial"
    assert len(contract["checks"]) == 8  # 2 scopes * 4 authorized categories
    assert not any(check["category"] == "recovery" for check in contract["checks"])

    pol_fail = next(c for c in contract["checks"] if c["category"] == "policy" and SUB2 in c["scope"])
    assert pol_fail["status"] == "unknown"
    assert "secret.jwt.token" not in pol_fail["evidence"]
    assert "supersecret" not in pol_fail["evidence"]
    assert SUB2 not in pol_fail["evidence"]

    # Validate exact compatibility with apex_recall.assessment.validate_evidence
    import sys

    sys.path.insert(0, str(ROOT / "tools/apex-recall/src"))
    from apex_recall import assessment

    assessment.validate_scope(scope_request)
    assessment.validate_evidence(contract, scope_request)

    # Disjoint rg_attribution enforcement (including bare vs qualified aliases) and excluded RG scope rejection
    bad_scope = json.loads(json.dumps(scope_request))
    bad_scope["scope"]["rg_attribution"]["excluded_rgs"] = ["RG-HUB"]
    with pytest.raises(ValueError, match="disjoint"):
        assessment.validate_scope(bad_scope)

    alias_overlap = json.loads(json.dumps(scope_request))
    alias_overlap["scope"]["rg_attribution"]["excluded_rgs"] = [f"/subscriptions/{SUB1}/resourceGroups/rg-hub"]
    with pytest.raises(ValueError, match="disjoint"):
        assessment.validate_scope(alias_overlap)

    excluded_target = json.loads(json.dumps(scope_request))
    excluded_target["scope"]["rg_attribution"]["workload_rgs"] = []
    excluded_target["scope"]["rg_attribution"]["excluded_rgs"] = ["rg-spoke"]
    with pytest.raises(ValueError, match="excluded_rgs"):
        assessment.validate_scope(excluded_target)
    with pytest.raises(ValueError, match="excluded_rgs"):
        collector.collect_assessment_evidence(project, excluded_target, runner=fake_runner)


def test_policy_only_and_rg_only_scopes_do_not_run_arg_inventory_or_subscription_root_reads(tmp_path: Path) -> None:
    project = tmp_path / "agent-output/pol-only"
    (project / "_meta").mkdir(parents=True)
    req = {
        "scenario": "evidence_only",
        "source": "azure",
        "receipt": {"owner": "tester", "request_id": "req-pol", "approved": True},
        "scope": {
            "categories": ["policy"],
            "iac_paths": [],
            "azure_scopes": [f"/subscriptions/{SUB2}/resourceGroups/rg-spoke"],
        },
        "reporting": {
            "as_of": "2026-11-11T09:00:00.000Z",
            "currency": None,
            "periods": [{"id": "previous_month", "kind": "closed_month", "from": "2026-10-01", "to": "2026-10-31"}],
        },
    }
    seen_urls: list[str] = []

    def strict_runner(cmd: list[str]) -> tuple[int, str, str]:
        assert cmd[:2] != ["az", "graph"], "ARG inventory must not run when only policy category is authorized"
        if cmd[:2] == ["az", "rest"]:
            url = cmd[cmd.index("--url") + 1]
            seen_urls.append(url)
            assert "/resourceGroups/rg-spoke?" in url, "RG-only scope must probe RG endpoint, not subscription root"
            return 0, json.dumps({"id": "ok", "location": "swedencentral", "provisioningState": "Succeeded"}), ""
        if cmd[:3] == ["az", "policy", "assignment"]:
            return 0, json.dumps([{"id": "p1", "name": "pol", "enforcementMode": "Default"}]), ""
        raise AssertionError(f"Unexpected cmd: {cmd}")

    out = collector.collect_assessment_evidence(project, req, runner=strict_runner)
    assert out["coverage"] == "complete"
    assert len(seen_urls) == 1
    inv_saved = json.loads((project / "_meta/live-inventory.json").read_text(encoding="utf-8"))
    assert inv_saved["inventories"] == []
