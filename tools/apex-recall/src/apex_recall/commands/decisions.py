"""'apex-recall decisions' command — query decision logs across projects."""

from __future__ import annotations

import json

from ..indexer import _parse_json_safe, ensure_fresh


def run(args) -> int:
    """Query decision logs across projects."""
    conn = ensure_fresh()
    try:
        query = """
            SELECT project, content
            FROM artifacts
            WHERE artifact_type = 'session-state'
        """
        params: list = []

        if args.project:
            query += " AND project = ?"
            params.append(args.project)

        query += " ORDER BY modified_time DESC"
        rows = conn.execute(query, params).fetchall()

        all_decisions: list[dict] = []
        for r in rows:
            data = _parse_json_safe(r[1])
            if not data or not isinstance(data, dict):
                continue

            project = r[0]

            # Extract from decisions object
            decisions = data.get("decisions", {})
            if decisions:
                for key, value in decisions.items():
                    if value:  # Skip empty values
                        all_decisions.append({
                            "project": project,
                            "category": key,
                            "decision": value,
                            "source": "decisions",
                        })

            # Extract from decision_log array
            for entry in data.get("decision_log", []):
                all_decisions.append({
                    "project": project,
                    "step": str(entry.get("step", "")),
                    "decision": entry.get("decision", ""),
                    "rationale": entry.get("rationale", ""),
                    "timestamp": entry.get("timestamp", ""),
                    "source": "decision_log",
                })

        if args.json:
            print(json.dumps(all_decisions, indent=2))
        else:
            if not all_decisions:
                print("No decisions found.")
                return 0
            for d in all_decisions:
                src = d.get("source", "")
                if src == "decision_log":
                    print(f"  [{d['project']}] step {d.get('step', '?')}: {d['decision']}")
                    if d.get("rationale"):
                        print(f"    rationale: {d['rationale']}")
                else:
                    print(f"  [{d['project']}] {d['category']}: {d['decision']}")

        return 0
    finally:
        conn.close()
