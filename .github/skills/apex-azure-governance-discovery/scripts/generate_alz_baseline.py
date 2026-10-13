#!/usr/bin/env python3
"""Generate the ALZ Corp default governance baseline without calling Azure.

Resolves the `root`, `landing_zones` and `corp` archetypes of the pinned Azure Landing Zones
library to policy assignments, resolves their definitions (custom from the library, built-in from
the public azure-policy repo) and runs them through ``discover.discover`` with an offline REST
adapter, so classification matches a live run exactly.
"""

from __future__ import annotations

import argparse
import gzip
import io
import json
import re
import sys
import tarfile
import tempfile
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import discover as discover_mod

LIBRARY_REF = "platform/alz/2026.10.0"
AZURE_POLICY_REF = "184a951ee59050e19d6e9b5db894383528cb86f3"
LIBRARY_URL = f"https://codeload.github.com/Azure/Azure-Landing-Zones-Library/tar.gz/refs/tags/{LIBRARY_REF}"
AZURE_POLICY_URL = f"https://codeload.github.com/Azure/azure-policy/tar.gz/{AZURE_POLICY_REF}"

BASELINE_KIND = "alz-corp-default"
# Synthetic id: the baseline describes a policy set, not a real subscription.
SYNTHETIC_SUBSCRIPTION_ID = "00000000-0000-0000-0000-00000000a1c0"
DEFAULT_LOCATION = "swedencentral"
DEFAULT_OUT = Path(".github/data/governance-policy-baseline.json.gz")

# Archetypes a subscription under the Corp management group inherits, outermost first.
ARCHETYPES: tuple[tuple[str, str], ...] = (
    ("root", "alz"),
    ("landing_zones", "alz-landingzones"),
    ("corp", "alz-corp"),
)
ROOT_MG = "alz"
MG_PREFIX = "/providers/Microsoft.Management/managementGroups"
PLACEHOLDER_MG = re.compile(r"/providers/Microsoft\.Management/managementGroups/[^/\"]+")


def _fetch(url: str) -> bytes:
    if not url.startswith("https://"):
        raise ValueError(f"refusing non-https source: {url}")
    with urllib.request.urlopen(url, timeout=120) as response:  # noqa: S310 — https constant above
        return response.read()


def _extract(url: str, dest: Path, wanted: tuple[str, ...]) -> Path:
    """Extract only members whose path contains one of ``wanted`` and return the archive root."""
    with tarfile.open(fileobj=io.BytesIO(_fetch(url)), mode="r:gz") as tar:
        members = [m for m in tar.getmembers() if any(w in m.name for w in wanted)]
        tar.extractall(dest, members=members, filter="data")  # noqa: S202 — filter="data" blocks traversal
    roots = [p for p in dest.iterdir() if p.is_dir()]
    if len(roots) != 1:
        raise RuntimeError(f"unexpected archive layout under {dest}")
    return roots[0]


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _localize(value: Any) -> Any:
    """Point every library management group (placeholder, contoso, ...) at the synthetic root."""
    text = json.dumps(value)
    text = PLACEHOLDER_MG.sub(f"{MG_PREFIX}/{ROOT_MG}", text)
    text = text.replace("${current_scope_resource_id}", f"{MG_PREFIX}/{ROOT_MG}")
    text = text.replace("${default_location}", DEFAULT_LOCATION)
    return json.loads(text)


def _name_index(directory: Path) -> dict[str, dict[str, Any]]:
    """Index library definition files by their `name`, keeping the highest file name on duplicates."""
    index: dict[str, tuple[str, dict[str, Any]]] = {}
    for path in sorted(directory.glob("*.json")):
        doc = _read_json(path)
        name = str(doc.get("name", "")).lower()
        if name:
            index[name] = (path.name, doc)
    return {name: doc for name, (_, doc) in index.items()}


def _builtin_index(builtins_dir: Path, kind: str) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for path in (builtins_dir / kind).rglob("*.json"):
        try:
            doc = _read_json(path)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        name = doc.get("name") if isinstance(doc, dict) else None
        if isinstance(name, str) and isinstance(doc.get("properties"), dict):
            index[name.lower()] = doc
    return index


