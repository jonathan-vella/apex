#!/usr/bin/env python3
# ruff: noqa: E501
"""Deterministic Azure Policy discovery for 04g-Governance.

Replaces the legacy governance-discovery-subagent. Lists effective policy
assignments at subscription scope (including MG-inherited), pulls definitions,
set-definitions, and exemptions, classifies effects, filters Defender
auto-assignments, and writes a governance-constraints-v1 envelope.

Stdout line 1 is always a one-line JSON status object. Optional Markdown
preview follows on later lines. Stderr carries warnings and filter notes.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

# --------------------------------------------------------------------------- #
# Constants                                                                   #
# --------------------------------------------------------------------------- #

API_ASSIGNMENTS = "2022-06-01"
API_DEFINITIONS = "2021-06-01"
API_EXEMPTIONS = "2022-07-01-preview"
ARM = "https://management.azure.com"

# L0 envelope: staleness threshold (days). Downstream consumers (Planner,
# CodeGen, Deploy) treat envelopes older than this as STALE and refuse to
# proceed without a fresh `--refresh` discovery.
DEFAULT_TTL_DAYS = 7

# Only these effects are plan-blocking. Everything else lives in the summary.
BLOCKER_EFFECTS = {"Deny"}
AUTO_REMEDIATE_EFFECTS = {"DeployIfNotExists", "Modify"}
RELEVANT_EFFECTS = BLOCKER_EFFECTS | AUTO_REMEDIATE_EFFECTS

# Defender-for-Cloud auto-assignment marker. See
# references/effect-classification.md for background.
DEFENDER_ASSIGNED_BY_VALUES = {
    "Security Center",
    "Microsoft Defender for Cloud",
}

# Resource-type to Bicep singular-lowercase mapping. Extend as needed; the
# fallback derives from the full ARM type string.
BICEP_TYPE_OVERRIDES = {
    "Microsoft.Storage/storageAccounts": "storageAccounts",
    "Microsoft.Sql/servers": "sqlServers",
    "Microsoft.Sql/servers/databases": "sqlServers/databases",
    "Microsoft.KeyVault/vaults": "keyVaults",
    "Microsoft.Web/sites": "sites",
    "Microsoft.Network/virtualNetworks": "virtualNetworks",
    "Microsoft.Compute/virtualMachines": "virtualMachines",
    "Microsoft.Resources/subscriptions/resourceGroups": "resourceGroups",
}


# --------------------------------------------------------------------------- #
# Azure CLI shim (injectable for tests)                                       #
# --------------------------------------------------------------------------- #

# Parallelism cap for concurrent ARM calls. ARM throttles aggressively above
# ~16 concurrent; 8 is a safe default that still gives ~4-6x speedup over
# sequential `az rest` subprocess invocations.
_PARALLEL_WORKERS = 8

# Process-wide ARM token cache. `az account get-access-token` takes ~0.5-1s
# per invocation; caching saves that overhead on every subsequent REST call.
_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0.0}


def _get_arm_token() -> str:
    """Return a cached ARM bearer token, refreshing when near expiry."""
    now = time.time()
    if _TOKEN_CACHE["token"] and _TOKEN_CACHE["expires_at"] > now + 60:
        return _TOKEN_CACHE["token"]
    out = subprocess.check_output(  # noqa: S603 — trusted Azure CLI
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            f"{ARM}/",
            "-o",
            "json",
        ],
        text=True,
        timeout=30,
    )
    data = json.loads(out)
    _TOKEN_CACHE["token"] = data["accessToken"]
    # Tokens are valid for ~60 min. Use 50-min safe window to avoid mid-run
    # expiry. `expiresOn` format varies across az versions, so we compute
    # relative expiry from wall-clock instead of parsing it.
    _TOKEN_CACHE["expires_at"] = now + 50 * 60
    return data["accessToken"]


def _default_az_rest(url: str) -> dict[str, Any]:
    """GET `url` with the cached ARM bearer token via stdlib urllib.

    Replaces per-call `az rest` subprocess (saves ~0.5-1s × N calls). Returns
    `{}` for 404 (missing policy definition) so callers can filter silently.
    Raises on auth failures and other HTTP errors.
    """
    token = _get_arm_token()
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 — ARM https
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {}
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:500]
        except Exception:  # pragma: no cover
            pass
        raise RuntimeError(
            f"ARM GET {url} failed: HTTP {e.code} {e.reason}; {detail}"
        ) from e


def _default_get_subscription() -> str:
    out = subprocess.check_output(  # noqa: S603
        ["az", "account", "show", "--query", "id", "-o", "tsv"],
        text=True,
        timeout=30,
    )
    return out.strip()


def _default_check_auth() -> None:
    """Raise if the ARM token cannot be obtained."""
    # Warms the token cache as a side effect so subsequent REST calls are fast.
    _get_arm_token()


# --------------------------------------------------------------------------- #
# Discovery                                                                   #
# --------------------------------------------------------------------------- #


def _list_all(az_rest: Callable[[str], dict[str, Any]], url: str) -> list[dict[str, Any]]:
    """Follow `nextLink` pagination and return the union of `value` arrays."""
    items: list[dict[str, Any]] = []
    next_url: str | None = url
    while next_url:
        page = az_rest(next_url)
        items.extend(page.get("value", []))
        next_url = page.get("nextLink")
    return items


def _parallel_list(
    az_rest: Callable[[str], dict[str, Any]],
    urls: dict[str, str],
) -> dict[str, list[dict[str, Any]]]:
    """Run multiple paginated list calls concurrently. Preserves key mapping.

    Uses a thread pool because `az_rest` is a blocking callable (either
    urllib GET or subprocess `az rest`). Thread-per-URL is fine at this
    concurrency level.
    """
    if not urls:
        return {}
    with ThreadPoolExecutor(max_workers=min(_PARALLEL_WORKERS, len(urls))) as pool:
        futures = {key: pool.submit(_list_all, az_rest, url) for key, url in urls.items()}
        return {key: fut.result() for key, fut in futures.items()}


def _parallel_fetch_items(
    az_rest: Callable[[str], dict[str, Any]],
    urls: list[str],
    expected_ids: list[str] | None = None,
) -> list[dict[str, Any] | None]:
    """Fetch individual items concurrently; tolerate both response shapes.

    Azure returns a single object for GET `.../policyDefinitions/{name}`, but
    injected test fakes commonly match on a URL substring and return the
    wrapped list shape `{"value": [...]}`. This helper accepts both:

    - dict with no `value` key → single-item payload (return as-is, unless empty)
    - dict with `value` list → look for the item whose id matches the expected
      id (preserved positionally via `expected_ids`); fall back to first
    """
    if not urls:
        return []
    if expected_ids is None:
        expected_ids = [""] * len(urls)

    def _fetch(url: str, expected_id: str) -> dict[str, Any] | None:
        resp = az_rest(url)
        if not isinstance(resp, dict) or not resp:
            return None
        if "value" in resp and isinstance(resp["value"], list):
            if expected_id:
                for item in resp["value"]:
                    if (item.get("id") or "").lower() == expected_id.lower():
                        return item
            return resp["value"][0] if resp["value"] else None
        if resp.get("id"):
            return resp
        return None

    with ThreadPoolExecutor(max_workers=min(_PARALLEL_WORKERS, len(urls))) as pool:
        return list(pool.map(_fetch, urls, expected_ids))


_PARAMETER_EXPRESSION_RE = re.compile(r"^\[parameters\('([^']+)'\)\]$", re.IGNORECASE)


def _resolve_parameter_value(value: Any, assignment_params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = _PARAMETER_EXPRESSION_RE.match(value)
        if match:
            return assignment_params.get(match.group(1))
    return value


def _effect_of(defn: dict[str, Any], assignment_params: dict[str, Any] | None = None) -> str | None:
    rule = (defn.get("properties") or {}).get("policyRule") or {}
    then = rule.get("then") or {}
    eff = then.get("effect")
    assignment_params = assignment_params or {}
    eff = _resolve_parameter_value(eff, assignment_params)
    if eff is None:
        expression = then.get("effect")
        if isinstance(expression, str):
            match = _PARAMETER_EXPRESSION_RE.match(expression)
            if match:
                eff = (((defn.get("properties") or {}).get("parameters") or {}).get(match.group(1)) or {}).get(
                    "defaultValue"
                )
    if not isinstance(eff, str):
        return None
    # Canonicalise case (some definitions use lowercase).
    mapping = {
        "deny": "Deny",
        "audit": "Audit",
        "auditifnotexists": "AuditIfNotExists",
        "deployifnotexists": "DeployIfNotExists",
        "modify": "Modify",
        "append": "Append",
        "disabled": "Disabled",
    }
    return mapping.get(eff.lower(), eff)


def _resource_types(defn: dict[str, Any]) -> list[str]:
    rule = (defn.get("properties") or {}).get("policyRule") or {}
    types: set[str] = set()
    stack = [rule.get("if")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if node.get("field") == "type" and isinstance(node.get("equals"), str):
                types.add(node["equals"])
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return sorted(types)


def _required_value(defn: dict[str, Any]) -> Any:
    """Extract the value a Deny/Modify policy requires."""
    props = defn.get("properties") or {}
    then = (props.get("policyRule") or {}).get("then") or {}
    details = then.get("details") or {}
    if not isinstance(details, dict):
        details = {}

    if "value" in details:
        return details["value"]

    ops = details.get("operations") or []
    if isinstance(ops, list) and len(ops) == 1:
        op = ops[0] or {}
        if "value" in op:
            return op["value"]

    params = props.get("parameters") or {}
    for pname, pval in params.items():
        dv = (pval or {}).get("defaultValue")
        key = pname.lower()
        if dv is not None and key in {
            "allowedlocations",
            "listofallowedlocations",
            "allowedskus",
            "listofallowedskus",
            "tagname",
            "tagvalue",
            "minimumtlsversion",
            "requiredretentiondays",
        }:
            return dv
    return None


def _property_paths(defn: dict[str, Any], resource_types: list[str]) -> dict[str, str | None]:
    """Best-effort extraction of azurePropertyPath / bicepPropertyPath.

    Walks the policyRule looking for `field: "<Type>/<path>"` patterns, which
    is how Azure Policy addresses resource properties. Falls back to the
    `Modify` / `DeployIfNotExists` operation field when the top-level rule
    does not name a field.
    """
    rule = (defn.get("properties") or {}).get("policyRule") or {}

    # Tag policies address `tags['<name>']`, often without any `field: type`.
    # Check before the resource-type short-circuit below.
    category = ((((defn.get("properties") or {}).get("metadata") or {}).get("category")) or "").lower()
    if _looks_like_tag_policy(rule) and category == "tags":
        return {
            "azurePropertyPath": "resourceGroup.tags",
            "bicepPropertyPath": "resourceGroups::tags",
            "pathSemantics": "tag-policy-non-property",
        }

    if not resource_types:
        return {"azurePropertyPath": "", "bicepPropertyPath": ""}

    primary_type = resource_types[0]

    candidate_fields: list[str] = []
    stack = [rule.get("if"), rule.get("then")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            f = node.get("field")
            if isinstance(f, str) and "/" in f and f.startswith(primary_type):
                candidate_fields.append(f)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)

    # Also check modify operations for their `field` property.
    then = rule.get("then") or {}
    ops = (then.get("details") or {}).get("operations") or []
    if isinstance(ops, list):
        for op in ops:
            f = (op or {}).get("field")
            if isinstance(f, str) and f.startswith(primary_type):
                candidate_fields.append(f)

    if not candidate_fields:
        return {"azurePropertyPath": "", "bicepPropertyPath": ""}

    # Prefer the field that names the deepest property path (most slashes
    # after the type prefix); otherwise take the first candidate.
    prefix = primary_type + "/"
    scored = [
        (f[len(prefix):] if f.startswith(prefix) else f.rsplit("/", 1)[-1], f)
        for f in candidate_fields
    ]
    # Drop empty tails and sort by descending depth.
    scored = [(tail, orig) for tail, orig in scored if tail]
    if not scored:
        return {"azurePropertyPath": "", "bicepPropertyPath": ""}
    scored.sort(key=lambda pair: pair[0].count("/"), reverse=True)
    path = scored[0][0]
    # Azure path: lowerCamel resource type + dot + property path.
    provider_type = primary_type.split("/", 1)[-1]
    camel_type = provider_type[:1].lower() + provider_type[1:]
    azure_path = f"{camel_type}.{path}"
    bicep_segment = BICEP_TYPE_OVERRIDES.get(primary_type, camel_type)
    bicep_path = f"{bicep_segment}::{path}"
    return {"azurePropertyPath": azure_path, "bicepPropertyPath": bicep_path}


def _looks_like_tag_policy(rule: dict[str, Any]) -> bool:
    operations = (((rule.get("then") or {}).get("details") or {}).get("operations") or [])
    if isinstance(operations, list) and operations:
        operation_fields = [
            (operation or {}).get("field")
            for operation in operations
            if isinstance((operation or {}).get("field"), str)
        ]
        if operation_fields and not all(field.lower().startswith("tags[") for field in operation_fields):
            return False
    stack = [rule.get("if")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            f = node.get("field")
            if isinstance(f, str) and f.lower().startswith("tags["):
                return True
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return False


_TAG_FIELD_RE = re.compile(r"^tags\[(?:'|\")?([^'\"\]]+)(?:'|\")?\]$", re.IGNORECASE)


def _extract_policy_rule_tag_keys(defn: dict[str, Any]) -> list[str]:
    """Walk policyRule looking for hard-coded `tags['<key>']` field references.

    Many custom deny-style tag policies (e.g. `JV-Enforce Resource Group Tags`)
    hard-code the enforced tag list in `policyRule.if.allOf[*].anyOf[*].field`
    instead of exposing it as `tagName*` assignment parameters. Without this
    extraction the downstream `tag_contract.required_tag_keys` silently falls
    back to a sibling Modify policy's keys, producing transcription drift
    (e.g. `tech-contact` vs `technical-contact`). See
    `tools/scripts/diagnose-governance-tag-drift.md` for the full root-cause.
    """
    rule = (defn.get("properties") or {}).get("policyRule") or {}
    keys: list[str] = []
    seen: set[str] = set()
    stack: list[Any] = [rule.get("if")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            field = node.get("field")
            if isinstance(field, str):
                m = _TAG_FIELD_RE.match(field.strip())
                if m:
                    key = m.group(1).strip()
                    if key and key not in seen:
                        seen.add(key)
                        keys.append(key)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return keys


def _is_defender_auto(assignment: dict[str, Any]) -> bool:
    metadata = (assignment.get("properties") or {}).get("metadata") or {}
    assigned_by = metadata.get("assignedBy")
    if isinstance(assigned_by, str) and assigned_by.strip() in DEFENDER_ASSIGNED_BY_VALUES:
        return True
    created_by = metadata.get("createdBy")
    if isinstance(created_by, dict):
        name = (created_by.get("displayName") or "").strip()
        if name in DEFENDER_ASSIGNED_BY_VALUES:
            return True
    return False


def _build_exemption_map(exemptions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Map lowercase policyAssignmentId → exemption summary."""
    out: dict[str, dict[str, Any]] = {}
    for ex in exemptions:
        props = ex.get("properties") or {}
        aid = (props.get("policyAssignmentId") or "").lower()
        if not aid:
            continue
        out[aid] = {
            "exemptionCategory": props.get("exemptionCategory"),
            "expiresOn": props.get("expiresOn"),
            "description": props.get("description"),
            "policyDefinitionReferenceIds": props.get("policyDefinitionReferenceIds") or [],
        }
    return out


