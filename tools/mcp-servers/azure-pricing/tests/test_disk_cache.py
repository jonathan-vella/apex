"""Unit tests for the disk-backed pricing-response cache (v5.5)."""

from __future__ import annotations

import asyncio
import gzip
import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from azure_pricing_mcp import disk_cache


@pytest.fixture
def cache_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point the disk cache at an isolated tmp dir and force-enable it.

    ``config.RETIREMENT_DISK_CACHE_DIR`` is read at *import* time, so we
    patch the already-imported attributes in ``disk_cache`` and the source
    ``config`` module rather than relying on env vars.
    """
    from azure_pricing_mcp import config

    monkeypatch.setattr(config, "RETIREMENT_DISK_CACHE_DIR", str(tmp_path), raising=True)
    monkeypatch.setattr(config, "PRICE_DISK_CACHE_ENABLED", True, raising=True)
    # disk_cache imports these names at module load time → patch its copies too.
    monkeypatch.setattr(disk_cache, "RETIREMENT_DISK_CACHE_DIR", str(tmp_path), raising=True)
    monkeypatch.setattr(disk_cache, "PRICE_DISK_CACHE_ENABLED", True, raising=True)
    return tmp_path


_SAMPLE_RESPONSE: dict[str, object] = {
    "Items": [
        {"skuName": "D4s v3", "retailPrice": 0.192, "armRegionName": "eastus"},
    ],
    "Count": 1,
    "NextPageLink": None,
}


class TestRoundTrip:
    def test_put_then_get_returns_same_payload(self, cache_root: Path) -> None:
        filt = ["serviceName eq 'Virtual Machines'", "armRegionName eq 'eastus'"]
        disk_cache.put(filt, "USD", 100, _SAMPLE_RESPONSE)
        cached = disk_cache.get(filt, "USD", 100)
        assert cached == _SAMPLE_RESPONSE

    def test_get_miss_returns_none(self, cache_root: Path) -> None:
        assert disk_cache.get(["serviceName eq 'Storage'"], "USD", 50) is None

    def test_filter_order_does_not_affect_key(self, cache_root: Path) -> None:
        a = ["a eq '1'", "b eq '2'"]
        b = ["b eq '2'", "a eq '1'"]
        disk_cache.put(a, "USD", None, _SAMPLE_RESPONSE)
        assert disk_cache.get(b, "USD", None) == _SAMPLE_RESPONSE

    def test_different_currency_separates_entries(self, cache_root: Path) -> None:
        filt = ["serviceName eq 'Virtual Machines'"]
        disk_cache.put(filt, "USD", None, _SAMPLE_RESPONSE)
        assert disk_cache.get(filt, "EUR", None) is None


class TestNegativeSkip:
    def test_empty_items_not_persisted(self, cache_root: Path) -> None:
        filt = ["skuName eq 'NonExistent'"]
        disk_cache.put(filt, "USD", None, {"Items": [], "Count": 0})
        assert disk_cache.get(filt, "USD", None) is None

    def test_missing_items_key_not_persisted(self, cache_root: Path) -> None:
        filt = ["skuName eq 'NonExistent'"]
        disk_cache.put(filt, "USD", None, {"Count": 0})
        assert disk_cache.get(filt, "USD", None) is None


class TestTTL:
    def test_expired_entry_returns_none_and_deletes_file(
        self, cache_root: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from datetime import timedelta

        monkeypatch.setattr(disk_cache, "PRICE_DISK_CACHE_TTL", timedelta(seconds=0), raising=True)
        filt = ["serviceName eq 'Virtual Machines'"]
        disk_cache.put(filt, "USD", None, _SAMPLE_RESPONSE)
        # Even with TTL=0, mtime equals "now" so we'd race; bump file mtime
        # into the past to guarantee expiry.
        cache_file = next((cache_root / "prices").iterdir())
        past = time.time() - 3600
        os.utime(cache_file, (past, past))
        assert disk_cache.get(filt, "USD", None) is None
        assert not cache_file.exists()


class TestDisabled:
    def test_disabled_get_returns_none(self, cache_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(disk_cache, "PRICE_DISK_CACHE_ENABLED", False, raising=True)
        disk_cache.put(["x eq '1'"], "USD", None, _SAMPLE_RESPONSE)  # no-op
        assert disk_cache.get(["x eq '1'"], "USD", None) is None
        assert not (cache_root / "prices").exists()


class TestCorruption:
    def test_corrupt_file_yields_miss_and_deletes(self, cache_root: Path) -> None:
        filt = ["serviceName eq 'Virtual Machines'"]
        disk_cache.put(filt, "USD", None, _SAMPLE_RESPONSE)
        cache_file = next((cache_root / "prices").iterdir())
        cache_file.write_bytes(b"not a gzip file")
        assert disk_cache.get(filt, "USD", None) is None
        assert not cache_file.exists()


class TestSizeCap:
    def test_eviction_removes_oldest(self, cache_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        # First, write with a generous cap so the entry survives its own sweep.
        monkeypatch.setattr(disk_cache, "PRICE_DISK_CACHE_MAX_BYTES", 10 * 1024 * 1024, raising=True)
        disk_cache.put(["a eq '1'"], "USD", None, _SAMPLE_RESPONSE)
        cache_dir = cache_root / "prices"
        old_file = next(cache_dir.iterdir())
        old_size = old_file.stat().st_size
        # Backdate so the eviction sweep treats it as oldest.
        past = time.time() - 3600
        os.utime(old_file, (past, past))

        # Drop the cap so a second entry forces eviction of the older one.
        # Cap = ``old_size`` (one entry fits, two don't).
        monkeypatch.setattr(disk_cache, "PRICE_DISK_CACHE_MAX_BYTES", old_size, raising=True)
        disk_cache.put(["b eq '2'"], "USD", None, _SAMPLE_RESPONSE)

        remaining = list(cache_dir.iterdir())
        # Older entry evicted; newer kept.
        assert old_file not in remaining
        assert len(remaining) == 1


class TestAtomicity:
    def test_no_tmp_file_left_on_success(self, cache_root: Path) -> None:
        disk_cache.put(["serviceName eq 'Storage'"], "USD", None, _SAMPLE_RESPONSE)
        cache_dir = cache_root / "prices"
        leftover = [p for p in cache_dir.iterdir() if p.suffix == ".tmp"]
        assert leftover == []

    def test_written_file_is_valid_gzip_json(self, cache_root: Path) -> None:
        disk_cache.put(["serviceName eq 'Storage'"], "USD", None, _SAMPLE_RESPONSE)
        cache_file = next((cache_root / "prices").iterdir())
        with gzip.open(cache_file, "rt", encoding="utf-8") as f:
            loaded = json.load(f)
        assert loaded == _SAMPLE_RESPONSE


class TestClientIntegration:
    """Verify ``AzurePricingClient.fetch_prices`` honours the cache."""

    @pytest.mark.asyncio
    async def test_cache_hit_skips_http(self, cache_root: Path) -> None:
        from azure_pricing_mcp.client import AzurePricingClient

        filt = ["serviceName eq 'Virtual Machines'"]
        disk_cache.put(filt, "USD", 10, _SAMPLE_RESPONSE)

        client = AzurePricingClient()
        # ``make_request`` should never be called on a cache hit.
        with patch.object(client, "make_request") as mock_http:
            result = await client.fetch_prices(filter_conditions=filt, currency_code="USD", limit=10)
        assert result == _SAMPLE_RESPONSE
        mock_http.assert_not_called()

    @pytest.mark.asyncio
    async def test_cache_miss_calls_http_and_persists(self, cache_root: Path) -> None:
        from azure_pricing_mcp.client import AzurePricingClient

        filt = ["serviceName eq 'App Service'"]
        client = AzurePricingClient()
        with patch.object(client, "make_request", return_value=_SAMPLE_RESPONSE) as mock_http:
            result = await client.fetch_prices(filter_conditions=filt, currency_code="USD", limit=5)
        assert result == _SAMPLE_RESPONSE
        mock_http.assert_called_once()
        # The persist step is fire-and-forget (asyncio.create_task), so wait
        # for all pending tasks to drain before asserting on-disk state.
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        # Now cached on disk.
        assert disk_cache.get(filt, "USD", 5) == _SAMPLE_RESPONSE


class TestClear:
    def test_clear_removes_all_entries(self, cache_root: Path) -> None:
        disk_cache.put(["a eq '1'"], "USD", None, _SAMPLE_RESPONSE)
        disk_cache.put(["b eq '2'"], "USD", None, _SAMPLE_RESPONSE)
        removed = disk_cache.clear()
        assert removed == 2
        assert disk_cache.get(["a eq '1'"], "USD", None) is None
