#!/usr/bin/env python3
# ruff: noqa: E501
"""Shared governance preview renderer.

Extracted from discover.py so both live discovery and cached-baseline
rendering use the same artifact generator. This module has NO Azure
dependencies — it only reads an in-memory governance-constraints-v1
envelope and writes Markdown.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# --------------------------------------------------------------------------- #
# Shared L0 envelope helpers                                                  #
#                                                                             #
# These are the canonical implementations consumed by BOTH discover.py        #
# (live path) and render_cached_governance.py (cached baseline path). The     #
# `completeness_signature` MUST be byte-identical for the same upstream       #
# findings set across both paths — that invariant is the foundation of the    #
# Phase 4 resume short-circuit + Phase 8 challenger guard, and is regression  #
# tested in `test_signature_parity.py`.                                       #
# --------------------------------------------------------------------------- #

# L0 envelope: staleness threshold (days). Downstream consumers (Planner,
# CodeGen, Deploy) treat envelopes older than this as STALE and refuse to
# proceed without a fresh `--refresh` discovery.
DEFAULT_TTL_DAYS = 7

# API versions emitted into discovery_metadata.api_versions. Keep in sync
# with the ARM REST calls in discover.py — these constants are the single
# source of truth for both the live path and any cached-baseline synthesis
# that needs to claim the version it was originally collected against.
API_ASSIGNMENTS = "2022-06-01"
API_DEFINITIONS = "2021-06-01"
API_EXEMPTIONS = "2022-07-01-preview"


def _completeness_signature(findings: list[dict[str, Any]]) -> str:
    """Return a deterministic sha256 over the stable-sorted policy tuples.

    The signature is the L0 attestation used by downstream consumers
    (Planner, CodeGen, Deploy) to detect that a constraints file has
    drifted from the snapshot they validated against. Algorithm:

    1. Build `(policy_id, effect, scope, params)` tuples for each finding.
    2. Sort by `policy_id`.
    3. Serialise each tuple as a compact JSON object with sorted keys.
    4. Join with `\\n` and sha256.
    """
    tuples: list[dict[str, Any]] = []
    for f in findings:
        tuples.append(
            {
                "policy_id": f.get("policy_id") or "",
                "effect": f.get("effect") or "",
                "scope": f.get("scope") or "",
                "params": f.get("assignment_parameters") or {},
            }
        )
    tuples.sort(key=lambda t: t["policy_id"])
    serialized = "\n".join(json.dumps(t, sort_keys=True, separators=(",", ":")) for t in tuples)
    return "sha256:" + hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _extract_management_groups(kept_assignments: list[dict[str, Any]]) -> list[str]:
    """Return MG ancestry referenced by kept assignment scopes (ordered)."""
    seen: dict[str, None] = {}
    for a in kept_assignments:
        scope = ((a.get("properties") or {}).get("scope") or "").lower()
        marker = "/providers/microsoft.management/managementgroups/"
        if marker not in scope:
            continue
        mg = scope.split(marker, 1)[1].split("/", 1)[0]
        if mg and mg not in seen:
            seen[mg] = None
    return list(seen.keys())


def _build_discovery_metadata(
    *,
    findings: list[dict[str, Any]],
    subscription_id: str,
    management_groups: list[str],
    page_counts: dict[str, int],
    discovered_at: str,
    discovery_status: str = "COMPLETE",
    ttl_days: int = DEFAULT_TTL_DAYS,
    source: str = "live",  # noqa: ARG001 — reserved for future per-source attestation; envelope-level `source` is the consumer-facing field
    api_versions: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Compose the L0 `discovery_metadata` envelope.

    Used by both discover.py (live path, `source="live"`) and the cached
    renderer (`source="github-actions-baseline"`). The returned dict is
    byte-for-byte deterministic given the same inputs — the parity test
    asserts this across both call sites.

    `source` is currently informational; it is parameterised so future
    revisions can record per-attestation provenance without changing
    the helper signature. The envelope's top-level `source` field is
    what consumers actually read today.
    """
    return {
        "discovery_status": discovery_status,
        "discovered_at": discovered_at,
        "scope": {
            "subscription_id": subscription_id,
            "management_groups": list(management_groups),
        },
        "api_versions": dict(
            api_versions
            or {
                "policyAssignments": API_ASSIGNMENTS,
                "policyDefinitions": API_DEFINITIONS,
                "policyExemptions": API_EXEMPTIONS,
            }
        ),
        "page_counts": dict(page_counts),
        "completeness_signature": _completeness_signature(findings),
        "ttl_days": ttl_days,
    }


