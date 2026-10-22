#!/usr/bin/env python3
"""Validate native question batching and JSON form payloads.

With --form, preflight a pending ask_user payload before displaying it.
Otherwise check an agent's batching contract and optional JSON examples.
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

FIELD_TYPES = {"string", "number", "integer", "boolean", "array"}
FORM_FIELDS = {"type", "title", "description", "enum", "enumNames", "oneOf", "items", "default"}


def _choices(value: object, name: str) -> None:
    if not isinstance(value, list) or not value or not all(isinstance(item, str) for item in value):
        raise ValueError(f"question {name!r} requires nonempty string choices")


def _labeled_choices(value: object, name: str) -> None:
    if not isinstance(value, list) or not value:
        raise ValueError(f"question {name!r} requires labeled choices")
    for item in value:
        if (
            not isinstance(item, dict)
            or set(item) != {"const", "title"}
            or not isinstance(item["const"], str)
            or not isinstance(item["title"], str)
            or not item["title"].strip()
        ):
            raise ValueError(f"question {name!r} requires string const/title choices")


def _validate_example(example: object, *, check_companions: bool = True) -> None:
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
    titles: dict[str, str] = {}
    for name, field in properties.items():
        if not isinstance(field, dict) or field.get("type") not in FIELD_TYPES:
            raise ValueError(f"question {name!r} requires a supported JSON Schema type")
        unsupported = set(field) - FORM_FIELDS
        if unsupported:
            raise ValueError(f"question {name!r} has unsupported native form fields: {', '.join(sorted(unsupported))}")
        if not isinstance(field.get("title"), str) or not field["title"].strip():
            raise ValueError(f"question {name!r} requires a title")
        title = " ".join(field["title"].casefold().split())
        if title in titles:
            raise ValueError(
                f"duplicate question title for {titles[title]!r} and {name!r}; use finding-specific titles"
            )
        titles[title] = name
        if field["type"] == "array" and not isinstance(field.get("items"), dict):
            raise ValueError(f"array question {name!r} requires items")
        if field["type"] == "array":
            items = field["items"]
            if set(items) - {"type", "enum", "anyOf"} or items.get("type") != "string":
                raise ValueError(f"array question {name!r} items supports string enum or anyOf")
            if ("enum" in items) == ("anyOf" in items):
                raise ValueError(f"array question {name!r} requires exactly one choice format")
            if "enum" in items:
                _choices(items["enum"], name)
            else:
                _labeled_choices(items["anyOf"], name)
        elif "items" in field:
            raise ValueError(f"question {name!r} items is only supported for arrays")
        if "enum" in field:
            if field["type"] != "string" or "oneOf" in field:
                raise ValueError(f"question {name!r} requires one string choice format")
            _choices(field["enum"], name)
        if "enumNames" in field and (
            "enum" not in field
            or not isinstance(field["enumNames"], list)
            or len(field["enumNames"]) != len(field["enum"])
            or not all(isinstance(label, str) for label in field["enumNames"])
        ):
            raise ValueError(f"question {name!r} enumNames must match its enum choices")
        if "oneOf" in field:
            if field["type"] != "string":
                raise ValueError(f"question {name!r} oneOf is only supported for strings")
            _labeled_choices(field["oneOf"], name)
    for name in properties:
        base = re.sub(r"[_-](?:notes?|guidance|clarification)$", "", name)
        if check_companions and base != name and base in properties:
            raise ValueError(
                f"question {name!r} is a redundant companion to {base!r}; "
                "capture custom guidance in the original field and ask only triggered follow-ups separately"
            )


def _supplied(value: object) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    return value is not None and value != "" and value != [] and value != {}


def validate_payload(form: object, context: object = None, *, require_context: bool = False) -> list[str]:
    """Check native shape and explicit applicability without filesystem access."""
    try:
        if isinstance(form, dict) and set(form) != {"message", "requestedSchema"}:
            raise ValueError("native ask_user payload supports only message and requestedSchema")
        _validate_example(form, check_companions=context is None)
        if context is None:
            if require_context:
                raise ValueError("applicability context is required before display or delegated return")
            return []
        if not isinstance(context, dict) or set(context) != {"answers", "fields"}:
            raise ValueError("context requires only answers and fields")
        answers, fields = context["answers"], context["fields"]
        if not isinstance(answers, dict) or not isinstance(fields, dict):
            raise ValueError("context answers and fields must be objects")
        properties = form["requestedSchema"]["properties"]
        if set(fields) != set(properties):
            raise ValueError("context must map every displayed field exactly once")
        seen = set()
        for name, metadata in fields.items():
            if not isinstance(metadata, dict) or set(metadata) - {"input_id", "kind", "when"}:
                raise ValueError(f"question {name!r} requires explicit input_id, kind and optional when")
            input_id, kind = metadata.get("input_id"), metadata.get("kind")
            if (
                not isinstance(input_id, str)
                or not input_id.strip()
                or kind
                not in (
                    "input",
                    "follow_up",
                    "approval",
                    "disposition",
                )
            ):
                raise ValueError(f"question {name!r} has missing or ambiguous applicability context")
            if input_id in seen:
                raise ValueError(f"question {name!r} duplicates material input {input_id!r}")
            seen.add(input_id)
            if _supplied(answers.get(input_id)):
                raise ValueError(f"question {name!r} is already answered; reuse the captured answer")
            if kind in ("approval", "disposition") and "default" in properties[name]:
                raise ValueError(f"question {name!r} cannot preselect approval or disposition")
            trigger = metadata.get("when")
            if kind == "follow_up" and trigger is None:
                raise ValueError(f"question {name!r} requires a captured follow-up trigger")
            if trigger is not None:
                if not isinstance(trigger, dict) or set(trigger) != {"input_id", "equals"}:
                    raise ValueError(f"question {name!r} requires an explicit input_id/equals trigger")
                parent = trigger["input_id"]
                if not isinstance(parent, str) or parent == input_id or parent not in answers:
                    raise ValueError(f"question {name!r} has no captured prerequisite answer")
                actual, expected = answers[parent], trigger["equals"]
                if not _supplied(expected) or type(actual) is not type(expected) or actual != expected:
                    raise ValueError(f"question {name!r} follow-up condition was not triggered")
    except (TypeError, ValueError) as exc:
        return [str(exc)]
    return []


def validate_form(form_path: Path, context_path: Path | None = None, *, require_context: bool = False) -> list[str]:
    try:
        form = json.loads(form_path.read_text(encoding="utf-8"))
        context = json.loads(context_path.read_text(encoding="utf-8")) if context_path is not None else None
        return [
            f"{form_path}: invalid ask_user form: {failure}"
            for failure in validate_payload(form, context, require_context=require_context)
        ]
    except (OSError, UnicodeError, ValueError) as exc:
        return [f"{form_path}: invalid ask_user form: {exc}"]
    return []


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
        help="Path to 02-requirements.agent.md (default: workspace canonical path)",
    )
    parser.add_argument("--form", type=Path, help="Validate a pending native ask_user JSON payload instead of an agent")
    parser.add_argument("--context", type=Path, help="Separate captured answers and per-field applicability metadata")
    parser.add_argument(
        "--require-context", action="store_true", help="Require applicability evidence for production forms"
    )
    args = parser.parse_args(argv)
    if args.form is not None and args.agent is not None:
        parser.error("--form cannot be combined with an agent path")
    if (args.context is not None or args.require_context) and args.form is None:
        parser.error("--context and --require-context require --form")

    target = args.form if args.form is not None else args.agent or DEFAULT_AGENT
    failures = (
        validate_form(target, args.context, require_context=args.require_context)
        if args.form is not None
        else validate(target)
    )
    if failures:
        print("✗ question-batching contract check FAILED", file=sys.stderr)
        for msg in failures:
            print(f"  - {msg}", file=sys.stderr)
        print(
            "\nFix: batch independent native ask_user fields using message and requestedSchema.properties; "
            "use nonempty typed questions with distinct titles and no unconditional companion note fields.",
            file=sys.stderr,
        )
        return 1

    if args.form is not None:
        scope = (
            "shape and explicit applicability" if args.context is not None else "shape only; applicability not checked"
        )
        print(f"✓ native form valid in {target.name} ({scope})")
    else:
        print(f"✓ question-batching contract present in {target.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