class OfflinePolicyApi:
    """Serves the ARM reads that ``discover.discover`` issues from local library and built-in JSON."""

    def __init__(self, assignments: list[dict[str, Any]], documents: dict[str, dict[str, Any]]) -> None:
        self.assignments = assignments
        self.documents = documents
        self.missing: set[str] = set()

    def __call__(self, url: str) -> dict[str, Any]:
        path = url.removeprefix(discover_mod.ARM).split("?", 1)[0]
        lowered = path.lower()
        if lowered.endswith("/policyassignments"):
            return {"value": self.assignments}
        if lowered.endswith(("/policydefinitions", "/policysetdefinitions", "/policyexemptions")):
            return {"value": []}
        document = self.documents.get(lowered)
        if document is None:
            self.missing.add(path)
            return {}
        return {**document, "id": path}


def build_policy_api(library_root: Path, builtins_dir: Path) -> tuple[OfflinePolicyApi, dict[str, list[str]]]:
    alz = library_root / "platform" / "alz"
    custom_defs = _name_index(alz / "policy_definitions")
    custom_sets = _name_index(alz / "policy_set_definitions")
    builtin_defs = _builtin_index(builtins_dir, "policyDefinitions")
    builtin_sets = _builtin_index(builtins_dir, "policySetDefinitions")
    assignment_files = {
        str(_read_json(p)["name"]): _read_json(p) for p in sorted((alz / "policy_assignments").glob("*.json"))
    }

    documents: dict[str, dict[str, Any]] = {}
    custom_base = f"{MG_PREFIX}/{ROOT_MG}/providers/Microsoft.Authorization".lower()
    for name, doc in custom_defs.items():
        documents[f"{custom_base}/policydefinitions/{name}"] = _localize(doc)
    for name, doc in custom_sets.items():
        documents[f"{custom_base}/policysetdefinitions/{name}"] = _localize(doc)
    for name, doc in builtin_defs.items():
        documents.setdefault(f"/providers/microsoft.authorization/policydefinitions/{name}", doc)
    for name, doc in builtin_sets.items():
        documents.setdefault(f"/providers/microsoft.authorization/policysetdefinitions/{name}", doc)

    assignments: list[dict[str, Any]] = []
    included: dict[str, list[str]] = {}
    for archetype, mg_name in ARCHETYPES:
        archetype_doc = _read_json(alz / "archetype_definitions" / f"{archetype}.alz_archetype_definition.json")
        scope = f"{MG_PREFIX}/{mg_name}"
        included[archetype] = list(archetype_doc["policy_assignments"])
        for name in archetype_doc["policy_assignments"]:
            source = _localize(assignment_files[name])
            props = {**source["properties"], "scope": scope}
            assignments.append(
                {
                    "id": f"{scope}/providers/Microsoft.Authorization/policyAssignments/{name}",
                    "name": name,
                    "properties": props,
                }
            )
    return OfflinePolicyApi(assignments, documents), included


def build_baseline(
    library_root: Path,
    builtins_dir: Path,
    generated_at: str,
    library_ref: str = LIBRARY_REF,
    azure_policy_ref: str = AZURE_POLICY_REF,
) -> dict[str, Any]:
    api, included = build_policy_api(library_root, builtins_dir)
    envelope = discover_mod.discover(
        SYNTHETIC_SUBSCRIPTION_ID, project=BASELINE_KIND, az_rest=api
    )
    if api.missing:
        raise RuntimeError("unresolved policy documents: " + ", ".join(sorted(api.missing)))
    if envelope.get("discovery_status") != "COMPLETE":
        raise RuntimeError(f"discovery incomplete: {envelope.get('discovery_status')}")

    envelope.pop("project", None)
    envelope["source"] = BASELINE_KIND
    envelope["subscription_id"] = SYNTHETIC_SUBSCRIPTION_ID
    envelope["discovered_at"] = generated_at
    metadata = envelope.get("discovery_metadata")
    if isinstance(metadata, dict):
        metadata["discovered_at"] = generated_at
        scope = metadata.get("scope")
        if isinstance(scope, dict):
            scope["subscription_id"] = SYNTHETIC_SUBSCRIPTION_ID
    envelope["provenance"] = {
        "kind": BASELINE_KIND,
        "alz_library_ref": library_ref,
        "azure_policy_ref": azure_policy_ref,
        "archetypes": included,
        "verified_against_tenant": False,
    }

    summary = envelope.get("discovery_summary", {})
    return {
        "schema_version": "governance-baseline-v1",
        "baseline_kind": BASELINE_KIND,
        "alz_library_ref": library_ref,
        "azure_policy_ref": azure_policy_ref,
        "generated_at": generated_at,
        "management_group_id": ARCHETYPES[-1][1],
        "coverage_status": "COMPLETE",
        "subscriptions_discovered": 1,
        "subscriptions_processed": 1,
        "subscriptions_skipped": [],
        "subscriptions_excluded": [],
        "summary": {
            "total_findings": len(envelope.get("findings", [])),
            "total_blockers": summary.get("blocker_count", 0),
            "total_auto_remediate": summary.get("auto_remediate_count", 0),
            "subscriptions_complete": 1,
        },
        "subscriptions": {SYNTHETIC_SUBSCRIPTION_ID: envelope},
    }


