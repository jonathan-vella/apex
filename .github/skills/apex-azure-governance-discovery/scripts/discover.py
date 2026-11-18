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
import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timezone
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


class ArmHttpError(RuntimeError):
    """ARM REST HTTP failure with structured status code, URL, and detail."""

    def __init__(self, url: str, status_code: int, reason: str = "", detail: str = "") -> None:
        self.url = url
        self.status_code = status_code
        self.reason = reason
        self.detail = detail
        suffix = f" {reason}" if reason else ""
        super().__init__(f"ARM GET {url} failed: HTTP {status_code}{suffix}; {detail}")


_HTTP_STATUS_RE = re.compile(r"\bHTTP(?:/\d(?:\.\d)?)?\s+(\d{3})\b|\b(403)\s+Forbidden\b", re.IGNORECASE)
_MG_RESOURCE_RE = re.compile(
    r"/providers/Microsoft\.Management/managementGroups/([^/?#'\"\s]+)"
    r"(?:/providers/Microsoft\.Authorization/(policyAssignments|policyDefinitions|policySetDefinitions|policyExemptions)(?:/[^/?#'\"\s]+)?)?",
    re.IGNORECASE,
)
_CANONICAL_SURFACES = {
    "policyassignments": "policyAssignments",
    "policydefinitions": "policyDefinitions",
    "policysetdefinitions": "policySetDefinitions",
    "policyexemptions": "policyExemptions",
}


def _http_status_code(exc: BaseException) -> int | None:
    for candidate in (exc, getattr(exc, "__cause__", None), getattr(exc, "__context__", None)):
        if candidate is None:
            continue
        for attr in ("status_code", "code"):
            val = getattr(candidate, attr, None)
            if isinstance(val, int) and 100 <= val <= 599:
                return val
    match = _HTTP_STATUS_RE.search(str(exc))
    if match:
        return int(match.group(1) or match.group(2))
    return None


def _parse_mg_scope(
    target: str,
    detail: str = "",
    subscription_id: str = "",
    default_surface: str = "policyDefinitions",
) -> dict[str, str] | None:
    clean_target = (target or "").removeprefix(ARM).split("?", 1)[0]
    match = _MG_RESOURCE_RE.search(clean_target)
    if match:
        mg_id = match.group(1)
        surface = _CANONICAL_SURFACES.get((match.group(2) or "").lower(), default_surface)
        return {
            "scope": f"/providers/Microsoft.Management/managementGroups/{mg_id}",
            "management_group": mg_id,
            "surface": surface,
            "resource_id": clean_target,
        }
    if detail:
        lowered_detail = detail.lower()
        sub_scope = f"/subscriptions/{subscription_id}".lower() if subscription_id else ""
        if sub_scope and (f"scope '{sub_scope}'" in lowered_detail or f'scope "{sub_scope}"' in lowered_detail):
            return None
        detail_match = _MG_RESOURCE_RE.search(detail)
        if detail_match:
            mg_id = detail_match.group(1)
            surface = _CANONICAL_SURFACES.get((detail_match.group(2) or "").lower(), default_surface)
            return {
                "scope": f"/providers/Microsoft.Management/managementGroups/{mg_id}",
                "management_group": mg_id,
                "surface": surface,
                "resource_id": detail_match.group(0),
            }
    return None


def _scope_metadata_for_id(resource_id: str, subscription_id: str, fallback_scope: str = "") -> dict[str, str]:
    clean = (resource_id or "").removeprefix(ARM).split("?", 1)[0]
    lowered = clean.lower()
    surface = "policyDefinitions"
    for marker, canonical in _CANONICAL_SURFACES.items():
        if f"/{marker}/" in lowered or lowered.endswith(f"/{marker}"):
            surface = canonical
            break
    mg_info = _parse_mg_scope(clean, default_surface=surface)
    if mg_info is not None:
        return mg_info
    scope = fallback_scope or (
        clean.split("/providers/Microsoft.Authorization/", 1)[0]
        if "/providers/microsoft.authorization/" in lowered
        else ""
    )
    if not scope:
        scope = "/providers/Microsoft.Authorization" if lowered.startswith("/providers/microsoft.authorization/") else f"/subscriptions/{subscription_id}"
    out = {
        "scope": scope,
        "surface": surface,
        "resource_id": clean or scope,
    }
    scope_mg = _parse_mg_scope(scope, default_surface=surface)
    if scope_mg is not None:
        out["scope"] = scope_mg["scope"]
        out["management_group"] = scope_mg["management_group"]
    return out


