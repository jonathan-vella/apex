"""'apex-recall show' command — full context dump for one project."""

from __future__ import annotations

import json

from ..indexer import _parse_json_safe, ensure_fresh


def run(args) -> int:
    """Full context dump for one project: decisions, findings, current step, key artifacts."""
    project = args.project
    conn = ensure_fresh()
    try:
        # Get session state
        row = conn.execute(
            "SELECT content FROM artifacts WHERE project = ? AND artifact_type = 'session-state'",
            (project,),
        ).fetchone()

        session = {}
        if row:
            data = _parse_json_safe(row[0])
            if data and isinstance(data, dict):
                session = {
                    "current_step": data.get("current_step", 0),
                    "iac_tool": data.get("iac_tool", ""),
                    "region": data.get("region", ""),
                    "updated": data.get("updated", ""),
                    "decisions": data.get("decisions", {}),
                    "open_findings": data.get("open_findings", []),
                    "decision_log": data.get("decision_log", []),
                }

        # Get all artifacts for this project
        artifacts = conn.execute(
            """SELECT file_path, artifact_type, step, modified_time
               FROM artifacts WHERE project = ?
               ORDER BY step, file_path""",
            (project,),
        ).fetchall()

        artifact_list = [
            {"file": a[0], "type": a[1], "step": a[2], "modified": a[3]}
            for a in artifacts
        ]

        result = {
            "project": project,
            "session": session,
            "artifacts": artifact_list,
            "artifact_count": len(artifact_list),
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
