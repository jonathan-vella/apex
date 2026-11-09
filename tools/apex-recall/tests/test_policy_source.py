"""Corp assumptions cannot become tenant evidence; private scope never enters project artifacts."""

import gzip
import importlib
import json
import stat
import subprocess
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from .test_practical import _feasibility_snapshot, _read_scope, practical_project

TENANT = "11111111-1111-1111-1111-111111111111"
SUBSCRIPTION = "22222222-2222-2222-2222-222222222222"


def baseline(root: Path) -> Path:
    path = root / ".github/data/alz-corp-policy-baseline.json.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(
        gzip.compress(
            json.dumps(
                {
                    "baseline_kind": "alz-corp-default",
                    "coverage_status": "COMPLETE",
                    "subscriptions": {
                        "synthetic": {
                            "source": "alz-corp-default",
                            "discovery_status": "COMPLETE",
                            "discovery_options": {"include_defender_auto": True},
                            "provenance": {"verified_against_tenant": False},
                        }
                    },
                }
            ).encode()
        )
    )
    return path


def provenance() -> list[str]:
    return ["--owner", "platform-owner", "--request-id", "actual-native-response", "--environment", "dev"]


def capture(cli, monkeypatch, tmp_path: Path, capsys) -> dict:
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path.parent / f"{tmp_path.name}-private"))
    assert (
        cli.main(
            [
                "policy-source",
                "synthetic",
                "--tenant",
                TENANT,
                "--subscription",
                SUBSCRIPTION,
                "--authorize-policy-read",
                *provenance(),
                "--json",
            ]
        )
        == 0
    )
    return json.loads(capsys.readouterr().out)


def phase(module, writer, step: str) -> dict:
    data = writer.read_state(writer.session_state_path("synthetic"))
    module.grant_phase(
        data, step, {"request_id": "actual-stage-scope", "input_ids": ["policy_source"], "environments": ["dev"]}
    )
    module.sync_views("synthetic", data, step)
    writer.write_state("synthetic", data)
    return writer.read_state(writer.session_state_path("synthetic"))


def test_explicit_corp_acceptance_allows_architecture_but_not_implementation(tmp_path: Path):
    _, writer, cli, module, _ = practical_project(tmp_path)
    baseline(tmp_path)
    assert cli.main(["policy-source", "synthetic", "--assumed-corp", *provenance(), "--json"]) == 0
    data = phase(module, writer, "2")
    assert module.check_feasibility("synthetic", data) == "assumed_corp_not_tenant_verified"
    module.check_views("synthetic", data, "2")
    for step in ("4", "5", "6"):
        with pytest.raises(ValueError, match="Tenant-verified"):
            module.check_views("synthetic", phase(module, writer, step), step)
    gate = importlib.import_module("apex_recall.risk_gate")
    for step in ("5", "6"):
        with pytest.raises(ValueError, match="Tenant-verified"):
            gate.check_entry("synthetic", data, step, SimpleNamespace())


def test_new_policy_contract_does_not_allow_missing_source_or_silent_assumption(tmp_path: Path):
    _, writer, _, module, record = practical_project(tmp_path)
    data = writer.read_state(writer.session_state_path("synthetic"))
    data["decisions"]["policy_evidence_contract"] = "corp-policy-v1"
    module.grant_phase(data, "2", {"request_id": "stage", "input_ids": [record["input_id"]], "environments": ["dev"]})
    module.sync_views("synthetic", data, "2")
    writer.write_state("synthetic", data)
    with pytest.raises(ValueError, match="explicitly accept Corp"):
        module.check_views("synthetic", writer.read_state(writer.session_state_path("synthetic")), "2")


def test_changed_baseline_requires_new_explicit_acceptance(tmp_path: Path):
    _, writer, cli, module, _ = practical_project(tmp_path)
    path = baseline(tmp_path)
    assert cli.main(["policy-source", "synthetic", "--assumed-corp", *provenance()]) == 0
    path.write_bytes(path.read_bytes() + b"changed")
    with pytest.raises(ValueError, match="missing or changed"):
        module.check_feasibility("synthetic", writer.read_state(writer.session_state_path("synthetic")))


def test_private_capture_uses_real_native_values_without_repository_identifiers(tmp_path: Path, monkeypatch, capsys):
    project, writer, cli, _, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    scope = Path(output["scope_file"])
    assert not scope.is_relative_to(tmp_path)
    assert stat.S_IMODE(scope.stat().st_mode) == 0o600
    assert json.loads(scope.read_text())["subscription_ids"] == [SUBSCRIPTION]
    index = json.loads(Path(output["evidence_path"]).read_text())
    assert index == {"subscriptions": [{"subscription_id": SUBSCRIPTION, "path": "subscription-1.json"}]}
    assert cli.main(["policy-source", "synthetic", "--show-private-scope", "--json"]) == 0
    assert "scope_file" in json.loads(capsys.readouterr().out)
    for path in project.rglob("*"):
        if path.is_file() and path.suffix in (".json", ".md"):
            contents = path.read_text()
            assert TENANT not in contents
            assert SUBSCRIPTION not in contents
    assert SUBSCRIPTION not in json.dumps(output)
    assert writer.read_state(writer.session_state_path("synthetic"))["decisions"]["policy_evidence_contract"]


