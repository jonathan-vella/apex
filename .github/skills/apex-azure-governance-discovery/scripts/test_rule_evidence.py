"""Full policy-rule retention and private offline-consumer regressions."""

from __future__ import annotations

import copy
import json
import stat
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import discover  # noqa: E402
import render_cached_governance  # noqa: E402
from test_discover import _router  # noqa: E402

SUBSCRIPTION = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def policy_source():
    definitions = []
    effects = ["Deny", "DeployIfNotExists", "Modify", "Append", "Audit", "AuditIfNotExists", "Disabled"]
    for effect in effects:
        details: dict[str, Any] | list[dict[str, Any]] = {
            "existenceCondition": {"field": "location", "equals": "[parameters('region')]"},
            "existenceScope": "resourceGroup",
            "deploymentScope": "subscription",
            "roleDefinitionIds": ["/providers/Microsoft.Authorization/roleDefinitions/synthetic-role"],
        }
        if effect == "DeployIfNotExists":
            details["deployment"] = {
                "properties": {"template": {"resources": [{"location": "[parameters('region')]"}]}}
            }
        elif effect == "Modify":
            details["operations"] = [
                {"operation": "addOrReplace", "field": "tags[fixture]", "value": "[parameters('region')]"}
            ]
        elif effect == "Append":
            details = [
                {"field": "tags[fixture-region]", "value": "[parameters('region')]"},
                {
                    "field": "Microsoft.Storage/storageAccounts/networkAcls.ipRules",
                    "value": [{"action": "Allow", "value": "192.0.2.0/24"}],
                },
            ]
        definitions.append(
            {
                "id": f"/providers/Microsoft.Authorization/policyDefinitions/{effect}",
                "properties": {
                    "parameters": {"region": {"defaultValue": "default-region"}},
                    "policyRule": {
                        "if": {"field": "type", "equals": "Microsoft.Storage/storageAccounts"},
                        "then": {"effect": effect, "details": details},
                    },
                },
            }
        )
    initiative = {
        "id": "/providers/Microsoft.Management/managementGroups/fixture/providers/"
        "Microsoft.Authorization/policySetDefinitions/fixture",
        "properties": {
            "parameters": {"target": {"defaultValue": "initiative-default"}},
            "policyDefinitions": [
                {
                    "policyDefinitionId": item["id"],
                    "policyDefinitionReferenceId": f"member-{index}",
                    "parameters": {"region": {"value": "[parameters('target')]"}},
                }
                for index, item in enumerate(definitions)
            ],
        },
    }
    assignments = [
        {
            "id": f"/subscriptions/{SUBSCRIPTION}/providers/Microsoft.Authorization/policyAssignments/{index}",
            "properties": {
                "scope": f"/subscriptions/{SUBSCRIPTION}",
                "policyDefinitionId": initiative["id"],
                "parameters": {"target": {"value": region}},
                "notScopes": [f"/subscriptions/{SUBSCRIPTION}/resourceGroups/excluded"],
            },
        }
        for index, region in enumerate(["swedencentral", "germanywestcentral"])
    ]
    mapping = {
        "policyAssignments": {"value": assignments},
        "policyExemptions": {"value": []},
        initiative["id"] + "?": initiative,
        **{item["id"] + "?": item for item in definitions},
    }
    return _router(mapping), assignments, definitions, initiative


def collect(policy_source):
    router, *_ = policy_source
    return discover.discover(SUBSCRIPTION, project="fixture", az_rest=router, retain_rule_evidence=True)


def private_arguments(tmp_path):
    directory = tmp_path / "private"
    directory.mkdir(mode=0o700)
    output = directory / "subscription-1.json"
    return output, ["--project", "fixture", "--subscription", SUBSCRIPTION, "--out", str(output)]


