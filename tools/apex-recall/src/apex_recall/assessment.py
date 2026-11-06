"""Bounded standalone assessment lifecycle; routing comes from the canonical graph."""

from __future__ import annotations

import json
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from .state_writer import (
    _iso_now,
    file_revision,
    project_dir,
    workspace_root_for,
)

MODE = "assessment"
GRAPH_VERSIONS = frozenset({"3.1", "3.2"})
BUNDLE_V1 = "assessment-bundle-v1"
BUNDLE_V2 = "assessment-bundle-v2"
CATEGORIES = frozenset({"configuration", "topology", "utilization", "operations", "recovery", "billing", "policy"})
LENSES = {"comprehensive": "architecture", "cost-feasibility": "cost-estimate"}
GROUP_BY = frozenset(
    {
        "ServiceName",
        "ResourceId",
        "ResourceGroupName",
        "ResourceType",
        "ResourceLocation",
        "ChargeType",
        "PricingModel",
        "MeterCategory",
    }
)


def enabled(data: dict) -> bool:
    mode = data.get("decisions", {}).get("workflow_mode")
    if mode not in (None, "", "delivery", MODE):
        raise ValueError(f"Unsupported workflow mode: {mode}")
    return mode == MODE


def profile(root: Path | None = None) -> dict:
    path = workspace_root_for(root) / ".github/skills/apex-workflow-engine/templates/workflow-graph.json"
    graph = json.loads(path.read_text(encoding="utf-8"))
    version = graph.get("metadata", {}).get("version")
    if version not in GRAPH_VERSIONS:
        raise ValueError("Standalone assessment requires supported graph version 3.1 or 3.2")
    result = graph.get("profiles", {}).get(MODE)
    if not isinstance(result, dict) or result.get("entry") != "scope" or result.get("terminal") != "terminal":
        raise ValueError("Invalid assessment graph profile")
    if (
        result.get("workflow_mode") != MODE
        or result.get("scenarios") != ["evidence_only", "requirements_led"]
        or result.get("sources") != ["iac", "azure", "combined"]
    ):
        raise ValueError("Unknown assessment graph profile contract")
    nodes = result.get("nodes", {})
    edges = result.get("edges", [])
    for edge in edges:
        if edge.get("from") not in nodes or edge.get("to") not in nodes:
            raise ValueError("Assessment graph edge escapes its profile")
    if version == "3.2" and result.get("bundle_contracts") != [BUNDLE_V1, BUNDLE_V2]:
        raise ValueError("Invalid assessment graph bundle contracts")
    if version == "3.2" and len(nodes.get("analysis", {}).get("conditional_produces", [])) != 1:
        raise ValueError("Register-capable graph requires analysis output applicability")
    if version == "3.1" and (
        "bundle_contracts" in result or any("conditional_produces" in node for node in nodes.values())
    ):
        raise ValueError("Register-capable graph declarations require version 3.2")
    result["_graph_version"] = version
    return result


def route(run: dict, graph: dict) -> list[str]:
    result = [graph["entry"]]
    while result[-1] != graph["terminal"]:
        matches = [
            edge["to"]
            for edge in graph["edges"]
            if edge["from"] == result[-1] and edge.get("scenario", run["scenario"]) == run["scenario"]
        ]
        if len(matches) != 1 or matches[0] in result:
            raise ValueError("Assessment graph route is ambiguous or cyclic")
        result.append(matches[0])
    return result


def bundle_contract(run: dict, graph: dict) -> str:
    contract = run.get("bundle_contract", BUNDLE_V1)
    if contract not in (BUNDLE_V1, BUNDLE_V2) or (contract == BUNDLE_V2 and graph.get("_graph_version") != "3.2"):
        raise ValueError("Unsupported assessment bundle contract for this graph reader")
    selection = run.get("action_register", False)
    if type(selection) is not bool or (contract == BUNDLE_V1 and selection):
        raise ValueError("Invalid assessment register selection")
    if contract == BUNDLE_V2 and (
        "action_register" not in run or (run["source"] in ("azure", "combined") and selection is not True)
    ):
        raise ValueError("Register-capable Azure/combined assessment requires action_register:true")
    return contract


def output_paths(run: dict, graph: dict, phase: str) -> list[str]:
    """Resolve the graph's bundle/source/explicit-selection contract, never file presence."""
    contract = bundle_contract(run, graph)
    node = graph["nodes"][phase]
    result = list(node.get("produces", []))
    for group in node.get("conditional_produces", []):
        if (
            not isinstance(group, dict)
            or set(group) != {"when", "outputs"}
            or group["when"]
            != {"bundle_contract": BUNDLE_V2, "sources": ["azure", "combined"], "selection": "action_register"}
            or not isinstance(group["outputs"], list)
            or not group["outputs"]
        ):
            raise ValueError("Unknown assessment output applicability contract")
        when = group["when"]
        if contract == when["bundle_contract"] and (
            run["source"] in when["sources"] or run.get(when["selection"], False)
        ):
            result.extend(group["outputs"])
    if any(not isinstance(path, str) for path in result) or len(result) != len(set(result)):
        raise ValueError("Invalid or duplicate assessment output paths")
    return result


def required_outputs(run: dict, graph: dict) -> list[str]:
    return [path for phase in route(run, graph) for path in output_paths(run, graph, phase)]


def scope_projection(run: dict) -> dict:
    result = {key: run[key] for key in ("scenario", "source", "scope", "reporting", "receipt")}
    if run.get("bundle_contract", BUNDLE_V1) == BUNDLE_V2:
        result.update({key: run[key] for key in ("bundle_contract", "action_register")})
    return result


