"""Canonical dual-path resolution for agent-output/{project}/ (layout_version 2 + legacy root fallback)."""

from __future__ import annotations

from pathlib import Path

from . import config

LAYOUT_SUBDIRS = ("assets", "contracts", "reviews", "_meta")


def workspace_root_for(workspace_root: Path | None = None) -> Path:
    """Return the resolved workspace root directory."""
    return (workspace_root or config.find_workspace_root()).resolve()


def project_dir(project: str, workspace_root: Path | None = None) -> Path:
    """Return the path to ``agent-output/{project}/``."""
    root = workspace_root or config.find_workspace_root()
    return config.get_agent_output_dir(root) / project


def is_layout_v2(
    project_or_dir: str | Path,
    data: dict | None = None,
    workspace_root: Path | None = None,
) -> bool:
    """Return True when the project uses the structured subfolder layout (v2)."""
    if isinstance(data, dict) and data.get("layout_version") == 2:
        return True
    pdir = project_or_dir if isinstance(project_or_dir, Path) else project_dir(project_or_dir, workspace_root)
    if (pdir / "_meta" / "00-session-state.json").exists():
        return True
    return bool((pdir / "contracts").is_dir() or (pdir / "reviews").is_dir())


def ensure_layout_v2_dirs(pdir: Path) -> None:
    """Create the canonical v2 subfolder hierarchy under ``agent-output/{project}/``."""
    for sub in LAYOUT_SUBDIRS:
        (pdir / sub).mkdir(parents=True, exist_ok=True)
    for meta_sub in ("inputs", "pricing", "previews", "scratch"):
        (pdir / "_meta" / meta_sub).mkdir(parents=True, exist_ok=True)


def resolve_session_state_path(project: str, workspace_root: Path | None = None) -> Path:
    """Return the path to a project's ``00-session-state.json`` (checking ``_meta/`` first, then root)."""
    pdir = project_dir(project, workspace_root)
    v2 = pdir / "_meta" / "00-session-state.json"
    v1 = pdir / "00-session-state.json"
    if v2.exists():
        return v2
    if v1.exists():
        return v1
    if is_layout_v2(pdir):
        return v2
    return v1


def _resolve_in_subdir(
    project_or_dir: str | Path,
    subdir: str,
    filename: str,
    workspace_root: Path | None = None,
) -> Path:
    pdir = project_or_dir if isinstance(project_or_dir, Path) else project_dir(project_or_dir, workspace_root)
    name = Path(filename).name
    v2 = pdir / subdir / name
    v1 = pdir / name
    if v2.exists():
        return v2
    if v1.exists():
        return v1
    return v2 if is_layout_v2(pdir) else v1


def resolve_contract_path(
    project_or_dir: str | Path,
    filename: str,
    workspace_root: Path | None = None,
) -> Path:
    """Resolve a canonical contract JSON in ``contracts/`` with root fallback."""
    return _resolve_in_subdir(project_or_dir, "contracts", filename, workspace_root)


def resolve_review_path(
    project_or_dir: str | Path,
    filename: str,
    workspace_root: Path | None = None,
) -> Path:
    """Resolve a challenger findings or decision JSON in ``reviews/`` with root fallback."""
    return _resolve_in_subdir(project_or_dir, "reviews", filename, workspace_root)


def resolve_asset_path(
    project_or_dir: str | Path,
    filename: str,
    workspace_root: Path | None = None,
) -> Path:
    """Resolve a diagram/chart asset in ``assets/`` with root fallback."""
    return _resolve_in_subdir(project_or_dir, "assets", filename, workspace_root)


def resolve_meta_path(
    project_or_dir: str | Path,
    filename: str,
    workspace_root: Path | None = None,
) -> Path:
    """Resolve a metadata/assessment/scratch file in ``_meta/`` with root fallback."""
    return _resolve_in_subdir(project_or_dir, "_meta", filename, workspace_root)


def resolve_project_file(
    project_or_dir: str | Path,
    rel_or_name: str,
    workspace_root: Path | None = None,
) -> Path:
    """Resolve any project-local path across root and v2 subfolders."""
    pdir = project_or_dir if isinstance(project_or_dir, Path) else project_dir(project_or_dir, workspace_root)
    rel = str(rel_or_name)
    parts = Path(rel).parts
    if len(parts) >= 3 and parts[0] == "agent-output":
        rel = str(Path(*parts[2:]))
    direct = pdir / rel
    if direct.exists():
        return direct
    for prefix in (
        pdir / "_meta" / "inputs" / rel,
        pdir / "_meta" / rel,
        pdir / "_meta" / "scratch" / rel,
        pdir / "_meta" / "pricing" / rel,
        pdir / "_meta" / "previews" / rel,
    ):
        if prefix.exists():
            return prefix
    name = Path(rel).name
    for sub in (
        "contracts",
        "reviews",
        "_meta",
        "assets",
        "_meta/pricing",
        "_meta/previews",
        "_meta/scratch",
        "_meta/inputs",
    ):
        candidate = pdir / sub / name
        if candidate.exists():
            return candidate
    root_candidate = pdir / name
    if root_candidate.exists():
        return root_candidate
    return direct
