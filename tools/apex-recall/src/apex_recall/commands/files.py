"""'apex-recall files' command — list recently modified artifact files."""

from __future__ import annotations

import json
import time

from ..indexer import ensure_fresh


def run(args) -> int:
    """List recently modified artifact files across projects."""
    conn = ensure_fresh()
    try:
        limit = args.limit or 10
        days = args.days

        query = """
            SELECT project, file_path, artifact_type, step, modified_time
            FROM artifacts
        """
        params: list = []

        if days:
            cutoff = time.time() - (days * 86400)
            query += " WHERE modified_time >= ?"
            params.append(cutoff)

        query += " ORDER BY modified_time DESC LIMIT ?"
        params.append(limit)

        rows = conn.execute(query, params).fetchall()

        results = [
            {
                "project": r[0],
                "file": r[1],
                "type": r[2],
                "step": r[3],
                "modified": r[4],
            }
            for r in rows
        ]

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            if not results:
                print("No artifacts found.")
                return 0
            for r in results:
                print(f"  {r['project']:20s}  {r['type']:20s}  {r['file']}")

        return 0
    finally:
        conn.close()
