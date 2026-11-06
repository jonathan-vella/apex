"""Runtime-entry and serialized-state regressions for standalone assessment review."""

from __future__ import annotations

import copy
import importlib
import json
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from .test_assessment import (
    REPO,
    analysis,
    audit,
    audit_request,
    diagram,
    evidence,
    invoke,
    legacy_cycle,
    request,
    seed_reviews,
    state,
)
from .test_assessment import (
    assessment_project as assessment_project,
)

SUB = "/subscriptions/00000000-0000-0000-0000-000000000001"


@pytest.mark.parametrize("action", ["start", "adopt"])
@pytest.mark.parametrize("dry_run", [False, True])
@pytest.mark.parametrize(
    "scopes",
    [
        [f"{SUB}/resourceGroups/fixture", f"{SUB.upper()}/RESOURCEGROUPS/FIXTURE"],
        [SUB, f"{SUB}/resourceGroups/fixture"],
        [f"{SUB}/resourceGroups/fixture-{index}" for index in range(11)],
    ],
)
def test_invalid_scope_lists_never_persist_or_preview(assessment_project, action, dry_run, scopes):
    _, writer, _, cli = assessment_project
    req = request("azure")
    req["scope"]["azure_scopes"] = scopes
    if action == "adopt":
        req["review_links"] = {"cost-feasibility": legacy_cycle(writer)}
    before = writer.session_state_path("synthetic").read_bytes()
    extra = ("--dry-run",) if dry_run else ()
    assert invoke(cli, action, req, None, *extra) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


