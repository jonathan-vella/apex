"""'apex-recall show' command — full context dump for one project."""

from __future__ import annotations

import json
from types import SimpleNamespace

from ..indexer import classify_artifact, extract_step
from ..risk_gate import ACTIONS, evaluate_gate
from ..state_writer import check_state_revision, read_state, session_state_path
from .complete_step import (
    _CHALLENGER_GATE,
    _challenger_findings_invalid,
    _challenger_findings_missing,
    _review_paths,
    _select_replacement_review,
    watch_review_inputs,
)


class ProjectInventory:
    """Read-only adapter for the existing show presentation; never opens the index."""

    def __init__(self, project):
        self.primary = session_state_path(project)
        self.rows = []

    def execute(self, query, params):
        if "SELECT content" in query:
            self.rows = [(json.dumps(read_state(self.primary)),)] if self.primary.exists() else []
        else:
            self.rows = []
            for artifact in sorted(self.primary.parent.rglob("*")):
                if (
                    artifact.is_file()
                    and not artifact.is_symlink()
                    and not artifact.name.startswith(".")
                    and artifact.suffix not in (".bak", ".lock", ".tmp")
                ):
                    self.rows.append(
                        (
                            str(artifact.relative_to(self.primary.parent.parent.parent)),
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
        if row or primary.exists():
            data = read_state(primary)
            if data and isinstance(data, dict):
                session = {
                    "current_step": data.get("current_step", 0),
                    "iac_tool": data.get("iac_tool", ""),
                    "region": data.get("region", ""),
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
                if exception_bearing:
                    review_steps |= {
                        step
                        for step, (artifact, _) in _CHALLENGER_GATE.items()
                        if (primary.parent / artifact).is_file()
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
                                "review_verdicts": [review.get("overall_assessment") for _, review in reviews],
                                "gate_error": result.get("error"),
                                "input_coverage": "primary-and-review-guidance",
                            }
                            continue
                        missing, _, _ = _challenger_findings_missing(project, step, selected)
                        error = (
                            "Selected review missing"
                            if missing
                            else _challenger_findings_invalid(project, step, selected)
                        )
                        check_state_revision(data, primary)
                        effective[step] = {
                            "status": "invalid" if error else "current",
                            "error": error,
                            "input_coverage": "primary-and-review-guidance",
                        }
                    except (OSError, ValueError) as error:
                        effective[step] = {"status": "invalid", "error": str(error)}
                session["effective_reviews"] = effective
                readiness = {}
                if exception_bearing:
                    for action in ACTIONS:
                        try:
                            result = evaluate_gate(project, data, action)
                            readiness[action] = {
                                key: value for key, value in result.items() if key not in ("record", "watched_inputs")
                            }
                        except (OSError, ValueError) as error:
                            readiness[action] = {"status": "blocked", "error": str(error)}
                session["gate_readiness"] = readiness
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
