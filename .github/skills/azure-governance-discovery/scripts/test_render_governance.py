"""Tests for render_governance.py (shared renderer) and render_cached_governance.py.

Verifies:
1. Shared renderer produces identical output to discover.py for the same envelope.
2. Re-exported aliases in discover.py still resolve.
3. Cached renderer performs no Azure/network calls and produces deterministic output.
"""
from __future__ import annotations

import copy
import importlib
import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Add scripts dir to path so we can import the modules
SCRIPTS_DIR = Path(__file__).parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import render_governance
import render_cached_governance


# ── Fixtures ─────────────────────────────────────────────────────────────────

SAMPLE_ENVELOPE = {
    "schema_version": "governance-constraints-v1",
    "project": "test-project",
    "subscription_id": "00000000-0000-0000-0000-000000000001",
    "discovered_at": "2026-04-20T04:00:00Z",
    "source": "github-actions-baseline",
    "discovery_status": "COMPLETE",
    "discovery_summary": {
        "assignment_total": 10,
        "assignment_kept": 8,
        "defender_auto_filtered": 2,
        "subscription_scope_count": 3,
        "management_group_inherited_count": 5,
        "blocker_count": 1,
        "auto_remediate_count": 1,
        "informational_count": 1,
        "audit_count": 4,
        "disabled_count": 1,
        "exempted_count": 0,
    },
    "assignment_inventory": [],
    "findings": [
        {
            "policy_id": "/providers/microsoft.authorization/policydefinitions/test-deny",
            "display_name": "Deny public blob access",
            "effect": "deny",
            "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
            "assignment_display_name": "No public blobs",
            "assignment_id": "/providers/microsoft.authorization/policyassignments/no-blobs",
            "classification": "blocker",
            "category": "Security",
            "resource_types": ["Microsoft.Storage/storageAccounts"],
            "required_value": False,
            "azurePropertyPath": "properties.allowBlobPublicAccess",
            "bicepPropertyPath": "allowBlobPublicAccess",
            "exemption": None,
            "override": None,
        },
        {
            "policy_id": "/providers/microsoft.authorization/policydefinitions/test-dine",
            "display_name": "Deploy diagnostics",
            "effect": "deployIfNotExists",
            "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
            "assignment_display_name": "Auto diagnostics",
            "assignment_id": "/providers/microsoft.authorization/policyassignments/diag",
            "classification": "auto-remediate",
            "category": "Monitoring",
            "resource_types": ["Microsoft.Storage/storageAccounts"],
            "required_value": None,
            "azurePropertyPath": None,
            "bicepPropertyPath": None,
            "exemption": None,
            "override": None,
        },
    ],
    "policies": [],  # alias — filled at runtime
    "tags_required": [
        {"name": "Environment", "source_policy": "test-policy", "source_assignment": "tag-assign"}
    ],
    "allowed_locations": ["swedencentral", "westeurope"],
}


@pytest.fixture
def envelope():
    """Return a deep copy of the sample envelope."""
    return json.loads(json.dumps(SAMPLE_ENVELOPE))


@pytest.fixture
def arch_file(tmp_path):
    """Create a mock architecture assessment file."""
    arch = tmp_path / "02-architecture-assessment.md"
    arch.write_text(
        "## Resources\n"
        "- Microsoft.Storage/storageAccounts\n"
        "- Microsoft.Compute/virtualMachines\n"
        "- vm-iis-01\n"
    )
    return arch


# ── Tests: Shared Renderer ───────────────────────────────────────────────────


class TestExtractArchResources:
    def test_parses_arm_types(self, arch_file):
        resources = render_governance.extract_arch_resources(arch_file)
        arm_types = [r["arm_type"] for r in resources if r["arm_type"]]
        assert "Microsoft.Storage/storageAccounts" in arm_types
        assert "Microsoft.Compute/virtualMachines" in arm_types

    def test_parses_resource_names(self, arch_file):
        resources = render_governance.extract_arch_resources(arch_file)
        names = [r["name"] for r in resources]
        assert "vm-iis-01" in names

    def test_returns_empty_for_missing_file(self, tmp_path):
        resources = render_governance.extract_arch_resources(tmp_path / "nonexistent.md")
        assert resources == []