def test_full_rules_and_effective_parameter_lineage_survive_collection(policy_source):
    original = copy.deepcopy(policy_source[1:])
    envelope = collect(policy_source)
    assert envelope["discovery_status"] == "COMPLETE"
    assert discover.rule_evidence_errors(envelope) == []
    evidence = envelope["rule_evidence"]
    assert evidence["assignments"] == original[0]
    assert evidence["definitions"] == sorted(original[1], key=lambda item: item["id"].lower())
    assert evidence["initiatives"] == [original[2]]
    records = evidence["effective_records"]
    assert len(records) == 14
    assert {item["effect"] for item in records} == {
        "Deny",
        "DeployIfNotExists",
        "Modify",
        "Append",
        "Audit",
        "AuditIfNotExists",
        "Disabled",
    }
    for record in records:
        expected = "swedencentral" if record["assignment_id"].endswith("/0") else "germanywestcentral"
        assert record["effective_parameters"]["region"] == expected
        if record["effect"] == "Append":
            assert record["policy_rule"]["then"]["details"][0]["value"] == expected
        else:
            assert record["policy_rule"]["then"]["details"]["existenceCondition"]["equals"] == expected
        assert record["policy_definition_reference_id"].startswith("member-")
    dine = next(item for item in records if item["effect"] == "DeployIfNotExists")
    assert dine["policy_rule"]["then"]["details"]["deployment"]["properties"]["template"]["resources"]
    modify = next(item for item in records if item["effect"] == "Modify")
    assert modify["policy_rule"]["then"]["details"]["operations"][0]["operation"] == "addOrReplace"
    assert policy_source[1:] == original


def test_append_details_arrays_are_retained_without_becoming_deployment_objects(policy_source):
    _, _, definitions, _ = policy_source
    original = copy.deepcopy(next(item for item in definitions if item["id"].endswith("/Append")))
    envelope = collect(policy_source)
    assert envelope["discovery_status"] == "COMPLETE"
    assert discover.rule_evidence_errors(envelope) == []
    evidence = envelope["rule_evidence"]
    assert next(item for item in evidence["definitions"] if item["id"] == original["id"]) == original
    assert evidence["coverage"]["effects"]["Append"] == 2
    records = [item for item in evidence["effective_records"] if item["effect"] == "Append"]
    assert len(records) == 2
    for record in records:
        details = record["policy_rule"]["then"]["details"]
        assert isinstance(details, list)
        assert details[1]["value"] == [{"action": "Allow", "value": "192.0.2.0/24"}]
    assert not any(item["effect"] == "append" for item in envelope["findings"])


@pytest.mark.parametrize(
    "details",
    [
        None,
        {},
        "unresolved-expression",
        [None],
        [{}],
        [{"field": "tags[fixture]"}],
        [{"field": None, "value": "fixture"}],
        [{"field": "", "value": "fixture"}],
        [{"field": " \t", "value": "fixture"}],
        [{"field": ["tags[fixture]"], "value": "fixture"}],
        [{"field": "tags[fixture]", "value": "fixture"}, None],
    ],
)
def test_invalid_append_details_return_partial_instead_of_crashing(policy_source, details):
    router, _, definitions, _ = policy_source
    append = next(item for item in definitions if item["id"].endswith("/Append"))
    append["properties"]["policyRule"]["then"]["details"] = details
    envelope = discover.discover(SUBSCRIPTION, project="fixture", az_rest=router, retain_rule_evidence=True)
    assert envelope["discovery_status"] == "PARTIAL"
    assert envelope["discovery_metadata"]["discovery_status"] == "PARTIAL"
    assert discover.rule_evidence_errors(envelope)


@pytest.mark.parametrize("value", ["", False, 0, None, [], {}, {"nested": [False, 0, None]}])
def test_append_value_presence_does_not_reject_or_coerce_falsy_or_nested_values(policy_source, value):
    _, _, definitions, _ = policy_source
    append = next(item for item in definitions if item["id"].endswith("/Append"))
    append["properties"]["policyRule"]["then"]["details"] = [{"field": "tags[fixture]", "value": value}]
    envelope = collect(policy_source)
    assert envelope["discovery_status"] == "COMPLETE"
    assert discover.rule_evidence_errors(envelope) == []
    records = [item for item in envelope["rule_evidence"]["effective_records"] if item["effect"] == "Append"]
    assert len(records) == 2
    for record in records:
        retained = record["policy_rule"]["then"]["details"][0]["value"]
        assert type(retained) is type(value)
        assert retained == value


@pytest.mark.parametrize("entry", [None, {}, {"field": "tags[fixture]"}])
def test_private_cli_rejects_malformed_append_entries_without_a_complete_status(
    tmp_path,
    monkeypatch,
    capsys,
    policy_source,
    entry,
):
    output, arguments = private_arguments(tmp_path)
    _, _, definitions, _ = policy_source
    append = next(item for item in definitions if item["id"].endswith("/Append"))
    append["properties"]["policyRule"]["then"]["details"] = [entry]
    monkeypatch.setattr(discover, "_default_az_rest", policy_source[0])
    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 1
    assert json.loads(capsys.readouterr().out.splitlines()[0])["status"] == "PARTIAL"
    snapshot = json.loads(output.read_text())
    assert snapshot["discovery_status"] == "PARTIAL"
    assert snapshot["discovery_metadata"]["discovery_status"] == "PARTIAL"
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No readonly Azure retry"))
    assert discover.main(arguments + ["--validate-only", "--retain-rule-evidence"]) != 0


