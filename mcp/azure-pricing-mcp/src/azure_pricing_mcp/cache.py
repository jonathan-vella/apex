"""Caching layer for Azure Pricing API responses.

Uses cachetools TTLCache to reduce redundant API calls for identical queries.
Cache keys are derived from the normalized OData filter + currency code.
"""

import hashlib
import logging
from typing import Any

from cachetools import TTLCache

from .config import PRICING_CACHE_MAX_SIZE, PRICING_CACHE_TTL_SECONDS

logger = logging.getLogger(__name__)


class PricingCache:
    """TTL-based cache for Azure Pricing API responses."""

    def __init__(
        self,
        maxsize: int = PRICING_CACHE_MAX_SIZE,
        ttl: int = PRICING_CACHE_TTL_SECONDS,
    ) -> None:
        self._cache: TTLCache[str, dict[str, Any]] = TTLCache(maxsize=maxsize, ttl=ttl)
        self._hits = 0
        self._misses = 0

    @staticmethod
    def _make_key(filter_conditions: list[str] | None, currency_code: str) -> str:
        """Build a deterministic cache key from query parameters."""
        raw = f"{sorted(filter_conditions or [])}|{currency_code}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def get(self, filter_conditions: list[str] | None, currency_code: str) -> dict[str, Any] | None:
        """Return cached response or None on miss."""
        key = self._make_key(filter_conditions, currency_code)
        result = self._cache.get(key)
        if result is not None:
            self._hits += 1
            logger.debug("Cache HIT (%s hits / %s misses)", self._hits, self._misses)
        else:
            self._misses += 1
            logger.debug("Cache MISS (%s hits / %s misses)", self._hits, self._misses)
        return result

    def put(
        self,
        filter_conditions: list[str] | None,
        currency_code: str,
        data: dict[str, Any],
    ) -> None:
        """Store a response in the cache."""
        key = self._make_key(filter_conditions, currency_code)
        self._cache[key] = data

    def clear(self) -> None:
        """Evict all entries."""
        self._cache.clear()
        logger.info("Pricing cache cleared")

    @property
    def stats(self) -> dict[str, int]:
        """Return hit/miss statistics."""
        return {"hits": self._hits, "misses": self._misses, "size": len(self._cache)}
