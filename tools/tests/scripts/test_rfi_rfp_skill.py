"""Comprehensive unit and integration tests for `.github/skills/apex-rfi-rfp/scripts/`."""

from __future__ import annotations

import importlib.util
import io
import json
import struct
import sys
import zipfile
import zlib
from pathlib import Path
from types import ModuleType
from xml.etree import ElementTree as ET

import openpyxl
import pytest
from openpyxl.worksheet.datavalidation import DataValidation

REPO_ROOT = Path(__file__).resolve().parents[3]
SKILL_SCRIPTS_DIR = REPO_ROOT / ".github" / "skills" / "apex-rfi-rfp" / "scripts"

if str(SKILL_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SKILL_SCRIPTS_DIR))


def _load_skill_module(module_name: str) -> ModuleType:
    script_path = SKILL_SCRIPTS_DIR / f"{module_name}.py"
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)
    return mod


safe_io = _load_skill_module("_safe_io")
extract_mod = _load_skill_module("extract_pursuit_sources")
audit_mod = _load_skill_module("audit_pursuit_skus_and_rates")
xlsx_mod = _load_skill_module("xlsx_ast_cache")
pkg_mod = _load_skill_module("package_pursuit")
verify_mod = _load_skill_module("verify_pursuit_package")


def _make_minimal_png(path: Path, width: int = 3840, height: int = 2160) -> None:
    """Write a valid minimal 1x1-compressed RGB PNG header with arbitrary IHDR dimensions."""

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    # Minimal valid zlib stream so PNG signature + IHDR + IEND form a well-formed header
    idat = zlib.compress(b"\x00\x00\x00\x00")
    png_bytes = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png_bytes)


def _make_synthetic_docx(path: Path, *, with_purview_label: bool = True) -> None:
    """Build a minimal valid OOXML .docx archive in memory and write to disk."""
    doc_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        "<w:r><w:t>Cloud Integration Scope</w:t></w:r></w:p>"
        "<w:p><w:r><w:t>Target region is swedencentral with 99.9% availability.</w:t></w:r></w:p>"
        "<w:tbl>"
        "<w:tr><w:tc><w:p><w:r><w:t>Req ID</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>Requirement</w:t></w:r></w:p></w:tc></w:tr>"
        "<w:tr><w:tc><w:p><w:r><w:t>REQ-01</w:t></w:r></w:p></w:tc>"
        "<w:tc><w:p><w:r><w:t>TLS 1.2 minimum</w:t></w:r></w:p></w:tc></w:tr>"
        "</w:tbl>"
        "</w:body></w:document>"
    )
    custom_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" '
        'name="MSIP_Label_11111111-2222-3333-4444-555555555555_Enabled">'
        "<vt:lpwstr>true</vt:lpwstr></property></Properties>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("word/document.xml", doc_xml)
        zf.writestr("word/media/topology.png", b"\x89PNG\r\n\x1a\nMEDIA")
        if with_purview_label:
            zf.writestr("docProps/custom.xml", custom_xml)
    path.write_bytes(buf.getvalue())


# ============================================================================
# 1. Containment & Safe IO Tests (RD-06)
# ============================================================================


def test_safe_io_rejects_traversal_symlinks_zip_slip_and_dtd(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("secret", encoding="utf-8")

    with pytest.raises(safe_io.ContainmentError):
        safe_io.ensure_within_root(root / ".." / "outside.txt", root)

    sym = root / "link.txt"
    sym.symlink_to(outside)
    with pytest.raises(safe_io.ContainmentError):
        safe_io.ensure_within_root(sym, root)
    with pytest.raises(safe_io.ContainmentError):
        safe_io.sha256_file(sym)

    # Zip-slip member name rejection
    bad_zip = root / "slip.zip"
    with zipfile.ZipFile(bad_zip, "w") as zf:
        zf.writestr("../escape.txt", "boom")
    with pytest.raises(safe_io.ContainmentError, match="traversal"):
        safe_io.open_validated_zip(bad_zip)

    # Backslash path separator rejection
    bs_zip = root / "backslash.zip"
    with zipfile.ZipFile(bs_zip, "w") as zf:
        zf.writestr("xl\\workbook.xml", "<workbook/>")
    with pytest.raises(safe_io.ContainmentError, match="Backslash"):
        safe_io.open_validated_zip(bs_zip)

    # Unix symlink entry inside ZIP rejection
    sym_zip = root / "symlink_entry.zip"
    with zipfile.ZipFile(sym_zip, "w") as zf:
        info = zipfile.ZipInfo("word/document.xml")
        info.external_attr = (0o120777 & 0xFFFF) << 16
        zf.writestr(info, "/etc/passwd")
    with pytest.raises(safe_io.ContainmentError, match="Symlink"):
        safe_io.open_validated_zip(sym_zip)

    # DTD / XXE entity rejection
    xxe_payload = b'<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol">]><root>&lol;</root>'
    with pytest.raises(safe_io.ContainmentError, match="DOCTYPE"):
        safe_io.parse_safe_xml_bytes(xxe_payload)


# ============================================================================
# 2. Source Extraction & Read-Only SHA-256 Guard Tests
# ============================================================================


def test_extract_pursuit_sources_xlsx_docx_eml_and_manifest_guard(tmp_path: Path) -> None:
    pkg_dir = tmp_path / "sample-pursuit"
    src_dir = pkg_dir / "rfi-docs"
    src_dir.mkdir(parents=True)

    # Build .xlsx with visible + hidden dropdown sheet and merged cells
    wb = openpyxl.Workbook()
    ws_main = wb.active
    assert ws_main is not None
    ws_main.title = "Questionnaire"
    ws_main["A1"] = "Section Header"
    ws_main.merge_cells("A1:B1")
    ws_main["A2"] = "Q-01"
    ws_main["B2"] = "Supports TLS 1.2?"
    dv = DataValidation(type="list", formula1="=RefLists!$A$1:$A$3", allow_blank=True)
    ws_main.add_data_validation(dv)
    dv.add("C2:C10")

    ws_hidden = wb.create_sheet("RefLists")
    ws_hidden.sheet_state = "hidden"
    ws_hidden["A1"] = "Compliant"
    ws_hidden["A2"] = "Partially Compliant"
    ws_hidden["A3"] = "Non-Compliant"
    wb.save(src_dir / "rfp-matrix.xlsx")

    # Build .docx with Purview custom property + table + media
    _make_synthetic_docx(src_dir / "scope.docx", with_purview_label=True)

    # Build .eml message
    (src_dir / "clarification.eml").write_text(
        "From: partner@example.invalid\n"
        "To: architect@example.invalid\n"
        "Subject: Budget predictability\n"
        "Content-Type: text/plain; charset=utf-8\n\n"
        "Customer requires fixed monthly tier pricing in swedencentral.\n",
        encoding="utf-8",
    )

    manifest_path = pkg_dir / "_meta" / "source-manifest.json"
    md_out = pkg_dir / "_meta" / "extracted.md"

    rc = extract_mod.main(
        [
            "--source-dir",
            str(src_dir),
            "--root",
            str(pkg_dir),
            "--manifest-out",
            str(manifest_path),
            "--markdown-out",
            str(md_out),
        ]
    )
    assert rc == 0
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["purview_labeled_inputs"] is True
    assert len(manifest["files"]) == 3

    extracted_text = md_out.read_text(encoding="utf-8")
    assert "RefLists" in extracted_text
    assert "hidden" in extracted_text.lower()
    assert "A1:B1" in extracted_text
    assert "Cloud Integration Scope" in extracted_text
    assert "REQ-01" in extracted_text
    assert "Budget predictability" in extracted_text

    # Verify manifest passes when untouched
    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(src_dir),
                "--root",
                str(pkg_dir),
                "--verify-manifest",
                str(manifest_path),
            ]
        )
        == 0
    )

    # Mutate 1 byte in read-only folder -> must fail closed with exit code 1
    (src_dir / "clarification.eml").write_text("tampered", encoding="utf-8")
    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(src_dir),
                "--root",
                str(pkg_dir),
                "--verify-manifest",
                str(manifest_path),
            ]
        )
        == 1
    )


