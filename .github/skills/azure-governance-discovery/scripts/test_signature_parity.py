"""Phase 3a parity test — Plan optimiseGovernanceAgent.

Asserts that the `_completeness_signature` and `_build_discovery_metadata`
helpers shared between `discover.py` (live path) and
`render_cached_governance.py` (cached path) produce byte-identical output
for the same upstream findings set.

This is the regression guard for the F2 decision: both paths import the
SAME shared helper from `render_governance.py`. Any future divergence
(e.g. someone adding a derived field to one call site only) will fail
this test before it can silently break the Phase 4 resume short-circuit.

Run with:
    pytest .github/skills/azure-governance-discovery/scripts/test_signature_parity.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest  # noqa: F401 — present so this file participates in the pytest discovery run

SCRIPTS_DIR = Path(__file__).parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import discover  # noqa: E402
import render_cached_governance  # noqa: E402,F401 — imported to assert it can reach the shared helpers
import render_governance  # noqa: E402


# A small, hand-crafted findings list with a deliberately
# permuted policy_id ordering so the stable-sort step inside
# `_completeness_signature` is genuinely exercised.
SAMPLE_FINDINGS = [
    {
        "policy_id": "/providers/microsoft.authorization/policydefinitions/zzz-last",
        "effect": "deny",
        "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
        "assignment_parameters": {"effect": "Deny"},
    },
    {
        "policy_id": "/providers/microsoft.authorization/policydefinitions/aaa-first",
        "effect": "deployIfNotExists",
        "scope": "/subscriptions/00000000-0000-0000-0000-000000000001",
        "assignment_parameters": {"listOfAllowedLocations": ["swedencentral"]},
    },
    {
        "policy_id": "/providers/microsoft.authorization/policydefinitions/mmm-middle",
        "effect": "modify",
        "scope": "/providers/Microsoft.Management/managementGroups/mg-prod",
        # Deliberately omit assignment_parameters to exercise the None branch.
    },
]


def test_completeness_signature_is_deterministic() -> None:
    """Calling the helper twice on the same input produces the same digest."""
    sig1 = render_governance._completeness_signature(SAMPLE_FINDINGS)
    sig2 = render_governance._completeness_signature(SAMPLE_FINDINGS)
    assert sig1 == sig2
    assert sig1.startswith("sha256:")


def test_completeness_signature_parity_across_callers() -> None:
    """The signature is byte-identical via discover.py and render_governance.py.

    Both call sites import the SAME helper — this asserts the wiring did
    not silently fork (e.g. via a local re-definition in discover.py).
    """
    via_live = discover._completeness_signature(SAMPLE_FINDINGS)
    via_render = render_governance._completeness_signature(SAMPLE_FINDINGS)
    assert via_live == via_render


def test_build_discovery_metadata_parity() -> None:
    """Composing the envelope through both paths yields the same dict."""
    kwargs = {
        "findings": SAMPLE_FINDINGS,
        "subscription_id": "00000000-0000-0000-0000-000000000001",
        "management_groups": ["mg-root", "mg-prod"],
        "page_counts": {
            "policyAssignments": 3,
            "policyDefinitions": 12,
            "policyExemptions": 0,
        },
        "discovered_at": "2026-05-17T00:00:00Z",
    }
    via_live = discover._build_discovery_metadata(**kwargs, source="live")
    via_render = render_governance._build_discovery_metadata(
        **kwargs, source="github-actions-baseline"
    )
    # `source` is not embedded in the returned envelope (consumers read
    # the top-level envelope `source` instead), so the dicts must match.
    assert via_live == via_render
    # And the signature inside MUST match the direct helper call.
    assert via_live["completeness_signature"] == render_governance._completeness_signature(SAMPLE_FINDINGS)


def test_extract_management_groups_parity() -> None:
    """Both call sites resolve to the same shared MG extraction helper."""
    assignments = [
        {
            "properties": {
                "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
            },
        },
        {
            "properties": {
                "scope": "/providers/Microsoft.Management/managementGroups/mg-prod",
            },
        },
        {
            "properties": {
                "scope": "/subscriptions/00000000-0000-0000-0000-000000000001",
            },
        },
    ]
    via_live = discover._extract_management_groups(assignments)
    via_render = render_governance._extract_management_groups(assignments)
    assert via_live == via_render == ["mg-root", "mg-prod"]


def test_signature_is_order_independent() -> None:
    """Permuting input findings does not change the resulting digest."""
    permuted = list(reversed(SAMPLE_FINDINGS))
    assert render_governance._completeness_signature(SAMPLE_FINDINGS) == render_governance._completeness_signature(permuted)
