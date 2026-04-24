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


def _effect_of(defn: dict[str, Any]) -> str | None:
    rule = (defn.get("properties") or {}).get("policyRule") or {}
    then = rule.get("then") or {}
    eff = then.get("effect")
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
    if _looks_like_tag_policy(rule):
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

        # Common parameter names for tag policies
        for pname in ("tagName", "tagname", "tag_name"):
            val = params.get(pname)
            if isinstance(val, str) and val:
                tag_keys.append(val)
            elif isinstance(val, list):
                tag_keys.extend(str(v) for v in val if v)

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


def _extract_allowed_locations(findings: list[dict[str, Any]]) -> list[str]:
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
    return sorted(locations)


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
) -> dict[str, Any]:
    """Run discovery and return the full envelope (not written to disk)."""
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
        print(f"filter: skipping Defender auto-assignment: {name}", file=sys.stderr)

    assignment_inventory: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
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
        assignment_inventory.append(
            {
                "displayName": display,
                "scope": scope,
                "assignmentType": assignment_type,
                "policyDefinitionId": pid,
            }
        )

        if not pid:
            continue

        # Resolve to member definitions (initiative → its members; policy → itself).
        members: list[tuple[dict[str, Any], str | None]] = []
        if "/policysetdefinitions/" in pid and pid in sets:
            for m in (sets[pid].get("properties") or {}).get("policyDefinitions") or []:
                mid = (m.get("policyDefinitionId") or "").lower()
                if mid in defs:
                    members.append((defs[mid], m.get("policyDefinitionReferenceId")))
        elif pid in defs:
            members.append((defs[pid], None))
        # Unknown definition id — nothing to emit; still counted in inventory.

        for defn, member_ref_id in members:
            eff = _effect_of(defn)
            if eff is None:
                continue
            if eff == "Disabled":
                disabled_count += 1
                continue
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
            assignment_params = props.get("parameters") or {}
            if assignment_params:
                finding["assignment_parameters"] = {
                    k: (v or {}).get("value")
                    for k, v in assignment_params.items()
                    if (v or {}).get("value") is not None
                }
            if paths.get("pathSemantics"):
                finding["pathSemantics"] = paths["pathSemantics"]
            findings.append(finding)

    blockers = sum(1 for f in findings if f["classification"] == "blocker")
    auto_remediate = sum(1 for f in findings if f["classification"] == "auto-remediate")
    exempted = sum(1 for f in findings if f["exemption"] is not None)

    envelope = {
        "schema_version": "governance-constraints-v1",
        "project": project,
        "subscription_id": subscription_id,
        "discovered_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "azure-policy-rest-api",
        "discovery_status": "COMPLETE",
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
        "tags_required": _extract_tags_required(findings),
        "allowed_locations": _extract_allowed_locations(findings),
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
    args = parser.parse_args(argv)

    out_path = Path(args.out)

    # Cache short-circuit — reuse an existing COMPLETE snapshot unless --refresh.
    if out_path.exists() and not args.refresh:
        try:
            cached = json.loads(out_path.read_text())
        except json.JSONDecodeError:
            cached = None
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
