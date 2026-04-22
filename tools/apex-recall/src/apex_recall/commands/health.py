"""'apex-recall health' command — health dashboard for the index."""

from __future__ import annotations

import json

from ..config import get_agent_output_dir, get_db_path
from ..indexer import _walk_agent_output, init_db


def run(args) -> int:
    """Health dashboard: DB freshness, schema integrity, corpus size, project coverage."""
    db_path = get_db_path()
    agent_output_dir = get_agent_output_dir()

    report: dict = {
        "db_exists": False,
        "db_size_bytes": 0,
        "total_artifacts": 0,
        "total_projects": 0,
        "projects": [],
        "index_mtime": 0.0,
        "agent_output_mtime": 0.0,
        "stale": True,
        "schema_ok": True,
        "error": "",
    }

    # Check agent-output freshness
    ao_mtime = 0.0
    if agent_output_dir.is_dir():
        for _project, fpath in _walk_agent_output(agent_output_dir):
            mtime = fpath.stat().st_mtime
            if mtime > ao_mtime:
                ao_mtime = mtime
    report["agent_output_mtime"] = ao_mtime

    if not db_path.exists():
        report["error"] = "Index database does not exist. Run 'apex-recall reindex'."
        _output(report, args)
        return 1

    report["db_exists"] = True
    report["db_size_bytes"] = db_path.stat().st_size

    try:
        conn = init_db(db_path)
    except Exception as e:
        report["error"] = f"Failed to open database: {e}"
        report["schema_ok"] = False
        _output(report, args)
        return 1

    try:
        # Schema check
        tables = {
            r[0]
            for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        expected = {"artifacts", "artifacts_fts", "meta"}
        if not expected.issubset(tables):
            report["schema_ok"] = False
            report["error"] = f"Missing tables: {expected - tables}"
            _output(report, args)
            return 1

        # Counts
        report["total_artifacts"] = conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0]
        projects_rows = conn.execute("SELECT DISTINCT project FROM artifacts ORDER BY project").fetchall()
        report["total_projects"] = len(projects_rows)
        report["projects"] = [r[0] for r in projects_rows]

        # Freshness
        row = conn.execute("SELECT value FROM meta WHERE key='last_indexed'").fetchone()
        if row:
            report["index_mtime"] = float(row[0])
            report["stale"] = ao_mtime > float(row[0])
        else:
            report["stale"] = True

    except Exception as e:
        report["error"] = f"Query error: {e}"
        _output(report, args)
        return 1
    finally:
        conn.close()

    _output(report, args)
    return 0


def _output(report: dict, args) -> None:
    if getattr(args, "json", False):
        print(json.dumps(report, indent=2))
    else:
        status = "OK" if report["db_exists"] and report["schema_ok"] and not report["stale"] else "WARN"
        print(f"  Status:      {status}")
        print(f"  DB exists:   {report['db_exists']}")
        print(f"  DB size:     {report['db_size_bytes']} bytes")
        print(f"  Artifacts:   {report['total_artifacts']}")
        print(f"  Projects:    {report['total_projects']}")
        print(f"  Stale:       {report['stale']}")
        if report["error"]:
            print(f"  Error:       {report['error']}")
        if report["projects"]:
            print(f"  Coverage:    {', '.join(report['projects'])}")