# ============================================================================
# 3. Retail Rate, Tiered Math & Retirement Audit Tests (RD-02, RD-07)
# ============================================================================


def test_audit_pursuit_skus_and_rates_fail_closed_and_tiered_math(tmp_path: Path) -> None:
    items = [
        # DevTest row that must be excluded by default
        {
            "meterId": "devtest-1",
            "serviceName": "Virtual Machines",
            "productName": "Virtual Machines Dlsv5 Series",
            "skuName": "D4ls v5",
            "armSkuName": "Standard_D4ls_v5",
            "meterName": "D4ls v5",
            "armRegionName": "swedencentral",
            "type": "DevTestConsumption",
            "unitOfMeasure": "1 Hour",
            "retailPrice": 0.08,
            "currencyCode": "USD",
            "isPrimaryMeterRegion": True,
            "tierMinimumUnits": 0.0,
        },
        # Production Consumption row with Compute Savings Plan
        {
            "meterId": "prod-vm-1",
            "serviceName": "Virtual Machines",
            "productName": "Virtual Machines Dlsv5 Series",
            "skuName": "D4ls v5",
            "armSkuName": "Standard_D4ls_v5",
            "meterName": "D4ls v5",
            "armRegionName": "swedencentral",
            "type": "Consumption",
            "unitOfMeasure": "1 Hour",
            "retailPrice": 0.17,
            "currencyCode": "USD",
            "isPrimaryMeterRegion": True,
            "tierMinimumUnits": 0.0,
            "savingsPlan": [
                {"term": "1 Year", "retailPrice": 0.12},
                {"term": "3 Years", "retailPrice": 0.08},
            ],
        },
        # Progressive tiered Blob storage rows
        {
            "meterId": "blob-tier-1",
            "serviceName": "Storage",
            "productName": "General Block Blob v2",
            "skuName": "Hot ZRS",
            "armSkuName": "",
            "meterName": "Hot ZRS Data Stored",
            "armRegionName": "swedencentral",
            "type": "Consumption",
            "unitOfMeasure": "1 GB/Month",
            "retailPrice": 0.025,
            "currencyCode": "USD",
            "isPrimaryMeterRegion": True,
            "tierMinimumUnits": 0.0,
        },
        {
            "meterId": "blob-tier-1",
            "serviceName": "Storage",
            "productName": "General Block Blob v2",
            "skuName": "Hot ZRS",
            "armSkuName": "",
            "meterName": "Hot ZRS Data Stored",
            "armRegionName": "swedencentral",
            "type": "Consumption",
            "unitOfMeasure": "1 GB/Month",
            "retailPrice": 0.024,
            "currencyCode": "USD",
            "isPrimaryMeterRegion": True,
            "tierMinimumUnits": 51200.0,
        },
    ]

    vm_res = audit_mod.select_unambiguous_meter(
        items,
        region="swedencentral",
        service_name="Virtual Machines",
        arm_sku_name="Standard_D4ls_v5",
    )
    assert vm_res["meterId"] == "prod-vm-1"
    assert vm_res["retailPrice"] == pytest.approx(0.17)
    assert len(vm_res["savingsPlan"]) == 2

    # Tiered cost across 0..51200 @ 0.025 + 8800 @ 0.024 = 1280 + 211.2 = 1491.2
    blob_res = audit_mod.select_unambiguous_meter(
        items,
        region="swedencentral",
        service_name="Storage",
        meter_name="Hot ZRS Data Stored",
    )
    tiered_cost = audit_mod.compute_tiered_cost(blob_res["tiers"], 60000.0)
    expected_val = float(tiered_cost["total_cost"]) if isinstance(tiered_cost, dict) else float(tiered_cost)
    assert expected_val == pytest.approx(1491.20)

    # Unit normalization (10K operations: 85,000 raw ops -> 8.5 billable units)
    assert audit_mod.normalize_unit_quantity("10K", 85000.0) == pytest.approx(8.5)
    assert audit_mod.normalize_unit_quantity("1M", 2500000.0) == pytest.approx(2.5)

    # Missing meter MUST fail closed as UNRESOLVED (never $0.00)
    with pytest.raises(audit_mod.MeterResolutionError, match="UNRESOLVED"):
        audit_mod.select_unambiguous_meter(
            items,
            region="swedencentral",
            service_name="API Management",
        )

    # Ambiguous meter selection MUST fail closed
    with pytest.raises(audit_mod.MeterResolutionError, match="UNRESOLVED"):
        audit_mod.select_unambiguous_meter(items, region="swedencentral")

    # Retirement audit catches both azure-deprecations.json and curated pursuit traps
    sku_list_path = tmp_path / "skus.json"
    sku_list_path.write_text(
        json.dumps(
            [
                {"service": "Application Gateway", "sku": "Standard_v1", "region": "swedencentral"},
                {"service": "Virtual Machines", "sku": "Standard_F8s_v2", "region": "swedencentral"},
                {"service": "VPN Gateway", "sku": "VpnGw1", "region": "swedencentral"},
                {"service": "Virtual Machines", "sku": "Standard_D8ls_v5", "region": "swedencentral"},
            ]
        ),
        encoding="utf-8",
    )
    audit_report = audit_mod.audit_candidate_skus(
        sku_list_path,
        deprecations_file=REPO_ROOT / ".github" / "data" / "azure-deprecations.json",
    )
    results_by_sku = {r["sku"]: r for r in audit_report["results"]}
    assert results_by_sku["Standard_v1"]["retirement_status"] != "CLEAN"
    assert results_by_sku["Standard_F8s_v2"]["retirement_status"] != "CLEAN"
    assert results_by_sku["VpnGw1"]["retirement_status"] != "CLEAN"
    assert results_by_sku["Standard_D8ls_v5"]["regional_ga_status"] == audit_mod.UNVERIFIED_REGIONAL_GA_STATUS


