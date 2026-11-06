"""Standalone assessment routing, real review freshness and preserved historical allowance."""

from __future__ import annotations

import importlib
import json
import shutil
import struct
import subprocess
from datetime import UTC
from pathlib import Path

import pytest

from .test_transition import _reimport_with_root

REPO = Path(__file__).resolve().parents[3]
GRAPH = ".github/skills/apex-workflow-engine/templates/workflow-graph.json"


@pytest.fixture
def assessment_project(tmp_path: Path):
    _reimport_with_root(tmp_path)
    writer = importlib.import_module("apex_recall.state_writer")
    module = importlib.import_module("apex_recall.assessment")
    cli = importlib.import_module("apex_recall.__main__")
    target = tmp_path / GRAPH
    target.parent.mkdir(parents=True)
    shutil.copyfile(REPO / GRAPH, target)
    for source in (
        ".github/agents/_subagents/challenger-review-subagent.agent.md",
        ".github/skills/apex-azure-defaults/references/one-shot-review.md",
        ".github/skills/apex-azure-defaults/references/adversarial-checklists.md",
        ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md",
    ):
        dest = tmp_path / source
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPO / source, dest)
    # Executable tools are shared, while every artifact and state mutation remains isolated.
    (tmp_path / "tools").symlink_to(REPO / "tools", target_is_directory=True)
    directory = tmp_path / "agent-output/synthetic"
    directory.mkdir(parents=True)
    writer.write_state("synthetic", writer.make_template("synthetic"))
    return directory, writer, module, cli


def request(source: str = "iac", scenario: str = "evidence_only") -> dict:
    return {
        "scenario": scenario,
        "source": source,
        "receipt": {"owner": "fixture-owner", "request_id": "actual-fixture-scope", "approved": True},
        "scope": {
            "categories": ["configuration", "topology"],
            "iac_paths": ["infra/fixture"] if source in ("iac", "combined") else [],
            "azure_scopes": (
                ["/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/fixture"]
                if source in ("azure", "combined")
                else []
            ),
        },
        "reporting": {
            "as_of": "2026-11-06T00:00:00Z",
            "periods": [{"id": "previous_month", "from": "2026-10-01", "to": "2026-10-31"}],
            "currency": None,
        },
    }


def invoke(cli, action: str, payload: dict | None = None, phase: str | None = None, *extra: str) -> int:
    args = ["assessment", "synthetic", "--action", action, "--request", json.dumps(payload or {}), "--json"]
    if phase:
        args += ["--phase", phase]
    return cli.main([*args, *extra])


def state(writer):
    return writer.read_state(writer.session_state_path("synthetic"))


def evidence(directory: Path, req: dict) -> None:
    (directory / "contracts").mkdir(exist_ok=True)
    (directory / "01-assessment-brief.md").write_text("# Authorized assessment\nNo implementation authority.\n")
    scopes = req["scope"]["iac_paths"] + req["scope"]["azure_scopes"]
    (directory / "contracts/assessment-evidence.json").write_text(
        json.dumps(
            {
                "coverage": "partial",
                "checks": [
                    {
                        "category": "configuration",
                        "scope": scopes[0],
                        "status": "denied",
                        "evidence": "Fixture denial; no topology or prices inferred",
                    }
                ],
            }
        )
    )


def analysis(directory: Path, req: dict) -> None:
    (directory / "02-architecture-assessment.md").write_text(
        "# WAF report\nHigh workload risk remains disclosed; missing controls are not invented.\n"
    )
    (directory / "03-cost-management-report.md").write_text(
        "# Cost report\nNot assessed: billing denied. No zero charges or fake retail prices.\n"
    )
    module = importlib.import_module("apex_recall.assessment")
    periods = module.cost_periods(req["reporting"])
    evidence = []
    for index, scope in enumerate(req["scope"]["azure_scopes"]):
        for period in periods:
            identity = f"scope{index + 1}-{period['id']}"
            evidence.append(
                {
                    "id": identity,
                    "source_kind": "actual",
                    "status": "not_assessed",
                    "request": {
                        "id": identity,
                        "scope": scope,
                        "operation": "forecast" if period["kind"] == "forecast" else "query",
                        "period": period,
                        "cost_type": req["reporting"].get("cost_type", "ActualCost"),
                        "metric": req["reporting"].get("metric", "PreTaxCost"),
                        "granularity": "Daily",
                        "group_by": []
                        if period["kind"] == "forecast"
                        else req["reporting"].get("group_by", ["ServiceName", "ResourceId"]),
                        **({"expected_currency": req["reporting"]["currency"]} if req["reporting"]["currency"] else {}),
                    },
                    "provenance": None,
                    "series": [],
                    "page_count": 0,
                    "next_request_path": None,
                    "gaps": ["Billing collection was not authorized; no prices invented"],
                }
            )
    (directory / "contracts/03-cost-management.json").write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "as_of": req["reporting"]["as_of"],
                "generated_at": module.datetime.now(UTC).isoformat(timespec="milliseconds"),
                "status": "not_assessed",
                "scopes": req["scope"]["azure_scopes"],
                "periods": periods,
                "evidence": evidence,
                "estimates": [],
                "opportunities": [],
                "exclusions": [],
                "allocation_notes": ["No billing collection or allocation claims"],
                "gaps": ["No authorized cost evidence"],
            }
        )
    )
    writer = importlib.import_module("apex_recall.state_writer")
    run = state(writer).get("assessment_run", {})
    if run.get("action_register"):
        register(directory, req)


