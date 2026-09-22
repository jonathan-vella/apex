"""Shared atomic write, schema migration, and recovery logic for session state."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import time
from contextlib import contextmanager
from datetime import UTC
from pathlib import Path

from .config import find_workspace_root, get_agent_output_dir

# Canonical step keys matching the v3.0 template
VALID_STEP_KEYS = {"1", "2", "3", "3_5", "4", "5", "6", "7"}

# Map step keys to the numeric current_step value (schema: integer 0-7)
_STEP_KEY_TO_INT: dict[str, int] = {
    "1": 1,
    "2": 2,
    "3": 3,
    "3_5": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
}


def step_to_int(step: str) -> int:
    """Convert a step key to the integer current_step value (0-7)."""
    return _STEP_KEY_TO_INT.get(step, 0)


# v3.0 template for a fresh session-state file
_STEP_TEMPLATE = {
    "1": {
        "name": "Requirements",
        "agent": "02-Requirements",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "2": {
        "name": "Architecture",
        "agent": "03-Architect",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "3": {
        "name": "Design",
        "agent": "04-Design",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "3_5": {
        "name": "Governance",
        "agent": "04g-Governance",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "4": {
        "name": "IaC Plan",
        "agent": "",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "5": {
        "name": "IaC Code",
        "agent": "",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "6": {
        "name": "Deploy",
        "agent": "",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
    "7": {
        "name": "As-Built",
        "agent": "08-As-Built",
        "status": "pending",
        "sub_step": None,
        "started": None,
        "completed": None,
        "artifacts": [],
        "context_files_used": [],
    },
}

# Only generate review_audit entries for steps the validator expects
_REVIEW_AUDIT_KEYS = ["1", "2", "3_5", "4", "5", "6"]
_REVIEW_AUDIT_TEMPLATE = {
    f"step_{k}": {
        "complexity": "",
        "passes_planned": 0,
        "passes_executed": 0,
        "skipped": [],
        "skip_reasons": [],
        "models_used": [],
    }
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
    from datetime import datetime

    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Atomic file operations ──────────────────────────────────────────────────


def session_state_path(project: str, workspace_root: Path | None = None) -> Path:
    """Return the path to a project's 00-session-state.json."""
    root = workspace_root or find_workspace_root()
    return get_agent_output_dir(root) / project / "00-session-state.json"


class StateConflict(ValueError):
    """The state or validated inputs changed before commit."""


class IndexCommitError(RuntimeError):
    def __init__(self, path: Path, cause: Exception):
        self.revision = file_revision(path)
        super().__init__(f"Primary state committed, but index update failed: {cause}")


