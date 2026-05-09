#!/usr/bin/env python3
"""
One-shot revert: strip `    kind: <value>` lines from every agent's
handoffs[] block. Reason: VS Code Copilot's frontmatter schema only
permits label/agent/prompt/send/showContinueOn/model on handoff
entries. The `kind:` taxonomy was added in error and triggers a
schema-validation warning in the editor.

Validators that previously relied on `kind:` (B1b) are removed in a
companion edit. B4 track parity continues to work structurally without
the kind field.

Idempotent: re-running is safe — the regex only matches the literal
`    kind:` indentation pattern inside the handoffs YAML block.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AGENTS_DIR = REPO / ".github/agents"


def strip_kind_lines(text: str) -> tuple[str, int]:
    """Remove every `    kind: <value>` line that appears inside the
    frontmatter (between the opening `---` and the closing `---`).

    Returns (new_text, lines_removed).
    """
    fm_match = re.match(r"^---\n(.*?)\n---\n?", text, re.DOTALL)
    if not fm_match:
        return text, 0
    fm_block = fm_match.group(0)
    body = text[fm_match.end():]
    # Strip lines that are exactly `    kind: <value>` (4-space indent
    # places them inside a handoff entry under handoffs:).
    new_fm, n = re.subn(r"^    kind:[^\n]*\n", "", fm_block, flags=re.MULTILINE)
    return new_fm + body, n


def main() -> None:
    files = sorted(AGENTS_DIR.glob("*.agent.md"))
    total = 0
    for f in files:
        text = f.read_text()
        new_text, n = strip_kind_lines(text)
        if n > 0:
            f.write_text(new_text)
            print(f"  {f.relative_to(REPO)}: stripped {n} kind: line(s)")
            total += n
    print(f"\nTotal kind: lines stripped: {total}")


if __name__ == "__main__":
    main()