def register(directory: Path, req: dict, *, finance: bool = False) -> None:
    module = importlib.import_module("apex_recall.assessment")
    checked = subprocess.run(
        [
            "node",
            str(Path(__file__).with_name("assessment_register_fixture.mjs")),
            str(directory),
            json.dumps(req),
            module.datetime.now(UTC).isoformat(timespec="milliseconds"),
            *(["finance", json.dumps(module.cost_plan(req))] if finance else []),
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    assert checked.returncode == 0, f"{checked.stdout}\n{checked.stderr}"


def diagram(directory: Path) -> None:
    (directory / "assets").mkdir(exist_ok=True)
    (directory / "assets/03-des-diagram.py").write_text('"""Reproducible observed-state diagram fixture."""\n')
    (directory / "assets/03-des-diagram.png").write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + struct.pack(">I", 13)
        + b"IHDR"
        + struct.pack(">II", 20, 20)
        + b"\x08\x02\x00\x00\x00"
        + b"\x00" * 4
    )
    (directory / "assets/03-des-diagram.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0L20 20"/></svg>'
    )


def to_review(fixture, monkeypatch, source: str = "iac", scenario: str = "evidence_only"):
    directory, writer, module, cli = fixture
    req = request(source, scenario)
    assert invoke(cli, "start", req) == 0
    if scenario == "requirements_led":
        (directory / "01-requirements.md").write_text("# Captured business targets\nUnknown recovery target.\n")
        assert invoke(cli, "advance", phase="requirements") == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    assert state(writer)["assessment_run"]["phase"] == "review"
    return directory, writer, module, cli


def seed_reviews(fixture, *, must_fix: bool = False):
    """Seed attributed fixtures, but verify hashes/provenance using the real Node validator."""
    directory, writer, module, _ = fixture
    data = state(writer)
    root = directory.parent.parent
    practical = importlib.import_module("apex_recall.practical")
    for index, (lens, kind) in enumerate(module.LENSES.items()):
        artifact = module.profile()["reviews"][lens]["artifact"]
        primary = f"agent-output/synthetic/{artifact}"
        script = (
            "import {cacheInputs} from './tools/scripts/validate-challenger-findings.mjs';"
            "console.log(JSON.stringify(cacheInputs(process.argv[1],process.cwd(),'challenger-review-subagent')))"
        )
        metadata = subprocess.run(
            ["node", "--input-type=module", "-e", script, primary],
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        )
        identity = f"fixture-review-{index}"
        req = {"step": "2", "artifact_path": primary, "review_focus": lens, "pass_number": 1}
        key = practical.cycle_identity(req)
        supporting = [
            {"path": f"agent-output/synthetic/{relative}", "sha256": sha}
            for relative, sha in data["assessment_run"]["frozen_inputs"].items()
            if relative != artifact
        ]
        document = {
            "schema_version": "1.0",
            "challenged_artifact": primary,
            "artifact_type": kind,
            "review_focus": lens,
            "pass_number": 1,
            "overall_assessment": "APPROVED",
            "risk_level": "low",
            "must_fix_count": 1 if must_fix else 0,
            "should_fix_count": 0,
            "suggestion_count": 0,
            "findings": [],
            "cache_inputs": json.loads(metadata.stdout),
            "supporting_inputs": supporting,
            "review_execution": {
                "schema_version": "review-execution-v1",
                "reviewer": "challenger-review-subagent",
                "worker_id": f"fixture-worker-{index}",
                "parent_id": "fixture-parent",
                "tool_call_id": f"fixture-call-{index}",
                "step": "2",
                "request_id": identity,
                "review_depth": "default",
                "invocation": "native-synchronous",
                "recorded_at": writer._iso_now(),
                "completed_at": writer._iso_now(),
                "project_name": "synthetic",
            },
        }
        name = f"challenge-findings-assessment-{index}.json"
        (directory / name).write_text(json.dumps(document))
        data["decisions"].setdefault("review_cycles", {})[key] = {
            "step": "2",
            "artifact": primary,
            "lens": lens,
            "pass_number": 1,
            "canonical_path": f"agent-output/synthetic/{name}",
            "initial_id": identity,
            "projection": data["assessment_run"]["scope_digest"],
            "calls": 1,
            "max_calls": 2,
            "current_path": name,
        }
        data.setdefault("review_attempts", []).append(
            {
                "schema_version": "review-attempt-v1",
                "id": identity,
                "step": "2",
                "kind": "invocation",
                "input_digest": "a" * 64,
                "outcome": "completed",
                "review_output": "nonempty",
                "retry_of": None,
                "recorded_at": writer._iso_now(),
                "cycle_id": key,
            }
        )
    writer.write_state("synthetic", data)


@pytest.mark.parametrize("source", ["iac", "azure"])
@pytest.mark.parametrize("scenario", ["evidence_only", "requirements_led"])
def test_scenarios_terminal_without_delivery_or_fake_requirements(assessment_project, monkeypatch, source, scenario):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch, source, scenario)
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    assert (
        invoke(cli, "accept", {"receipt": {"owner": "fixture-owner", "request_id": "actual-final", "approved": True}})
        == 0
    )
    data = state(writer)
    payload = importlib.import_module("apex_recall.commands.handoff").build_handoff_payload("synthetic", data)
    assert payload["status"] == "TERMINAL" and payload["next_owner"] is None
    assert payload["readiness"]["status"] == "ready"
    assert data["current_step"] == 0
    assert all(step["status"] == "pending" for step in data["steps"].values())
    assert (directory / "01-requirements.md").exists() == (scenario == "requirements_led")
    assert data["assessment_run"]["coverage"] == "partial"
    assert not (directory / "04-governance-constraints.json").exists()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    assert cli.main(["handoff", "synthetic", "--json"]) == 0


