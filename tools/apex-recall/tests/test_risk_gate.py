"""Signed lab authorizations exercise the real CLI in isolated projects."""

import hashlib
import importlib
import json
import subprocess
from pathlib import Path

import pytest

from .test_transition import _reimport_with_root, _seed_project, _seed_review


def fixture(tmp_path, monkeypatch):
    root = tmp_path / "workspace"
    _reimport_with_root(root)
    project = _seed_project(root, "synthetic")
    writer = importlib.import_module("apex_recall.state_writer")
    cli = importlib.import_module("apex_recall.__main__")
    state = writer.read_state(project / "00-session-state.json")
    state["current_step"] = 4
    state["steps"]["4"] = {"status": "in_progress", "started": "2026-01-01T00:00:00Z"}
    writer.write_state("synthetic", state)
    review = _seed_review(project, "challenge-findings-plan.json")
    refs = []
    names = (
        "04-iac-contract.json",
        "04-policy-property-map.json",
        "04-environment-manifest.json",
        "04-governance-constraints.md",
        "04-governance-constraints.json",
    )
    for name in names:
        (project / name).write_text("{}")
    repo = Path(__file__).resolve().parents[3]
    metadata = subprocess.run(
        [
            "node",
            str(repo / "tools/scripts/validate-challenger-findings.mjs"),
            "--metadata",
            str(project / "04-implementation-plan.md"),
            *[arg for name in names for arg in ("--supporting-input", f"agent-output/synthetic/{name}")],
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=True,
    )
    refs = json.loads(metadata.stdout)["supporting_inputs"]
    finding = {
        "severity": "must_fix",
        "category": "lab-capability",
        "claim": "Limited teaching lab capability",
        "artifact_section": "Lab",
        "evidence": "synthetic independent assessment",
        "impact": "limited lab experience",
        "traces_to": [],
        "suggested_fix": {
            "artifact_path": str(project / "04-implementation-plan.md"),
            "proposed_edit": "add capability",
        },
    }
    finding["id"] = hashlib.sha256(b"lab-capability|Limited teaching lab capability|Lab").hexdigest()[:8]
    review.update(findings=[finding], must_fix_count=1, overall_assessment="NEEDS_REVISION", supporting_inputs=refs)
    sidecar = project / "challenge-findings-plan.json"
    sidecar.write_text(json.dumps(review))
    keypairs = json.loads(
        subprocess.run(
            [
                "node",
                "-e",
                "const c=require('node:crypto'); console.log(JSON.stringify([0,1].map(()=>{const k=c.generateKeyPairSync('ed25519');return {public:k.publicKey.export({type:'spki',format:'pem'}),private:k.privateKey.export({type:'pkcs8',format:'pem'})}})))",
            ],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    )
    window = {"not_before": "2026-01-01T00:00:00Z", "expires_at": "2099-01-01T00:00:00Z"}
    actions = ["plan-complete", "codegen", "code-complete"]

    def reference(target):
        return {"path": str(target.relative_to(root)), "sha256": writer.file_revision(target)}

    def signed(name, document, reviewer=False):
        index = int(reviewer)
        envelope = subprocess.run(
            [
                "node",
                "-e",
                "const fs=require('node:fs'),c=require('node:crypto'),d=JSON.parse(fs.readFileSync(0,'utf8')),p=Buffer.from(JSON.stringify(d.document));console.log(JSON.stringify({schema_version:'risk-envelope-v1',key_id:d.key_id,payload:p.toString('base64'),signature:c.sign(null,p,d.key).toString('base64')}))",
            ],
            input=json.dumps(
                {"document": document, "key_id": "reviewer" if reviewer else "owner", "key": keypairs[index]["private"]}
            ),
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        target = project / name
        target.write_text(envelope)
        return reference(target)

    proof = project / "proof.json"
    proof.write_text('{"synthetic":"independent lab scope evidence"}')
    eligibility = {
        "schema_version": "risk-eligibility-v1",
        "id": "eligibility-1",
        "project": "synthetic",
        "actions": actions,
        **window,
        "review_sha256": writer.file_revision(sidecar),
        "finding_id": finding["id"],
        "classification": "best-practice",
        "rule_reference": "optional lab guidance",
        "applicable_law": False,
        "mandatory_requirement": False,
        "technical_deployment_possible": True,
        "source_evidence": [reference(proof)],
    }
    authorization = {
        "schema_version": "risk-authorization-v1",
        "id": "kit-1",
        "project": "synthetic",
        "scope": {"kind": "kit", "environment": "non-production-lab", "operation": "author isolated lab kit"},
        "actions": actions,
        "issued_at": window["not_before"],
        **window,
        "revocation_conditions": [
            "input-change",
            "scope-change",
            "authority-revoked",
            "authorization-revoked",
            "validity-expired",
        ],
        "authority_evidence": "external grant 1",
        "preserved_reviews": [],
        "bindings": [
            {
                "review": reference(sidecar),
                "artifact": reference(project / "04-implementation-plan.md"),
                "cache_inputs": review["cache_inputs"],
                "supporting_inputs": refs,
                "findings": [
                    {
                        "id": finding["id"],
                        "classification": "best-practice",
                        "rule_reference": "optional lab guidance",
                        "rationale": "remediation infeasible for the exercise",
                        "residual_impact": "limited teaching capability",
                        "owner": "kit owner",
                        "eligibility_evidence": [],
                    }
                ],
            }
        ],
        "obligations": [
            {
                "id": "verify-lab",
                "phase": "before-plan",
                "owner": "kit owner",
                "requirement": "verify isolated non-production scope",
            }
        ],
    }
    trust = {"schema_version": "risk-trust-v1", **window, "revoked_ids": [], "revoked_keys": [], "grants": []}
    for index, roles in enumerate((["kit-maintainer", "human-gate-approver"], ["eligibility-reviewer"])):
        trust["grants"].append(
            {
                "key_id": "reviewer" if index else "owner",
                "principal": "independent reviewer" if index else "maintainer",
                "public_key": keypairs[index]["public"],
                "roles": roles,
                "projects": ["synthetic"],
                "actions": actions,
                "authority_evidence": "external grant 1",
                **window,
                "tenants": [],
                "subscriptions": [],
            }
        )
    trust_file = tmp_path / "trust.json"

    def refresh_trust():
        trust_file.write_text(json.dumps(trust))
        trust_file.chmod(0o600)
        monkeypatch.setenv("APEX_RISK_TRUST_CONFIG", str(trust_file))
        monkeypatch.setenv("APEX_RISK_TRUST_SHA256", writer.file_revision(trust_file))

    def refresh():
        authorization["bindings"][0]["findings"][0]["eligibility_evidence"] = [
            signed("risk-eligibility.json", eligibility, True)
        ]
        auth = signed("risk-authorization.json", authorization)
        approval = {
            "schema_version": "risk-gate-approval-v1",
            "id": "gate-1",
            "project": "synthetic",
            "authorization_sha256": auth["sha256"],
            "actions": actions,
            "approved_at": "2026-02-01T00:00:00Z",
            **window,
            "verified_obligations": [{"id": "verify-lab", "evidence": reference(proof)}],
        }
        signed("risk-gate-approval.json", approval)

    refresh_trust()
    refresh()
    flags = [
        "--risk-authorization",
        str(project / "risk-authorization.json"),
        "--risk-approval",
        str(project / "risk-gate-approval.json"),
    ]
    return locals()


def test_explicit_completion_show_entry_and_replay_agree(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    cli, project = data["cli"], data["project"]
    original = (project / "challenge-findings-plan.json").read_bytes()
    assert cli.main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["review_gate"] == "exception-authorized"
    assert result["unresolved_findings"][0]["severity"] == "must_fix"
    state = (project / "00-session-state.json").read_bytes()
    assert json.loads(state)["decisions"]["plan_status"] == "EXCEPTION_AUTHORIZED"
    assert cli.main(["complete-step", "synthetic", "4", "--json"]) == 0
    assert (project / "00-session-state.json").read_bytes() == state
    assert cli.main(["check-gate", "synthetic", "--action", "codegen", "--json"]) == 0
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["session"]["effective_reviews"]["4"]["gate_status"] == "exception-authorized"
    assert shown["session"]["gate_readiness"]["codegen"]["status"] == "exception-authorized"
    assert shown["session"]["gate_readiness"]["deploy"]["status"] == "blocked"
    assert (project / "00-session-state.json").read_bytes() == state
    assert cli.main(["start-step", "synthetic", "5", "--json"]) == 0
    assert (project / "challenge-findings-plan.json").read_bytes() == original
    state = (project / "00-session-state.json").read_bytes()
    assert cli.main(["start-step", "synthetic", "6", "--json"]) == 2
    assert (project / "00-session-state.json").read_bytes() == state


def test_atomic_transition_authorized_for_both_actions(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    command = ["transition", "synthetic", "--from-step", "4", "--to-step", "5", "--complete", *data["flags"], "--json"]
    assert data["cli"].main(command) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["review_gate"] == result["entry_gate"] == "exception-authorized"
    before = (data["project"] / "00-session-state.json").read_bytes()
    assert data["cli"].main(command) == 0
    assert (data["project"] / "00-session-state.json").read_bytes() == before


def test_plan_only_acceptance_cannot_start_codegen(tmp_path, monkeypatch):
    data = fixture(tmp_path, monkeypatch)
    data["authorization"]["actions"] = ["plan-complete"]
    data["refresh"]()
    assert data["cli"].main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    assert data["cli"].main(["start-step", "synthetic", "5", "--json"]) == 2
    assert state.read_bytes() == before


@pytest.mark.parametrize("operation", ["completion", "transition", "entry", "resume", "check-gate", "ci"])
def test_revoked_saved_authorization_blocks_every_consumer(tmp_path, monkeypatch, capsys, operation):
    data = fixture(tmp_path, monkeypatch)
    assert data["cli"].main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    data["trust"]["revoked_ids"].append("kit-1")
    data["refresh_trust"]()
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    capsys.readouterr()
    if operation == "resume":
        assert data["cli"].main(["show", "synthetic", "--json"]) == 0
        shown = json.loads(capsys.readouterr().out)
        assert shown["session"]["effective_reviews"]["4"]["status"] == "current"
        assert shown["session"]["effective_reviews"]["4"]["gate_status"] == "blocked"
        assert shown["session"]["gate_readiness"]["codegen"]["status"] == "blocked"
    elif operation == "ci":
        repo = Path(__file__).resolve().parents[3]
        result = subprocess.run(
            ["node", str(repo / "tools/scripts/validate-risk-authorizations.mjs"), "synthetic"],
            cwd=data["root"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1, result.stdout + result.stderr
    else:
        command = {
            "completion": ["complete-step", "synthetic", "4", "--json"],
            "transition": ["transition", "synthetic", "--from-step", "4", "--to-step", "5", "--complete", "--json"],
            "entry": ["start-step", "synthetic", "5", "--json"],
            "check-gate": ["check-gate", "synthetic", "--action", "codegen", "--json"],
        }[operation]
        assert data["cli"].main(command) == 2
    assert state.read_bytes() == before


def test_authorization_only_grants_no_approval_or_state_change(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    assert (
        data["cli"].main(
            [
                "check-gate",
                "synthetic",
                "--action",
                "plan-complete",
                "--authorization-only",
                *data["flags"][:2],
                "--json",
            ]
        )
        == 0
    )
    assert json.loads(capsys.readouterr().out)["approval"] is None
    assert state.read_bytes() == before


def test_authorization_expiry_at_commit_is_no_mutation(tmp_path, monkeypatch):
    data = fixture(tmp_path, monkeypatch)
    gate = importlib.import_module("apex_recall.risk_gate")
    original = gate.evaluate_gate

    def expired(*args, **kwargs):
        result = original(*args, **kwargs)
        args[1].validation_deadlines.append("2026-01-01T00:00:00Z")
        return result

    monkeypatch.setattr(gate, "evaluate_gate", expired)
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    assert data["cli"].main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 2
    assert state.read_bytes() == before


@pytest.mark.parametrize("destination", ["1", "2", "3", "3_5", "4", "6", "7"])
def test_plan_authorization_cannot_skip_supported_destination(tmp_path, monkeypatch, destination):
    data = fixture(tmp_path, monkeypatch)
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    assert (
        data["cli"].main(
            [
                "transition",
                "synthetic",
                "--from-step",
                "4",
                "--to-step",
                destination,
                "--complete",
                *data["flags"],
                "--json",
            ]
        )
        == 2
    )
    assert state.read_bytes() == before


def test_evidence_change_during_staging_preserves_state_and_backup(tmp_path, monkeypatch):
    data = fixture(tmp_path, monkeypatch)
    writer = data["writer"]
    state = data["project"] / "00-session-state.json"
    backup = state.with_suffix(".json.bak")
    backup.write_bytes(state.read_bytes())
    before, before_backup = state.read_bytes(), backup.read_bytes()
    fsync = writer.os.fsync

    def mutate(descriptor):
        fsync(descriptor)
        data["proof"].write_text("changed after staging")

    monkeypatch.setattr(writer.os, "fsync", mutate)
    assert data["cli"].main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 2
    assert state.read_bytes() == before
    assert backup.read_bytes() == before_backup


@pytest.mark.parametrize("command", ["complete-step", "transition"])
def test_default_plan_missing_review_bypass_is_preserved(tmp_path, monkeypatch, command):
    data = fixture(tmp_path, monkeypatch)
    (data["project"] / "challenge-findings-plan.json").unlink()
    args = (
        [command, "synthetic", "4"]
        if command == "complete-step"
        else [command, "synthetic", "--from-step", "4", "--to-step", "5", "--complete"]
    )
    assert (
        data["cli"].main(
            [*args, "--allow-missing-challenger", "--challenger-skip-reason", "explicit fixture skip", "--json"]
        )
        == 0
    )
    assert data["cli"].main(["check-gate", "synthetic", "--action", "codegen", "--json"]) == 0
    assert data["cli"].main(["start-step", "synthetic", "5", "--json"]) == 0


def test_default_audited_skip_never_waives_invalid_present_review(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    path = data["project"] / "challenge-findings-plan.json"
    original = path.read_bytes()
    path.unlink()
    assert (
        data["cli"].main(
            [
                "complete-step",
                "synthetic",
                "4",
                "--allow-missing-challenger",
                "--challenger-skip-reason",
                "fixture",
                "--json",
            ]
        )
        == 0
    )
    capsys.readouterr()
    assert data["cli"].main(["show", "synthetic", "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["session"]["effective_reviews"]["4"]["review_skip"] is True
    assert shown["session"]["gate_readiness"]["codegen"]["status"] == "current"
    path.write_bytes(original)
    before = (data["project"] / "00-session-state.json").read_bytes()
    assert data["cli"].main(["start-step", "synthetic", "5", "--json"]) == 2
    assert (data["project"] / "00-session-state.json").read_bytes() == before


def test_selected_review_authorization_pins_preserved_original(tmp_path, monkeypatch):
    data = fixture(tmp_path, monkeypatch)
    original = data["project"] / "challenge-findings-plan.json"
    selected = data["project"] / "challenge-findings-plan-pass2.json"
    document = json.loads(original.read_text())
    document["pass_number"] = 2
    selected.write_text(json.dumps(document))
    ref = {"path": str(selected.relative_to(data["root"])), "sha256": data["writer"].file_revision(selected)}
    data["authorization"]["preserved_reviews"] = [
        {"path": str(original.relative_to(data["root"])), "sha256": data["writer"].file_revision(original)}
    ]
    data["authorization"]["bindings"][0]["review"] = ref
    data["eligibility"]["review_sha256"] = ref["sha256"]
    data["refresh"]()
    assert (
        data["cli"].main(
            [
                "complete-step",
                "synthetic",
                "4",
                *data["flags"],
                "--plan-review",
                str(selected),
                "--plan-review-reason",
                "explicit isolated confirmation",
                "--json",
            ]
        )
        == 0
    )
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    original.write_text(original.read_text() + " ")
    assert data["cli"].main(["check-gate", "synthetic", "--action", "codegen", "--json"]) == 2
    assert data["cli"].main(["complete-step", "synthetic", "4", "--json"]) == 2
    assert state.read_bytes() == before


def test_replacement_action_authorization_agrees_with_show_handoff_and_ci(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    _seed_review(data["project"], "challenge-findings-governance-constraints-pass1.json")
    cli = data["cli"]
    assert cli.main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    data["trust"]["revoked_ids"].append("kit-1")
    data["refresh_trust"]()
    data["authorization"]["id"] = "codegen-2"
    data["authorization"]["actions"] = ["codegen", "code-complete"]
    data["refresh"]()
    assert cli.main(["start-step", "synthetic", "5", *data["flags"], "--json"]) == 0
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    shown = json.loads(capsys.readouterr().out)
    assert shown["session"]["effective_reviews"]["4"]["status"] == "current"
    assert shown["session"]["gate_readiness"]["codegen"]["status"] == "exception-authorized"
    repo = Path(__file__).resolve().parents[3]
    result = subprocess.run(
        ["node", str(repo / "tools/scripts/validate-risk-authorizations.mjs"), "synthetic"],
        cwd=data["root"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    rendered = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import fs from 'node:fs'; const modulePath=process.argv[1]; process.argv[1]='isolated-probe'; const module = await import(modulePath);console.log(module.renderHandoff(JSON.parse(fs.readFileSync(0,'utf8')), {owner:'06b-Bicep CodeGen', operation:'codegen only'}));",
            str(repo / "tools/scripts/render-session-handoff.mjs"),
        ],
        input=json.dumps(shown),
        capture_output=True,
        text=True,
        check=False,
    )
    assert rendered.returncode == 0, rendered.stderr
    assert "risk-accepted, not closed" in rendered.stdout
    assert cli.main(["complete-step", "synthetic", "5", "--json"]) == 0


@pytest.mark.parametrize("removed", [True, False])
def test_ci_and_runtime_reject_missing_exception_history(tmp_path, monkeypatch, removed):
    data = fixture(tmp_path, monkeypatch)
    assert data["cli"].main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    path = data["project"] / "00-session-state.json"
    state = json.loads(path.read_text())
    if removed:
        del state["risk_authorizations"]
    else:
        state["risk_authorizations"] = {}
    path.write_text(json.dumps(state))
    before = path.read_bytes()
    assert data["cli"].main(["check-gate", "synthetic", "--action", "codegen", "--json"]) != 0
    repo = Path(__file__).resolve().parents[3]
    result = subprocess.run(
        ["node", str(repo / "tools/scripts/validate-risk-authorizations.mjs"), "synthetic"],
        cwd=data["root"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1, result.stdout + result.stderr
    assert path.read_bytes() == before


@pytest.mark.parametrize("command", ["complete-step", "transition"])
@pytest.mark.parametrize(
    "defect",
    [
        "missing",
        "forged",
        "expired",
        "revoked",
        "hash",
        "extra",
        "project",
        "action",
        "production",
        "no-approval",
        "validator",
        "node",
        "authority",
        "law",
        "impossible",
    ],
)
def test_invalid_authorization_never_mutates_state(tmp_path, monkeypatch, command, defect):
    data = fixture(tmp_path, monkeypatch)
    auth = data["authorization"]
    if defect == "expired":
        auth["expires_at"] = "2026-01-02T00:00:00Z"
    if defect == "extra":
        auth["bindings"][0]["findings"].append({**auth["bindings"][0]["findings"][0], "id": "abcdef01"})
    if defect == "project":
        auth["project"] = "other"
    if defect == "action":
        auth["actions"] = ["codegen"]
    if defect == "production":
        auth["scope"]["environment"] = "production"
    if defect == "law":
        data["eligibility"]["applicable_law"] = True
    if defect == "impossible":
        data["eligibility"]["technical_deployment_possible"] = False
    data["refresh"]()
    if defect == "revoked":
        data["trust"]["revoked_ids"].append("kit-1")
        data["refresh_trust"]()
    if defect == "authority":
        monkeypatch.delenv("APEX_RISK_TRUST_CONFIG")
    if defect == "hash":
        data["proof"].write_text("changed")
    if defect == "forged":
        path = data["project"] / "risk-authorization.json"
        envelope = json.loads(path.read_text())
        envelope["signature"] = "AA=="
        path.write_text(json.dumps(envelope))
    flags = data["flags"][:]
    if defect == "missing":
        flags = []
    if defect == "no-approval":
        flags = flags[:2]
    if defect in ("validator", "node"):
        gate = importlib.import_module("apex_recall.risk_gate")

        def unavailable(*args, **kwargs):
            raise OSError("validation unavailable")

        monkeypatch.setattr(gate.subprocess, "run", unavailable)
    state = data["project"] / "00-session-state.json"
    before = state.read_bytes()
    args = (
        [command, "synthetic", "4"]
        if command == "complete-step"
        else [command, "synthetic", "--from-step", "4", "--to-step", "5", "--complete"]
    )
    assert data["cli"].main([*args, *flags, "--json"]) == 2
    assert state.read_bytes() == before


def test_completed_execution_cannot_be_substituted_during_teardown(tmp_path, monkeypatch, capsys):
    data = fixture(tmp_path, monkeypatch)
    cli, writer, project, root = data["cli"], data["writer"], data["project"], data["root"]
    assert cli.main(["complete-step", "synthetic", "4", *data["flags"], "--json"]) == 0
    assert cli.main(["start-step", "synthetic", "5", "--json"]) == 0
    assert cli.main(["complete-step", "synthetic", "5", "--json"]) == 0
    tree = root / "infra/bicep/synthetic"
    tree.mkdir(parents=True)
    (tree / "main.bicep").write_text("param example string")
    parameters = project / "parameters.json"
    parameters.write_text('{"example":"synthetic"}')
    parameter_ref = {"path": str(parameters.relative_to(root)), "sha256": writer.file_revision(parameters)}
    context = {
        "tenant_id": "synthetic-tenant",
        "subscription_id": "synthetic-subscription",
        "event_id": "event-1",
        "environment": "non-production-lab",
        "operation": "deploy synthetic lab",
        "phase": "lab",
        "tree": {"path": str(tree.relative_to(root)), "sha256": writer.file_revision(tree)},
        "tree_hash": writer.file_revision(tree),
        "input_refs": [parameter_ref],
        "inputs_hash": hashlib.sha256(
            json.dumps([[parameter_ref["path"], parameter_ref["sha256"]]], separators=(",", ":")).encode()
        ).hexdigest(),
    }
    context_path = project / "deployment-context.json"
    context_path.write_text(json.dumps(context))
    context_ref = {"path": str(context_path.relative_to(root)), "sha256": writer.file_revision(context_path)}
    actions = ["deploy", "deployment-complete", "teardown-complete"]
    scope = {
        "kind": "deployment",
        "tenant_id": context["tenant_id"],
        "subscription_id": context["subscription_id"],
        "event_id": context["event_id"],
        "environment": context["environment"],
        "operation": context["operation"],
        "event_expires_at": "2098-01-01T00:00:00Z",
        "cleanup_owner": "cleanup owner",
        "teardown_due_at": "2098-02-01T00:00:00Z",
        "deployment_context": context_ref,
    }
    authorization = data["authorization"]
    authorization.update(id="deployment-1", scope=scope, actions=actions)
    data["eligibility"]["actions"] = actions
    authorization["obligations"] = [
        {
            "id": "preflight",
            "phase": "before-deploy",
            "owner": "cleanup owner",
            "requirement": "verify actual lab scope",
        },
        {
            "id": "execution",
            "phase": "after-execution",
            "owner": "cleanup owner",
            "requirement": "observe completed execution",
        },
        {
            "id": "teardown",
            "phase": "after-teardown",
            "owner": "cleanup owner",
            "requirement": "observe actual teardown",
        },
    ]
    data["trust"]["grants"][0]["roles"].append("deployment-risk-owner")
    data["trust"]["grants"][1]["roles"].append("lifecycle-verifier")
    for grant in data["trust"]["grants"]:
        grant["actions"] = actions
        grant["tenants"] = [context["tenant_id"]]
        grant["subscriptions"] = [context["subscription_id"]]
    data["refresh_trust"]()
    eligibility = data["signed"]("deployment-eligibility.json", data["eligibility"], True)
    authorization["bindings"][0]["findings"][0]["eligibility_evidence"] = [eligibility]
    auth = data["signed"]("deployment-authorization.json", authorization)
    proof = {"path": str(data["proof"].relative_to(root)), "sha256": writer.file_revision(data["proof"])}

    def approval(name, action, evidence):
        return data["signed"](
            name,
            {
                "schema_version": "risk-gate-approval-v1",
                "id": name,
                "project": "synthetic",
                "authorization_sha256": auth["sha256"],
                "actions": [action],
                "approved_at": "2026-05-01T00:00:00Z",
                **data["window"],
                "verified_obligations": evidence,
            },
        )

    before_deploy = approval("deploy-approval.json", "deploy", [{"id": "preflight", "evidence": proof}])
    flags = [
        "--risk-authorization",
        str(root / auth["path"]),
        "--risk-approval",
        str(root / before_deploy["path"]),
        "--deployment-context",
        str(context_path),
    ]
    start = importlib.import_module("apex_recall.commands.start_step")
    monkeypatch.setattr(start, "_iso_now", lambda: "2026-03-01T00:00:00Z")
    assert cli.main(["start-step", "synthetic", "6", *flags, "--json"]) == 0

    def receipt(run):
        return data["signed"](
            f"execution-{run}.json",
            {
                "schema_version": "risk-lifecycle-receipt-v1",
                "id": f"execution-{run}",
                "project": "synthetic",
                "actions": actions,
                **data["window"],
                "scope": scope,
                "context_sha256": context_ref["sha256"],
                "execution_id": run,
                "phase": "execution",
                "started_at": "2026-04-01T00:00:00Z",
                "finished_at": "2026-04-01T00:01:00Z",
                "observed_at": "2026-04-01T00:02:00Z",
                "source_evidence": [proof],
            },
            True,
        )

    execution_a = receipt("run-a")
    complete = approval(
        "execution-completion.json",
        "deployment-complete",
        [{"id": "preflight", "evidence": proof}, {"id": "execution", "evidence": execution_a}],
    )
    flags[3] = str(root / complete["path"])
    assert cli.main(["complete-step", "synthetic", "6", *flags, "--json"]) == 0
    state_path = project / "00-session-state.json"
    stored = json.loads(state_path.read_text())["risk_authorizations"]["deployment-complete"]["execution"]
    assert stored["id"] == "run-a" and stored["sha256"] == execution_a["sha256"]
    before = state_path.read_bytes()
    completed_at = json.loads(before)["steps"]["6"]["completed"]

    for run in ("run-a", "run-b"):
        execution = execution_a if run == "run-a" else receipt(run)
        teardown = data["signed"](
            f"teardown-{run}.json",
            {
                "schema_version": "risk-lifecycle-receipt-v1",
                "id": f"teardown-{run}",
                "project": "synthetic",
                "actions": actions,
                **data["window"],
                "scope": scope,
                "context_sha256": context_ref["sha256"],
                "execution_id": run,
                "phase": "teardown",
                "started_at": "2026-04-02T00:00:00Z",
                "finished_at": "2026-04-02T00:01:00Z",
                "observed_at": "2026-04-02T00:02:00Z",
                "source_evidence": [proof],
                "prior_execution": execution,
            },
            True,
        )
        teardown_approval = approval(
            f"teardown-approval-{run}.json",
            "teardown-complete",
            [
                {"id": "preflight", "evidence": proof},
                {"id": "execution", "evidence": execution},
                {"id": "teardown", "evidence": teardown},
            ],
        )
        flags[3] = str(root / teardown_approval["path"])
        assert cli.main(["check-gate", "synthetic", "--action", "teardown-complete", *flags, "--json"]) == (
            0 if run == "run-a" else 2
        )
        assert state_path.read_bytes() == before
    data["trust"]["revoked_ids"].append("deployment-1")
    data["refresh_trust"]()
    authorization.update(id="renewal-1", issued_at="2026-04-01T00:03:00Z", not_before="2026-04-01T00:03:00Z")
    auth = data["signed"]("renewed-authorization.json", authorization)
    renewed_approval = approval(
        "renewed-completion.json",
        "deployment-complete",
        [{"id": "preflight", "evidence": proof}, {"id": "execution", "evidence": execution_a}],
    )
    flags[1] = str(root / auth["path"])
    flags[3] = str(root / renewed_approval["path"])
    assert cli.main(["complete-step", "synthetic", "6", *flags, "--json"]) == 0
    renewed_state = json.loads(state_path.read_text())
    assert renewed_state["risk_authorizations"]["deployment-complete"]["execution"] == stored
    assert renewed_state["steps"]["6"]["completed"] == completed_at