def safe_path(directory: Path, relative: str) -> Path:
    if (
        not isinstance(relative, str)
        or not relative.strip()
        or "\\" in relative
        or any(character in relative for character in "*?[]\x00")
        or ":" in relative.split("/")[0]
        or Path(relative).is_absolute()
        or any(part in ("", "..", ".") or part.startswith("assessment-step-") for part in relative.split("/"))
        or relative in ("00-session-state.json", "_meta/00-session-state.json")
    ):
        raise ValueError("Assessment path is unsafe or uses the reserved assessment-step-* namespace")
    path = directory / relative
    for parent in (path, *path.parents):
        if parent == directory.parent:
            break
        if parent.is_symlink():
            raise ValueError("Assessment paths cannot traverse symlinks")
    if not path.resolve().is_relative_to(directory.resolve()):
        raise ValueError("Assessment path exceeds its project scope")
    return path


def _receipt(value: object) -> None:
    if (
        not isinstance(value, dict)
        or set(value) != {"owner", "request_id", "approved"}
        or value["approved"] is not True
        or not all(isinstance(value[key], str) and value[key].strip() for key in ("owner", "request_id"))
    ):
        raise ValueError("Actual upfront owner/correlation approval receipt required; decline/cancel never approves")


def validate_scope(request: dict, *, require_approval: bool = True) -> None:
    allowed = {
        "scenario",
        "source",
        "scope",
        "reporting",
        "receipt",
        "review_links",
        "expected_revision",
        "action_register",
    }
    if not isinstance(request, dict) or set(request) - allowed:
        raise ValueError("Unknown assessment request fields")
    if request.get("scenario") not in ("evidence_only", "requirements_led"):
        raise ValueError("Assessment scenario must be evidence_only or requirements_led")
    if request.get("source") not in ("iac", "azure", "combined"):
        raise ValueError("Assessment source must be iac, azure or combined")
    if "action_register" in request and (
        type(request["action_register"]) is not bool
        or (request["source"] in ("azure", "combined") and request["action_register"] is not True)
    ):
        raise ValueError("action_register must be boolean; Azure/combined register export cannot be disabled")
    receipt = request.get("receipt")
    pending = receipt is None or (
        isinstance(receipt, dict) and (receipt.get("approved") is None or receipt.get("approved") is False)
    )
    if not require_approval and pending:
        if receipt is not None and (
            set(receipt) - {"owner", "request_id", "approved"}
            or any(
                not isinstance(receipt[key], str) or not receipt[key].strip()
                for key in ("owner", "request_id")
                if key in receipt
            )
        ):
            raise ValueError("Malformed pending assessment receipt")
    else:
        _receipt(receipt)
    scope = request.get("scope")
    if not isinstance(scope, dict) or set(scope) != {"categories", "iac_paths", "azure_scopes"}:
        raise ValueError("Explicit categories, iac_paths and azure_scopes required")
    categories = scope["categories"]
    if (
        not isinstance(categories, list)
        or not categories
        or any(category not in CATEGORIES for category in categories)
        or len(categories) != len(set(categories))
    ):
        raise ValueError("Invalid or duplicate permitted evidence categories")
    for key in ("iac_paths", "azure_scopes"):
        if not isinstance(scope[key], list) or any(not isinstance(item, str) or not item for item in scope[key]):
            raise ValueError("Evidence scopes must be explicit string arrays")
    has_iac = request["source"] in ("iac", "combined")
    has_azure = request["source"] in ("azure", "combined")
    if bool(scope["iac_paths"]) != has_iac or bool(scope["azure_scopes"]) != has_azure:
        raise ValueError("Evidence scopes do not match selected source")
    for relative in scope["iac_paths"]:
        safe_path(workspace_root_for(), relative)
    if scope["azure_scopes"]:
        validate_billing_scopes(scope["azure_scopes"])
    reporting = request.get("reporting")
    if (
        not isinstance(reporting, dict)
        or {"as_of", "periods", "currency"} - set(reporting)
        or set(reporting) - {"as_of", "periods", "currency", "cost_type", "metric", "group_by"}
    ):
        raise ValueError("Reporting requires explicit as_of, periods and currency (null if unknown)")
    if not isinstance(reporting["as_of"], str) or not re.fullmatch(
        r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)", reporting["as_of"]
    ):
        raise ValueError(
            "Reporting as_of requires a timezone-qualified ISO timestamp with at most millisecond precision"
        )
    as_of = datetime.fromisoformat(reporting["as_of"])
    if as_of.tzinfo is None:
        raise ValueError("Reporting as_of requires a timezone")
    if as_of > datetime.now(UTC):
        raise ValueError("Reporting as_of cannot be a future evidence timestamp")
    if reporting["currency"] is not None and not re.fullmatch(r"[A-Z]{3}", reporting["currency"]):
        raise ValueError("Reporting currency must be an ISO currency or null")
    if reporting.get("cost_type", "ActualCost") not in ("ActualCost", "AmortizedCost"):
        raise ValueError("Reporting cost_type must be ActualCost or AmortizedCost")
    if reporting.get("metric", "PreTaxCost") not in ("PreTaxCost", "Cost"):
        raise ValueError("Reporting metric must be PreTaxCost or Cost")
    grouping = reporting.get("group_by", ["ServiceName", "ResourceId"])
    if (
        not isinstance(grouping, list)
        or len(grouping) > 2
        or any(value not in GROUP_BY for value in grouping)
        or len(grouping) != len(set(grouping))
    ):
        raise ValueError("Reporting group_by must contain unique supported cost dimensions (at most two)")
    periods = reporting["periods"]
    if not isinstance(periods, list) or not 1 <= len(periods) <= 12:
        raise ValueError("At least one explicit reporting period is required")
    ids = set()
    for period in periods:
        if (
            not isinstance(period, dict)
            or {"id", "from", "to"} - set(period)
            or set(period) - {"id", "kind", "from", "to"}
            or not re.fullmatch(r"[a-z][a-z0-9_-]{0,63}", period.get("id", ""))
        ):
            raise ValueError("Period requires id, from and to")
        if period["id"] in ids:
            raise ValueError("Duplicate reporting period")
        ids.add(period["id"])
    for period in cost_periods(reporting):
        begin, end = (datetime.fromisoformat(period[key]) for key in ("from", "to"))
        if (
            begin > end
            or end - begin >= timedelta(days=92)
            or begin < as_of - timedelta(days=92)
            or begin.astimezone(UTC).time().isoformat() != "00:00:00"
        ):
            raise ValueError("Cost periods must begin at UTC day boundaries within the bounded 92-day window")
        if period["kind"] == "forecast":
            if end > as_of + timedelta(days=92):
                raise ValueError("Forecast period exceeds captured as_of horizon")
        elif end > as_of:
            raise ValueError("Historical reporting period cannot end after captured as_of")
        begin = begin.astimezone(UTC)
        next_month = datetime(begin.year + (begin.month == 12), begin.month % 12 + 1, 1, tzinfo=UTC)
        if period["kind"] == "closed_month" and (begin.day != 1 or end != next_month - timedelta(milliseconds=1)):
            raise ValueError("closed_month requires exact calendar-month boundaries")
        if period["kind"] == "month_to_date" and (begin.day != 1 or end >= next_month):
            raise ValueError("month_to_date must remain inside its calendar month")