class TestEmitPreviewMd:
    def test_writes_preview_file(self, tmp_path, envelope):
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        assert result is not None
        assert result.exists()
        assert result.suffix == ".md"
        content = result.read_text()
        assert "## 🔍 Discovery Source" in content
        assert "## 🚫 Deployment Blockers" in content
        assert "Deny public blob access" in content

    def test_includes_arch_resources(self, tmp_path, envelope, arch_file):
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        arch_resources = render_governance.extract_arch_resources(arch_file)
        result = render_governance.emit_preview_md(envelope, out_path, arch_resources=arch_resources)
        content = result.read_text()
        assert "storageAccounts" in content

    def test_deterministic_output(self, tmp_path, envelope):
        """Two runs with same input produce identical output."""
        out1 = tmp_path / "run1" / "04-governance-constraints.json"
        out2 = tmp_path / "run2" / "04-governance-constraints.json"
        out1.parent.mkdir()
        out2.parent.mkdir()
        out1.write_text(json.dumps(envelope))
        out2.write_text(json.dumps(envelope))
        render_governance.emit_preview_md(envelope, out1)
        render_governance.emit_preview_md(envelope, out2)
        assert out1.with_suffix(".preview.md").read_text() == out2.with_suffix(".preview.md").read_text()

    def test_project_inferred_from_path(self, tmp_path, envelope):
        """When envelope has no 'project' key, infer from output path."""
        del envelope["project"]
        out_path = tmp_path / "agent-output" / "my-proj" / "04-governance-constraints.json"
        out_path.parent.mkdir(parents=True)
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        assert "# 🛡️ Governance Constraints - my-proj" in content
        assert "{project}" not in content

    def test_no_annotation_placeholders_without_arch(self, tmp_path, envelope):
        """Without arch_resources, preview should not contain AGENT annotation placeholders."""
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path, arch_resources=None)
        content = result.read_text()
        assert "<!-- AGENT: annotate" not in content
        assert "<!-- annotate -->" not in content

    def test_annotation_placeholders_with_arch(self, tmp_path, envelope, arch_file):
        """With arch_resources, preview should include placeholders for agent to fill."""
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        arch_resources = render_governance.extract_arch_resources(arch_file)
        result = render_governance.emit_preview_md(envelope, out_path, arch_resources=arch_resources)
        content = result.read_text()
        assert "<!-- annotate -->" in content or "<!-- AGENT: annotate below -->" in content

    def test_null_property_paths_normalized(self, tmp_path, envelope):
        """Null azurePropertyPath/bicepPropertyPath should be normalized to empty string."""
        # Fixture already has None for the DINE finding
        assert envelope["findings"][1]["azurePropertyPath"] is None
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        render_governance.emit_preview_md(envelope, out_path)
        # After emit, the findings should have "" not None
        assert envelope["findings"][1]["azurePropertyPath"] == ""
        assert envelope["findings"][1]["bicepPropertyPath"] == ""

    def test_traffic_light_indicators_present(self, tmp_path, envelope):
        """Preview should contain both ✅ and ❌ indicators for lint compliance."""
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path, arch_resources=None)
        content = result.read_text()
        assert "✅" in content
        assert "❌" in content

    def test_unresolved_tags_split(self, tmp_path, envelope):
        """Unresolved tags should be labeled as such, not show raw [unresolved: ...] names."""
        envelope["tags_required"] = [
            {"name": "Environment", "source_policy": "p1", "source_assignment": "a1"},
            {"name": "[unresolved: Tag Policy]", "unresolved": "true",
             "source_policy": "p2", "source_assignment": "a2"},
        ]
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        assert "`Environment`" in content
        assert "[unresolved: Tag Policy]" not in content
        assert "tag key requires live discovery" in content

    def test_security_cross_references_sfi_policies(self, tmp_path, envelope):
        """Security section should pick up SFI-* policies even if categorized elsewhere."""
        envelope["findings"].append({
            "policy_id": "test-sfi",
            "display_name": "SFI-ID4.2.2 SQL DB - Safe Secrets Standard",
            "effect": "deny",
            "scope": "mg-root",
            "assignment_display_name": "SFI SQL",
            "assignment_id": "sfi-assign",
            "classification": "blocker",
            "category": "SQL",
            "resource_types": [],
            "required_value": None,
            "azurePropertyPath": "",
            "bicepPropertyPath": "",
            "exemption": None,
            "override": None,
        })
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        # Find the Security Policies section
        sec_start = content.index("## 🔐 Security Policies")
        sec_end = content.index("## 💰 Cost Policies")
        sec_section = content[sec_start:sec_end]
        assert "SFI-ID4.2.2" in sec_section

    def test_constraint_values_from_assignment_parameters(self, tmp_path, envelope):
        """Required Value column should show values from assignment_parameters when required_value is null."""
        envelope["findings"].append({
            "policy_id": "test-location",
            "display_name": "Allowed locations",
            "effect": "deny",
            "scope": "mg-root",
            "assignment_display_name": "Location Policy",
            "assignment_id": "loc-assign",
            "classification": "blocker",
            "category": "General",
            "resource_types": [],
            "required_value": None,
            "azurePropertyPath": "properties.location",
            "bicepPropertyPath": "location",
            "exemption": None,
            "override": None,
            "assignment_parameters": {
                "effect": "Audit",
                "listOfAllowedLocations": ["swedencentral", "westeurope", "global"],
            },
        })
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        assert "swedencentral" in content
        assert "westeurope" in content

    def test_blocker_deduplication(self, tmp_path, envelope):
        """Blockers from multiple scopes should be consolidated into one entry."""
        envelope["findings"] = [
            {
                "policy_id": "test-k8s",
                "display_name": "K8s no privileged",
                "effect": "deny",
                "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
                "assignment_display_name": "K8s Policy",
                "assignment_id": "k8s-1",
                "classification": "blocker",
                "category": "Kubernetes",
                "resource_types": [],
                "required_value": None,
                "azurePropertyPath": "",
                "bicepPropertyPath": "type",
                "exemption": None,
                "override": None,
            },
            {
                "policy_id": "test-k8s",
                "display_name": "K8s no privileged",
                "effect": "deny",
                "scope": "/providers/Microsoft.Management/managementGroups/alz",
                "assignment_display_name": "K8s Policy",
                "assignment_id": "k8s-2",
                "classification": "blocker",
                "category": "Kubernetes",
                "resource_types": [],
                "required_value": None,
                "azurePropertyPath": "",
                "bicepPropertyPath": "type",
                "exemption": None,
                "override": None,
            },
        ]
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        # Should show only ONE heading for the policy, not two
        assert content.count("### K8s no privileged") == 1
        # Should show both scopes
        assert "mg-root" in content
        assert "alz" in content
        # Consolidated count note
        assert "2 assignments" in content

    def test_bicep_property_path_type_annotated(self, tmp_path, envelope):
        """Bicep Property Path 'type' should be annotated as resource-type constraint."""
        envelope["findings"] = [{
            "policy_id": "test-k8s",
            "display_name": "K8s images",
            "effect": "deny",
            "scope": "mg-root",
            "assignment_display_name": "K8s",
            "assignment_id": "k8s",
            "classification": "blocker",
            "category": "Kubernetes",
            "resource_types": [],
            "required_value": None,
            "azurePropertyPath": "",
            "bicepPropertyPath": "type",
            "exemption": None,
            "override": None,
        }]
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        assert "resource-type constraint" in content

    def test_compliance_frameworks_section(self, tmp_path, envelope):
        """Notable audit/compliance assignments should appear in Compliance Frameworks section."""
        envelope["assignment_inventory"] = [
            {"displayName": "EU General Data Protection Regulation (GDPR) 2016/679",
             "scope": "/subscriptions/sub1", "assignmentType": "subscription"},
            {"displayName": "PCI DSS v4",
             "scope": "/subscriptions/sub1", "assignmentType": "subscription"},
            {"displayName": "Microsoft Azure Multi Factor Authentication Enforcement for Resource Write Actions",
             "scope": "/providers/Microsoft.Management/managementGroups/mg1",
             "assignmentType": "management-group"},
            {"displayName": "Some Random Assignment",
             "scope": "/subscriptions/sub1", "assignmentType": "subscription"},
        ]
        out_path = tmp_path / "04-governance-constraints.json"
        out_path.write_text(json.dumps(envelope))
        result = render_governance.emit_preview_md(envelope, out_path)
        content = result.read_text()
        assert "## 📜 Compliance Frameworks" in content
        assert "GDPR" in content
        assert "PCI DSS" in content
        assert "Multi Factor Authentication" in content
        # Random non-compliance assignment should NOT appear
        assert "Some Random Assignment" not in content

    def test_effect_suffix_params_not_returned_as_constraint(self, tmp_path, envelope):
        """M3 fix: params ending with 'Effect' (e.g. MonitoringEffect) must not pollute Required Value."""
        env = copy.deepcopy(envelope)
        env["findings"] = [
            {
                "display_name": "Kubernetes cluster containers should only use allowed images",
                "effect": "deny",
                "classification": "blocker",
                "category": "Kubernetes",
                "scope": "/providers/Microsoft.Management/managementGroups/alz",
                "policy_id": "k8s-allowed-images",
                "azurePropertyPath": "properties.type",
                "bicepPropertyPath": "type",
                "required_value": None,
                "assignment_parameters": {
                    "disableUnrestrictedNetworkToStorageAccountMonitoringEffect": "Audit",
                    "fTPSShouldBeRequiredInYourWebAppMonitoringEffect": "Disabled",
                    "keysExpirationSetEffect": "Audit",
                    "windowsWebServersShouldBeConfiguredMinimumTLSVersion": "1.2",
                },
            }
        ]
        out = tmp_path / "agent-output" / "test" / "04-governance-constraints.json"
        out.parent.mkdir(parents=True)
        out.write_text(json.dumps(env))
        render_governance.emit_preview_md(env, out)
        content = out.with_suffix(".preview.md").read_text()
        # Find Policy Definition Analysis rows (7-column rows) for this policy
        policy_analysis_rows = [
            l for l in content.splitlines()
            if "Kubernetes cluster containers" in l and "|" in l
            and len([c for c in l.split("|") if c.strip()]) >= 6  # 7-col table
        ]
        assert policy_analysis_rows, "K8s policy row must appear in Policy Definition Analysis table"
        # The last non-empty cell is Required Value — must not be 'Audit'
        for row in policy_analysis_rows:
            cells = [c.strip() for c in row.split("|") if c.strip()]
            required_value_cell = cells[-1] if len(cells) >= 7 else ""
            assert required_value_cell != "Audit", f"'Audit' leaked as Required Value: {row}"
            assert "1.2" in required_value_cell or required_value_cell == "", (
                f"Expected '1.2' or blank in Required Value, got: {required_value_cell}"
            )

    def test_identical_findings_deduplicated_in_tables(self, tmp_path, envelope):
        """M4 fix: three identical findings (same display_name+scope+policy_id) render as ONE row."""
        env = copy.deepcopy(envelope)
        duplicate_finding = {
            "display_name": "Block VM SKU Sizes",
            "effect": "deny",
            "classification": "blocker",
            "category": "Compute",
            "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
            "policy_id": "/providers/Microsoft.Management/managementGroups/mg-root/providers/Microsoft.Authorization/policyDefinitions/VirtualMachine_SKU_Deny",
            "azurePropertyPath": "properties.hardwareProfile.vmSize",
            "bicepPropertyPath": "properties.hardwareProfile.vmSize",
            "required_value": None,
            "assignment_parameters": None,
        }
        env["findings"] = [duplicate_finding, duplicate_finding, duplicate_finding]
        out = tmp_path / "agent-output" / "test" / "04-governance-constraints.json"
        out.parent.mkdir(parents=True)
        out.write_text(json.dumps(env))
        render_governance.emit_preview_md(env, out)
        content = out.with_suffix(".preview.md").read_text()
        # Count only Policy Definition Analysis rows (7-column rows) for this policy
        policy_analysis_rows = [
            l for l in content.splitlines()
            if "Block VM SKU Sizes" in l and "|" in l
            and len([c for c in l.split("|") if c.strip()]) >= 6  # 7-col analysis table
        ]
        assert len(policy_analysis_rows) == 1, (
            f"Expected 1 deduplicated row in Policy Definition Analysis, got {len(policy_analysis_rows)}: {policy_analysis_rows}"
        )

    def test_unresolved_tags_enriched_from_findings(self, tmp_path, envelope):
        """M1 fix: tags_required [unresolved] entries are enriched from matching findings."""
        env = copy.deepcopy(envelope)
        env["tags_required"] = [
            {
                "unresolved": "true",
                "name": "[unresolved: JV - Inherit Multiple Tags from Resource Group]",
                "source_assignment": "JV - Inherit Multiple Tags from Resource Group",
            }
        ]
        env["findings"] = [
            {
                "display_name": "JV - Inherit Multiple Tags from Resource Group",
                "effect": "modify",
                "classification": "auto-remediate",
                "category": "Tags",
                "scope": "/providers/Microsoft.Management/managementGroups/mg-root",
                "policy_id": "some-policy-id",
                "azurePropertyPath": "",
                "bicepPropertyPath": "",
                "required_value": None,
                "assignment_parameters": {
                    "tagName1": "environment",
                    "tagName2": "owner",
                    "tagName3": "costcenter",
                },
            }
        ]
        out = tmp_path / "agent-output" / "test" / "04-governance-constraints.json"
        out.parent.mkdir(parents=True)
        out.write_text(json.dumps(env))
        render_governance.emit_preview_md(env, out)
        content = out.with_suffix(".preview.md").read_text()
        # Resolved tag names should appear, [unresolved] should NOT
        assert "`environment`" in content
        assert "`owner`" in content
        assert "`costcenter`" in content
        assert "[unresolved]" not in content

    def test_security_count_includes_keyword_matched_policies(self, tmp_path, envelope):
        """M2 fix: Security Policies row in Discovery Source shows keyword-expanded count."""
        env = copy.deepcopy(envelope)
        env["findings"] = [
            {
                "display_name": "Kubernetes clusters should be accessible only over HTTPS",
                "effect": "deny",
                "classification": "blocker",
                "category": "Kubernetes",  # not "Security" category
                "scope": "/providers/Microsoft.Management/managementGroups/alz",
                "policy_id": "k8s-https",
                "azurePropertyPath": "",
                "bicepPropertyPath": "",
                "required_value": None,
                "assignment_parameters": None,
            },
            {
                "display_name": "Configure Microsoft Defender for Key Vault plan",
                "effect": "deployIfNotExists",
                "classification": "auto-remediate",
                "category": "Security Center",  # also not "Security"
                "scope": "/providers/Microsoft.Management/managementGroups/alz",
                "policy_id": "defender-kv",
                "azurePropertyPath": "",
                "bicepPropertyPath": "",
                "required_value": None,
                "assignment_parameters": None,
            },
        ]
        out = tmp_path / "agent-output" / "test" / "04-governance-constraints.json"
        out.parent.mkdir(parents=True)
        out.write_text(json.dumps(env))
        render_governance.emit_preview_md(env, out)
        content = out.with_suffix(".preview.md").read_text()
        # Both policies match security keywords (HTTPS, Key Vault) — count should be 2
        assert "| Security Policies | 2 constraints |" in content


