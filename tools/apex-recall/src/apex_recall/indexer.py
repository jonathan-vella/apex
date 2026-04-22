"""Indexer: walks agent-output/, parses artifacts, writes to SQLite + FTS5."""

from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path

from .config import get_agent_output_dir, get_db_path

# ── Schema ──────────────────────────────────────────────────────────────────

CREATE_ARTIFACTS_TABLE = """
CREATE TABLE IF NOT EXISTS artifacts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project     TEXT NOT NULL,
    step        TEXT NOT NULL DEFAULT '',
    file_path   TEXT NOT NULL UNIQUE,
    artifact_type TEXT NOT NULL DEFAULT '',
    modified_time REAL NOT NULL,
    content     TEXT NOT NULL DEFAULT ''
);
"""

CREATE_FTS_TABLE = """
CREATE VIRTUAL TABLE IF NOT EXISTS artifacts_fts USING fts5(
    project,
    step,
    file_path,
    artifact_type,
    content,
    content=artifacts,
    content_rowid=id
);
"""

CREATE_FTS_TRIGGERS = """
CREATE TRIGGER IF NOT EXISTS artifacts_ai AFTER INSERT ON artifacts BEGIN
    INSERT INTO artifacts_fts(rowid, project, step, file_path, artifact_type, content)
    VALUES (new.id, new.project, new.step, new.file_path, new.artifact_type, new.content);
END;

CREATE TRIGGER IF NOT EXISTS artifacts_ad AFTER DELETE ON artifacts BEGIN
    INSERT INTO artifacts_fts(artifacts_fts, rowid, project, step, file_path, artifact_type, content)
    VALUES ('delete', old.id, old.project, old.step, old.file_path, old.artifact_type, old.content);
END;

CREATE TRIGGER IF NOT EXISTS artifacts_au AFTER UPDATE ON artifacts BEGIN
    INSERT INTO artifacts_fts(artifacts_fts, rowid, project, step, file_path, artifact_type, content)
    VALUES ('delete', old.id, old.project, old.step, old.file_path, old.artifact_type, old.content);
    INSERT INTO artifacts_fts(rowid, project, step, file_path, artifact_type, content)
    VALUES (new.id, new.project, new.step, new.file_path, new.artifact_type, new.content);
END;
"""

CREATE_META_TABLE = """
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""

# ── Artifact type classification ────────────────────────────────────────────

# Map filename patterns to artifact types
_ARTIFACT_PATTERNS: list[tuple[str, str]] = [
    (r"00-session-state\.json$", "session-state"),
    (r"00-handoff\.md$", "handoff"),
    (r"01-requirements\.md$", "requirements"),
    (r"02-architecture.*\.md$", "architecture"),
    (r"03-des-.*\.md$", "design"),
    (r"04-governance-constraints\.json$", "governance-json"),
    (r"04-governance-constraints\.md$", "governance"),
    (r"04-implementation-plan\.md$", "implementation-plan"),
    (r"04-dependency-diagram", "diagram"),
    (r"04-runtime-diagram", "diagram"),
    (r"06-deployment-summary\.md$", "deployment-summary"),
    (r"07-.*\.md$", "as-built"),
    (r"09-lessons-learned\.json$", "lessons-json"),
    (r"09-lessons-learned\.md$", "lessons"),
]


def classify_artifact(filename: str) -> str:
    """Classify an artifact file by its name pattern."""
    for pattern, artifact_type in _ARTIFACT_PATTERNS:
        if re.search(pattern, filename):
            return artifact_type
    if filename.endswith(".json"):
        return "json"
    if filename.endswith(".md"):
        return "markdown"
    return "other"


def extract_step(filename: str) -> str:
    """Extract step number from artifact filename (e.g. '01' from '01-requirements.md')."""
    match = re.match(r"^(\d{2})-", filename)
    return match.group(1) if match else ""


# ── Parsing helpers ─────────────────────────────────────────────────────────


def _read_text_safe(path: Path, max_bytes: int = 512_000) -> str:
    """Read file as text, truncating large files, returning empty on error."""
    try:
        size = path.stat().st_size
        if size > max_bytes:
            with open(path, encoding="utf-8", errors="replace") as f:
                return f.read(max_bytes)
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _parse_json_safe(text: str) -> dict | list | None:
    """Parse JSON text, returning None on failure."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None