def cost_periods(reporting: dict) -> list[dict]:
    result = []
    for period in reporting["periods"]:
        kind = period.get("kind", "custom")
        if kind not in ("closed_month", "month_to_date", "custom", "forecast"):
            raise ValueError("Unsupported reporting period kind")
        bounds = {}
        for key in ("from", "to"):
            value = period[key]
            if isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\d", value):
                date.fromisoformat(value)
                value += "T00:00:00.000Z" if key == "from" else "T23:59:59.999Z"
            if not isinstance(value, str) or not re.fullmatch(
                r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)", value
            ):
                raise ValueError("Period bounds require ISO dates or timezone-qualified millisecond timestamps")
            bounds[key] = value
        result.append({"id": period["id"], "kind": kind, **bounds})
    return result


def cost_plan(run: dict) -> dict:
    reporting = run["reporting"]
    return {
        "as_of": reporting["as_of"],
        "scopes": run["scope"]["azure_scopes"],
        "periods": cost_periods(reporting),
        "cost_type": reporting.get("cost_type", "ActualCost"),
        "metric": reporting.get("metric", "PreTaxCost"),
        "group_by": reporting.get("group_by", ["ServiceName", "ResourceId"]),
        **({"expected_currency": reporting["currency"]} if reporting["currency"] is not None else {}),
    }


