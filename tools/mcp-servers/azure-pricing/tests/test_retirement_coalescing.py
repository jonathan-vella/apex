from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from azure_pricing_mcp.models import RetirementStatus, VMSeriesRetirementInfo
from azure_pricing_mcp.services.retirement import RetirementService


def retirement_data() -> dict[str, VMSeriesRetirementInfo]:
    return {
        "Dv2": VMSeriesRetirementInfo(
            series_name="Dv2-series",
            status=RetirementStatus.RETIREMENT_ANNOUNCED,
        )
    }


@pytest.mark.asyncio
async def test_concurrent_cache_misses_share_one_fetch(monkeypatch):
    service = RetirementService(Mock())
    release = asyncio.Event()

    async def fetch():
        await release.wait()
        return retirement_data()

    fetch_mock = AsyncMock(side_effect=fetch)
    monkeypatch.setattr(service, "_read_disk_cache", Mock(return_value=None))
    monkeypatch.setattr(service, "_fetch_retirement_data", fetch_mock)
    write_mock = Mock()
    monkeypatch.setattr(service, "_write_disk_cache", write_mock)

    tasks = [asyncio.create_task(service.get_retirement_data()) for _ in range(5)]
    await asyncio.sleep(0)
    release.set()
    results = await asyncio.gather(*tasks)

    assert fetch_mock.await_count == 1
    assert write_mock.call_count == 1
    assert all(result == results[0] for result in results)


@pytest.mark.asyncio
async def test_cancelled_waiter_does_not_cancel_shared_fetch(monkeypatch):
    service = RetirementService(Mock())
    release = asyncio.Event()

    async def fetch():
        await release.wait()
        return retirement_data()

    fetch_mock = AsyncMock(side_effect=fetch)
    monkeypatch.setattr(service, "_read_disk_cache", Mock(return_value=None))
    monkeypatch.setattr(service, "_fetch_retirement_data", fetch_mock)
    monkeypatch.setattr(service, "_write_disk_cache", Mock())

    cancelled = asyncio.create_task(service.get_retirement_data())
    survivor = asyncio.create_task(service.get_retirement_data())
    await asyncio.sleep(0)
    cancelled.cancel()
    with pytest.raises(asyncio.CancelledError):
        await cancelled

    release.set()
    assert await survivor == retirement_data()
    assert fetch_mock.await_count == 1
    await asyncio.sleep(0)
    assert service._fetch_task is None
