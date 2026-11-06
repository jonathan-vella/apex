#!/usr/bin/env python3
"""Deterministic snapshot views; signed amounts and summaries are verified by the Node calculator."""

import argparse
import html
import io
import json
import math
import re
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from xml.etree import ElementTree

import openpyxl
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

SHEETS = ("Action Register", "Financial Summary", "Basis & Evidence")
TABLES = ("ActionRegister", "FinancialSummary", "BasisEvidence")
MONEY_FORMAT = '+#,##0.00;[Green](#,##0.00);"0.00"'
SAVINGS_FORMAT = '[Green]#,##0.00;[Green](#,##0.00);"0.00"'
SOURCE = "contracts/assessment-action-register.json"
MD = "04-assessment-action-register.md"
XLSX = "assets/04-assessment-action-register.xlsx"
STAGED_MD = "_meta/action-register-staged.md"
STAGED_XLSX = "_meta/action-register-staged.xlsx"
SCRIPT = Path(__file__).with_name("assessment-action-register.mjs")
NOTICE = (
    "Generated snapshot: recommendations only, not approved actions, deadlines, an invoice or a forecast. "
    "Edit validated JSON and regenerate; manual workbook edits do not update evidence."
)
ACTION_HEADERS = (
    "Category",
    "Task Name",
    "Priority",
    "Impact",
    "Resources Affected",
    "Estimated Monthly Cost Impact",
    "Implementation Effort",
    "Notes",
    "Comments",
    "Status",
    "Target Window (proposed)",
    "Action ID",
    "WAF Pillars",
    "Finding IDs",
    "Currency",
    "Basis",
    "Exact Monthly Contribution",
)
FINANCE_HEADERS = (
    "Scenario (proposed)",
    "Basis",
    "Currency",
    "Additional Monthly Run-cost",
    "Identified Monthly Savings",
    "Estimated Net Monthly Change",
    "Quantified Actions",
    "Unquantified Actions",
    "Excluded Actions",
    "Conditional Actions",
    "Coverage",
    "Display Rounding Reconciliation",
    "Exact Additions",
    "Exact Savings Magnitude",
    "Exact Net Change",
    "Additions Rounding Reconciliation",
    "Savings Rounding Reconciliation",
)
BASIS_HEADERS = ("Record Type", "ID", "Subject", "Basis / Evidence / Rationale")


def safe_path(root: Path, relative: str, *, missing: bool = False) -> Path:
    if (
        not relative
        or "\\" in relative
        or ":" in relative
        or any(part in ("", ".", "..") for part in relative.split("/"))
        or relative.startswith("/")
        or re.search(r"[\x00-\x1f\x7f]", relative)
    ):
        raise ValueError("Unsafe project-relative path")
    target = root.resolve(strict=True)
    for part in relative.split("/"):
        target = target / part
        if target.is_symlink():
            raise ValueError(f"Symlink forbidden: {relative}")
        if not missing and not target.exists():
            raise ValueError(f"Missing project path: {relative}")
    return target


def clean(value: object) -> str:
    text = "".join(
        character
        for character in str(value)
        if character in "\t\n\r"
        or 0x20 <= ord(character) <= 0xD7FF
        or 0xE000 <= ord(character) <= 0xFFFD
        or 0x10000 <= ord(character) <= 0x10FFFF
    )
    return text.replace("\r\n", "\n").replace("\r", "\n")


def md_text(value: object) -> str:
    text = html.escape(clean(value), quote=True)
    for character in ("\\", "|", "`", "[", "]", "*", "_"):
        text = text.replace(character, "\\" + character)
    return text.replace("\n", "<br>")


def amount(value: str | None) -> Decimal | str:
    return "Not quantified" if value is None else Decimal(value)


def exact(value: str | None) -> str:
    return "Not quantified" if value is None else value


def abbreviated(value: object, limit: int = 800) -> object:
    if not isinstance(value, str) or len(clean(value)) <= limit:
        return value
    return clean(value)[: limit - 55] + " … [full supplied content in Basis & Evidence]"


