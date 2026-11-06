"""Actual profile/CLI compatibility and offline workbook readiness contracts."""

from __future__ import annotations

import copy
import io
import json
import os
import shutil
import subprocess
import zipfile
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path
from unittest.mock import patch

import pytest

from .test_assessment import (
    GRAPH,
    REPO,
    analysis,
    audit,
    audit_request,
    diagram,
    evidence,
    invoke,
    register,
    request,
    seed_reviews,
    state,
    to_review,
)
from .test_assessment import (
    assessment_project as assessment_project,
)
from .test_assessment_review_regressions import final_receipt, validate_root_document

pytestmark = pytest.mark.usefixtures("assessment_project")
V1 = "assessment-bundle-v1"
V2 = "assessment-bundle-v2"
REGISTER = {
    "contracts/assessment-action-register.json",
    "04-assessment-action-register.md",
    "assets/04-assessment-action-register.xlsx",
    "_meta/action-register-derived.json",
    "_meta/action-register-export.json",
}


def graph_version(directory: Path, version: str) -> None:
    graph = json.loads((REPO / GRAPH).read_text())
    graph["metadata"]["version"] = version
    if version == "3.1":
        del graph["profiles"]["assessment"]["bundle_contracts"]
        del graph["profiles"]["assessment"]["nodes"]["analysis"]["conditional_produces"]
    (directory.parent.parent / GRAPH).write_text(json.dumps(graph))


def omit_legacy_fields(writer) -> None:
    data = state(writer)
    del data["assessment_run"]["bundle_contract"]
    del data["assessment_run"]["action_register"]
    writer.write_state("synthetic", data)


@pytest.mark.parametrize("source", ["azure", "combined"])
@pytest.mark.parametrize("scenario", ["evidence_only", "requirements_led"])
def test_current_profile_requires_register_before_diagram_and_freezes_export_sources(
    assessment_project, source, scenario
):
    directory, writer, module, cli = assessment_project
    req = request(source, scenario)
    assert invoke(cli, "start", req) == 0
    run = state(writer)["assessment_run"]
    assert run["bundle_contract"] == V2 and run["action_register"] is True
    assert validate_root_document(writer.session_state_path("synthetic"))["valid"]
    if scenario == "requirements_led":
        (directory / "01-requirements.md").write_text("# Authorized requirements\n")
        assert invoke(cli, "advance", phase="requirements") == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    canonical = directory / "contracts/assessment-action-register.json"
    raw = canonical.read_bytes()
    canonical.unlink()
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="analysis") != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    canonical.write_bytes(raw)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    run = state(writer)["assessment_run"]
    assert set(run["frozen_inputs"]) >= REGISTER
    receipt = json.loads((directory / "_meta/action-register-export.json").read_text())
    assert set(receipt["evidence_hashes"]) <= set(run["frozen_inputs"])
    module.check_frozen("synthetic", state(writer))
    assert module.handoff("synthetic", state(writer))["required_outputs"] == module.required_outputs(
        run, module.profile()
    )
    assert all(step["status"] == "pending" for step in state(writer)["steps"].values())


@pytest.mark.parametrize("selected", [False, True])
def test_iac_explicit_selection_is_persisted_not_inferred_from_files(assessment_project, selected):
    directory, writer, module, cli = assessment_project
    req = {**request(), "action_register": selected}
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    if not selected:
        register(directory, req)
    assert invoke(cli, "advance", phase="analysis") == 0
    diagram(directory)
    assert invoke(cli, "advance", phase="diagram") == 0
    run = state(writer)["assessment_run"]
    assert run["bundle_contract"] == V2 and run["action_register"] is selected
    assert bool(REGISTER & set(run["frozen_inputs"])) is selected
    assert bool(REGISTER & set(module.required_outputs(run, module.profile()))) is selected