# ── Tests: discover.py re-exports ────────────────────────────────────────────


class TestDiscoverReExports:
    def test_extract_arch_resources_alias(self):
        import discover
        assert hasattr(discover, "_extract_arch_resources")
        assert callable(discover._extract_arch_resources)

    def test_emit_preview_md_alias(self):
        import discover
        assert hasattr(discover, "_emit_preview_md")
        assert callable(discover._emit_preview_md)

    def test_alias_calls_shared_renderer(self, tmp_path, arch_file):
        import discover
        resources = discover._extract_arch_resources(arch_file)
        arm_types = [r["arm_type"] for r in resources if r["arm_type"]]
        assert "Microsoft.Storage/storageAccounts" in arm_types


# ── Tests: Cached Renderer ───────────────────────────────────────────────────


class TestCachedRenderer:
    def test_no_network_calls(self):
        """Verify render_cached_governance imports no network/subprocess modules at module level."""
        import render_cached_governance as mod
        # The module should not import subprocess or urllib.request
        source = Path(mod.__file__).read_text()
        assert "import subprocess" not in source
        assert "import urllib.request" not in source
        assert "import requests" not in source

    def test_writes_output_files(self, tmp_path, envelope):
        in_path = tmp_path / "input.json"
        in_path.write_text(json.dumps(envelope))
        out_path = tmp_path / "agent-output" / "04-governance-constraints.json"
        result = render_cached_governance.main(["--in", str(in_path), "--out", str(out_path)])
        assert result == 0
        assert out_path.exists()
        assert out_path.with_suffix(".preview.md").exists()

    def test_output_matches_shared_renderer(self, tmp_path, envelope):
        """Cached renderer output must be identical to direct shared renderer call."""
        # Direct call
        direct_out = tmp_path / "direct" / "04-governance-constraints.json"
        direct_out.parent.mkdir()
        direct_out.write_text(json.dumps(envelope))
        render_governance.emit_preview_md(envelope, direct_out)

        # Via cached renderer
        in_path = tmp_path / "input.json"
        in_path.write_text(json.dumps(envelope))
        cached_out = tmp_path / "cached" / "04-governance-constraints.json"
        render_cached_governance.main(["--in", str(in_path), "--out", str(cached_out)])

        assert direct_out.with_suffix(".preview.md").read_text() == cached_out.with_suffix(".preview.md").read_text()

    def test_status_json_on_stdout(self, tmp_path, envelope, capsys):
        in_path = tmp_path / "input.json"
        in_path.write_text(json.dumps(envelope))
        out_path = tmp_path / "out" / "04-governance-constraints.json"
        render_cached_governance.main(["--in", str(in_path), "--out", str(out_path)])
        captured = capsys.readouterr()
        status = json.loads(captured.out.strip().split("\n")[0])
        assert status["status"] == "COMPLETE"
        assert status["cached_baseline"] is True

    def test_fails_for_missing_input(self, tmp_path, capsys):
        result = render_cached_governance.main(["--in", str(tmp_path / "nope.json"), "--out", str(tmp_path / "out.json")])
        assert result == 2
        captured = capsys.readouterr()
        status = json.loads(captured.out.strip())
        assert status["status"] == "FAILED"

    def test_fails_for_wrong_schema(self, tmp_path, capsys):
        bad = tmp_path / "bad.json"
        bad.write_text(json.dumps({"schema_version": "wrong"}))
        result = render_cached_governance.main(["--in", str(bad), "--out", str(tmp_path / "out.json")])
        assert result == 2

    def test_deterministic_output(self, tmp_path, envelope):
        """Two runs produce byte-identical output."""
        in_path = tmp_path / "input.json"
        in_path.write_text(json.dumps(envelope))
        out1 = tmp_path / "run1" / "04-governance-constraints.json"
        out2 = tmp_path / "run2" / "04-governance-constraints.json"
        render_cached_governance.main(["--in", str(in_path), "--out", str(out1)])
        render_cached_governance.main(["--in", str(in_path), "--out", str(out2)])
        assert out1.read_text() == out2.read_text()
        assert out1.with_suffix(".preview.md").read_text() == out2.with_suffix(".preview.md").read_text()