def _normalize_unresolved_scopes(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[tuple[Any, ...], dict[str, Any]] = {}
    for entry in entries:
        key = (
            entry.get("reason", ""),
            str(entry.get("scope", "")).lower(),
            entry.get("surface", ""),
            str(entry.get("resource_id", "")).lower(),
            entry.get("http_status"),
        )
        deduped.setdefault(key, entry)
    return sorted(
        deduped.values(),
        key=lambda item: (
            str(item.get("scope", "")).lower(),
            str(item.get("surface", "")),
            str(item.get("resource_id", "")).lower(),
            str(item.get("reason", "")),
        ),
    )


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
        raise ArmHttpError(url, e.code, str(e.reason), detail) from e


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
    visited: set[str] = set()
    while next_url:
        if not isinstance(next_url, str) or next_url in visited:
            raise ValueError("Invalid or cyclic ARM pagination link")
        visited.add(next_url)
        page = az_rest(next_url)
        if not isinstance(page, dict) or not isinstance(page.get("value"), list):
            raise ValueError(f"Missing ARM list value: {next_url}")
        if not all(isinstance(item, dict) for item in page["value"]):
            raise ValueError(f"Invalid ARM list item: {next_url}")
        items.extend(page["value"])
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
    *,
    forbidden_out: list[dict[str, Any]] | None = None,
    default_surface: str = "policyDefinitions",
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

    def _fetch(url: str, expected_id: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        try:
            resp = az_rest(url)
        except Exception as exc:
            if _http_status_code(exc) == 403:
                mg_info = _parse_mg_scope(expected_id or url, str(exc), default_surface=default_surface)
                if mg_info is not None:
                    return None, {
                        "reason": "ancestor_scope_forbidden",
                        "scope": mg_info["scope"],
                        "management_group": mg_info["management_group"],
                        "surface": mg_info["surface"],
                        "resource_id": expected_id or mg_info["resource_id"],
                        "http_status": 403,
                    }
            raise
        if not isinstance(resp, dict) or not resp:
            return None, None
        if "value" in resp and isinstance(resp["value"], list):
            if expected_id:
                for item in resp["value"]:
                    if (item.get("id") or "").lower() == expected_id.lower():
                        return item, None
            return (None if expected_id else (resp["value"][0] if resp["value"] else None)), None
        if resp.get("id"):
            return (resp if not expected_id or resp["id"].lower() == expected_id.lower() else None), None
        return None, None

    with ThreadPoolExecutor(max_workers=min(_PARALLEL_WORKERS, len(urls))) as pool:
        results = list(pool.map(_fetch, urls, expected_ids))
    items: list[dict[str, Any] | None] = []
    for item, forbidden in results:
        items.append(item)
        if forbidden is not None and forbidden_out is not None:
            forbidden_out.append(forbidden)
    return items


# Built-in diagnostic-settings initiatives gate each member's effect on a resource-type list parameter.
_CONDITIONAL_EFFECT = re.compile(
    r"\[if\(contains\(parameters\('([^']+)'\),\s*'([^']+)'\),\s*parameters\('([^']+)'\),\s*'([^']+)'\)\]",
    re.IGNORECASE,
)


def _resolve_parameters(value: Any, parameters: dict[str, Any]) -> Any:
    if isinstance(value, str):
        normalized = {key.lower(): item for key, item in parameters.items()}
        match = re.fullmatch(r"\[parameters\('([^']+)'\)\]", value.strip(), re.IGNORECASE)
        if match:
            return normalized.get(match.group(1).lower(), value)
        conditional = _CONDITIONAL_EFFECT.fullmatch(value.strip())
        if conditional:
            container = normalized.get(conditional.group(1).lower())
            chosen = normalized.get(conditional.group(3).lower())
            if isinstance(container, list) and chosen is not None:
                listed = {str(item).lower() for item in container}
                return chosen if conditional.group(2).lower() in listed else conditional.group(4)
    if isinstance(value, dict):
        return {key: _resolve_parameters(item, parameters) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve_parameters(item, parameters) for item in value]
    return value


def _effective_parameters(defn: dict[str, Any], supplied: dict[str, Any]) -> dict[str, Any]:
    defaults = (defn.get("properties") or {}).get("parameters") or {}
    names = {key.lower(): key for key in defaults}
    result = {key: item["defaultValue"] for key, item in defaults.items() if "defaultValue" in item}
    result.update({names.get(key.lower(), key): item["value"] for key, item in supplied.items() if "value" in item})
    return result


def _effective_definition(defn: dict[str, Any], parameters: dict[str, Any]) -> dict[str, Any]:
    resolved = copy.deepcopy(defn)
    props = resolved.setdefault("properties", {})
    props["policyRule"] = _resolve_parameters(props.get("policyRule") or {}, parameters)
    normalized = {key.lower(): value for key, value in parameters.items()}
    for key, item in (props.get("parameters") or {}).items():
        if key.lower() in normalized:
            item["defaultValue"] = normalized[key.lower()]
    return resolved


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

    Prefer the explicit Modify operation over applicability conditions.
    Multiple targets are unresolved by this single-property contract.
    Without operations, use typed fields from the applicability rule before
    falling back to tag semantics. DINE templates are not property assignments.
    """
    rule = (defn.get("properties") or {}).get("policyRule") or {}

    then = rule.get("then") or {}
    operations = (then.get("details") or {}).get("operations")
    operation_fields = []
    if operations is not None:
        if not isinstance(operations, list) or not operations:
            return {"azurePropertyPath": "", "bicepPropertyPath": ""}
        for operation in operations:
            field = operation.get("field") if isinstance(operation, dict) else None
            if not isinstance(field, str) or not field:
                return {"azurePropertyPath": "", "bicepPropertyPath": ""}
            if field not in operation_fields:
                operation_fields.append(field)
        if len(operation_fields) != 1:
            return {"azurePropertyPath": "", "bicepPropertyPath": ""}

    tag_operation = bool(operation_fields and operation_fields[0].lower().startswith("tags["))
    if tag_operation or (not operation_fields and not resource_types and _looks_like_tag_policy(rule)):
        return {
            "azurePropertyPath": "resourceGroup.tags",
            "bicepPropertyPath": "resourceGroups::tags",
            "pathSemantics": "tag-policy-non-property",
        }

    if not resource_types:
        return {"azurePropertyPath": "", "bicepPropertyPath": ""}

    primary_type = resource_types[0]
    if operation_fields:
        matches = [kind for kind in resource_types if operation_fields[0].lower().startswith(kind.lower() + "/")]
        if not matches:
            return {"azurePropertyPath": "", "bicepPropertyPath": ""}
        primary_type = max(matches, key=len)

    candidate_fields: list[str] = []
    stack = [rule.get("if")]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            f = node.get("field")
            if isinstance(f, str) and f.startswith(primary_type + "/"):
                candidate_fields.append(f)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)

    if operation_fields:
        candidate_fields = [primary_type + "/" + operation_fields[0][len(primary_type) + 1:]]

    if not candidate_fields:
        if not operation_fields and _looks_like_tag_policy(rule):
            return {
                "azurePropertyPath": "resourceGroup.tags",
                "bicepPropertyPath": "resourceGroups::tags",
                "pathSemantics": "tag-policy-non-property",
            }
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


def _build_exemption_map(exemptions: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Retain every exemption and its scope for each assignment."""
    out: dict[str, list[dict[str, Any]]] = {}
    for ex in exemptions:
        props = ex.get("properties") or {}
        aid = (props.get("policyAssignmentId") or "").lower()
        if not aid:
            continue
        exemption_id = ex.get("id") or ""
        scope = exemption_id.lower().rsplit("/providers/microsoft.authorization/policyexemptions/", 1)[0]
        out.setdefault(aid, []).append({
            "id": exemption_id,
            "scope": scope,
            "exemptionCategory": props.get("exemptionCategory"),
            "expiresOn": props.get("expiresOn"),
            "description": props.get("description"),
            "policyDefinitionReferenceIds": props.get("policyDefinitionReferenceIds") or [],
            "resourceSelectors": props.get("resourceSelectors") or [],
        })
    for candidates in out.values():
        candidates.sort(key=lambda candidate: json.dumps(candidate, sort_keys=True))
    return out


def _covering_exemption(
    candidates: list[dict[str, Any]], subscription_id: str, assignment_scope: str,
    member_ref_id: str | None, now: datetime,
) -> dict[str, Any] | None:
    target_scope = f"/subscriptions/{subscription_id}".lower()
    for candidate in candidates:
        if candidate["exemptionCategory"] not in {"Waiver", "Mitigated"} or candidate["resourceSelectors"]:
            continue
        scope = candidate["scope"].rstrip("/")
        if scope != target_scope and not (
            scope == assignment_scope.lower().rstrip("/")
            and re.fullmatch(r"/providers/microsoft.management/managementgroups/[^/]+", scope)
        ):
            continue
        ref_ids = candidate["policyDefinitionReferenceIds"]
        if ref_ids and member_ref_id not in ref_ids:
            continue
        expiry = candidate["expiresOn"]
        if expiry is not None:
            try:
                expires_at = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                continue
            if expires_at.tzinfo is None or expires_at <= now:
                continue
        return candidate
    return None


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


def _has_location_condition(condition: Any) -> bool:
    if isinstance(condition, dict):
        return condition.get("field", "").lower() == "location" or any(
            _has_location_condition(value) for value in condition.values()
        )
    if isinstance(condition, list):
        return any(_has_location_condition(child) for child in condition)
    return False


def _location_constraint(condition: Any) -> tuple[list[str] | None, bool]:
    if not isinstance(condition, dict):
        return None, False
    if condition.get("field") == "location" and isinstance(condition.get("notIn"), list):
        values = condition["notIn"]
        if all(isinstance(value, str) and value and not value.startswith("[") for value in values):
            return sorted({value.lower() for value in values}), True
    if set(condition) == {"not"}:
        inner = condition["not"]
        if isinstance(inner, dict) and set(inner) == {"field", "in"}:
            return _location_constraint({"field": inner["field"], "notIn": inner["in"]})
    if set(condition) == {"allOf"} and isinstance(condition["allOf"], list):
        constraints = []
        universal = True
        for child in condition["allOf"]:
            locations, applies_globally = _location_constraint(child)
            if locations is not None:
                constraints.append(set(locations))
            elif child not in (
                {"field": "location", "notEquals": "global"},
                {"field": "type", "notEquals": "Microsoft.Resources/deployments"},
            ):
                universal = False
            if locations is not None and not applies_globally:
                universal = False
        if constraints:
            return sorted(set.union(*constraints)), universal
    return None, False


def _extract_allowed_locations(findings: list[dict[str, Any]]) -> list[str]:
    """Intersect only proven subscription-wide, enforced Deny allowlists."""
    if any("location_constraint_global" in finding and not finding["location_constraint_global"]
           and finding.get("classification") == "blocker" for finding in findings):
        return []
    constraints = [set(finding["required_value"]) for finding in findings
                   if finding.get("location_constraint_global") and finding.get("classification") == "blocker"]
    return sorted(set.intersection(*constraints)) if constraints else []


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
    expected_assignments: list[dict[str, Any]] | None = None,
    *,
    scope_filter: str = "atScope()",
) -> tuple[bool, int]:
    """Re-fetch all assignment pages and compare inventory and count.

    Returns (ok, actual_count). On any network/parse failure, returns
    (False, -1) so the caller can downgrade `discovery_status` to
    `PARTIAL` without crashing.
    """
    try:
        url = (
            f"{ARM}/subscriptions/{subscription_id}/providers/Microsoft.Authorization/"
            f"policyAssignments?$filter={scope_filter}&api-version={API_ASSIGNMENTS}"
        )
        items = _list_all(az_rest, url)
        same_inventory = expected_assignments is None or sorted(
            json.dumps(item, sort_keys=True) for item in items
        ) == sorted(json.dumps(item, sort_keys=True) for item in expected_assignments)
        return len(items) == expected_count and same_inventory, len(items)
    except Exception:  # noqa: BLE001 — self-check must never crash discovery
        return False, -1


# --------------------------------------------------------------------------- #
# Core                                                                        #
# --------------------------------------------------------------------------- #

_CALLER_IDENTITY_EXPR_RE = re.compile(
    r"(?:"
    r"requestContext\s*\(\s*\)\s*\.\s*identity\b"
    r"|requestContext\s*\(\s*\)\s*\[\s*['\"]identity['\"]\s*\]"
    r"|tryGet\s*\(\s*requestContext\s*\(\s*\)\s*,\s*['\"]identity['\"]\s*\)"
    r")",
    re.IGNORECASE,
)
_DISALLOWED_POLICY_FN_RE = re.compile(
    r"\b(?:field|resourceGroup|subscription|tenant|policy|deployment)\s*\(",
    re.IGNORECASE,
)
_CURRENT_FN_RE = re.compile(r"\bcurrent\s*\(\s*(?:['\"]([^'\"]+)['\"])?\s*\)", re.IGNORECASE)
_ANY_REQUEST_CONTEXT_RE = re.compile(r"\brequestContext\b", re.IGNORECASE)
_CONDITION_OPERATORS_LOWER = {
    "equals",
    "notequals",
    "like",
    "notlike",
    "match",
    "matchinsensitively",
    "notmatch",
    "notmatchinsensitively",
    "contains",
    "notcontains",
    "in",
    "notin",
    "containskey",
    "notcontainskey",
    "less",
    "lessorequals",
    "greater",
    "greaterorequals",
    "exists",
}


def _inspect_identity_value(value: Any, bound_count_names: frozenset[str] = frozenset()) -> tuple[bool, bool]:
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed.startswith("[") and not trimmed.startswith("[[") and trimmed.endswith("]"):
            if _DISALLOWED_POLICY_FN_RE.search(trimmed):
                return False, False
            for current_match in _CURRENT_FN_RE.finditer(trimmed):
                name = (current_match.group(1) or "default").lower()
                if name not in bound_count_names:
                    return False, False
            has_identity = bool(_CALLER_IDENTITY_EXPR_RE.search(trimmed))
            stripped = _CALLER_IDENTITY_EXPR_RE.sub("", trimmed)
            if _ANY_REQUEST_CONTEXT_RE.search(stripped):
                return False, False
            return True, has_identity
        return True, False
    if value is None or isinstance(value, (bool, int, float)):
        return True, False
    if isinstance(value, list):
        saw_identity = False
        for item in value:
            ok, item_saw = _inspect_identity_value(item, bound_count_names)
            if not ok:
                return False, False
            saw_identity = saw_identity or item_saw
        return True, saw_identity
    return False, False


def _inspect_identity_condition(
    node: Any,
    bound_count_names: frozenset[str] = frozenset(),
) -> tuple[bool, bool]:
    if not isinstance(node, dict) or not node:
        return False, False
    lower_map = {str(k).lower(): v for k, v in node.items()}
    keys = set(lower_map.keys())
    if "field" in keys:
        return False, False
    if keys in ({"allof"}, {"anyof"}):
        children = next(iter(lower_map.values()))
        if not isinstance(children, list) or not children:
            return False, False
        saw_identity = False
        for child in children:
            ok, child_saw = _inspect_identity_condition(child, bound_count_names)
            if not ok:
                return False, False
            saw_identity = saw_identity or child_saw
        return True, saw_identity
    if keys == {"not"}:
        return _inspect_identity_condition(lower_map["not"], bound_count_names)
    if "count" in keys:
        op_keys = keys - {"count"}
        count_obj = lower_map["count"]
        if len(op_keys) != 1 or next(iter(op_keys)) not in _CONDITION_OPERATORS_LOWER or not isinstance(count_obj, dict):
            return False, False
        count_lower = {str(k).lower(): v for k, v in count_obj.items()}
        if "field" in count_lower or "value" not in count_lower or not (set(count_lower.keys()) <= {"value", "name", "where"}):
            return False, False
        ok_val, saw_val = _inspect_identity_value(count_lower["value"], bound_count_names)
        if not ok_val:
            return False, False
        op_key = next(iter(op_keys))
        ok_op, saw_op = _inspect_identity_value(lower_map[op_key], bound_count_names)
        if not ok_op:
            return False, False
        saw_where = False
        if "where" in count_lower:
            count_name = count_lower.get("name")
            next_bound = bound_count_names | {str(count_name if isinstance(count_name, str) and count_name else "default").lower()}
            ok_where, saw_where = _inspect_identity_condition(count_lower["where"], next_bound)
            if not ok_where:
                return False, False
        return True, saw_val or saw_op or saw_where
    if "value" in keys:
        op_keys = keys - {"value"}
        if len(op_keys) != 1 or next(iter(op_keys)) not in _CONDITION_OPERATORS_LOWER:
            return False, False
        ok_val, saw_val = _inspect_identity_value(lower_map["value"], bound_count_names)
        if not ok_val:
            return False, False
        op_key = next(iter(op_keys))
        ok_op, saw_op = _inspect_identity_value(lower_map[op_key], bound_count_names)
        if not ok_op:
            return False, False
        return True, saw_val or saw_op
    return False, False


def _is_caller_identity_only(defn: dict[str, Any]) -> bool:
    """Return True iff policyRule.if evaluates only requestContext().identity predicates."""
    condition = ((defn.get("properties") or {}).get("policyRule") or {}).get("if")
    ok, saw_identity = _inspect_identity_condition(condition)
    return bool(ok and saw_identity)


def _classify(effect: str, *, identity_only: bool = False) -> str:
    if effect in BLOCKER_EFFECTS:
        return "caller-identity" if identity_only else "blocker"
    if effect in AUTO_REMEDIATE_EFFECTS:
        return "auto-remediate"
    return "informational"


def _assignment_members(
    assignment: dict[str, Any],
    definitions: dict[str, dict[str, Any]],
    initiatives: dict[str, dict[str, Any]],
    unresolved: list[str],
) -> list[tuple[dict[str, Any], str | None, dict[str, Any]]]:
    props = assignment.get("properties") or {}
    policy_id = (props.get("policyDefinitionId") or "").lower()
    members = []
    if "/policysetdefinitions/" in policy_id and policy_id in initiatives:
        initiative = initiatives[policy_id]
        parameters = _effective_parameters(initiative, props.get("parameters") or {})
        entries = (initiative.get("properties") or {}).get("policyDefinitions") or []
        if not entries:
            unresolved.append(policy_id)
        for entry in entries:
            definition_id = (entry.get("policyDefinitionId") or "").lower()
            if definition_id in definitions:
                supplied = _resolve_parameters(entry.get("parameters") or {}, parameters)
                members.append((definitions[definition_id], entry.get("policyDefinitionReferenceId"), supplied))
            else:
                unresolved.append(definition_id or policy_id)
    elif policy_id in definitions:
        members.append((definitions[policy_id], None, props.get("parameters") or {}))
    else:
        unresolved.append(policy_id or assignment.get("id") or "")
    return members


def _rule_record(assignment: dict, definition: dict, member: str | None, supplied: dict) -> dict:
    parameters = _effective_parameters(definition, supplied)
    effective = _effective_definition(definition, parameters)
    rule = (effective.get("properties") or {}).get("policyRule")
    original_rule = (definition.get("properties") or {}).get("policyRule")
    if isinstance(rule, dict) and isinstance(original_rule, dict):
        original_then = original_rule.get("then")
        details = original_then.get("details") if isinstance(original_then, dict) else None
        deployment = details.get("deployment") if isinstance(details, dict) else None
        properties = deployment.get("properties") if isinstance(deployment, dict) else None
        if isinstance(properties, dict) and "template" in properties:
            # Embedded ARM templates have their own parameter namespace.
            rule["then"]["details"]["deployment"]["properties"]["template"] = copy.deepcopy(properties["template"])
    return {
        "assignment_id": assignment["id"],
        "policy_definition_id": definition["id"],
        "policy_definition_reference_id": member,
        "supplied_parameters": copy.deepcopy(supplied),
        "effective_parameters": parameters,
        "policy_rule": rule,
        "effect": _effect_of(effective),
    }


def _rule_coverage(assignments: list, records: list) -> dict:
    return {
        "assignment_count": len(assignments),
        "effective_record_count": len(records),
        "effects": dict(sorted(Counter(str(record["effect"] or "Unresolved") for record in records).items())),
    }


def rule_evidence_digest(evidence: dict) -> str:
    """Bind the complete retained object, independently of the legacy finding signature."""
    raw = json.dumps(evidence, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def rule_evidence_errors(envelope: dict) -> list[str]:
    """Validate full-rule coverage and replay parameter lineage without Azure calls."""
    evidence = envelope.get("rule_evidence")
    if not isinstance(evidence, dict):
        return ["Full policy-rule evidence is missing; an authorized refresh is required"]
    try:
        if (
            evidence.get("schema_version") != "policy-rule-evidence-v1"
            or any(evidence.get(key) != envelope.get(key) for key in ("project", "subscription_id", "discovered_at"))
            or envelope.get("discovery_options") != {"include_defender_auto": True}
            or (envelope.get("discovery_metadata") or {}).get("rule_evidence_sha256") != rule_evidence_digest(evidence)
            or (envelope.get("discovery_metadata") or {}).get("discovered_at") != envelope.get("discovered_at")
            or (envelope.get("discovery_metadata") or {}).get("discovery_status") != envelope.get("discovery_status")
            or (envelope.get("discovery_metadata") or {}).get("scope", {}).get("subscription_id")
            != envelope.get("subscription_id")
        ):
            return ["Policy-rule evidence identity, coverage options or digest does not match"]
        groups = {}
        for key in ("assignments", "definitions", "initiatives", "exemptions"):
            items = evidence.get(key)
            if not isinstance(items, list) or any(
                not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]
                for item in items
            ):
                return ["Policy-rule evidence requires complete raw object inventories"]
            groups[key] = {item["id"].lower(): item for item in items}
            if len(groups[key]) != len(items):
                return ["Policy-rule evidence contains duplicate object identities"]
        counts = (envelope.get("discovery_metadata") or {}).get("page_counts") or {}
        for key, surface in (
            ("assignments", "policyAssignments"), ("definitions", "policyDefinitions"),
            ("initiatives", "policySetDefinitions"), ("exemptions", "policyExemptions"),
        ):
            if len(evidence[key]) != counts.get(surface):
                return ["Retained raw object counts differ from the actual discovery inventory"]
        expected = []
        unresolved = []
        for assignment in evidence["assignments"]:
            for definition, member, supplied in _assignment_members(
                assignment, groups["definitions"], groups["initiatives"], unresolved
            ):
                record = _rule_record(assignment, definition, member, supplied)
                rule = record["policy_rule"]
                if (
                    not record["effect"] or not isinstance(rule, dict)
                    or not isinstance(rule.get("if"), dict) or not isinstance(rule.get("then"), dict)
                ):
                    return ["An effective policy has no complete resolvable if/then rule"]
                details = rule["then"].get("details")
                if record["effect"] == "Append" and (
                    not isinstance(details, list) or any(
                        not isinstance(entry, dict)
                        or not isinstance(entry.get("field"), str)
                        or not entry["field"].strip()
                        or "value" not in entry
                        for entry in details
                    )
                ):
                    return ["An Append rule requires object entries with a nonempty field and a value key"]
                if record["effect"] in {"DeployIfNotExists", "Modify", "AuditIfNotExists"}:
                    if not isinstance(details, dict):
                        return ["An effective policy is missing its full then.details"]
                    if record["effect"] == "DeployIfNotExists" and not isinstance(details.get("deployment"), dict):
                        return ["A DeployIfNotExists rule is missing its deployment body"]
                    if record["effect"] == "Modify" and not isinstance(details.get("operations"), list):
                        return ["A Modify rule is missing its operations array"]
                expected.append(record)
        if unresolved or evidence.get("effective_records") != expected:
            return ["Effective rule records do not cover the raw assignment/member/parameter lineage"]
        summary = envelope.get("discovery_summary") or {}
        if (
            evidence.get("coverage") != _rule_coverage(evidence["assignments"], expected)
            or len(evidence["assignments"]) != summary.get("assignment_total")
            or len(evidence["assignments"]) != summary.get("assignment_kept")
            or sum(record["effect"] in {"Audit", "AuditIfNotExists"} for record in expected) != summary.get("audit_count")
            or sum(record["effect"] == "Disabled" for record in expected) != summary.get("disabled_count")
        ):
            return ["Retained rule coverage differs from the collected inventory and effect counts"]
    except (KeyError, TypeError, AttributeError, ValueError):
        return ["Malformed policy-rule evidence cannot establish semantic coverage"]
    return []


def private_rule_output(path: Path) -> None:
    """Require an existing owner-only directory outside Git before reading or writing raw rules."""
    if os.name != "posix":
        raise ValueError("Owner-only policy-rule retention requires a POSIX private store")
    target = path.absolute()
    repository = Path(__file__).resolve().parents[4]
    if (
        target != path.resolve()
        or target.is_relative_to(repository)
        or any((parent / ".git").exists() for parent in target.parents)
    ):
        raise ValueError("Full policy-rule evidence must stay outside repositories without symlinks")
    parent = target.parent
    metadata = parent.stat()
    if not parent.is_dir() or metadata.st_mode & 0o077 or metadata.st_uid != os.getuid():
        raise ValueError("Full policy-rule evidence requires an owner-only private directory")
    for candidate in (target, target.with_suffix(".preview.md")):
        if candidate.exists() or candidate.is_symlink():
            metadata = candidate.lstat()
            if (
                candidate.is_symlink() or not candidate.is_file()
                or metadata.st_mode & 0o077 or metadata.st_uid != os.getuid() or metadata.st_nlink != 1
            ):
                raise ValueError("Full policy-rule evidence requires owner-only regular files")


def write_private_rule_envelope(path: Path, envelope: dict) -> None:
    """Atomically persist raw evidence without publishing a partially written snapshot."""
    private_rule_output(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(envelope, stream, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def discover(
    subscription_id: str,
    *,
    project: str,
    include_defender_auto: bool = True,
    az_rest: Callable[[str], dict[str, Any]] | None = None,
    verbose: bool = False,
    retain_rule_evidence: bool = False,
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
    unresolved_scope_entries: list[dict[str, Any]] = []
    assignments_filter = "atScope()"
    assignments_url = f"{base}/policyAssignments?$filter={assignments_filter}&api-version={API_ASSIGNMENTS}"
    sub_list_urls = {
        "sub_defs": f"{base}/policyDefinitions?api-version={API_DEFINITIONS}",
        "sub_sets": f"{base}/policySetDefinitions?api-version={API_DEFINITIONS}",
        "exemptions": f"{base}/policyExemptions?$filter=atScope()&api-version={API_EXEMPTIONS}",
    }
    try:
        primary = _parallel_list(az_rest, {"assignments": assignments_url, **sub_list_urls})
        assignments = primary["assignments"]
    except Exception as exc:
        mg_info = (
            _parse_mg_scope(assignments_url, str(exc), subscription_id=subscription_id, default_surface="policyAssignments")
            if _http_status_code(exc) == 403
            else None
        )
        if mg_info is None:
            raise
        unresolved_scope_entries.append(
            {
                "reason": "ancestor_scope_forbidden",
                "scope": mg_info["scope"],
                "management_group": mg_info["management_group"],
                "surface": "policyAssignments",
                "resource_id": mg_info["resource_id"],
                "http_status": 403,
            }
        )
        assignments_filter = "atExactScope()"
        primary = _parallel_list(
            az_rest,
            {
                "assignments": f"{base}/policyAssignments?$filter={assignments_filter}&api-version={API_ASSIGNMENTS}",
                **sub_list_urls,
            },
        )
        assignments = primary["assignments"]

    raw_assignments = list(assignments)
    assignments = list(raw_assignments)
    defs: dict[str, dict[str, Any]] = {d["id"].lower(): d for d in primary["sub_defs"]}
    sets: dict[str, dict[str, Any]] = {s["id"].lower(): s for s in primary["sub_sets"]}
    exemptions = primary["exemptions"]

    # Hydrate any assignment stubs missing policyDefinitionId (for example,
    # ancestor management-group assignment references requiring an individual GET).
    stub_indices = [
        idx
        for idx, a in enumerate(assignments)
        if a.get("id") and not ((a.get("properties") or {}).get("policyDefinitionId"))
    ]
    if stub_indices:
        stub_ids = [str(assignments[idx]["id"]) for idx in stub_indices]
        hydrated = _parallel_fetch_items(
            az_rest,
            [f"{ARM}{aid}?api-version={API_ASSIGNMENTS}" for aid in stub_ids],
            expected_ids=stub_ids,
            forbidden_out=unresolved_scope_entries,
            default_surface="policyAssignments",
        )
        for idx, item in zip(stub_indices, hydrated, strict=True):
            if item is not None:
                assignments[idx] = item

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
        if not pid:
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
            forbidden_out=unresolved_scope_entries,
            default_surface="policySetDefinitions",
        )
        for s in fetched_sets:
            if s:
                sets.setdefault((s.get("id") or "").lower(), s)

    for policy_set in sets.values():
        for member in (policy_set.get("properties") or {}).get("policyDefinitions") or []:
            member_id = member.get("policyDefinitionId") or ""
            if member_id and member_id.lower() not in defs:
                tenant_def_ids.setdefault(member_id.lower(), member_id)

    if tenant_def_ids:
        ordered = sorted(tenant_def_ids.items())
        fetched_defs = _parallel_fetch_items(
            az_rest,
            [f"{ARM}{orig}?api-version={API_DEFINITIONS}" for _, orig in ordered],
            expected_ids=[orig for _, orig in ordered],
            forbidden_out=unresolved_scope_entries,
            default_surface="policyDefinitions",
        )
        for d in fetched_defs:
            if d:
                defs.setdefault((d.get("id") or "").lower(), d)

    forbidden_ids = {
        str(entry.get("resource_id", "")).lower()
        for entry in unresolved_scope_entries
        if entry.get("reason") == "ancestor_scope_forbidden"
    }

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
    effective_records: list[dict[str, Any]] = []
    audit_count = 0
    disabled_count = 0
    unresolved: list[str] = []
    evaluated_at = datetime.now(UTC)

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
            unresolved.append(assignment_id)
            if assignment_id not in forbidden_ids:
                meta = _scope_metadata_for_id(a.get("id") or "", subscription_id, fallback_scope=scope)
                unresolved_scope_entries.append({"reason": "missing_policy_definition_id", **meta})
            continue

        # Resolve to member definitions (initiative → its members; policy → itself).
        before_unresolved = len(unresolved)
        members = _assignment_members(a, defs, sets, unresolved)
        for uid in unresolved[before_unresolved:]:
            if uid.lower() in forbidden_ids:
                continue
            reason = (
                "empty_initiative_members"
                if "/policysetdefinitions/" in uid.lower() and uid.lower() in sets
                else "definition_not_found"
            )
            meta = _scope_metadata_for_id(uid, subscription_id, fallback_scope=scope)
            unresolved_scope_entries.append({"reason": reason, **meta})

        for original_defn, member_ref_id, supplied in members:
            if retain_rule_evidence:
                effective_records.append(_rule_record(a, original_defn, member_ref_id, supplied))
            effective_parameters = _effective_parameters(original_defn, supplied)
            defn = _effective_definition(original_defn, effective_parameters)
            eff = _effect_of(defn)
            if eff is None:
                uid = original_defn.get("id") or pid
                unresolved.append(uid)
                meta = _scope_metadata_for_id(uid, subscription_id, fallback_scope=scope)
                unresolved_scope_entries.append({"reason": "unresolved_effect", **meta})
                continue
            if eff == "Disabled":
                disabled_count += 1
                continue
            if eff in {"Audit", "AuditIfNotExists"}:
                audit_count += 1
                continue
            if eff not in RELEVANT_EFFECTS:
                if eff not in {"Append", "enforceSetting"}:
                    uid = original_defn.get("id") or pid
                    unresolved.append(uid)
                    meta = _scope_metadata_for_id(uid, subscription_id, fallback_scope=scope)
                    unresolved_scope_entries.append({"reason": "unresolved_effect", **meta})
                continue

            rtypes = _resource_types(defn)
            paths = _property_paths(defn, rtypes)
            category = ((defn.get("properties") or {}).get("metadata") or {}).get(
                "category"
            ) or "Uncategorized"

            exemption_candidates = exemption_map.get(assignment_id, [])
            exemption = _covering_exemption(exemption_candidates, subscription_id, scope, member_ref_id, evaluated_at)

            identity_only = _is_caller_identity_only(defn) if eff in BLOCKER_EFFECTS else False
            classification = _classify(eff, identity_only=identity_only)
            if exemption is not None and classification in {"blocker", "caller-identity"}:
                classification = "informational"
            if props.get("enforcementMode") == "DoNotEnforce":
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
                "policy_definition_reference_id": member_ref_id,
                "not_scopes": props.get("notScopes") or [],
                "resource_selectors": props.get("resourceSelectors") or [],
                "enforcement_mode": props.get("enforcementMode") or "Default",
                "classification": classification,
                "category": category,
                "resource_types": rtypes,
                "required_value": _required_value(defn),
                "azurePropertyPath": paths.get("azurePropertyPath"),
                "bicepPropertyPath": paths.get("bicepPropertyPath"),
                "exemption": exemption,
                "override": None,
            }
            if identity_only:
                finding["identity_only"] = True
            if exemption_candidates:
                finding["exemption_candidates"] = exemption_candidates
            condition = ((defn.get("properties") or {}).get("policyRule") or {}).get("if")
            locations, universal = _location_constraint(condition)
            if locations is not None or _has_location_condition(condition):
                if locations is not None:
                    finding["required_value"] = locations
                finding["location_condition"] = condition
                finding["location_constraint_global"] = bool(
                    universal and not rtypes and not finding["not_scopes"] and not finding["resource_selectors"]
                    and (scope.lower().rstrip("/") == f"/subscriptions/{subscription_id}".lower()
                         or re.fullmatch(r"/providers/microsoft.management/managementgroups/[^/]+", scope.lower()))
                )
            # Carry assignment-level parameter values (tag keys, location lists).
            if effective_parameters:
                finding["assignment_parameters"] = effective_parameters
            if paths.get("pathSemantics"):
                finding["pathSemantics"] = paths["pathSemantics"]
            if condition is not None and finding.get("required_value") is None:
                finding["policy_rule_if"] = condition
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
    caller_identity = sum(1 for f in findings if f["classification"] == "caller-identity")
    auto_remediate = sum(1 for f in findings if f["classification"] == "auto-remediate")
    exempted = sum(1 for f in findings if f["exemption"] is not None)

    # L0 envelope: signature, scope, and self-check.
    management_groups = _extract_management_groups(kept_assignments)
    for policy_id in sorted(set(unresolved)):
        print(f"unresolved policy definition or effect: {policy_id}", file=sys.stderr)
    self_check_ok, self_check_count = _self_check_assignments(
        az_rest,
        subscription_id,
        len(raw_assignments),
        raw_assignments,
        scope_filter=assignments_filter,
    )
    if not self_check_ok:
        unresolved_scope_entries.append(
            {
                "reason": "assignment_inventory_drift",
                "scope": f"/subscriptions/{subscription_id}",
                "surface": "policyAssignments",
                "resource_id": f"/subscriptions/{subscription_id}",
            }
        )
        print(
            f"self-check: policyAssignments inventory drift "
            f"(expected={len(raw_assignments)}, observed={self_check_count}); "
            f"marking discovery_status=PARTIAL",
            file=sys.stderr,
        )

    unresolved_scopes = _normalize_unresolved_scopes(unresolved_scope_entries)
    for entry in unresolved_scopes:
        if entry.get("reason") == "ancestor_scope_forbidden":
            print(
                f"ancestor management-group scope forbidden (HTTP {entry.get('http_status', 403)}): "
                f"{entry.get('scope')} ({entry.get('surface')}: {entry.get('resource_id')})",
                file=sys.stderr,
            )

    discovery_status = "PARTIAL" if (unresolved or unresolved_scopes or not self_check_ok) else "COMPLETE"

    discovered_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    discovery_metadata = _build_discovery_metadata(
        findings=findings,
        subscription_id=subscription_id,
        management_groups=management_groups,
        page_counts={
            "policyAssignments": len(assignments),
            "policyDefinitions": len(defs),
            "policyExemptions": len(exemptions),
        },
        discovered_at=discovered_at,
        discovery_status=discovery_status,
        source="live",
        unresolved_scopes=unresolved_scopes or None,
    )

    envelope = {
        "schema_version": "governance-constraints-v1",
        "project": project,
        "discovery_options": {"include_defender_auto": include_defender_auto},
        "subscription_id": subscription_id,
        "discovered_at": discovered_at,
        "source": "azure-policy-rest-api",
        "discovery_status": discovery_status,
        "discovery_metadata": discovery_metadata,
        "unresolved_scopes": unresolved_scopes,
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
            "caller_identity_count": caller_identity,
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
        # output. See apex-iac-common/references/policy-precheck-contract.md
        # Phase 3 step 1 for the comparison contract.
        "member_policy_index": sorted(defs.keys()),
        "tags_required": _extract_tags_required(findings),
        "allowed_locations": _extract_allowed_locations(findings),
    }
    if retain_rule_evidence:
        envelope["discovery_metadata"]["page_counts"]["policySetDefinitions"] = len(sets)
        envelope["discovery_metadata"]["api_versions"]["policySetDefinitions"] = API_DEFINITIONS
        envelope["rule_evidence"] = {
            "schema_version": "policy-rule-evidence-v1",
            "project": project,
            "subscription_id": subscription_id,
            "discovered_at": discovered_at,
            "assignments": copy.deepcopy(assignments),
            "definitions": copy.deepcopy(sorted(defs.values(), key=lambda item: item["id"].lower())),
            "initiatives": copy.deepcopy(sorted(sets.values(), key=lambda item: item["id"].lower())),
            "exemptions": copy.deepcopy(exemptions),
            "effective_records": effective_records,
            "coverage": _rule_coverage(kept_assignments, effective_records),
        }
        envelope["discovery_metadata"]["rule_evidence_sha256"] = rule_evidence_digest(envelope["rule_evidence"])
        if rule_evidence_errors(envelope):
            envelope["discovery_status"] = envelope["discovery_metadata"]["discovery_status"] = "PARTIAL"
            if not envelope["unresolved_scopes"]:
                entry = {
                    "reason": "rule_evidence_invalid",
                    "scope": f"/subscriptions/{subscription_id}",
                    "surface": "policyDefinitions",
                    "resource_id": f"/subscriptions/{subscription_id}",
                }
                envelope["unresolved_scopes"] = [entry]
                envelope["discovery_metadata"]["unresolved_scopes"] = [entry]
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
        f"{summary['caller_identity_count']} caller-identity, "
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


def _cache_is_fresh(cached: dict[str, Any], now: datetime | None = None) -> bool:
    metadata = cached.get("discovery_metadata")
    if not isinstance(metadata, dict) or metadata.get("discovery_status") != "COMPLETE":
        return False
    ttl_days = metadata.get("ttl_days")
    if isinstance(ttl_days, bool) or not isinstance(ttl_days, int) or ttl_days <= 0:
        return False
    try:
        discovered_at = datetime.fromisoformat(metadata["discovered_at"].replace("Z", "+00:00"))
    except (KeyError, TypeError, ValueError, AttributeError):
        return False
    if discovered_at.tzinfo is None:
        return False
    evaluated_at = now or datetime.now(UTC)
    for finding in cached.get("findings") or []:
        exemption = finding.get("exemption")
        if exemption is not None:
            try:
                covering = _covering_exemption(
                    [exemption], cached.get("subscription_id", ""), finding.get("scope", ""),
                    finding.get("policy_definition_reference_id"), evaluated_at,
                )
            except (KeyError, TypeError, AttributeError):
                return False
            if covering is None:
                return False
    age = (evaluated_at - discovered_at).total_seconds()
    return 0 <= age <= ttl_days * 86400


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="discover",
        description="Deterministic Azure Policy discovery for 04g-Governance.",
    )
    parser.add_argument("--project", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--subscription", default="default")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--validate-only", action="store_true", help="Validate the exact saved full-coverage snapshot offline")
    parser.add_argument(
        "--retain-rule-evidence", action="store_true",
        help="Retain and validate full policy objects/lineage inside an owner-only snapshot outside Git.",
    )
    parser.add_argument(
        "--arch",
        default=None,
        help="Path to 02-architecture-assessment.md. Enables policy→resource mapping in preview.md.",
    )
    parser.add_argument(
        "--include-defender-auto",
        action="store_true",
        default=True,
        help="Retain Defender-for-Cloud auto-assignments (the full-coverage default).",
    )
    parser.add_argument("--exclude-defender-auto", dest="include_defender_auto", action="store_false",
                        help="Legacy filtered coverage; never equivalent to full collection")
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Emit informational stderr (per-assignment Defender filter announcements). "
        "Aggregate counts are always recorded in discovery_summary regardless.",
    )
    args = parser.parse_args(argv)

    out_path = Path(args.out)
    if args.refresh and not args.retain_rule_evidence and out_path.exists():
        try:
            previous = json.loads(out_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            _emit_status({"status": "FAILED", "error": "existing-output-read"})
            return 2
        if isinstance(previous, dict) and "rule_evidence" in previous:
            _emit_status({"status": "FAILED", "error": "retain-rule-evidence-required"})
            return 2
    if args.retain_rule_evidence:
        try:
            private_rule_output(out_path)
            if not args.include_defender_auto:
                raise ValueError("Full policy-rule evidence requires unfiltered assignment coverage")
        except (OSError, ValueError) as error:
            _emit_status({"status": "FAILED", "error": "private-rule-evidence", "detail": str(error)})
            return 2
    if args.validate_only:
        try:
            cached = json.loads(out_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError):
            _emit_status({"status": "INVALID", "error": "snapshot-read", "read_only": True})
            return 1
        if not isinstance(cached, dict):
            _emit_status({"status": "INVALID", "error": "snapshot-shape", "read_only": True})
            return 1
        if "rule_evidence" in cached:
            try:
                private_rule_output(out_path)
            except (OSError, ValueError) as error:
                _emit_status({"status": "INVALID", "error": "private-rule-evidence", "detail": str(error)})
                return 1
        valid = (
            args.subscription != "default"
            and cached.get("project") == args.project
            and cached.get("subscription_id", "").lower() == args.subscription.lower()
            and cached.get("schema_version") == "governance-constraints-v1"
            and cached.get("discovery_status") == "COMPLETE"
            and cached.get("discovery_options") == {"include_defender_auto": True}
            and _cache_is_fresh(cached)
            and cached.get("discovery_metadata", {}).get("scope", {}).get("subscription_id", "").lower() == args.subscription.lower()
            and cached.get("discovery_metadata", {}).get("completeness_signature") == _completeness_signature(cached.get("findings", []))
            and (not args.retain_rule_evidence and "rule_evidence" not in cached or not rule_evidence_errors(cached))
        )
        _emit_status({"status": "CURRENT" if valid else "INVALID", "read_only": True})
        return 0 if valid else 1

    try:
        sub_id = _default_get_subscription() if args.subscription == "default" else args.subscription
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
        _emit_status({"status": "FAILED", "error": "subscription-resolution", "detail": str(error)})
        print("ERROR: could not resolve subscription via `az account show`.", file=sys.stderr)
        return 2

    # Cache reuse must satisfy the same freshness clock as downstream L0 checks.
    # Formal Step 3.5 (04-governance-constraints.json) may also seed from a current,
    # signature-verified sibling 04-policy-feasibility.json collected in Step 2.
    cache_candidates = [out_path]
    if out_path.name == "04-governance-constraints.json":
        pdir = out_path.parent.parent if out_path.parent.name == "contracts" else out_path.parent
        for candidate in (
            out_path.with_name("04-policy-feasibility.json"),
            pdir / "contracts" / "04-policy-feasibility.json",
            pdir / "04-policy-feasibility.json",
        ):
            if candidate not in cache_candidates:
                cache_candidates.append(candidate)
    if not args.refresh:
        for cache_source in cache_candidates:
            if not cache_source.exists():
                continue
            try:
                cached = json.loads(cache_source.read_text(encoding="utf-8"))
            except (OSError, UnicodeError, json.JSONDecodeError):
                if args.retain_rule_evidence:
                    _emit_status({"status": "FAILED", "error": "policy-rule-evidence-cache-read"})
                    return 2
                continue
            if args.retain_rule_evidence and not isinstance(cached, dict):
                _emit_status({"status": "FAILED", "error": "policy-rule-evidence-cache-shape"})
                return 2
            if isinstance(cached, dict) and (args.retain_rule_evidence or "rule_evidence" in cached):
                errors = rule_evidence_errors(cached)
                if args.retain_rule_evidence and (
                    cached.get("project") != args.project
                    or str(cached.get("subscription_id", "")).lower() != sub_id.lower()
                    or cached.get("discovery_status") != "COMPLETE"
                    or not _cache_is_fresh(cached)
                    or (cached.get("discovery_metadata") or {}).get("completeness_signature")
                    != _completeness_signature(cached.get("findings", []))
                ):
                    errors.append("Private rule evidence is stale, incomplete or differently scoped; authorized refresh required")
                if errors:
                    _emit_status({"status": "FAILED", "error": "policy-rule-evidence", "detail": errors[0]})
                    return 2
                try:
                    private_rule_output(out_path)
                    private_rule_output(cache_source)
                except (OSError, ValueError) as error:
                    _emit_status({"status": "FAILED", "error": "private-rule-evidence", "detail": str(error)})
                    return 2
            if (
                isinstance(cached, dict)
                and cached.get("schema_version") == "governance-constraints-v1"
                and cached.get("project") == args.project
                and str(cached.get("subscription_id", "")).lower() == sub_id.lower()
                and cached.get("discovery_options") == {"include_defender_auto": args.include_defender_auto}
                and cached.get("discovery_status") == "COMPLETE"
                and isinstance(cached.get("findings"), list)
                and _cache_is_fresh(cached)
                and isinstance(cached.get("discovery_metadata"), dict)
                and isinstance(cached["discovery_metadata"].get("scope"), dict)
                and str(cached["discovery_metadata"]["scope"].get("subscription_id", "")).lower() == sub_id.lower()
                and (
                    cache_source == out_path
                    or cached["discovery_metadata"].get("completeness_signature")
                    == _completeness_signature(cached.get("findings", []))
                )
            ):
                if cache_source != out_path:
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    cached["_out_path"] = str(out_path)
                    if "rule_evidence" in cached:
                        try:
                            write_private_rule_envelope(out_path, cached)
                        except (OSError, ValueError):
                            _emit_status({"status": "FAILED", "error": "private-evidence-write"})
                            return 2
                    else:
                        out_path.write_text(json.dumps(cached, indent=2, sort_keys=False) + "\n", encoding="utf-8")
                if args.arch:
                    preview = _emit_preview_md(cached, out_path, arch_resources=_extract_arch_resources(args.arch))
                    if preview and "rule_evidence" in cached:
                        Path(preview).chmod(0o600)
                summary = cached.get("discovery_summary") or {}
                status = {
                    "status": "COMPLETE",
                    "cache_hit": True,
                    "assignment_total": summary.get("assignment_total", 0),
                    "blockers": summary.get("blocker_count", 0),
                    "caller_identity": summary.get("caller_identity_count", 0),
                    "auto_remediate": summary.get("auto_remediate_count", 0),
                    "exempted": summary.get("exempted_count", 0),
                    "out_path": str(out_path),
                }
                _emit_status(status)
                print(
                    f"cache hit: reusing {cache_source} ({len(cached.get('findings', []))} findings; "
                    f"pass --refresh to re-discover)"
                )
                return 0

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
            retain_rule_evidence=args.retain_rule_evidence,
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
    if args.retain_rule_evidence:
        try:
            write_private_rule_envelope(out_path, envelope)
        except (OSError, ValueError):
            _emit_status({"status": "FAILED", "error": "private-evidence-write"})
            return 2
    else:
        out_path.write_text(json.dumps(envelope, indent=2, sort_keys=False) + "\n")

    # Fix C: emit sibling preview.md for agent annotation
    arch_resources = _extract_arch_resources(args.arch) if args.arch else None
    preview_path = _emit_preview_md(envelope, out_path, arch_resources=arch_resources)
    if preview_path:
        if args.retain_rule_evidence:
            Path(preview_path).chmod(0o600)
        print(f"preview: wrote {preview_path}", file=sys.stderr)

    summary = envelope["discovery_summary"]
    status: dict[str, Any] = {
        "status": envelope["discovery_status"],
        "cache_hit": False,
        "assignment_total": summary["assignment_total"],
        "blockers": summary["blocker_count"],
        "caller_identity": summary["caller_identity_count"],
        "auto_remediate": summary["auto_remediate_count"],
        "exempted": summary["exempted_count"],
        "out_path": str(out_path),
    }
    if envelope.get("unresolved_scopes"):
        status["unresolved_scopes"] = envelope["unresolved_scopes"]
    _emit_status(status)
    if not args.retain_rule_evidence:
        _emit_preview(envelope)
    return 0 if envelope["discovery_status"] == "COMPLETE" else 1


if __name__ == "__main__":
    sys.exit(main())
