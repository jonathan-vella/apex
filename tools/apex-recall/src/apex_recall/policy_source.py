"""Explicit Corp assumptions and privately captured policy-read scope."""

from __future__ import annotations

import gzip
import json
import os
import re
import stat
import subprocess
import uuid
from pathlib import Path

from .practical import digest, material_inputs, record_input
from .state_writer import (
    IndexCommitError,
    file_revision,
    read_state,
    session_state_path,
    workspace_root_for,
    write_state,
)

CONTRACT = "corp-policy-v1"
BASELINE = ".github/data/alz-corp-policy-baseline.json.gz"


def assumed_baseline(data: dict) -> Path:
    """Validate the owner's acceptance against the exact shared baseline bytes."""
    record = material_inputs(data).get("policy_source")
    if not record or not isinstance(record["value"], dict) or record["value"].get("kind") != "assumed-corp":
        raise ValueError("Explicit acceptance of Corp policy assumptions is required")
    path = workspace_root_for() / BASELINE
    if path.is_symlink() or not path.is_file() or file_revision(path) != record["value"].get("sha256"):
        raise ValueError("Accepted Corp baseline is missing or changed; obtain a current source decision")
    baseline = json.loads(gzip.decompress(path.read_bytes()))
    entries = baseline.get("subscriptions", {})
    if (
        baseline.get("baseline_kind") != "alz-corp-default"
        or baseline.get("coverage_status") != "COMPLETE"
        or len(entries) != 1
        or any(
            entry.get("source") != "alz-corp-default"
            or entry.get("provenance", {}).get("verified_against_tenant") is not False
            or entry.get("discovery_status") != "COMPLETE"
            or entry.get("discovery_options") != {"include_defender_auto": True}
            for entry in entries.values()
        )
    ):
        raise ValueError("Shared Corp evidence must be complete, full-coverage and explicitly tenant-unverified")
    return path


def private_root(workspace_root: Path | None = None) -> Path:
    """Namespace the owner-local store by workspace without exposing Azure identifiers."""
    home = Path(os.environ.get("XDG_STATE_HOME", str(Path.home() / ".local/state")))
    if not home.is_absolute():
        raise ValueError("XDG_STATE_HOME must be absolute for private policy storage")
    workspace = workspace_root_for(workspace_root)
    root = home / "apex/policy" / digest(str(workspace))
    if root.resolve().is_relative_to(workspace):
        raise ValueError("Private policy storage must be outside the repository")
    return root


def scope_directory(reference: str, workspace_root: Path | None = None) -> Path:
    if not isinstance(reference, str) or not re.fullmatch(r"[a-f0-9]{32}", reference):
        raise ValueError("Invalid private policy scope reference")
    directory = private_root(workspace_root) / reference
    if directory.resolve() != directory.absolute():
        raise ValueError("Private policy storage cannot traverse symlinks")
    return directory


