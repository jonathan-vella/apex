"""Tests for issue #848: caller-identity requestContext Deny rules and ancestor-MG HTTP 403s.

Covers both Python (`discover.py` + `render_governance.py`) and PowerShell
(`tools/scripts/collect-governance-baseline.ps1`) to verify classification and
structured `unresolved_scopes` parity.
"""

from __future__ import annotations

import importlib
import json
import subprocess
import urllib.error
from email.message import Message
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = ROOT / ".github/skills/apex-azure-governance-discovery/scripts"
PS_COLLECTOR = ROOT / "tools/scripts/collect-governance-baseline.ps1"
SUBSCRIPTION_ID = "00000000-0000-0000-0000-000000000042"


@pytest.fixture
def gov_modules(monkeypatch: pytest.MonkeyPatch) -> tuple[ModuleType, ModuleType]:
    monkeypatch.syspath_prepend(str(SCRIPTS_DIR))
    return importlib.import_module("discover"), importlib.import_module("render_governance")


def _mfa_if_condition() -> dict[str, Any]:
    return {
        "allOf": [
            {"value": "[contains(requestContext().identity, 'idtyp')]", "equals": True},
            {"value": "[requestContext().identity.idtyp]", "equals": "user"},
            {
                "value": "mfa",
                "notIn": (
                    "[split(tryGet(requestContext().identity, "
                    "'http://schemas.microsoft.com/claims/authnmethodsreferences'), ',')]"
                ),
            },
            {"value": "p1", "notIn": "[split(requestContext().identity.acrs, ',')]"},
        ]
    }


def _assignment(
    name: str,
    policy_id: str | None,
    *,
    scope: str = f"/subscriptions/{SUBSCRIPTION_ID}",
    parameters: dict[str, Any] | None = None,
    enforcement_mode: str | None = None,
) -> dict[str, Any]:
    props: dict[str, Any] = {"displayName": name, "scope": scope}
    if policy_id is not None:
        props["policyDefinitionId"] = policy_id
    if parameters:
        props["parameters"] = parameters
    if enforcement_mode:
        props["enforcementMode"] = enforcement_mode
    return {
        "id": f"{scope}/providers/Microsoft.Authorization/policyAssignments/{name}",
        "name": name,
        "properties": props,
    }


def _definition(
    policy_id: str,
    display_name: str,
    if_condition: Any,
    *,
    effect: str = "Deny",
    parameters: dict[str, Any] | None = None,
    category: str = "Security",
) -> dict[str, Any]:
    props: dict[str, Any] = {
        "displayName": display_name,
        "metadata": {"category": category},
        "policyRule": {"if": if_condition, "then": {"effect": effect}},
    }
    if parameters:
        props["parameters"] = parameters
    return {"id": policy_id, "name": policy_id.rsplit("/", 1)[-1], "properties": props}


