"""Shared atomic write, schema migration, and recovery logic for session state."""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

from .config import find_workspace_root, get_agent_output_dir

# Canonical step keys matching the v3.0 template
VALID_STEP_KEYS = {"1", "2", "3", "3_5", "4", "5", "6", "7"}

# Map step keys to the numeric current_step value (schema: integer 0-7)
_STEP_KEY_TO_INT: dict[str, int] = {
    "1": 1, "2": 2, "3": 3, "3_5": 3,
    "4": 4, "5": 5, "6": 6, "7": 7,
}


def step_to_int(step: str) -> int:
    """Convert a step key to the integer current_step value (0-7)."""
    return _STEP_KEY_TO_INT.get(step, 0)

# v3.0 template for a fresh session-state file
_STEP_TEMPLATE = {
    "1": {"name": "Requirements", "agent": "02-Requirements", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "2": {"name": "Architecture", "agent": "03-Architect", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "3": {"name": "Design", "agent": "04-Design", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "3_5": {"name": "Governance", "agent": "04g-Governance", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "4": {"name": "IaC Plan", "agent": "", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "5": {"name": "IaC Code", "agent": "", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "6": {"name": "Deploy", "agent": "", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
    "7": {"name": "As-Built", "agent": "08-As-Built", "status": "pending", "sub_step": None, "started": None, "completed": None, "artifacts": [], "context_files_used": []},
}

# Only generate review_audit entries for steps the validator expects
_REVIEW_AUDIT_KEYS = ["1", "2", "3_5", "4", "5", "6"]
_REVIEW_AUDIT_TEMPLATE = {
    f"step_{k}": {"complexity": "", "passes_planned": 0, "passes_executed": 0, "skipped": [], "skip_reasons": [], "models_used": []}
    for k in _REVIEW_AUDIT_KEYS
}


def make_template(project: str) -> dict:
    """Return a fresh v3.0 session-state document."""
    import copy
    return {
        "schema_version": "3.0",
        "project": project,
        "iac_tool": "",
        "region": "swedencentral",
        "branch": "main",
        "updated": "",
        "current_step": 0,
        "decisions": {
            "region": "swedencentral",
            "compliance": "",
            "budget": "",
            "architecture_pattern": "",
            "deployment_strategy": "",
            "complexity": "",
        },
        "open_findings": [],
        "decision_log": [],
        "review_audit": copy.deepcopy(_REVIEW_AUDIT_TEMPLATE),
        "steps": copy.deepcopy(_STEP_TEMPLATE),
    }


def validate_step_key(step: str) -> str:
    """Validate and normalise a step key. Raises ValueError if invalid."""
    s = str(step).strip()
    if s not in VALID_STEP_KEYS:
        raise ValueError(f"Invalid step key '{s}'. Valid keys: {sorted(VALID_STEP_KEYS)}")
    return s


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Atomic file operations ──────────────────────────────────────────────────


def session_state_path(project: str, workspace_root: Path | None = None) -> Path:
    """Return the path to a project's 00-session-state.json."""
    root = workspace_root or find_workspace_root()
    return get_agent_output_dir(root) / project / "00-session-state.json"


def read_state(path: Path) -> dict:
    """Read and parse session state, recovering from .bak if corrupt."""
    bak = path.with_suffix(".json.bak")
    for candidate in [path, bak]:
        if candidate.exists():
            try:
                text = candidate.read_text(encoding="utf-8")
                data = json.loads(text)
                if isinstance(data, dict):
                    # If we recovered from backup, restore the primary
                    # without overwriting the good backup
                    if candidate == bak:
                        _restore_primary(path, data)
                    return data
            except (json.JSONDecodeError, OSError):
                continue
    raise FileNotFoundError(f"No valid session state at {path} (or .bak)")


def _restore_primary(path: Path, data: dict) -> None:
    """Restore the primary file from recovered data without overwriting .bak."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    content = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    tmp.write_text(content, encoding="utf-8")
    tmp.replace(path)


def atomic_write(path: Path, data: dict) -> None:
    """Write JSON atomically: .tmp → rename → .bak."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    bak = path.with_suffix(".json.bak")

    content = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    tmp.write_text(content, encoding="utf-8")

    # Keep backup of the existing file
    if path.exists():
        shutil.copy2(str(path), str(bak))

    # Atomic rename
    tmp.replace(path)


def write_state(project: str, data: dict, workspace_root: Path | None = None) -> Path:
    """Write session state atomically and update the index for that file."""
    data["updated"] = _iso_now()
    path = session_state_path(project, workspace_root)
    atomic_write(path, data)
    _reindex_file(path, project, workspace_root)
    return path


def _reindex_file(path: Path, project: str, workspace_root: Path | None = None) -> None:
    """Update the SQLite index for a single file after a write."""
    from .config import get_db_path
    from .indexer import _read_text_safe, classify_artifact, extract_step, init_db

    root = workspace_root or find_workspace_root()
    db_path = get_db_path(root)
    if not db_path.exists():
        return  # No index yet; will be built on next read command

    conn = init_db(db_path)
    try:
        agent_output_dir = get_agent_output_dir(root)
        try:
            rel_path = str(path.relative_to(agent_output_dir.parent))
        except ValueError:
            rel_path = str(path)

        filename = path.name
        artifact_type = classify_artifact(filename)
        step = extract_step(filename)
        content = _read_text_safe(path)
        mtime = path.stat().st_mtime

        conn.execute(
            """INSERT OR REPLACE INTO artifacts
               (project, step, file_path, artifact_type, modified_time, content)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project, step, rel_path, artifact_type, mtime, content),
        )
        conn.execute(
            "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)",
            ("last_indexed", str(time.time())),
        )
        conn.commit()
    finally:
        conn.close()


# ── Schema migration ────────────────────────────────────────────────────────


def migrate_to_v3(data: dict) -> dict:
    """Auto-migrate v1.0/v2.0 session state to v3.0 in-place."""
    version = str(data.get("schema_version", "1.0"))
    try:
        version_num = float(version)
    except (ValueError, TypeError):
        version_num = 1.0
    if version_num >= 3.0:
        return data

    import copy

    # Ensure top-level fields exist
    data.setdefault("schema_version", "3.0")
    data["schema_version"] = "3.0"
    data.setdefault("decision_log", [])
    data.setdefault("review_audit", copy.deepcopy(_REVIEW_AUDIT_TEMPLATE))
    data.setdefault("open_findings", [])
    data.setdefault("decisions", {})
    data.setdefault("steps", copy.deepcopy(_STEP_TEMPLATE))

    # Ensure all 8 step keys exist
    for key, tmpl in _STEP_TEMPLATE.items():
        if key not in data["steps"]:
            data["steps"][key] = copy.deepcopy(tmpl)

    return data
