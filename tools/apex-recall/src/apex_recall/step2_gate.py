"""Step 2 completion hygiene: refuse to close Step 2 while scratch or failed cost files remain."""

from __future__ import annotations

import json

from .state_writer import session_state_path

_COST_PATTERNS = ("02-cost-estimate*.json", "02-cost-candidates*.json", "03-des-cost-estimate*.json")


def step2_residue(project: str) -> list[str]:
    """List leftover files in the project folder (top level only; ``_meta/`` is the archive)."""
    directory = session_state_path(project).parent
    found = [f"{path.name}: scratch file" for path in sorted(directory.glob("*.tmp.md")) if path.is_file()]
    seen: set[str] = set()
    for pattern in _COST_PATTERNS:
        for path in sorted(directory.glob(pattern)):
            if path.name in seen or not path.is_file():
                continue
            seen.add(path.name)
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
