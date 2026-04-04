"""Orphaned Azure resource scanning and cost lookup service.

This service detects orphaned resources (unattached disks, public IPs,
App Service Plans, SQL Elastic Pools, Application Gateways, NAT Gateways,
Load Balancers, Private DNS Zones, Private Endpoints, Virtual Network Gateways,
DDoS Protection Plans) across Azure subscriptions and computes their historical
cost via the Azure Cost Management API.

All methods require Azure authentication. If not authenticated, they return
a friendly error message with instructions for how to authenticate.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import aiohttp

from ..auth import AzureCredentialManager, get_credential_manager

logger = logging.getLogger(__name__)

# Default lookback window for cost queries
COST_LOOKBACK_DAYS = 60

# Azure Cost Management API version
AZURE_COST_MANAGEMENT_API_VERSION = "2023-11-01"

# Azure Resource Manager API versions per resource type
ARM_API_VERSIONS = {
    "disks": "2023-10-02",
    "publicIPAddresses": "2023-11-01",
    "serverfarms": "2023-12-01",
    "subscriptions": "2022-12-01",
}

# Resource Graph query for orphaned disks (unattached managed disks)
ORPHANED_DISKS_QUERY = """
Resources
| where type =~ 'microsoft.compute/disks'
| where managedBy == '' or isnull(managedBy)
| where not(name endswith '-ASRReplica' or name startswith 'ms-asr-')
| project id, name, type, location, resourceGroup,
    subscriptionId, sku = tostring(sku.name),
    diskSizeGb = tostring(properties.diskSizeGB),
    timeCreated = tostring(properties.timeCreated)
"""

# Resource Graph query for orphaned public IPs (not associated)
ORPHANED_PUBLIC_IPS_QUERY = """
Resources
| where type =~ 'microsoft.network/publicipaddresses'
| where isnull(properties.ipConfiguration.id) or properties.ipConfiguration.id == ''
| where isnull(properties.natGateway.id) or properties.natGateway.id == ''
| project id, name, type, location, resourceGroup,
    subscriptionId,
    allocationMethod = tostring(properties.publicIPAllocationMethod)
"""

# Resource Graph query for empty App Service Plans
ORPHANED_ASP_QUERY = """
Resources
| where type =~ 'microsoft.web/serverfarms'
| where properties.numberOfSites == 0
| project id, name, type, location, resourceGroup,
    subscriptionId,
    sku = tostring(sku.name),
    tier = tostring(sku.tier)
"""

# Resource Graph query for orphaned SQL Elastic Pools (no databases)
# Uses leftanti join: keep only pools that have NO matching database.
ORPHANED_SQL_ELASTIC_POOLS_QUERY = """
Resources
| where type =~ 'microsoft.sql/servers/elasticpools'
| extend poolId = tolower(id)
| join kind=leftanti (
    Resources
    | where type =~ 'microsoft.sql/servers/databases'
    | where isnotempty(properties.elasticPoolId)
    | extend poolId = tolower(properties.elasticPoolId)
) on poolId
| project id, name, type, location, resourceGroup,
    subscriptionId,
    sku = tostring(sku.name),
    tier = tostring(sku.tier),
    dtu = tostring(properties.dtu),
    serverName = tostring(split(id, '/')[8])
"""

# Resource Graph query for orphaned Application Gateways (no backend targets)
ORPHANED_APP_GATEWAYS_QUERY = """
Resources
| where type =~ 'microsoft.network/applicationgateways'
| where isnull(properties.backendAddressPools) or array_length(properties.backendAddressPools) == 0
    or properties.backendAddressPools == '[]'
| project id, name, type, location, resourceGroup,
    subscriptionId,
    sku = tostring(sku.name),
    tier = tostring(sku.tier)
"""

# Resource Graph query for orphaned NAT Gateways (not associated with any subnet)
ORPHANED_NAT_GATEWAYS_QUERY = """
Resources
| where type =~ 'microsoft.network/natgateways'
| where isnull(properties.subnets) or array_length(properties.subnets) == 0
| project id, name, type, location, resourceGroup,
    subscriptionId