# ============================================================================
# 4. Excel AST, workbook.xml.rels, Typed <v>, OOXML Footer & Template Diff (RD-03, RD-04)
# ============================================================================


def test_xlsx_ast_cache_rels_resolution_typed_caches_and_fail_closed(tmp_path: Path) -> None:
    template_path = tmp_path / "customer_template.xlsx"
    wb_t = openpyxl.Workbook()
    ws_s = wb_t.active
    assert ws_s is not None
    ws_s.title = "BAFO Summary"
    ws_s["A1"] = "Category"
    ws_s["B1"] = "Monthly Total"
    ws_s.merge_cells("A1:A2")
    dv = DataValidation(type="list", formula1='"USD,EUR"', allow_blank=False)
    ws_s.add_data_validation(dv)
    dv.add("C1")
    ws_s["C1"] = "USD"
    wb_t.save(template_path)

    # Clone customer workbook, add Azure_BOM_USD tab, wire live formulas ( numeric + str + bool + ROUND_HALF_UP )
    populated_path = tmp_path / "populated_bafo.xlsx"
    wb = openpyxl.load_workbook(template_path)
    ws_bom = wb.create_sheet("Assumptions & BOM")
    ws_bom["B1"] = 1.0  # FX_Rate
    ws_bom["B2"] = 2.005  # Tests Excel ROUND_HALF_UP -> 2.01 (Python round gives 2.0)
    ws_bom["B3"] = 1000.0
    ws_bom["B4"] = "=ROUND(B2, 2)"
    ws_bom["B5"] = "=B3 * B1 + B4"

    ws_sum = wb["BAFO Summary"]
    ws_sum["B3"] = "='Assumptions & BOM'!$B$5"
    ws_sum["D3"] = '=IF(\'Assumptions & BOM\'!B1=1,"1P USD DRAFT","CONVERTED")'
    ws_sum["E3"] = "='Assumptions & BOM'!B5>500"
    wb.save(populated_path)

    # Rewrite sheet1.xml -> sheet9.xml inside xl/_rels/workbook.xml.rels to prove rels-based resolution!
    reordered_bytes = io.BytesIO()
    with zipfile.ZipFile(populated_path, "r") as zin, zipfile.ZipFile(reordered_bytes, "w") as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                zout.writestr("xl/worksheets/sheet9.xml", data)
            elif info.filename == "xl/_rels/workbook.xml.rels":
                text = data.decode("utf-8").replace("worksheets/sheet1.xml", "worksheets/sheet9.xml")
                zout.writestr(info.filename, text.encode("utf-8"))
            elif info.filename == "[Content_Types].xml":
                text = data.decode("utf-8").replace("/xl/worksheets/sheet1.xml", "/xl/worksheets/sheet9.xml")
                zout.writestr(info.filename, text.encode("utf-8"))
            else:
                zout.writestr(info.filename, data)
    populated_path.write_bytes(reordered_bytes.getvalue())

    report_json = tmp_path / "xlsx-report.json"
    rc = xlsx_mod.main(
        [
            "--workbook",
            str(populated_path),
            "--compare-template",
            str(template_path),
            "--permutations-json",
            json.dumps({"Assumptions & BOM!B1": [1.0, 18.5]}),
            "--report",
            str(report_json),
        ]
    )
    assert rc == 0
    assert report_json.is_file()

    # Open with data_only=True and confirm exact typed <v> values!
    wb_do = openpyxl.load_workbook(populated_path, data_only=True)
    assert wb_do["Assumptions & BOM"]["B4"].value == pytest.approx(2.01)
    assert wb_do["BAFO Summary"]["B3"].value == pytest.approx(1002.01)
    assert wb_do["BAFO Summary"]["D3"].value == "1P USD DRAFT"
    assert wb_do["BAFO Summary"]["E3"].value is True

    # Inspect raw XML to verify string formula used t="str" (never t="s" sharedStrings index)
    with zipfile.ZipFile(populated_path, "r") as zcheck:
        sheet9_xml = ET.fromstring(zcheck.read("xl/worksheets/sheet9.xml"))
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    d3_el = sheet9_xml.find(".//m:c[@r='D3']", ns)
    assert d3_el is not None
    assert d3_el.attrib.get("t") == "str"

    # --verify (--check-only) passes on injected file
    assert xlsx_mod.main(["--workbook", str(populated_path), "--verify"]) == 0

    # Dropping customer DataValidation fails --compare-template!
    broken_template_clone = tmp_path / "dropped_dv.xlsx"
    wb_drop = openpyxl.load_workbook(populated_path)
    wb_drop["BAFO Summary"].data_validations.dataValidation.clear()
    wb_drop.save(broken_template_clone)
    assert (
        xlsx_mod.main(
            [
                "--workbook",
                str(broken_template_clone),
                "--compare-template",
                str(template_path),
            ]
        )
        == 1
    )

    # Unsupported function (XLOOKUP) must fail closed
    unsupported_path = tmp_path / "unsupported.xlsx"
    wb_u = openpyxl.Workbook()
    ws_u = wb_u.active
    assert ws_u is not None
    ws_u["A1"] = "=XLOOKUP(1, B1:B5, C1:C5)"
    wb_u.save(unsupported_path)
    with pytest.raises(xlsx_mod.UnsupportedFormulaError):
        xlsx_mod.inject_and_verify_caches(unsupported_path)

    # >255-char <oddFooter> must fail closed unless --truncate-long-footers is passed
    long_footer_path = tmp_path / "long_footer.xlsx"
    wb_f = openpyxl.Workbook()
    ws_f = wb_f.active
    assert ws_f is not None
    ws_f["A1"] = "=10+20"
    ws_f.oddFooter.center.text = "CONFIDENTIAL-" * 25  # > 300 chars
    wb_f.save(long_footer_path)

    with pytest.raises(xlsx_mod.HeaderFooterLimitError):
        xlsx_mod.inject_and_verify_caches(long_footer_path)

    trunc_report = xlsx_mod.inject_and_verify_caches(long_footer_path, truncate_long_footers=True)
    assert trunc_report["formulas_evaluated"] == 1