def validate_billing_scopes(scopes: list[str]) -> None:
    root = workspace_root_for()
    helper = (root / "tools/scripts/assessment-cost.mjs").resolve().as_uri()
    checked = subprocess.run(
        [
            "node",
            "--input-type=module",
            "--eval",
            "const {validateScopes}=await import(process.argv[1]);validateScopes(JSON.parse(process.argv[2]));",
            helper,
            json.dumps(scopes),
        ],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if checked.returncode:
        raise ValueError(f"Assessment billing scope validation failed: {checked.stderr.strip()}")


def validate_state(data: dict) -> None:
    active = enabled(data)
    run = data.get("assessment_run")
    if not active:
        if "assessment_run" in data:
            raise ValueError("Assessment run requires explicit assessment workflow mode")
        return
    if not isinstance(run, dict) or run.get("schema_version") != "assessment-run-v1":
        raise ValueError("Assessment workflow requires assessment-run-v1 state; no numeric fallback")
    required = {
        "schema_version",
        "scenario",
        "source",
        "scope",
        "reporting",
        "receipt",
        "phase",
        "status",
        "completed_phases",
        "scope_digest",
        "review_links",
        "frozen_inputs",
        "coverage",
        "started_at",
    }
    if required - set(run) or set(run) - required - {
        "acceptance",
        "accepted_at",
        "reviews",
        "bundle_contract",
        "action_register",
        "bundle_adoption_receipt",
    }:
        raise ValueError("Invalid assessment-run-v1 fields")
    if run["coverage"] not in ("complete", "partial", "not_assessed") or not all(
        isinstance(run[key], dict) for key in ("review_links", "frozen_inputs")
    ):
        raise ValueError("Invalid assessment coverage or binding maps")
    validate_scope({key: run[key] for key in ("scenario", "source", "scope", "reporting", "receipt")})
    graph = profile()
    bundle_contract(run, graph)
    required_outputs(run, graph)
    phases = route(run, graph)
    if run.get("phase") not in phases or run.get("completed_phases") != phases[: phases.index(run["phase"])]:
        raise ValueError("Assessment phase/predecessors differ from graph route")
    if run.get("status") != ("accepted" if run["phase"] == graph["terminal"] else "in_progress"):
        raise ValueError("Assessment status does not match phase")
    from .practical import digest

    if run.get("scope_digest") != digest(scope_projection(run)):
        raise ValueError("Assessment authorized scope digest changed")
    if run["status"] == "accepted":
        _receipt(run.get("acceptance"))
        if run["acceptance"]["request_id"] in {
            run["receipt"]["request_id"],
            run.get("bundle_adoption_receipt", {}).get("request_id"),
        }:
            raise ValueError("Final acceptance requires a distinct actual owner response")
    if "bundle_adoption_receipt" in run:
        _receipt(run["bundle_adoption_receipt"])
    for relative, sha in run.get("frozen_inputs", {}).items():
        safe_path(project_dir(data["project"]), relative)
        if not isinstance(sha, str) or not re.fullmatch(r"[a-f0-9]{64}", sha):
            raise ValueError("Invalid assessment frozen input digest")
    for lens, linkage in run.get("review_links", {}).items():
        if lens not in LENSES or not isinstance(linkage, dict):
            raise ValueError("Invalid assessment review-cycle linkage")
        cycle = data.get("decisions", {}).get("review_cycles", {}).get(linkage.get("cycle_id"))
        if not cycle or cycle["lens"] != lens or cycle["step"] != "2":
            raise ValueError("Assessment linkage must preserve its original Step 2 artifact/lens cycle")
        if (
            linkage.get("artifact") != graph["reviews"][lens]["artifact"]
            or linkage.get("original_artifact") != cycle["artifact"]
        ):
            raise ValueError("Assessment alias differs from the original/current report identities")
        safe_path(project_dir(data["project"]), linkage["artifact"])


def _watch(data: dict, path: Path) -> str:
    revision = file_revision(path)
    if not path.is_file() or path.stat().st_size == 0:
        raise ValueError(f"Required assessment artifact missing or empty: {path.name}")
    if hasattr(data, "input_revisions"):
        if path in data.input_revisions and data.input_revisions[path] != revision:
            raise ValueError("Assessment input changed during readiness validation")
        data.input_revisions.setdefault(path, revision)
    return revision


def _node_check(root: Path, script: str, *arguments: str) -> str:
    checked = subprocess.run(
        ["node", str((root / "tools/scripts" / script).resolve()), *arguments],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if checked.returncode:
        raise ValueError(f"{script} failed: {checked.stdout.strip()} {checked.stderr.strip()}")
    return checked.stdout


def validate_register_export(directory: Path, data: dict, path: Path) -> dict:
    root = workspace_root_for()
    for dependency in (
        "tools/scripts/assessment-action-register.mjs",
        "tools/schemas/assessment-action-register.schema.json",
    ):
        _watch(data, root / dependency)
    checked = json.loads(
        _node_check(
            root,
            "assessment-action-register.mjs",
            "validate-export",
            "--input",
            str(path),
            "--root",
            str(directory),
            "--as-of",
            datetime.now(UTC).isoformat(timespec="milliseconds"),
        )
    )
    if checked.get("valid") is not True or not isinstance(checked.get("receipt"), dict):
        raise ValueError("Action register export validation returned no verified receipt")
    receipt = checked["receipt"]
    revisions = {}
    for relative, expected in receipt["evidence_hashes"].items():
        source = safe_path(directory, relative)
        revisions[relative] = _watch(data, source)
        if revisions[relative] != expected:
            raise ValueError("Action register Finance/source bytes changed during export validation")
    for relative, expected in receipt["tool_hashes"].items():
        # The validated tool manifest is relative to tools/scripts, including ../schemas.
        source = (root / "tools/scripts" / relative).resolve()
        if not source.is_relative_to((root / "tools").resolve()):
            raise ValueError("Action register validator dependency escapes tool scope")
        if _watch(data, source) != expected:
            raise ValueError("Action register validator bytes changed during export validation")
    return revisions


def check_outputs(project: str, data: dict, phase: str, graph: dict) -> dict:
    run = data["assessment_run"]
    directory = project_dir(project)
    paths = output_paths(run, graph, phase)
    revisions = {relative: _watch(data, safe_path(directory, relative)) for relative in paths}
    for relative in paths:
        path = safe_path(directory, relative)
        if path.suffix == ".json":
            document = json.loads(path.read_text(encoding="utf-8"))
            if relative == "contracts/assessment-evidence.json":
                validate_evidence(document, run)
                run["coverage"] = document["coverage"]
            if relative == "contracts/assessment-action-register.json":
                if (
                    document.get("project") != project
                    or document.get("source") != run["source"]
                    or document.get("scopes") != run["scope"]["azure_scopes"]
                    or document.get("as_of") != run["reporting"]["as_of"]
                ):
                    raise ValueError("Action register project/source/scopes/as_of differ from authorized assessment")
                revisions.update(validate_register_export(directory, data, path))
                for reference in document["evidence_refs"]:
                    if reference["kind"] == "cost":
                        imported = safe_path(directory, reference["path"])
                        revisions[reference["path"]] = _watch(data, imported)
                        revisions.update(validate_cost_report(directory, data, imported, run))
            if relative == "contracts/03-cost-management.json":
                revisions.update(validate_cost_report(directory, data, path, run))
        if path.suffix == ".png":
            raw = path.read_bytes()
            if len(raw) < 33 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
                raise ValueError("Assessment PNG signature/IHDR invalid")
            if not all(struct.unpack(">II", raw[16:24])):
                raise ValueError("Assessment PNG dimensions must be nonzero")
        if path.suffix == ".svg":
            svg = ET.fromstring(path.read_text(encoding="utf-8"))
            if svg.tag != "{http://www.w3.org/2000/svg}svg" or not list(svg):
                raise ValueError("Assessment SVG must be a nonempty SVG document")
    return revisions


def validate_cost_report(directory: Path, data: dict, path: Path, run: dict) -> dict:
    document = json.loads(path.read_text(encoding="utf-8"))
    validate_cost_scope(document, run)
    if hasattr(data, "input_revisions"):
        for dependency in ("tools/scripts/assessment-cost.mjs", "tools/schemas/assessment-cost.schema.json"):
            _watch(data, workspace_root_for() / dependency)
    _node_check(
        workspace_root_for(),
        "assessment-cost.mjs",
        "validate",
        "--input",
        str(path),
        "--as-of",
        datetime.now(UTC).isoformat(timespec="milliseconds"),
        "--root",
        str(directory),
        *[argument for scope in run["scope"]["azure_scopes"] for argument in ("--scope", scope)],
        *(["--approved-plan", json.dumps(cost_plan(run))] if run["scope"]["azure_scopes"] else []),
    )
    revisions = {}
    for item in [*document.get("evidence", []), *document.get("estimates", []), *document.get("opportunities", [])]:
        provenance = item.get("provenance")
        if provenance:
            source = safe_path(directory, provenance["path"])
            relative = source.relative_to(directory).as_posix()
            revisions[relative] = _watch(data, source)
            if revisions[relative] != provenance["sha256"]:
                raise ValueError("Cost source bytes changed during readiness validation")
    return revisions


def validate_cost_scope(document: dict, run: dict) -> None:
    if document.get("scopes") != run["scope"]["azure_scopes"] or document.get("as_of") != run["reporting"]["as_of"]:
        raise ValueError("Cost report scope/as_of differs from authorized assessment reporting")
    if document.get("periods") != cost_periods(run["reporting"]):
        raise ValueError("Cost report periods differ from authorized reporting")
    for item in document.get("evidence", []):
        if item.get("provenance") and "billing" not in run["scope"]["categories"]:
            raise ValueError("Actual billing evidence was not authorized")
    if document.get("opportunities") and not set(run["scope"]["categories"]) & {"utilization", "operations"}:
        raise ValueError("Cost opportunities require authorized utilization/operations evidence")


def validate_evidence(document: dict, run: dict) -> None:
    if (
        not isinstance(document, dict)
        or set(document) != {"coverage", "checks"}
        or document["coverage"] not in ("complete", "partial", "not_assessed")
        or not isinstance(document["checks"], list)
        or not document["checks"]
    ):
        raise ValueError("Assessment evidence requires coverage and explicit checks")
    allowed = run["scope"]["iac_paths"] + run["scope"]["azure_scopes"]
    for check in document["checks"]:
        if (
            not isinstance(check, dict)
            or set(check) != {"category", "scope", "status", "evidence"}
            or check["category"] not in run["scope"]["categories"]
            or check["scope"] not in allowed
            or check["status"] not in ("observed", "declared", "inferred", "unknown", "denied", "not_applicable")
            or not isinstance(check["evidence"], str)
            or not check["evidence"].strip()
        ):
            raise ValueError("Assessment evidence check exceeds authorized scope or lacks truthful provenance")
    if document["coverage"] == "complete" and any(
        check["status"] in ("unknown", "denied") for check in document["checks"]
    ):
        raise ValueError("Denied/unknown evidence cannot be labelled complete")


def review_artifact(run: dict, lens: str, graph: dict) -> str:
    return graph["reviews"][lens]["artifact"]


def review_key(data: dict, request: dict) -> str:
    from .practical import cycle_identity

    run = data["assessment_run"]
    lens = request.get("review_focus")
    graph = profile()
    if (
        lens not in LENSES
        or request.get("artifact_type") != LENSES[lens]
        or request.get("step") != "2"
        or request.get("pass_number") != 1
        or request.get("artifact_path") != f"agent-output/{data['project']}/{review_artifact(run, lens, graph)}"
    ):
        raise ValueError("Assessment reviews must retain exact Step 2 artifact/lens identity and bound report path")
    linkage = run.get("review_links", {}).get(lens)
    return linkage["cycle_id"] if linkage else cycle_identity(request)


def check_frozen(project: str, data: dict) -> None:
    run = data["assessment_run"]
    if not run.get("frozen_inputs"):
        raise ValueError("Assessment bundle has not been frozen")
    graph = profile()
    expected = {}
    phases = route(run, graph)
    for phase in phases[: phases.index("review")]:
        expected.update(check_outputs(project, data, phase, graph))
    if set(expected) != set(run["frozen_inputs"]):
        raise ValueError("Assessment frozen inputs omit required bundle/source artifacts")
    for relative, revision in run["frozen_inputs"].items():
        if _watch(data, safe_path(project_dir(project), relative)) != revision:
            raise ValueError("Assessment frozen inputs are stale; bounded closure/review required")


def check_reviews(project: str, data: dict, graph: dict) -> list[dict]:
    check_frozen(project, data)
    run = data["assessment_run"]
    root = workspace_root_for()
    directory = project_dir(project)
    result = []
    cycles = data.get("decisions", {}).get("review_cycles", {})
    for lens in graph["reviews"]:
        artifact = review_artifact(run, lens, graph)
        linkage = run.get("review_links", {}).get(lens)
        matches = (
            [(linkage["cycle_id"], cycles[linkage["cycle_id"]])]
            if linkage
            else [
                (key, cycle)
                for key, cycle in cycles.items()
                if cycle["step"] == "2"
                and cycle["lens"] == lens
                and cycle["artifact"] == f"agent-output/{project}/{artifact}"
            ]
        )
        if len(matches) != 1:
            raise ValueError(f"Missing or ambiguous attributed assessment review cycle: {lens}")
        key, cycle = matches[0]
        relative = cycle.get("current_path") or (Path(cycle["canonical_path"]).name if linkage else None)
        if not relative:
            raise ValueError(f"Assessment review has no actual selected result: {lens}")
        from .project_paths import resolve_review_path

        sidecar = resolve_review_path(directory, relative)
        safe_path(directory, sidecar.relative_to(directory).as_posix())
        _watch(data, sidecar)
        review = json.loads(sidecar.read_text(encoding="utf-8"))
        execution = review.get("review_execution", {})
        attempts = [
            item
            for item in data.get("review_attempts", [])
            if item.get("cycle_id") == key and item["id"] == execution.get("request_id")
        ]
        if (
            not attempts
            or attempts[-1].get("outcome") != "completed"
            or attempts[-1].get("review_output") != "nonempty"
        ):
            raise ValueError("Assessment reviewer output is not an actual attributed completed invocation")
        if (
            review.get("review_focus") != lens
            or review.get("artifact_type") != LENSES[lens]
            or review.get("must_fix_count") != 0
            or review.get("overall_assessment") != "APPROVED"
            or any(item.get("severity") == "must_fix" for item in review.get("findings", []))
            or review.get("challenged_artifact") != cycle.get("current_artifact", cycle["artifact"])
        ):
            raise ValueError("Assessment review identity is invalid or has unresolved reviewer must-fix findings")
        old_artifact = root / cycle.get("current_artifact", cycle["artifact"])
        if file_revision(old_artifact) != file_revision(safe_path(directory, artifact)):
            raise ValueError("Aliased assessment report differs from preserved original reviewed bytes")
        supporting = {item["path"]: item["sha256"] for item in review.get("supporting_inputs", [])}
        primary = f"agent-output/{project}/{artifact}"
        for relative, sha in run["frozen_inputs"].items():
            expected = f"agent-output/{project}/{relative}"
            aliased = [
                alias["original_artifact"]
                for alias in run.get("review_links", {}).values()
                if alias["artifact"] == relative and file_revision(root / alias["original_artifact"]) == sha
            ]
            frozen = supporting.get(expected) == sha or any(supporting.get(alias) == sha for alias in aliased)
            if expected != primary and not frozen:
                raise ValueError("Assessment review must freeze every supporting bundle input")
        _node_check(root, "validate-challenger-findings.mjs", "--path", str(sidecar), "--verify-cache")
        if hasattr(data, "input_revisions"):
            for item in review.get("supporting_inputs", []):
                path = root / item["path"]
                _watch(data, path)
            for relative in (
                ".github/agents/_subagents/challenger-review-subagent.agent.md",
                ".github/skills/apex-azure-defaults/references/one-shot-review.md",
                ".github/skills/apex-azure-defaults/references/adversarial-checklists.md",
                ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md",
                "tools/scripts/validate-challenger-findings.mjs",
            ):
                path = root / relative
                _watch(data, path)
        result.append(
            {
                "lens": lens,
                "cycle_id": key,
                "path": str(sidecar.relative_to(directory)),
                "sha256": file_revision(sidecar),
            }
        )
    return result


def readiness(project: str, data: dict) -> dict:
    try:
        validate_state(data)
        graph = profile()
        if hasattr(data, "input_revisions"):
            graph_path = workspace_root_for() / ".github/skills/apex-workflow-engine/templates/workflow-graph.json"
            _watch(data, graph_path)
        for phase in route(data["assessment_run"], graph):
            check_outputs(project, data, phase, graph)
        reviews = check_reviews(project, data, graph)
        return {"status": "ready", "reviews": reviews, "coverage": data["assessment_run"].get("coverage")}
    except (ValueError, OSError, KeyError, ET.ParseError) as error:
        return {"status": "blocked", "error": str(error)}


def adoption_links(project: str, data: dict, request: dict, graph: dict) -> tuple[dict, list[dict]]:
    cycles = data.get("decisions", {}).get("review_cycles", {})
    supplied = request.get("review_links", {})
    if not isinstance(supplied, dict) or set(supplied) - set(LENSES):
        raise ValueError("Adoption review_links must name existing required lenses")
    links, report = {}, []
    if any(
        item["step"] == "2" and item["kind"] in ("invocation", "empty-output-retry") and not item.get("cycle_id")
        for item in data.get("review_attempts", [])
    ):
        raise ValueError("Unattributed historical review calls require explicit reconciliation before adoption")
    for lens in LENSES:
        relevant = [(key, cycle) for key, cycle in cycles.items() if cycle["step"] == "2" and cycle["lens"] == lens]
        chosen = supplied.get(lens)
        if relevant and (chosen is None or chosen not in dict(relevant)):
            raise ValueError("Explicit unambiguous original cycle_id linkage required; no fresh allowance on adoption")
        if chosen is None:
            continue
        if chosen not in dict(relevant):
            raise ValueError("Unknown adoption cycle identity")
        cycle = cycles[chosen]
        from .practical import cycle_identity

        if (
            chosen
            != cycle_identity(
                {
                    "step": cycle["step"],
                    "artifact_path": cycle["artifact"],
                    "review_focus": cycle["lens"],
                    "pass_number": cycle.get("pass_number"),
                }
            )
            or cycle.get("pass_number") != 1
        ):
            raise ValueError("Adoption linkage conflicts with the original recorded cycle identity/pass")
        artifact = graph["reviews"][lens]["artifact"]
        safe_path(project_dir(project), artifact)
        links[lens] = {
            "cycle_id": chosen,
            "artifact": artifact,
            "original_artifact": cycle["artifact"],
            "original_projection": cycle["projection"],
            "linked_at": _iso_now(),
        }
        from .project_paths import resolve_review_path

        selected = cycle.get("current_path")
        freshness = "missing"
        if selected:
            try:
                _node_check(
                    workspace_root_for(),
                    "validate-challenger-findings.mjs",
                    "--path",
                    str(resolve_review_path(project, selected)),
                    "--verify-cache",
                )
                freshness = "current"
            except ValueError:
                freshness = "stale_or_invalid"
        report.append(
            {
                "cycle_id": chosen,
                "original_artifact": cycle["artifact"],
                "artifact": artifact,
                "lens": lens,
                "calls": cycle["calls"],
                "max_calls": cycle["max_calls"],
                "remaining": cycle["max_calls"] - cycle["calls"],
                "freshness": freshness,
            }
        )
    return links, report


def historical_cycles(project: str, data: dict) -> list[dict]:
    from .project_paths import resolve_review_path

    report = []
    for key, cycle in data.get("decisions", {}).get("review_cycles", {}).items():
        selected = cycle.get("current_path") or Path(cycle["canonical_path"]).name
        path = resolve_review_path(project, selected)
        freshness = "missing"
        if path.is_file():
            try:
                _node_check(
                    workspace_root_for(), "validate-challenger-findings.mjs", "--path", str(path), "--verify-cache"
                )
                freshness = "current"
            except ValueError:
                freshness = "stale_or_invalid"
        report.append(
            {
                "cycle_id": key,
                "step": cycle["step"],
                "original_artifact": cycle["artifact"],
                "lens": cycle["lens"],
                "calls": cycle["calls"],
                "max_calls": cycle["max_calls"],
                "remaining": cycle["max_calls"] - cycle["calls"],
                "freshness": freshness,
                "original_projection": cycle["projection"],
                "review_sha256": file_revision(path),
            }
        )
    return report


def adopt_bundle(project: str, data: dict, request: dict, graph: dict, *, preview: bool = False) -> dict:
    from .practical import digest

    validate_state(data)
    run = data["assessment_run"]
    original = deepcopy(run)
    old_contract = bundle_contract(run, graph)
    if graph["_graph_version"] != "3.2":
        raise ValueError("Register bundle adoption requires graph 3.2")
    if any(request[key] != run[key] for key in ("scenario", "source", "scope", "reporting")):
        raise ValueError("Bundle adoption cannot change the existing authorized assessment evidence scope")
    selected = request["source"] in ("azure", "combined") or request.get("action_register", False)
    if not selected or (old_contract == BUNDLE_V2 and run.get("action_register")):
        raise ValueError("Explicit register selection required; already selected bundles cannot renew allowance")
    receipt = request.get("receipt")
    if not preview:
        _receipt(receipt)
        if receipt["request_id"] in {
            run["receipt"]["request_id"],
            run.get("acceptance", {}).get("request_id"),
            run.get("bundle_adoption_receipt", {}).get("request_id"),
        }:
            raise ValueError("Bundle adoption requires its own actual owner scope response")
    links, cycles = adoption_links(project, data, request, graph)
    old_outputs = required_outputs(run, graph)
    run["bundle_contract"] = BUNDLE_V2
    run["action_register"] = True
    if receipt is not None and receipt.get("approved") is True:
        run["bundle_adoption_receipt"] = deepcopy(receipt)
    run["scope_digest"] = digest(scope_projection(run))
    run["review_links"].update(links)
    phases = route(run, graph)
    if phases.index(run["phase"]) >= phases.index("analysis"):
        run["phase"] = "analysis"
        run["completed_phases"] = phases[: phases.index("analysis")]
    run["status"] = "in_progress"
    for key in ("acceptance", "accepted_at", "reviews"):
        run.pop(key, None)
    outputs = required_outputs(run, graph)
    changes = [relative for relative in outputs if relative not in old_outputs]
    revisions = {relative: file_revision(safe_path(project_dir(project), relative)) for relative in outputs}
    if not preview:
        data.setdefault("decision_log", []).append(
            {
                "decision": "Explicit owner-scoped register adoption; preserve prior acceptance and review allowance",
                "receipt": deepcopy(receipt),
                "prior_assessment_run": original,
                "required_output_changes": changes,
                "timestamp": _iso_now(),
            }
        )
    return {
        "status": "adopted",
        "phase": run["phase"],
        "old_bundle_contract": old_contract,
        "bundle_contract": BUNDLE_V2,
        "action_register": True,
        "required_outputs": outputs,
        "required_output_changes": changes,
        "output_revisions": revisions,
        "prior_frozen_inputs": original["frozen_inputs"],
        "prior_status": original["status"],
        "cycles": cycles,
        "review_extension_required": any(cycle["remaining"] <= 0 for cycle in cycles),
        "historical_cycles": historical_cycles(project, data),
    }


def mutate(
    project: str, data: dict, action: str, request: dict, phase: str | None = None, *, preview: bool = False
) -> dict:
    from .practical import digest

    graph_path = workspace_root_for() / ".github/skills/apex-workflow-engine/templates/workflow-graph.json"
    if hasattr(data, "input_revisions"):
        _watch(data, graph_path)
        helper = workspace_root_for() / "tools/scripts/assessment-cost.mjs"
        _watch(data, helper)
    graph = profile()
    if action in ("start", "adopt"):
        if phase is not None:
            raise ValueError("Start/adopt cannot select an arbitrary phase; the graph entry determines routing")
        validate_scope(request, require_approval=not preview)
        if enabled(data) or data.get("assessment_run") is not None:
            if action != "adopt":
                raise ValueError("Assessment already selected; resume it rather than resetting history")
            return adopt_bundle(project, data, request, graph, preview=preview)
        if action == "start" and (
            data.get("review_attempts")
            or data.get("decisions", {}).get("review_cycles")
            or any(item.get("status") != "pending" for item in data.get("steps", {}).values())
        ):
            raise ValueError("Existing project history requires explicit adoption")
        links, cycles = adoption_links(project, data, request, graph)
        history = historical_cycles(project, data)
        run = {
            "schema_version": "assessment-run-v1",
            "bundle_contract": BUNDLE_V2 if graph["_graph_version"] == "3.2" else BUNDLE_V1,
            "action_register": (request["source"] in ("azure", "combined") or request.get("action_register", False))
            if graph["_graph_version"] == "3.2"
            else False,
            **{key: request[key] for key in ("scenario", "source", "scope", "reporting")},
            "receipt": request.get("receipt"),
            "phase": graph["entry"],
            "status": "in_progress",
            "completed_phases": [],
            "review_links": links,
            "frozen_inputs": {},
            "coverage": "not_assessed",
            "started_at": _iso_now(),
        }
        if graph["_graph_version"] == "3.1" and request.get("action_register"):
            raise ValueError("Register selection requires graph 3.2")
        run["scope_digest"] = digest(scope_projection(run))
        outputs = required_outputs(run, graph)
        for relative in outputs:
            safe_path(project_dir(project), relative)
        phases = route(run, graph)
        run["completed_phases"].append(graph["entry"])
        run["phase"] = phases[1]
        data.setdefault("decisions", {})["workflow_mode"] = MODE
        data["assessment_run"] = run
        data.setdefault("decision_log", []).append(
            {
                "decision": f"Explicit standalone assessment {action}; preserve delivery and review history",
                "receipt": request.get("receipt"),
                "review_links": links,
                "timestamp": _iso_now(),
            }
        )
        return {
            "status": "started" if action == "start" else "adopted",
            "phase": run["phase"],
            "cycles": cycles,
            "historical_cycles": history,
            "bundle_contract": run["bundle_contract"],
            "action_register": run["action_register"],
            "required_outputs": outputs,
        }
    if not enabled(data):
        raise ValueError("Explicit assessment start/adoption required")
    validate_state(data)
    run = data["assessment_run"]
    phases = route(run, graph)
    if run["status"] == "accepted":
        raise ValueError("Assessment is terminal")
    if phase is not None and phase != run["phase"]:
        raise ValueError("Assessment phase is out of order")
    if action == "revise":
        if set(request) - {"receipt", "expected_revision"}:
            raise ValueError("Revise cannot change authorized scope, material inputs or review accounting")
        _receipt(request.get("receipt"))
        if request["receipt"]["request_id"] == run["receipt"]["request_id"]:
            raise ValueError("Revise requires its own actual owner response, not upfront scope approval")
        returns = [
            edge
            for edge in graph.get("return_edges", [])
            if edge["from"] == run["phase"] and edge["to"] == "review" and edge["condition"] == "on_refine"
        ]
        if len(returns) != 1:
            raise ValueError("No authorized assessment repair return from the current graph phase")
        data.setdefault("decision_log", []).append(
            {
                "decision": "Owner-approved assessment repair return; preserve scope and spent review allowance",
                "receipt": request["receipt"],
                "from": run["phase"],
                "to": "review",
                "completed_phases": list(run["completed_phases"]),
                "timestamp": _iso_now(),
            }
        )
        run["phase"] = "review"
        run["completed_phases"] = phases[: phases.index("review")]
        return {"status": run["status"], "phase": run["phase"], "revised": True}
    if action == "accept":
        if run["phase"] != "acceptance":
            raise ValueError("Assessment cannot be accepted before its final graph gate")
        if set(request) - {"receipt", "expected_revision"}:
            raise ValueError("Unknown assessment acceptance fields")
        _receipt(request.get("receipt"))
        if request["receipt"]["request_id"] in {
            run["receipt"]["request_id"],
            run.get("bundle_adoption_receipt", {}).get("request_id"),
        }:
            raise ValueError("Final acceptance requires its own actual owner response, not upfront scope approval")
        ready = readiness(project, data)
        if ready["status"] != "ready":
            raise ValueError(f"Assessment acceptance blocked: {ready['error']}")
        run["acceptance"] = {**request["receipt"]}
        run["accepted_at"] = _iso_now()
        run["reviews"] = ready["reviews"]
        data.setdefault("decision_log", []).append(
            {
                "decision": "Accept standalone assessment bundle; no implementation authorization",
                "receipt": request["receipt"],
                "inputs": run["frozen_inputs"],
                "reviews": ready["reviews"],
                "timestamp": _iso_now(),
            }
        )
    elif action == "advance":
        if set(request) - {"expected_revision", "refresh_inputs"}:
            raise ValueError("Advance cannot alter authorized assessment scope")
        if phase is None or graph["nodes"][run["phase"]]["type"] == "gate":
            raise ValueError("Explicit current phase required; final acceptance needs actual owner receipt")
        for previous in phases[: phases.index(phase) + 1]:
            check_outputs(project, data, previous, graph)
        if request.get("refresh_inputs") is not None and (phase != "review" or request["refresh_inputs"] is not True):
            raise ValueError("refresh_inputs:true is supported only at the current review phase")
        if phase == "diagram" or request.get("refresh_inputs"):
            frozen = {}
            for previous in phases[: phases.index("review")]:
                frozen.update(check_outputs(project, data, previous, graph))
            run["frozen_inputs"] = frozen
            if request.get("refresh_inputs"):
                return {"status": "in_progress", "phase": run["phase"], "inputs_refreshed": True}
        if phase == "review":
            check_reviews(project, data, graph)
    else:
        raise ValueError("Unknown assessment action")
    run["completed_phases"].append(run["phase"])
    run["phase"] = phases[phases.index(run["phase"]) + 1]
    run["status"] = "accepted" if run["phase"] == graph["terminal"] else "in_progress"
    return {"status": run["status"], "phase": run["phase"]}


def handoff(project: str, data: dict, auto_selected: bool = False) -> dict:
    validate_state(data)
    run = data["assessment_run"]
    graph = profile()
    terminal = run["phase"] == graph["terminal"]
    return {
        "status": "TERMINAL" if terminal else "READY",
        "project": project,
        "auto_selected": auto_selected,
        "workflow_mode": MODE,
        "workflow_contract": data.get("decisions", {}).get("workflow_contract") or "legacy",
        "active_step": None,
        "phase": run["phase"],
        "checkpoint": run["phase"],
        "step_status": run["status"],
        "next_owner": None if terminal else graph["nodes"][run["phase"]]["agent"],
        "frozen_artifacts": sorted(run["frozen_inputs"]),
        "bundle_contract": bundle_contract(run, graph),
        "action_register": run.get("action_register", False),
        "required_outputs": required_outputs(run, graph),
        "coverage": run["coverage"],
        "assessment_run": run,
        "readiness": readiness(project, data) if run["phase"] in ("review", "acceptance", "terminal") else None,
        "resume_command": f"apex-recall handoff {project} --json",
        "delegation_prompt": None
        if terminal
        else f"Resume authorized standalone assessment {project} at {run['phase']}; no numeric delivery transitions.",
    }
