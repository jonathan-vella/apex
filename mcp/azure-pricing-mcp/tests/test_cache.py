"""Tests for PricingCache."""

from azure_pricing_mcp.cache import PricingCache


class TestPricingCache:
    def test_put_and_get(self, pricing_cache: PricingCache):
        filters = ["serviceName eq 'Virtual Machines'"]
        data = {"Items": [], "Count": 0}
        pricing_cache.put(filters, "USD", data)
        assert pricing_cache.get(filters, "USD") == data

    def test_miss_returns_none(self, pricing_cache: PricingCache):
        assert pricing_cache.get(["nonexistent"], "USD") is None

    def test_different_currency_is_different_key(self, pricing_cache: PricingCache):
        filters = ["serviceName eq 'Storage'"]
        usd_data = {"Items": [{"price": 1}], "Count": 1}
        eur_data = {"Items": [{"price": 0.9}], "Count": 1}
        pricing_cache.put(filters, "USD", usd_data)
        pricing_cache.put(filters, "EUR", eur_data)
        assert pricing_cache.get(filters, "USD") == usd_data
        assert pricing_cache.get(filters, "EUR") == eur_data

    def test_stats_tracking(self, pricing_cache: PricingCache):
        pricing_cache.put(["a"], "USD", {"x": 1})
        pricing_cache.get(["a"], "USD")  # hit
        pricing_cache.get(["b"], "USD")  # miss
        stats = pricing_cache.stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1

    def test_clear(self, pricing_cache: PricingCache):
        pricing_cache.put(["a"], "USD", {"x": 1})
        pricing_cache.clear()
        assert pricing_cache.get(["a"], "USD") is None
        assert pricing_cache.stats["size"] == 0