@pytest.mark.parametrize("action", ["start", "adopt"])
def test_distinct_scopes_create_a_valid_not_assessed_plan(assessment_project, action):
    directory, writer, module, cli = assessment_project
    req = request("azure")
    req["scope"]["azure_scopes"] = [f"{SUB}/resourceGroups/one", f"{SUB}/resourceGroups/two"]
    if action == "adopt":
        req["review_links"] = {"cost-feasibility": legacy_cycle(writer)}
    assert invoke(cli, action, req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    assert module.cost_plan(state(writer)["assessment_run"])["scopes"] == req["scope"]["azure_scopes"]


def actual_cost(directory: Path, req: dict, clock: datetime, currency: str = "EUR") -> dict:
    analysis(directory, req)
    path = directory / "contracts/03-cost-management.json"
    report = json.loads(path.read_text())
    query = report["evidence"][0]["request"]
    collection = {
        "source": "azure-cost-management",
        "collected_at": clock.isoformat(timespec="milliseconds"),
        "request": query,
        "pages": [
            {
                "request_path": f"{query['scope']}/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
                "status_code": 200,
                "body": {
                    "properties": {
                        "columns": [
                            {"name": query["metric"], "type": "Number"},
                            {"name": "Currency", "type": "String"},
                            {"name": "UsageDate", "type": "Number"},
                        ],
                        "rows": [["10.25", currency, int(query["period"]["from"][:10].replace("-", ""))]],
                        "nextLink": None,
                    }
                },
            }
        ],
    }
    source = directory / "contracts/cost-source.json"
    source.write_text(json.dumps(collection))
    normalized = subprocess.run(
        [
            "node",
            str(REPO / "tools/scripts/assessment-cost.mjs"),
            "normalize",
            "--input",
            str(source),
            "--root",
            str(directory),
            "--scope",
            query["scope"],
            "--as-of",
            clock.isoformat(timespec="milliseconds"),
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=True,
    )
    report.update(
        {
            "evidence": [json.loads(normalized.stdout)],
            "status": "partial",
            "generated_at": clock.isoformat(timespec="milliseconds"),
            "gaps": ["Returned currency differs from requested USD"],
        }
    )
    path.write_text(json.dumps(report))
    return report


def to_acceptance(fixture, req: dict) -> None:
    directory, _, _, cli = fixture
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(fixture)
    assert invoke(cli, "advance", phase="review") == 0


def final_receipt() -> dict:
    return {"receipt": {"owner": "fixture-owner", "request_id": "actual-final-response", "approved": True}}


def close_original_cycles(fixture) -> None:
    directory, writer, _, cli = fixture
    cycles = copy.deepcopy(state(writer)["decisions"]["review_cycles"])
    for index, (_, cycle) in enumerate(cycles.items()):
        req = audit_request(fixture, cycle["lens"])
        req.update(
            {
                "request_id": f"actual-repair-{index}",
                "prior_findings": [],
                "output_path": f"agent-output/synthetic/challenge-findings-repair-{index}.json",
            }
        )
        request_path = directory.parent.parent / f"repair-request-{index}.json"
        request_path.write_text(json.dumps(req))
        assert audit(cli, request_path, "started", "--closure-of", cycle["initial_id"]) == 0
        document = json.loads((directory / cycle["current_path"]).read_text())
        document.update({"cache_inputs": req["cache_inputs"], "supporting_inputs": req["supporting_inputs"]})
        document["review_execution"].update(
            {
                "request_id": req["request_id"],
                "worker_id": f"repair-worker-{index}",
                "tool_call_id": f"repair-call-{index}",
                "completed_at": writer._iso_now(),
            }
        )
        result = directory / Path(req["output_path"]).name
        result.write_text(json.dumps(document))
        assert (
            audit(
                cli,
                request_path,
                "completed",
                "--closure-of",
                cycle["initial_id"],
                "--review-output",
                "nonempty",
                "--review-result",
                str(result),
            )
            == 0
        )
    updated = state(writer)["decisions"]["review_cycles"]
    assert set(updated) == set(cycles)
    assert all(cycle["calls"] == cycle["max_calls"] == 2 for cycle in updated.values())


@pytest.mark.parametrize("problem", ["edited", "expired"])
def test_acceptance_repair_returns_without_weakening_scope_or_review_cycles(assessment_project, monkeypatch, problem):
    directory, writer, module, cli = assessment_project
    initial = state(writer)
    initial["decisions"]["workflow_contract"] = "practical-v1"
    importlib.import_module("apex_recall.practical").record_input(
        initial,
        {
            "input_id": "availability_target",
            "value": "Unknown, preserve owner response",
            "environments": ["dev"],
            "owner": "fixture-owner",
            "request_id": "actual-material-response",
        },
    )
    writer.write_state("synthetic", initial)
    req = request("azure" if problem == "expired" else "iac")
    req["scope"]["categories"].append("billing")
    req["reporting"].update({"currency": "USD", "group_by": []})
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    if problem == "expired":
        actual_cost(directory, req, datetime.now(UTC))
    else:
        analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    if problem == "edited":
        report = directory / "02-architecture-assessment.md"
        report.write_text(report.read_text() + "Report integrity repair.\n")
    else:
        later = datetime.now(UTC) + timedelta(days=8)

        class LaterDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return later.astimezone(tz) if tz else later.replace(tzinfo=None)

        monkeypatch.setattr(module, "datetime", LaterDateTime)
    original = state(writer)
    prior_reviews = {path: path.read_bytes() for path in directory.glob("challenge-findings-*.json")}
    assert invoke(cli, "accept", final_receipt()) != 0
    repair = {"receipt": {"owner": "fixture-owner", "request_id": "actual-revise-response", "approved": True}}
    assert invoke(cli, "revise", repair, phase="acceptance") == 0
    returned = state(writer)
    assert returned["assessment_run"]["phase"] == "review"
    assert returned["assessment_run"]["scope_digest"] == original["assessment_run"]["scope_digest"]
    assert returned["assessment_run"]["scope"] == original["assessment_run"]["scope"]
    assert returned["decisions"] == original["decisions"]
    assert returned["review_attempts"] == original["review_attempts"]
    assert returned["steps"] == original["steps"]
    if problem == "expired":
        actual_cost(directory, req, later)
    assert invoke(cli, "advance", {"refresh_inputs": True}, phase="review") == 0
    close_original_cycles(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    assert invoke(cli, "accept", final_receipt()) == 0
    assert all(path.read_bytes() == contents for path, contents in prior_reviews.items())
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "revise", repair) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_revise_rejects_unauthorized_changes_and_exhausted_cycles_still_block(assessment_project):
    directory, writer, _, cli = assessment_project
    to_acceptance(assessment_project, request())
    before = writer.session_state_path("synthetic").read_bytes()
    receipt = {"owner": "fixture-owner", "request_id": "actual-revise", "approved": True}
    for payload in (
        {},
        {"receipt": {**receipt, "approved": False}},
        {"receipt": receipt, "scope": {"categories": ["billing"]}},
        {"receipt": receipt, "material_inputs": {}},
    ):
        assert invoke(cli, "revise", payload) != 0
        assert writer.session_state_path("synthetic").read_bytes() == before
    assert invoke(cli, "revise", {"receipt": receipt}) == 0
    assert invoke(cli, "advance", {"refresh_inputs": True}, phase="review") == 0
    close_original_cycles(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    (directory / "02-architecture-assessment.md").write_text("Another owner-approved report correction\n")
    assert invoke(cli, "revise", {"receipt": {**receipt, "request_id": "actual-revise-again"}}) == 0
    assert invoke(cli, "advance", {"refresh_inputs": True}, phase="review") == 0
    cycle = next(iter(state(writer)["decisions"]["review_cycles"].values()))
    req = audit_request(assessment_project, cycle["lens"])
    req.update({"request_id": "cannot-reset-budget", "prior_findings": []})
    path = directory.parent.parent / "exhausted-request.json"
    path.write_text(json.dumps(req))
    before = writer.session_state_path("synthetic").read_bytes()
    assert audit(cli, path, "started", "--closure-of", cycle["initial_id"]) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_currency_mismatch_is_truthful_partial_not_a_conversion_or_changed_request(assessment_project):
    directory, writer, _, cli = assessment_project
    req = request("azure")
    req["scope"]["categories"].append("billing")
    req["reporting"].update({"currency": "USD", "group_by": []})
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    report = actual_cost(directory, req, datetime.now(UTC))
    assert report["evidence"][0]["status"] == "partial"
    assert report["evidence"][0]["series"][0]["currency"] == "EUR"
    assert report["evidence"][0]["series"][0]["amount"] == "10.25"
    assert report["evidence"][0]["gaps"]
    path = directory / "contracts/03-cost-management.json"
    before = writer.session_state_path("synthetic").read_bytes()
    for mode in ("expectation", "conversion"):
        changed = copy.deepcopy(report)
        if mode == "expectation":
            changed["evidence"][0]["request"]["expected_currency"] = "EUR"
        else:
            changed["evidence"][0]["series"][0].update({"currency": "USD", "amount": "11.00"})
        path.write_text(json.dumps(changed))
        assert invoke(cli, "advance", phase="analysis") != 0
        assert writer.session_state_path("synthetic").read_bytes() == before
    path.write_text(json.dumps(report))
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    assert invoke(cli, "accept", final_receipt()) == 0


@pytest.mark.parametrize("terminal", [False, True])
@pytest.mark.parametrize("automatic", [False, True])
@pytest.mark.parametrize("as_json", [False, True])
def test_handoff_cli_plain_and_json_for_active_and_terminal(assessment_project, capsys, terminal, automatic, as_json):
    _, writer, _, cli = assessment_project
    if terminal:
        to_acceptance(assessment_project, request())
        assert invoke(cli, "accept", final_receipt()) == 0
    else:
        assert invoke(cli, "start", request()) == 0
    capsys.readouterr()
    args = ["handoff", *([] if automatic else ["synthetic"]), *(["--json"] if as_json else [])]
    assert cli.main(args) == 0
    output = capsys.readouterr().out
    if as_json:
        payload = json.loads(output)
        assert payload["status"] == ("TERMINAL" if terminal else "READY")
        assert payload["next_owner"] == (None if terminal else "03-Architect")
        assert payload["auto_selected"] is automatic
    else:
        assert (
            output.strip()
            == f"Assessment synthetic: {'terminal · TERMINAL' if terminal else 'evidence · 03-Architect'}"
        )
    assert all(step["status"] == "pending" for step in state(writer)["steps"].values())


def test_handoff_keeps_ambiguity_listing(assessment_project, capsys):
    _, writer, _, cli = assessment_project
    assert invoke(cli, "start", request()) == 0
    writer.write_state("second", writer.make_template("second"))
    assert cli.main(["assessment", "second", "--action", "start", "--request", json.dumps(request()), "--json"]) == 0
    capsys.readouterr()
    assert cli.main(["handoff"]) == 1
    assert "Multiple projects found (second, synthetic)" in capsys.readouterr().out
    assert cli.main(["handoff", "--json"]) == 1
    assert json.loads(capsys.readouterr().out)["candidates"] == ["second", "synthetic"]


def validate_root_document(path: Path) -> dict:
    script = (
        "import fs from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';"
        "const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);"
        "const validate=ajv.compile(JSON.parse(fs.readFileSync('tools/schemas/session-state.schema.json','utf8')));"
        "const valid=validate(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));"
        "console.log(JSON.stringify({valid,errors:validate.errors}));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script, str(path)],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


@pytest.mark.parametrize("source", ["iac", "azure"])
def test_root_schema_validates_actual_serialized_start_and_accepted_state(assessment_project, source):
    directory, writer, _, cli = assessment_project
    req = request(source)
    assert invoke(cli, "start", req) == 0
    actual = writer.session_state_path("synthetic")
    started = json.loads(actual.read_text())
    result = validate_root_document(actual)
    assert result["valid"], result["errors"]
    bad_cases = []
    for value in (None, {}, [], "run", 42):
        invalid = copy.deepcopy(started)
        invalid["assessment_run"] = value
        bad_cases.append(invalid)
    for field in ("receipt", "scope"):
        invalid = copy.deepcopy(started)
        del invalid["assessment_run"][field]
        bad_cases.append(invalid)
    for replacement in ("azure" if source == "iac" else "iac", "combined", "unsupported"):
        invalid = copy.deepcopy(started)
        invalid["assessment_run"]["source"] = replacement
        bad_cases.append(invalid)
    invalid = copy.deepcopy(started)
    invalid["assessment_run"]["receipt"]["approved"] = False
    bad_cases.append(invalid)
    invalid = copy.deepcopy(started)
    invalid["assessment_run"].update({"phase": "terminal", "status": "accepted"})
    bad_cases.append(invalid)
    case = directory.parent.parent / "serialized-schema-case.json"
    for invalid in bad_cases:
        case.write_text(json.dumps(invalid))
        assert validate_root_document(case)["valid"] is False
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    seed_reviews(assessment_project)
    assert invoke(cli, "advance", phase="review") == 0
    assert invoke(cli, "accept", final_receipt()) == 0
    result = validate_root_document(actual)
    assert result["valid"], result["errors"]
    accepted = json.loads(actual.read_text())
    for field in ("acceptance", "accepted_at", "reviews"):
        invalid = copy.deepcopy(accepted)
        del invalid["assessment_run"][field]
        case.write_text(json.dumps(invalid))
        assert validate_root_document(case)["valid"] is False
    invalid = copy.deepcopy(accepted)
    invalid["assessment_run"]["phase"] = "acceptance"
    case.write_text(json.dumps(invalid))
    assert validate_root_document(case)["valid"] is False


def test_root_schema_preserves_legacy_risk_references_and_exception_decisions(assessment_project):
    directory, writer, _, _ = assessment_project
    legacy = json.loads(writer.session_state_path("synthetic").read_text())
    legacy["decision_log"].append({"choice": "EXCEPTION_AUTHORIZED", "status": "accepted", "source": "azure"})
    case = directory.parent.parent / "legacy-state.json"
    case.write_text(json.dumps(legacy))
    assert validate_root_document(case)["valid"] is False
    legacy["risk_authorizations"] = {
        "codegen": {
            "schema_version": "risk-selection-v1",
            "authorization": {"path": "authorization.json", "sha256": "a" * 64, "id": "actual-owner"},
            "approval": {"path": "approval.json", "sha256": "b" * 64},
            "context": None,
        }
    }
    case.write_text(json.dumps(legacy))
    result = validate_root_document(case)
    assert result["valid"], result["errors"]
    assert "assessment_run" not in legacy
