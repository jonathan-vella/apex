"""HTTP client for Azure Pricing API."""

from __future__ import annotations

import asyncio
import logging
import random
import ssl
from typing import Any

import aiohttp

from . import disk_cache
from .config import (
    AZURE_PRICING_BASE_URL,
    DEFAULT_API_VERSION,
    HTTP_POOL_PER_HOST,
    HTTP_POOL_SIZE,
    HTTP_REQUEST_TIMEOUT,
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

    async def __aenter__(self) -> AzurePricingClient:
        """Async context manager entry."""
        ssl_context = None
        if not SSL_VERIFY:
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            logger.warning("SSL verification is disabled. This is insecure and should only be used for debugging.")
        connector = aiohttp.TCPConnector(
            limit=HTTP_POOL_SIZE,
            limit_per_host=HTTP_POOL_PER_HOST,
            ttl_dns_cache=300,
            force_close=False,
            ssl=ssl_context,
        )
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
                async with self.session.get(
                    request_url, params=params, timeout=aiohttp.ClientTimeout(total=HTTP_REQUEST_TIMEOUT)
                ) as response:
                    if response.status == 429:  # Too Many Requests
                        if attempt < max_retries:
                            retry_after = response.headers.get("Retry-After")
                            if retry_after:
                                wait_time = float(retry_after)
                            else:
                                wait_time = RATE_LIMIT_RETRY_BASE_WAIT * (2**attempt) + random.uniform(0, 1)
                            logger.warning(
                                f"Rate limited (429). Retrying in {wait_time:.1f}s "
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
                    wait_time = RATE_LIMIT_RETRY_BASE_WAIT * (2**attempt) + random.uniform(0, 1)
                    logger.warning(
                        f"Rate limited (429). Retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries + 1})"
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

        A disk-backed cache (see ``disk_cache``) is checked first when
        enabled. Cache hits skip the HTTP round-trip entirely; misses fall
        through to the live API and persist the successful response. The
        cache is best-effort — any I/O error is swallowed and logged so a
        broken cache never breaks pricing lookups.

        Disk-cache reads and writes run via ``asyncio.to_thread`` so the
        synchronous filesystem + gzip/JSON work never blocks the event
        loop under concurrent tool calls. Writes are dispatched as
        background tasks so a cache miss does not wait on the persist
        step before returning.

        Args:
            filter_conditions: List of OData filter conditions
            currency_code: Currency code for prices
            limit: Maximum number of results

        Returns:
            API response with Items and metadata
        """
        if disk_cache.is_enabled():
            cached = await asyncio.to_thread(disk_cache.get, filter_conditions, currency_code, limit)
            if cached is not None:
                return cached

        params: dict[str, str] = {
            "api-version": self._api_version,
            "currencyCode": currency_code,
        }

        if filter_conditions:
            params["$filter"] = " and ".join(filter_conditions)

        if limit and limit < MAX_RESULTS_PER_REQUEST:
            params["$top"] = str(limit)

        response = await self.make_request(params=params)

        if disk_cache.is_enabled():
            # Fire-and-forget: don't block the caller on the persist step.
            # ``asyncio.create_task`` keeps the write off the hot path
            # while still running it through the to_thread executor.
            asyncio.create_task(asyncio.to_thread(disk_cache.put, filter_conditions, currency_code, limit, response))

        return response

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
