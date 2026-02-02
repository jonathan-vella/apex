"""HTTP client for Azure Pricing API."""

import asyncio
import logging
import ssl
from typing import Any

import aiohttp

from .config import (
    AZURE_PRICING_BASE_URL,
    DEFAULT_API_VERSION,
    MAX_RESULTS_PER_REQUEST,
    MAX_RETRIES,
    RATE_LIMIT_RETRY_BASE_WAIT,
    SSL_VERIFY,
)

logger = logging.getLogger(__name__)


class AzurePricingClient:
    """HTTP client for Azure Pricing API with retry logic."""

    def __init__(self) -> None:
        self.session: aiohttp.ClientSession | None = None
        self._base_url = AZURE_PRICING_BASE_URL
        self._api_version = DEFAULT_API_VERSION

    async def __aenter__(self) -> "AzurePricingClient":
        """Async context manager entry."""
        connector = None
        if not SSL_VERIFY:
            # Create SSL context that doesn't verify certificates
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            logger.warning("SSL verification is disabled. This is insecure and should only be used for debugging.")
        self.session = aiohttp.ClientSession(connector=connector)
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        if self.session:
            await self.session.close()
            self.session = None

    async def make_request(
        self, url: str | None = None, params: dict[str, Any] | None = None, max_retries: int = MAX_RETRIES
    ) -> dict[str, Any]:
        """Make HTTP request to Azure Pricing API with retry logic for rate limiting.

        Args:
            url: Optional URL to request (defaults to base pricing URL)
            params: Query parameters for the request
            max_retries: Maximum number of retry attempts

        Returns:
            JSON response as dictionary

        Raises:
            RuntimeError: If session not initialized
            aiohttp.ClientError: On HTTP errors after retries exhausted
        """
        if not self.session:
            raise RuntimeError("HTTP session not initialized. Use 'async with' context manager.")

        request_url = url or self._base_url
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                async with self.session.get(request_url, params=params) as response:
                    if response.status == 429:  # Too Many Requests
                        if attempt < max_retries:
                            wait_time = RATE_LIMIT_RETRY_BASE_WAIT * (attempt + 1)
                            logger.warning(
                                f"Rate limited (429). Retrying in {wait_time} seconds... "
                                f"(attempt {attempt + 1}/{max_retries + 1})"
                            )
                            await asyncio.sleep(wait_time)
                            continue
                        else:
                            response.raise_for_status()

                    response.raise_for_status()
                    json_data: dict[str, Any] = await response.json()
                    return json_data

            except aiohttp.ClientResponseError as e:
                if e.status == 429 and attempt < max_retries:
                    wait_time = RATE_LIMIT_RETRY_BASE_WAIT * (attempt + 1)
                    logger.warning(
                        f"Rate limited (429). Retrying in {wait_time} seconds... "
                        f"(attempt {attempt + 1}/{max_retries + 1})"
                    )
                    await asyncio.sleep(wait_time)
                    last_exception = e
                    continue
                else:
                    logger.error(f"HTTP request failed: {e}")
                    raise
            except aiohttp.ClientError as e:
                logger.error(f"HTTP request failed: {e}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error during request: {e}")
                raise

        if last_exception:
            raise last_exception
        raise RuntimeError("Request failed without exception")

    async def fetch_prices(
        self,
        filter_conditions: list[str] | None = None,
        currency_code: str = "USD",
        limit: int | None = None,
    ) -> dict[str, Any]:
        """Fetch prices from Azure Pricing API.

        Args:
            filter_conditions: List of OData filter conditions
            currency_code: Currency code for prices
            limit: Maximum number of results

        Returns:
            API response with Items and metadata
        """
        params: dict[str, str] = {
            "api-version": self._api_version,
            "currencyCode": currency_code,
        }

        if filter_conditions:
            params["$filter"] = " and ".join(filter_conditions)

        if limit and limit < MAX_RESULTS_PER_REQUEST:
            params["$top"] = str(limit)

        return await self.make_request(params=params)

    async def fetch_text(self, url: str, timeout: float = 10.0) -> str:
        """Fetch text content from a URL.

        Args:
            url: URL to fetch
            timeout: Request timeout in seconds

        Returns:
            Response text or empty string on failure
        """
        if not self.session:
            raise RuntimeError("HTTP session not initialized. Use 'async with' context manager.")

        try:
            async with self.session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                if response.status == 200:
                    return await response.text()
                return ""
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return ""
