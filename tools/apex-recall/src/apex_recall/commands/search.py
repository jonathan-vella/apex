"""'apex-recall search' command — FTS5 full-text search across indexed content."""

from __future__ import annotations

import json
import time

from ..indexer import ensure_fresh


def run(args) -> int:
    """Full-text search across all indexed content."""
    term = args.term
    conn = ensure_fresh()
    try:
        # Build FTS5 query — escape double quotes in user input
        safe_term = term.replace('"', '""')

        query_parts = ['SELECT a.project, a.file_path, a.artifact_type, a.step, a.modified_time,']
        query_parts.append('  snippet(artifacts_fts, 4, ">>", "<<", "...", 40) AS snip')
        query_parts.append('FROM artifacts_fts f')
        query_parts.append('JOIN artifacts a ON a.id = f.rowid')
        query_parts.append('WHERE artifacts_fts MATCH ?')

        params: list = [f'"{safe_term}"']

        if args.project:
            query_parts.append('AND a.project = ?')
            params.append(args.project)

        if args.days:
            cutoff = time.time() - (args.days * 86400)
            query_parts.append('AND a.modified_time >= ?')
            params.append(cutoff)

        query_parts.append('ORDER BY rank LIMIT 20')
        query = '\n'.join(query_parts)

        rows = conn.execute(query, params).fetchall()

        results = [
            {
                "project": r[0],
                "file": r[1],
                "type": r[2],
                "step": r[3],
                "modified": r[4],
                "snippet": r[5],
            }
            for r in rows
        ]

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            if not results:
                print(f"No results for '{term}'.")
                return 0
            for r in results:
                print(f"  {r['project']:20s}  {r['type']:20s}  {r['file']}")
                if r["snippet"]:
                    print(f"    {r['snippet']}")

        return 0
    finally:
        conn.close()