# ============================================================================
# 5. End-to-End Package Verification & Two-Part Purview Gate Tests (RD-05, RD-08)
# ============================================================================


def test_verify_and_package_pursuit_end_to_end(tmp_path: Path) -> None:
    pkg_dir = tmp_path / "contoso-rfp"
    rfi_docs = pkg_dir / "rfi-docs"
    assets_dir = pkg_dir / "assets"
    pricing_dir = pkg_dir / "pricing"
    rfi_docs.mkdir(parents=True)
    assets_dir.mkdir(parents=True)
    pricing_dir.mkdir(parents=True)

    # 1. Read-only input + SHA-256 manifest with Purview sensitivity active
    (rfi_docs / "customer-rfp.txt").write_text("Customer confidential scope", encoding="utf-8")
    manifest_path = pricing_dir / "source-manifest.json"
    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(rfi_docs),
                "--root",
                str(pkg_dir),
                "--purview-labeled",
                "--manifest-out",
                str(manifest_path),
                "--markdown-out",
                str(pkg_dir / "customer-rfp.extracted.md"),
            ]
        )
        == 0
    )

    # 2. Pricing JSON + AST-cached .xlsx with matching $3,405.10 headline
    (pricing_dir / "summary.json").write_text(
        json.dumps({"monthly_usd": 3405.10, "currency": "USD"}, indent=2),
        encoding="utf-8",
    )
    boq_path = pkg_dir / "contoso-rfp.boq.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Summary"
    ws["A1"] = 3000.00
    ws["A2"] = 405.10
    ws["A3"] = "=SUM(A1:A2)"
    wb.save(boq_path)
    xlsx_mod.inject_and_verify_caches(boq_path)

    # 3. 4K Architecture diagram PNG + Canonical ADR + 5-H2 README.md
    _make_minimal_png(assets_dir / "03-des-architecture.png", width=3840, height=2160)
    (pkg_dir / "03-des-adr-0001-integration-tiering.md").write_text(
        "# ADR-0001: Integration Tiering\n\n"
        "## 🔍 Context\n\nContext text.\n\n"
        "## ✅ Decision\n\nDecision text.\n\n"
        "## 🔄 Alternatives Considered\n\nAlternatives.\n\n"
        "## ⚖️ Consequences\n\nConsequences.\n\n"
        "## 🏛️ WAF Pillar Analysis\n\nWAF analysis.\n\n"
        "## 🔒 Compliance Considerations\n\nCompliance.\n\n"
        "## 📝 Implementation Notes\n\nNotes.\n",
        encoding="utf-8",
    )
    (pkg_dir / "README.md").write_text(
        "# Contoso RFP Advisory Package\n\n"
        "> Generated by Copilot agent | 2026-11-24\n\n"
        "## 📋 Project Summary\n\n"
        "Estimated 1P Azure baseline: **$3,405.10** per month in `swedencentral`.\n\n"
        "## ✅ Workflow Progress\n\n"
        "Ad hoc pursuit advisory package; no numbered delivery step completion is asserted.\n\n"
        "## 🏛️ Architecture\n\n"
        "See [Architecture Diagram](./assets/03-des-architecture.png) and "
        "[ADR-0001](./03-des-adr-0001-integration-tiering.md).\n\n"
        "## 📄 Generated Artifacts\n\n"
        "- [BoQ Schedule](./contoso-rfp.boq.xlsx)\n\n"
        "## 🔗 Related Resources\n\n"
        "- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/)\n",
        encoding="utf-8",
    )

    # Nested brief linking '../README.md' inside package_dir is valid under --self-contained
    briefs_dir = pkg_dir / "briefs"
    briefs_dir.mkdir()
    (briefs_dir / "brief-01-integration.md").write_text(
        "# Brief 01\n\nBack to [Package Index](../README.md).\n",
        encoding="utf-8",
    )

    # End-to-end verifier passes!
    assert (
        verify_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--self-contained",
                "--headline-number",
                "$3,405.10",
            ]
        )
        == 0
    )

    # Escaping package_dir via '../../outside.md' must fail under --self-contained
    escape_brief = briefs_dir / "brief-escape.md"
    escape_brief.write_text("# Bad Link\n\nSee [Outside](../../outside.md).\n", encoding="utf-8")
    assert verify_mod.main(["--package-dir", str(pkg_dir), "--self-contained"]) == 1
    escape_brief.unlink()

    # Introducing a reserved delivery filename must fail verify_pursuit_package.py
    reserved_file = pkg_dir / "01-requirements.md"
    reserved_file.write_text("# Reserved collision\n", encoding="utf-8")
    assert verify_mod.main(["--package-dir", str(pkg_dir)]) == 1
    reserved_file.unlink()

    # Two-part Purview release gate: --exclude-restricted-originals ALONE must exit 2!
    assert (
        pkg_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--mode",
                "split",
                "--exclude-restricted-originals",
            ]
        )
        == 2
    )

    # Supplying BOTH --exclude-restricted-originals AND --acknowledge-purview-clearance succeeds!
    out_zips = tmp_path / "dist"
    assert (
        pkg_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--output-dir",
                str(out_zips),
                "--mode",
                "split",
                "--exclude-restricted-originals",
                "--acknowledge-purview-clearance",
                "PURVIEW-TICKET-9921",
            ]
        )
        == 0
    )
    docs_zip = out_zips / "contoso-rfp.docs-and-assets.zip"
    comm_zip = out_zips / "contoso-rfp.commercials-and-tooling.zip"
    assert docs_zip.is_file() and comm_zip.is_file()
    with zipfile.ZipFile(docs_zip, "r") as zd, zipfile.ZipFile(comm_zip, "r") as zc:
        all_archived = set(zd.namelist()) | set(zc.namelist())
    assert not any("rfi-docs/" in name or name.endswith(".extracted.md") for name in all_archived)
    assert any(name.endswith("README.md") for name in all_archived)
    assert any(name.endswith("contoso-rfp.boq.xlsx") for name in all_archived)

    # CR-01: Default package_pursuit run WITHOUT --internal-only or clearance MUST fail closed (exit 2)
    assert pkg_mod.main(["--project-dir", str(pkg_dir), "--output-dir", str(tmp_path / "blocked")]) == 2

    # CR-01: Explicit --internal-only succeeds cleanly for workspace archiving
    internal_out = tmp_path / "internal-dist"
    assert (
        pkg_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--output-dir",
                str(internal_out),
                "--internal-only",
            ]
        )
        == 0
    )

    # CR-08: Reserved 04-governance-constraints.json and nested malformed README.md fail verify_pursuit_package
    gov_json = pkg_dir / "04-governance-constraints.json"
    gov_json.write_text("{}", encoding="utf-8")
    assert verify_mod.main(["--package-dir", str(pkg_dir)]) == 1
    gov_json.unlink()

    nested_bad_readme = briefs_dir / "README.md"
    nested_bad_readme.write_text("# Missing H2s\n", encoding="utf-8")
    assert verify_mod.main(["--package-dir", str(pkg_dir)]) == 1
    nested_bad_readme.unlink()