def _run_ps_process_subscription(mock_spec: dict[str, Any]) -> dict[str, Any]:
    """Dot-source collect-governance-baseline.ps1 and run Process-Subscription against a mock ARM table."""
    import os

    payload = json.dumps(mock_spec)
    ps_script = """
$ErrorActionPreference = 'Stop'
$spec = [Console]::In.ReadToEnd() | ConvertFrom-Json
. $env:APEX_PS_COLLECTOR -ManagementGroupId 'mg-root' -IncludeDefenderAuto

function Invoke-RestMethod {
    param([string]$Uri, [hashtable]$Headers, [string]$Method, $ErrorAction)
    foreach ($rule in $spec.routes) {
        if ($Uri.Contains([string]$rule.match)) {
            if ($rule.PSObject.Properties['status'] -and $null -ne $rule.status -and [int]$rule.status -ge 400) {
                $detail = if ($rule.PSObject.Properties['error']) { [string]$rule.error } else { 'Forbidden' }
                throw "ARM GET $Uri failed: HTTP $($rule.status) $detail"
            }
            return $rule.body
        }
    }
    return [pscustomobject]@{ value = @() }
}

$envelope = Process-Subscription -SubId $env:APEX_SUB_ID -Token 'fake-token'
$envelope | ConvertTo-Json -Depth 30 -Compress
"""
    env = {**os.environ, "APEX_PS_COLLECTOR": str(PS_COLLECTOR), "APEX_SUB_ID": SUBSCRIPTION_ID}
    proc = subprocess.run(
        ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", ps_script],
        input=payload,
        text=True,
        capture_output=True,
        timeout=30,
        env=env,
        check=False,
    )
    assert proc.returncode == 0, f"pwsh Process-Subscription failed:\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    lines = [line for line in proc.stdout.splitlines() if line.strip().startswith("{")]
    assert lines, f"Expected JSON envelope line from pwsh, got: {proc.stdout}"
    return json.loads(lines[-1])


# --------------------------------------------------------------------------- #
# 1. Pure requestContext().identity Deny policies                             #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "label,if_condition",
    [
        ("mfa_write_builtin", _mfa_if_condition()),
        (
            "mfa_delete_negated_anyof",
            {
                "not": {
                    "anyOf": [
                        {"value": "[requestContext()['identity'].idtyp]", "notEquals": "user"},
                        {"value": "mfa", "in": "[split(tryGet(requestContext(), 'identity').acrs, ',')]"},
                    ]
                }
            },
        ),
        (
            "count_over_identity_claims",
            {
                "count": {
                    "value": "[split(requestContext().identity.acrs, ',')]",
                    "name": "claim",
                    "where": {"value": "[current('claim')]", "equals": "p1"},
                },
                "equals": 0,
            },
        ),
    ],
)
def test_pure_caller_identity_rules_flagged_not_blockers(
    gov_modules: tuple[ModuleType, ModuleType],
    tmp_path: Path,
    label: str,
    if_condition: dict[str, Any],
) -> None:
    discover, renderer = gov_modules
    root_scope = "/providers/Microsoft.Management/managementGroups/tenant-root"
    policy_id = f"/providers/Microsoft.Authorization/policyDefinitions/{label}"
    asg = _assignment(
        f"MFA-{label}",
        policy_id,
        scope=root_scope,
        parameters={"effect": {"value": "Deny"}},
    )
    defn = _definition(
        policy_id,
        f"Multi Factor Authentication Enforcement ({label})",
        if_condition,
        effect="[parameters('effect')]",
        parameters={"effect": {"defaultValue": "Audit"}},
    )

    def fake_rest(url: str) -> dict[str, Any]:
        if "policyAssignments" in url:
            return {"value": [asg]}
        if policy_id in url:
            return defn
        return {"value": []}

    py_env = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_rest)
    assert py_env["discovery_status"] == "COMPLETE"
    assert py_env["unresolved_scopes"] == []
    assert py_env["discovery_summary"]["blocker_count"] == 0
    assert py_env["discovery_summary"]["caller_identity_count"] == 1
    finding = py_env["findings"][0]
    assert finding["classification"] == "caller-identity"
    assert finding["identity_only"] is True
    assert finding["azurePropertyPath"] == ""
    assert finding["bicepPropertyPath"] == ""
    assert finding["resource_types"] == []

    # Preview Markdown must not list caller-identity rules under Deployment Blockers.
    preview_path = renderer.emit_preview_md(py_env, tmp_path / "04-governance-constraints.json")
    assert preview_path is not None
    preview_text = preview_path.read_text(encoding="utf-8")
    assert "✅ No deployment blockers detected." in preview_text
    assert "Caller sign-in requirement (requestContext.identity)" in preview_text

    # PowerShell baseline collector parity on the exact same policy rule.
    ps_env = _run_ps_process_subscription(
        {
            "routes": [
                {"match": "policyAssignments?", "body": {"value": [asg]}},
                {"match": f"{policy_id}?", "body": defn},
            ]
        }
    )
    assert ps_env["discovery_status"] == "COMPLETE"
    assert ps_env["discovery_summary"]["blocker_count"] == 0
    assert ps_env["discovery_summary"]["caller_identity_count"] == 1
    assert ps_env["findings"][0]["classification"] == "caller-identity"
    assert ps_env["findings"][0]["identity_only"] is True