def test_digest_and_recomputed_coverage_detect_tampering(policy_source):
    envelope = collect(policy_source)
    changed = copy.deepcopy(envelope)
    changed["rule_evidence"]["effective_records"][0]["policy_rule"]["if"] = {}
    assert discover.rule_evidence_errors(changed)
    changed = copy.deepcopy(envelope)
    changed["rule_evidence"]["effective_records"] = [
        item for item in changed["rule_evidence"]["effective_records"] if item["effect"] != "Audit"
    ]
    changed["discovery_metadata"]["rule_evidence_sha256"] = discover.rule_evidence_digest(changed["rule_evidence"])
    assert discover.rule_evidence_errors(changed), "An internally rehashed archive cannot drop Audit occurrences"


def test_private_cli_and_cached_renderer_keep_full_evidence(tmp_path, monkeypatch, capsys, policy_source):
    output, arguments = private_arguments(tmp_path)
    monkeypatch.setattr(discover, "_default_az_rest", policy_source[0])
    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 0
    emitted = capsys.readouterr().out
    assert SUBSCRIPTION not in emitted
    assert "policyRule" not in emitted
    original = output.read_bytes()
    assert stat.S_IMODE(output.stat().st_mode) == 0o600
    assert stat.S_IMODE(output.with_suffix(".preview.md").stat().st_mode) == 0o600
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No Azure call during reuse"))
    assert discover.main(arguments + ["--validate-only", "--retain-rule-evidence"]) == 0
    assert output.read_bytes() == original
    rendered = output.with_name("04-governance-constraints.json")
    assert (
        render_cached_governance.main(
            [
                "--in",
                str(output),
                "--out",
                str(rendered),
                "--retain-rule-evidence",
            ]
        )
        == 0
    )
    assert json.loads(rendered.read_text())["rule_evidence"] == json.loads(original)["rule_evidence"]
    assert stat.S_IMODE(rendered.stat().st_mode) == 0o600


def test_summary_cache_requires_explicit_refresh_without_azure_retry(tmp_path, monkeypatch, policy_source):
    output, arguments = private_arguments(tmp_path)
    envelope = collect(policy_source)
    envelope.pop("rule_evidence")
    envelope["discovery_metadata"].pop("rule_evidence_sha256")
    output.write_text(json.dumps(envelope))
    output.chmod(0o600)
    original = output.read_bytes()
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No implicit Azure refresh"))
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 2
    assert discover.main(arguments + ["--validate-only", "--retain-rule-evidence"]) != 0
    assert output.read_bytes() == original


@pytest.mark.parametrize("change", ["expired", "partial", "scope"])
def test_invalid_private_cache_does_not_spend_an_implicit_refresh(tmp_path, monkeypatch, policy_source, change):
    output, arguments = private_arguments(tmp_path)
    envelope = collect(policy_source)
    if change == "expired":
        envelope["discovery_metadata"]["discovered_at"] = "2000-01-01T00:00:00Z"
    elif change == "partial":
        envelope["discovery_status"] = "PARTIAL"
    else:
        envelope["project"] = "another-project"
    output.write_text(json.dumps(envelope))
    output.chmod(0o600)
    original = output.read_bytes()
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No implicit Azure refresh"))
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 2
    assert output.read_bytes() == original


def test_cached_rules_cannot_be_exported_to_a_repository(tmp_path, monkeypatch, policy_source):
    output, arguments = private_arguments(tmp_path)
    monkeypatch.setattr(discover, "_default_az_rest", policy_source[0])
    monkeypatch.setattr(discover, "_default_check_auth", lambda: None)
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 0
    repository = tmp_path / "repository"
    repository.mkdir(mode=0o700)
    (repository / ".git").mkdir()
    target = repository / "04-governance-constraints.json"
    assert render_cached_governance.main(["--in", str(output), "--out", str(target)]) == 2
    assert not target.exists()