# ============================================================================
# 6. Code-Review Remediation Regression Tests (CR-02, CR-03, CR-05, CR-06, CR-07)
# ============================================================================


def test_code_review_remediations_xml_symlinks_bundles_defined_names_and_namespaces(tmp_path: Path) -> None:
    # CR-02: UTF-16BE without BOM DOCTYPE/ENTITY & >4KB comment UTF-16LE DOCTYPE must be blocked by Expat
    utf16be_xxe = '<?xml version="1.0" encoding="UTF-16BE"?><!DOCTYPE d [<!ENTITY a "SECRET">]><root>&a;</root>'.encode(
        "utf-16-be"
    )
    with pytest.raises(safe_io.ContainmentError):
        safe_io.parse_safe_xml_bytes(utf16be_xxe)

    long_comment = "<!--" + ("A" * 5000) + "-->"
    utf16le_delayed = f'<?xml version="1.0"?>{long_comment}<!DOCTYPE d [<!ENTITY a "X">]><r>&a;</r>'.encode("utf-16")
    with pytest.raises(safe_io.ContainmentError):
        safe_io.parse_safe_xml_bytes(utf16le_delayed)

    # CR-06: Symlink parent ABOVE --root (like /var -> /private/var) works cleanly
    real_base = tmp_path / "real_mount"
    pursuit_root = real_base / "pursuit"
    (pursuit_root / "rfi-docs").mkdir(parents=True)
    (pursuit_root / "rfi-docs" / "note.txt").write_text("hello swedencentral", encoding="utf-8")

    symlink_mount = tmp_path / "symlink_mount"
    symlink_mount.symlink_to(real_base)
    via_symlink_root = symlink_mount / "pursuit"

    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(via_symlink_root / "rfi-docs"),
                "--root",
                str(via_symlink_root),
                "--manifest-out",
                str(via_symlink_root / "manifest.json"),
            ]
        )
        == 0
    )

    # CR-05: validate_pricing_bundle verifies raw-evidence SHA-256 + meter rate & rejects unverified hashes/DevTest
    raw_vm_evidence = tmp_path / "retail-vm-evidence.raw.json"
    raw_vm_evidence.write_text(
        json.dumps(
            {
                "Items": [
                    {
                        "meterId": "m-123",
                        "serviceName": "Virtual Machines",
                        "productName": "Virtual Machines Dlsv5 Series",
                        "skuName": "D4ls v5",
                        "armSkuName": "Standard_D4ls_v5",
                        "meterName": "D4ls v5",
                        "armRegionName": "swedencentral",
                        "currencyCode": "USD",
                        "type": "Consumption",
                        "unitOfMeasure": "1 Hour",
                        "tierMinimumUnits": 0.0,
                        "effectiveStartDate": "2024-01-01T00:00:00Z",
                        "retailPrice": 0.17,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    vm_ev_sha = safe_io.sha256_file(raw_vm_evidence)

    valid_v2_bundle = tmp_path / "valid-v2.json"
    valid_v2_bundle.write_text(
        json.dumps(
            {
                "schema_version": "cost-estimate-v2",
                "evidence": [{"evidence_path": raw_vm_evidence.name, "sha256": vm_ev_sha}],
                "services": [
                    {
                        "service": "Virtual Machines",
                        "sku": "Standard_D4ls_v5",
                        "region": "swedencentral",
                        "monthly_cost": 124.10,
                        "selected_meter": {
                            "meterId": "m-123",
                            "armSkuName": "Standard_D4ls_v5",
                            "armRegionName": "swedencentral",
                            "priceType": "Consumption",
                            "retailPrice": 0.17,
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(valid_v2_bundle),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 0
    )

    # Bare 64-hex hash without captured evidence bytes MUST fail closed
    unverified_hash_bundle = tmp_path / "unverified-hash-v2.json"
    unverified_hash_bundle.write_text(
        json.dumps(
            {
                "schema_version": "cost-estimate-v2",
                "evidence": [{"sha256": "a" * 64}],
                "services": [
                    {
                        "service": "Virtual Machines",
                        "sku": "Standard_D4ls_v5",
                        "region": "swedencentral",
                        "monthly_cost": 124.10,
                        "selected_meter": {
                            "meterId": "m-123",
                            "armSkuName": "Standard_D4ls_v5",
                            "armRegionName": "swedencentral",
                            "priceType": "Consumption",
                            "retailPrice": 0.17,
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(unverified_hash_bundle),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 1
    )

    bad_devtest_bundle = tmp_path / "bad-devtest.json"
    bad_devtest_bundle.write_text(
        json.dumps(
            {
                "evidence": [{"sha256": "b" * 64}],
                "services": [
                    {
                        "service": "Virtual Machines",
                        "sku": "Standard_F8s_v2",
                        "region": "swedencentral",
                        "monthly_cost": 50.0,
                        "selected_meter": {
                            "meterId": "m-dev",
                            "armSkuName": "Standard_F8s_v2",
                            "armRegionName": "swedencentral",
                            "priceType": "DevTestConsumption",
                            "retailPrice": 0.08,
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(bad_devtest_bundle),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 1
    )

    # CR-03 & CR-07: mc:Ignorable namespace preservation + workbook defined_names + customer <f> formula preservation
    tmpl_xlsx = tmp_path / "tmpl_formulas.xlsx"
    wb_tmpl = openpyxl.Workbook()
    ws_tmpl = wb_tmpl.active
    assert ws_tmpl is not None
    ws_tmpl.title = "Schedule"
    ws_tmpl["B2"] = 100.0
    ws_tmpl["B3"] = "=B2*12"
    wb_tmpl.save(tmpl_xlsx)

    good_out = tmp_path / "good_defined_name.xlsx"
    wb_good = openpyxl.load_workbook(tmpl_xlsx)
    ws_ctrl = wb_good.create_sheet("Controls")
    ws_ctrl["B1"] = 18.5
    wb_good.defined_names["Spot_FX_Rate"] = openpyxl.workbook.defined_name.DefinedName(
        name="Spot_FX_Rate", attr_text="Controls!$B$1"
    )
    wb_good["Schedule"]["C3"] = "=B3*Spot_FX_Rate"
    wb_good.save(good_out)

    # Inject mc:Ignorable="x14ac xr2" with unused xmlns:xr2 onto sheet1.xml before running inject_and_verify_caches
    patched_buf = io.BytesIO()
    with zipfile.ZipFile(good_out, "r") as zin, zipfile.ZipFile(patched_buf, "w") as zout:
        for info in zin.infolist():
            raw = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                txt = raw.decode("utf-8").replace(
                    "<worksheet ",
                    '<worksheet xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
                    'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" '
                    'xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2" '
                    'mc:Ignorable="x14ac xr2" ',
                    1,
                )
                zout.writestr(info.filename, txt.encode("utf-8"))
            else:
                zout.writestr(info.filename, raw)
    good_out.write_bytes(patched_buf.getvalue())

    assert xlsx_mod.main(["--workbook", str(good_out), "--compare-template", str(tmpl_xlsx)]) == 0
    wb_verified = openpyxl.load_workbook(good_out, data_only=True)
    assert wb_verified["Schedule"]["C3"].value == pytest.approx(1200.0 * 18.5)

    with zipfile.ZipFile(good_out, "r") as zpost:
        sheet1_str = zpost.read("xl/worksheets/sheet1.xml").decode("utf-8")
    assert 'xmlns:xr2="http://schemas.microsoft.com/office/spreadsheetml/2015/revision2"' in sheet1_str
    assert 'xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"' in sheet1_str

    # Overwriting customer formula B3 with a hardcoded number must fail --compare-template!
    clobbered_out = tmp_path / "clobbered_formula.xlsx"
    wb_clobber = openpyxl.load_workbook(good_out)
    wb_clobber["Schedule"]["B3"] = 1200.0
    wb_clobber.save(clobbered_out)
    assert xlsx_mod.main(["--workbook", str(clobbered_out), "--compare-template", str(tmpl_xlsx)]) == 1


# ============================================================================
# 7. PR #851 Review & CodeQL Regression Tests
# ============================================================================


def test_pricing_evidence_rate_tampering_and_fetch_persistence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    raw_response_payload = {
        "BillingCurrency": "USD",
        "Items": [
            {
                "meterId": "vm-payg-01",
                "serviceName": "Virtual Machines",
                "productName": "Virtual Machines Dlsv5 Series",
                "skuName": "D4ls v5",
                "armSkuName": "Standard_D4ls_v5",
                "meterName": "D4ls v5",
                "armRegionName": "swedencentral",
                "currencyCode": "USD",
                "type": "Consumption",
                "unitOfMeasure": "1 Hour",
                "tierMinimumUnits": 0.0,
                "isPrimaryMeterRegion": True,
                "effectiveStartDate": "2025-01-01T00:00:00Z",
                "retailPrice": 0.17,
                "savingsPlan": [{"term": "3 Years", "retailPrice": 0.09}],
            },
            {
                "meterId": "vm-ri-3y",
                "serviceName": "Virtual Machines",
                "productName": "Virtual Machines Dlsv5 Series",
                "skuName": "D4ls v5",
                "armSkuName": "Standard_D4ls_v5",
                "meterName": "D4ls v5",
                "armRegionName": "swedencentral",
                "currencyCode": "USD",
                "type": "Reservation",
                "reservationTerm": "3 Years",
                "unitOfMeasure": "1 Hour",
                "tierMinimumUnits": 0.0,
                "isPrimaryMeterRegion": True,
                "effectiveStartDate": "2025-01-01T00:00:00Z",
                "retailPrice": 2100.0,
            },
        ],
        "NextPageLink": None,
    }
    raw_bytes = json.dumps(raw_response_payload).encode("utf-8")

    class _FakeResp:
        def __enter__(self) -> _FakeResp:
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return raw_bytes

    monkeypatch.setattr(audit_mod.urllib.request, "urlopen", lambda *_a, **_kw: _FakeResp())

    quote_out = tmp_path / "quotes" / "vm-quote.json"
    ev_dir = tmp_path / "quotes" / "pricing-evidence"
    assert (
        audit_mod.main(
            [
                "--fetch-filter",
                "armRegionName eq 'swedencentral' and armSkuName eq 'Standard_D4ls_v5'",
                "--region",
                "swedencentral",
                "--arm-sku-name",
                "Standard_D4ls_v5",
                "--out",
                str(quote_out),
                "--evidence-dir",
                str(ev_dir),
            ]
        )
        == 0
    )

    saved_quote = json.loads(quote_out.read_text(encoding="utf-8"))
    assert "retrieved_at" in saved_quote
    assert len(saved_quote["pages"]) == 1
    ev_rel_path = saved_quote["pages"][0]["evidence_path"]
    persisted_raw_file = quote_out.parent / ev_rel_path
    assert persisted_raw_file.is_file()
    assert persisted_raw_file.read_bytes() == raw_bytes

    # Offline --validate-bundle succeeds because verbatim raw response bytes and rates match
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(quote_out),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 0
    )

    # Fabricated rate on a line with a valid evidence hash MUST fail --validate-bundle
    tampered_rate_quote = tmp_path / "quotes" / "tampered-rate.json"
    bad_doc = json.loads(quote_out.read_text(encoding="utf-8"))
    bad_doc["lines"][0]["retailPrice"] = 0.05
    tampered_rate_quote.write_text(json.dumps(bad_doc), encoding="utf-8")
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(tampered_rate_quote),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 1
    )

    # Tampering with persisted raw response bytes on disk MUST fail --validate-bundle
    persisted_raw_file.write_bytes(raw_bytes + b" ")
    assert (
        audit_mod.main(
            [
                "--validate-bundle",
                str(quote_out),
                "--deprecations-file",
                str(REPO_ROOT / ".github" / "data" / "azure-deprecations.json"),
            ]
        )
        == 1
    )


def test_sparse_xlsx_intake_and_ast_evaluation_bounds(tmp_path: Path) -> None:
    # Build a tiny valid .xlsx with populated cells at A1 (=10+5) and XFD1048576 (static 99)
    sparse_xlsx = tmp_path / "rfi-docs" / "sparse.xlsx"
    sparse_xlsx.parent.mkdir(parents=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    assert ws is not None
    ws.title = "Sparse"
    ws["A1"] = "=10+5"
    ws["XFD1048576"] = 99
    wb.save(sparse_xlsx)

    # 1. Intake rejects 17-billion-cell dense table expansion immediately instead of exhausting memory
    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(sparse_xlsx.parent),
                "--root",
                str(tmp_path),
                "--manifest-out",
                str(tmp_path / "manifest.json"),
            ]
        )
        == 1
    )

    # 2. xlsx_ast_cache enumerates only XML formula coordinates and succeeds without instantiating blank cells
    out_sparse = tmp_path / "sparse_cached.xlsx"
    rep = xlsx_mod.inject_and_verify_caches(sparse_xlsx, output_path=out_sparse)
    assert rep["formulas_evaluated"] == 1
    verify_rep = xlsx_mod.verify_workbook_caches(out_sparse)
    assert verify_rep["formulas_evaluated"] == 1

    # 3. Formula referencing an oversized range (=SUM(A1:XFD1048576)) fails closed on cell-expansion budget
    huge_range_xlsx = tmp_path / "huge_range.xlsx"
    wb_r = openpyxl.Workbook()
    ws_r = wb_r.active
    assert ws_r is not None
    ws_r["B1"] = "=SUM(A1:XFD1048576)"
    wb_r.save(huge_range_xlsx)
    with pytest.raises(xlsx_mod.FormulaEvaluationError, match="safety budget"):
        xlsx_mod.inject_and_verify_caches(huge_range_xlsx)


def test_xlsx_counta_empty_string_and_strict_template_preservation(tmp_path: Path) -> None:
    # COUNTA must count formula empty string ="" as 1 while excluding None
    counta_path = tmp_path / "counta.xlsx"
    wb_c = openpyxl.Workbook()
    ws_c = wb_c.active
    assert ws_c is not None
    ws_c["A1"] = '=""'
    ws_c["B1"] = "=COUNTA(A1)"
    ws_c["B2"] = "=COUNTA(A1:A3)"
    wb_c.save(counta_path)
    xlsx_mod.inject_and_verify_caches(counta_path)
    wb_c_val = openpyxl.load_workbook(counta_path, data_only=True)
    assert wb_c_val.active["B1"].value == 1  # type: ignore[index]
    assert wb_c_val.active["B2"].value == 1  # type: ignore[index]

    # Build customer template with DataValidation, formula, shared formula, DefinedName, and protection
    tmpl = tmp_path / "customer_strict.xlsx"
    wb_t = openpyxl.Workbook()
    ws_t = wb_t.active
    assert ws_t is not None
    ws_t.title = "Schedule"
    ws_t["A1"] = 1.25
    ws_t["B2"] = 100.0
    ws_t["B3"] = "=B2*12"
    ws_t["C3"] = "=B3*Rate"
    dv = DataValidation(type="list", formula1='"USD,EUR"', allow_blank=False, showErrorMessage=True)
    ws_t.add_data_validation(dv)
    dv.add("D2")
    wb_t.defined_names["Rate"] = openpyxl.workbook.defined_name.DefinedName(name="Rate", attr_text="Schedule!$A$1")
    wb_t.save(tmpl)

    # 1. Altered DataValidation choices ("USD,EUR" -> "USD,GBP") must fail --compare-template
    bad_dv = tmp_path / "bad_dv.xlsx"
    wb_dv = openpyxl.load_workbook(tmpl)
    wb_dv["Schedule"].data_validations.dataValidation[0].formula1 = '"USD,GBP"'
    wb_dv.save(bad_dv)
    assert xlsx_mod.main(["--workbook", str(bad_dv), "--compare-template", str(tmpl)]) == 1

    # 2. Altered DataValidation enforcement (allowBlank False -> True) must fail --compare-template
    bad_dv_enf = tmp_path / "bad_dv_enf.xlsx"
    wb_dve = openpyxl.load_workbook(tmpl)
    wb_dve["Schedule"].data_validations.dataValidation[0].allow_blank = True
    wb_dve.save(bad_dv_enf)
    assert xlsx_mod.main(["--workbook", str(bad_dv_enf), "--compare-template", str(tmpl)]) == 1

    # 3. Altered customer formula (=B2*12 -> =B2*0) must fail --compare-template
    bad_formula = tmp_path / "bad_formula.xlsx"
    wb_bf = openpyxl.load_workbook(tmpl)
    wb_bf["Schedule"]["B3"] = "=B2*0"
    wb_bf.save(bad_formula)
    assert xlsx_mod.main(["--workbook", str(bad_formula), "--compare-template", str(tmpl)]) == 1

    # 4. Altered DefinedName target (Schedule!$A$1 -> Schedule!$B$1) must fail --compare-template
    bad_dn = tmp_path / "bad_dn.xlsx"
    wb_dn = openpyxl.load_workbook(tmpl)
    wb_dn.defined_names["Rate"] = openpyxl.workbook.defined_name.DefinedName(name="Rate", attr_text="Schedule!$B$1")
    wb_dn.save(bad_dn)
    assert xlsx_mod.main(["--workbook", str(bad_dn), "--compare-template", str(tmpl)]) == 1

    # 5. Shared formula follower alteration & sheetProtection verifier stripping must fail --compare-template
    wb_sp = openpyxl.load_workbook(tmpl)
    ws_sp = wb_sp["Schedule"]
    ws_sp.protection.sheet = True
    ws_sp.protection.algorithmName = "SHA-512"
    ws_sp.protection.hashValue = "YWJjMTIz"
    ws_sp.protection.saltValue = "eHl6MTIz"
    ws_sp.protection.spinCount = 100000
    prot_base = tmp_path / "prot_base.xlsx"
    wb_sp.save(prot_base)

    shared_tmpl = tmp_path / "shared_tmpl.xlsx"
    shared_buf = io.BytesIO()
    with (
        zipfile.ZipFile(prot_base, "r") as zin,
        zipfile.ZipFile(shared_buf, "w", compression=zipfile.ZIP_DEFLATED) as zout,
    ):
        for info in zin.infolist():
            raw = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                xml_txt = raw.decode("utf-8")
                xml_txt = xml_txt.replace(
                    "<f>B2*12</f>",
                    '<f t="shared" ref="B3:B4" si="0">B2*12</f>',
                )
                xml_txt = xml_txt.replace(
                    "</sheetData>",
                    '<row r="4"><c r="B4"><f t="shared" si="0"/></c></row></sheetData>',
                )
                zout.writestr(info.filename, xml_txt.encode("utf-8"))
            else:
                zout.writestr(info.filename, raw)
    shared_tmpl.write_bytes(shared_buf.getvalue())

    # Valid unshared equivalent (B3 = '=B2*12', B4 = '=B3*12') with intact protection passes
    good_shared_out = tmp_path / "good_shared_out.xlsx"
    good_shared_buf = io.BytesIO()
    with (
        zipfile.ZipFile(shared_tmpl, "r") as zin,
        zipfile.ZipFile(good_shared_buf, "w", compression=zipfile.ZIP_DEFLATED) as zout,
    ):
        for info in zin.infolist():
            raw = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                xml_txt = raw.decode("utf-8").replace(
                    '<c r="B4"><f t="shared" si="0"/></c>',
                    '<c r="B4"><f>B3*12</f></c>',
                )
                zout.writestr(info.filename, xml_txt.encode("utf-8"))
            else:
                zout.writestr(info.filename, raw)
    good_shared_out.write_bytes(good_shared_buf.getvalue())
    assert xlsx_mod.main(["--workbook", str(good_shared_out), "--compare-template", str(shared_tmpl)]) == 0

    # Altering shared follower B4 to B3*0 fails --compare-template
    bad_shared_out = tmp_path / "bad_shared_out.xlsx"
    bad_shared_buf = io.BytesIO()
    with (
        zipfile.ZipFile(shared_tmpl, "r") as zin,
        zipfile.ZipFile(bad_shared_buf, "w", compression=zipfile.ZIP_DEFLATED) as zout,
    ):
        for info in zin.infolist():
            raw = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                xml_txt = raw.decode("utf-8").replace(
                    '<c r="B4"><f t="shared" si="0"/></c>',
                    '<c r="B4"><f>B3*0</f></c>',
                )
                zout.writestr(info.filename, xml_txt.encode("utf-8"))
            else:
                zout.writestr(info.filename, raw)
    bad_shared_out.write_bytes(bad_shared_buf.getvalue())
    assert xlsx_mod.main(["--workbook", str(bad_shared_out), "--compare-template", str(shared_tmpl)]) == 1

    # Stripping sheetProtection hashValue fails --compare-template
    stripped_prot_out = tmp_path / "stripped_prot.xlsx"
    stripped_prot_buf = io.BytesIO()
    with (
        zipfile.ZipFile(good_shared_out, "r") as zin,
        zipfile.ZipFile(stripped_prot_buf, "w", compression=zipfile.ZIP_DEFLATED) as zout,
    ):
        for info in zin.infolist():
            raw = zin.read(info.filename)
            if info.filename == "xl/worksheets/sheet1.xml":
                xml_txt = raw.decode("utf-8").replace(' hashValue="YWJjMTIz"', "")
                zout.writestr(info.filename, xml_txt.encode("utf-8"))
            else:
                zout.writestr(info.filename, raw)
    stripped_prot_out.write_bytes(stripped_prot_buf.getvalue())
    assert xlsx_mod.main(["--workbook", str(stripped_prot_out), "--compare-template", str(shared_tmpl)]) == 1


def test_source_inventory_drift_manifest_exclusions_and_pptx_archive_order(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pkg_dir = tmp_path / "bafo-pack"
    src_arch = pkg_dir / "custom-originals"
    src_arch.mkdir(parents=True)
    (src_arch / "customer-schedule.txt").write_text("Restricted customer original", encoding="utf-8")

    meta_dir = pkg_dir / "_meta"
    manifest_path = meta_dir / "source-manifest.json"
    assert (
        extract_mod.main(
            [
                "--source-dir",
                str(src_arch),
                "--root",
                str(pkg_dir),
                "--purview-labeled",
                "--manifest-out",
                str(manifest_path),
            ]
        )
        == 0
    )

    (pkg_dir / "README.md").write_text(
        "# BAFO Pack\n\n"
        "## 📋 Project Summary\n\nSummary.\n\n"
        "## ✅ Workflow Progress\n\nStandalone pursuit; no numbered delivery step completion is asserted.\n\n"
        "## 🏛️ Architecture\n\nSingle-region `swedencentral`.\n\n"
        "## 📄 Generated Artifacts\n\n- [README](./README.md)\n\n"
        "## 🔗 Related Resources\n\n- [Azure Docs](https://learn.microsoft.com/en-us/azure/)\n",
        encoding="utf-8",
    )
    assert verify_mod.main(["--project-dir", str(pkg_dir)]) == 0

    # Adding an unrecorded addendum after intake MUST fail verify_pursuit_package.py
    extra_addendum = src_arch / "unrecorded-addendum.txt"
    extra_addendum.write_text("Late addendum", encoding="utf-8")
    assert verify_mod.main(["--project-dir", str(pkg_dir)]) == 1
    extra_addendum.unlink()
    assert verify_mod.main(["--project-dir", str(pkg_dir)]) == 0

    # Stub scaffold_walkthrough_pptx so the test runs deterministically even without optional python-pptx
    def _stub_scaffold(output_pptx: Path, pricing_json: Path | None = None) -> dict[str, object]:
        output_pptx.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output_pptx, "w", compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", '<?xml version="1.0"?><Types/>')
        return {
            "pptx_path": str(output_pptx),
            "slide_count": 3,
            "aspect_ratio": "16:9",
            "headlines_bound": {"Pricing Currency": "USD"},
            "sha256": safe_io.sha256_file(output_pptx),
        }

    monkeypatch.setattr(pkg_mod, "scaffold_walkthrough_pptx", _stub_scaffold)

    dist_dir = tmp_path / "dist-out"
    deck_in_pkg = pkg_dir / "deliverables" / "walkthrough.pptx"
    assert (
        pkg_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--output-dir",
                str(dist_dir),
                "--scaffold-pptx",
                str(deck_in_pkg),
                "--exclude-restricted-originals",
                "--acknowledge-purview-clearance",
                "PURVIEW-BAFO-101",
            ]
        )
        == 0
    )

    built_zip = dist_dir / "bafo-pack.package.zip"
    assert built_zip.is_file()
    with zipfile.ZipFile(built_zip, "r") as zf:
        archived_members = set(zf.namelist())
    # Manifest-derived custom-originals/ excluded, while newly generated deck IS included in the archive!
    assert "deliverables/walkthrough.pptx" in archived_members
    assert not any(m.startswith("custom-originals/") or m.startswith("_meta/") for m in archived_members)

    # Unresolvable manifest source path must block external release (exit code 2)
    manifest_data = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest_data["source_dir"] = "."
    manifest_path.write_text(json.dumps(manifest_data), encoding="utf-8")
    assert (
        pkg_mod.main(
            [
                "--project-dir",
                str(pkg_dir),
                "--output-dir",
                str(tmp_path / "blocked-dist"),
                "--exclude-restricted-originals",
                "--acknowledge-purview-clearance",
                "PURVIEW-BAFO-101",
            ]
        )
        == 2
    )