def write_gzip_json(path: Path, document: dict[str, Any]) -> None:
    """Write deterministic gzip (fixed mtime, sorted keys) so regeneration only diffs on content."""
    payload = json.dumps(document, indent=2, sort_keys=True, ensure_ascii=False).encode("utf-8") + b"\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, filename="") as gz:
        gz.write(payload)


def _preserve_timestamp(out: Path, document: dict[str, Any]) -> None:
    """Keep the prior generated_at when content is unchanged, to avoid no-op churn."""
    if not out.exists():
        return
    try:
        prior = json.loads(gzip.decompress(out.read_bytes()))
    except (OSError, ValueError):
        return
    prior_time = prior.get("generated_at")
    if not isinstance(prior_time, str):
        return
    entry = document["subscriptions"][SYNTHETIC_SUBSCRIPTION_ID]
    current_time = document["generated_at"]

    def normalise(doc: dict[str, Any], stamp: str) -> str:
        return json.dumps(doc, sort_keys=True).replace(stamp, "<ts>")

    if normalise(prior, prior_time) == normalise(document, current_time):
        document["generated_at"] = prior_time
        entry["discovered_at"] = prior_time
        if isinstance(entry.get("discovery_metadata"), dict):
            entry["discovery_metadata"]["discovered_at"] = prior_time


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate the ALZ Corp default governance baseline.")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--library-dir", type=Path, help="Pre-extracted Azure-Landing-Zones-Library archive root.")
    parser.add_argument("--builtins-dir", type=Path, help="Pre-extracted azure-policy built-in-policies directory.")
    parser.add_argument("--library-ref", help="ALZ library tag the --library-dir tree was taken from (required with it).")
    parser.add_argument(
        "--azure-policy-ref", help="azure-policy commit the --builtins-dir tree was taken from (required with it)."
    )
    args = parser.parse_args(argv)
    # A local tree is not the pinned release, so its provenance must be stated rather than assumed.
    for tree, ref, tree_flag, ref_flag in (
        (args.library_dir, args.library_ref, "--library-dir", "--library-ref"),
        (args.builtins_dir, args.azure_policy_ref, "--builtins-dir", "--azure-policy-ref"),
    ):
        if tree and not ref:
            parser.error(f"{tree_flag} requires {ref_flag}")
        if ref and not tree:
            parser.error(f"{ref_flag} is only valid with {tree_flag}")
    library_ref = args.library_ref or LIBRARY_REF
    azure_policy_ref = args.azure_policy_ref or AZURE_POLICY_REF

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        if args.library_dir:
            library_root = args.library_dir
        else:
            library_root = _extract(LIBRARY_URL, tmp_path / "lib", ("/platform/alz/",))
        if args.builtins_dir:
            builtins_dir = args.builtins_dir
        else:
            builtins_dir = _extract(
                AZURE_POLICY_URL, tmp_path / "builtin", ("/built-in-policies/policyDefinitions/", "/built-in-policies/policySetDefinitions/")
            ) / "built-in-policies"
        generated_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            document = build_baseline(library_root, builtins_dir, generated_at, library_ref, azure_policy_ref)
        except (RuntimeError, KeyError, OSError, ValueError) as error:
            print(f"generate_alz_baseline: {error}", file=sys.stderr)
            return 1
    _preserve_timestamp(args.out, document)
    write_gzip_json(args.out, document)
    summary = document["summary"]
    print(
        f"wrote {args.out}: {summary['total_findings']} findings "
        f"({summary['total_blockers']} blockers, {summary['total_auto_remediate']} auto-remediate)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