def test_combined_interrupted_resume_scope_and_numeric_guards(assessment_project):
    directory, writer, module, cli = assessment_project
    req = request("combined")
    assert invoke(cli, "start", req) == 0
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="diagram") != 0
    assert invoke(cli, "accept", {"receipt": req["receipt"]}) != 0
    assert invoke(cli, "advance", phase="invented") != 0
    assert cli.main(["start-step", "synthetic", "1", "--json"]) != 0
    assert (
        cli.main(
            [
                "complete-step",
                "synthetic",
                "1",
                "--allow-missing-challenger",
                "--challenger-skip-reason",
                "no",
                "--json",
            ]
        )
        != 0
    )
    assert cli.main(["transition", "synthetic", "--from-step", "1", "--to-step", "2", "--json"]) != 0
    assert cli.main(["checkpoint", "synthetic", "1", "fake", "--json"]) != 0
    assert cli.main(["decide", "synthetic", "--key", "workflow_mode", "--value", "delivery", "--json"]) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    payload = module.handoff("synthetic", state(writer))
    assert payload["phase"] == "evidence" and payload["next_owner"] == "03-Architect"
    assert not (directory / "01-requirements.md").exists()


@pytest.mark.parametrize(
    "field,value",
    [
        ("source", "anything"),
        ("scenario", "anything"),
        ("source", "azure"),
        ("receipt", {"owner": "fixture-owner", "request_id": "cancelled", "approved": False}),
    ],
)
def test_invalid_scope_fails_closed(assessment_project, field, value):
    _, writer, _, cli = assessment_project
    req = request()
    req[field] = value
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "start", req) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_reserved_projection_collision_and_scope_path_escape(assessment_project):
    directory, writer, module, cli = assessment_project
    projection = directory / "assessment-step-2.json"
    projection.write_bytes(b'{"preserved":"projection"}')
    req = request()
    req["scope"]["iac_paths"] = ["agent-output/synthetic/assessment-step-2.json"]
    assert invoke(cli, "adopt", req, None, "--dry-run") != 0
    assert projection.read_bytes() == b'{"preserved":"projection"}'
    for relative in ("../escape", "/absolute", "assets/assessment-step-2.png", "_meta/00-session-state.json"):
        with pytest.raises(ValueError):
            module.safe_path(directory, relative)
    assert "assessment_run" not in state(writer)