@pytest.mark.parametrize("terminal", [False, True])
@pytest.mark.parametrize("source", ["iac", "azure"])
def test_legacy_frozen_and_accepted_runs_keep_exact_contract_under_current_graph(
    assessment_project, monkeypatch, capsys, terminal, source
):
    directory, writer, module, cli = assessment_project
    graph_version(directory, "3.1")
    to_review(assessment_project, monkeypatch, source)
    omit_legacy_fields(writer)
    seed_reviews(assessment_project)
    if terminal:
        assert invoke(cli, "advance", phase="review") == 0
        assert invoke(cli, "accept", final_receipt()) == 0
    original = state(writer)
    before = writer.session_state_path("synthetic").read_bytes()
    graph_version(directory, "3.2")
    loaded = state(writer)
    assert loaded["assessment_run"] == original["assessment_run"]
    module.check_frozen("synthetic", loaded)
    assert not REGISTER & set(loaded["assessment_run"]["frozen_inputs"])
    assert module.readiness("synthetic", state(writer))["status"] == "ready"
    capsys.readouterr()
    assert cli.main(["handoff", "synthetic", "--json"]) == 0
    handoff = json.loads(capsys.readouterr().out)
    assert handoff["bundle_contract"] == V1
    assert handoff["status"] == ("TERMINAL" if terminal else "READY")
    assert writer.session_state_path("synthetic").read_bytes() == before
    report = directory / "02-architecture-assessment.md"
    report.write_text(report.read_text() + "Changed old bundle input.\n")
    assert module.readiness("synthetic", state(writer))["status"] == "blocked"
    assert writer.session_state_path("synthetic").read_bytes() == before


@pytest.mark.parametrize("version", ["3.0", "3.3", "3.999", "4.0"])
def test_unknown_assessment_reader_versions_fail_before_start(assessment_project, version):
    directory, writer, _, cli = assessment_project
    before = writer.session_state_path("synthetic").read_bytes()
    graph_version(directory, version)
    assert invoke(cli, "start", request()) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before


@pytest.mark.parametrize("change", ["unknown_contract", "missing_selection", "azure_opt_out", "legacy_opt_in"])
def test_serialized_contract_and_selection_fail_closed_in_schema_and_runtime(assessment_project, change):
    directory, writer, module, cli = assessment_project
    assert invoke(cli, "start", request("azure")) == 0
    data = copy.deepcopy(state(writer))
    run = data["assessment_run"]
    if change == "unknown_contract":
        run["bundle_contract"] = "assessment-bundle-v999"
    elif change == "missing_selection":
        del run["action_register"]
    elif change == "azure_opt_out":
        run["action_register"] = False
    else:
        del run["bundle_contract"]
    document = directory.parent.parent / "invalid-contract.json"
    document.write_text(json.dumps(data))
    assert validate_root_document(document)["valid"] is False
    with pytest.raises(ValueError):
        module.validate_state(data)


@pytest.mark.parametrize("terminal", [False, True])
def test_explicit_adoption_preview_preserves_acceptance_and_exhausted_cycles(
    assessment_project, monkeypatch, capsys, terminal
):
    directory, writer, _, cli = assessment_project
    graph_version(directory, "3.1")
    to_review(assessment_project, monkeypatch, "azure")
    omit_legacy_fields(writer)
    seed_reviews(assessment_project)
    if terminal:
        assert invoke(cli, "advance", phase="review") == 0
        assert invoke(cli, "accept", final_receipt()) == 0
    data = state(writer)
    for cycle in data["decisions"]["review_cycles"].values():
        cycle["max_calls"] = cycle["calls"]
    writer.write_state("synthetic", data)
    original = copy.deepcopy(state(writer))
    before = writer.session_state_path("synthetic").read_bytes()
    graph_version(directory, "3.2")
    req = request("azure")
    req["review_links"] = {cycle["lens"]: key for key, cycle in original["decisions"]["review_cycles"].items()}
    req["receipt"] = {"owner": "fixture-owner", "request_id": "explicit-register-adoption", "approved": True}
    capsys.readouterr()
    assert invoke(cli, "adopt", req, None, "--dry-run") == 0
    preview = json.loads(capsys.readouterr().out)
    assert preview["old_bundle_contract"] == V1 and preview["bundle_contract"] == V2
    assert set(preview["required_output_changes"]) == REGISTER
    assert preview["prior_frozen_inputs"] == original["assessment_run"]["frozen_inputs"]
    assert preview["review_extension_required"] is True
    assert all(row["remaining"] == 0 for row in preview["cycles"])
    assert writer.session_state_path("synthetic").read_bytes() == before
    denied = {**req, "receipt": {**req["receipt"], "approved": False}}
    assert invoke(cli, "adopt", denied) != 0
    assert writer.session_state_path("synthetic").read_bytes() == before
    assert invoke(cli, "adopt", req) == 0
    adopted = state(writer)
    assert adopted["decisions"] == original["decisions"]
    assert adopted["review_attempts"] == original["review_attempts"]
    assert adopted["steps"] == original["steps"]
    assert adopted["assessment_run"]["receipt"] == original["assessment_run"]["receipt"]
    assert adopted["decision_log"][-1]["prior_assessment_run"] == original["assessment_run"]
    assert adopted["assessment_run"]["phase"] == "analysis"
    assert validate_root_document(writer.session_state_path("synthetic"))["valid"]
    analysis(directory, request("azure"))
    assert invoke(cli, "advance", phase="analysis") == 0
    assert invoke(cli, "advance", phase="diagram") == 0
    review_request = audit_request(assessment_project)
    review_request["request_id"] = "cannot-renew-existing-call"
    review_path = directory.parent.parent / "register-review-request.json"
    review_path.write_text(json.dumps(review_request))
    assert audit(cli, review_path, "started", "--closure-of", "fixture-review-0") != 0
    current = state(writer)
    assert current["decisions"] == original["decisions"]
    assert invoke(cli, "accept", {"receipt": req["receipt"]}) != 0