def test_exempted_and_do_not_enforce_caller_identity_downgrade_to_informational(
    gov_modules: tuple[ModuleType, ModuleType],
) -> None:
    discover, _ = gov_modules
    policy_id = "/providers/Microsoft.Authorization/policyDefinitions/mfa-write"
    asg_exempt = _assignment("mfa-exempt", policy_id)
    asg_dne = _assignment("mfa-dne", policy_id, enforcement_mode="DoNotEnforce")
    defn = _definition(policy_id, "MFA Write", _mfa_if_condition())
    exemption = {
        "id": f"/subscriptions/{SUBSCRIPTION_ID}/providers/Microsoft.Authorization/policyExemptions/waive-mfa",
        "properties": {
            "policyAssignmentId": asg_exempt["id"],
            "exemptionCategory": "Waiver",
            "expiresOn": "2099-01-01T00:00:00Z",
        },
    }

    def fake_rest(url: str) -> dict[str, Any]:
        if "policyAssignments" in url:
            return {"value": [asg_exempt, asg_dne]}
        if "policyExemptions" in url:
            return {"value": [exemption]}
        if policy_id in url:
            return defn
        return {"value": []}

    env = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_rest)
    assert env["discovery_summary"]["blocker_count"] == 0
    assert env["discovery_summary"]["caller_identity_count"] == 0
    assert env["discovery_summary"]["informational_count"] == 2
    assert all(f["classification"] == "informational" and f["identity_only"] is True for f in env["findings"])


# --------------------------------------------------------------------------- #
# 2. Mixed resource + requestContext() Deny rules fail closed as "blocker"    #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "label,if_condition",
    [
        (
            "mixed_type_and_identity",
            {
                "allOf": [
                    {"field": "type", "equals": "Microsoft.Authorization/roleAssignments"},
                    {"value": "[requestContext().identity.idtyp]", "equals": "user"},
                ]
            },
        ),
        (
            "mixed_field_expr_and_identity_no_field_key",
            {
                "allOf": [
                    {"value": "[requestContext().identity.idtyp]", "equals": "user"},
                    {"value": "[field('Microsoft.Storage/storageAccounts/allowBlobPublicAccess')]", "equals": True},
                ]
            },
        ),
        (
            "mixed_resource_group_fn_and_identity",
            {
                "allOf": [
                    {"value": "[requestContext().identity.idtyp]", "equals": "user"},
                    {"value": "[resourceGroup().location]", "notEquals": "swedencentral"},
                ]
            },
        ),
        (
            "mixed_api_version_and_identity",
            {
                "allOf": [
                    {"value": "[requestContext().identity.idtyp]", "equals": "user"},
                    {"value": "[requestContext().apiVersion]", "less": "2022-01-01"},
                ]
            },
        ),
        (
            "api_version_only_not_caller_identity",
            {"value": "[requestContext().apiVersion]", "less": "2020-01-01"},
        ),
        (
            "count_over_resource_field_and_identity",
            {
                "allOf": [
                    {"value": "[requestContext().identity.idtyp]", "equals": "user"},
                    {
                        "count": {
                            "field": "Microsoft.Network/networkSecurityGroups/securityRules[*]",
                            "where": {"field": "Microsoft.Network/networkSecurityGroups/securityRules[*].access", "equals": "Allow"},
                        },
                        "greater": 0,
                    },
                ]
            },
        ),
    ],
)
def test_mixed_or_non_identity_request_context_rules_fail_closed_as_blocker(
    gov_modules: tuple[ModuleType, ModuleType],
    label: str,
    if_condition: dict[str, Any],
) -> None:
    discover, _ = gov_modules
    policy_id = f"/providers/Microsoft.Authorization/policyDefinitions/{label}"
    asg = _assignment(f"asg-{label}", policy_id)
    defn = _definition(policy_id, f"Mixed rule {label}", if_condition)

    def fake_rest(url: str) -> dict[str, Any]:
        if "policyAssignments" in url:
            return {"value": [asg]}
        if policy_id in url:
            return defn
        return {"value": []}

    py_env = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_rest)
    assert py_env["discovery_status"] == "COMPLETE"
    assert py_env["discovery_summary"]["blocker_count"] == 1
    assert py_env["discovery_summary"]["caller_identity_count"] == 0
    assert py_env["findings"][0]["classification"] == "blocker"
    assert "identity_only" not in py_env["findings"][0]

    ps_env = _run_ps_process_subscription(
        {
            "routes": [
                {"match": "policyAssignments?", "body": {"value": [asg]}},
                {"match": f"{policy_id}?", "body": defn},
            ]
        }
    )
    assert ps_env["discovery_summary"]["blocker_count"] == 1
    assert ps_env["discovery_summary"]["caller_identity_count"] == 0
    assert ps_env["findings"][0]["classification"] == "blocker"
    assert "identity_only" not in ps_env["findings"][0]