# ── Core indexer ────────────────────────────────────────────────────────────


def init_db(db_path: Path) -> sqlite3.Connection:
    """Create or open the SQLite database and ensure schema exists."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(CREATE_ARTIFACTS_TABLE)
    conn.executescript(CREATE_FTS_TABLE)
    conn.executescript(CREATE_FTS_TRIGGERS)
    conn.executescript(CREATE_META_TABLE)
    return conn


def _walk_agent_output(agent_output_dir: Path) -> list[tuple[str, Path]]:
    """Walk agent-output/ and yield (project, file_path) pairs."""
    results = []
    if not agent_output_dir.is_dir():
        return results

    for project_dir in sorted(agent_output_dir.iterdir()):
        if not project_dir.is_dir() or project_dir.name.startswith("."):
            continue
        project = project_dir.name
        for root, _dirs, files in os.walk(project_dir):
            for fname in sorted(files):
                fpath = Path(root) / fname
                if fname.startswith("."):
                    continue
                if fpath.suffix in (".md", ".json"):
                    results.append((project, fpath))
    return results


def reindex(
    workspace_root: Path | None = None,
    db_path: Path | None = None,
    agent_output_dir: Path | None = None,
) -> int:
    """Full reindex of agent-output/ into the SQLite database.

    Returns the number of artifacts indexed.
    """
    if db_path is None:
        db_path = get_db_path(workspace_root)
    if agent_output_dir is None:
        agent_output_dir = get_agent_output_dir(workspace_root)

    conn = init_db(db_path)
    try:
        # Clear existing data
        conn.execute("DELETE FROM artifacts")

        count = 0
        for project, fpath in _walk_agent_output(agent_output_dir):
            filename = fpath.name
            artifact_type = classify_artifact(filename)
            step = extract_step(filename)
            content = _read_text_safe(fpath)
            mtime = fpath.stat().st_mtime

            # Use repo-relative path
            try:
                rel_path = str(fpath.relative_to(agent_output_dir.parent))
            except ValueError:
                rel_path = str(fpath)

            conn.execute(
                """INSERT OR REPLACE INTO artifacts
                   (project, step, file_path, artifact_type, modified_time, content)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (project, step, rel_path, artifact_type, mtime, content),
            )
            count += 1

        # Record index time
        import time

        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
            ("last_indexed", str(time.time())),
        )
        conn.commit()
        return count
    finally:
        conn.close()


def ensure_fresh(
    workspace_root: Path | None = None,
    db_path: Path | None = None,
    agent_output_dir: Path | None = None,
) -> sqlite3.Connection:
    """Return a connection to a fresh-enough index, reindexing if stale."""
    if db_path is None:
        db_path = get_db_path(workspace_root)
    if agent_output_dir is None:
        agent_output_dir = get_agent_output_dir(workspace_root)

    needs_reindex = False

    if not db_path.exists():
        needs_reindex = True
    else:
        conn = init_db(db_path)
        row = conn.execute("SELECT value FROM meta WHERE key='last_indexed'").fetchone()
        if row is None:
            needs_reindex = True
            conn.close()
        else:
            last_indexed = float(row[0])
            # Check if any file in agent-output/ is newer than the index
            for _project, fpath in _walk_agent_output(agent_output_dir):
                if fpath.stat().st_mtime > last_indexed:
                    needs_reindex = True
                    conn.close()
                    break
            else:
                return conn

    if needs_reindex:
        reindex(workspace_root, db_path, agent_output_dir)

    return init_db(db_path)