def _utc_now_iso() -> str:
    """Return the current UTC instant in the ISO-8601 form used by discover.py."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --------------------------------------------------------------------------- #
# Preview renderer (Markdown generation)                                      #
# --------------------------------------------------------------------------- #


def _infer_project_from_path(out_path: Path) -> str:
    """Infer project name from the output path (e.g. agent-output/test/04-...).

    Falls back to 'unknown' if the path doesn't match the expected structure.
    """
    # Expect: .../agent-output/{project}/04-governance-constraints.json
    parts = out_path.parts
    for i, p in enumerate(parts):
        if p == "agent-output" and i + 1 < len(parts):
            return parts[i + 1]
    return "unknown"


def _split_tags(tags_required: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Split tags into resolved and unresolved lists.

    Resolved tags have actual key names (e.g. 'Environment').
    Unresolved tags carry '[unresolved: ...]' markers from the collector.
    """
    resolved = []
    unresolved = []
    for t in tags_required:
        name = t.get("name", "")
        if t.get("unresolved") or name.startswith("[unresolved"):
            # Try to extract parameter-based tag names from assignment_parameters
            params = t.get("assignment_parameters", {})
            tag_params = {k: v for k, v in params.items() if k.startswith("tagName") and isinstance(v, str)}
            if tag_params:
                for _key, tag_name in sorted(tag_params.items()):
                    resolved.append({"name": tag_name, **{k: v for k, v in t.items() if k != "name"}})
            else:
                unresolved.append(t)
        else:
            resolved.append(t)
    return resolved, unresolved


def _extract_constraint_value(finding: dict[str, Any]) -> str | None:
    """Extract the actual constraint value from assignment_parameters or required_value.

    Returns a human-readable string summarising the constraint, or None.
    """
    # Prefer explicit required_value if present (including boolean False)
    rv = finding.get("required_value")
    if rv is not None and rv != "":
        if isinstance(rv, bool):
            return str(rv).lower()
        if isinstance(rv, list):
            return ", ".join(str(v) for v in rv[:20])
        return str(rv)

    params = finding.get("assignment_parameters") or {}
    for pname, pval in params.items():
        # Skip effect overrides: "effect", "Effect", "*MonitoringEffect", "*AppMonitoringEffect", etc.
        if pname.lower().endswith("effect"):
            continue
        if isinstance(pval, list) and pval:
            # Truncate to 20 items for readability
            items = [str(v) for v in pval[:20]]
            suffix = f" … +{len(pval) - 20} more" if len(pval) > 20 else ""
            return ", ".join(items) + suffix
        if isinstance(pval, (str, int, float, bool)) and pval not in (None, ""):
            return str(pval)
    return None


