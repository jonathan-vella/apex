"""Configuration constants for apex-recall."""

from __future__ import annotations

# Workspace root: resolved relative to repo structure (tools/apex-recall/src/apex_recall/config.py)
# At runtime, prefer APEX_ROOT env var or cwd-based detection.
import os
from pathlib import Path

DEFAULT_AGENT_OUTPUT_DIR = "agent-output"
DEFAULT_DB_PATH = "tmp/.apex-recall.db"


def find_workspace_root() -> Path:
    """Walk up from cwd looking for agent-output/ directory."""
    root = Path(os.environ.get("APEX_ROOT", "")).resolve() if os.environ.get("APEX_ROOT") else None
    if root and (root / DEFAULT_AGENT_OUTPUT_DIR).is_dir():
        return root

    cwd = Path.cwd()
    for candidate in [cwd, *cwd.parents]:
        if (candidate / DEFAULT_AGENT_OUTPUT_DIR).is_dir():
            return candidate
    # Fall back to cwd
    return cwd


def get_agent_output_dir(workspace_root: Path | None = None) -> Path:
    root = workspace_root or find_workspace_root()
    return root / DEFAULT_AGENT_OUTPUT_DIR


def get_db_path(workspace_root: Path | None = None) -> Path:
    root = workspace_root or find_workspace_root()
    return root / DEFAULT_DB_PATH
