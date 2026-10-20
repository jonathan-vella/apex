"""CLI scope and immutability checks for the native Context Optimizer entrypoint."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
PARSER = ROOT / ".github/skills/apex-context-management/scripts/parse-chat-logs.py"


@pytest.fixture
def sessions(tmp_path: Path) -> tuple[Path, Path]:
    repository = tmp_path / "repository"
    repository.mkdir()
    state = tmp_path / "state"
    for name, workspace in (("local", repository), ("foreign", tmp_path / "other")):
        log = state / name / "events.jsonl"
        log.parent.mkdir(parents=True)
        log.write_text(
            json.dumps(
                {
                    "id": "start",
                    "type": "session.start",
                    "timestamp": "2026-10-16T08:00:00Z",
                    "data": {"sessionId": name, "context": {"gitRoot": str(workspace)}},
                }
            )
            + "\n"
        )
    return repository, state


def run_parser(repository: Path, state: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(PARSER), "--repository", str(repository), "--log-dir", str(state), *arguments],
        capture_output=True,
        text=True,
    )


def test_parser_profiles_only_exact_workspace_without_changing_sources(sessions: tuple[Path, Path]) -> None:
    repository, state = sessions
    original = {file: file.read_bytes() for file in state.glob("*/events.jsonl")}
    result = run_parser(repository, state, "--summary-only")
    assert result.returncode == 0, result.stderr
    report = json.loads(result.stdout)
    assert report["sessions_analyzed"] == 1
    assert report["sessions"][0]["log_path"] == str(state / "local/events.jsonl")
    assert report["sessions"][0]["metrics"]["usage_coverage"]["complete"] is False
    assert {file: file.read_bytes() for file in state.glob("*/events.jsonl")} == original


def test_explicit_foreign_log_is_rejected(sessions: tuple[Path, Path]) -> None:
    repository, state = sessions
    result = run_parser(repository, state, "--log", str(state / "foreign/events.jsonl"))
    assert result.returncode == 1
    assert "belonging to this repository" in result.stderr
    assert not result.stdout


def test_missing_workspace_evidence_is_an_error(sessions: tuple[Path, Path], tmp_path: Path) -> None:
    _, state = sessions
    result = run_parser(tmp_path / "unmatched", state)
    assert result.returncode == 1
    assert not result.stdout


def test_parser_output_cannot_overwrite_native_logs(sessions: tuple[Path, Path]) -> None:
    repository, state = sessions
    source = state / "local/events.jsonl"
    original = source.read_bytes()
    result = run_parser(repository, state, "--output", str(source))
    assert result.returncode == 1
    assert "must not overwrite native event logs" in result.stderr
    assert source.read_bytes() == original