def test_missing_invalid_diagram_and_review_do_not_advance(assessment_project, monkeypatch):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="review") != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    for relative in ("assets/03-des-diagram.png", "assets/03-des-diagram.svg"):
        path = directory / relative
        saved = path.read_bytes()
        path.write_bytes(b"not-a-render")
        assert module.readiness("synthetic", state(writer))["status"] == "blocked"
        path.write_bytes(saved)
        path.unlink()
        assert module.readiness("synthetic", state(writer))["status"] == "blocked"
        path.write_bytes(saved)


@pytest.mark.parametrize(
    "problem", ["must_fix", "stale_primary", "stale_supporting", "missing_attempt", "failed_attempt"]
)
def test_reviewer_integrity_blocks_even_when_workload_risks_are_reportable(assessment_project, monkeypatch, problem):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project, must_fix=problem == "must_fix")
    if problem == "stale_primary":
        path = directory / "02-architecture-assessment.md"
        path.write_text(path.read_text() + "unreviewed claim")
    elif problem == "stale_supporting":
        path = directory / "01-assessment-brief.md"
        path.write_text(path.read_text() + "changed scope")
    elif problem in ("missing_attempt", "failed_attempt"):
        data = state(writer)
        if problem == "missing_attempt":
            data["review_attempts"] = []
        else:
            data["review_attempts"][-1]["outcome"] = "failed"
        writer.write_state("synthetic", data)
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="review") != 0
    assert module.readiness("synthetic", state(writer))["status"] == "blocked"
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_actual_revision_conflict_and_dry_run_do_not_mutate(assessment_project, capsys):
    _, writer, module, cli = assessment_project
    req = request()
    req["expected_revision"] = "0" * 64
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "start", req) == 2
    req["expected_revision"] = writer.file_revision(writer.session_state_path("synthetic"))
    assert invoke(cli, "start", req, None, "--dry-run") == 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    first, competing = state(writer), state(writer)
    module.mutate("synthetic", first, "start", req)
    competing["decisions"]["owner"] = "concurrent-writer"
    writer.write_state("synthetic", competing)
    with pytest.raises(writer.StateConflict):
        writer.write_state("synthetic", first)


def legacy_cycle(writer, calls: int = 2):
    practical = importlib.import_module("apex_recall.practical")
    req = {
        "step": "2",
        "artifact_path": "agent-output/synthetic/03-des-cost-estimate.md",
        "review_focus": "cost-feasibility",
        "pass_number": 1,
    }
    key = practical.cycle_identity(req)
    data = state(writer)
    data["decisions"]["workflow_contract"] = "practical-v1"
    data["decisions"]["review_cycles"] = {
        key: {
            "step": "2",
            "artifact": req["artifact_path"],
            "lens": req["review_focus"],
            "pass_number": 1,
            "canonical_path": "agent-output/synthetic/challenge-findings-cost-estimate.json",
            "initial_id": "legacy-initial",
            "projection": "e" * 64,
            "calls": calls,
            "max_calls": 2,
        }
    }
    data["review_attempts"] = [
        {
            "schema_version": "review-attempt-v1",
            "id": "legacy-initial",
            "step": "2",
            "kind": "invocation",
            "input_digest": "d" * 64,
            "outcome": "failed",
            "review_output": "empty",
            "retry_of": None,
            "recorded_at": writer._iso_now(),
            "cycle_id": key,
        }
    ]
    writer.write_state("synthetic", data)
    return key


@pytest.mark.parametrize("calls", [1, 2])
def test_adoption_explicit_alias_preserves_exhausted_cycle_and_numeric_history(assessment_project, calls, capsys):
    directory, writer, module, cli = assessment_project
    key = legacy_cycle(writer, calls)
    old = directory / "03-des-cost-estimate.md"
    old.write_text("Preserved reviewed bytes")
    old_sidecar = directory / "challenge-findings-cost-estimate.json"
    old_sidecar.write_text('{"historical":"bytes retained, not retroactively made current"}')
    before = state(writer)
    req = request()
    assert invoke(cli, "start", req) != 0
    assert invoke(cli, "adopt", req, None, "--dry-run") != 0
    req["review_links"] = {"cost-feasibility": key}
    original_state = writer.session_state_path("synthetic").read_bytes()
    capsys.readouterr()
    assert invoke(cli, "adopt", req, None, "--dry-run") == 0
    preview = json.loads(capsys.readouterr().out)
    assert preview["cycles"] == [
        {
            "cycle_id": key,
            "original_artifact": "agent-output/synthetic/03-des-cost-estimate.md",
            "artifact": "03-cost-management-report.md",
            "lens": "cost-feasibility",
            "calls": calls,
            "max_calls": 2,
            "remaining": 2 - calls,
            "freshness": "missing",
        }
    ]
    assert writer.session_state_path("synthetic").read_bytes() == original_state
    assert invoke(cli, "adopt", req) == 0
    after = state(writer)
    assert after["steps"] == before["steps"]
    assert after["review_attempts"] == before["review_attempts"]
    assert after["decisions"]["review_cycles"] == before["decisions"]["review_cycles"]
    assert after["assessment_run"]["review_links"]["cost-feasibility"]["cycle_id"] == key
    assert old.read_text() == "Preserved reviewed bytes"
    assert json.loads(old_sidecar.read_text())["historical"]


