"""Exercise real generated OOXML, source equivalence and hostile workbook inputs."""

import hashlib
import html
import importlib.util
import io
import json
import shutil
import subprocess
import sys
import uuid
import zipfile
from decimal import Decimal
from pathlib import Path

import pytest
from openpyxl import load_workbook
from openpyxl.worksheet import _writer

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tools/scripts/assessment-action-register.mjs"
RENDERER = ROOT / "tools/scripts/render-assessment-action-register.py"
FIXTURE = ROOT / "tools/tests/scripts/fixtures/action-register/fixture.mjs"
AS_OF = "2026-11-06T10:00:00.000Z"
SPEC = importlib.util.spec_from_file_location("action_register_renderer", RENDERER)
renderer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(renderer)


@pytest.fixture
def project() -> tuple[Path, dict]:
    root = FIXTURE.parent / f".python-run-{uuid.uuid4()}"
    try:
        subprocess.run(["node", str(FIXTURE), str(root)], check=True, capture_output=True, text=True)
        input_file = root / renderer.SOURCE
        payload = renderer.verified_payload(root, input_file, AS_OF)
        yield root, payload
    finally:
        shutil.rmtree(root, ignore_errors=True)


def rewrite_zip(content: bytes, replacements: dict[str, bytes | None]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(content)) as source, zipfile.ZipFile(output, "w") as target:
        for name in source.namelist():
            if name in replacements:
                if replacements[name] is not None:
                    target.writestr(name, replacements.pop(name))
            else:
                target.writestr(name, source.read(name))
        for name, data in replacements.items():
            if data is not None:
                target.writestr(name, data)
    return output.getvalue()


def modify_cell(content: bytes, sheet: str, coordinate: str, value: object) -> bytes:
    workbook = load_workbook(io.BytesIO(content))
    workbook[sheet][coordinate] = value
    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()


def cli(root: Path, operation: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(SCRIPT), operation, "--root", str(root), "--input", str(root / renderer.SOURCE), "--as-of", AS_OF],
        capture_output=True,
        text=True,
        check=False,
    )


def test_clean_preserves_xml_whitespace_and_unicode_boundaries() -> None:
    assert renderer.clean("a\tb\r\nc\rd\ne") == "a\tb\nc\nd\ne"
    allowed = "\t\n\r \ud7ff\ue000\ufffd\U00010000\U0010ffff"
    assert renderer.clean(allowed) == allowed.replace("\r", "\n")
    invalid = "".join(
        chr(codepoint) for codepoint in [*range(9), 11, 12, *range(14, 32), 0xD800, 0xDFFF, 0xFFFE, 0xFFFF]
    )
    assert renderer.clean(f"start{invalid}end") == "startend"


def test_real_three_sheet_workbook_types_styles_exact_values_and_repeat_bytes(project: tuple[Path, dict]) -> None:
    _, payload = project
    first = renderer.workbook_bytes(payload)
    assert first == renderer.workbook_bytes(payload)
    renderer.validate_workbook(first, payload)
    workbook = load_workbook(io.BytesIO(first))
    assert workbook.sheetnames == list(renderer.SHEETS)
    sheet = workbook["Action Register"]
    assert [sheet[f"F{row}"].value for row in range(5, 9)] == [1000, 200, -150, -50]
    assert sheet["F7"].data_type == "n"
    assert sheet["Q7"].value == "-150" and sheet["Q7"].data_type == "s"
    assert sheet["F7"].number_format == renderer.MONEY_FORMAT
    assert sheet.freeze_panes == "C5"
    assert sheet["C5"].fill.fgColor.rgb == "00FFF2CC"
    assert sheet["B5"].alignment.wrap_text
    assert sheet.column_dimensions["B"].width == 42
    assert sheet.row_dimensions[5].height >= 36
    assert sheet.page_setup.orientation == "landscape"
    finance = workbook["Financial Summary"]
    assert finance["D5"].value == 1200 and finance["E5"].value == 50 and finance["F5"].value == 1150
    assert finance["F6"].value == -150
    assert all(cell.data_type != "f" for worksheet in workbook for row in worksheet for cell in row)
    with zipfile.ZipFile(io.BytesIO(first)) as archive:
        assert all(member.date_time == archive.infolist()[0].date_time for member in archive.infolist())


def test_openpyxl_internal_scratch_stays_in_the_project_and_is_cleaned(
    project: tuple[Path, dict], monkeypatch: pytest.MonkeyPatch
) -> None:
    root, payload = project
    original = _writer.NamedTemporaryFile
    created = []

    def capture(*args: object, **kwargs: object) -> object:
        result = original(*args, **kwargs)
        created.append(Path(result.name))
        return result

    monkeypatch.setattr(_writer, "NamedTemporaryFile", capture)
    renderer.workbook_bytes(payload)
    assert len(created) == 3
    assert all(file.parent == root / "_meta" and not file.exists() for file in created)


