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

python3 /dev/fd/3 3<<'PY'
import json
import re
import sys


def emit_continue():
    print('{"decision": "allow"}')


def warn(msg):
    original = output if isinstance(output, str) else json.dumps(output)
    print(json.dumps({"decision": "allow", "modifiedResponse": original + "\n\n" + msg}))


try:
    data = json.load(sys.stdin)
    if not isinstance(data, dict):
        raise ValueError("not an object")
except (json.JSONDecodeError, ValueError) as exc:
    print(f"Subagent advisory could not inspect input: {exc}; parent validation is still required.", file=sys.stderr)
    emit_continue()
    sys.exit(0)

name = data.get("agentName") or data.get("agentType") or data.get("subagentName") or ""
output = data.get("response", data.get("output", "")) or ""
if not isinstance(name, str) or not isinstance(output, str):
    warn("Warning: malformed subagent name or response. Verify the worker result.")
    sys.exit(0)
length = len(output)
lower = name.lower()

# Readiness and pending-input turns are not completed review receipts.
if re.match(r"^(WORKER_READY(?:_ACK)?|USER_INPUT_REQUIRED)(?:\s|$)", output):
    emit_continue()
    sys.exit(0)

# Challenger workers persist JSON separately and return a compact file receipt.
# This advisory checks its shape only; the review validator owns validity.
if "challenger" in lower:
    if (
        re.search(r"(?m)^CHALLENGE COMPLETE\s*$", output)
        and re.search(r"(?m)^file_path:\s+\S+\.json\s*$", output)
        and re.search(r"(?m)^overall_assessment:\s+(APPROVED|NEEDS_REVISION|BLOCKED)\s*$", output)
    ):
        emit_continue()
        sys.exit(0)
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
            "Expected a CHALLENGE COMPLETE file receipt or structured findings."
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
