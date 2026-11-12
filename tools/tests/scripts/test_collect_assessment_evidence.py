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


def test_kql_avoids_reserved_kind_alias_projects_server_side_scalars_and_collects_utilization_metrics(
    tmp_path: Path,
) -> None:
    project = tmp_path / "agent-output/metrics-topo"
    (project / "_meta").mkdir(parents=True)
    req = {
        "scenario": "requirements_led",
        "source": "azure",
        "receipt": {"owner": "tester", "request_id": "req-metrics", "approved": True},
        "scope": {
            "categories": ["topology", "configuration", "recovery", "utilization"],
            "iac_paths": [],
            "azure_scopes": [f"/subscriptions/{SUB1}"],
            "rg_attribution": {
                "workload_rgs": ["rg-spoke"],
                "shared_rgs": [],
                "excluded_rgs": ["rg-skip"],
            },
        },
        "reporting": {
            "as_of": "2026-11-11T09:00:00.000Z",
            "currency": "USD",
            "periods": [{"id": "previous_month", "kind": "closed_month", "from": "2026-10-01", "to": "2026-10-31"}],
        },
    }
    vm_id = f"/subscriptions/{SUB1}/resourceGroups/rg-spoke/providers/Microsoft.Compute/virtualMachines/vm-app01"
    sb_id = f"/subscriptions/{SUB1}/resourceGroups/rg-spoke/providers/Microsoft.ServiceBus/namespaces/sb-spoke"
    seen_queries: list[str] = []

    def runner(cmd: list[str]) -> tuple[int, str, str]:
        if cmd[:2] == ["az", "rest"]:
            return (
                0,
                json.dumps(
                    {"subscriptionId": SUB1, "displayName": "gh-workload01", "tenantId": "t", "state": "Enabled"}
                ),
                "",
            )
        if cmd[:2] == ["az", "graph"]:
            q = cmd[cmd.index("-q") + 1]
            seen_queries.append(q)
            assert "kind=tostring(kind)" not in q, "Reserved KQL alias kind=tostring(kind) causes ARG ParserFailure"
            assert "rg-skip" in q, "Every ARG query including child mv-expand must filter out excluded_rgs first"
            if "mv-expand" in q:
                assert q.index("where ") < q.index("mv-expand "), "Scope filter must precede mv-expand"
                assert "limit 1000" in q, "mv-expand must declare an explicit limit above default 128"
                return 0, json.dumps({"data": []}), ""
            if "summarize total=count()" in q:
                return 0, json.dumps({"data": [{"total": 2}]}), ""
            if "resourceKind=tostring(['kind'])" in q:
                return (
                    0,
                    json.dumps(
                        {
                            "data": [
                                {
                                    "id": vm_id,
                                    "name": "vm-app01",
                                    "type": "Microsoft.Compute/virtualMachines",
                                    "location": "swedencentral",
                                    "subscriptionId": SUB1,
                                    "resourceGroup": "rg-spoke",
                                    "skuName": "Standard_D2s_v5",
                                    "skuTier": "Standard",
                                    "resourceKind": "",
                                },
                                {
                                    "id": sb_id,
                                    "name": "sb-spoke",
                                    "type": "Microsoft.ServiceBus/namespaces",
                                    "location": "swedencentral",
                                    "subscriptionId": SUB1,
                                    "resourceGroup": "rg-spoke",
                                    "skuName": "Premium",
                                    "skuTier": "Premium",
                                    "resourceKind": "",
                                },
                            ]
                        }
                    ),
                    "",
                )
            return 0, json.dumps({"data": []}), ""
        if cmd[:3] == ["az", "monitor", "metrics"]:
            assert "--subscription" in cmd and cmd[cmd.index("--subscription") + 1] == SUB1
            res = cmd[cmd.index("--resource") + 1]
            agg_idx = cmd.index("--aggregation") + 1
            if res == sb_id:
                assert cmd[agg_idx] == "Total", "Service Bus metrics must request Total aggregation"
                return (
                    0,
                    json.dumps(
                        {
                            "value": [
                                {
                                    "name": {"value": "IncomingMessages"},
                                    "unit": "Count",
                                    "timeseries": [{"data": [{"total": 42.0}, {"total": 8.0}]}],
                                },
                                {
                                    "name": {"value": "ServerErrors"},
                                    "unit": "Count",
                                    "timeseries": [{"data": [{"total": 0.0}]}],
                                },
                            ]
                        }
                    ),
                    "",
                )
            return (
                0,
                json.dumps(
                    {
                        "value": [
                            {
                                "name": {"value": "Percentage CPU"},
                                "unit": "Percent",
                                "timeseries": [
                                    {"data": [{"average": 12.5, "maximum": 44.0}, {"average": 15.5, "maximum": 52.0}]}
                                ],
                            }
                        ]
                    }
                ),
                "",
            )
        raise AssertionError(f"Unexpected cmd: {cmd}")

    contract = collector.collect_assessment_evidence(
        project, req, runner=runner, collected_at="2026-11-11T09:00:00.000Z"
    )
    assert set(contract.keys()) == {"coverage", "checks"}
    assert contract["coverage"] == "complete"
    inv = json.loads((project / "_meta/live-inventory.json").read_text(encoding="utf-8"))
    assert inv["inventories"][0]["subscription_name"] == "gh-workload01"
    metrics_doc = json.loads((project / "_meta/metrics-evidence.json").read_text(encoding="utf-8"))
    vm_metrics = metrics_doc["utilization"][0]["items"][0]["metrics"]
    sb_metrics = metrics_doc["utilization"][0]["items"][1]["metrics"]
    assert vm_metrics[0] == {
        "metric": "Percentage CPU",
        "unit": "Percent",
        "status": "observed",
        "sample_count": 2,
        "average": 14.0,
        "maximum": 52.0,
        "total": None,
    }
    assert sb_metrics[0]["total"] == 50.0 and sb_metrics[0]["status"] == "observed"
    assert (project / "_meta/scalar-topology.json").is_file()

    # Empty or missing metric samples degrade utilization check to unknown while retaining observed summaries.
    def partial_metrics_runner(cmd: list[str]) -> tuple[int, str, str]:
        if cmd[:3] == ["az", "monitor", "metrics"] and cmd[cmd.index("--resource") + 1] == sb_id:
            return 0, json.dumps({"value": []}), ""
        return runner(cmd)

    partial_contract = collector.collect_assessment_evidence(
        project, req, runner=partial_metrics_runner, collected_at="2026-11-11T09:00:00.000Z"
    )
    partial_util = next(c for c in partial_contract["checks"] if c["category"] == "utilization")
    assert partial_util["status"] == "unknown"
    assert partial_contract["coverage"] == "partial"
    saved_partial_metrics = json.loads((project / "_meta/metrics-evidence.json").read_text(encoding="utf-8"))
    assert saved_partial_metrics["utilization"][0]["items"][0]["metrics"][0]["average"] == 14.0

    # mv-expand truncation (parent subnetCount > returned subnet rows) marks topology unknown.
    vnet_id = f"/subscriptions/{SUB1}/resourceGroups/rg-spoke/providers/Microsoft.Network/virtualNetworks/vnet-big"

    def truncated_topo_runner(cmd: list[str]) -> tuple[int, str, str]:
        if cmd[:2] == ["az", "graph"]:
            q = cmd[cmd.index("-q") + 1]
            if "subnetCount=array_length" in q:
                return (
                    0,
                    json.dumps(
                        {
                            "data": [
                                {
                                    "id": vnet_id,
                                    "name": "vnet-big",
                                    "type": "Microsoft.Network/virtualNetworks",
                                    "resourceGroup": "rg-spoke",
                                    "location": "swedencentral",
                                    "subnetCount": 2,
                                    "peeringCount": 0,
                                    "peConnectionCount": None,
                                }
                            ]
                        }
                    ),
                    "",
                )
            if "mv-expand subnet=properties.subnets" in q:
                return (
                    0,
                    json.dumps(
                        {
                            "data": [
                                {
                                    "vnetId": vnet_id,
                                    "vnetName": "vnet-big",
                                    "resourceGroup": "rg-spoke",
                                    "subnetName": "s1",
                                }
                            ]
                        }
                    ),
                    "",
                )
        return runner(cmd)

    trunc_contract = collector.collect_assessment_evidence(
        project, req, runner=truncated_topo_runner, collected_at="2026-11-11T09:00:00.000Z"
    )
    topo_check = next(c for c in trunc_contract["checks"] if c["category"] == "topology")
    assert topo_check["status"] == "unknown"
    assert "mv-expand" in topo_check["evidence"]

    # Error path in metrics uses allowlisted class without leaking raw secrets.
    def failing_metrics_runner(cmd: list[str]) -> tuple[int, str, str]:
        if cmd[:3] == ["az", "monitor", "metrics"]:
            return 1, "", "AuthorizationFailed Bearer eyJhbGciOiJIUzI1NiJ9.secret"
        return runner(cmd)

    err_contract = collector.collect_assessment_evidence(
        project, req, runner=failing_metrics_runner, collected_at="2026-11-11T09:00:00.000Z"
    )
    util_check = next(c for c in err_contract["checks"] if c["category"] == "utilization")
    assert util_check["status"] == "unknown"
    assert "authorization_denied" in util_check["evidence"]
    assert "eyJhbGci" not in util_check["evidence"]

    # Verify diagnostic-settings --query uses not_null(value, @) and boolean eventHubRuleConfigured.
    ops_req = json.loads(json.dumps(req))
    ops_req["scope"]["categories"] = ["operations"]
    seen_diag_query: list[str] = []

    def ops_runner(cmd: list[str]) -> tuple[int, str, str]:
        if cmd[:3] == ["az", "monitor", "diagnostic-settings"]:
            q = cmd[cmd.index("--query") + 1]
            seen_diag_query.append(q)
            assert "not_null(value, @)" in q
            assert "eventHubAuthorizationRuleId != null" in q
            return 0, "[]", ""
        if cmd[:2] == ["az", "graph"]:
            q = cmd[cmd.index("-q") + 1]
            if "summarize total=count()" in q:
                return 0, json.dumps({"data": [{"total": 1}]}), ""
            if "order by id asc" in q and "operationalinsights" not in q:
                return (
                    0,
                    json.dumps(
                        {
                            "data": [
                                {
                                    "id": f"/subscriptions/{SUB1}/resourceGroups/rg-spoke/providers/Microsoft.Web/sites/app1",
                                    "name": "app1",
                                    "type": "Microsoft.Web/sites",
                                    "location": "swedencentral",
                                    "subscriptionId": SUB1,
                                    "resourceGroup": "rg-spoke",
                                }
                            ]
                        }
                    ),
                    "",
                )
            return 0, json.dumps({"data": []}), ""
        return runner(cmd)

    ops_out = collector.collect_assessment_evidence(
        project, ops_req, runner=ops_runner, collected_at="2026-11-11T09:00:00.000Z"
    )
    assert ops_out["coverage"] == "complete"
    assert len(seen_diag_query) == 1