# --------------------------------------------------------------------------- #
# Envelope enrichment helpers (Fix E)                                         #
# --------------------------------------------------------------------------- #


def _extract_tags_required(findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Extract tag-enforcement findings into a flat tags_required list.

    Looks for actual tag key names in assignment parameters (tagName, tagNames)
    and in required_value. Falls back to category-based matching for tag policies
    that don't use pathSemantics.
    """
    seen: set[str] = set()
    tags: list[dict[str, str]] = []

    for f in findings:
        is_tag = (
            f.get("pathSemantics") == "tag-policy-non-property"
            or (f.get("category") or "").lower() == "tags"
        )
        if not is_tag:
            continue

        # Try to extract actual tag keys from assignment parameters.
        params = f.get("assignment_parameters") or {}
        tag_keys: list[str] = []

        # Deny-style tag policies often hard-code keys in policyRule rather
        # than exposing them via tagName* parameters. Prefer those — they are
        # the authoritative enforced list.
        for key in (f.get("extracted_tag_keys") or []):
            if isinstance(key, str) and key:
                tag_keys.append(key)

        # Common parameter names for tag policies (Modify/Append style).
        for pname in ("tagName", "tagname", "tag_name"):
            val = params.get(pname)
            if isinstance(val, str) and val:
                tag_keys.append(val)
            elif isinstance(val, list):
                tag_keys.extend(str(v) for v in val if v)

        for pname, val in params.items():
            if re.fullmatch(r"tagName\d+", pname, re.IGNORECASE) and isinstance(val, str) and val:
                tag_keys.append(val)

        # Some policies use tagNames (plural) or listOfTagNames
        for pname in ("tagNames", "listOfTagNames", "tagnames"):
            val = params.get(pname)
            if isinstance(val, list):
                tag_keys.extend(str(v) for v in val if v)

        source = f.get("policy_id", "")
        policy_name = (f.get("display_name") or "").strip()

        if tag_keys:
            for key in tag_keys:
                key = key.strip()
                if key and key not in seen:
                    seen.add(key)
                    tags.append({
                        "name": key,
                        "source_policy": source,
                        "source_assignment": f.get("assignment_display_name", ""),
                    })
        elif policy_name and policy_name not in seen:
            # No specific tag key found — record the policy as a tag requirement
            # so the agent knows to investigate further.
            seen.add(policy_name)
            tags.append({
                "name": f"[unresolved: {policy_name}]",
                "source_policy": source,
                "source_assignment": f.get("assignment_display_name", ""),
                "unresolved": "true",
            })
    return tags


def _is_location_constraint(defn: dict[str, Any]) -> bool:
    props = defn.get("properties") or {}
    if any(name.lower() in {"listofallowedlocations", "allowedlocations"} for name in (props.get("parameters") or {})):
        return True
    display_name = props.get("displayName") or ""
    if not re.search(r"\b(?:locations?|regions?)\b", display_name, re.IGNORECASE):
        return False
    stack = [(props.get("policyRule") or {}).get("if")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            field = node.get("field")
            if isinstance(field, str) and (field.lower() == "location" or field.lower().endswith("/location")):
                return True
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return False


def _location_values(parameters: dict[str, Any], required_value: Any = None) -> list[str]:
    locations: set[str] = set()
    if isinstance(required_value, list):
        locations.update(str(value) for value in required_value if value)
    elif isinstance(required_value, str) and required_value:
        locations.add(required_value)
    for name, value in parameters.items():
        if name.lower() in {"listofallowedlocations", "allowedlocations"} and isinstance(value, list):
            locations.update(str(item) for item in value if item)
    return sorted(locations)


def _extract_allowed_locations(
    findings: list[dict[str, Any]], location_constraints: list[dict[str, Any]] | None = None
) -> list[str]:
    """Extract allowed-location values from findings with location constraints.

    Checks both required_value (from definition defaults) and assignment_parameters
    (which carry the actual configured location list).
    """
    locations: set[str] = set()
    for f in findings:
        dn = (f.get("display_name") or "").lower()
        cat = (f.get("category") or "").lower()
        is_location = "location" in dn or "region" in dn or "location" in cat

        # Check required_value from definition
        rv = f.get("required_value")
        if is_location:
            if isinstance(rv, list):
                locations.update(str(v) for v in rv)
            elif isinstance(rv, str) and rv:
                locations.add(rv)

        # Check assignment parameters for location lists
        params = f.get("assignment_parameters") or {}
        for pname in (
            "listOfAllowedLocations", "allowedLocations",
            "listofallowedlocations", "allowedlocations",
        ):
            val = params.get(pname)
            if isinstance(val, list):
                locations.update(str(v) for v in val if v)
    for constraint in location_constraints or []:
        locations.update(str(value) for value in constraint.get("allowed_locations") or [] if value)
    return sorted(locations)


# --------------------------------------------------------------------------- #
# L0 envelope helpers                                                         #
#                                                                             #
# The canonical implementations live in render_governance.py so the cached    #
# baseline path (render_cached_governance.py) and the live discovery path     #
# (this module) share one signature algorithm. Re-export under the legacy    #
# private names so existing call sites and tests keep working unchanged.    #
# --------------------------------------------------------------------------- #

from render_governance import _build_discovery_metadata  # noqa: E402,F401 — shared L0 helper
from render_governance import _completeness_signature  # noqa: E402,F401 — shared L0 helper
from render_governance import _extract_management_groups  # noqa: E402,F401 — shared L0 helper


def _self_check_assignments(
    az_rest: Callable[[str], dict[str, Any]],
    subscription_id: str,
    expected_count: int,
) -> tuple[bool, int]:
    """Re-fetch the first page of policyAssignments and verify count.

    Returns (ok, actual_count). On any network/parse failure, returns
    (False, -1) so the caller can downgrade `discovery_status` to
    `PARTIAL` without crashing.
    """
    try:
        url = (
            f"{ARM}/subscriptions/{subscription_id}/providers/Microsoft.Authorization/"
            f"policyAssignments?$filter=atScope()&api-version={API_ASSIGNMENTS}"
        )
        # We deliberately re-use _default_az_rest here via the caller's
        # az_rest, which is the same surface that just produced the original
        # list — any drift now is real (filter change, RBAC drop, paging bug).
        first = az_rest(url) or {}
        items = first.get("value") or []
        return len(items) == expected_count, len(items)
    except Exception:  # noqa: BLE001 — self-check must never crash discovery
        return False, -1


# --------------------------------------------------------------------------- #
# Core                                                                        #
# --------------------------------------------------------------------------- #


def _classify(effect: str) -> str:
    if effect in BLOCKER_EFFECTS:
        return "blocker"
    if effect in AUTO_REMEDIATE_EFFECTS:
        return "auto-remediate"
    return "informational"


def discover(
    subscription_id: str,
    *,
    project: str,
    include_defender_auto: bool = False,
    az_rest: Callable[[str], dict[str, Any]] | None = None,
    verbose: bool = False,
) -> dict[str, Any]:
    """Run discovery and return the full envelope (not written to disk).

    ``verbose`` gates noisy informational stderr (per-assignment Defender
    filter announcements). The count is always recorded in
    ``discovery_summary.defender_auto_filtered`` regardless.
    """
    if az_rest is None:
        # Resolve at call time so tests can monkeypatch `_default_az_rest`.
        az_rest = _default_az_rest
    base = f"{ARM}/subscriptions/{subscription_id}/providers/Microsoft.Authorization"

    # Phase 1 — Parallel list calls for subscription-scope data + exemptions.
    # The tenant-wide built-in definition list (~1500 items) is deliberately
    # NOT fetched here; we fetch only the tenant definitions an assignment
    # actually references (Phase 2). Saves a large, mostly-unused payload.
    primary = _parallel_list(
        az_rest,
        {
            "assignments": f"{base}/policyAssignments?$filter=atScope()&api-version={API_ASSIGNMENTS}",
            "sub_defs": f"{base}/policyDefinitions?api-version={API_DEFINITIONS}",
            "sub_sets": f"{base}/policySetDefinitions?api-version={API_DEFINITIONS}",
            "exemptions": f"{base}/policyExemptions?$filter=atScope()&api-version={API_EXEMPTIONS}",
        },
    )
    assignments = primary["assignments"]
    defs: dict[str, dict[str, Any]] = {d["id"].lower(): d for d in primary["sub_defs"]}
    sets: dict[str, dict[str, Any]] = {s["id"].lower(): s for s in primary["sub_sets"]}
    exemptions = primary["exemptions"]

    # Phase 2 — Fetch only the tenant-scoped initiatives and definitions that
    # assignments actually reference. Initiatives come first because their
    # members may themselves be tenant-scope definitions. We preserve the
    # original-case ID for URL construction (ARM is case-insensitive but
    # downstream consumers and test routers match by substring).
    tenant_set_ids: dict[str, str] = {}  # lowercase → original-case
    tenant_def_ids: dict[str, str] = {}
    for a in assignments:
        pid_original = (a.get("properties") or {}).get("policyDefinitionId") or ""
        pid = pid_original.lower()
        if not pid or not pid.startswith("/providers/microsoft.authorization/"):
            continue
        if "/policysetdefinitions/" in pid and pid not in sets:
            tenant_set_ids.setdefault(pid, pid_original)
        elif "/policydefinitions/" in pid and pid not in defs:
            tenant_def_ids.setdefault(pid, pid_original)

    if tenant_set_ids:
        ordered = sorted(tenant_set_ids.items())
        fetched_sets = _parallel_fetch_items(
            az_rest,
            [f"{ARM}{orig}?api-version={API_DEFINITIONS}" for _, orig in ordered],
            expected_ids=[orig for _, orig in ordered],
        )
        for s in fetched_sets:
            if s:
                sets.setdefault((s.get("id") or "").lower(), s)
                for m in (s.get("properties") or {}).get("policyDefinitions") or []:
                    mid_original = (m.get("policyDefinitionId") or "")
                    mid = mid_original.lower()
                    if (
                        mid
                        and mid.startswith("/providers/microsoft.authorization/")
                        and mid not in defs
                    ):
                        tenant_def_ids.setdefault(mid, mid_original)

    if tenant_def_ids:
        ordered = sorted(tenant_def_ids.items())
        fetched_defs = _parallel_fetch_items(
            az_rest,
            [f"{ARM}{orig}?api-version={API_DEFINITIONS}" for _, orig in ordered],
            expected_ids=[orig for _, orig in ordered],
        )
        for d in fetched_defs:
            if d:
                defs.setdefault((d.get("id") or "").lower(), d)

    exemption_map = _build_exemption_map(exemptions)

    # Assignment filtering (Defender auto-assignments).
    filtered_defender: list[str] = []
    kept_assignments: list[dict[str, Any]] = []
    for a in assignments:
        if _is_defender_auto(a) and not include_defender_auto:
            filtered_defender.append(
                (a.get("properties") or {}).get("displayName") or a.get("name") or a.get("id") or "<unknown>"
            )
            continue
        kept_assignments.append(a)

    for name in filtered_defender:
        # Per-assignment filter announcements are noise by default — the
        # aggregate count lives in discovery_summary.defender_auto_filtered.
        # Surface the names only when --verbose is passed (Phase 6 fix).
        if verbose:
            print(f"filter: skipping Defender auto-assignment: {name}", file=sys.stderr)

    assignment_inventory: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    location_constraints: list[dict[str, Any]] = []
    audit_count = 0
    disabled_count = 0

    for a in kept_assignments:
        props = a.get("properties") or {}
        display = props.get("displayName") or a.get("name") or a.get("id") or "<unknown>"
        scope = props.get("scope") or ""
        pid = (props.get("policyDefinitionId") or "").lower()
        assignment_id = (a.get("id") or "").lower()
        assignment_type = (
            "management-group" if "/providers/microsoft.management/managementgroups/" in scope.lower() else "subscription"
        )
        assignment_params = {
            key: (value or {}).get("value")
            for key, value in (props.get("parameters") or {}).items()
            if (value or {}).get("value") is not None
        }
        assignment_inventory.append(
            {
                "displayName": display,
                "scope": scope,
                "assignmentType": assignment_type,
                "policyDefinitionId": pid,
                "enforcementMode": props.get("enforcementMode") or "Default",
                "parameters": assignment_params,
            }
        )

        if not pid:
            continue

        # Resolve to member definitions (initiative → its members; policy → itself).
        members: list[tuple[dict[str, Any], str | None, dict[str, Any]]] = []
        if "/policysetdefinitions/" in pid and pid in sets:
            initiative_defaults = {
                key: (value or {}).get("defaultValue")
                for key, value in ((sets[pid].get("properties") or {}).get("parameters") or {}).items()
                if (value or {}).get("defaultValue") is not None
            }
            initiative_params = {**initiative_defaults, **assignment_params}
            for m in (sets[pid].get("properties") or {}).get("policyDefinitions") or []:
                mid = (m.get("policyDefinitionId") or "").lower()
                if mid in defs:
                    member_params = {
                        key: _resolve_parameter_value((value or {}).get("value"), initiative_params)
                        for key, value in (m.get("parameters") or {}).items()
                        if _resolve_parameter_value((value or {}).get("value"), initiative_params) is not None
                    }
                    members.append((defs[mid], m.get("policyDefinitionReferenceId"), member_params))
        elif pid in defs:
            members.append((defs[pid], None, {}))
        # Unknown definition id — nothing to emit; still counted in inventory.

        for defn, member_ref_id, member_params in members:
            effective_params = {**assignment_params, **member_params}
            eff = _effect_of(defn, effective_params)
            if eff is None:
                continue
            if eff == "Disabled":
                disabled_count += 1
                continue
            if _is_location_constraint(defn):
                location_constraints.append(
                    {
                        "policy_id": defn.get("id"),
                        "display_name": (defn.get("properties") or {}).get("displayName")
                        or defn.get("name")
                        or defn.get("id"),
                        "assignment_display_name": display,
                        "assignment_id": a.get("id"),
                        "scope": scope,
                        "effect": eff[:1].lower() + eff[1:],
                        "enforcement_mode": props.get("enforcementMode") or "Default",
                        "allowed_locations": _location_values(effective_params, _required_value(defn)),
                    }
                )
            if eff in {"Audit", "AuditIfNotExists"}:
                audit_count += 1
                continue
            if eff not in RELEVANT_EFFECTS:
                continue

            rtypes = _resource_types(defn)
            paths = _property_paths(defn, rtypes)
            category = ((defn.get("properties") or {}).get("metadata") or {}).get(
                "category"
            ) or "Uncategorized"

            exemption = None
            if assignment_id in exemption_map:
                candidate = exemption_map[assignment_id]
                ref_ids = candidate.get("policyDefinitionReferenceIds") or []
                if not ref_ids or member_ref_id in ref_ids:
                    exemption = candidate

            classification = _classify(eff)
            if exemption is not None and classification == "blocker":
                classification = "informational"

            finding = {
                "policy_id": defn.get("id"),
                "display_name": (defn.get("properties") or {}).get("displayName")
                or defn.get("name")
                or defn.get("id"),
                "effect": eff[:1].lower() + eff[1:],  # lower-camel for schema enum
                "scope": scope,
                "assignment_display_name": display,
                "assignment_id": a.get("id"),
                "classification": classification,
                "category": category,
                "resource_types": rtypes,
                "required_value": _required_value(defn),
                "azurePropertyPath": paths.get("azurePropertyPath"),
                "bicepPropertyPath": paths.get("bicepPropertyPath"),
                "exemption": exemption,
                "override": None,
            }
            # Carry assignment-level parameter values (tag keys, location lists).
            if effective_params:
                finding["assignment_parameters"] = effective_params
            if paths.get("pathSemantics"):
                finding["pathSemantics"] = paths["pathSemantics"]
            # For Tags-category policies, extract enforced tag keys from the
            # policyRule body. Deny-style tag policies often hard-code keys
            # in `policyRule.if.allOf[*].anyOf[*].field` rather than exposing
            # them as `tagName*` assignment parameters; without this we get
            # silent drift to sibling Modify-policy keys.
            if (
                finding.get("pathSemantics") == "tag-policy-non-property"
                or (finding.get("category") or "").lower() == "tags"
            ):
                rule_tag_keys = _extract_policy_rule_tag_keys(defn)
                if rule_tag_keys:
                    finding["extracted_tag_keys"] = rule_tag_keys
            findings.append(finding)

    blockers = sum(1 for f in findings if f["classification"] == "blocker")
    auto_remediate = sum(1 for f in findings if f["classification"] == "auto-remediate")
    exempted = sum(1 for f in findings if f["exemption"] is not None)

    # L0 envelope: signature, scope, and self-check.
    management_groups = _extract_management_groups(kept_assignments)
    discovery_status = "COMPLETE"
    # Re-fetch page 1 of assignments and verify the count matches the
    # initial pull. Drift here indicates RBAC change, filter mutation, or
    # a paginated REST surface change between the two calls.
    self_check_ok, self_check_count = _self_check_assignments(az_rest, subscription_id, len(assignments))
    if not self_check_ok:
        discovery_status = "PARTIAL"
        print(
            f"self-check: policyAssignments count drift "
            f"(expected={len(assignments)}, observed={self_check_count}); "
            f"marking discovery_status=PARTIAL",
            file=sys.stderr,
        )

    discovered_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    discovery_metadata = _build_discovery_metadata(
        findings=findings,
        subscription_id=subscription_id,
        management_groups=management_groups,
        page_counts={
            # `_parallel_list` collapses pagination, so we record the
            # final item counts per REST surface. The self-check above
            # validates these against a fresh page-1 fetch.
            "policyAssignments": len(assignments),
            "policyDefinitions": len(defs),
            "policyExemptions": len(exemptions),
        },
        discovered_at=discovered_at,
        discovery_status=discovery_status,
        source="live",
    )

    envelope = {
        "schema_version": "governance-constraints-v1",
        "project": project,
        "subscription_id": subscription_id,
        "discovered_at": discovered_at,
        "source": "azure-policy-rest-api",
        "discovery_status": discovery_status,
        "discovery_metadata": discovery_metadata,
        "discovery_summary": {
            "assignment_total": len(assignments),
            "assignment_kept": len(kept_assignments),
            "defender_auto_filtered": len(filtered_defender),
            "subscription_scope_count": sum(
                1 for a in kept_assignments if "/providers/microsoft.management/" not in (a.get("properties", {}).get("scope") or "").lower()
            ),
            "management_group_inherited_count": sum(
                1 for a in kept_assignments if "/providers/microsoft.management/" in (a.get("properties", {}).get("scope") or "").lower()
            ),
            "blocker_count": blockers,
            "auto_remediate_count": auto_remediate,
            "informational_count": sum(
                1 for f in findings if f["classification"] == "informational"
            ),
            "audit_count": audit_count,
            "disabled_count": disabled_count,
            "exempted_count": exempted,
        },
        "assignment_inventory": assignment_inventory,
        "findings": findings,
        # Fix E: canonical aliases so the agent never needs to reshape JSON.
        # `policies` is a reference alias of `findings` (not a copy).
        "policies": findings,
        # Authoritative reference set for the L3 policy-precheck subagent.
        # Contains every policy definition ID we resolved during this run
        # (subscription-scope + tenant-scope, both initiative members and
        # standalone assignments), regardless of effect. The L3 subagent
        # uses this to suppress false-positive "live policies missing from
        # constraints" noise caused by initiative child policies that the
        # findings[] filter (Deny + DeployIfNotExists + Modify only) drops.
        # Values are lowercase resource IDs to match `az policy state list`
        # output. See iac-common/references/policy-precheck-contract.md
        # Phase 3 step 1 for the comparison contract.
        "member_policy_index": sorted(defs.keys()),
        "tags_required": _extract_tags_required(findings),
        "location_constraints": location_constraints,
        "allowed_locations": _extract_allowed_locations(findings, location_constraints),
    }
    return envelope


# --------------------------------------------------------------------------- #
# CLI                                                                         #
# --------------------------------------------------------------------------- #


def _emit_status(status: dict[str, Any]) -> None:
    """Emit single-line JSON status as the first stdout line."""
    sys.stdout.write(json.dumps(status, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def _emit_preview(envelope: dict[str, Any], limit: int = 20) -> None:
    """Human-readable Markdown preview. NEVER re-ingest into LLM context."""
    summary = envelope["discovery_summary"]
    print(
        f"\n{envelope['subscription_id']}: {summary['assignment_kept']} kept "
        f"assignments (of {summary['assignment_total']}; "
        f"{summary['defender_auto_filtered']} Defender auto filtered); "
        f"{summary['blocker_count']} blockers, "
        f"{summary['auto_remediate_count']} auto-remediate, "
        f"{summary['exempted_count']} exempted."
    )
    print()
    print("| Effect | Classification | Category | Policy | Assignment |")
    print("|---|---|---|---|---|")
    for f in envelope["findings"][:limit]:
        print(
            f"| {f['effect']} | {f['classification']} | {f['category']} | "
            f"{f['display_name']} | {f['assignment_display_name']} |"
        )
    if len(envelope["findings"]) > limit:
        print(f"\n… {len(envelope['findings']) - limit} more in {envelope.get('_out_path')}")


# Renderer functions extracted to render_governance.py — import and re-export
# as module-level aliases so existing tests (test_discover.py) that call
# discover._extract_arch_resources(...) continue to pass unchanged.
from render_governance import extract_arch_resources as _extract_arch_resources  # noqa: F401
from render_governance import emit_preview_md as _emit_preview_md  # noqa: F401


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="discover",
        description="Deterministic Azure Policy discovery for 04g-Governance.",
    )
    parser.add_argument("--project", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--subscription", default="default")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument(
        "--arch",
        default=None,
        help="Path to 02-architecture-assessment.md. Enables policy→resource mapping in preview.md.",
    )
    parser.add_argument(
        "--include-defender-auto",
        action="store_true",
        help="Retain Defender-for-Cloud auto-assignments (filtered by default).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Emit informational stderr (per-assignment Defender filter announcements). "
        "Aggregate counts are always recorded in discovery_summary regardless.",
    )
    args = parser.parse_args(argv)

    out_path = Path(args.out)
    existing: dict[str, Any] | None = None
    if out_path.exists():
        try:
            candidate = json.loads(out_path.read_text())
            existing = candidate if isinstance(candidate, dict) else None
        except json.JSONDecodeError:
            existing = None
    preserved_security_exceptions = (
        existing.get("security_exceptions")
        if isinstance(existing, dict) and isinstance(existing.get("security_exceptions"), list)
        else []
    )

    # Cache short-circuit — reuse an existing COMPLETE snapshot unless --refresh.
    if out_path.exists() and not args.refresh:
        cached = existing
        if (
            isinstance(cached, dict)
            and cached.get("discovery_status") == "COMPLETE"
            and isinstance(cached.get("findings"), list)
        ):
            summary = cached.get("discovery_summary") or {}
            status = {
                "status": "COMPLETE",
                "cache_hit": True,
                "assignment_total": summary.get("assignment_total", 0),
                "blockers": summary.get("blocker_count", 0),
                "auto_remediate": summary.get("auto_remediate_count", 0),
                "exempted": summary.get("exempted_count", 0),
                "out_path": str(out_path),
            }
            _emit_status(status)
            print(
                f"cache hit: reusing {out_path} ({len(cached.get('findings', []))} findings; "
                f"pass --refresh to re-discover)"
            )
            return 0

    # Resolve subscription id.
    try:
        sub_id = _default_get_subscription() if args.subscription == "default" else args.subscription
    except subprocess.CalledProcessError as e:
        _emit_status({"status": "FAILED", "error": "subscription-resolution", "detail": str(e)})
        print("ERROR: could not resolve subscription via `az account show`.", file=sys.stderr)
        return 2

    try:
        _default_check_auth()
    except subprocess.CalledProcessError as e:
        _emit_status(
            {
                "status": "FAILED",
                "error": "auth",
                "detail": (e.output or "").strip() if hasattr(e, "output") else str(e),
            }
        )
        print(
            "ERROR: Azure ARM token unavailable. Run `az login --use-device-code`.",
            file=sys.stderr,
        )
        return 2

    try:
        envelope = discover(
            sub_id,
            project=args.project,
            include_defender_auto=args.include_defender_auto,
            verbose=args.verbose,
        )
    except subprocess.CalledProcessError as e:
        _emit_status(
            {
                "status": "FAILED",
                "error": "rest",
                "detail": str(e),
            }
        )
        print(f"ERROR: Azure REST call failed: {e}", file=sys.stderr)
        return 2
    except Exception as e:  # pragma: no cover — defensive
        _emit_status({"status": "FAILED", "error": "unexpected", "detail": str(e)})
        print(f"ERROR: unexpected failure: {e}", file=sys.stderr)
        return 2

    out_path.parent.mkdir(parents=True, exist_ok=True)
    if preserved_security_exceptions:
        envelope["security_exceptions"] = preserved_security_exceptions
    envelope["_out_path"] = str(out_path)
    out_path.write_text(json.dumps(envelope, indent=2, sort_keys=False) + "\n")

    # Fix C: emit sibling preview.md for agent annotation
    arch_resources = _extract_arch_resources(args.arch) if args.arch else None
    preview_path = _emit_preview_md(envelope, out_path, arch_resources=arch_resources)
    if preview_path:
        print(f"preview: wrote {preview_path}", file=sys.stderr)

    summary = envelope["discovery_summary"]
    status = {
        "status": envelope["discovery_status"],
        "cache_hit": False,
        "assignment_total": summary["assignment_total"],
        "blockers": summary["blocker_count"],
        "auto_remediate": summary["auto_remediate_count"],
        "exempted": summary["exempted_count"],
        "out_path": str(out_path),
    }
    _emit_status(status)
    _emit_preview(envelope)
    return 0 if envelope["discovery_status"] == "COMPLETE" else 1


if __name__ == "__main__":
    sys.exit(main())
