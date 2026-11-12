#!/usr/bin/env python3
"""Read-only, scalar-allowlisted multi-subscription evidence collector for standalone assessments."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import subprocess
import sys
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

SCOPE_RE = re.compile(
    r"^/subscriptions/(?P<sub>[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12})"
    r"(?:/resourceGroups/(?P<rg>[A-Za-z0-9_.()-]{1,90}))?$"
)
GUID_RE = re.compile(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")
SECRET_RE = re.compile(
    r"(?i)(?:bearer\s+[A-Za-z0-9._~+/-]+=*|sig=[A-Za-z0-9%/+=]+|password\s*=\s*\S+|accountkey\s*=\s*\S+)"
)
Runner = Callable[[list[str]], tuple[int, str, str]]


def iso_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def redact_error_text(message: str) -> str:
    redacted = SECRET_RE.sub("<redacted-secret>", message or "")
    redacted = GUID_RE.sub("<redacted-id>", redacted)
    compact = " ".join(redacted.strip().split())
    return compact[:280] if compact else "CLI probe failed without stderr output"


def default_runner(cmd: list[str]) -> tuple[int, str, str]:
    completed = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=120)
    return completed.returncode, completed.stdout, completed.stderr


def safe_project_file(project_root: Path, relative: str) -> Path:
    if not relative or Path(relative).is_absolute() or ".." in relative.split("/") or "\\" in relative:
        raise ValueError(f"Unsafe project-relative path: {relative}")
    resolved_root = project_root.resolve(strict=True)
    target = resolved_root
    for part in relative.split("/"):
        target = target / part
        if target.is_symlink():
            raise ValueError(f"Symlink forbidden: {relative}")
    return target


def write_json_atomic(target: Path, payload: Any) -> bytes:
    target.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(payload, indent=2, sort_keys=False) + "\n").encode("utf-8")
    tmp = target.with_name(f".{target.name}.tmp")
    tmp.write_bytes(encoded)
    tmp.replace(target)
    return encoded


def parse_azure_scope(raw: str) -> tuple[str, str | None]:
    match = SCOPE_RE.fullmatch(raw)
    if not match:
        raise ValueError(f"Invalid Azure scope: {raw}")
    return match.group("sub").lower(), match.group("rg")


def rg_bucket(sub_id: str, rg_name: str, attribution: dict[str, list[str]] | None) -> str:
    if not attribution:
        return "workload"
    qualified = f"/subscriptions/{sub_id}/resourcegroups/{rg_name}".lower()
    bare = rg_name.lower()
    for bucket, label in (
        ("excluded_rgs", "excluded"),
        ("shared_rgs", "shared_platform"),
        ("workload_rgs", "workload"),
    ):
        candidates = {item.lower() for item in attribution.get(bucket, [])}
        if qualified in candidates or bare in candidates:
            return label
    if attribution.get("workload_rgs"):
        return "unattributed"
    return "workload"


def kql_scope_filter(sub_id: str, rg_name: str | None, excluded_rgs: list[str]) -> str:
    clauses = [f"subscriptionId =~ '{sub_id}'"]
    if rg_name:
        safe_rg = rg_name.replace("'", "''")
        clauses.append(f"resourceGroup =~ '{safe_rg}'")
    elif excluded_rgs:
        excluded_names: list[str] = []
        prefix = f"/subscriptions/{sub_id}/resourcegroups/"
        for entry in excluded_rgs:
            low = entry.lower()
            if low.startswith(prefix):
                excluded_names.append(low.removeprefix(prefix).replace("'", "''"))
            elif not low.startswith("/subscriptions/"):
                excluded_names.append(low.replace("'", "''"))
        if excluded_names:
            quoted = ", ".join(f"'{name}'" for name in sorted(set(excluded_names)))
            clauses.append(f"tolower(resourceGroup) !in ({quoted})")
    return " and ".join(clauses)


def run_arg_paginated(
    runner: Runner,
    sub_id: str,
    query: str,
    *,
    max_pages: int = 50,
) -> tuple[list[dict[str, Any]], int, str | None]:
    seen_tokens: set[str] = set()
    rows: list[dict[str, Any]] = []
    skip_token: str | None = None
    pages = 0
    while pages < max_pages:
        cmd = [
            "az",
            "graph",
            "query",
            "--subscriptions",
            sub_id,
            "--first",
            "1000",
            "-q",
            query,
            "-o",
            "json",
        ]
        if skip_token:
            cmd.extend(["--skip-token", skip_token])
        code, stdout, stderr = runner(cmd)
        if code != 0:
            return rows, pages, redact_error_text(stderr)
        try:
            payload = json.loads(stdout)
        except json.JSONDecodeError:
            return rows, pages, "Malformed JSON from az graph query"
        data = payload.get("data") if isinstance(payload, dict) else payload
        if not isinstance(data, list):
            return rows, pages, "Unexpected ARG response shape"
        rows.extend(item for item in data if isinstance(item, dict))
        pages += 1
        next_token = payload.get("skip_token") or payload.get("skipToken") if isinstance(payload, dict) else None
        if not next_token:
            return rows, pages, None
        if not isinstance(next_token, str) or next_token in seen_tokens:
            return rows, pages, "Repeated or invalid ARG continuation token"
        seen_tokens.add(next_token)
        skip_token = next_token
    return rows, pages, "ARG pagination exceeded maximum bounded page count"


def arg_count(runner: Runner, sub_id: str, where_clause: str) -> tuple[int | None, str | None]:
    query = f"Resources | where {where_clause} | summarize total=count()"
    rows, _, err = run_arg_paginated(runner, sub_id, query, max_pages=1)
    if err or not rows:
        return None, err or "Empty count response"
    total = rows[0].get("total")
    return (int(total), None) if isinstance(total, int) else (None, "Invalid ARG count field")


def classify_cli_error(stderr: str) -> str:
    low = (stderr or "").lower()
    if "403" in low or "authorizationfailed" in low or "forbidden" in low or "access denied" in low:
        return "authorization_denied"
    if "429" in low or "throttl" in low or "too many requests" in low:
        return "throttled"
    if "metric" in low and ("not found" in low or "unsupported" in low or "failed to find metric" in low):
        return "unsupported_metric"
    if "timeout" in low or "timed out" in low:
        return "timed_out"
    return "cli_or_service_error"


METRIC_SPECS: dict[str, tuple[str, int, tuple[str, ...]]] = {
    "microsoft.compute/virtualmachines": ("Percentage CPU", 1, ("Average", "Maximum")),
    "microsoft.web/serverfarms": ("CpuPercentage,MemoryPercentage", 2, ("Average", "Maximum")),
    "microsoft.sql/managedinstances": ("avg_cpu_percent,storage_space_used_mb", 2, ("Average", "Maximum")),
    "microsoft.sql/servers/databases": ("cpu_percent,dtu_consumption_percent", 2, ("Average", "Maximum")),
    "microsoft.servicebus/namespaces": ("IncomingMessages,ServerErrors", 2, ("Total",)),
}


def parse_metric_summaries(raw_stdout: str) -> tuple[list[dict[str, Any]] | None, str | None]:
    try:
        parsed = json.loads(raw_stdout)
    except json.JSONDecodeError:
        return None, "malformed_metrics_json"
    values = parsed.get("value") if isinstance(parsed, dict) else None
    if not isinstance(values, list):
        return None, "unexpected_metrics_container"
    summaries: list[dict[str, Any]] = []
    for metric in values:
        if not isinstance(metric, dict):
            continue
        name_obj = metric.get("name")
        metric_name = name_obj.get("value") if isinstance(name_obj, dict) else str(name_obj or "")
        unit = str(metric.get("unit") or "")
        averages: list[float] = []
        maximums: list[float] = []
        totals: list[float] = []
        for ts in metric.get("timeseries") or []:
            if not isinstance(ts, dict):
                continue
            for point in ts.get("data") or []:
                if not isinstance(point, dict):
                    continue
                avg = point.get("average")
                mx = point.get("maximum")
                tot = point.get("total")
                if isinstance(avg, (int, float)) and not isinstance(avg, bool):
                    averages.append(float(avg))
                if isinstance(mx, (int, float)) and not isinstance(mx, bool):
                    maximums.append(float(mx))
                if isinstance(tot, (int, float)) and not isinstance(tot, bool):
                    totals.append(float(tot))
        sample_count = max(len(averages), len(maximums), len(totals))
        summaries.append(
            {
                "metric": metric_name,
                "unit": unit,
                "status": "observed" if sample_count > 0 else "empty_timeseries",
                "sample_count": sample_count,
                "average": round(sum(averages) / len(averages), 4) if averages else None,
                "maximum": round(max(maximums), 4) if maximums else None,
                "total": round(sum(totals), 4) if totals else None,
            }
        )
    return summaries, None


def parse_diag_settings(raw_stdout: str) -> tuple[list[dict[str, Any]] | None, str | None]:
    try:
        parsed = json.loads(raw_stdout)
    except json.JSONDecodeError:
        return None, "Malformed diagnostic-settings JSON"
    items = parsed.get("value") if isinstance(parsed, dict) else parsed
    if not isinstance(items, list):
        return None, "Unexpected diagnostic-settings container"
    sanitized: list[dict[str, Any]] = []
    for entry in items:
        if not isinstance(entry, dict):
            continue
        logs = entry.get("logs") or []
        metrics = entry.get("metrics") or []
        has_eh = (
            bool(entry.get("eventHubRuleConfigured"))
            if "eventHubRuleConfigured" in entry
            else bool(entry.get("eventHubAuthorizationRuleId"))
        )
        sanitized.append(
            {
                "name": entry.get("name"),
                "workspaceId": entry.get("workspaceId"),
                "storageAccountId": entry.get("storageAccountId"),
                "eventHubAuthorizationRuleId": has_eh,
                "enabled_log_count": sum(1 for item in logs if isinstance(item, dict) and item.get("enabled") is True),
                "enabled_metric_count": sum(
                    1 for item in metrics if isinstance(item, dict) and item.get("enabled") is True
                ),
            }
        )
    return sanitized, None


def collect_assessment_evidence(
    project_root: Path,
    scope_request: dict[str, Any],
    *,
    runner: Runner = default_runner,
    collected_at: str | None = None,
) -> dict[str, Any]:
    timestamp = collected_at or iso_now()
    scope = scope_request["scope"]
    categories: list[str] = list(scope["categories"])
    azure_scopes: list[str] = list(scope.get("azure_scopes", []))
    iac_paths: list[str] = list(scope.get("iac_paths", []))
    rg_attr: dict[str, list[str]] | None = scope.get("rg_attribution")
    excluded_rgs = list((rg_attr or {}).get("excluded_rgs", []))

    if rg_attr and azure_scopes:
        approved_subs = {parse_azure_scope(raw)[0] for raw in azure_scopes}
        seen_expanded: set[str] = set()
        for bucket in ("workload_rgs", "shared_rgs", "excluded_rgs"):
            for entry in rg_attr.get(bucket, []):
                low = entry.lower()
                if low.startswith("/subscriptions/"):
                    parts = low.split("/")
                    if len(parts) != 5 or parts[3] != "resourcegroups" or parts[2] not in approved_subs:
                        raise ValueError(f"Invalid or out-of-scope rg_attribution entry: {entry}")
                    expanded = {f"/subscriptions/{parts[2]}/resourcegroups/{parts[4]}"}
                else:
                    expanded = {f"/subscriptions/{sub}/resourcegroups/{low}" for sub in approved_subs}
                if seen_expanded & expanded:
                    raise ValueError("rg_attribution buckets must contain unique, pairwise-disjoint resource groups")
                seen_expanded.update(expanded)
    for raw in azure_scopes:
        sub_check, rg_check = parse_azure_scope(raw)
        if rg_check and rg_bucket(sub_check, rg_check, rg_attr) == "excluded":
            raise ValueError(f"Explicitly authorized RG scope {raw} cannot be listed in excluded_rgs")

    checks: list[dict[str, str]] = []
    inventories: list[dict[str, Any]] = []
    topology_obs: list[dict[str, Any]] = []
    config_obs: list[dict[str, Any]] = []
    operations_obs: list[dict[str, Any]] = []
    recovery_obs: list[dict[str, Any]] = []
    metrics_obs: list[dict[str, Any]] = []
    policy_obs: list[dict[str, Any]] = []
    discovered_items: list[dict[str, Any]] = []

    workspace_root = project_root.resolve().parents[1] if project_root.parent.name == "agent-output" else project_root
    for iac_rel in iac_paths:
        iac_target = workspace_root / iac_rel
        exists = iac_target.exists() and not iac_target.is_symlink()
        for category in categories:
            if category == "billing":
                checks.append(
                    {
                        "category": category,
                        "scope": iac_rel,
                        "status": "not_applicable",
                        "evidence": "Static IaC path does not carry live Azure Cost Management billing.",
                    }
                )
            elif exists:
                checks.append(
                    {
                        "category": category,
                        "scope": iac_rel,
                        "status": "declared",
                        "evidence": f"Static IaC scope verified at {iac_rel} ({timestamp}).",
                    }
                )
            else:
                checks.append(
                    {
                        "category": category,
                        "scope": iac_rel,
                        "status": "unknown",
                        "evidence": f"Declared IaC path {iac_rel} was not readable at {timestamp}.",
                    }
                )

    non_billing_azure = [cat for cat in categories if cat != "billing"]
    arg_inventory_categories = {"configuration", "topology", "operations", "recovery", "utilization"}
    needs_arg_inventory = bool(set(categories) & arg_inventory_categories)
    include_config_scalars = "configuration" in categories
    try:
        end_dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        end_dt = datetime.now(UTC)
    metrics_end = end_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    metrics_start = (end_dt - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

    def collect_single_scope(raw_scope: str) -> dict[str, Any]:
        scope_checks: list[dict[str, str]] = []
        scope_inventories: list[dict[str, Any]] = []
        scope_topology: list[dict[str, Any]] = []
        scope_config: list[dict[str, Any]] = []
        scope_ops: list[dict[str, Any]] = []
        scope_rec: list[dict[str, Any]] = []
        scope_metrics: list[dict[str, Any]] = []
        scope_policy: list[dict[str, Any]] = []
        scope_discovered: list[dict[str, Any]] = []

        sub_id, rg_name = parse_azure_scope(raw_scope)
        probe_url = (
            f"https://management.azure.com/subscriptions/{sub_id}/resourceGroups/{rg_name}?api-version=2022-12-01"
            if rg_name
            else f"https://management.azure.com/subscriptions/{sub_id}?api-version=2022-12-01"
        )
        probe_query = (
            "{id:id,location:location,provisioningState:properties.provisioningState}"
            if rg_name
            else "{subscriptionId:subscriptionId,displayName:displayName,tenantId:tenantId,state:state}"
        )
        scope_check_cmd = [
            "az",
            "rest",
            "--method",
            "get",
            "--url",
            probe_url,
            "--query",
            probe_query,
            "-o",
            "json",
        ]
        code, stdout, stderr = runner(scope_check_cmd)
        if code != 0:
            reason = redact_error_text(stderr)
            status = "denied" if "authorization" in stderr.lower() or "403" in stderr else "unknown"
            if needs_arg_inventory:
                scope_inventories.append(
                    {
                        "scope": raw_scope,
                        "subscription_id": sub_id,
                        "subscription_name": None,
                        "resource_group": rg_name,
                        "complete": False,
                        "count": 0,
                        "resources": [],
                        "error": reason,
                    }
                )
            for cat in non_billing_azure:
                scope_checks.append(
                    {
                        "category": cat,
                        "scope": raw_scope,
                        "status": status,
                        "evidence": f"Scope access probe failed ({reason}).",
                    }
                )
            if "billing" in categories:
                scope_checks.append(
                    {
                        "category": "billing",
                        "scope": raw_scope,
                        "status": "unknown",
                        "evidence": "Billing evidence is collected separately in contracts/03-cost-management.json.",
                    }
                )
            return {
                "checks": scope_checks,
                "inventories": scope_inventories,
                "topology": scope_topology,
                "config": scope_config,
                "ops": scope_ops,
                "recovery": scope_rec,
                "metrics": scope_metrics,
                "policy": scope_policy,
                "discovered": scope_discovered,
            }

        sub_display_name: str | None = None
        try:
            probe_doc = json.loads(stdout)
            if isinstance(probe_doc, dict) and isinstance(probe_doc.get("displayName"), str):
                cleaned_name = probe_doc["displayName"].strip()
                if cleaned_name:
                    sub_display_name = cleaned_name
        except json.JSONDecodeError:
            pass

        where_clause = kql_scope_filter(sub_id, rg_name, excluded_rgs)
        inv_rows: list[dict[str, Any]] = []
        inv_complete = False
        inv_note = ""
        if needs_arg_inventory:
            before_count, count_err = arg_count(runner, sub_id, where_clause)
            extra_projection = (
                ", skuName=tostring(sku.name), skuTier=tostring(sku.tier), resourceKind=tostring(['kind']), "
                "availabilityZones=tostring(zones), identityType=tostring(identity.type)"
                if include_config_scalars
                else ""
            )
            inv_query = (
                f"Resources | where {where_clause} "
                f"| project id, name, type, location, subscriptionId, resourceGroup{extra_projection} "
                "| order by id asc"
            )
            inv_rows, pages, inv_err = run_arg_paginated(runner, sub_id, inv_query)
            after_count, after_err = arg_count(runner, sub_id, where_clause)
            unique_ids = {row.get("id", "").lower() for row in inv_rows if row.get("id")}
            inv_complete = (
                count_err is None
                and inv_err is None
                and after_err is None
                and before_count == after_count == len(inv_rows) == len(unique_ids)
            )
            for row in inv_rows:
                row["rg_role"] = rg_bucket(sub_id, str(row.get("resourceGroup", "")), rg_attr)
                item_record: dict[str, Any] = {
                    "id": row.get("id"),
                    "name": row.get("name"),
                    "type": row.get("type"),
                    "location": row.get("location"),
                    "subscription": sub_id,
                    "subscription_name": sub_display_name,
                    "resource_group": row.get("resourceGroup"),
                    "rg_role": row["rg_role"],
                    "provenance": "azure-arg",
                    "confidence": "observed",
                    "observed_at": timestamp,
                }
                if include_config_scalars:
                    item_record["sku"] = row.get("skuName") or row.get("skuTier") or None
                scope_discovered.append(item_record)
            rg_summary: dict[str, dict[str, Any]] = {}
            for row in inv_rows:
                rgn = str(row.get("resourceGroup", ""))
                entry = rg_summary.setdefault(rgn, {"count": 0, "role": row.get("rg_role", "workload")})
                entry["count"] += 1
            inv_note = inv_err or count_err or after_err or "Reconciled paginated ARG inventory"
            scope_inventories.append(
                {
                    "scope": raw_scope,
                    "subscription_id": sub_id,
                    "subscription_name": sub_display_name,
                    "resource_group": rg_name,
                    "complete": inv_complete,
                    "pages": pages,
                    "count": len(inv_rows),
                    "nextLink": None if inv_complete else "incomplete_or_unreconciled",
                    "resource_groups": rg_summary,
                    "resources": inv_rows,
                    "note": inv_note,
                }
            )

        if "topology" in categories:
            mv_limit = 1000
            topo_base_query = (
                f"Resources | where {where_clause} and type in~ ("
                "'microsoft.network/virtualnetworks','microsoft.network/privateendpoints',"
                "'microsoft.network/privatednszones','microsoft.network/privatednszones/virtualnetworklinks',"
                "'microsoft.network/azurefirewalls','microsoft.network/bastionhosts',"
                "'microsoft.network/applicationgateways','microsoft.network/networkinterfaces') "
                "| project id, name, type, resourceGroup, location, skuName=tostring(sku.name), "
                "addressPrefixesCount=array_length(properties.addressSpace.addressPrefixes), "
                "firstAddressPrefix=tostring(properties.addressSpace.addressPrefixes[0]), "
                "subnetCount=array_length(properties.subnets), "
                "peeringCount=array_length(properties.virtualNetworkPeerings), "
                "peConnectionCount=array_length(properties.privateLinkServiceConnections), "
                "peSubnetId=tostring(properties.subnet.id), "
                "ipConfigSubnetId=tostring(properties.ipConfigurations[0].properties.subnet.id), "
                "vnetLinkState=tostring(properties.virtualNetworkLinkState), "
                "linkedVnetId=tostring(properties.virtualNetwork.id) | order by id asc"
            )
            subnet_query = (
                f"Resources | where {where_clause} and type =~ 'microsoft.network/virtualnetworks' "
                f"| mv-expand subnet=properties.subnets limit {mv_limit} "
                "| project vnetId=id, vnetName=name, resourceGroup, "
                "subnetName=tostring(subnet.name), "
                "addressPrefix=tostring(subnet.properties.addressPrefix), "
                "nsgId=tostring(subnet.properties.networkSecurityGroup.id), "
                "routeTableId=tostring(subnet.properties.routeTable.id), "
                "delegationService=tostring(subnet.properties.delegations[0].properties.serviceName) "
                "| order by vnetId asc, subnetName asc"
            )
            peering_query = (
                f"Resources | where {where_clause} and type =~ 'microsoft.network/virtualnetworks' "
                f"| mv-expand peering=properties.virtualNetworkPeerings limit {mv_limit} "
                "| project vnetId=id, vnetName=name, resourceGroup, "
                "peeringName=tostring(peering.name), "
                "peeringState=tostring(peering.properties.peeringState), "
                "remoteVnetId=tostring(peering.properties.remoteVirtualNetwork.id), "
                "allowForwardedTraffic=tobool(peering.properties.allowForwardedTraffic), "
                "useRemoteGateways=tobool(peering.properties.useRemoteGateways) "
                "| order by vnetId asc, peeringName asc"
            )
            pe_conn_query = (
                f"Resources | where {where_clause} and type =~ 'microsoft.network/privateendpoints' "
                f"| mv-expand conn=properties.privateLinkServiceConnections limit {mv_limit} "
                "| project peId=id, peName=name, resourceGroup, "
                "subnetId=tostring(properties.subnet.id), "
                "targetResourceId=tostring(conn.properties.privateLinkServiceId), "
                "groupId=tostring(conn.properties.groupIds[0]), "
                "connectionStatus=tostring(conn.properties.privateLinkServiceConnectionState.status) "
                "| order by peId asc"
            )
            topo_rows, _, topo_err = run_arg_paginated(runner, sub_id, topo_base_query)
            subnet_rows, _, sub_err = run_arg_paginated(runner, sub_id, subnet_query)
            peering_rows, _, peer_err = run_arg_paginated(runner, sub_id, peering_query)
            pe_conn_rows, _, pe_err = run_arg_paginated(runner, sub_id, pe_conn_query)
            subnet_by_vnet: dict[str, int] = {}
            for srow in subnet_rows:
                vid = str(srow.get("vnetId") or "").lower()
                if vid:
                    subnet_by_vnet[vid] = subnet_by_vnet.get(vid, 0) + 1
            peering_by_vnet: dict[str, int] = {}
            for prow in peering_rows:
                vid = str(prow.get("vnetId") or "").lower()
                if vid:
                    peering_by_vnet[vid] = peering_by_vnet.get(vid, 0) + 1
            conn_by_pe: dict[str, int] = {}
            for crow in pe_conn_rows:
                pid = str(crow.get("peId") or "").lower()
                if pid:
                    conn_by_pe[pid] = conn_by_pe.get(pid, 0) + 1
            overflow_err: str | None = None
            for trow in topo_rows:
                rid = str(trow.get("id") or "").lower()
                sc = trow.get("subnetCount")
                pc = trow.get("peeringCount")
                cc = trow.get("peConnectionCount")
                if (
                    (type(sc) is int and sc > subnet_by_vnet.get(rid, 0))
                    or (type(pc) is int and pc > peering_by_vnet.get(rid, 0))
                    or (type(cc) is int and cc > conn_by_pe.get(rid, 0))
                ):
                    overflow_err = "mv-expand child element count truncated or unreconciled against parent array_length"
                    break
            combined_topo_err = topo_err or sub_err or peer_err or pe_err or overflow_err
            scope_topology.append(
                {
                    "scope": raw_scope,
                    "count": len(topo_rows),
                    "items": topo_rows,
                    "subnets": subnet_rows,
                    "peerings": peering_rows,
                    "private_endpoint_connections": pe_conn_rows,
                    "error": combined_topo_err,
                }
            )
            scope_checks.append(
                {
                    "category": "topology",
                    "scope": raw_scope,
                    "status": "observed" if inv_complete and combined_topo_err is None else "unknown",
                    "evidence": (
                        f"Collected {len(topo_rows)} scalar network/DNS/NIC records, {len(subnet_rows)} subnets, "
                        f"{len(peering_rows)} peerings, and {len(pe_conn_rows)} private-endpoint bindings in _meta/scalar-topology.json."
                        if combined_topo_err is None
                        else f"Topology projection incomplete: {combined_topo_err}."
                    ),
                }
            )

        if "configuration" in categories:
            cfg_query = (
                f"Resources | where {where_clause} "
                "| project id, name, type, resourceGroup, location, skuName=tostring(sku.name), "
                "httpsOnly=tobool(properties.httpsOnly), "
                "minTlsVersion=tostring(properties.siteConfig.minTlsVersion), "
                "ftpsState=tostring(properties.siteConfig.ftpsState), "
                "publicNetworkAccess=tostring(properties.publicNetworkAccess), "
                "vnetSubnetId=tostring(properties.virtualNetworkSubnetId), "
                "vnetRouteAllEnabled=tobool(properties.vnetRouteAllEnabled), "
                "zoneRedundant=tobool(properties.zoneRedundant), "
                "sqlStorageAccountType=tostring(properties.storageAccountType), "
                "sqlBackupRedundancy=tostring(properties.requestedBackupStorageRedundancy), "
                "sqlCurrentBackupRedundancy=tostring(properties.currentBackupStorageRedundancy), "
                "sqlLicenseType=tostring(properties.licenseType), "
                "sqlVCores=toint(properties.vCores), "
                "sqlStorageSizeInGB=toint(properties.storageSizeInGB), "
                "sqlPublicDataEndpointEnabled=tobool(properties.publicDataEndpointEnabled), "
                "entraOnlySql=tobool(properties.administrators.azureADOnlyAuthentication), "
                "kvRbac=tobool(properties.enableRbacAuthorization), "
                "kvSoftDelete=tobool(properties.enableSoftDelete), "
                "kvPurgeProtection=tobool(properties.enablePurgeProtection), "
                "acrAdminEnabled=tobool(properties.adminUserEnabled), "
                "acrNetworkBypass=tostring(properties.networkRuleBypassOptions), "
                "sbDisableLocalAuth=tobool(properties.disableLocalAuth), "
                "arcStatus=tostring(properties.status) | order by id asc"
            )
            cfg_rows, _, cfg_err = run_arg_paginated(runner, sub_id, cfg_query)
            scope_config.append({"scope": raw_scope, "count": len(cfg_rows), "items": cfg_rows, "error": cfg_err})
            scope_checks.append(
                {
                    "category": "configuration",
                    "scope": raw_scope,
                    "status": "observed" if inv_complete and cfg_err is None else "unknown",
                    "evidence": (
                        f"Collected allowlisted scalar configuration for {len(cfg_rows)} resources in _meta/controls-evidence.json."
                        if cfg_err is None
                        else f"Configuration projection incomplete: {cfg_err}."
                    ),
                }
            )

        if "operations" in categories:
            ops_query = (
                f"Resources | where {where_clause} and type in~ ("
                "'microsoft.operationalinsights/workspaces','microsoft.insights/components',"
                "'microsoft.insights/actiongroups','microsoft.insights/metricalerts',"
                "'microsoft.insights/datacollectionrules') "
                "| project id, name, type, resourceGroup, location, "
                "retentionInDays=toint(properties.retentionInDays), "
                "workspaceResourceId=tostring(properties.WorkspaceResourceId), "
                "enabled=tobool(properties.enabled), "
                "emailCount=array_length(properties.emailReceivers), "
                "armRoleCount=array_length(properties.armRoleReceivers) | order by id asc"
            )
            ops_rows, _, ops_err = run_arg_paginated(runner, sub_id, ops_query)
            diag_samples: list[dict[str, Any]] = []
            diag_targets = [
                row["id"]
                for row in inv_rows
                if str(row.get("type", "")).lower()
                in {
                    "microsoft.web/sites",
                    "microsoft.sql/managedinstances",
                    "microsoft.sql/servers",
                    "microsoft.keyvault/vaults",
                    "microsoft.servicebus/namespaces",
                }
                and row.get("rg_role") != "excluded"
            ][:10]
            diag_err: str | None = None
            diag_jmes = (
                "not_null(value, @)[].{name:name,workspaceId:workspaceId,storageAccountId:storageAccountId,"
                "eventHubRuleConfigured:eventHubAuthorizationRuleId != null,"
                "logs:logs[].{enabled:enabled},metrics:metrics[].{enabled:enabled}}"
            )
            for res_id in diag_targets:
                d_code, d_out, d_stderr = runner(
                    [
                        "az",
                        "monitor",
                        "diagnostic-settings",
                        "list",
                        "--resource",
                        res_id,
                        "--query",
                        diag_jmes,
                        "--only-show-errors",
                        "-o",
                        "json",
                    ]
                )
                if d_code != 0:
                    diag_err = redact_error_text(d_stderr)
                    continue
                parsed_diag, p_err = parse_diag_settings(d_out)
                if p_err:
                    diag_err = p_err
                else:
                    diag_samples.append({"resource_id": res_id, "settings": parsed_diag})
            scope_ops.append(
                {
                    "scope": raw_scope,
                    "monitoring_resources": ops_rows,
                    "diagnostic_settings": diag_samples,
                    "error": ops_err or diag_err,
                }
            )
            scope_checks.append(
                {
                    "category": "operations",
                    "scope": raw_scope,
                    "status": "observed" if ops_err is None and diag_err is None else "unknown",
                    "evidence": (
                        f"Observed {len(ops_rows)} monitoring resources and {len(diag_samples)} diagnostic-setting targets; runtime ingestion/delivery not tested."
                        if ops_err is None and diag_err is None
                        else f"Operations collection partial: {ops_err or diag_err}."
                    ),
                }
            )

        if "recovery" in categories:
            rec_query = (
                f"Resources | where {where_clause} and type in~ ("
                "'microsoft.recoveryservices/vaults','microsoft.dataprotection/backupvaults',"
                "'microsoft.sql/managedinstances','microsoft.sql/servers/databases') "
                "| project id, name, type, resourceGroup, location, "
                "zoneRedundant=tobool(properties.zoneRedundant), "
                "storageAccountType=tostring(properties.storageAccountType), "
                "currentBackupStorageRedundancy=tostring(properties.currentBackupStorageRedundancy), "
                "requestedBackupStorageRedundancy=tostring(properties.requestedBackupStorageRedundancy) "
                "| order by id asc"
            )
            rec_rows, _, rec_err = run_arg_paginated(runner, sub_id, rec_query)
            scope_rec.append({"scope": raw_scope, "items": rec_rows, "error": rec_err})
            scope_checks.append(
                {
                    "category": "recovery",
                    "scope": raw_scope,
                    "status": "observed" if rec_err is None else "unknown",
                    "evidence": (
                        f"Observed {len(rec_rows)} vault/database redundancy records; live restore/cutover drills remain unverified unless separately evidenced."
                        if rec_err is None
                        else f"Recovery projection incomplete: {rec_err}."
                    ),
                }
            )

        if "utilization" in categories:
            metric_targets = [
                (row["id"], str(row.get("type", "")).lower())
                for row in inv_rows
                if str(row.get("type", "")).lower() in METRIC_SPECS and row.get("rg_role") != "excluded"
            ][:20]
            metric_items: list[dict[str, Any]] = []
            metric_errors: list[str] = []
            incomplete_metric_targets = 0
            for res_id, rtype in metric_targets:
                metric_csv, expected_metric_count, metric_aggs = METRIC_SPECS[rtype]
                m_code, m_out, m_stderr = runner(
                    [
                        "az",
                        "monitor",
                        "metrics",
                        "list",
                        "--subscription",
                        sub_id,
                        "--resource",
                        res_id,
                        "--metric",
                        metric_csv,
                        "--start-time",
                        metrics_start,
                        "--end-time",
                        metrics_end,
                        "--interval",
                        "PT1H",
                        "--aggregation",
                        *metric_aggs,
                        "--only-show-errors",
                        "-o",
                        "json",
                    ]
                )
                if m_code != 0:
                    err_cls = classify_cli_error(m_stderr)
                    metric_errors.append(err_cls)
                    metric_items.append({"resource_id": res_id, "type": rtype, "status": "error", "error": err_cls})
                    continue
                summaries, m_err = parse_metric_summaries(m_out)
                if m_err or summaries is None:
                    metric_errors.append(m_err or "malformed_metrics_json")
                    metric_items.append(
                        {
                            "resource_id": res_id,
                            "type": rtype,
                            "status": "error",
                            "error": m_err or "malformed_metrics_json",
                        }
                    )
                else:
                    all_observed = len(summaries) >= expected_metric_count and all(
                        s.get("status") == "observed" for s in summaries
                    )
                    if not all_observed:
                        incomplete_metric_targets += 1
                    metric_items.append(
                        {
                            "resource_id": res_id,
                            "type": rtype,
                            "status": "ok" if all_observed else "partial_or_empty",
                            "metrics": summaries,
                        }
                    )
            scope_metrics.append(
                {
                    "scope": raw_scope,
                    "window": {"start": metrics_start, "end": metrics_end, "interval": "PT1H"},
                    "target_count": len(metric_targets),
                    "incomplete_target_count": incomplete_metric_targets,
                    "items": metric_items,
                    "errors": sorted(set(metric_errors)),
                }
            )
            if not inv_complete:
                scope_checks.append(
                    {
                        "category": "utilization",
                        "scope": raw_scope,
                        "status": "unknown",
                        "evidence": "Inventory incomplete; utilization metric targets could not be reconciled.",
                    }
                )
            elif metric_errors:
                scope_checks.append(
                    {
                        "category": "utilization",
                        "scope": raw_scope,
                        "status": "unknown",
                        "evidence": f"Monitor metric collection encountered {', '.join(sorted(set(metric_errors)))} across {len(metric_targets)} targets in _meta/metrics-evidence.json.",
                    }
                )
            elif incomplete_metric_targets > 0:
                scope_checks.append(
                    {
                        "category": "utilization",
                        "scope": raw_scope,
                        "status": "unknown",
                        "evidence": (
                            f"Monitor metric responses had empty or missing samples on {incomplete_metric_targets}/{len(metric_targets)} targets; "
                            "observed summaries are retained in _meta/metrics-evidence.json."
                        ),
                    }
                )
            else:
                scope_checks.append(
                    {
                        "category": "utilization",
                        "scope": raw_scope,
                        "status": "observed",
                        "evidence": (
                            f"Collected 7-day PT1H Azure Monitor metric summaries for {len(metric_targets)} compute/database targets in _meta/metrics-evidence.json."
                            if metric_targets
                            else "No compute/database metric targets present in scope; 0 metric series required in _meta/metrics-evidence.json."
                        ),
                    }
                )

        if "policy" in categories:
            pol_scope_args = (
                ["--resource-group", rg_name, "--subscription", sub_id]
                if rg_name
                else ["--subscription", sub_id, "--disable-scope-strict-match", "true"]
            )
            p_code, p_out, p_err = runner(
                [
                    "az",
                    "policy",
                    "assignment",
                    "list",
                    *pol_scope_args,
                    "--query",
                    "[].{id:id,name:name,displayName:displayName,scope:scope,enforcementMode:enforcementMode,policyDefinitionId:policyDefinitionId}",
                    "--only-show-errors",
                    "-o",
                    "json",
                ]
            )
            if p_code == 0:
                try:
                    pol_items = json.loads(p_out)
                except json.JSONDecodeError:
                    pol_items = None
                if isinstance(pol_items, list):
                    scope_policy.append({"scope": raw_scope, "count": len(pol_items), "assignments": pol_items})
                    scope_checks.append(
                        {
                            "category": "policy",
                            "scope": raw_scope,
                            "status": "observed",
                            "evidence": f"Listed {len(pol_items)} policy assignment headers in _meta/scoped-policy-observations.json (enforcement modes only; effective compliance state not inferred).",
                        }
                    )
                else:
                    scope_checks.append(
                        {
                            "category": "policy",
                            "scope": raw_scope,
                            "status": "unknown",
                            "evidence": "Policy assignment output was not a JSON list.",
                        }
                    )
            else:
                scope_checks.append(
                    {
                        "category": "policy",
                        "scope": raw_scope,
                        "status": "unknown",
                        "evidence": f"Policy assignment probe failed ({redact_error_text(p_err)}).",
                    }
                )

        if "billing" in categories:
            cost_contract = project_root / "contracts/03-cost-management.json"
            billing_status = "unknown"
            billing_note = "Pending Cost Management collection in contracts/03-cost-management.json."
            if cost_contract.is_file() and not cost_contract.is_symlink():
                try:
                    cost_doc = json.loads(cost_contract.read_text(encoding="utf-8"))
                    matching = [
                        item
                        for item in cost_doc.get("evidence", [])
                        if str(item.get("request", {}).get("scope", "")).lower() == raw_scope.lower()
                    ]
                    if matching and all(item.get("status") == "complete" for item in matching):
                        billing_status = "observed"
                        billing_note = (
                            "Verified complete Cost Management evidence in contracts/03-cost-management.json."
                        )
                except json.JSONDecodeError:
                    pass
            scope_checks.append(
                {
                    "category": "billing",
                    "scope": raw_scope,
                    "status": billing_status,
                    "evidence": billing_note,
                }
            )

        return {
            "checks": scope_checks,
            "inventories": scope_inventories,
            "topology": scope_topology,
            "config": scope_config,
            "ops": scope_ops,
            "recovery": scope_rec,
            "metrics": scope_metrics,
            "policy": scope_policy,
            "discovered": scope_discovered,
        }

    if azure_scopes:
        workers = min(4, len(azure_scopes))
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            scope_results = list(pool.map(collect_single_scope, azure_scopes))
        for res in scope_results:
            checks.extend(res["checks"])
            inventories.extend(res["inventories"])
            topology_obs.extend(res["topology"])
            config_obs.extend(res["config"])
            operations_obs.extend(res["ops"])
            recovery_obs.extend(res["recovery"])
            metrics_obs.extend(res["metrics"])
            policy_obs.extend(res["policy"])
            discovered_items.extend(res["discovered"])

    if not checks:
        coverage = "not_assessed"
    elif any(item["status"] in ("unknown", "denied") for item in checks):
        coverage = (
            "partial"
            if any(item["status"] in ("observed", "declared", "inferred") for item in checks)
            else "not_assessed"
        )
    else:
        coverage = "complete"

    inv_payload = {"collected_at": timestamp, "inventories": inventories}
    inv_bytes = write_json_atomic(safe_project_file(project_root, "_meta/live-inventory.json"), inv_payload)
    inv_sha = sha256_bytes(inv_bytes)

    reg_resources: list[dict[str, Any]] = []
    for inv_idx, inv in enumerate(inventories):
        for res_idx, res in enumerate(inv.get("resources", [])):
            if res.get("id") and res.get("name") and res.get("type"):
                reg_resources.append(
                    {
                        "id": res["id"],
                        "name": res["name"],
                        "type": str(res["type"]).lower(),
                        "count": 1,
                        "evidence_id": "inventory",
                        "locator": f"/inventories/{inv_idx}/resources/{res_idx}",
                        "source_locator": f"/inventories/{inv_idx}/resources/{res_idx}",
                    }
                )
    write_json_atomic(
        safe_project_file(project_root, "_meta/register-inventory.json"),
        {"collected_at": timestamp, "source_sha256": inv_sha, "resources": reg_resources},
    )
    write_json_atomic(
        safe_project_file(project_root, "_meta/controls-evidence.json"),
        {"collected_at": timestamp, "topology": topology_obs, "configuration": config_obs, "policy": policy_obs},
    )
    if "topology" in categories:
        write_json_atomic(
            safe_project_file(project_root, "_meta/scalar-topology.json"),
            {"collected_at": timestamp, "topology": topology_obs},
        )
    if "policy" in categories:
        write_json_atomic(
            safe_project_file(project_root, "_meta/scoped-policy-observations.json"),
            {"collected_at": timestamp, "policy": policy_obs},
        )
    if "utilization" in categories:
        write_json_atomic(
            safe_project_file(project_root, "_meta/metrics-evidence.json"),
            {"collected_at": timestamp, "utilization": metrics_obs},
        )
    write_json_atomic(
        safe_project_file(project_root, "_meta/diagnostics-recovery-evidence.json"),
        {"collected_at": timestamp, "operations": operations_obs, "recovery": recovery_obs},
    )
    write_json_atomic(
        safe_project_file(project_root, "_meta/01-discovered-evidence.json"),
        {
            "collected_at": timestamp,
            "items": discovered_items,
            "subscriptions": [
                {
                    "scope": inv["scope"],
                    "subscription_id": inv["subscription_id"],
                    "subscription_name": inv.get("subscription_name"),
                    "resource_group": inv["resource_group"],
                    "completeness": "complete" if inv.get("complete") else "partial",
                    "count": inv.get("count", 0),
                    "note": inv.get("note") or inv.get("error", ""),
                }
                for inv in inventories
            ],
        },
    )
    evidence_contract = {"coverage": coverage, "checks": checks}
    write_json_atomic(safe_project_file(project_root, "contracts/assessment-evidence.json"), evidence_contract)
    return evidence_contract


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True, help="Path to agent-output/<project>")
    parser.add_argument(
        "--scope-file",
        type=Path,
        default=None,
        help="Path to assessment-scope.json (defaults to <project-dir>/_meta/assessment-scope.json)",
    )
    parser.add_argument("--as-of", default=None, help="Explicit ISO-8601 collection timestamp")
    args = parser.parse_args(argv)
    try:
        project_dir = args.project_dir.resolve(strict=True)
        scope_path = (args.scope_file or (project_dir / "_meta/assessment-scope.json")).resolve(strict=True)
        scope_request = json.loads(scope_path.read_text(encoding="utf-8"))
        contract = collect_assessment_evidence(project_dir, scope_request, collected_at=args.as_of)
        print(json.dumps({"valid": True, "coverage": contract["coverage"], "check_count": len(contract["checks"])}))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"valid": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
