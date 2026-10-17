#!/usr/bin/env python3
"""Profile workspace-scoped native Copilot SDK sessions using the shared normalizer."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", type=Path, default=Path.home() / ".copilot/session-state")
    parser.add_argument("--repository", type=Path, default=ROOT)
    parser.add_argument("--log", type=Path, action="append")
    parser.add_argument("--latest", type=int, default=0)
    parser.add_argument("--summary-only", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    if args.latest < 0:
        parser.error("--latest cannot be negative")
    spec = importlib.util.spec_from_file_location("profile_debug_log", ROOT / "tools/scripts/profile_debug_log.py")
    assert spec and spec.loader
    profiler = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(profiler)
    try:
        candidates = profiler.discover_sdk_logs(args.repository, args.log_dir)
        logs = [file.resolve() for file in args.log] if args.log else candidates
        if not logs or any(file not in candidates for file in logs):
            raise ValueError("select existing native sessions belonging to this repository")
        if args.latest:
            logs = logs[-args.latest :]
        sessions = []
        for file in logs:
            metrics = profiler.profile(profiler.load_spans(file))
            if args.summary_only:
                metrics.pop("errors", None)
                metrics.pop("duplicate_reads", None)
            sessions.append({"log_path": str(file), "metrics": metrics})
        output = (
            json.dumps(
                {
                    "generated": datetime.now(UTC).isoformat(),
                    "repository": str(args.repository.resolve()),
                    "sessions_analyzed": len(sessions),
                    "sessions": sessions,
                },
                indent=2,
            )
            + "\n"
        )
        if args.output:
            destination = args.output.resolve()
            if destination.name == "events.jsonl" and destination.is_relative_to(args.log_dir.expanduser().resolve()):
                raise ValueError("analysis output must not overwrite native event logs")
            args.output.write_text(output, encoding="utf-8")
        else:
            print(output, end="")
    except (OSError, ValueError) as exc:
        print(f"Native log analysis failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
