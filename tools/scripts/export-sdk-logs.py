#!/usr/bin/env python3
"""Bundle explicitly selected, workspace-scoped native SDK logs for local review."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import shutil
import sys
import tarfile
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from types import ModuleType
from typing import Any
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
SENSITIVE_KEYS = {
    "password",
    "clientsecret",
    "accesstoken",
    "refreshtoken",
    "apikey",
    "accountkey",
    "authorization",
    "connectionstring",
    "sastoken",
}
SECRET_PATTERNS = (
    (re.compile(r"(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}"), "<redacted-gh-token>"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"), "<redacted-api-key>"),
    (re.compile(r"(?i)(Bearer\s+)[A-Za-z0-9._~+/-]+=*"), r"\1<redacted>"),
    (re.compile(r"(?i)((?:AccountKey|SharedAccessSignature|Password)=)[^;\"\s]+"), r"\1<redacted>"),
    (re.compile(r"(?i)([?&]sig=)[^&\"\s]+"), r"\1<redacted>"),
    (re.compile(r'(?i)("(?:password|client_secret|access_token|api_key)"\s*:\s*")[^"]*(")'), r"\1<redacted>\2"),
)


def profiler_module() -> ModuleType:
    spec = importlib.util.spec_from_file_location("profile_debug_log", Path(__file__).with_name("profile_debug_log.py"))
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: "<redacted>" if key.casefold().replace("_", "").replace("-", "") in SENSITIVE_KEYS else redact(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, str):
        for pattern, replacement in SECRET_PATTERNS:
            value = pattern.sub(replacement, value)
    return value


def export(
    *,
    repository: Path,
    state_root: Path,
    session_ids: list[str],
    include_raw: bool = False,
    include_workspace_logs: bool = False,
    transcript: Path | None = None,
    redacted: bool = True,
) -> Path:
    profiler = profiler_module()
    repository = repository.resolve()
    candidates = {file.parent.name: file for file in profiler.discover_sdk_logs(repository, state_root)}
    if not session_ids or len(session_ids) != len(set(session_ids)):
        raise ValueError("select one or more distinct session IDs explicitly")
    missing = set(session_ids) - candidates.keys()
    if missing:
        raise ValueError(f"unknown or out-of-workspace sessions: {sorted(missing)}")
    selected = [candidates[session_id] for session_id in session_ids]
    sources: list[tuple[Path, str, bool]] = []
    for file in selected:
        profiler.load_spans(file)
        sources.append((file, f"sessions/{file.parent.name}/events.jsonl", False))
        if include_raw:
            sources.append((file, f"raw/{file.parent.name}/events.jsonl", True))
    if transcript is not None:
        if not transcript.is_absolute() or transcript.is_symlink():
            raise ValueError("transcript must be an explicit absolute, non-symlink file")
        resolved = transcript.resolve(strict=True)
        if not any(resolved.is_relative_to(file.parent.resolve()) for file in selected) or not resolved.is_file():
            raise ValueError("transcript must belong to an explicitly selected session")
        sources.append((resolved, f"transcript/{resolved.name}", False))
    if include_workspace_logs:
        workspace_logs = repository / "logs/copilot"
        if not workspace_logs.is_dir() or workspace_logs.is_symlink():
            raise ValueError("approved workspace text-log directory is unavailable or a symlink")
        for file in workspace_logs.rglob("*"):
            if file.is_symlink() or not file.resolve().is_relative_to(workspace_logs.resolve()):
                raise ValueError(f"workspace log symlink or path escape: {file}")
            if file.is_file() and file.suffix in (".json", ".jsonl", ".log", ".txt"):
                sources.append((file, f"workspace-logs/{file.relative_to(workspace_logs).as_posix()}", False))
    output = repository / ".apex-logs"
    if output.is_symlink():
        raise ValueError("output directory cannot be a symlink")
    output.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".staging-", dir=output))
    bundle_id = f"apex-debug-{datetime.now(UTC):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}"
    archive = output / f"{bundle_id}.tar.gz"
    archive_created = False
    try:
        for source, relative, raw in sources:
            destination = stage / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            if raw or not redacted:
                destination.write_bytes(source.read_bytes())
            else:
                text = source.read_text(encoding="utf-8")
                if source.suffix == ".jsonl":
                    text = (
                        "\n".join(json.dumps(redact(json.loads(line))) for line in text.splitlines() if line.strip())
                        + "\n"
                    )
                elif source.suffix == ".json":
                    text = json.dumps(redact(json.loads(text)), indent=2) + "\n"
                else:
                    text = redact(text)
                destination.write_text(text, encoding="utf-8")
        files = [
            {
                "path": file.relative_to(stage).as_posix(),
                "size": file.stat().st_size,
                "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
            }
            for file in sorted(stage.rglob("*"))
            if file.is_file()
        ]
        manifest = {
            "format": "copilot-sdk",
            "session_ids": session_ids,
            "capture": {
                "include_raw": include_raw,
                "include_transcript": transcript is not None,
                "include_workspace_logs": include_workspace_logs,
                "redacted": redacted,
            },
            "safe_to_share": False,
            "redaction": "best effort; inspect all files before sharing",
            "file_count": len(files),
            "total_bytes": sum(file["size"] for file in files),
            "files": files,
        }
        (stage / "MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        with archive.open("xb") as stream:
            archive_created = True
            with tarfile.open(fileobj=stream, mode="w:gz") as bundle:
                bundle.add(stage, arcname=bundle_id)
    except OSError, ValueError, tarfile.TarError:
        if archive_created:
            archive.unlink(missing_ok=True)
        print(f"Export failed; staging retained at {stage}", file=sys.stderr)
        raise
    shutil.rmtree(stage)
    return archive


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", type=Path, default=ROOT)
    parser.add_argument("--state-root", type=Path, default=Path.home() / ".copilot/session-state")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--session", action="append", default=[])
    parser.add_argument("--include-raw", action="store_true")
    parser.add_argument("--include-workspace-logs", action="store_true")
    parser.add_argument("--transcript", type=Path)
    parser.add_argument("--no-redact", action="store_true")
    args = parser.parse_args(argv)
    if args.list and (
        args.session or args.include_raw or args.include_workspace_logs or args.transcript or args.no_redact
    ):
        parser.error("--list cannot combine with export selections/options")
    try:
        if args.list:
            print(
                json.dumps(
                    [
                        {"session_id": file.parent.name, "events_path": str(file)}
                        for file in profiler_module().discover_sdk_logs(args.repository, args.state_root)
                    ],
                    indent=2,
                )
            )
            return 0
        archive = export(
            repository=args.repository,
            state_root=args.state_root,
            session_ids=args.session,
            include_raw=args.include_raw,
            include_workspace_logs=args.include_workspace_logs,
            transcript=args.transcript,
            redacted=not args.no_redact,
        )
    except (OSError, ValueError, tarfile.TarError) as exc:
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1
    print(f"Archive: {archive}\nLocal only. Redaction is best effort; inspect before sharing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