"""

# Resource Graph query for orphaned Load Balancers (no backend address pools)
ORPHANED_LOAD_BALANCERS_QUERY = """
Resources
| where type =~ 'microsoft.network/loadbalancers'
| where isnull(properties.backendAddressPools) or array_length(properties.backendAddressPools) == 0
| project id, name, type, location, resourceGroup,
    subscriptionId,
    sku = tostring(sku.name)
"""

# Resource Graph query for orphaned Private DNS Zones (no virtual network links)
ORPHANED_PRIVATE_DNS_ZONES_QUERY = """
Resources
| where type =~ 'microsoft.network/privatednszones'
| where isnull(properties.numberOfVirtualNetworkLinks)
    or properties.numberOfVirtualNetworkLinks == 0
| project id, name, type, location, resourceGroup,
    subscriptionId,
    recordSets = tostring(properties.numberOfRecordSets)
"""

# Resource Graph query for orphaned Private Endpoints (no connections or not approved)
# Checks both auto-approved (privateLinkServiceConnections) and manual-approval
# (manualPrivateLinkServiceConnections) arrays to avoid false positives.
ORPHANED_PRIVATE_ENDPOINTS_QUERY = """
Resources
| where type =~ 'microsoft.network/privateendpoints'
| extend autoConns  = array_length(properties.privateLinkServiceConnections)
| extend manualConns = array_length(properties.manualPrivateLinkServiceConnections)
| extend autoStatus  = tostring(properties.privateLinkServiceConnections[0].properties.privateLinkServiceConnectionState.status)
| extend manualStatus = tostring(properties.manualPrivateLinkServiceConnections[0].properties.privateLinkServiceConnectionState.status)
| where (isnull(autoConns) or autoConns == 0) and (isnull(manualConns) or manualConns == 0)
    or ((isnull(autoConns) or autoConns == 0 or autoStatus != 'Approved')
        and (isnull(manualConns) or manualConns == 0 or manualStatus != 'Approved'))
| project id, name, type, location, resourceGroup,
    subscriptionId
"""

# Resource Graph query for orphaned Virtual Network Gateways (no IP configurations)
ORPHANED_VNET_GATEWAYS_QUERY = """
Resources
| where type =~ 'microsoft.network/virtualnetworkgateways'
| where isnull(properties.ipConfigurations) or array_length(properties.ipConfigurations) == 0
| project id, name, type, location, resourceGroup,
    subscriptionId,
    sku = tostring(sku.name),
    gatewayType = tostring(properties.gatewayType)
"""

# Resource Graph query for orphaned DDoS Protection Plans (no virtual networks)
ORPHANED_DDOS_PLANS_QUERY = """
Resources
| where type =~ 'microsoft.network/ddosprotectionplans'
| where isnull(properties.virtualNetworks) or array_length(properties.virtualNetworks) == 0
| project id, name, type, location, resourceGroup,
    subscriptionId