def test_private_feasibility_binds_real_snapshots_without_public_raw_evidence(tmp_path: Path, monkeypatch, capsys):
    _, writer, cli, module, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    directory = Path(output["directory"])
    snapshot = directory / "subscription-1.json"
    _feasibility_snapshot(tmp_path, snapshot, SUBSCRIPTION)
    snapshot.chmod(0o600)
    index = directory / "04-policy-feasibility.json"
    index.write_text(json.dumps({"subscriptions": [{"subscription_id": SUBSCRIPTION, "path": snapshot.name}]}))
    index.chmod(0o600)
    data = writer.read_state(writer.session_state_path("synthetic"))
    module.bind_feasibility("synthetic", data, index)
    writer.write_state("synthetic", data)
    current = writer.read_state(writer.session_state_path("synthetic"))
    assert module.check_feasibility("synthetic", current) == "current"
    assert SUBSCRIPTION not in json.dumps(current)
    snapshot.write_text(snapshot.read_text().replace("COMPLETE", "PARTIAL"))
    with pytest.raises(ValueError, match="incomplete, stale"):
        module.check_feasibility("synthetic", writer.read_state(writer.session_state_path("synthetic")))


@pytest.mark.parametrize("private", [False, True])
def test_assumed_envelope_cannot_be_bound_as_tenant_verified(tmp_path: Path, monkeypatch, capsys, private):
    project, writer, cli, module, _ = practical_project(tmp_path)
    if private:
        output = capture(cli, monkeypatch, tmp_path, capsys)
        snapshot = Path(output["directory"]) / "subscription-1.json"
    else:
        snapshot = project / "04-policy-feasibility.json"
    envelope = _feasibility_snapshot(tmp_path, snapshot, SUBSCRIPTION)
    envelope["source"] = "alz-corp-default"
    snapshot.write_text(json.dumps(envelope))
    snapshot.chmod(0o600)
    data = writer.read_state(writer.session_state_path("synthetic"))
    if private:
        index = snapshot.with_name("04-policy-feasibility.json")
        index.write_text(json.dumps({"subscriptions": [{"subscription_id": SUBSCRIPTION, "path": snapshot.name}]}))
        index.chmod(0o600)
        snapshot = index
    else:
        _read_scope(module, data, {"subscription_id": SUBSCRIPTION})
    with pytest.raises(ValueError, match="Assumed Corp evidence"):
        module.bind_feasibility("synthetic", data, snapshot)


def test_private_scope_change_and_wrong_current_tenant_block_without_identifier_output(
    tmp_path: Path, monkeypatch, capsys
):
    _, writer, cli, module, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    policy = importlib.import_module("apex_recall.policy_source")
    monkeypatch.setattr(policy.subprocess, "run", Mock(return_value=SimpleNamespace(returncode=0, stdout=SUBSCRIPTION)))
    assert cli.main(["policy-source", "synthetic", "--verify-tenant", "--json"]) == 1
    assert SUBSCRIPTION not in capsys.readouterr().err
    scope = Path(output["scope_file"])
    scope.write_text(scope.read_text().replace(TENANT, SUBSCRIPTION))
    with pytest.raises(ValueError, match="changed or differently authorized"):
        policy.private_scope("synthetic", writer.read_state(writer.session_state_path("synthetic")))


def test_capture_requires_actual_consent_and_rejects_repository_private_store(tmp_path: Path, monkeypatch, capsys):
    _, _, cli, _, _ = practical_project(tmp_path)
    assert (
        cli.main(["policy-source", "synthetic", "--tenant", TENANT, "--subscription", SUBSCRIPTION, *provenance()]) == 1
    )
    capsys.readouterr()
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path / "private"))
    assert (
        cli.main(
            [
                "policy-source",
                "synthetic",
                "--tenant",
                TENANT,
                "--subscription",
                SUBSCRIPTION,
                "--authorize-policy-read",
                *provenance(),
            ]
        )
        == 1
    )
    assert "outside the repository" in capsys.readouterr().err


def test_python_and_node_resolve_only_current_private_governance_contract(tmp_path: Path, monkeypatch, capsys):
    project, writer, cli, _, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    contract = Path(output["directory"]) / "04-governance-constraints.json"
    _feasibility_snapshot(tmp_path, contract, SUBSCRIPTION)
    contract.chmod(0o600)
    assert writer.resolve_contract_path(project, contract.name) == contract
    helper = Path(__file__).resolve().parents[3] / "tools/scripts/_lib/project-paths.mjs"
    command = [
        "node",
        "--input-type=module",
        "-e",
        "const {resolveContractPath}=await import(process.argv[1]);"
        "console.log(resolveContractPath(process.argv[2],process.argv[3]));",
        helper.as_uri(),
        str(project),
        contract.name,
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=True)
    assert result.stdout.strip() == str(contract)
    contract.chmod(0o644)
    with pytest.raises(ValueError, match="owner-only"):
        writer.resolve_contract_path(project, contract.name)
    assert subprocess.run(command, capture_output=True, check=False).returncode != 0


