"""Scoped native exports preserve source logs, user files and explicit capture choices."""

from __future__ import annotations

import importlib.util
import json
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture
def exporter():
    spec = importlib.util.spec_from_file_location("export_sdk_logs", ROOT / "tools/scripts/export-sdk-logs.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def sample(tmp_path):
    repo = tmp_path / "workspace"
    state = tmp_path / "state"
    repo.mkdir()
    for session, workspace in (("selected", repo), ("other", tmp_path / "foreign")):
        directory = state / session
        directory.mkdir(parents=True)
        records = [
            {
                "id": "start",
                "type": "session.start",
                "timestamp": "2026-10-16T00:00:00Z",
                "data": {"sessionId": session, "context": {"gitRoot": str(workspace)}, "password": "synthetic-secret"},
            }
        ]
        (directory / "events.jsonl").write_text("\n".join(json.dumps(record) for record in records) + "\n")
    return repo, state


def archive_files(archive):
    with tarfile.open(archive) as bundle:
        prefix = bundle.getnames()[0] + "/"
        return {
            member.name.removeprefix(prefix): bundle.extractfile(member).read()
            for member in bundle.getmembers()
            if member.isfile()
        }


def test_default_export_is_scoped_redacted_local_and_source_preserving(exporter, sample):
    repo, state = sample
    source = state / "selected/events.jsonl"
    original = source.read_bytes()
    archive = exporter.export(repository=repo, state_root=state, session_ids=["selected"])
    files = archive_files(archive)
    assert set(files) == {"sessions/selected/events.jsonl", "MANIFEST.json"}
    assert source.read_bytes() == original
    assert b"synthetic-secret" not in files["sessions/selected/events.jsonl"]
    manifest = json.loads(files["MANIFEST.json"])
    assert manifest["capture"]["redacted"] is True
    assert manifest["capture"]["include_raw"] is False
    assert manifest["safe_to_share"] is False
    assert manifest["file_count"] == len(manifest["files"]) == 1
    assert manifest["total_bytes"] == sum(file["size"] for file in manifest["files"])
    assert not list((repo / ".apex-logs").glob(".staging-*"))


@pytest.mark.parametrize("selection", [[], ["other"], ["../selected"], ["selected", "selected"]])
def test_selection_is_explicit_distinct_and_workspace_scoped(exporter, sample, selection):
    repo, state = sample
    with pytest.raises(ValueError):
        exporter.export(repository=repo, state_root=state, session_ids=selection)
    assert not (repo / ".apex-logs").exists()


def test_raw_transcript_and_workspace_capture_are_explicit(exporter, sample):
    repo, state = sample
    transcript = state / "selected/transcript.jsonl"
    transcript.write_text('{"password":"synthetic-transcript"}\n')
    workspace = repo / "logs/copilot"
    workspace.mkdir(parents=True)
    (workspace / "workspace.log").write_text("workspace log\n")
    archive = exporter.export(
        repository=repo,
        state_root=state,
        session_ids=["selected"],
        include_raw=True,
        include_workspace_logs=True,
        transcript=transcript,
    )
    files = archive_files(archive)
    assert files["raw/selected/events.jsonl"] == (state / "selected/events.jsonl").read_bytes()
    assert b"synthetic-transcript" not in files["transcript/transcript.jsonl"]
    assert files["workspace-logs/workspace.log"] == b"workspace log\n"


def test_transcript_cannot_escape_selected_session(exporter, sample):
    repo, state = sample
    for transcript in [Path("relative"), state / "other/events.jsonl"]:
        with pytest.raises(ValueError):
            exporter.export(repository=repo, state_root=state, session_ids=["selected"], transcript=transcript)
    linked = state / "selected/link.jsonl"
    linked.symlink_to(state / "other/events.jsonl")
    with pytest.raises(ValueError):
        exporter.export(repository=repo, state_root=state, session_ids=["selected"], transcript=linked)


def test_symlink_output_and_workspace_log_are_rejected(exporter, sample):
    repo, state = sample
    workspace = repo / "logs/copilot"
    workspace.mkdir(parents=True)
    (workspace / "escape.log").symlink_to(state / "other/events.jsonl")
    with pytest.raises(ValueError, match="symlink"):
        exporter.export(repository=repo, state_root=state, session_ids=["selected"], include_workspace_logs=True)
    (repo / ".apex-logs").symlink_to(state)
    with pytest.raises(ValueError, match="symlink"):
        exporter.export(repository=repo, state_root=state, session_ids=["selected"])


def test_archive_failure_is_explicit_and_retains_only_own_staging(exporter, sample, monkeypatch):
    repo, state = sample
    sibling = repo / ".apex-logs/retained"
    sibling.mkdir(parents=True)
    (sibling / "existing").write_text("user data")

    def fail(*_args, **_kwargs):
        raise OSError("synthetic archive failure")

    monkeypatch.setattr(exporter.tarfile, "open", fail)
    with pytest.raises(OSError, match="synthetic archive failure"):
        exporter.export(repository=repo, state_root=state, session_ids=["selected"])
    assert (sibling / "existing").read_text() == "user data"
    assert list((repo / ".apex-logs").glob(".staging-*"))
    assert not list((repo / ".apex-logs").glob("*.tar.gz"))


def test_archive_name_collision_preserves_existing_file(exporter, sample, monkeypatch):
    repo, state = sample
    original = Path.open
    collided = []

    def collision(file, mode="r", *args, **kwargs):
        if mode == "xb":
            with original(file, "wb") as stream:
                stream.write(b"existing export")
            collided.append(file)
            raise FileExistsError("synthetic collision")
        return original(file, mode, *args, **kwargs)

    monkeypatch.setattr(Path, "open", collision)
    with pytest.raises(FileExistsError):
        exporter.export(repository=repo, state_root=state, session_ids=["selected"])
    assert collided[0].read_bytes() == b"existing export"


def test_cli_never_defaults_to_a_session(exporter, sample):
    repo, state = sample
    args = ["--repository", str(repo), "--state-root", str(state)]
    assert exporter.main(args) == 1
    assert exporter.main([*args, "--list"]) == 0
    assert not (repo / ".apex-logs").exists()