def _read_private(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError("Private policy scope requires an owner-only regular file")
    return json.loads(path.read_text(encoding="utf-8"))


def private_scope(project: str, data: dict, workspace_root: Path | None = None) -> tuple[dict, Path]:
    record = material_inputs(data).get("azure_read_scope")
    value = record["value"] if record else {}
    directory = scope_directory(value.get("scope_ref"), workspace_root)
    path = directory / "scope.json"
    scope = _read_private(path)
    if (
        scope.get("project") != project
        or scope.get("workspace") != digest(str(workspace_root_for(workspace_root)))
        or digest(scope) != value.get("scope_sha256")
        or scope.get("policy_read_scope") != "subscription-and-inherited"
        or scope.get("authorized") is not True
        or scope.get("request_id") != record["request_id"]
        or scope.get("owner") != record["owner"]
        or scope.get("environments") != record["environments"]
    ):
        raise ValueError("Private policy scope is missing, changed or differently authorized")
    data.input_revisions[path] = file_revision(path)
    return scope, directory


def private_evidence_path(directory: Path, candidate: Path) -> Path:
    target = candidate.resolve()
    if candidate.is_symlink() or not target.is_relative_to(directory.resolve()) or not target.is_file():
        raise ValueError("Policy evidence must remain inside its authorized private scope")
    if stat.S_IMODE(target.stat().st_mode) & 0o077:
        raise ValueError("Private policy evidence requires owner-only file permissions")
    if not re.fullmatch(
        r"(?:04-(?:policy-feasibility|governance-constraints)|subscription-[1-9][0-9]*)\.json", target.name
    ):
        raise ValueError("Private policy snapshot filenames must use non-identifying canonical names")
    return target


def resolve_private_reference(
    reference: str, workspace_root: Path | None = None, *, project: str | None = None, data: dict | None = None
) -> Path:
    match = re.fullmatch(
        r"apex-private-policy://([A-Za-z0-9_.-]{1,100})/([a-f0-9]{32})/"
        r"((?:04-(?:governance-constraints|policy-feasibility)|subscription-[1-9][0-9]*)\.json)",
        reference,
    )
    if not match or match[1] in (".", "..") or project is not None and match[1] != project:
        raise ValueError("Invalid or differently scoped private policy reference")
    root = workspace_root_for(workspace_root)
    state = data if data is not None else read_state(session_state_path(match[1], root))
    if material_inputs(state).get("azure_read_scope", {}).get("value", {}).get("scope_ref") != match[2]:
        raise ValueError("Private policy reference does not match the current authorized scope")
    _, directory = private_scope(match[1], state, root)
    return private_evidence_path(directory, directory / match[3])


def _write_private(path: Path, value: dict) -> None:
    with open(path, "x", encoding="utf-8", opener=lambda name, flags: os.open(name, flags, 0o600)) as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")


def run(args) -> int:
    project = args.project
    data = read_state(session_state_path(project))
    if data.get("decisions", {}).get("workflow_mode") == "assessment":
        raise ValueError("Delivery policy-source capture is unavailable in standalone assessment mode")
    if args.show_private_scope or args.verify_tenant:
        if args.assumed_corp or args.tenant or args.subscription or args.authorize_policy_read:
            raise ValueError("Scope inspection cannot capture a new source or authorization")
        scope, directory = private_scope(project, data)
        if args.verify_tenant:
            result = subprocess.run(
                ["az", "account", "show", "--query", "tenantId", "--output", "tsv"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode or result.stdout.strip().lower() != scope["tenant_id"]:
                raise ValueError(
                    "Active Azure tenant does not match the authorized private scope; do not switch credentials"
                )
            print(json.dumps({"tenant_matches": True, "permission_granted": False}))
            return 0
        print(json.dumps({"scope_file": str(directory / "scope.json"), "directory": str(directory)}))
        return 0
    if args.assumed_corp and (args.tenant or args.subscription or args.authorize_policy_read):
        raise ValueError("Choose Corp assumptions or a separately authorized tenant scope, not both")
    provenance = {
        "environments": args.environment,
        "owner": args.owner,
        "request_id": args.request_id,
    }
    if not all(provenance.values()):
        raise ValueError("Actual owner, request provenance and environments are required")
    data.setdefault("decisions", {})["policy_evidence_contract"] = CONTRACT
    if args.assumed_corp:
        baseline = workspace_root_for() / BASELINE
        record_input(
            data,
            {
                "input_id": "policy_source",
                "value": {"kind": "assumed-corp", "sha256": file_revision(baseline)},
                **provenance,
            },
        )
        data.input_revisions[baseline] = file_revision(assumed_baseline(data))
        write_state(project, data)
        print(json.dumps({"outcome": "recorded", "policy_source": "assumed-corp", "permission_granted": False}))
        return 0
    identifiers = [args.tenant, *(args.subscription or [])]
    if (
        not args.authorize_policy_read
        or len(identifiers) < 2
        or any(
            not isinstance(value, str)
            or not re.fullmatch(r"[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}", value)
            for value in identifiers
        )
        or len({value.lower() for value in identifiers[1:]}) != len(identifiers[1:])
    ):
        raise ValueError("Explicit policy-read authorization and valid tenant/unique subscription IDs are required")
    scope = {
        "project": project,
        "workspace": digest(str(workspace_root_for())),
        "tenant_id": args.tenant.lower(),
        "subscription_ids": [value.lower() for value in args.subscription],
        "policy_read_scope": "subscription-and-inherited",
        "authorized": True,
        **provenance,
    }
    reference = uuid.uuid4().hex
    directory = scope_directory(reference)
    record_input(
        data,
        {
            "input_id": "azure_read_scope",
            "value": {
                "scope_ref": reference,
                "scope_sha256": digest(scope),
                "policy_read_scope": "subscription-and-inherited",
            },
            **provenance,
        },
    )
    record_input(data, {"input_id": "policy_source", "value": {"kind": "tenant"}, **provenance})
    directory.mkdir(parents=True, mode=0o700)
    directory.chmod(0o700)
    _write_private(directory / "scope.json", scope)
    evidence_path = directory / "04-policy-feasibility.json"
    _write_private(
        evidence_path,
        {
            "subscriptions": [
                {"subscription_id": subscription, "path": f"subscription-{index}.json"}
                for index, subscription in enumerate(scope["subscription_ids"], start=1)
            ]
        },
    )
    try:
        write_state(project, data)
    except IndexCommitError:
        raise
    except OSError, ValueError:
        # An index-publication failure may follow a successful state commit.
        if (
            read_state(session_state_path(project))
            .get("decisions", {})
            .get("material_inputs", {})
            .get("azure_read_scope", {})
            .get("value", {})
            .get("scope_ref")
            != reference
        ):
            evidence_path.unlink()
            (directory / "scope.json").unlink()
            directory.rmdir()
        raise
    print(
        json.dumps(
            {
                "outcome": "recorded",
                "scope_ref": reference,
                "scope_file": str(directory / "scope.json"),
                "directory": str(directory),
                "evidence_path": str(evidence_path),
                "permission_granted": False,
            }
        )
    )
    return 0