def file_revision(path: Path) -> str | None:
    if path.is_symlink():
        raise ValueError(f"Symlink cannot be a revision input: {path}")
    if not path.exists():
        return None
    if path.is_dir():
        entries = []
        ignored = {".git", ".terraform", "node_modules", ".venv", "__pycache__"}

        def visit(directory: Path):
            for child in sorted(directory.iterdir()):
                if child.name in ignored:
                    continue
                if child.is_symlink():
                    raise ValueError(f"Symlink cannot be a revision input: {child}")
                if child.is_dir():
                    visit(child)
                elif child.is_file():
                    entries.append([child.relative_to(path).as_posix(), file_revision(child)])
                else:
                    raise ValueError(f"Unsupported revision input: {child}")

        visit(path)
        return hashlib.sha256(json.dumps(entries, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return hashlib.sha256(path.read_bytes()).hexdigest()


class StateDocument(dict):
    def __init__(self, data: dict, path: Path, revision: str):
        super().__init__(data)
        self.path = path.resolve()
        self.revision = revision
        self.input_revisions: dict[Path, str | None] = {}


def validate_state(data: dict) -> None:
    if not isinstance(data, dict) or not isinstance(data.get("project"), str) or not data["project"]:
        raise ValueError("State recovery required: missing project identity")
    if str(data.get("schema_version", "1.0")) not in ("1.0", "2.0", "3.0", "session-state-v3"):
        raise ValueError("Unsupported state schema; owner migration required")
    if (
        not isinstance(data.get("steps", {}), dict)
        or type(data.get("current_step")) is not int
        or not 0 <= data["current_step"] <= 7
    ):
        raise ValueError("State recovery required: invalid steps/current_step")
    if any(step not in VALID_STEP_KEYS or not isinstance(value, dict) for step, value in data.get("steps", {}).items()):
        raise ValueError("State recovery required: invalid step entry")
    attempts = data.get("review_attempts", [])
    if not isinstance(attempts, list) or any(
        not isinstance(attempt, dict)
        or attempt.get("schema_version") != "review-attempt-v1"
        or not all(
            key in attempt for key in ("id", "step", "kind", "input_digest", "outcome", "retry_of", "recorded_at")
        )
        for attempt in attempts
    ):
        raise ValueError("Invalid review attempt history")
    selections = data.get("review_selections", {})
    if not isinstance(selections, dict):
        raise ValueError("Invalid review selection map; owner migration required")
    for step, record in selections.items():
        if step not in ("3_5", "4") or not isinstance(record, dict):
            raise ValueError("Invalid review selection record")
        expected_focus = "comprehensive" if step == "4" else "governance-reconciliation"
        if (
            record.get("schema_version") != "review-selection-v1"
            or record.get("review_focus") != expected_focus
            or record.get("input_coverage") != "primary-and-review-guidance"
            or type(record.get("pass_number")) is not int
            or record["pass_number"] < 2
            or not isinstance(record.get("path"), str)
            or not record["path"]
            or not isinstance(record.get("selected_at"), str)
            or not record["selected_at"]
            or not isinstance(record.get("sha256"), str)
            or len(record["sha256"]) != 64
        ):
            raise ValueError("Unsupported or malformed review-selection-v1 record")


def read_state(path: Path) -> StateDocument:
    """Read primary state without recovery or index mutation."""
    content = path.read_bytes()
    try:
        data = json.loads(content)
        validate_state(data)
    except (ValueError, UnicodeError) as error:
        raise ValueError(f"State recovery required for {path}; primary and backup were not changed") from error
    return StateDocument(data, path, hashlib.sha256(content).hexdigest())


def check_state_revision(data: StateDocument, path: Path) -> None:
    if data.path != path.resolve() or file_revision(path) != data.revision:
        raise StateConflict("State conflict: primary revision changed; reload before retrying")
    for input_path, revision in data.input_revisions.items():
        if file_revision(input_path) != revision:
            raise StateConflict(f"Input conflict: validated bytes changed at {input_path}")


@contextmanager
def project_write_lock(path: Path):
    lock_path = path.with_suffix(".json.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as handle:
        try:
            if os.name == "nt":
                import msvcrt

                if handle.tell() == 0:
                    handle.write(b"0")
                    handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            raise StateConflict("State conflict: another writer holds the project lock") from error
        try:
            yield
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def atomic_write(path: Path, data: dict, *, backup: bool = True) -> None:
    """Write JSON atomically: .tmp → rename → .bak."""
    path.parent.mkdir(parents=True, exist_ok=True)
    bak = path.with_suffix(".json.bak")

    content = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=".recall-", delete=False
    ) as handle:
        tmp = Path(handle.name)
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    try:
        if backup and path.exists():
            shutil.copy2(str(path), str(bak))
        tmp.replace(path)
    finally:
        tmp.unlink(missing_ok=True)


def write_state(project: str, data: dict, workspace_root: Path | None = None) -> Path:
    """Write session state atomically and update the index for that file."""
    path = session_state_path(project, workspace_root)
    with project_write_lock(path):
        if isinstance(data, StateDocument):
            check_state_revision(data, path)
        elif path.exists():
            raise StateConflict("State conflict: existing state requires a revision-aware read before writing")
        data["updated"] = _iso_now()
        validate_state(data)
        atomic_write(path, data)
        if isinstance(data, StateDocument):
            data.revision = file_revision(path)
        try:
            _reindex_file(path, project, workspace_root)
        except Exception as error:
            raise IndexCommitError(path, error) from error
    return path


def recover_state(project: str, reason: str) -> dict:
    path = session_state_path(project)
    with project_write_lock(path):
        try:
            read_state(path)
        except ValueError, FileNotFoundError:
            pass
        else:
            raise ValueError("Healthy primary state cannot be replaced by backup recovery")
        backup = path.with_suffix(".json.bak")
        data = read_state(backup)
        if "steps" not in data or not isinstance(data.get("decisions", {}), dict):
            raise ValueError("Backup recovery requires explicit valid steps and decisions structures")
        if data.get("project") != project:
            raise ValueError("Backup belongs to another project")
        damaged_path = None
        if path.exists():
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".damaged-state-", delete=False) as handle:
                damaged_path = Path(handle.name)
                handle.write(path.read_bytes())
        now = _iso_now()
        data.setdefault("decision_log", []).append(
            {
                "decision": "Explicit backup recovery",
                "rationale": reason,
                "timestamp": now,
                "backup_sha256": file_revision(backup),
            }
        )
        data["updated"] = now
        atomic_write(path, data, backup=False)
        try:
            _reindex_file(path, project)
        except Exception as error:
            raise IndexCommitError(path, error) from error
        return {
            "outcome": "recovered",
            "revision": file_revision(path),
            "preserved_damaged_path": str(damaged_path) if damaged_path else None,
        }


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
    except ValueError, TypeError:
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
