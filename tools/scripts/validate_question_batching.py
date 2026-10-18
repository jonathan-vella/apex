#!/usr/bin/env python3
"""Validate native question batching and any supplied JSON form examples.

Examples are optional; field names and section titles are role-specific.
Exit codes: 0 on pass, 1 on invalid or missing question contracts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_AGENT = REPO_ROOT / ".github" / "agents" / "02-requirements.agent.md"

FIELD_TYPES = {"string", "number", "integer", "boolean", "array", "object"}
FORM_FIELDS = {"type", "title", "description", "enum", "items"}


def _validate_example(example: object) -> None:
    if not isinstance(example, dict):
        raise ValueError("form must be an object")
    if "questions" in example:
        raise ValueError("retired questions array; use requestedSchema.properties")
    message = example.get("message")
    schema = example.get("requestedSchema")
    if not isinstance(message, str) or not message.strip() or not isinstance(schema, dict):
        raise ValueError("message and requestedSchema are required")
    if set(schema) != {"properties"}:
        raise ValueError("native requestedSchema supports only properties; validate additional constraints separately")
    properties = schema.get("properties")
    if not isinstance(properties, dict) or not properties:
        raise ValueError("requestedSchema.properties must contain questions")
    for name, field in properties.items():
        if not isinstance(field, dict) or field.get("type") not in FIELD_TYPES:
            raise ValueError(f"question {name!r} requires a supported JSON Schema type")
        unsupported = set(field) - FORM_FIELDS
        if unsupported:
            raise ValueError(f"question {name!r} has unsupported native form fields: {', '.join(sorted(unsupported))}")
        if not isinstance(field.get("title"), str) or not field["title"].strip():
            raise ValueError(f"question {name!r} requires a title")
        if field["type"] == "array" and not isinstance(field.get("items"), dict):
            raise ValueError(f"array question {name!r} requires items")
        if isinstance(field.get("items"), dict) and set(field["items"]) - {"type", "enum"}:
            raise ValueError(f"array question {name!r} items supports only type and enum")


def validate(agent_path: Path) -> list[str]:
    failures: list[str] = []
    try:
        body = agent_path.read_text()
    except OSError as exc:
        return [f"unable to read {agent_path}: {exc}"]

    for fragment in ("ask_user", "message"):
        if fragment not in body:
            failures.append(f"{agent_path}: missing native question field {fragment!r}")
    if not re.search(r"\bbatch(?:ing)?\b[\s\S]{0,100}\bindependent\b", body, re.IGNORECASE):
        failures.append(f"{agent_path}: missing independent-question batching rule")
    if re.search(r"\baskQuestions\b|questions\[\]", body):
        failures.append(f"{agent_path}: retired question tool or questions[] form")

    valid_example = False
    for match in re.finditer(r"```json[ \t]*\n(.*?)\n```", body, re.DOTALL):
        source = match.group(1)
        if not any(field in source for field in ("requestedSchema", '"message"', '"questions"')):
            continue
        try:
            _validate_example(json.loads(source))
        except (json.JSONDecodeError, ValueError) as exc:
            failures.append(f"{agent_path}: invalid ask_user example: {exc}")
        else:
            valid_example = True
    if "requestedSchema.properties" not in body and not valid_example:
        failures.append(f"{agent_path}: missing native question field 'requestedSchema.properties'")

    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "agent",
        nargs="?",
        type=Path,
        default=DEFAULT_AGENT,
        help="Path to 02-requirements.agent.md (default: workspace canonical path)",
    )
    args = parser.parse_args(argv)

    failures = validate(args.agent)
    if failures:
        print("✗ question-batching contract check FAILED", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: batch independent native ask_user fields using message and requestedSchema.properties; "
            "any JSON example must contain nonempty typed, titled questions.",
            file=sys.stderr,
        )
        return 1

    print(f"✓ question-batching contract present in {args.agent.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