def test_malformed_assessment_state_never_falls_back_to_numeric_requirements(assessment_project):
    _, writer, module, _ = assessment_project
    data = state(writer)
    data["decisions"]["workflow_mode"] = "assessment"
    handoff = importlib.import_module("apex_recall.commands.handoff")
    with pytest.raises(ValueError, match="no numeric fallback"):
        handoff.build_handoff_payload("synthetic", data)
    data["decisions"]["workflow_mode"] = "invented"
    with pytest.raises(ValueError, match="Unsupported workflow mode"):
        module.enabled(data)


def test_delivery_handoff_unchanged(assessment_project):
    _, writer, _, cli = assessment_project
    payload = importlib.import_module("apex_recall.commands.handoff").build_handoff_payload("synthetic", state(writer))
    assert payload["next_owner"] == "02-Requirements"
    assert payload["active_step"] == "1"
    assert cli.main(["start-step", "synthetic", "1", "--json"]) == 0


def test_denial_cannot_be_relabelled_complete_or_escape_authorized_scope(assessment_project):
    _, _, module, _ = assessment_project
    run = request()
    check = {
        "category": "configuration",
        "scope": "infra/fixture",
        "status": "denied",
        "evidence": "403 fixture",
    }
    with pytest.raises(ValueError, match="cannot be labelled complete"):
        module.validate_evidence({"coverage": "complete", "checks": [check]}, run)
    module.validate_evidence({"coverage": "partial", "checks": [check]}, run)
    with pytest.raises(ValueError, match="exceeds authorized"):
        module.validate_evidence({"coverage": "partial", "checks": [{**check, "category": "billing"}]}, run)


