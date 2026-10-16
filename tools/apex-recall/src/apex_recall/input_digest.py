"""Canonical digest of a review's frozen input paths, so start and finish records agree."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

_IGNORED = {".git", ".terraform", "node_modules", ".venv", "__pycache__"}


def _walk(target: Path):
    if target.is_symlink():
        raise ValueError(f"Review inputs cannot contain symlinks: {target}")
    if target.is_dir():
        for child in sorted(target.iterdir(), key=lambda item: item.name):
            if child.name not in _IGNORED:
                yield from _walk(child)
    elif target.is_file():
        yield target
    else:
        raise ValueError(f"Review input not found: {target}")


def inputs_digest(root: Path, paths: list[str]) -> str:
    """SHA-256 over sorted ``[workspace-relative POSIX path, file SHA-256]`` pairs, compact JSON."""
    root = root.resolve()
    entries: dict[str, str] = {}
    for raw in paths:
        target = (root / raw).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            raise ValueError(f"Review input is outside the workspace: {raw}") from None
        for file in _walk(root / raw):
            relative = file.resolve().relative_to(root).as_posix()
            entries[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
    if not entries:
        raise ValueError("Review inputs contain no files")
    payload = json.dumps(sorted(entries.items()), separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
