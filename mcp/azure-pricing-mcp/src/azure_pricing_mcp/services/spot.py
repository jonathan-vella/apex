"""Spot VM service for eviction rates, price history, and eviction simulation.

This service provides access to Azure Spot VM data through:
- Azure Resource Graph API (eviction rates, price history)
- Azure Compute API (eviction simulation)

All methods require Azure authentication. If not authenticated, they return
a friendly error message with instructions for how to authenticate.
"""

import json
import logging
from datetime import datetime
from typing import Any

import aiohttp

from ..auth import AzureCredentialManager, get_credential_manager
from ..config import (
    AZURE_COMPUTE_API_VERSION,
    AZURE_RESOURCE_GRAPH_API_VERSION,
    AZURE_RESOURCE_GRAPH_URL,
)

logger = logging.getLogger(__name__)


class SpotService:
    """Service for Spot VM eviction rates, price history, and simulation."""

    def __init__(
        self,
        credential_manager: AzureCredentialManager | None = None,
    ) -> None:
        """Initialize the Spot service.

        Args:
            credential_manager: Optional credential manager. If not provided,
                              uses the singleton instance.
        """
        self._credential_manager = credential_manager or get_credential_manager()
        self._eviction_cache: dict[str, Any] | None = None
        self._eviction_cache_time: datetime | None = None
        self._price_cache: dict[str, Any] | None = None
        self._price_cache_time: datetime | None = None

    def _check_authentication(self) -> dict[str, Any] | None:
        """Check if user is authenticated.

        Returns:
            None if authenticated, error dict if not.
        """
        # Check for initialization errors first
        init_error = self._credential_manager.get_initialization_error()
        if init_error:
            return {
                "error": "authentication_required",
                "message": init_error,
                "help": self._credential_manager.get_authentication_help_message(),
            }

        # Check if we can get a token
        if not self._credential_manager.is_authenticated():
            return {
                "error": "authentication_required",
                "message": "Azure authentication required for Spot VM tools.",
                "help": self._credential_manager.get_authentication_help_message(),
            }

        return None

    async def _execute_resource_graph_query(
        self,
        query: str,
    ) -> dict[str, Any]:
        """Execute a query against Azure Resource Graph.

        Args:
            query: KQL query string for Resource Graph.

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

        url = f"{AZURE_RESOURCE_GRAPH_URL}?api-version={AZURE_RESOURCE_GRAPH_API_VERSION}"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        body = {
            "query": query,
        }

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

    async def get_eviction_rates(
        self,
        skus: list[str],
        locations: list[str],
    ) -> dict[str, Any]:
        """Get Spot VM eviction rates for specified SKUs and locations.

        Args:
            skus: List of VM SKU names (e.g., ["Standard_D2s_v4", "Standard_D4s_v4"]).
            locations: List of Azure regions (e.g., ["eastus", "westus2"]).

        Returns:
            Dict containing eviction rates or error information.
        """
        # Check authentication first
        auth_error = self._check_authentication()
        if auth_error:
            return auth_error

        # Build the query
        sku_filter = ", ".join(f"'{sku.lower()}'" for sku in skus)
        location_filter = ", ".join(f"'{loc.lower()}'" for loc in locations)

        query = f"""
SpotResources
| where type =~ 'microsoft.compute/skuspotevictionrate/location'
| where tolower(sku.name) in~ ({sku_filter})
| where tolower(location) in~ ({location_filter})
| project
    skuName = tostring(sku.name),
    location = location,
    evictionRate = tostring(properties.evictionRate)
| order by location asc, skuName asc
"""

        result = await self._execute_resource_graph_query(query)

        if "error" in result:
            return result

        # Format the response
        data = result.get("data", [])
        return {
            "eviction_rates": data,
            "count": len(data),
            "skus_queried": skus,
            "locations_queried": locations,
            "note": "Eviction rates are categorized as: 0-5%, 5-10%, 10-15%, 15-20%, 20%+",
        }

    async def get_price_history(
        self,
        sku: str,
        location: str,
        os_type: str = "linux",
    ) -> dict[str, Any]:
        """Get Spot VM price history for a specific SKU and location.

        Args:
            sku: VM SKU name (e.g., "Standard_D2s_v4").
            location: Azure region (e.g., "eastus").
            os_type: Operating system type ("linux" or "windows").

        Returns:
            Dict containing price history or error information.
        """
        # Check authentication first
        auth_error = self._check_authentication()
        if auth_error:
            return auth_error

        query = f"""
