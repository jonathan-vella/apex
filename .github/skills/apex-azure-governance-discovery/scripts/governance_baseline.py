#!/usr/bin/env python3
"""Load and query governance baselines stored as JSON or gzip-compressed JSON."""

from __future__ import annotations

import argparse
import gzip
import json
import sys
from pathlib import Path
from typing import Any


def load_governance_json(path: str | Path) -> dict[str, Any]:
    """Load a governance JSON object, auto-detecting gzip by suffix or magic bytes."""
    baseline_path = Path(path)
    raw = baseline_path.read_bytes()
    if baseline_path.suffix == ".gz" or raw.startswith(b"\x1f\x8b"):
        raw = gzip.decompress(raw)
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("governance baseline root must be an object")
    return parsed


def resolve_path(value: Any, dotted_path: str) -> Any:
    """Resolve a dotted object path such as summary.total_findings."""
    current = value
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise KeyError(dotted_path)
        current = current[part]
    return current


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read a JSON or JSON.gz governance baseline")
    parser.add_argument("baseline", help="Path to governance baseline")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--get", dest="field", help="Print one dotted field")
    group.add_argument("--subscription", help="Print one subscriptions.<id> envelope")
    parser.add_argument("--compact", action="store_true", help="Emit compact JSON")
    args = parser.parse_args(argv)

    try:
        baseline = load_governance_json(args.baseline)
        if args.field:
            value = resolve_path(baseline, args.field)
        elif args.subscription:
            value = baseline["subscriptions"][args.subscription]
        else:
            value = baseline
    except (OSError, gzip.BadGzipFile, UnicodeDecodeError, json.JSONDecodeError, KeyError, ValueError) as exc:
        print(f"governance baseline error: {exc}", file=sys.stderr)
        return 2

    if isinstance(value, (dict, list)):
        separators = (",", ":") if args.compact else None
        print(json.dumps(value, indent=None if args.compact else 2, separators=separators))
    elif value is None:
        print("null")
    else:
        print(value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