def _dedup_blockers(blockers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate blockers that share policy semantics across scopes.

    Returns a list of representative blockers with a 'scopes' list
    and merged assignment_parameters from all instances.
    """
    from collections import OrderedDict
    groups: OrderedDict[tuple[str, str, str], list[dict[str, Any]]] = OrderedDict()
    for b in blockers:
        key = (
            b.get("display_name", ""),
            b.get("policy_id", ""),
            json.dumps(b.get("assignment_parameters") or {}, sort_keys=True, separators=(",", ":")),
        )
        groups.setdefault(key, []).append(b)

    deduped: list[dict[str, Any]] = []
    for _key, items in groups.items():
        rep = dict(items[0])  # shallow copy of first instance
        rep["_scopes"] = [it.get("scope", "") for it in items]
        # Merge assignment_parameters from all instances (first non-empty wins per key)
        merged_params: dict[str, Any] = {}
        for it in items:
            for k, v in (it.get("assignment_parameters") or {}).items():
                if k not in merged_params and v is not None and v != "":
                    merged_params[k] = v
        if merged_params:
            rep["assignment_parameters"] = merged_params
        deduped.append(rep)
    return deduped


def extract_arch_resources(arch_path: str | Path) -> list[dict[str, str]]:
    """Extract Azure resource types from 02-architecture-assessment.md.

    Scans for ARM resource type patterns (Microsoft.{Provider}/{Type}) and
    returns a list of {name, arm_type} dicts. Used to pre-populate
    policy→resource mapping in preview.md.
    """
    arch_path = Path(arch_path)
    if not arch_path.exists():
        return []
    text = arch_path.read_text(errors="replace")
    # Match ARM types like Microsoft.Compute/virtualMachines
    arm_pattern = re.compile(r"Microsoft\.\w+/\w+(?:/\w+)?")
    types_found = sorted(set(arm_pattern.findall(text)))
    # Also extract resource names from Mermaid diagrams or SKU tables
    # Pattern: common name labels like "vm-iis-01", "sql-...", "vnet-..."
    name_pattern = re.compile(r"(?:vm|sql|vnet|kv|st|app|pip|lb|nsg|nic|pe|natgw|log|acr|aks)-[\w-]+", re.IGNORECASE)
    names_found = sorted(set(name_pattern.findall(text)))
    resources: list[dict[str, str]] = []
    for t in types_found:
        resources.append({"arm_type": t, "name": t.split("/")[-1]})
    for n in names_found:
        if not any(r["name"] == n for r in resources):
            resources.append({"arm_type": "", "name": n})
    return resources


def emit_preview_md(envelope: dict[str, Any], out_path: Path, arch_resources: list[dict[str, str]] | None = None) -> Path | None:
    """Write a sibling `.preview.md` with H2 structure matching the template.

    The agent copies this to `04-governance-constraints.md` and annotates
    placeholder sections only — avoiding the slow mega-patch generation.

    If `arch_resources` is provided (from `--arch`), the preview includes a
    pre-populated policy→architecture resource mapping table under
    "Plan Adaptations → Architectural Changes".
    """
    preview_path = out_path.with_suffix(".preview.md")
    project = envelope.get("project") or _infer_project_from_path(out_path)
    summary = envelope.get("discovery_summary", {})
    findings = envelope.get("findings", [])
    tags_required = envelope.get("tags_required", [])
    discovered_at = envelope.get("discovered_at", "")
    has_arch = arch_resources is not None and len(arch_resources) > 0

    # Normalize null property paths to "" (schema requires string, not null)
    for f in findings:
        if f.get("azurePropertyPath") is None:
            f["azurePropertyPath"] = ""
        if f.get("bicepPropertyPath") is None:
            f["bicepPropertyPath"] = ""

    # Deduplicate identical findings (same display_name + scope + policy_id) that arise
    # when the same policy is inherited at multiple MG levels with identical parameters.
    _seen_keys: set[tuple[str, ...]] = set()
    deduped_findings: list[dict[str, Any]] = []
    for f in findings:
        key = (
            f.get("display_name", ""),
            f.get("scope", ""),
            f.get("policy_id", ""),
            json.dumps(f.get("assignment_parameters") or {}, sort_keys=True, separators=(",", ":")),
        )
        if key not in _seen_keys:
            _seen_keys.add(key)
            deduped_findings.append(f)
    findings = deduped_findings

    blockers = [f for f in findings if f.get("classification") == "blocker"]
    auto_remediate = [f for f in findings if f.get("classification") == "auto-remediate"]
    # Group by category for security/network/cost sections
    by_category: dict[str, list[dict[str, Any]]] = {}
    for f in findings:
        cat = (f.get("category") or "Uncategorized").strip()
        by_category.setdefault(cat, []).append(f)

    # Pre-build security list (with keyword expansion) so Discovery Source count is accurate.
    _security_keywords = {"SFI-", "Safe Secrets", "Key Vault", "Purge Protection", "TLS", "HTTPS", "SSL"}
    security: list[dict[str, Any]] = list(by_category.get("Security", []))
    for _f in findings:
        if _f not in security and any(kw in (_f.get("display_name") or "") for kw in _security_keywords):
            security.append(_f)

    lines: list[str] = []
    a = lines.append

    # Header + badge row
    a(f"# 🛡️ Governance Constraints - {project}\n")
    a("![Step](https://img.shields.io/badge/Step-3.5-blue?style=for-the-badge)")
    a("![Status](https://img.shields.io/badge/Status-Discovered-green?style=for-the-badge)")
    a("![Agent](https://img.shields.io/badge/Agent-04g--Governance-purple?style=for-the-badge)\n")

    # TOC
    a("<details open>")
    a("<summary><strong>📑 Governance Contents</strong></summary>\n")
    a("- [🔍 Discovery Source](#-discovery-source)")
    a("- [📋 Azure Policy Compliance](#-azure-policy-compliance)")
    a("- [🔄 Plan Adaptations Based on Policies](#-plan-adaptations-based-on-policies)")
    a("- [🚫 Deployment Blockers](#-deployment-blockers)")
    a("- [🏷️ Required Tags](#-required-tags)")
    a("- [🔐 Security Policies](#-security-policies)")
    a("- [💰 Cost Policies](#-cost-policies)")
    a("- [🌐 Network Policies](#-network-policies)")
    a("- [📜 Compliance Frameworks](#-compliance-frameworks)")
    a("- [References](#references)\n")
    a("</details>\n")

    a(f"> Generated by 04g-Governance agent | {discovered_at}\n")

    # Cross-nav
    a("| ⬅️ Previous | 📑 Index | Next ➡️ |")
    a("| --- | --- | --- |")
    a("| [02-architecture-assessment.md](02-architecture-assessment.md) | [README](README.md) | [04-implementation-plan.md](04-implementation-plan.md) |\n")

    # Discovery Source
    a("## 🔍 Discovery Source\n")
    a("| Query | Results | Timestamp |")
    a("| --- | --- | --- |")
    a(f"| Policy Assignments | {summary.get('assignment_kept', 0)} policies discovered | {discovered_at} |")
    a(f"| Tag Policies | {len(tags_required)} tags required | {discovered_at} |")
    a(f"| Security Policies | {len(security)} constraints | {discovered_at} |\n")
    is_cached = envelope.get("source") == "cached_baseline" or envelope.get("cached_baseline", False)
    discovery_method = "Cached governance baseline (governance-policy-baseline.json)" if is_cached else "Azure Policy REST API (discover.py)"
    a(f"**Discovery Method**: {discovery_method}")
    a(f"**Subscription**: {envelope.get('subscription_id', 'unknown')}")
    a(f"**Scope**: Subscription + management-group inherited\n")
    if blockers:
        a(f"> ⚠️ **{len(blockers)} deployment blocker(s)** detected. Review the [Deployment Blockers](#-deployment-blockers) section before proceeding to IaC planning.\n")

    # Policy Definition Analysis table
    a("### Policy Definition Analysis\n")
    a("| Policy Display Name | Assignment Scope | Effect | Classification | Category | Bicep Property Path | Required Value |")
    a("| --- | --- | --- | --- | --- | --- | --- |")
    for f in findings:
        constraint = _extract_constraint_value(f) or ""
        bpp = f.get("bicepPropertyPath", "")
        # For policies that only check resource type (bpp == "type"), clarify
        if bpp == "type":
            bpp = "type (resource-type constraint)"
        a(f"| {f.get('display_name', '')} | {f.get('scope', '')} | {f.get('effect', '')} "
          f"| {f.get('classification', '')} | {f.get('category', '')} "
          f"| {bpp} | {constraint} |")
    a("")

    # Azure Policy Compliance
    a("## 📋 Azure Policy Compliance\n")
    if not has_arch:
        a("> **Note**: No architecture assessment provided. IaC impact annotations will be populated during Step 4 (IaC Planning).\n")
    a("| Category | Constraint | Implementation | Status |")
    a("| --- | --- | --- | --- |")
    # Implementation column is descriptive (not prescriptive): when an
    # architecture is provided we redirect the reader to the structured JSON
    # rather than emit an annotation placeholder the agent has to fill in.
    # See plan-optimiseGovernanceAgent.prompt.md Phase 2.
    for cat, items in sorted(by_category.items()):
        for f in items:
            cls = f.get("classification", "")
            if cls == "blocker":
                status_icon = "❌"
                impl = (
                    "Blocked — must comply before deployment"
                    if not has_arch
                    else "See JSON findings[] for structured value."
                )
            elif cls == "auto-remediate":
                status_icon = "✅"
                impl = (
                    "Auto-applied by Azure Policy"
                    if not has_arch
                    else "See JSON findings[] for structured value."
                )
            else:
                status_icon = "⚠️"
                impl = (
                    "Audit only — no enforcement"
                    if not has_arch
                    else "See JSON findings[] for structured value."
                )
            a(f"| {cat} | {f.get('display_name', '')} | {impl} | {status_icon} |")
    a("")

    # Plan Adaptations
    a("## 🔄 Plan Adaptations Based on Policies\n")

    # Architectural Changes — pre-populated policy→resource mapping
    a("### Architectural Changes\n")
    if blockers and arch_resources:
        a("| Original Design | Blocking Policy | Effect | Target Resource Types | Adaptation Applied |")
        a("| --- | --- | --- | --- | --- |")
        # Descriptive (not prescriptive) per-row text — the renderer no longer
        # claims annotation work the agent has not done. See plan-
        # optimiseGovernanceAgent.prompt.md Phase 2 for the rationale.
        for f in blockers:
            f_types = set(f.get("resource_types", []))
            matched = [r for r in arch_resources if r.get("arm_type", "") in f_types]
            adaptation_note = (
                "Deny effect — Step 4 must map to an explicit IaC control "
                "or document an exception."
            )
            if matched:
                for r in matched:
                    a(f"| {r.get('name', '')} ({r.get('arm_type', '')}) "
                      f"| {f.get('display_name', '')} | {f.get('effect', '')} "
                      f"| {', '.join(f_types)} | {adaptation_note} |")
            else:
                a(f"| Cross-check against architecture resource map (Step 4 input). "
                  f"| {f.get('display_name', '')} | {f.get('effect', '')} "
                  f"| {', '.join(f_types)} | {adaptation_note} |")
    elif blockers:
        a("| Original Design | Blocking Policy | Effect | Adaptation Applied |")
        a("| --- | --- | --- | --- |")
        for f in blockers:
            a(f"| No architecture target | {f.get('display_name', '')} | {f.get('effect', '')} "
              f"| Review at Step 4 IaC Planning |")
    else:
        a("✅ Original architecture complies with all discovered policies.\n")
    a("")

    a("### Auto-Applied Resources\n")
    dine_findings = [f for f in findings if f.get("effect") == "deployIfNotExists"]
    if dine_findings:
        a("| Policy | Effect | Auto-Applied Resource |")
        a("| --- | --- | --- |")
        # DeployIfNotExists effects are platform-driven — the descriptor is
        # the same whether or not architecture context is available, so we
        # drop the conditional placeholder.
        for f in dine_findings:
            a(f"| {f.get('display_name', '')} | DeployIfNotExists | Auto-deployed by Azure Policy |")
    else:
        a("✅ No additional resources will be auto-deployed.\n")
    a("")

    a("### Auto-Modified Configurations\n")
    modify_findings = [f for f in findings if f.get("effect") == "modify"]
    if modify_findings:
        a("| Policy | Effect | Auto-Applied Change |")
        a("| --- | --- | --- |")
        # Modify effects are platform-driven (see DINE comment above).
        for f in modify_findings:
            a(f"| {f.get('display_name', '')} | Modify | Auto-modified by Azure Policy |")
    else:
        a("✅ No auto-modifications expected.\n")
    a("")

    # Deployment Blockers (deduplicated by display_name)
    a("## 🚫 Deployment Blockers\n")
    if not blockers:
        a("✅ No deployment blockers detected.\n")
    else:
        deduped = _dedup_blockers(blockers)
        a(f"> **{len(blockers)}** blocker finding(s) from **{len(deduped)}** unique policies (duplicates from multi-scope inheritance are consolidated below).\n")
        for f in deduped:
            a(f"### {f.get('display_name', 'Unknown Policy')}\n")
            a(f"- **Policy ID**: `{f.get('policy_id', '')}`")
            a(f"- **Effect**: {f.get('effect', '')}")
            scopes = f.get("_scopes", [f.get("scope", "")])
            if len(scopes) > 1:
                a(f"- **Scopes** ({len(scopes)} assignments):")
                for s in scopes:
                    a(f"  - `{s}`")
            else:
                a(f"- **Scope**: {scopes[0]}")
            a(f"- **Category**: {f.get('category', '')}")
            bpp = f.get("bicepPropertyPath", "")
            if bpp == "type":
                bpp = "type (resource-type constraint — enforced at type level, not a specific property)"
            a(f"- **Bicep Property Path**: `{bpp}`")
            constraint = _extract_constraint_value(f)
            a(f"- **Required Value**: {constraint or 'N/A — parameter values not available in cached baseline; run `--refresh` for live lookup'}")
            a("")
            # Resolution guidance is uniform whether or not architecture
            # context is present — the per-finding structured fields above
            # already carry everything the Step 4 planner needs. The prior
            # `<!-- AGENT: annotate resolution options below -->` block was
            # dropped in plan-optimiseGovernanceAgent.prompt.md Phase 2 to
            # remove the placeholder cascade.
            a("> **Resolution**: Review during Step 4 IaC Planning — apply an exemption, use an allowed alternative, or update the policy scope.\n")
    a("")

    # Required Tags
    a("## 🏷️ Required Tags\n")
    if tags_required:
        # Enrich unresolved tag entries with assignment_parameters from matching findings.
        # tags_required entries from cached baselines lack params; the matching findings carry them.
        findings_by_display_name: dict[str, dict[str, Any]] = {}
        for f in findings:
            dn = f.get("display_name", "")
            if dn and dn not in findings_by_display_name:
                findings_by_display_name[dn] = f
        enriched_tags: list[dict[str, Any]] = []
        for t in tags_required:
            if t.get("unresolved") or t.get("name", "").startswith("[unresolved"):
                source = t.get("source_assignment", "")
                matching = findings_by_display_name.get(source)
                if matching and matching.get("assignment_parameters"):
                    t = dict(t)
                    t["assignment_parameters"] = matching["assignment_parameters"]
            enriched_tags.append(t)
        resolved, unresolved = _split_tags(enriched_tags)
        a("All resources must include the following tags:\n")
        if unresolved:
            a("> **Note**: Some tag names could not be resolved from cached policy data. "
              "Run with `--refresh` for full tag resolution.\n")
        a("| Tag Name | Source Policy |")
        a("| --- | --- |")
        for t in resolved:
            a(f"| `{t['name']}` | {t.get('source_assignment', t.get('source_policy', ''))} |")
        for t in unresolved:
            a(f"| [unresolved] | {t.get('source_assignment', t.get('source_policy', ''))} — tag key requires live discovery |")
    else:
        a("No tag-enforcement policies discovered.\n")
    a("")
    a("```mermaid")
    a("%%{init: {'theme':'neutral'}}%%")
    a("flowchart TD")
    a('    MG["Management Group Tags"] -->|inherited| SUB["Subscription Tags"]')
    a('    SUB -->|inherited| RG["Resource Group Tags"]')
    a('    RG -->|inherited| RES["Resource Tags"]')
    a('    POL["Azure Policy\\n(Modify effect)"] -->|auto-applies| RES')
    a("    style POL fill:#FFB900,stroke:#333")
    a("    style RES fill:#0078D4,color:#fff,stroke:#333")
    a("```\n")

    # Security Policies — pre-built list already computed before Discovery Source section.
    a("## 🔐 Security Policies\n")
    if security:
        a("| Policy | Effect | Status |")
        a("| --- | --- | --- |")
        for f in security:
            icon = "❌" if f.get("classification") == "blocker" else "✅"
            a(f"| {f.get('display_name', '')} | {f.get('effect', '')} | {icon} |")
    else:
        a("✅ No security-specific policies discovered.\n")
    a("")

    # Cost Policies — also pick up cost-related blockers
    a("## 💰 Cost Policies\n")
    cost = list(by_category.get("Cost", []) + by_category.get("Budget", []))
    cost_keywords = {"Block VM SKU", "Block Azure OpenAI Provisioned", "Block Azure Sentinel Commitment",
                     "Deny AKS deployment with agent pool count", "Deny VMSS deployment with instance count"}
    for f in findings:
        if f not in cost and any(kw in (f.get("display_name") or "") for kw in cost_keywords):
            cost.append(f)
    if cost:
        a("| Policy | Effect | Constraint |")
        a("| --- | --- | --- |")
        for f in cost:
            constraint = _extract_constraint_value(f) or "See policy parameters"
            a(f"| {f.get('display_name', '')} | {f.get('effect', '')} | {constraint} |")
    else:
        a("No cost-specific policies discovered.\n")
    a("")

    # Network Policies
    a("## 🌐 Network Policies\n")
    network = list(by_category.get("Network", []) + by_category.get("Networking", []))
    network_keywords = {"vNet peering", "virtual network", "subnet", "NSG", "firewall"}
    for f in findings:
        if f not in network and any(kw.lower() in (f.get("display_name") or "").lower() for kw in network_keywords):
            network.append(f)
    if network:
        a("| Policy | Effect | Constraint |")
        a("| --- | --- | --- |")
        for f in network:
            constraint = _extract_constraint_value(f) or "See policy parameters"
            a(f"| {f.get('display_name', '')} | {f.get('effect', '')} | {constraint} |")
    else:
        a("No network-specific policies discovered.\n")
    location_constraints = envelope.get("location_constraints", [])
    if location_constraints:
        a("### Location Governance\n")
        a("| Policy | Effect | Enforcement | Allowed Locations |")
        a("| --- | --- | --- | --- |")
        for constraint in location_constraints:
            allowed = ", ".join(f"`{value}`" for value in constraint.get("allowed_locations", [])) or "N/A"
            a(
                f"| {constraint.get('display_name', '')} | {constraint.get('effect', '')} "
                f"| {constraint.get('enforcement_mode', '')} | {allowed} |"
            )
    a("")

    # Compliance Frameworks — notable audit/compliance assignments not in findings
    assignment_inventory = envelope.get("assignment_inventory", [])
    compliance_keywords = {
        "GDPR", "PCI DSS", "HIPAA", "SOC", "ISO 27001", "NIST",
        "Multi Factor Authentication", "MFA", "Security Benchmark",
        "Security Baseline", "CIS",
    }
    # Collect display names already in findings to avoid duplicates
    finding_names = {f.get("display_name", "") for f in findings}
    notable_assignments = []
    for inv in assignment_inventory:
        dn = inv.get("displayName") or inv.get("display_name") or ""
        if dn in finding_names:
            continue
        if any(kw.lower() in dn.lower() for kw in compliance_keywords):
            notable_assignments.append(inv)
    if notable_assignments:
        a("## 📜 Compliance Frameworks\n")
        a("> These audit/compliance assignments are active at subscription or management-group scope. ")
        a("> While they do not block deployments (audit effect), they may impose architecture constraints ")
        a("> (data residency, encryption, access logging, network segmentation).\n")
        a("| Assignment | Scope | Type |")
        a("| --- | --- | --- |")
        for inv in notable_assignments:
            dn = inv.get("displayName") or inv.get("display_name") or ""
            scope = inv.get("scope", "")
            atype = inv.get("assignmentType", "")
            a(f"| {dn} | {scope} | {atype} |")
        a("")
    else:
        a("## 📜 Compliance Frameworks\n")
        a("✅ No compliance framework assignments (GDPR, PCI DSS, HIPAA, etc.) discovered at subscription or management-group scope.\n")

    # References
    a("## References\n")
    a("| Topic | Link |")
    a("| --- | --- |")
    a("| Azure Policy | [Overview](https://learn.microsoft.com/azure/governance/policy/overview) |")
    a("| Tag Governance | [Tagging Strategy](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-tagging) |\n")
    security_exceptions = envelope.get("security_exceptions", [])
    if security_exceptions:
        a("## Approved Security Exceptions\n")
        a("| ID | Control | Environment | Workload | Expires |")
        a("| --- | --- | --- | --- | --- |")
        for exception in security_exceptions:
            scope = exception.get("scope") or {}
            a(
                f"| `{exception.get('id', '')}` | `{exception.get('control', '')}` "
                f"| `{scope.get('environment', '')}` | `{scope.get('workload', '')}` "
                f"| `{exception.get('expires_at', '')}` |"
            )
        a("")
    a("---\n")
    footer_source = "cached governance baseline" if is_cached else "Azure Policy REST API via discover.py"
    a(f"_Governance constraints discovered from {footer_source}._\n")

    preview_path.write_text("\n".join(lines) + "\n")
    return preview_path
