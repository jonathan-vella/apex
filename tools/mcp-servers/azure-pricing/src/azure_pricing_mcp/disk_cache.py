"""Disk-backed cache for Azure Retail Prices API responses (v5.5).

Sits below the in-memory dedup layer in ``PricingService``. The flow is:

    in-memory dedup hit?           -> serve, done
    in-memory miss + disk hit?     -> serve, populate in-memory
    in-memory + disk both miss?    -> HTTP, populate both

Persistence survives process restart, which matters for short-lived tool
invocations (CI runners, fresh dev containers, agent retries) where the
process exits before the in-memory dedup cache can amortise.

Design choices:

* **Key**: SHA-256 of canonicalised ``(filter_conditions, currency_code,
  limit)``. Same key the in-memory layer uses, just hashed for filesystem
  safety.
* **Format**: gzip-compressed JSON. Typical filtered responses are 5-50 KB
  before compression and 1-10 KB after. Random-access reads stay fast.
* **Atomicity**: write to ``<key>.json.gz.tmp``, then ``os.replace`` so
  partial writes are never observed by concurrent readers.
* **TTL**: file mtime + ``PRICE_DISK_CACHE_TTL``. Expired files are deleted
  on read.
* **Negative results**: empty ``Items: []`` responses are NOT persisted —
  baking typos into a 24h cache is worse than the redundant HTTP call.
* **Size cap**: enforced lazily on write. When total bytes exceed
  ``PRICE_DISK_CACHE_MAX_BYTES``, oldest entries (by mtime) are evicted.
* **Concurrency**: two coroutines missing the same key may both write —
  idempotent, last writer wins. Atomic rename prevents partial-file reads.

The cache is best-effort: any I/O exception is logged and swallowed so a
broken cache never breaks pricing lookups.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from .config import (
    PRICE_DISK_CACHE_ENABLED,
    PRICE_DISK_CACHE_MAX_BYTES,
    PRICE_DISK_CACHE_SUBDIR,
    PRICE_DISK_CACHE_TTL,
    RETIREMENT_DISK_CACHE_DIR,
)

logger = logging.getLogger(__name__)


def _cache_dir() -> Path:
    return Path(RETIREMENT_DISK_CACHE_DIR) / PRICE_DISK_CACHE_SUBDIR


def _cache_key(filter_conditions: list[str] | None, currency_code: str, limit: int | None) -> str:
    # Canonicalise: sort filter list so logically-equivalent filter orders
    # share a cache entry. The Retail Prices API joins them with ``and``
    # regardless of order.
    canonical = json.dumps(
        {
            "f": sorted(filter_conditions) if filter_conditions else None,
            "c": currency_code,
            "l": limit,
        },
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> Path:
    return _cache_dir() / f"{key}.json.gz"


def is_enabled() -> bool:
    """True when disk caching is on. Cheap; safe to call per request."""
    return PRICE_DISK_CACHE_ENABLED


def get(
    filter_conditions: list[str] | None,
    currency_code: str,
    limit: int | None,
) -> dict[str, Any] | None:
    """Return cached response or ``None`` on miss, expiry, or I/O error."""
    if not PRICE_DISK_CACHE_ENABLED:
        return None

    path = _cache_path(_cache_key(filter_conditions, currency_code, limit))
    if not path.exists():
        return None

    try:
        age = time.time() - path.stat().st_mtime
        if age > PRICE_DISK_CACHE_TTL.total_seconds():
            # Best-effort cleanup; ignore failures (e.g. parallel deletion).
            try:
                path.unlink()
            except OSError:
                pass
            return None

        with gzip.open(path, "rt", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
        logger.debug("Disk cache hit: %s (age=%.0fs)", path.name, age)
        return data
    except (OSError, json.JSONDecodeError, gzip.BadGzipFile) as e:
        logger.warning("Disk cache read failed for %s: %s", path.name, e)
        # Corrupt entry — delete so a fresh fetch can replace it.
        try:
            path.unlink()
        except OSError:
            pass
        return None


def put(
    filter_conditions: list[str] | None,
    currency_code: str,
    limit: int | None,
    response: dict[str, Any],
) -> None:
    """Persist a successful response. Empty ``Items: []`` are not cached."""
    if not PRICE_DISK_CACHE_ENABLED:
        return

    # Skip empty results. A wrong SKU name returns ``Items: []`` and we
    # don't want to bake that into a 24h cache; the in-memory negative TTL
    # (60 s by default) already handles short-window dedup for retries.
    if not response.get("Items"):
        return

    cache_dir = _cache_dir()
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        logger.warning("Could not create disk cache dir %s: %s", cache_dir, e)
        return

    key = _cache_key(filter_conditions, currency_code, limit)
    final_path = _cache_path(key)
    tmp_path = final_path.with_suffix(final_path.suffix + ".tmp")

    try:
        with gzip.open(tmp_path, "wt", encoding="utf-8") as f:
            json.dump(response, f)
        os.replace(tmp_path, final_path)
        logger.debug("Disk cache write: %s", final_path.name)
    except OSError as e:
        logger.warning("Disk cache write failed for %s: %s", final_path.name, e)
        try:
            tmp_path.unlink()
        except OSError:
            pass
        return

    _enforce_size_cap(cache_dir)


def _enforce_size_cap(cache_dir: Path) -> None:
    """Evict oldest entries (by mtime) when total size exceeds the cap.

    Lazy: only walks the directory and only if the cap is exceeded. For a
    cache holding ~10k entries this is cheap (sub-millisecond per stat).
    """
    try:
        entries: list[tuple[Path, os.stat_result]] = []
        total = 0
        for p in cache_dir.iterdir():
            if p.suffix == ".gz" and p.is_file():
                try:
                    st = p.stat()
                except OSError:
                    continue
                entries.append((p, st))
                total += st.st_size

        if total <= PRICE_DISK_CACHE_MAX_BYTES:
            return

        entries.sort(key=lambda e: e[1].st_mtime)
        for path, st in entries:
            if total <= PRICE_DISK_CACHE_MAX_BYTES:
                break
            try:
                path.unlink()
                total -= st.st_size
                logger.debug("Disk cache evicted: %s", path.name)
            except OSError:
                continue
    except OSError as e:
        logger.warning("Disk cache eviction sweep failed: %s", e)


def clear() -> int:
    """Delete every cached entry. Returns count removed. Intended for tests
    and admin use; not exposed as an MCP tool."""
    cache_dir = _cache_dir()
    if not cache_dir.exists():
        return 0
    removed = 0
    for p in cache_dir.iterdir():
        if p.suffix == ".gz" and p.is_file():
            try:
                p.unlink()
                removed += 1
            except OSError:
                pass
    return removed