"""


class OrphanedResourceScanner:
    """Scans Azure subscriptions for orphaned resources and looks up their costs."""

    def __init__(
        self,
        credential_manager: AzureCredentialManager | None = None,
    ) -> None:
        """Initialize the orphaned resource scanner.

        Args:
            credential_manager: Optional credential manager. If not provided,
                              uses the singleton instance.
        """
        self._credential_manager = credential_manager or get_credential_manager()

    def _check_authentication(self) -> dict[str, Any] | None:
        """Check if user is authenticated.

        Returns:
            None if authenticated, error dict if not.
        """
        init_error = self._credential_manager.get_initialization_error()
        if init_error:
            return {
                "error": "authentication_required",
                "message": init_error,
                "help": self._credential_manager.get_authentication_help_message(),
            }

        if not self._credential_manager.is_authenticated():
            return {
                "error": "authentication_required",
                "message": "Azure authentication required for orphaned resource scanning.",
                "help": self._credential_manager.get_authentication_help_message(),
            }

        return None

    async def _execute_resource_graph_query(
        self,
        query: str,
        subscription_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Execute a query against Azure Resource Graph.

        Args:
            query: KQL query string for Resource Graph.
            subscription_ids: Optional list of subscription IDs to scope the query.

        Returns:
            Query results or error dict.
        """
        token = self._credential_manager.get_token()
        if not token:
            return {
                "error": "token_acquisition_failed",
                "message": "Failed to acquire Azure access token.",
                "help": self._credential_manager.get_authentication_help_message(),
            }

        url = "https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2022-10-01"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {"query": query}
        if subscription_ids:
            body["subscriptions"] = subscription_ids

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=body) as response:
                    if response.status == 200:
                        result: dict[str, Any] = await response.json()
                        return result
                    elif response.status == 401:
                        return {
                            "error": "unauthorized",
                            "message": "Azure credentials are invalid or expired.",
                            "help": self._credential_manager.get_authentication_help_message(),
                        }
                    elif response.status == 403:
                        return {
                            "error": "forbidden",
                            "message": "Insufficient permissions for Resource Graph query.",
                            "help": self._credential_manager.get_required_permissions_message(),
                        }
                    else:
                        error_text = await response.text()
                        return {
                            "error": "api_error",
                            "message": f"Resource Graph API error: {response.status}",
                            "details": error_text,
                        }
        except aiohttp.ClientError as e:
            return {
                "error": "network_error",
                "message": f"Failed to connect to Azure Resource Graph: {e}",
            }

    async def _get_subscriptions(self) -> list[dict[str, str]] | dict[str, Any]:
        """Get all accessible Azure subscriptions.

        Returns:
            List of subscription dicts with 'id' and 'name' keys, or error dict.
        """
        token = self._credential_manager.get_token()
        if not token:
            return {
                "error": "token_acquisition_failed",
                "message": "Failed to acquire Azure access token.",
                "help": self._credential_manager.get_authentication_help_message(),
            }

        url = f"https://management.azure.com/subscriptions?api-version={ARM_API_VERSIONS['subscriptions']}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        subs = [
                            {
                                "id": sub["subscriptionId"],
                                "name": sub.get("displayName", sub["subscriptionId"]),
                            }
                            for sub in data.get("value", [])
                            if sub.get("state") == "Enabled"
                        ]
                        return subs
                    else:
                        error_text = await response.text()
                        return {
                            "error": "api_error",
                            "message": f"Failed to list subscriptions: {response.status}",
                            "details": error_text,
                        }
        except aiohttp.ClientError as e:
            return {
                "error": "network_error",
                "message": f"Failed to connect to Azure management API: {e}",
            }

    async def _get_resource_cost(
        self,
        subscription_id: str,
        resource_id: str,
        days: int,
    ) -> float | None:
        """Look up accrued cost for a single resource via Cost Management API.

        Args:
            subscription_id: Azure subscription ID.
            resource_id: Full ARM resource ID.
            days: Number of days to look back.

        Returns:
            Total cost in USD, or None if cost data is unavailable.
        """
        token = self._credential_manager.get_token()
        if not token:
            return None

        end_date = datetime.now(timezone.utc)
        start_date = end_date - timedelta(days=days)

        url = (
            f"https://management.azure.com/subscriptions/{subscription_id}"
            f"/providers/Microsoft.CostManagement/query"
            f"?api-version={AZURE_COST_MANAGEMENT_API_VERSION}"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body = {
            "type": "ActualCost",
            "timeframe": "Custom",
            "timePeriod": {
                "from": start_date.strftime("%Y-%m-%dT00:00:00Z"),
                "to": end_date.strftime("%Y-%m-%dT23:59:59Z"),
            },
            "dataset": {
                "granularity": "None",
                "aggregation": {
                    "totalCost": {"name": "Cost", "function": "Sum"},
                },
                "filter": {
                    "dimensions": {
                        "name": "ResourceId",
                        "operator": "In",
                        "values": [resource_id],
                    },
                },
            },
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=body) as response:
                    if response.status == 200:
                        data = await response.json()
                        rows = data.get("properties", {}).get("rows", [])
                        if rows:
                            # First column is the cost value
                            return float(rows[0][0])
                        return 0.0
                    else:
                        logger.debug(f"Cost query failed for {resource_id}: HTTP {response.status}")
                        return None
        except Exception as e:
            logger.debug(f"Cost query error for {resource_id}: {e}")
            return None

    async def scan(
        self,
        days: int = COST_LOOKBACK_DAYS,
        all_subscriptions: bool = True,
    ) -> dict[str, Any]:
        """Scan for orphaned resources and compute their costs.

        Args:
            days: Number of days to look back for cost data.
            all_subscriptions: If True, scan all accessible subscriptions.
                             If False, scan only the first subscription.

        Returns:
            Dict containing orphaned resources grouped by subscription,
            or error dict if authentication fails.
        """
        # Check authentication first
        auth_error = self._check_authentication()
        if auth_error:
            return auth_error

        # Get subscriptions
        subs_result = await self._get_subscriptions()
        if isinstance(subs_result, dict) and "error" in subs_result:
            return subs_result

        subscriptions: list[dict[str, str]] = subs_result  # type: ignore[assignment]
        if not subscriptions:
            return {
                "subscriptions": [],
                "total_orphaned": 0,
                "total_estimated_cost": 0.0,
                "lookback_days": days,
                "message": "No accessible Azure subscriptions found.",
            }

        if not all_subscriptions:
            subscriptions = [subscriptions[0]]

        subscription_ids = [s["id"] for s in subscriptions]

        # Execute all orphaned resource queries in parallel
        queries = {
            "Unattached Disk": ORPHANED_DISKS_QUERY,
            "Orphaned Public IP": ORPHANED_PUBLIC_IPS_QUERY,
            "Empty App Service Plan": ORPHANED_ASP_QUERY,
            "Orphaned SQL Elastic Pool": ORPHANED_SQL_ELASTIC_POOLS_QUERY,
            "Orphaned Application Gateway": ORPHANED_APP_GATEWAYS_QUERY,
            "Orphaned NAT Gateway": ORPHANED_NAT_GATEWAYS_QUERY,
            "Orphaned Load Balancer": ORPHANED_LOAD_BALANCERS_QUERY,
            "Orphaned Private DNS Zone": ORPHANED_PRIVATE_DNS_ZONES_QUERY,
            "Orphaned Private Endpoint": ORPHANED_PRIVATE_ENDPOINTS_QUERY,
            "Orphaned Virtual Network Gateway": ORPHANED_VNET_GATEWAYS_QUERY,
            "Orphaned DDoS Protection Plan": ORPHANED_DDOS_PLANS_QUERY,
        }

        all_orphaned: list[dict[str, Any]] = []

        # Run all Resource Graph queries concurrently
        query_items = list(queries.items())
        results = await asyncio.gather(
            *[self._execute_resource_graph_query(query, subscription_ids) for _, query in query_items],
            return_exceptions=True,
        )

        for (resource_type_label, _), result in zip(query_items, results, strict=False):
            if isinstance(result, Exception):
                logger.warning(f"Failed to query for {resource_type_label}: {result}")
                continue
            if "error" in result:
                logger.warning(f"Failed to query for {resource_type_label}: {result.get('message')}")
                continue

            resources = result.get("data", [])
            for resource in resources:
                resource["orphan_type"] = resource_type_label
                all_orphaned.append(resource)

        # Look up costs for each orphaned resource
        total_cost = 0.0
        for resource in all_orphaned:
            sub_id = resource.get("subscriptionId", "")
            resource_id = resource.get("id", "")
            if sub_id and resource_id:
                cost = await self._get_resource_cost(sub_id, resource_id, days)
                resource["estimated_cost_usd"] = cost
                if cost is not None:
                    total_cost += cost

        # Group results by subscription
        sub_name_map = {s["id"]: s["name"] for s in subscriptions}
        by_subscription: dict[str, dict[str, Any]] = {}
        for resource in all_orphaned:
            sub_id = resource.get("subscriptionId", "unknown")
            if sub_id not in by_subscription:
                by_subscription[sub_id] = {
                    "subscription_id": sub_id,
                    "subscription_name": sub_name_map.get(sub_id, sub_id),
                    "orphaned_resources": [],
                }
            by_subscription[sub_id]["orphaned_resources"].append(resource)

        subscription_results = list(by_subscription.values())

        return {
            "subscriptions": subscription_results,
            "total_orphaned": len(all_orphaned),
            "total_estimated_cost": round(total_cost, 2),
            "lookback_days": days,
            "currency": "USD",
            "note": (
                f"Scanned {len(subscriptions)} subscription(s) for orphaned resources. "
                f"Cost data covers the last {days} days."
            ),
        }