def audit_request(fixture, lens="comprehensive"):
    directory, writer, module, _ = fixture
    data = state(writer)
    artifact = module.profile()["reviews"][lens]["artifact"]
    primary = f"agent-output/synthetic/{artifact}"
    metadata = subprocess.run(
        [
            "node",
            "--input-type=module",
            "-e",
            "import {cacheInputs} from './tools/scripts/validate-challenger-findings.mjs';"
            "console.log(JSON.stringify(cacheInputs(process.argv[1],process.cwd(),'challenger-review-subagent')))",
            primary,
        ],
        cwd=directory.parent.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    req = {
        "request_id": "actual-initial",
        "step": "2",
        "review_depth": "default",
        "artifact_path": primary,
        "project_name": "synthetic",
        "artifact_type": module.LENSES[lens],
        "review_focus": lens,
        "pass_number": 1,
        "output_path": "agent-output/synthetic/challenge-findings-new.json",
        "overwrite": False,
        "prior_findings": None,
        "cache_inputs": json.loads(metadata.stdout),
        "supporting_inputs": [
            {"path": f"agent-output/synthetic/{relative}", "sha256": sha}
            for relative, sha in data["assessment_run"]["frozen_inputs"].items()
            if relative != artifact
        ],
    }
    return req


def audit(cli, path, outcome, *extra):
    return cli.main(
        [
            "review-audit",
            "synthetic",
            "2",
            "--attempt-kind",
            "invocation",
            "--review-request",
            str(path),
            "--attempt-outcome",
            outcome,
            *extra,
            "--json",
        ]
    )


def test_real_prepare_cycle_failure_closure_and_extension_preserve_allowance(assessment_project, monkeypatch):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    req = audit_request(assessment_project)
    path = directory.parent.parent / "review-request.json"
    path.write_text(json.dumps(req))
    assert audit(cli, path, "started") == 0
    assert audit(cli, path, "failed", "--review-output", "unknown") == 0
    practical = importlib.import_module("apex_recall.practical")
    key = practical.cycle_identity(req)
    assert state(writer)["decisions"]["review_cycles"][key]["calls"] == 1
    req["request_id"] = "actual-closure"
    req["prior_findings"] = []
    path.write_text(json.dumps(req))
    assert audit(cli, path, "started", "--closure-of", "actual-initial") == 0
    assert audit(cli, path, "failed", "--closure-of", "actual-initial", "--review-output", "empty") == 0
    assert state(writer)["decisions"]["review_cycles"][key]["calls"] == 2
    before = writer.session_state_path("synthetic").read_bytes()
    req["request_id"] = "unauthorized-third-call"
    path.write_text(json.dumps(req))
    assert audit(cli, path, "started", "--closure-of", "actual-initial") != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    for changed in ("pass_number", "artifact_type", "step", "artifact_path"):
        invalid = {**req, changed: 2 if changed == "pass_number" else "new-reset-identity"}
        path.write_text(json.dumps(invalid))
        assert audit(cli, path, "started", "--closure-of", "actual-initial") != 0
    extension = directory.parent.parent / "extension.json"
    extension.write_text(
        json.dumps(
            {
                "cycle_id": key,
                "max_calls": 3,
                "request_id": "actual-owner-extension",
                "projection_sha256": state(writer)["assessment_run"]["scope_digest"],
            }
        )
    )
    assert cli.main(["decide", "synthetic", "--review-extension", str(extension), "--json"]) == 0
    path.write_text(json.dumps(req))
    assert audit(cli, path, "started", "--closure-of", "actual-initial") == 0
    assert state(writer)["decisions"]["review_cycles"][key]["calls"] == 3


def test_exhausted_renamed_cost_cycle_cannot_reset_on_adoption(assessment_project, monkeypatch):
    directory, writer, module, cli = assessment_project
    key = legacy_cycle(writer, 2)
    req = request()
    req["review_links"] = {"cost-feasibility": key}
    assert invoke(cli, "adopt", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    review = audit_request(assessment_project, "cost-feasibility")
    review["request_id"] = "new-name-same-exhausted-cycle"
    review["prior_findings"] = []
    path = directory.parent.parent / "review-request.json"
    path.write_text(json.dumps(review))
    before = writer.session_state_path("synthetic").read_bytes()
    assert audit(cli, path, "started", "--closure-of", "legacy-initial") != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    assert len(state(writer)["decisions"]["review_cycles"]) == 1
    assert state(writer)["decisions"]["review_cycles"][key]["calls"] == 2


def test_refreeze_report_repairs_does_not_reset_reviews(assessment_project, monkeypatch):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project)
    cycles = copy_cycles = json.loads(json.dumps(state(writer)["decisions"]["review_cycles"]))
    path = directory / "02-architecture-assessment.md"
    path.write_text(path.read_text() + "Report integrity repair\n")
    assert invoke(cli, "advance", {"refresh_inputs": True}, phase="review") == 0
    assert state(writer)["decisions"]["review_cycles"] == copy_cycles
    assert state(writer)["assessment_run"]["phase"] == "review"
    assert module.readiness("synthetic", state(writer))["status"] == "blocked"
    assert all(cycle["calls"] == 1 for cycle in cycles.values())


def test_acceptance_decline_and_reused_scope_receipt_never_approve(assessment_project, monkeypatch):
    _, writer, _, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    before = writer.session_state_path("synthetic").read_bytes()
    for receipt in (
        {"owner": "fixture-owner", "request_id": "final-cancel", "approved": False},
        state(writer)["assessment_run"]["receipt"],
    ):
        assert invoke(cli, "accept", {"receipt": receipt}) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_graph_namespace_preflight_preserves_existing_projection(assessment_project):
    directory, writer, module, cli = assessment_project
    graph_path = directory.parent.parent / GRAPH
    graph = json.loads(graph_path.read_text())
    graph["profiles"]["assessment"]["nodes"]["analysis"]["produces"].append("_meta/assessment-step-2.json")
    graph_path.write_text(json.dumps(graph))
    projection = directory / "_meta/assessment-step-2.json"
    projection.parent.mkdir()
    projection.write_bytes(b"existing-consumed-input-projection")
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "start", request()) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    assert projection.read_bytes() == b"existing-consumed-input-projection"


def test_actual_audit_selection_validates_bound_new_report_path(assessment_project, monkeypatch):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project)
    document = json.loads((directory / "challenge-findings-assessment-1.json").read_text())
    data = state(writer)
    data["review_attempts"] = []
    data["decisions"]["review_cycles"] = {}
    writer.write_state("synthetic", data)
    req = audit_request(assessment_project, "cost-feasibility")
    req["request_id"] = "actual-cost-dispatch"
    path = directory.parent.parent / "review-request.json"
    path.write_text(json.dumps(req))
    assert audit(cli, path, "started") == 0
    result = directory / "challenge-findings-new.json"
    document["review_execution"]["request_id"] = req["request_id"]
    result.write_text(json.dumps(document))
    assert audit(cli, path, "completed", "--review-output", "nonempty", "--review-result", str(result)) == 0
    cycle = next(iter(state(writer)["decisions"]["review_cycles"].values()))
    assert cycle["calls"] == 1
    assert cycle["current_path"] == result.name
    assert cycle["current_artifact"] == "agent-output/synthetic/03-cost-management-report.md"
    assert document["artifact_type"] == "cost-estimate"
    assert document["review_focus"] == "cost-feasibility"


