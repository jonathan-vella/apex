"""'apex-recall show' command — full context dump for one project."""

from __future__ import annotations

import json
from types import SimpleNamespace

from ..indexer import classify_artifact, extract_step
from ..state_writer import check_state_revision, read_state, session_state_path
from .complete_step import (
    _challenger_findings_invalid,
    _challenger_findings_missing,
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
                }
                effective = {}
                for step in data.get("review_selections", {}):
                    try:
                        selected, selection = _select_replacement_review(project, step, SimpleNamespace(), data)
                        watch_review_inputs(data, project, step, selected)
                        if data.input_revisions[selected] != selection["stored"]["sha256"]:
                            raise ValueError("Selected review changed during validation")
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