def corrupt_workbook(directory: Path, problem: str) -> None:
    workbook = directory / "assets/04-assessment-action-register.xlsx"
    if problem == "bad_zip":
        workbook.write_bytes(b"Not a ZIP workbook")
    elif problem in ("missing_part", "external_workbook"):
        archive = io.BytesIO()
        with zipfile.ZipFile(workbook) as original, zipfile.ZipFile(archive, "w") as changed:
            for member in original.infolist():
                if problem != "missing_part" or member.filename != "xl/workbook.xml":
                    changed.writestr(member, original.read(member.filename))
            if problem == "external_workbook":
                changed.writestr("xl/externalLinks/externalLink1.xml", "<externalLink/>")
        workbook.write_bytes(archive.getvalue())
    else:
        import openpyxl

        loaded = openpyxl.load_workbook(workbook)
        sheet = loaded[loaded.sheetnames[-1] if problem == "summary" else loaded.sheetnames[0]]
        sheet["A2"] = "=1+1" if problem == "formula" else "Mismatched derived summary"
        with patch("tempfile.tempdir", str(directory / "_meta")):
            loaded.save(workbook)
    receipt = directory / "_meta/action-register-export.json"
    document = json.loads(receipt.read_text())
    document["output_hashes"]["workbook"] = sha256(workbook.read_bytes()).hexdigest()
    receipt.write_text(json.dumps(document))


@pytest.mark.parametrize(
    "problem", ["bad_zip", "missing_part", "formula", "external_workbook", "summary", "receipt", "source"]
)
def test_runtime_rejects_corrupt_exports_even_with_updated_workbook_hash(assessment_project, problem):
    directory, writer, module, cli = assessment_project
    req = {**request(), "action_register": True}
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    if problem == "receipt":
        path = directory / "_meta/action-register-export.json"
        receipt = json.loads(path.read_text())
        receipt["source_sha256"] = "0" * 64
        path.write_text(json.dumps(receipt))
    elif problem == "source":
        path = directory / "evidence/waf.json"
        path.write_text(path.read_text() + " ")
    else:
        corrupt_workbook(directory, problem)
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="analysis") != 0
    assert "assessment-action-register.mjs failed" in module.readiness("synthetic", state(writer))["error"]
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_missing_python_dependency_is_a_real_runtime_blocker(assessment_project, monkeypatch):
    directory, writer, module, cli = assessment_project
    req = {**request(), "action_register": True}
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    binaries = directory.parent.parent / "node-only"
    binaries.mkdir()
    (binaries / "node").symlink_to(shutil.which("node"))
    execute = subprocess.run

    def no_python(*args, **kwargs):
        kwargs["env"] = {**os.environ, "PATH": str(binaries)}
        return execute(*args, **kwargs)

    monkeypatch.setattr(module.subprocess, "run", no_python)
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="analysis") != 0
    assert "Workbook validate failed" in module.readiness("synthetic", state(writer))["error"]
    assert writer.session_state_path("synthetic").read_bytes() == before