def test_adoption_reports_stale_guidance_without_restamping_history(assessment_project, monkeypatch, capsys):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project)
    data = state(writer)
    del data["assessment_run"]
    del data["decisions"]["workflow_mode"]
    writer.write_state("synthetic", data)
    before = writer.session_state_path("synthetic").read_bytes()
    reviews = {path: path.read_bytes() for path in directory.glob("challenge-findings-*.json")}
    definition = directory.parent.parent / ".github/agents/_subagents/challenger-review-subagent.agent.md"
    definition.write_text(definition.read_text() + "\nNormative fixture guidance change.\n")
    req = request()
    req["review_links"] = {cycle["lens"]: key for key, cycle in data["decisions"]["review_cycles"].items()}
    capsys.readouterr()
    assert invoke(cli, "adopt", req, None, "--dry-run") == 0
    report = json.loads(capsys.readouterr().out)
    assert {cycle["freshness"] for cycle in report["historical_cycles"]} == {"stale_or_invalid"}
    assert {cycle["calls"] for cycle in report["historical_cycles"]} == {1}
    assert writer.session_state_path("synthetic").read_bytes() == before
    assert all(path.read_bytes() == content for path, content in reviews.items())


def test_identical_renamed_cost_report_reuses_original_attributed_reviews(assessment_project, monkeypatch):
    directory, writer, module, cli = to_review(assessment_project, monkeypatch)
    seed_reviews(assessment_project)
    data = state(writer)
    practical = importlib.import_module("apex_recall.practical")
    old_artifact = "agent-output/synthetic/03-des-cost-estimate.md"
    new_artifact = "agent-output/synthetic/03-cost-management-report.md"
    (directory / "03-des-cost-estimate.md").write_bytes((directory / "03-cost-management-report.md").read_bytes())
    old_key, cycle = next(
        (key, cycle) for key, cycle in data["decisions"]["review_cycles"].items() if cycle["lens"] == "cost-feasibility"
    )
    new_key = practical.cycle_identity(
        {
            "step": "2",
            "artifact_path": old_artifact,
            "review_focus": "cost-feasibility",
            "pass_number": 1,
        }
    )
    del data["decisions"]["review_cycles"][old_key]
    data["decisions"]["review_cycles"][new_key] = {**cycle, "artifact": old_artifact}
    for attempt in data["review_attempts"]:
        if attempt["cycle_id"] == old_key:
            attempt["cycle_id"] = new_key
    for path in directory.glob("challenge-findings-assessment-*.json"):
        document = json.loads(path.read_text())
        if document["challenged_artifact"] == new_artifact:
            document["challenged_artifact"] = old_artifact
        for supporting in document["supporting_inputs"]:
            if supporting["path"] == new_artifact:
                supporting["path"] = old_artifact
        path.write_text(json.dumps(document))
    del data["assessment_run"]
    del data["decisions"]["workflow_mode"]
    writer.write_state("synthetic", data)
    old_reviews = {path: path.read_bytes() for path in directory.glob("challenge-findings-assessment-*.json")}
    cycles = json.loads(json.dumps(data["decisions"]["review_cycles"]))
    req = request()
    req["review_links"] = {cycle["lens"]: key for key, cycle in cycles.items()}
    assert invoke(cli, "adopt", req) == 0
    for phase in ("evidence", "analysis", "diagram", "review"):
        assert invoke(cli, "advance", phase=phase) == 0
    assert (
        invoke(
            cli,
            "accept",
            {
                "receipt": {"owner": "fixture-owner", "request_id": "actual-final-acceptance", "approved": True},
            },
        )
        == 0
    )
    assert state(writer)["decisions"]["review_cycles"] == cycles
    assert all(path.read_bytes() == contents for path, contents in old_reviews.items())
    assert module.handoff("synthetic", state(writer))["next_owner"] is None


def test_persisted_json_request_paths_start_and_accept(assessment_project):
    directory, writer, module, cli = assessment_project
    req = request()
    start = directory.parent.parent / "assessment-start.json"
    start.write_text(json.dumps(req))
    assert cli.main(["assessment", "synthetic", "--action", "start", "--request", str(start), "--json"]) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    accept = directory.parent.parent / "assessment-accept.json"
    accept.write_text(
        json.dumps(
            {
                "receipt": {"owner": "fixture-owner", "request_id": "actual-final-file-response", "approved": True},
            }
        )
    )
    assert cli.main(["assessment", "synthetic", "--action", "accept", "--request", str(accept), "--json"]) == 0
    assert state(writer)["assessment_run"]["phase"] == "terminal"
    assert module.handoff("synthetic", state(writer))["next_owner"] is None