# --------------------------------------------------------------------------- #
# 3. Ancestor management-group HTTP 403 structured unresolved_scopes          #
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("error_kind", ["arm_http_error", "urllib_http_error", "runtime_403_string"])
def test_ancestor_mg_definition_and_initiative_403_expose_structured_reason(
    gov_modules: tuple[ModuleType, ModuleType],
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
    error_kind: str,
) -> None:
    discover, _ = gov_modules
    root_scope = "/providers/Microsoft.Management/managementGroups/tenant-root"
    corp_scope = "/providers/Microsoft.Management/managementGroups/mg-corp"

    forbidden_def_id = f"{root_scope}/providers/Microsoft.Authorization/policyDefinitions/root-custom-def"
    forbidden_set_id = f"{root_scope}/providers/Microsoft.Authorization/policySetDefinitions/root-custom-set"
    readable_def_id = f"{corp_scope}/providers/Microsoft.Authorization/policyDefinitions/corp-tls"

    assignments = [
        _assignment("root-def-asg", forbidden_def_id, scope=root_scope),
        _assignment("root-set-asg", forbidden_set_id, scope=root_scope),
        _assignment("corp-tls-asg", readable_def_id, scope=corp_scope),
    ]
    readable_def = _definition(
        readable_def_id,
        "Require TLS 1.2",
        {
            "allOf": [
                {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                {"field": "Microsoft.Storage/storageAccounts/minimumTlsVersion", "notEquals": "TLS1_2"},
            ]
        },
    )

    def _raise_403(url: str) -> None:
        if error_kind == "arm_http_error":
            raise discover.ArmHttpError(url, 403, "Forbidden", "AuthorizationFailed at tenant-root")
        if error_kind == "urllib_http_error":
            raise urllib.error.HTTPError(url, 403, "Forbidden", Message(), None)
        raise RuntimeError(f"ARM GET {url} failed: HTTP 403 Forbidden; AuthorizationFailed")

    def fake_rest(url: str) -> dict[str, Any]:
        if forbidden_def_id in url or forbidden_set_id in url:
            _raise_403(url)
        if readable_def_id in url:
            return readable_def
        if "policyAssignments" in url:
            return {"value": assignments}
        return {"value": []}

    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    monkeypatch.setattr(discover, "_default_az_rest", fake_rest)
    out = tmp_path / "04-governance-constraints.json"
    rc = discover.main(["--project", "issue-848", "--subscription", SUBSCRIPTION_ID, "--out", str(out), "--refresh"])
    assert rc == 1

    status_line = json.loads(capsys.readouterr().out.splitlines()[0])
    envelope = json.loads(out.read_text(encoding="utf-8"))

    expected_unresolved = [
        {
            "reason": "ancestor_scope_forbidden",
            "scope": root_scope,
            "management_group": "tenant-root",
            "surface": "policyDefinitions",
            "resource_id": forbidden_def_id,
            "http_status": 403,
        },
        {
            "reason": "ancestor_scope_forbidden",
            "scope": root_scope,
            "management_group": "tenant-root",
            "surface": "policySetDefinitions",
            "resource_id": forbidden_set_id,
            "http_status": 403,
        },
    ]
    assert status_line["status"] == "PARTIAL"
    assert status_line["unresolved_scopes"] == expected_unresolved
    assert envelope["discovery_status"] == "PARTIAL"
    assert envelope["unresolved_scopes"] == expected_unresolved
    assert envelope["discovery_metadata"]["unresolved_scopes"] == expected_unresolved
    # Readable intermediate-MG blocker is still preserved cleanly.
    assert envelope["discovery_summary"]["blocker_count"] == 1
    assert envelope["findings"][0]["policy_id"] == readable_def_id

    # PowerShell parity on the same scenario.
    ps_env = _run_ps_process_subscription(
        {
            "routes": [
                {"match": f"{forbidden_def_id}?", "status": 403, "error": "AuthorizationFailed"},
                {"match": f"{forbidden_set_id}?", "status": 403, "error": "AuthorizationFailed"},
                {"match": f"{readable_def_id}?", "body": readable_def},
                {"match": "policyAssignments?", "body": {"value": assignments}},
            ]
        }
    )
    assert ps_env["discovery_status"] == "PARTIAL"
    assert ps_env["unresolved_scopes"] == expected_unresolved
    assert ps_env["discovery_metadata"]["unresolved_scopes"] == expected_unresolved
    assert ps_env["discovery_summary"]["blocker_count"] == 1


def test_ancestor_mg_assignment_403_on_stub_and_atscope_fallback(
    gov_modules: tuple[ModuleType, ModuleType],
) -> None:
    discover, _ = gov_modules
    root_scope = "/providers/Microsoft.Management/managementGroups/tenant-root"
    stub_asg_id = f"{root_scope}/providers/Microsoft.Authorization/policyAssignments/root-stub"
    sub_policy_id = f"/subscriptions/{SUBSCRIPTION_ID}/providers/Microsoft.Authorization/policyDefinitions/sub-deny"
    sub_asg = _assignment("sub-deny-asg", sub_policy_id)
    sub_def = _definition(
        sub_policy_id,
        "Deny Classic Compute",
        {"field": "type", "equals": "Microsoft.ClassicCompute/virtualMachines"},
    )

    # Case A: assignment stub at tenant-root MG fails individual GET with HTTP 403.
    stub_asg = {"id": stub_asg_id, "name": "root-stub", "properties": {"scope": root_scope}}

    def fake_stub_403(url: str) -> dict[str, Any]:
        if stub_asg_id in url:
            raise discover.ArmHttpError(url, 403, "Forbidden", "AuthorizationFailed")
        if "policyAssignments" in url:
            return {"value": [stub_asg, sub_asg]}
        if "policyDefinitions?" in url:
            return {"value": [sub_def]}
        return {"value": []}

    env_stub = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_stub_403)
    assert env_stub["discovery_status"] == "PARTIAL"
    assert env_stub["unresolved_scopes"] == [
        {
            "reason": "ancestor_scope_forbidden",
            "scope": root_scope,
            "management_group": "tenant-root",
            "surface": "policyAssignments",
            "resource_id": stub_asg_id,
            "http_status": 403,
        }
    ]
    assert env_stub["discovery_summary"]["blocker_count"] == 1

    # Case A2: when the individual GET on the stub succeeds, self-check compares against
    # the original raw list inventory (no false assignment_inventory_drift) and resolves COMPLETE.
    hydrated_asg = _assignment("root-stub", sub_policy_id, scope=root_scope)

    def fake_stub_ok(url: str) -> dict[str, Any]:
        if stub_asg_id in url:
            return hydrated_asg
        if "policyAssignments" in url:
            return {"value": [stub_asg]}
        if "policyDefinitions?" in url:
            return {"value": [sub_def]}
        return {"value": []}

    env_stub_ok = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_stub_ok)
    assert env_stub_ok["discovery_status"] == "COMPLETE"
    assert env_stub_ok["unresolved_scopes"] == []
    assert env_stub_ok["discovery_summary"]["blocker_count"] == 1

    # Case B: policyAssignments?$filter=atScope() returns HTTP 403 citing ancestor MG scope,
    # falls back to atExactScope() without false inventory drift, and records ancestor_scope_forbidden.
    arm_403_detail = (
        "AuthorizationFailed: The client does not have authorization to perform action "
        f"'Microsoft.Authorization/policyAssignments/read' over scope '{root_scope}'."
    )

    def fake_atscope_403(url: str) -> dict[str, Any]:
        if "policyAssignments?$filter=atScope()" in url:
            raise discover.ArmHttpError(url, 403, "Forbidden", arm_403_detail)
        if "policyAssignments?$filter=atExactScope()" in url:
            return {"value": [sub_asg]}
        if "policyDefinitions?" in url:
            return {"value": [sub_def]}
        return {"value": []}

    env_atscope = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_atscope_403)
    assert env_atscope["discovery_status"] == "PARTIAL"
    assert env_atscope["unresolved_scopes"] == [
        {
            "reason": "ancestor_scope_forbidden",
            "scope": root_scope,
            "management_group": "tenant-root",
            "surface": "policyAssignments",
            "resource_id": root_scope,
            "http_status": 403,
        }
    ]
    assert env_atscope["discovery_summary"]["blocker_count"] == 1

    # PowerShell parity for both Case A and Case B.
    ps_stub = _run_ps_process_subscription(
        {
            "routes": [
                {"match": f"{stub_asg_id}?", "status": 403, "error": "AuthorizationFailed"},
                {"match": "policyAssignments?", "body": {"value": [stub_asg, sub_asg]}},
                {"match": "policyDefinitions?", "body": {"value": [sub_def]}},
            ]
        }
    )
    assert ps_stub["unresolved_scopes"] == env_stub["unresolved_scopes"]

    ps_atscope = _run_ps_process_subscription(
        {
            "routes": [
                {"match": "policyAssignments?$filter=atScope()", "status": 403, "error": arm_403_detail},
                {"match": "policyAssignments?$filter=atExactScope()", "body": {"value": [sub_asg]}},
                {"match": "policyDefinitions?", "body": {"value": [sub_def]}},
            ]
        }
    )
    assert ps_atscope["unresolved_scopes"] == env_atscope["unresolved_scopes"]


