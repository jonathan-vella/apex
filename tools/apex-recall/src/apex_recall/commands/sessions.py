"""'apex-recall sessions' command — list session states across projects."""

from __future__ import annotations

import json

from ..indexer import _parse_json_safe, ensure_fresh


def run(args) -> int:
    """List session states with status/step/complexity across projects."""
    conn = ensure_fresh()
    try:
        limit = args.limit or 10
        days = getattr(args, "days", None)

        if days is not None:
            import time
            cutoff = time.time() - (days * 86400)
            query = """
                SELECT project, file_path, content, modified_time
                FROM artifacts
                WHERE artifact_type = 'session-state' AND modified_time >= ?
                ORDER BY modified_time DESC
                LIMIT ?
            """
            rows = conn.execute(query, (cutoff, limit)).fetchall()
        else:
            query = """
                SELECT project, file_path, content, modified_time
                FROM artifacts
                WHERE artifact_type = 'session-state'
                ORDER BY modified_time DESC
                LIMIT ?
            """
            rows = conn.execute(query, (limit,)).fetchall()

        results = []
        for r in rows:
            data = _parse_json_safe(r[2])
            if data and isinstance(data, dict):
                decisions = data.get("decisions", {})
                results.append({
                    "project": r[0],
                    "current_step": data.get("current_step", 0),
                    "iac_tool": data.get("iac_tool", ""),
                    "region": data.get("region", ""),
                    "updated": data.get("updated", ""),
                    "complexity": decisions.get("complexity", ""),
                    "file": r[1],
                })

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            if not results:
                print("No sessions found.")
                return 0
            for s in results:
                status = f"step {s['current_step']}"
                tool = s["iac_tool"] or "undecided"
                print(f"  {s['project']:20s}  {status:10s}  {tool:12s}  {s['updated']}")

        return 0
    finally:
        conn.close()