@pytest.mark.parametrize("problem", ["missing", "malformed", "directory", "nonobject", "inline_malformed"])
def test_request_file_errors_are_explicit_and_do_not_mutate(assessment_project, capsys, problem):
    directory, writer, _, cli = assessment_project
    path = directory.parent.parent / "assessment-request.json"
    expected = {
        "missing": "request file not found",
        "malformed": "Malformed JSON",
        "directory": "regular JSON file",
        "nonobject": "JSON object",
        "inline_malformed": "inline assessment request",
    }[problem]
    if problem == "malformed":
        path.write_text('{"receipt":')
    elif problem == "directory":
        path.mkdir()
    elif problem == "nonobject":
        path.write_text("[]")
    before = writer.session_state_path("synthetic").read_bytes()
    value = '{"receipt":' if problem == "inline_malformed" else str(path)
    assert cli.main(["assessment", "synthetic", "--action", "start", "--request", value, "--json"]) != 0
    assert expected in capsys.readouterr().err
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_configured_cost_plan_binds_kinds_metric_currency_and_view(assessment_project, capsys):
    directory, writer, module, cli = assessment_project
    req = request("azure")
    req["reporting"].update(
        {
            "currency": "EUR",
            "cost_type": "AmortizedCost",
            "metric": "Cost",
            "group_by": ["ServiceName"],
            "periods": [
                {
                    "id": "previous_month",
                    "kind": "closed_month",
                    "from": "2026-10-01T00:00:00.000Z",
                    "to": "2026-10-31T23:59:59.999Z",
                },
                {
                    "id": "mtd",
                    "kind": "month_to_date",
                    "from": "2026-11-01T00:00:00.000Z",
                    "to": "2026-11-06T00:00:00Z",
                },
                {
                    "id": "forecast",
                    "kind": "forecast",
                    "from": "2026-11-01T00:00:00.000Z",
                    "to": "2026-11-30T23:59:59.999Z",
                },
            ],
        }
    )
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    path = directory / "contracts/03-cost-management.json"
    original = path.read_text()
    before = writer.session_state_path("synthetic").read_bytes()
    for field, value in (("cost_type", "ActualCost"), ("metric", "PreTaxCost"), ("expected_currency", "USD")):
        document = json.loads(original)
        document["evidence"][0]["request"][field] = value
        path.write_text(json.dumps(document))
        assert invoke(cli, "advance", phase="analysis") != 0
        assert writer.session_state_path("synthetic").read_bytes() == before
    path.write_text(original)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    capsys.readouterr()
    assert cli.main(["show", "synthetic", "--json"]) == 0
    session = json.loads(capsys.readouterr().out)["session"]
    assert session["assessment_cost_plan"] == module.cost_plan(state(writer)["assessment_run"])
    assert session["assessment_cost_plan"]["cost_type"] == "AmortizedCost"
    assert session["assessment_cost_plan"]["metric"] == "Cost"
    assert session["assessment_cost_plan"]["expected_currency"] == "EUR"
    assert session["assessment_readiness"]["status"] == "ready"


@pytest.mark.parametrize(
    "field,value",
    [
        ("cost_type", "ReservationCost"),
        ("metric", "ConvertedCost"),
        ("group_by", ["SecretDimension"]),
    ],
)
def test_unknown_cost_configuration_cannot_start(assessment_project, field, value):
    _, writer, _, cli = assessment_project
    req = request("azure")
    req["reporting"][field] = value
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "start", req) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


@pytest.mark.parametrize("receipt", [None, {"approved": False}])
def test_adoption_preview_does_not_require_or_fabricate_approval(assessment_project, capsys, receipt):
    _, writer, _, cli = assessment_project
    key = legacy_cycle(writer, 2)
    req = request()
    if receipt is None:
        del req["receipt"]
    else:
        req["receipt"] = receipt
    req["review_links"] = {"cost-feasibility": key}
    before = writer.session_state_path("synthetic").read_bytes()
    capsys.readouterr()
    assert invoke(cli, "adopt", req, None, "--dry-run") == 0
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "preview"
    assert result["permission_granted"] is False
    assert result["approval_required"] is True
    assert result["assessment_run"]["receipt"] == receipt
    assert result["cycles"][0]["calls"] == result["cycles"][0]["max_calls"] == 2
    assert writer.session_state_path("synthetic").read_bytes() == before
    assert invoke(cli, "adopt", req) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
