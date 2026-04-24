#!/usr/bin/env python3
# ruff: noqa: E501
"""Cached governance renderer — offline artifact generation.

Reads an existing governance-constraints-v1 JSON envelope (e.g. from the
scheduled baseline workflow) and writes project-local governance artifacts
without calling Azure. This is the mandatory cached-mode render path.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

# Import shared renderer (no Azure dependencies)
from render_governance import emit_preview_md, extract_arch_resources


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="render_cached_governance",
        description="Render governance artifacts from a cached baseline envelope.",
    )
    parser.add_argument("--in", dest="input", required=True, help="Path to governance-constraints-v1 JSON envelope.")
    parser.add_argument("--out", required=True, help="Path to project-local 04-governance-constraints.json.")
    parser.add_argument("--arch", default=None, help="Path to 02-architecture-assessment.md for policy→resource mapping.")
    args = parser.parse_args(argv)

    in_path = Path(args.input)
    out_path = Path(args.out)

    if not in_path.exists():
        status = {"status": "FAILED", "error": "input-missing", "detail": f"{in_path} not found"}
        sys.stdout.write(json.dumps(status, separators=(",", ":")) + "\n")
        return 2

    try:
        envelope = json.loads(in_path.read_text())
    except (json.JSONDecodeError, OSError) as e:
        status = {"status": "FAILED", "error": "input-parse", "detail": str(e)}
        sys.stdout.write(json.dumps(status, separators=(",", ":")) + "\n")
        return 2

    if not isinstance(envelope, dict) or envelope.get("schema_version") != "governance-constraints-v1":
        status = {"status": "FAILED", "error": "schema-mismatch", "detail": "Not a governance-constraints-v1 envelope"}
        sys.stdout.write(json.dumps(status, separators=(",", ":")) + "\n")
        return 2

    # Normalize null property paths to "" (schema requires string, not null)
    for finding in envelope.get("findings", []):
        if finding.get("azurePropertyPath") is None:
            finding["azurePropertyPath"] = ""
        if finding.get("bicepPropertyPath") is None:
            finding["bicepPropertyPath"] = ""
    # policies is an alias of findings — update if it's a separate list reference
    for finding in envelope.get("policies", []):
        if finding.get("azurePropertyPath") is None:
            finding["azurePropertyPath"] = ""
        if finding.get("bicepPropertyPath") is None:
            finding["bicepPropertyPath"] = ""

    # Inject project name from output path if missing (baseline data has no project field)
    if not envelope.get("project"):
        parts = out_path.parts
        for i, p in enumerate(parts):
            if p == "agent-output" and i + 1 < len(parts):
                envelope["project"] = parts[i + 1]
                break

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(envelope, indent=2, sort_keys=False) + "\n")

    arch_resources = extract_arch_resources(args.arch) if args.arch else None
    preview_path = emit_preview_md(envelope, out_path, arch_resources=arch_resources)

    summary = envelope.get("discovery_summary") or {}
    status = {
        "status": envelope.get("discovery_status", "COMPLETE"),
        "cache_hit": True,
        "cached_baseline": True,
        "assignment_total": summary.get("assignment_total", 0),
        "blockers": summary.get("blocker_count", 0),
        "auto_remediate": summary.get("auto_remediate_count", 0),
        "exempted": summary.get("exempted_count", 0),
        "out_path": str(out_path),
    }
    sys.stdout.write(json.dumps(status, separators=(",", ":")) + "\n")

    if preview_path:
        print(f"preview: wrote {preview_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