def test_new_private_snapshot_conforms_to_shared_node_schema(tmp_path, policy_source):
    output, _ = private_arguments(tmp_path)
    output.write_text(json.dumps(collect(policy_source)))
    output.chmod(0o600)
    root = HERE.parents[3]
    script = (
        "import fs from 'node:fs'; import Ajv from 'ajv/dist/2020.js'; import formats from 'ajv-formats';"
        "const ajv = new Ajv({allErrors:true,strict:false});formats(ajv);"
        "const validate=ajv.compile(JSON.parse(fs.readFileSync('tools/schemas/governance-constraints.schema.json')));"
        "if(!validate(JSON.parse(fs.readFileSync(process.argv[1])))){console.error(validate.errors);process.exitCode=1;}"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script, str(output)],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("unsafe", ["repository", "permissions", "symlink", "hardlink"])
def test_private_mode_refuses_unsafe_outputs_before_any_azure_call(tmp_path, monkeypatch, unsafe):
    output, arguments = private_arguments(tmp_path)
    if unsafe == "repository":
        (output.parent / ".git").mkdir()
    elif unsafe == "permissions":
        output.parent.chmod(0o755)
    elif unsafe == "symlink":
        target = tmp_path / "elsewhere.json"
        target.write_text("{}")
        output.symlink_to(target)
    else:
        target = tmp_path / "elsewhere.json"
        target.write_text("{}")
        target.chmod(0o600)
        output.hardlink_to(target)
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No Azure call on unsafe output"))
    monkeypatch.setattr(discover, "_default_get_subscription", lambda: pytest.fail("No account discovery"))
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 2


def test_retention_reuses_collected_objects_without_additional_queries(policy_source):
    router = policy_source[0]
    calls = []

    def observed(url):
        calls.append(url)
        return router(url)

    discover.discover(SUBSCRIPTION, project="fixture", az_rest=observed)
    original_count = len(calls)
    calls.clear()
    discover.discover(SUBSCRIPTION, project="fixture", az_rest=observed, retain_rule_evidence=True)
    assert len(calls) == original_count


@pytest.mark.parametrize("value", ["not-json", "[]"])
def test_unreadable_private_cache_never_triggers_a_live_fallback(tmp_path, monkeypatch, value):
    output, arguments = private_arguments(tmp_path)
    output.write_text(value)
    output.chmod(0o600)
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No implicit Azure refresh"))
    assert discover.main(arguments + ["--retain-rule-evidence"]) == 2
    assert output.read_text() == value


def test_full_rule_refresh_cannot_silently_downgrade_to_summary(tmp_path, monkeypatch, policy_source):
    output, arguments = private_arguments(tmp_path)
    output.write_text(json.dumps(collect(policy_source)))
    output.chmod(0o600)
    original = output.read_bytes()
    monkeypatch.setattr(discover, "_default_check_auth", lambda: pytest.fail("No downgrade collection"))
    assert discover.main(arguments + ["--refresh"]) == 2
    assert output.read_bytes() == original


@pytest.mark.parametrize("effect,field", [("DeployIfNotExists", "deployment"), ("Modify", "operations")])
def test_missing_remediation_bodies_cannot_claim_complete(policy_source, effect, field):
    router, _, definitions, _ = policy_source
    definition = next(item for item in definitions if item["properties"]["policyRule"]["then"]["effect"] == effect)
    del definition["properties"]["policyRule"]["then"]["details"][field]
    envelope = discover.discover(SUBSCRIPTION, project="fixture", az_rest=router, retain_rule_evidence=True)
    assert envelope["discovery_status"] == "PARTIAL"
    assert discover.rule_evidence_errors(envelope)


def test_embedded_arm_templates_keep_their_own_parameter_namespace(policy_source):
    _, _, definitions, _ = policy_source
    dine = next(
        item for item in definitions if item["properties"]["policyRule"]["then"]["effect"] == "DeployIfNotExists"
    )
    deployment = dine["properties"]["policyRule"]["then"]["details"]["deployment"]["properties"]
    deployment["parameters"] = {"region": {"value": "template-owned-region"}}
    deployment["template"]["parameters"] = {"region": {"type": "string", "defaultValue": "template-default"}}
    original_template = copy.deepcopy(deployment["template"])
    envelope = collect(policy_source)
    assert discover.rule_evidence_errors(envelope) == []
    for record in envelope["rule_evidence"]["effective_records"]:
        if record["effect"] == "DeployIfNotExists":
            effective = record["policy_rule"]["then"]["details"]["deployment"]["properties"]
            assert effective["template"] == original_template
            assert effective["template"]["resources"][0]["location"] == "[parameters('region')]"
            assert effective["parameters"]["region"]["value"] == "template-owned-region"