@pytest.mark.parametrize("step", ["5", "6"])
def test_dev_policy_evidence_cannot_start_a_prod_phase(tmp_path: Path, monkeypatch, capsys, step: str):
    _, writer, cli, module, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    directory = Path(output["directory"])
    snapshot = directory / "subscription-1.json"
    _feasibility_snapshot(tmp_path, snapshot, SUBSCRIPTION)
    snapshot.chmod(0o600)
    data = writer.read_state(writer.session_state_path("synthetic"))
    module.bind_feasibility("synthetic", data, Path(output["evidence_path"]))
    module.record_input(
        data,
        {
            "input_id": "prod_work",
            "value": "Approved production work, but no production policy-read authorization",
            "environments": ["prod"],
            "owner": "platform-owner",
            "request_id": "prod-work-request",
        },
    )
    for prerequisite in ("1", "2", "3_5", "4", "5"):
        if prerequisite != step:
            data["steps"].setdefault(prerequisite, {}).update(status="complete", completed_environments=["dev"])
    data["steps"]["3"] = {"status": "skipped"}
    data["steps"][step] = {"status": "pending"}
    module.grant_phase(data, step, {"request_id": "prod-stage", "input_ids": ["prod_work"], "environments": ["prod"]})
    writer.write_state("synthetic", data)
    before = writer.session_state_path("synthetic").read_bytes()
    assert cli.main(["start-step", "synthetic", step, "--json"]) == 2
    assert "policy source/read inputs" in json.loads(capsys.readouterr().out)["error"]
    assert writer.session_state_path("synthetic").read_bytes() == before

    data = writer.read_state(writer.session_state_path("synthetic"))
    module.grant_phase(
        data,
        step,
        {"request_id": "dev-stage", "input_ids": ["policy_source", "azure_read_scope"], "environments": ["dev"]},
    )
    writer.write_state("synthetic", data)
    assert cli.main(["start-step", "synthetic", step, "--json"]) == 0
    assert json.loads(capsys.readouterr().out)["status"] == "in_progress"


def test_verified_policy_entry_requires_an_explicit_consuming_phase(tmp_path: Path, monkeypatch):
    _, writer, _, module, _ = practical_project(tmp_path)
    gate = importlib.import_module("apex_recall.risk_gate")
    monkeypatch.setattr(module, "check_feasibility", lambda *_: "current")
    data = writer.read_state(writer.session_state_path("synthetic"))
    data["decisions"]["policy_evidence_contract"] = "corp-policy-v1"
    for step in ("5", "6"):
        with pytest.raises(ValueError, match="policy-bound phase scope"):
            gate.check_entry("synthetic", data, step, SimpleNamespace())


def test_private_review_digest_and_final_write_watch_exact_scope_evidence(tmp_path: Path, monkeypatch, capsys):
    project, writer, cli, _, _ = practical_project(tmp_path)
    output = capture(cli, monkeypatch, tmp_path, capsys)
    policy = importlib.import_module("apex_recall.policy_source")
    digests = importlib.import_module("apex_recall.input_digest")
    completion = importlib.import_module("apex_recall.commands.complete_step")
    snapshot = Path(output["directory"]) / "subscription-1.json"
    _feasibility_snapshot(tmp_path, snapshot, SUBSCRIPTION)
    snapshot.chmod(0o600)
    reference = f"apex-private-policy://synthetic/{output['scope_ref']}/{snapshot.name}"
    assert policy.resolve_private_reference(reference, tmp_path, project="synthetic") == snapshot
    digest = digests.inputs_digest(tmp_path, [reference])
    (project / "04-governance-constraints.md").write_text("# Governance\nAnonymized summary\n")
    sidecar = project / completion._CHALLENGER_GATE["3_5"][1]
    sidecar.write_text(
        json.dumps({"supporting_inputs": [{"path": reference, "sha256": writer.file_revision(snapshot)}]})
    )
    data = writer.read_state(writer.session_state_path("synthetic"))
    completion.watch_review_inputs(data, "synthetic", "3_5", None)
    assert data.input_revisions[snapshot] == writer.file_revision(snapshot)
    snapshot.write_text(snapshot.read_text() + "\n")
    assert digests.inputs_digest(tmp_path, [reference]) != digest
    with pytest.raises(ValueError, match="changed"):
        writer.write_state("synthetic", data)
    with pytest.raises(ValueError, match="differently scoped"):
        policy.resolve_private_reference(reference, tmp_path, project="other")
    for invalid in (
        reference.replace("/subscription-1.json", "/../scope.json"),
        reference.replace("/synthetic/", "/../"),
        reference.replace(output["scope_ref"], "0" * 32),
    ):
        with pytest.raises(ValueError):
            policy.resolve_private_reference(invalid, tmp_path)