def verified_payload(root: Path, input_file: Path, as_of: str, supplied: dict | None = None) -> dict:
    expected = safe_path(root, SOURCE)
    if input_file.resolve() != expected or input_file.is_symlink():
        raise ValueError("Canonical input path required")
    result = subprocess.run(
        ["node", str(SCRIPT), "calculate", "--root", str(root), "--input", str(expected), "--as-of", as_of],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if result.returncode:
        raise ValueError(f"Node source/finance validation failed: {result.stdout or result.stderr}")
    payload = json.loads(result.stdout)
    if not payload.get("valid"):
        raise ValueError("Invalid Node calculation response")
    required = ("register", "derived", "source_sha256", "derived_sha256")
    if supplied is not None and any(supplied.get(key) != payload[key] for key in required):
        raise ValueError("Supplied derived summary is not the verified Node calculation")
    payload["_scratch_root"] = str(root.resolve(strict=True))
    return payload


def view_rows(payload: dict) -> list[tuple[tuple[str, ...], list[list[object]]]]:
    register, derived = payload["register"], payload["derived"]
    action_values = {row["id"]: row for row in derived["actions"]}
    resources = {row["id"]: row for row in register["resources"]}
    action_rows = []
    for action in register["actions"]:
        value = action_values[action["id"]]
        affected = []
        for resource_id in action["resource_ids"]:
            resource = resources[resource_id]
            count = "count unknown" if resource["count"] is None else f"evidenced count {resource['count']}"
            affected.append(f"{resource['name']} ({resource['type']}; {count})")
        action_rows.append(
            [
                action["category"],
                action["task"],
                action["priority"],
                action["impact"],
                "; ".join(affected) or "Resource attribution unknown / proposed service",
                amount(value["display_contribution"]),
                action["effort"],
                "; ".join(action["notes"] + [f"Dependencies: {', '.join(action['dependencies']) or 'none supplied'}"]),
                action["comments"],
                action["status"],
                action["target_window"],
                action["id"],
                "; ".join(action["pillars"]),
                "; ".join(action["finding_ids"]),
                value["currency"] or "Unknown currency",
                value["basis_id"],
                exact(value["monthly_contribution"]),
            ]
        )
    scenario_names = {row["id"]: row["name"] for row in register["scenarios"]}
    finance_rows = []
    for scenario in derived["scenarios"]:
        for summary in scenario["summaries"]:
            finance_rows.append(
                [
                    scenario_names[scenario["id"]],
                    "; ".join(summary["basis_ids"]),
                    summary["currency"] or "Unknown currency",
                    amount(summary["display_additions"]),
                    amount(summary["display_savings"]),
                    amount(summary["display_net"]),
                    summary["quantified_count"],
                    summary["unquantified_count"],
                    summary["excluded_count"],
                    summary["conditional_count"],
                    summary["coverage"],
                    amount(summary["display_reconciliation"]),
                    exact(summary["additions"]),
                    exact(summary["savings"]),
                    exact(summary["net"]),
                    amount(summary["display_additions_reconciliation"]),
                    amount(summary["display_savings_reconciliation"]),
                ]
            )
    basis_rows = [
        ["Policy", register["project"], "Generated snapshot", NOTICE],
        [
            "Policy",
            register["project"],
            "Timing",
            "Relative windows are proposed recommendations, never approved dates.",
        ],
        ["Policy", register["project"], "Amounts", derived["rounding_policy"]],
        ["Policy", register["project"], "Excluded cost", "One-time and labor costs are excluded from monthly totals."],
        ["Coverage", register["project"], register["coverage"]["status"], register["coverage"]["reason"]],
    ]
    basis_rows.extend(["Assumption", register["project"], "Assessment basis", note] for note in register["assumptions"])
    for basis in register["bases"]:
        basis_rows.extend(
            [
                "Basis",
                basis["id"],
                key,
                "; ".join(value) if isinstance(value, list) else "Unknown" if value is None else value,
            ]
            for key, value in basis.items()
            if key != "id"
        )
    for reference in register["evidence_refs"]:
        basis_rows.append(
            [
                "Evidence",
                reference["id"],
                reference["kind"],
                f"{reference['path']} | SHA-256 {reference['sha256']} | collected {reference['collected_at']}",
            ]
        )
    for finding in register["findings"]:
        basis_rows.append(
            ["Finding", finding["id"], "; ".join(finding["pillars"]), f"{finding['evidence_id']}#{finding['locator']}"]
        )
    for resource in register["resources"]:
        basis_rows.append(["Resource", resource["id"], resource["name"], json.dumps(resource, ensure_ascii=False)])
    for action in register["actions"]:
        for key in ("task", "notes", "comments", "resource_ids", "status"):
            basis_rows.append(["Action Detail", action["id"], key, json.dumps(action[key], ensure_ascii=False)])
        for key in ("priority_rationale", "impact_rationale", "effort_rationale", "window_rationale"):
            basis_rows.append(["Action", action["id"], key, action[key]])
        basis_rows.append(
            ["Action", action["id"], "Applicability", f"{action['applicability']}; {action.get('condition', '')}"]
        )
        for key in ("alternative_group", "overlap_group", "critical_evidence_id", "lifecycle"):
            if key in action:
                basis_rows.append(["Action", action["id"], key, json.dumps(action[key], ensure_ascii=False)])
        finance = action["finance"]
        basis_rows.append(
            [
                "Finance Input",
                action["id"],
                "Validated source units",
                json.dumps(action_values[action["id"]]["cost_inputs"], ensure_ascii=False),
            ]
        )
        for key in (
            "kind",
            "basis_id",
            "rationale",
            "assumptions",
            "confidence",
            "missing_inputs",
            "current_ref",
            "proposed_ref",
            "opportunity",
            "evidence_ids",
        ):
            if key in finance:
                value = finance[key]
                basis_rows.append(
                    [
                        "Finance Input",
                        action["id"],
                        key,
                        json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else value,
                    ]
                )
    for scenario in register["scenarios"]:
        basis_rows.append(["Scenario", scenario["id"], "Name (proposed)", scenario["name"]])
        for condition in scenario["conditions"]:
            basis_rows.append(["Scenario", scenario["id"], "Condition (proposed)", condition])
        for selection in scenario["selections"]:
            basis_rows.append(
                [
                    "Scenario",
                    scenario["id"],
                    selection["action_id"],
                    f"{'Included' if selection['included'] else 'Excluded'}: {selection['reason']}",
                ]
            )
    for scenario in derived["scenarios"]:
        for entry in scenario["ledger"]:
            basis_rows.append(["Ledger", scenario["id"], entry["action_id"], json.dumps(entry, ensure_ascii=False)])
    fitted_basis = []
    for kind, record_id, subject, detail in basis_rows:
        if len(clean(record_id)) > 300 or len(clean(subject)) > 300:
            detail = f"ID: {record_id}; subject: {subject}; {detail}"
        detail = clean(detail)
        chunks = [detail[offset : offset + 1000] for offset in range(0, len(detail), 1000)] or [""]
        for chunk_index, chunk in enumerate(chunks):
            fitted_basis.append(
                [
                    kind,
                    abbreviated(record_id, 300),
                    abbreviated(subject, 300),
                    (f"Part {chunk_index + 1}/{len(chunks)}: " if len(chunks) > 1 else "") + chunk,
                ]
            )
    return [
        (ACTION_HEADERS, [[abbreviated(value) for value in row] for row in action_rows]),
        (FINANCE_HEADERS, [[abbreviated(value, 300) for value in row] for row in finance_rows]),
        (BASIS_HEADERS, fitted_basis),
    ]


def markdown(payload: dict) -> str:
    register = payload["register"]
    views = view_rows(payload)
    lines = [
        f"# Assessment Action Register — {md_text(register['project'])}",
        "",
        f"> Generated by architect agent | {register['generated_at']} | frozen generated snapshot",
        "",
        "## Executive Summary",
        "",
        NOTICE,
        "",
        f"Assessment source: {register['source']}. As of: {register['as_of']}. "
        f"Evidence-backed actions: {len(register['actions'])}.",
        "",
        f"[Download the generated workbook]({XLSX})",
        "",
        "## Action Register",
        "",
    ]
    if not register["actions"]:
        lines.append(
            "No evidence-backed actions identified."
            if register["coverage"]["status"] == "assessed"
            else "Action identification is incomplete: evidence collection was inaccessible or partial."
        )
        lines.append("")
    lines.extend(md_table(*views[0]))
    lines.extend(["", "## Financial Summary", ""])
    lines.extend(md_table(*views[1]))
    lines.extend(
        [
            "",
            "Positive contributions add recurring run-cost; negative contributions are savings. "
            "Savings magnitude is a separate summary label, not another contribution. "
            "Currencies, actual closed-month estimates and comparable retail bases remain separate.",
            "",
            "## Basis of Estimate",
            "",
            *md_table(*views[2]),
            "",
            "## Coverage and Limitations",
            "",
            f"Coverage: **{register['coverage']['status']}** — {md_text(register['coverage']['reason'])}",
            "",
            "All totals describe the quantified subset, not a complete future workload bill. "
            "Unknown amounts are Not quantified, never zero. Conditional selections are analytical scenarios, "
            "not owner approval. One-time and labor costs are excluded. Status is supplied reporting commentary; "
            "the default Proposed - not started is not an observed implementation state.",
            "",
            "## References",
            "",
            f"- Canonical source: [{SOURCE}]({SOURCE})",
            f"- Workbook: [{XLSX}]({XLSX})",
        ]
    )
    lines.extend(
        f"- `{md_text(ref['id'])}`: `{md_text(ref['path'])}` — SHA-256 `{ref['sha256']}`"
        for ref in register["evidence_refs"]
    )
    return "\n".join(lines) + "\n"


def md_table(headers: tuple[str, ...], rows: list[list[object]]) -> list[str]:
    output = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    for row in rows:
        output.append(
            "| " + " | ".join(md_text(str(value) if isinstance(value, Decimal) else value) for value in row) + " |"
        )
    return output


def fill_sheet(sheet: object, index: int, payload: dict, headers: tuple[str, ...], rows: list[list[object]]) -> None:
    widths = [28, 42, 14, 14, 45, 24, 18, 50, 35, 25, 24, 20, 35, 30, 12, 24, 25] if index == 0 else [28] * len(headers)
    if index == 2:
        widths = [20, 32, 30, 100]
    metadata = [
        f"action-register-v1:{payload['register']['project']}",
        payload["source_sha256"],
        payload["derived_sha256"],
    ]
    for column, value in enumerate(metadata, 1):
        sheet.cell(1, column, clean(value)).data_type = "s"
        sheet.cell(1, column).alignment = Alignment(wrap_text=True, vertical="top")
        sheet.cell(1, column).font = Font(size=9)
    sheet.row_dimensions[1].height = 42
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
    sheet.cell(2, 1, NOTICE).data_type = "s"
    sheet.cell(2, 1).alignment = Alignment(wrap_text=True, vertical="top")
    sheet.row_dimensions[2].height = 60
    for column, header in enumerate(headers, 1):
        cell = sheet.cell(4, column, header)
        cell.data_type = "s"
        cell.fill = PatternFill("solid", fgColor="17365D")
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(wrap_text=True, vertical="top")
    sheet.row_dimensions[4].height = 42
    for row_index, row in enumerate(rows, 5):
        for column, value in enumerate(row, 1):
            cell = sheet.cell(row_index, column)
            if isinstance(value, Decimal):
                numeric = float(value)
                if not math.isfinite(numeric) or Decimal(str(numeric)) != value:
                    raise ValueError("Decimal display is not representable as a safe Excel numeric value")
                cell.value = numeric
                cell.number_format = SAVINGS_FORMAT if index == 1 and column == 5 else MONEY_FORMAT
            elif isinstance(value, int):
                cell.value = value
            else:
                cell.value = clean(value)
                cell.data_type = "s"
            cell.alignment = Alignment(wrap_text=True, vertical="top")
            if index == 0 and column == 3:
                colors = {"Critical": "F4CCCC", "High": "FCE5CD", "Medium": "FFF2CC", "Low": "D9EAD3"}
                cell.fill = PatternFill("solid", fgColor=colors.get(str(value), "FFFFFF"))
        line_count = max(
            sum(max(1, math.ceil(len(line) / max(8, widths[column] - 4))) for line in clean(value).split("\n"))
            for column, value in enumerate(row)
        )
        sheet.row_dimensions[row_index].height = min(409, max(36, 15 * line_count + 10))
    last = max(4, 4 + len(rows))
    table_ref = f"A4:{get_column_letter(len(headers))}{last}"
    table = Table(displayName=TABLES[index], ref=table_ref)
    table.tableStyleInfo = TableStyleInfo(name="TableStyleMedium2", showRowStripes=True)
    sheet.add_table(table)
    sheet.auto_filter.ref = table_ref
    sheet.freeze_panes = "C5" if index == 0 else "A5"
    for column, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.sheet_view.zoomScale = 85
    sheet.print_options.horizontalCentered = False
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.paperSize = sheet.PAPERSIZE_A3
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.print_title_rows = "1:4"
    sheet.print_area = f"A1:{get_column_letter(len(headers))}{last}"
    sheet.oddFooter.center.text = "Assessment Action Register | Generated snapshot | &P / &N"


def workbook_bytes(payload: dict) -> bytes:
    workbook = Workbook()
    workbook.remove(workbook.active)
    stamp = datetime.fromisoformat(payload["register"]["generated_at"].replace("Z", "+00:00")).replace(tzinfo=None)
    workbook.properties.created = stamp
    workbook.properties.modified = stamp
    workbook.properties.creator = "APEX"
    workbook.properties.lastModifiedBy = "APEX"
    workbook.properties.title = f"Assessment Action Register — {payload['register']['project']}"
    for index, (headers, rows) in enumerate(view_rows(payload)):
        fill_sheet(workbook.create_sheet(SHEETS[index]), index, payload, headers, rows)
    raw = io.BytesIO()
    scratch = safe_path(Path(payload["_scratch_root"]), "_meta", missing=True)
    scratch.mkdir(exist_ok=True)
    # openpyxl stages worksheet XML even when the final workbook targets BytesIO.
    previous_tempdir = tempfile.tempdir
    tempfile.tempdir = str(scratch)
    try:
        workbook.save(raw)
    finally:
        tempfile.tempdir = previous_tempdir
    normalized = io.BytesIO()
    zip_stamp = (
        max(1980, min(2107, stamp.year)),
        stamp.month,
        stamp.day,
        stamp.hour,
        stamp.minute,
        stamp.second // 2 * 2,
    )
    with zipfile.ZipFile(raw) as source, zipfile.ZipFile(normalized, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for name in sorted(source.namelist()):
            content = source.read(name)
            if name == "docProps/core.xml":
                content = re.sub(
                    rb"(<dcterms:modified[^>]*>)[^<]+",
                    lambda match: match[1] + stamp.isoformat(timespec="seconds").encode(),
                    content,
                )
            info = zipfile.ZipInfo(name, zip_stamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o600 << 16
            target.writestr(info, content)
    return normalized.getvalue()


def check_archive(content: bytes) -> None:
    if len(content) > 32 * 1024 * 1024:
        raise ValueError("Workbook archive too large")
    required = {
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/sheet2.xml",
        "xl/worksheets/sheet3.xml",
        "xl/tables/table1.xml",
        "xl/tables/table2.xml",
        "xl/tables/table3.xml",
    }
    allowed = required | {
        "docProps/app.xml",
        "docProps/core.xml",
        "xl/theme/theme1.xml",
        "xl/worksheets/_rels/sheet1.xml.rels",
        "xl/worksheets/_rels/sheet2.xml.rels",
        "xl/worksheets/_rels/sheet3.xml.rels",
    }
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        members = archive.infolist()
        names = [member.filename for member in members]
        if len(names) != len(set(names)) or not required.issubset(names) or not set(names).issubset(allowed):
            raise ValueError("Missing/unexpected/duplicate OOXML parts (macros, links and connections forbidden)")
        if len(members) > 64 or sum(member.file_size for member in members) > 32 * 1024 * 1024:
            raise ValueError("Workbook expanded archive too large")
        for member in members:
            if (
                member.file_size > 8 * 1024 * 1024
                or member.file_size > max(1, member.compress_size) * 1000
                or member.flag_bits & 1
                or "\\" in member.filename
                or member.filename.startswith("/")
                or ".." in member.filename.split("/")
            ):
                raise ValueError("Unsafe ZIP member")
            data = archive.read(member)
            if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
                raise ValueError("XML entities forbidden")
            tree = ElementTree.fromstring(data)
            for element in tree.iter():
                local = element.tag.rsplit("}", 1)[-1]
                if local == "f":
                    raise ValueError("Formula cells forbidden")
                if local == "Relationship":
                    target = element.attrib.get("Target", "")
                    if (
                        element.attrib.get("TargetMode") == "External"
                        or ":" in target
                        or "\\" in target
                        or ".." in target.split("/")
                        or "external" in element.attrib.get("Type", "").lower()
                    ):
                        raise ValueError("External/unsafe workbook relationships forbidden")
                if local == "Override" and any(
                    word in element.attrib.get("ContentType", "").lower() for word in ("macro", "vba", "external")
                ):
                    raise ValueError("Executable workbook content forbidden")


def validate_workbook(content: bytes, payload: dict) -> None:
    check_archive(content)
    workbook = load_workbook(io.BytesIO(content), data_only=False, keep_links=False)
    if tuple(workbook.sheetnames) != SHEETS:
        raise ValueError("Workbook must have the exact three report sheets")
    for index, (headers, rows) in enumerate(view_rows(payload)):
        sheet = workbook[SHEETS[index]]
        metadata = [
            f"action-register-v1:{payload['register']['project']}",
            payload["source_sha256"],
            payload["derived_sha256"],
        ]
        if [sheet.cell(1, column).value for column in range(1, 4)] != metadata or sheet.cell(2, 1).value != NOTICE:
            raise ValueError("Workbook dataset identity/metadata mismatch")
        if sheet.sheet_state != "visible" or {str(value) for value in sheet.merged_cells.ranges} != {
            f"A2:{get_column_letter(len(headers))}2"
        }:
            raise ValueError("Hidden sheets and merged report tables forbidden")
        if any(value.hidden for value in sheet.row_dimensions.values()) or any(
            value.hidden for value in sheet.column_dimensions.values()
        ):
            raise ValueError("Hidden report rows/columns forbidden")
        for row in (1, 2, 3):
            for col in range(1, len(headers) + 1):
                expected = metadata[col - 1] if row == 1 and col <= 3 else NOTICE if row == 2 and col == 1 else None
                if sheet.cell(row, col).value != expected:
                    raise ValueError("Unexpected workbook metadata content")
        expected_last = max(4, len(rows) + 4)
        reference = f"A4:{get_column_letter(len(headers))}{expected_last}"
        if (
            sheet.max_row != expected_last
            or sheet.max_column != len(headers)
            or list(sheet.tables) != [TABLES[index]]
            or sheet.tables[TABLES[index]].ref != reference
            or sheet.auto_filter.ref != reference
            or sheet.freeze_panes != ("C5" if index == 0 else "A5")
        ):
            raise ValueError("Workbook table/filter/freeze contract mismatch")
        if [sheet.cell(4, col).value for col in range(1, len(headers) + 1)] != list(headers):
            raise ValueError("Workbook headers mismatch")
        for row_index, row in enumerate(rows, 5):
            for col, value in enumerate(row, 1):
                cell = sheet.cell(row_index, col)
                if cell.hyperlink or cell.data_type == "f":
                    raise ValueError("Active cell content forbidden")
                if isinstance(value, (Decimal, int)):
                    if cell.data_type != "n" or cell.value is None or Decimal(str(cell.value)) != Decimal(value):
                        raise ValueError(
                            f"Workbook numeric contribution/total mismatch at {sheet.title}!{cell.coordinate}"
                        )
                    expected_format = SAVINGS_FORMAT if index == 1 and col == 5 else MONEY_FORMAT
                    if isinstance(value, Decimal) and cell.number_format != expected_format:
                        raise ValueError("Signed number format mismatch")
                elif clean(value):
                    if cell.value != clean(value) or cell.data_type != "s":
                        raise ValueError(f"Workbook text/action identity mismatch at {sheet.title}!{cell.coordinate}")
                elif cell.value not in ("", None) or cell.data_type not in ("s", "inlineStr"):
                    raise ValueError("Workbook empty text mismatch")
                if not cell.alignment.wrap_text:
                    raise ValueError("Workbook wrapped text contract mismatch")
        for row in sheet:
            for cell in row:
                if cell.data_type == "f" or cell.hyperlink:
                    raise ValueError("Formula/hyperlink forbidden")
        if sheet.cell(4, 1).fill.fgColor.rgb != "0017365D" or not sheet.cell(4, 1).font.bold:
            raise ValueError("Workbook header styling mismatch")
    workbook.close()
    if content != workbook_bytes(payload):
        raise ValueError("Workbook bytes differ from the deterministic verified snapshot")


def validate_export(root: Path, payload: dict, *, staged: bool = False) -> None:
    md_file = safe_path(root, STAGED_MD if staged else MD)
    xlsx_file = safe_path(root, STAGED_XLSX if staged else XLSX)
    if md_file.stat().st_size > 32 * 1024 * 1024 or xlsx_file.stat().st_size > 32 * 1024 * 1024:
        raise ValueError("Oversized export")
    if md_file.read_text(encoding="utf-8") != markdown(payload):
        raise ValueError("Markdown source/financial summary mismatch")
    validate_workbook(xlsx_file.read_bytes(), payload)


def render_export(root: Path, payload: dict) -> None:
    md_file = safe_path(root, STAGED_MD, missing=True)
    xlsx_file = safe_path(root, STAGED_XLSX, missing=True)
    if not md_file.parent.is_dir():
        raise ValueError("Owned _meta staging directory required")
    content = workbook_bytes(payload)
    validate_workbook(content, payload)
    md_file.write_text(markdown(payload), encoding="utf-8", newline="\n")
    xlsx_file.write_bytes(content)
    validate_export(root, payload, staged=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=("render", "validate"))
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--as-of", required=True)
    parser.add_argument("--staged", action="store_true")
    args = parser.parse_args()
    try:
        supplied = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else None
        payload = verified_payload(args.root, args.input, args.as_of, supplied)
        if args.operation == "render":
            if not args.staged:
                raise ValueError("Renderer only writes staging; use Node render to publish a receipt")
            render_export(args.root, payload)
        else:
            validate_export(args.root, payload, staged=args.staged)
        print(json.dumps({"valid": True, "errors": [], "renderer_version": f"openpyxl-{openpyxl.__version__}"}))
        return 0
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        ElementTree.ParseError,
        zipfile.BadZipFile,
        subprocess.SubprocessError,
    ) as error:
        print(json.dumps({"valid": False, "errors": [str(error)]}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
