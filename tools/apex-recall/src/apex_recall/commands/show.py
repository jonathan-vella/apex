"""'apex-recall show' command — full context dump for one project."""

from __future__ import annotations

import json
from types import SimpleNamespace

from ..indexer import classify_artifact, extract_step
from ..risk_gate import ACTIONS, evaluate_gate
from ..state_writer import check_state_revision, project_dir, read_state, session_state_path, workspace_root_for
from .complete_step import (
    _CHALLENGER_GATE,
    _challenger_findings_invalid,
    _challenger_findings_missing,
    _review_paths,
    _select_replacement_review,
    is_audited_replay,
    review_verdict,
    watch_review_inputs,
)


class ProjectInventory:
    """Read-only adapter for the existing show presentation; never opens the index."""

    def __init__(self, project):
        self.primary = session_state_path(project)
        self.project_dir = project_dir(project)
        self.root = workspace_root_for()
        self.rows = []

    def execute(self, query, params):
        if "SELECT content" in query:
            self.rows = [(json.dumps(read_state(self.primary)),)] if self.primary.exists() else []
        else:
            self.rows = []
            if self.project_dir.exists():
                for artifact in sorted(self.project_dir.rglob("*")):
                    if (
                        artifact.is_file()
                        and not artifact.is_symlink()
                        and not artifact.name.startswith(".")
                        and artifact.suffix not in (".bak", ".lock", ".tmp")
                    ):
                        self.rows.append(
                            (
                                str(artifact.resolve().relative_to(self.root)),
                                classify_artifact(artifact.name),
                                extract_step(artifact.name),
                                artifact.stat().st_mtime,
                            )
                        )
        return self

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows

    def close(self):
        pass