SpotResources
| where type =~ 'microsoft.compute/skuspotpricehistory/ostype/location'
| where tolower(sku.name) =~ '{sku.lower()}'
| where tolower(properties.osType) =~ '{os_type.lower()}'
| where tolower(location) =~ '{location.lower()}'
| project
    skuName = tostring(sku.name),
    osType = tostring(properties.osType),
    location = location,
    spotPrices = properties.spotPrices
| limit 1
"""

        result = await self._execute_resource_graph_query(query)

        if "error" in result:
            return result

        # Format the response
        data = result.get("data", [])
        if not data:
            return {
                "price_history": [],
                "sku": sku,
                "location": location,
                "os_type": os_type,
                "message": f"No price history found for {sku} in {location} ({os_type})",
            }

        record = data[0]
        spot_prices = record.get("spotPrices", [])

        return {
            "sku": record.get("skuName", sku),
            "location": record.get("location", location),
            "os_type": record.get("osType", os_type),
            "price_history": spot_prices,
            "latest_price_usd": spot_prices[0].get("priceUSD") if spot_prices else None,
            "history_points": len(spot_prices),
            "note": "Price history covers up to 90 days of Spot pricing data",
        }

    async def simulate_eviction(
        self,
        vm_resource_id: str,
    ) -> dict[str, Any]:
        """Simulate eviction of a Spot VM.

        This triggers the eviction flow on the VM, giving it a 30-second notice
        via Scheduled Events before termination.

        Args:
            vm_resource_id: Full Azure resource ID of the VM.
                Example: /subscriptions/{sub}/resourceGroups/{rg}/providers/
                         Microsoft.Compute/virtualMachines/{vmName}

        Returns:
            Dict containing simulation status or error information.
        """
        # Check authentication first
        auth_error = self._check_authentication()
        if auth_error:
            return auth_error

        token = self._credential_manager.get_token()
        if not token:
            return {
                "error": "token_acquisition_failed",
                "message": "Failed to acquire Azure access token.",
                "help": self._credential_manager.get_authentication_help_message(),
            }

        # Parse the resource ID to extract components
        try:
            parts = vm_resource_id.strip("/").split("/")
            # Expected format: subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{vm}
            if len(parts) < 8 or "virtualMachines" not in parts:
                raise ValueError("Invalid VM resource ID format")
        except Exception:
            return {
                "error": "invalid_resource_id",
                "message": "Invalid VM resource ID format.",
                "expected_format": "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}",
            }

        url = (
            f"https://management.azure.com{vm_resource_id}" f"/simulateEviction?api-version={AZURE_COMPUTE_API_VERSION}"
        )
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers) as response:
                    if response.status == 204:
                        return {
                            "status": "success",
                            "message": "Eviction simulation triggered successfully.",
                            "vm_resource_id": vm_resource_id,
                            "note": "The VM will receive a 30-second eviction notice via Scheduled Events.",
                        }
                    elif response.status == 401:
                        return {
                            "error": "unauthorized",
                            "message": "Azure credentials are invalid or expired.",
                            "help": self._credential_manager.get_authentication_help_message(),
                        }
                    elif response.status == 403:
                        return {
                            "error": "forbidden",
                            "message": "Insufficient permissions to simulate eviction.",
                            "help": self._credential_manager.get_required_permissions_message("simulate_eviction"),
                        }
                    elif response.status == 404:
                        return {
                            "error": "not_found",
                            "message": "VM not found or is not a Spot VM.",
                            "vm_resource_id": vm_resource_id,
                        }
                    else:
                        error_text = await response.text()
                        try:
                            error_json = json.loads(error_text)
                            error_message = error_json.get("error", {}).get("message", error_text)
                        except json.JSONDecodeError:
                            error_message = error_text
                        return {
                            "error": "api_error",
                            "message": f"Compute API error: {response.status}",
                            "details": error_message,
                        }
        except aiohttp.ClientError as e:
            return {
                "error": "network_error",
                "message": f"Failed to connect to Azure Compute API: {e}",
            }