@pytest.mark.parametrize("field", ["source", "scopes", "project", "as_of"])
def test_caller_written_register_cannot_expand_persisted_scope(assessment_project, field):
    directory, writer, module, cli = assessment_project
    req = request("azure")
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    canonical = directory / "contracts/assessment-action-register.json"
    document = json.loads(canonical.read_text())
    document[field] = {
        "source": "iac",
        "scopes": ["/subscriptions/00000000-0000-0000-0000-000000000002"],
        "project": "another-project",
        "as_of": "2026-11-05T00:00:00Z",
    }[field]
    canonical.write_text(json.dumps(document))
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="analysis") != 0
    assert "differ from authorized assessment" in module.readiness("synthetic", state(writer))["error"]
    assert writer.session_state_path("synthetic").read_bytes() == before


def test_known_old_reader_rejects_register_capable_serialized_run_without_rewriting(assessment_project):
    directory, writer, _, cli = assessment_project
    assert invoke(cli, "start", request()) == 0
    before = writer.session_state_path("synthetic").read_bytes()
    graph_version(directory, "3.1")
    with pytest.raises(ValueError, match="State recovery required"):
        state(writer)
    assert writer.session_state_path("synthetic").read_bytes() == before


def finance_request() -> dict:
    req = request("azure")
    req["scope"]["azure_scopes"] = ["/subscriptions/00000000-0000-4000-8000-000000000001/resourceGroups/synthetic"]
    req["scope"]["categories"] += ["billing", "utilization"]
    req["reporting"]["periods"][0]["kind"] = "closed_month"
    return req


@pytest.mark.parametrize("days_later", [0, 21])
def test_all_validated_export_and_transitive_finance_sources_are_watched_before_commit(
    assessment_project, monkeypatch, days_later
):
    directory, writer, module, cli = assessment_project
    clock = datetime(2026, 11, 6, 12, tzinfo=UTC) + timedelta(days=days_later)

    class FixtureDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return clock.astimezone(tz)

    monkeypatch.setattr(module, "datetime", FixtureDatetime)
    req = finance_request()
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    register(directory, req, finance=True)
    data = state(writer)
    module.mutate("synthetic", data, "advance", {}, "analysis")
    receipt = json.loads((directory / "_meta/action-register-export.json").read_text())
    assert {"evidence/actual-collection.json", "evidence/advisor-observed.json", "evidence/advisor-saving.json"} <= set(
        receipt["evidence_hashes"]
    )
    expected = {*REGISTER, *receipt["evidence_hashes"]}
    assert all(directory / relative in data.input_revisions for relative in expected)
    for relative in expected:
        path = directory / relative
        original = path.read_bytes()
        path.write_bytes(original + b"changed after validation")
        with pytest.raises(writer.StateConflict):
            writer.check_state_revision(data, writer.session_state_path("synthetic"))
        path.write_bytes(original)
    writer.write_state("synthetic", data)


@pytest.mark.parametrize(
    ("violation", "message"),
    [
        ("billing", "Actual billing evidence was not authorized"),
        ("utilization", "Cost opportunities require authorized"),
        ("period", "periods differ from authorized"),
        ("plan", "Cost requests/metrics/currencies differ from approved plan"),
    ],
)
def test_every_imported_cost_report_obeys_captured_authorization(assessment_project, violation, message):
    directory, writer, module, cli = assessment_project
    req = finance_request()
    if violation in ("billing", "utilization"):
        req["scope"]["categories"].remove(violation)
    assert invoke(cli, "start", req) == 0
    evidence(directory, req)
    assert invoke(cli, "advance", phase="evidence") == 0
    analysis(directory, req)
    imported_request = copy.deepcopy(req)
    if violation == "period":
        imported_request["reporting"]["periods"][0]["id"] = "unapproved-period"
    if violation == "plan":
        imported_request["reporting"]["group_by"] = ["ResourceId"]
    register(directory, imported_request, finance=True)
    before = writer.session_state_path("synthetic").read_bytes()
    assert invoke(cli, "advance", phase="analysis") != 0
    assert message in module.readiness("synthetic", state(writer))["error"]
    assert writer.session_state_path("synthetic").read_bytes() == before