def run(args) -> int:
    """Full context dump for one project: decisions, findings, current step, key artifacts."""
    project = args.project
    conn = ProjectInventory(project)
    try:
        # Get session state
        row = conn.execute(
            "SELECT content FROM artifacts WHERE project = ? AND artifact_type = 'session-state'",
            (project,),
        ).fetchone()

        session = {}
        primary = session_state_path(project)
        pdir = project_dir(project)
        root = workspace_root_for()
        if row or primary.exists():
            data = read_state(primary)
            if data and isinstance(data, dict):
                decisions_map = data.get("decisions", {})
                if not isinstance(decisions_map, dict):
                    decisions_map = {}
                session = {
                    "current_step": data.get("current_step", 0),
                    "iac_tool": data.get("iac_tool") or decisions_map.get("iac_tool", ""),
                    "region": decisions_map.get("region") or data.get("region", ""),
                    "updated": data.get("updated", ""),
                    "decisions": data.get("decisions", {}),
                    "open_findings": data.get("open_findings", []),
                    "decision_log": data.get("decision_log", []),
                    # `steps` is the per-step status map keyed by string ids
                    # ("1", "2", "3", "3_5", "4", "5", "6", "7"). Default to
                    # {} so downstream `jq '.session.steps | to_entries[]'`
                    # never iterates over null. Schema documented in
                    # tools/apex-recall/docs/show-schema.md.
                    "steps": data.get("steps", {}),
                    "review_selections": data.get("review_selections", {}),
                    "metadata": data.get("metadata", {}),
                    "review_attempts": data.get("review_attempts", []),
                    "risk_authorizations": data.get("risk_authorizations", {}),
                }
                effective = {}
                exception_bearing = bool(data.get("risk_authorizations"))
                review_steps = set(data.get("review_selections", {}))
                review_steps |= {
                    step
                    for step, (artifact, _) in _CHALLENGER_GATE.items()
                    if (pdir / artifact).is_file()
                    and data.get("steps", {}).get(step, {}).get("status") in ("complete", "in_progress", "stale")
                }
                if exception_bearing:
                    review_steps |= {
                        step
                        for step, (artifact, _) in _CHALLENGER_GATE.items()
                        if (pdir / artifact).is_file()
                    }
                for step in sorted(review_steps):
                    try:
                        selected, selection = _select_replacement_review(project, step, SimpleNamespace(), data)
                        watch_review_inputs(data, project, step, selected)
                        if selection and data.input_revisions[selected] != selection["stored"]["sha256"]:
                            raise ValueError("Selected review changed during validation")
                        if step == "4" and exception_bearing:
                            missing, _, _ = _challenger_findings_missing(project, step, selected)
                            if missing:
                                skip_result = evaluate_gate(project, data, "plan-complete", selected=selected)
                                if skip_result.get("review_skip"):
                                    effective[step] = {
                                        "status": "current",
                                        "gate_status": "current",
                                        "review_skip": True,
                                        "unresolved_findings": [],
                                        "review_verdicts": [],
                                    }
                                    continue
                            error = (
                                "Plan review missing"
                                if missing
                                else _challenger_findings_invalid(project, step, selected, True)
                            )
                            if error:
                                raise ValueError(error)
                            reviews = [
                                (sidecar, json.loads(sidecar.read_text()))
                                for _, sidecar in _review_paths(project, step, selected)
                            ]
                            unresolved = [
                                {
                                    "review": str(sidecar),
                                    "id": finding["id"],
                                    "severity": "must_fix",
                                    "disposition": "unresolved",
                                    "owner": "artifact owner",
                                    "residual_impact": finding["impact"],
                                }
                                for sidecar, review in reviews
                                for finding in review["findings"]
                                if finding["severity"] == "must_fix"
                            ]
                            try:
                                result = evaluate_gate(project, data, "plan-complete", selected=selected)
                            except (OSError, ValueError) as gate_error:
                                result = {
                                    "status": "blocked",
                                    "error": str(gate_error),
                                    "unresolved_findings": unresolved,
                                }
                            effective[step] = {
                                "status": "current",
                                "gate_status": result["status"],
                                "unresolved_findings": result["unresolved_findings"],
                                "review_verdicts": [review_verdict(review) for _, review in reviews],
                                "gate_error": result.get("error"),
                                "input_coverage": "primary-and-review-guidance",
                            }
                            continue
                        missing, _, _ = _challenger_findings_missing(project, step, selected)
                        audited_skip = missing and selection is None and is_audited_replay(data, step)
                        error = (
                            "Selected review missing"
                            if missing and not audited_skip
                            else _challenger_findings_invalid(project, step, selected)
                        )
                        check_state_revision(data, primary)
                        effective[step] = {
                            "status": "invalid" if error else "current",
                            "error": error,
                            "input_coverage": "primary-and-review-guidance",
                        }
                        if not error:
                            if audited_skip:
                                effective[step].update(
                                    review_skip=True,
                                    skip_reasons=[
                                        record["reason"]
                                        for record in data.get("decisions", {}).get("challenger_skip", [])
                                        if record.get("step") == step and str(record.get("reason", "")).strip()
                                    ],
                                    input_coverage="audited-missing-review-skip",
                                )
                            effective[step]["reviews"] = [
                                {
                                    "path": str(sidecar.resolve().relative_to(root)),
                                    "artifact": str(artifact.resolve().relative_to(root)),
                                    "supporting_inputs": json.loads(sidecar.read_text(encoding="utf-8")).get(
                                        "supporting_inputs", []
                                    ),
                                }
                                for artifact, sidecar in _review_paths(project, step, selected)
                                if sidecar.is_file()
                            ]
                            effective[step]["review_verdicts"] = [
                                review_verdict(json.loads(sidecar.read_text(encoding="utf-8")))
                                for _, sidecar in _review_paths(project, step, selected)
                                if sidecar.is_file()
                            ]
                            effective[step]["gate_status"] = "current"
                    except (OSError, ValueError) as error:
                        effective[step] = {"status": "invalid", "error": str(error)}
                session["effective_reviews"] = effective
                readiness = {
                    f"step-{step}-complete": {
                        "status": (
                            "blocked" if result["status"] != "current" else result.get("gate_status", "current")
                        ),
                        "error": result.get("error"),
                        "permission_granted": False,
                        **(
                            {"review_skip": True, "skip_reasons": result["skip_reasons"]}
                            if result.get("review_skip") and "skip_reasons" in result
                            else {}
                        ),
                    }
                    for step, result in effective.items()
                }
                if exception_bearing:
                    review_cache: dict = {}
                    for action in ACTIONS:
                        try:
                            result = evaluate_gate(project, data, action, review_cache=review_cache)
                            readiness[action] = {
                                key: value for key, value in result.items() if key not in ("record", "watched_inputs")
                            }
                        except (OSError, ValueError) as error:
                            readiness[action] = {"status": "blocked", "error": str(error)}
                session["gate_readiness"] = readiness
                from ..practical import check_views, enabled, material_inputs

                if enabled(data):
                    session["workflow_contract"] = data["decisions"]["workflow_contract"]
                    session["material_inputs"] = material_inputs(data)
                    session["assessment_readiness"] = {}
                    from ..practical import action_readiness, check_feasibility

                    session["environment_readiness"] = {
                        environment: {
                            action: action_readiness(data, action, [environment])
                            for action in ("plan-complete", "code-complete", "deploy")
                        }
                        for environment in ("dev", "test", "staging", "prod", "sandbox")
                    }
                    try:
                        session["policy_feasibility"] = {"status": check_feasibility(project, data)}
                    except (OSError, ValueError) as error:
                        session["policy_feasibility"] = {"status": "blocked", "error": str(error)}
                    for step in data["decisions"].get("phase_scopes", {}):
                        try:
                            check_views(project, data, step)
                            session["assessment_readiness"][step] = {"status": "current"}
                        except (OSError, ValueError) as error:
                            session["assessment_readiness"][step] = {"status": "blocked", "error": str(error)}
                check_state_revision(data, primary)

        # Get all artifacts for this project
        artifacts = conn.execute(
            """SELECT file_path, artifact_type, step, modified_time
               FROM artifacts WHERE project = ?
               ORDER BY step, file_path""",
            (project,),
        ).fetchall()

        artifact_list = [{"file": a[0], "type": a[1], "step": a[2], "modified": a[3]} for a in artifacts]

        result = {
            "project": project,
            "session": session,
            "artifacts": artifact_list,
            "artifact_count": len(artifact_list),
            "state_status": "present" if session else "missing",
        }

        if args.json:
            print(json.dumps(result, indent=2))
        else:
            if not session and not artifact_list:
                print(f"No data found for project '{project}'.")
                return 0
            if session:
                print(f"  Project:      {project}")
                print(f"  Step:         {session.get('current_step', '?')}")
                print(f"  IaC Tool:     {session.get('iac_tool', '?')}")
                print(f"  Region:       {session.get('region', '?')}")
                print(f"  Updated:      {session.get('updated', '?')}")
                findings = session.get("open_findings", [])
                if findings:
                    print(f"  Open findings: {len(findings)}")
            print(f"  Artifacts:    {len(artifact_list)}")
            for a in artifact_list:
                print(f"    [{a['step']}] {a['type']:20s}  {a['file']}")

        return 0
    finally:
        conn.close()