def test_unknown_zero_and_no_actions_are_distinct_typed_values(project: tuple[Path, dict]) -> None:
    _, payload = project
    unknown = payload["derived"]["actions"][0]
    unknown["monthly_contribution"] = None
    unknown["display_contribution"] = None
    payload["derived"]["actions"][1]["monthly_contribution"] = "0"
    payload["derived"]["actions"][1]["display_contribution"] = "0.00"
    content = renderer.workbook_bytes(payload)
    workbook = load_workbook(io.BytesIO(content))
    assert workbook["Action Register"]["F5"].value == "Not quantified"
    assert workbook["Action Register"]["F5"].data_type == "s"
    assert workbook["Action Register"]["F6"].value == 0
    assert workbook["Action Register"]["F6"].data_type == "n"
    payload["register"]["actions"] = []
    payload["derived"]["actions"] = []
    content = renderer.workbook_bytes(payload)
    renderer.validate_workbook(content, payload)
    assert "No evidence-backed actions identified." in renderer.markdown(payload)
    payload["register"]["coverage"] = {"status": "unavailable", "reason": "Not granted"}
    assert "evidence collection was inaccessible or partial" in renderer.markdown(payload)


@pytest.mark.parametrize(
    "prefix", ['=HYPERLINK("https://evil.example", "run")', "+1", "-1", "@SUM(A1)", "[external.xlsx]Sheet!A1"]
)
def test_untrusted_text_is_string_never_formula_and_markdown_controls_are_escaped(
    project: tuple[Path, dict], prefix: str
) -> None:
    _, payload = project
    payload["register"]["actions"][0]["task"] = prefix + "\x00 | <script>\n[link](javascript:run)"
    payload["register"]["actions"][0]["comments"] = prefix
    content = renderer.workbook_bytes(payload)
    renderer.validate_workbook(content, payload)
    workbook = load_workbook(io.BytesIO(content))
    assert workbook["Action Register"]["B5"].data_type == "s"
    assert workbook["Action Register"]["I5"].data_type == "s"
    assert workbook["Action Register"]["B5"].hyperlink is None
    md = renderer.markdown(payload)
    assert "\x00" not in md and "<script>" not in md
    assert "\\|" in md and "&lt;script&gt;" in md and "\\[link\\]" in md
    assert "## Executive Summary" in md and "## Coverage and Limitations" in md


@pytest.mark.parametrize(
    "attack",
    [
        "invalid_zip",
        "missing_part",
        "macro",
        "external_link",
        "formula",
        "total",
        "action_id",
        "traversal",
        "entity",
        "huge_member",
        "sheet_name",
        "metadata",
        "properties",
    ],
)
def test_readback_rejects_corruption_even_with_a_replaced_receipt_hash(project: tuple[Path, dict], attack: str) -> None:
    root, payload = project
    rendered = cli(root, "render")
    assert rendered.returncode == 0, rendered.stdout + rendered.stderr
    content = (root / renderer.XLSX).read_bytes()
    if attack == "invalid_zip":
        content = b"invalid ZIP"
    elif attack == "missing_part":
        content = rewrite_zip(content, {"xl/workbook.xml": None})
    elif attack == "macro":
        content = rewrite_zip(content, {"xl/vbaProject.bin": b"synthetic"})
    elif attack == "external_link":
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            relationships = archive.read("xl/_rels/workbook.xml.rels").replace(
                b"</Relationships>",
                b'<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" TargetMode="External" Target="https://evil.example/x" Id="rId100"/></Relationships>',
            )
        content = rewrite_zip(content, {"xl/_rels/workbook.xml.rels": relationships})
    elif attack == "formula":
        content = modify_cell(content, "Action Register", "F5", "=1+1")
    elif attack == "total":
        content = modify_cell(content, "Financial Summary", "F5", 999999)
    elif attack == "action_id":
        content = modify_cell(content, "Action Register", "L5", "invented")
    elif attack == "traversal":
        content = rewrite_zip(content, {"../escape.xml": b"<unsafe/>"})
    elif attack == "huge_member":
        content = rewrite_zip(content, {"docProps/core.xml": b"<x>" + b"x" * (8 * 1024 * 1024) + b"</x>"})
    elif attack == "sheet_name":
        workbook = load_workbook(io.BytesIO(content))
        workbook["Action Register"].title = "Wrong sheet"
        output = io.BytesIO()
        workbook.save(output)
        content = output.getvalue()
    elif attack == "metadata":
        content = modify_cell(content, "Action Register", "A3", "Unreviewed hidden note")
    elif attack == "properties":
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            properties = archive.read("docProps/core.xml").replace(b"APEX", b"Unreviewed")
        content = rewrite_zip(content, {"docProps/core.xml": properties})
    else:
        content = rewrite_zip(content, {"docProps/core.xml": b'<!DOCTYPE x [<!ENTITY secret "boom">]><x>&secret;</x>'})
    with pytest.raises((ValueError, zipfile.BadZipFile)):
        renderer.validate_workbook(content, payload)
    (root / renderer.XLSX).write_bytes(content)
    receipt_file = root / "_meta/action-register-export.json"
    receipt = json.loads(receipt_file.read_text())
    receipt["output_hashes"]["workbook"] = hashlib.sha256(content).hexdigest()
    receipt_file.write_text(json.dumps(receipt))
    result = cli(root, "validate-export")
    assert result.returncode == 1, result.stdout + result.stderr
    assert json.loads(result.stdout)["valid"] is False


