from __future__ import annotations

import gzip
import json

import pytest
from governance_baseline import load_governance_json, resolve_path


@pytest.fixture
def baseline() -> dict:
    return {
        "schema_version": "governance-baseline-v1",
        "coverage_status": "COMPLETE",
        "summary": {"total_findings": 3},
        "subscriptions": {"sub-1": {"schema_version": "governance-constraints-v1"}},
    }


def test_loads_plain_and_gzip_json(tmp_path, baseline):
    plain = tmp_path / "baseline.json"
    compressed = tmp_path / "baseline.json.gz"
    payload = json.dumps(baseline).encode()
    plain.write_bytes(payload)
    compressed.write_bytes(gzip.compress(payload, mtime=0))

    assert load_governance_json(plain) == baseline
    assert load_governance_json(compressed) == baseline


def test_resolve_path(baseline):
    assert resolve_path(baseline, "summary.total_findings") == 3
    with pytest.raises(KeyError):
        resolve_path(baseline, "summary.missing")