def test_subscription_scope_403_is_not_masked_as_ancestor_boundary(
    gov_modules: tuple[ModuleType, ModuleType],
) -> None:
    discover, _ = gov_modules
    sub_scope = f"/subscriptions/{SUBSCRIPTION_ID}"

    def fake_sub_403(url: str) -> dict[str, Any]:
        if "policyAssignments" in url:
            raise discover.ArmHttpError(
                url,
                403,
                "Forbidden",
                f"AuthorizationFailed: missing policyAssignments/read over scope '{sub_scope}'.",
            )
        return {"value": []}

    with pytest.raises(discover.ArmHttpError):
        discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_sub_403)


def test_generated_envelopes_validate_against_governance_constraints_schema(
    gov_modules: tuple[ModuleType, ModuleType],
    tmp_path: Path,
) -> None:
    discover, _ = gov_modules
    root_scope = "/providers/Microsoft.Management/managementGroups/tenant-root"
    mfa_id = "/providers/Microsoft.Authorization/policyDefinitions/mfa-write"
    forbidden_id = f"{root_scope}/providers/Microsoft.Authorization/policyDefinitions/root-secret"

    assignments = [
        _assignment("mfa", mfa_id, scope=root_scope),
        _assignment("secret", forbidden_id, scope=root_scope),
    ]
    mfa_def = _definition(mfa_id, "MFA Write", _mfa_if_condition())

    def fake_rest(url: str) -> dict[str, Any]:
        if forbidden_id in url:
            raise discover.ArmHttpError(url, 403, "Forbidden", "AuthorizationFailed")
        if mfa_id in url:
            return mfa_def
        if "policyAssignments" in url:
            return {"value": assignments}
        return {"value": []}

    envelope = discover.discover(SUBSCRIPTION_ID, project="issue-848", az_rest=fake_rest)
    doc_path = tmp_path / "envelope.json"
    doc_path.write_text(json.dumps(envelope), encoding="utf-8")

    node_check = """
import fs from "node:fs";
import { loadValidator } from "./tools/scripts/_lib/ajv-validator.mjs";
const validate = loadValidator("./tools/schemas/governance-constraints.schema.json");
const doc = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (!validate(doc)) {
  console.error(JSON.stringify(validate.errors, null, 2));
  process.exit(1);
}
"""
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", node_check, str(doc_path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=30,
        check=False,
    )
    assert proc.returncode == 0, f"Schema validation failed:\n{proc.stderr}"