def test_renderer_refuses_unverified_derived_summary_and_unsupported_numeric_magnitude(
    project: tuple[Path, dict],
) -> None:
    root, payload = project
    payload["derived"]["actions"][0]["monthly_contribution"] = "-99999"
    with pytest.raises(ValueError, match="verified Node"):
        renderer.verified_payload(root, root / renderer.SOURCE, AS_OF, payload)
    payload["derived"]["actions"][0]["display_contribution"] = "0.1234567890123456789"
    with pytest.raises(ValueError, match="representable"):
        renderer.workbook_bytes(payload)


def test_matching_markdown_and_receipt_are_required_and_direct_renderer_cannot_publish(
    project: tuple[Path, dict],
) -> None:
    root, payload = project
    result = cli(root, "render")
    assert result.returncode == 0, result.stdout + result.stderr
    assert (root / renderer.MD).read_text() == renderer.markdown(payload)
    (root / renderer.MD).write_text("tampered")
    with pytest.raises(ValueError, match="Markdown"):
        renderer.validate_export(root, payload)
    result = subprocess.run(
        [
            "python3",
            str(RENDERER),
            "render",
            "--root",
            str(root),
            "--input",
            str(root / renderer.SOURCE),
            "--as-of",
            AS_OF,
        ],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and "staging" in result.stderr


def test_source_clock_and_path_are_mandatory_in_the_renderer_cli(project: tuple[Path, dict]) -> None:
    root, _ = project
    result = subprocess.run(
        [
            "python3",
            str(RENDERER),
            "validate",
            "--root",
            str(root),
            "--input",
            str(root / renderer.SOURCE),
            "--as-of",
            "invalid",
        ],
        input="{}",
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1 and "Node source/finance" in result.stderr
    assert renderer.amount(None) == "Not quantified"
    assert renderer.amount("-50.00") == Decimal("-50.00")


def write_synthetic_preview(root: Path) -> Path:
    payload = renderer.verified_payload(root, root / renderer.SOURCE, AS_OF)
    renderer.validate_export(root, payload)
    workbook = load_workbook(root / renderer.XLSX)
    output = renderer.safe_path(root, "_meta/action-register-preview.html", missing=True)
    parts = [
        '<!doctype html><html><head><meta charset="utf-8"><title>Synthetic Action Register Preview</title>',
        "<style>body{font:14px system-ui;margin:24px;color:#17365d}section{overflow:auto;margin:20px 0}"
        "table{border-collapse:collapse;color:#222}td,th{border:1px solid #ccd;padding:10px;vertical-align:top;"
        "white-space:pre-wrap;min-width:110px;max-width:340px}th{background:#17365d;color:white}"
        "tr:nth-child(even){background:#f1f5fa}</style></head><body>",
        "<h1>Synthetic Assessment Action Register</h1>",
        "<p>Static HTML preview of the actual read-back workbook; not a native Excel UI test. "
        "Anonymized synthetic arithmetic only, never a customer quote.</p>",
    ]
    for sheet in workbook:
        parts.append(f"<h2>{html.escape(sheet.title)}</h2><section><table>")
        for row in sheet.iter_rows(min_row=4):
            parts.append("<tr>")
            for cell in row:
                tag = "th" if cell.row == 4 else "td"
                value = "" if cell.value is None else str(cell.value)
                parts.append(f"<{tag}>{html.escape(value)}</{tag}>")
            parts.append("</tr>")
        parts.append("</table></section>")
    workbook.close()
    parts.append("</body></html>")
    output.write_text("".join(parts), encoding="utf-8")
    return output


if __name__ == "__main__" and len(sys.argv) == 3 and sys.argv[1] == "--preview":
    print(write_synthetic_preview(Path(sys.argv[2])))
