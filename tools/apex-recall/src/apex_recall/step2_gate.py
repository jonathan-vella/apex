"""Step 2 completion hygiene: refuse to close Step 2 while scratch or failed cost files remain."""

from __future__ import annotations

import json

from .state_writer import project_dir

_COST_PATTERNS = ("02-cost-estimate*.json", "02-cost-candidates*.json", "03-des-cost-estimate*.json")


def step2_residue(project: str) -> list[str]:
    """List leftover files in the project folder (top level and ``contracts/``; ``_meta/`` is the archive)."""
    directory = project_dir(project)
    found = [f"{path.name}: scratch file" for path in sorted(directory.glob("*.tmp.md")) if path.is_file()]
    seen: set[str] = set()
    search_dirs = [directory, directory / "contracts"]
    for sdir in search_dirs:
        if not sdir.is_dir():
            continue
        for pattern in _COST_PATTERNS:
            for path in sorted(sdir.glob(pattern)):
                rel_key = str(path.relative_to(directory))
                if rel_key in seen or not path.is_file():
                    continue
                seen.add(rel_key)
                try:
                    document = json.loads(path.read_text(encoding="utf-8"))
                except OSError, UnicodeError, json.JSONDecodeError:
                    continue
                if isinstance(document, dict) and document.get("status") == "FAILED":
                    found.append(f"{path.name}: cost estimate with status FAILED")
    return found


def residue_remediation(project: str) -> str:
    return (
        f"Move superseded or failed cost files to agent-output/{project}/_meta/ and delete scratch *.tmp.md "
        "files, then re-run the command. This check cannot be bypassed with --allow-missing-challenger."
    )


def report_residue(project: str, residue: list[str], as_json: bool) -> int:
    remediation = residue_remediation(project)
    if as_json:
        print(
            json.dumps(
                {
                    "project": project,
                    "step": "2",
                    "error": "step2_residue",
                    "files": residue,
                    "remediation": remediation,
                }
            )
        )
    else:
        listing = "\n".join(f"  {item}" for item in residue)
        print(f"Refusing to complete step 2: leftover files in the project folder.\n{listing}\n  -> {remediation}")
    return 2
