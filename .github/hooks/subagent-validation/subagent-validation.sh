#!/usr/bin/env bash
# subagent-validation.sh
# SubagentStop hook: validates subagent output quality (advisory only).
# Receives JSON input via stdin; outputs JSON to stdout.
# Docs: https://code.visualstudio.com/docs/copilot/customization/hooks
#
# All parsing and decision logic runs in a single python3 process. python3 also
# builds the response with json.dumps so subagent names cannot break out of the
# JSON string (injection safety).
set -euo pipefail

python3 /dev/fd/3 3<<'PY' || echo '{"continue": true}'
import json
import re
import sys


def emit_continue():
    print('{"continue": true}')


def warn(msg):
    print(json.dumps({"continue": True, "systemMessage": msg}))


try:
    data = json.load(sys.stdin)
    if not isinstance(data, dict):
        raise ValueError("not an object")
except (json.JSONDecodeError, ValueError):
    emit_continue()
    sys.exit(0)

name = data.get("subagentName", "") or ""
output = data.get("output", "") or ""
length = len(output)
lower = name.lower()

# Challenger subagents must emit a structured findings array (checked before the
# generic length heuristic).
if "challenger" in lower:
    try:
        parsed = json.loads(output)
        findings = parsed.get("findings", []) if isinstance(parsed, dict) else []
        if isinstance(findings, list) and len(findings) >= 1:
            emit_continue()
        else:
            warn(
                f"Warning: challenger subagent '{name}' output has no findings "
                "array or it is empty. Verify review quality."
            )
    except (json.JSONDecodeError, ValueError):
        warn(
            f"Warning: challenger subagent '{name}' output is not valid JSON. "
            "Expected structured findings."
        )
    sys.exit(0)

# Validate-subagents (e.g. bicep-validate-subagent, terraform-validate-subagent)
# must surface a recognizable verdict so the orchestrator can gate on it. Scope
# to the "-validate-subagent" suffix so unrelated names that merely contain
# "validate" are not warned.
if lower.endswith("-validate-subagent"):
    verdict = re.search(r"\b(APPROVED|NEEDS_REVISION|FAILED|PASS|FAIL)\b", output)
    if verdict:
        emit_continue()
    else:
        warn(
            f"Warning: validate subagent '{name}' output has no recognizable "
            "verdict (expected one of APPROVED / NEEDS_REVISION / FAILED / "
            "PASS / FAIL). Verify the validation contract."
        )
    sys.exit(0)

# Codegen/lint subagents should produce non-empty output.
if ("codegen" in lower or "lint" in lower) and length == 0:
    warn(f"Warning: subagent '{name}' produced empty output. Check for errors.")
    sys.exit(0)

# Generic: warn on suspiciously short (but non-empty) output.
if 0 < length < 100:
    warn(
        f"Warning: subagent '{name}' produced short output ({length} chars). "
        "Verify output quality."
    )
    sys.exit(0)

emit_continue()
PY
