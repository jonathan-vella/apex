"""Read-only pursuit source inventory, SHA-256 manifest, and Markdown extractor.

Safely inventories, hash-locks, and transcribes customer or partner pursuit
inputs (.xlsx, .docx, .csv, .txt, .md, .eml, and optional .pdf) into structured
Markdown and a deterministic SHA-256 provenance manifest without mutating source
files or extracting untrusted archives to disk.
"""

from __future__ import annotations

import argparse
import csv
import email
import email.policy
import importlib
import io
import json
import os
import shutil
import subprocess
import sys
import zipfile
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET

import openpyxl

try:
    from ._safe_io import (
        MAX_MEMBER_UNCOMPRESSED_BYTES,
        ContainmentError,
        ensure_within_root,
        open_validated_zip,
        parse_safe_xml_bytes,
        read_safe_zip_bytes,
        sha256_bytes,
        sha256_file,
    )
except ImportError:
    _script_dir = str(Path(__file__).resolve().parent)
    if _script_dir not in sys.path:
        sys.path.insert(0, _script_dir)
    from _safe_io import (  # type: ignore[no-redef]
        MAX_MEMBER_UNCOMPRESSED_BYTES,
        ContainmentError,
        ensure_within_root,
        open_validated_zip,
        parse_safe_xml_bytes,
        read_safe_zip_bytes,
        sha256_bytes,
        sha256_file,
    )

MANIFEST_SCHEMA_VERSION = "pursuit-source-manifest-v1"
WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

MAX_XLSX_POPULATED_CELLS = 200_000
MAX_XLSX_TABLE_ROWS = 10_000
MAX_XLSX_TABLE_COLS = 512
MAX_XLSX_TABLE_CELL_AREA = 1_000_000

SUPPORTED_EXTENSIONS: dict[str, str] = {
    ".xlsx": "xlsx",
    ".docx": "docx",
    ".csv": "csv",
    ".txt": "txt",
    ".md": "md",
    ".markdown": "md",
    ".eml": "eml",
    ".pdf": "pdf",
}

_HEADING_STYLE_MAP: dict[str, int] = {
    "heading1": 1,
    "heading2": 2,
    "heading3": 3,
    "heading4": 4,
}


class ExtractionError(RuntimeError):
    """Raised when a source file is missing, unsupported, corrupt, or unreadable."""


@dataclass(slots=True)
class ExtractedFileRecord:
    """In-memory extraction result and provenance metadata for a single source file."""

    path: str
    size_bytes: int
    sha256: str
    file_type: str
    extraction_status: str = "extracted"
    purview_labeled: bool = False
    purview_markers: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    markdown: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def to_manifest_entry(self) -> dict[str, Any]:
        """Serialize deterministic per-file manifest fields."""
        entry: dict[str, Any] = {
            "path": self.path,
            "size_bytes": self.size_bytes,
            "sha256": self.sha256,
            "file_type": self.file_type,
            "extraction_status": self.extraction_status,
            "purview_labeled": self.purview_labeled,
        }
        if self.purview_markers:
            entry["purview_markers"] = sorted(set(self.purview_markers))
        if self.warnings:
            entry["warnings"] = list(self.warnings)
        return entry


def _local_xml_name(tag: str) -> str:
    """Strip XML namespace URI prefix from an ElementTree tag or attribute key."""
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _escape_md_cell(value: Any) -> str:
    """Normalize a table cell value for single-line Markdown pipe tables."""
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("|", "\\|").replace("\n", "<br>")
    return text.strip()


def _render_markdown_table(rows: Sequence[Sequence[Any]]) -> str:
    """Render a 2D grid as a GitHub-flavored Markdown table."""
    if not rows:
        return "_Empty table_"
    width = max((len(row) for row in rows), default=0)
    if width == 0:
        return "_Empty table_"

    normalized: list[list[str]] = []
    for row in rows:
        padded = [_escape_md_cell(cell) for cell in row]
        if len(padded) < width:
            padded.extend([""] * (width - len(padded)))
        normalized.append(padded)

    header = normalized[0]
    if all(cell == "" for cell in header):
        header = [f"Col {idx + 1}" for idx in range(width)]
        body = normalized
    else:
        body = normalized[1:]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * width) + " |",
    ]
    for row in body:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def _rebase_to_resolved_root(path: Path, raw_root: Path, resolved_root: Path) -> Path:
    """Map `path` from an un-resolved symlinked parent prefix onto `resolved_root` without resolving child segments."""
    raw_path = Path(os.path.abspath(os.fspath(path)))
    if raw_root != resolved_root and raw_path.is_relative_to(raw_root):
        return resolved_root.joinpath(*raw_path.relative_to(raw_root).parts)
    return raw_path


def _ensure_output_outside_source(
    output_path: Path,
    resolved_source_dir: Path,
    resolved_root: Path,
    *,
    raw_root: Path | None = None,
) -> Path:
    """Ensure an output path stays inside `resolved_root` and never mutates `resolved_source_dir`."""
    candidate = _rebase_to_resolved_root(output_path, raw_root, resolved_root) if raw_root is not None else output_path
    resolved_out = ensure_within_root(candidate, resolved_root)
    if resolved_out == resolved_source_dir or resolved_out.is_relative_to(resolved_source_dir):
        raise ContainmentError(
            f"Refusing to write output inside read-only source directory {resolved_source_dir}: {resolved_out}"
        )
    return resolved_out


def _discover_source_files(resolved_source_dir: Path, resolved_root: Path) -> list[Path]:
    """Walk `resolved_source_dir` deterministically while rejecting symlinks at any depth."""
    discovered: list[Path] = []

    def _walk(current_dir: Path) -> None:
        try:
            entries = sorted(current_dir.iterdir(), key=lambda p: p.name)
        except OSError as exc:
            raise ExtractionError(f"Unable to list directory {current_dir}: {exc}") from exc

        for entry in entries:
            if entry.is_symlink():
                raise ContainmentError(f"Symlink forbidden inside pursuit source directory: {entry}")
            resolved_entry = ensure_within_root(entry, resolved_root)
            if resolved_entry.is_dir():
                _walk(resolved_entry)
            elif resolved_entry.is_file():
                discovered.append(resolved_entry)
            else:
                raise ExtractionError(f"Unsupported non-regular filesystem entry: {resolved_entry}")

    _walk(resolved_source_dir)
    discovered.sort(key=lambda p: p.relative_to(resolved_source_dir).as_posix())
    return discovered


def _validate_all_ooxml_xml_entries(zf: zipfile.ZipFile) -> None:
    """Parse every XML/relationships entry inside an OOXML archive to reject DOCTYPE/ENTITY payloads."""
    for member in zf.namelist():
        lower = member.lower()
        if lower.endswith((".xml", ".rels")):
            raw_xml = read_safe_zip_bytes(zf, member)
            parse_safe_xml_bytes(raw_xml)


def detect_ooxml_purview_markers(zf: zipfile.ZipFile) -> list[str]:
    """Inspect OOXML `docProps/` and `customXml/` parts for Purview / MIP sensitivity markers."""
    markers: list[str] = []
    candidate_members = [
        name
        for name in sorted(zf.namelist())
        if (name.startswith("docProps/") or name.startswith("customXml/")) and name.lower().endswith(".xml")
    ]
    for member in candidate_members:
        raw_xml = read_safe_zip_bytes(zf, member)
        root_elem = parse_safe_xml_bytes(raw_xml)
        for elem in root_elem.iter():
            local_tag = _local_xml_name(elem.tag)
            if "msip_label_" in local_tag.lower():
                markers.append(f"{member}:{local_tag}")
            elif local_tag.lower() == "sensitivity" and (elem.text or "").strip():
                markers.append(f"{member}:Sensitivity={(elem.text or '').strip()}")

            for attr_key, attr_val in elem.attrib.items():
                attr_local = _local_xml_name(attr_key)
                val_lower = attr_val.lower()
                if "msip_label_" in val_lower or "msip_label_" in attr_local.lower():
                    markers.append(f"{member}:{attr_val}")
                elif attr_local.lower() == "name" and val_lower.strip() == "sensitivity":
                    value_parts = [(child.text or "").strip() for child in elem if (child.text or "").strip()]
                    label_val = ",".join(value_parts) if value_parts else (elem.text or "").strip()
                    if label_val:
                        markers.append(f"{member}:Sensitivity={label_val}")
                    else:
                        markers.append(f"{member}:Sensitivity")
    return sorted(set(markers))


def _format_xlsx_cell(formula_val: Any, cached_val: Any) -> str:
    """Combine Excel formula expressions and cached evaluation values without losing either."""
    if isinstance(formula_val, str) and formula_val.startswith("="):
        if cached_val is not None and str(cached_val) != formula_val:
            return f"{cached_val} [formula: {formula_val}]"
        return formula_val
    chosen = cached_val if cached_val is not None else formula_val
    return "" if chosen is None else str(chosen)


def _check_xlsx_xml_cell_budget(zf: zipfile.ZipFile) -> None:
    """Reject worksheets whose raw XML contains an excessive number of <c> elements before loading openpyxl."""
    for member in zf.namelist():
        low = member.lower()
        if low.startswith("xl/worksheets/") and low.endswith(".xml"):
            raw_xml = read_safe_zip_bytes(zf, member)
            root_elem = parse_safe_xml_bytes(raw_xml)
            cell_elements = sum(1 for elem in root_elem.iter() if _local_xml_name(elem.tag) == "c")
            if cell_elements > MAX_XLSX_POPULATED_CELLS:
                raise ExtractionError(
                    f"Worksheet XML {member} contains {cell_elements} cell elements, "
                    f"exceeding intake safety limit {MAX_XLSX_POPULATED_CELLS}"
                )


def extract_xlsx_file(xlsx_path: Path) -> tuple[str, dict[str, Any], list[str], list[str]]:
    """Safely extract all visible/hidden worksheets, merged spans, dropdowns, and Purview flags."""
    try:
        with open_validated_zip(xlsx_path) as zf:
            _validate_all_ooxml_xml_entries(zf)
            _check_xlsx_xml_cell_budget(zf)
            purview_markers = detect_ooxml_purview_markers(zf)
    except ContainmentError, ExtractionError:
        raise
    except (zipfile.BadZipFile, OSError) as exc:
        raise ExtractionError(f"Failed to open .xlsx archive {xlsx_path.name}: {exc}") from exc

    raw_bytes = xlsx_path.read_bytes()
    wb_formulas = None
    wb_values = None
    warnings: list[str] = []
    sheets_meta: list[dict[str, Any]] = []
    md_sections: list[str] = []

    try:
        wb_formulas = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=False, read_only=False)
        wb_values = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True, read_only=False)

        defined_names: list[dict[str, Any]] = []
        for dn in wb_formulas.defined_names.values():
            defined_names.append(
                {
                    "name": dn.name,
                    "value": dn.attr_text,
                    "hidden": bool(dn.hidden),
                }
            )
        defined_names.sort(key=lambda item: str(item["name"]))
        if defined_names:
            dn_lines = ["### Workbook Defined Names", ""]
            for dn in defined_names:
                hidden_suffix = " (hidden)" if dn["hidden"] else ""
                dn_lines.append(f"- `{dn['name']}` = `{dn['value']}`{hidden_suffix}")
            md_sections.append("\n".join(dn_lines))

        for sheet_name in wb_formulas.sheetnames:
            ws_f = wb_formulas[sheet_name]
            ws_v = wb_values[sheet_name]
            sheet_state = str(ws_f.sheet_state)

            merged_ranges = sorted(str(rng) for rng in ws_f.merged_cells.ranges)

            validations: list[dict[str, Any]] = []
            for dv in ws_f.data_validations.dataValidation:
                dv_entry: dict[str, Any] = {
                    "type": dv.type or "",
                    "sqref": str(dv.sqref) if dv.sqref is not None else "",
                    "formula1": dv.formula1 or "",
                }
                if dv.formula2:
                    dv_entry["formula2"] = dv.formula2
                validations.append(dv_entry)
            validations.sort(key=lambda item: (item["sqref"], item["type"], item["formula1"]))

            f_cells_map: Mapping[tuple[int, int], Any] = getattr(ws_f, "_cells", {})
            v_cells_map: Mapping[tuple[int, int], Any] = getattr(ws_v, "_cells", {})
            populated_coords = set(f_cells_map.keys()) | set(v_cells_map.keys())
            if len(populated_coords) > MAX_XLSX_POPULATED_CELLS:
                raise ExtractionError(
                    f"Worksheet {sheet_name!r} in {xlsx_path.name} has {len(populated_coords)} populated cells, "
                    f"exceeding intake safety limit {MAX_XLSX_POPULATED_CELLS}"
                )

            sparse_cells: dict[tuple[int, int], str] = {}
            max_used_row = 0
            max_used_col = 0
            for r_coord, c_coord in sorted(populated_coords):
                f_cell = f_cells_map.get((r_coord, c_coord))
                v_cell = v_cells_map.get((r_coord, c_coord))
                cell_text = _format_xlsx_cell(
                    f_cell.value if f_cell is not None else None,
                    v_cell.value if v_cell is not None else None,
                )
                if cell_text != "":
                    sparse_cells[(r_coord, c_coord)] = cell_text
                    if r_coord > max_used_row:
                        max_used_row = r_coord
                    if c_coord > max_used_col:
                        max_used_col = c_coord

            cell_area = max_used_row * max_used_col
            if (
                max_used_row > MAX_XLSX_TABLE_ROWS
                or max_used_col > MAX_XLSX_TABLE_COLS
                or cell_area > MAX_XLSX_TABLE_CELL_AREA
            ):
                raise ExtractionError(
                    f"Worksheet {sheet_name!r} in {xlsx_path.name} spans {max_used_row}x{max_used_col} "
                    f"({cell_area} cells), exceeding intake table budget "
                    f"({MAX_XLSX_TABLE_ROWS} rows, {MAX_XLSX_TABLE_COLS} cols, {MAX_XLSX_TABLE_CELL_AREA} cells)"
                )

            if max_used_row > 0 and max_used_col > 0:
                table_rows = [
                    [sparse_cells.get((r_idx, c_idx), "") for c_idx in range(1, max_used_col + 1)]
                    for r_idx in range(1, max_used_row + 1)
                ]
            else:
                table_rows = []

            sheets_meta.append(
                {
                    "name": sheet_name,
                    "sheet_state": sheet_state,
                    "merged_cells": merged_ranges,
                    "data_validations": validations,
                    "row_count": len(table_rows),
                    "column_count": max_used_col,
                    "rows": table_rows,
                }
            )

            sheet_lines = [f"### Sheet: {sheet_name} (`sheet_state={sheet_state}`)", ""]
            if sheet_state != "visible":
                sheet_lines.append(f"> Non-visible worksheet surfaced (`sheet_state={sheet_state}`).")
                sheet_lines.append("")

            if merged_ranges:
                merged_formatted = ", ".join(f"`{rng}`" for rng in merged_ranges)
                sheet_lines.append(f"**Merged Cells**: {merged_formatted}")
            else:
                sheet_lines.append("**Merged Cells**: none")
            sheet_lines.append("")

            if validations:
                sheet_lines.append("**Data Validations**:")
                sheet_lines.append("")
                for dv_item in validations:
                    f2_part = f", `formula2={dv_item['formula2']}`" if "formula2" in dv_item else ""
                    sheet_lines.append(
                        f"- `type={dv_item['type']}`, `sqref={dv_item['sqref']}`, "
                        f"`formula1={dv_item['formula1']}`{f2_part}"
                    )
            else:
                sheet_lines.append("**Data Validations**: none")
            sheet_lines.append("")

            sheet_lines.append(_render_markdown_table(table_rows))
            md_sections.append("\n".join(sheet_lines))
    except ContainmentError, ExtractionError:
        raise
    except Exception as exc:
        raise ExtractionError(f"Unable to parse workbook {xlsx_path.name}: {exc}") from exc
    finally:
        if wb_formulas is not None:
            wb_formulas.close()
        if wb_values is not None:
            wb_values.close()

    details: dict[str, Any] = {
        "sheets": sheets_meta,
        "defined_names": defined_names,
    }
    return "\n\n".join(md_sections), details, purview_markers, warnings


def _extract_docx_paragraph_text(p_elem: ET.Element) -> tuple[int | None, str]:
    """Extract optional Markdown heading level (1..4) and run text from a `w:p` element."""
    w_ppr = f"{{{WORD_NAMESPACE}}}pPr"
    w_pstyle = f"{{{WORD_NAMESPACE}}}pStyle"
    w_val = f"{{{WORD_NAMESPACE}}}val"
    w_t = f"{{{WORD_NAMESPACE}}}t"
    w_tab = f"{{{WORD_NAMESPACE}}}tab"
    w_br = f"{{{WORD_NAMESPACE}}}br"
    w_cr = f"{{{WORD_NAMESPACE}}}cr"

    heading_level: int | None = None
    ppr = p_elem.find(w_ppr)
    if ppr is not None:
        pstyle = ppr.find(w_pstyle)
        if pstyle is not None:
            raw_style = pstyle.attrib.get(w_val) or pstyle.attrib.get("val") or ""
            normalized_style = raw_style.replace(" ", "").replace("-", "").lower()
            heading_level = _HEADING_STYLE_MAP.get(normalized_style)

    chunks: list[str] = []
    for node in p_elem.iter():
        if node.tag == w_t and node.text:
            chunks.append(node.text)
        elif node.tag == w_tab:
            chunks.append("\t")
        elif node.tag in (w_br, w_cr):
            chunks.append("\n")

    return heading_level, "".join(chunks)


def _extract_docx_table(tbl_elem: ET.Element) -> list[list[str]]:
    """Extract a 2D list of cell strings from a `w:tbl` element."""
    w_tr = f"{{{WORD_NAMESPACE}}}tr"
    w_tc = f"{{{WORD_NAMESPACE}}}tc"
    w_p = f"{{{WORD_NAMESPACE}}}p"

    rows: list[list[str]] = []
    for tr in tbl_elem.findall(w_tr):
        row_cells: list[str] = []
        for tc in tr.findall(w_tc):
            para_texts: list[str] = []
            for p_elem in tc.findall(f".//{w_p}"):
                _, text = _extract_docx_paragraph_text(p_elem)
                cleaned = text.strip()
                if cleaned:
                    para_texts.append(cleaned)
            row_cells.append("\n".join(para_texts))
        if row_cells:
            rows.append(row_cells)
    return rows


def _iter_docx_body_blocks(container: ET.Element) -> list[tuple[str, ET.Element]]:
    """Yield `('p', elem)` and `('tbl', elem)` in document order, descending into `w:sdtContent`."""
    w_p = f"{{{WORD_NAMESPACE}}}p"
    w_tbl = f"{{{WORD_NAMESPACE}}}tbl"
    w_sdt = f"{{{WORD_NAMESPACE}}}sdt"
    w_sdt_content = f"{{{WORD_NAMESPACE}}}sdtContent"

    blocks: list[tuple[str, ET.Element]] = []
    for child in container:
        if child.tag == w_p:
            blocks.append(("p", child))
        elif child.tag == w_tbl:
            blocks.append(("tbl", child))
        elif child.tag == w_sdt:
            sdt_content = child.find(w_sdt_content)
            if sdt_content is not None:
                blocks.extend(_iter_docx_body_blocks(sdt_content))
    return blocks


def extract_docx_file(
    docx_path: Path,
    *,
    extract_media_dir: Path | None = None,
    root: Path | None = None,
    rel_stem: str = "document",
) -> tuple[str, dict[str, Any], list[str], list[str]]:
    """Extract `.docx` paragraphs, headings, tables, embedded media hashes, and Purview markers."""
    warnings: list[str] = []
    try:
        with open_validated_zip(docx_path) as zf:
            _validate_all_ooxml_xml_entries(zf)
            purview_markers = detect_ooxml_purview_markers(zf)

            if "word/document.xml" not in zf.namelist():
                raise ExtractionError(f"Archive {docx_path.name} is missing word/document.xml")

            doc_xml = read_safe_zip_bytes(zf, "word/document.xml")
            doc_root = parse_safe_xml_bytes(doc_xml)
            body = doc_root.find(f"{{{WORD_NAMESPACE}}}body")
            if body is None:
                raise ExtractionError(f"Archive {docx_path.name} word/document.xml has no w:body element")

            md_blocks: list[str] = []
            structured_blocks: list[dict[str, Any]] = []
            for kind, elem in _iter_docx_body_blocks(body):
                if kind == "p":
                    level, raw_text = _extract_docx_paragraph_text(elem)
                    cleaned = raw_text.strip()
                    if not cleaned:
                        continue
                    if level is not None:
                        md_blocks.append(f"{'#' * level} {cleaned}")
                        structured_blocks.append({"type": "heading", "level": level, "text": cleaned})
                    else:
                        md_blocks.append(cleaned)
                        structured_blocks.append({"type": "paragraph", "text": cleaned})
                elif kind == "tbl":
                    table_rows = _extract_docx_table(elem)
                    md_blocks.append(_render_markdown_table(table_rows))
                    structured_blocks.append({"type": "table", "rows": table_rows})

            media_members = sorted(
                name for name in zf.namelist() if name.startswith("word/media/") and not name.endswith("/")
            )
            embedded_media: list[dict[str, Any]] = []
            for member in media_members:
                media_bytes = read_safe_zip_bytes(zf, member)
                media_digest = sha256_bytes(media_bytes)
                media_filename = PurePosixPath(member).name
                media_record: dict[str, Any] = {
                    "archive_path": member,
                    "filename": media_filename,
                    "size_bytes": len(media_bytes),
                    "sha256": media_digest,
                }
                if extract_media_dir is not None:
                    effective_root = root if root is not None else extract_media_dir.absolute().parent
                    raw_media_root = Path(os.path.abspath(os.fspath(effective_root)))
                    if effective_root.is_symlink() or raw_media_root.is_symlink():
                        raise ContainmentError(f"Containment root cannot be a symlink: {effective_root}")
                    resolved_root = effective_root.resolve()
                    resolved_media_root = ensure_within_root(
                        _rebase_to_resolved_root(extract_media_dir, raw_media_root, resolved_root),
                        resolved_root,
                    )
                    safe_subdir = PurePosixPath(rel_stem)
                    if ".." in safe_subdir.parts:
                        raise ContainmentError(f"Unsafe media subdirectory stem: {rel_stem!r}")
                    target_file = resolved_media_root / Path(*safe_subdir.parts) / media_filename
                    resolved_target = ensure_within_root(target_file, resolved_root)
                    resolved_target.parent.mkdir(parents=True, exist_ok=True)
                    resolved_target.write_bytes(media_bytes)
                    media_record["extracted_to"] = resolved_target.relative_to(resolved_root).as_posix()
                embedded_media.append(media_record)

            if embedded_media:
                media_lines = ["### Embedded Media", ""]
                for item in embedded_media:
                    media_lines.append(
                        f"- `{item['archive_path']}` ({item['size_bytes']} bytes, `sha256:{item['sha256']}`)"
                    )
                md_blocks.append("\n".join(media_lines))

            details: dict[str, Any] = {
                "blocks": structured_blocks,
                "embedded_media": embedded_media,
            }
            return "\n\n".join(md_blocks), details, purview_markers, warnings
    except ContainmentError:
        raise
    except ExtractionError:
        raise
    except (zipfile.BadZipFile, KeyError, OSError) as exc:
        raise ExtractionError(f"Failed to read .docx archive {docx_path.name}: {exc}") from exc


def _read_bounded_bytes(file_path: Path, *, max_bytes: int = MAX_MEMBER_UNCOMPRESSED_BYTES) -> bytes:
    """Read a regular non-symlink file with an explicit upper byte limit."""
    if file_path.is_symlink():
        raise ContainmentError(f"Refusing to read symlink source file: {file_path}")
    size = file_path.stat(follow_symlinks=False).st_size
    if size > max_bytes:
        raise ExtractionError(f"Source file {file_path.name} ({size} bytes) exceeds limit {max_bytes} bytes")
    return file_path.read_bytes()


def _decode_text_bytes(raw_bytes: bytes, filename: str) -> tuple[str, list[str]]:
    """Decode UTF-8 (with BOM handling) and fall back to ISO-8859-1 with an explicit warning."""
    try:
        return raw_bytes.decode("utf-8-sig"), []
    except UnicodeDecodeError:
        return raw_bytes.decode("latin-1"), [f"{filename}: decoded using latin-1 fallback due to non-UTF-8 bytes"]


def extract_csv_file(csv_path: Path) -> tuple[str, dict[str, Any], list[str]]:
    """Extract a `.csv` file into a clean Markdown table."""
    raw_bytes = _read_bounded_bytes(csv_path)
    decoded, warnings = _decode_text_bytes(raw_bytes, csv_path.name)
    try:
        reader = csv.reader(io.StringIO(decoded))
        rows = [list(row) for row in reader]
    except csv.Error as exc:
        raise ExtractionError(f"Invalid CSV syntax in {csv_path.name}: {exc}") from exc

    md = _render_markdown_table(rows)
    return md, {"row_count": len(rows), "rows": rows}, warnings


def extract_text_file(text_path: Path) -> tuple[str, dict[str, Any], list[str]]:
    """Extract a plain `.txt` or `.md` pursuit document."""
    raw_bytes = _read_bounded_bytes(text_path)
    decoded, warnings = _decode_text_bytes(raw_bytes, text_path.name)
    normalized = decoded.replace("\r\n", "\n").replace("\r", "\n").rstrip()
    line_count = len(normalized.splitlines()) if normalized else 0
    return normalized, {"line_count": line_count}, warnings


def extract_eml_file(eml_path: Path) -> tuple[str, dict[str, Any], list[str]]:
    """Extract RFC 5322 `.eml` headers and plain-text body parts via `email.policy.default`."""
    raw_bytes = _read_bounded_bytes(eml_path)
    warnings: list[str] = []
    try:
        msg: EmailMessage = email.message_from_bytes(raw_bytes, policy=email.policy.default)
    except Exception as exc:
        raise ExtractionError(f"Unable to parse .eml message {eml_path.name}: {exc}") from exc

    headers: dict[str, str] = {
        "From": str(msg.get("From", "")).strip(),
        "To": str(msg.get("To", "")).strip(),
        "Date": str(msg.get("Date", "")).strip(),
        "Subject": str(msg.get("Subject", "")).strip(),
    }
    cc_val = str(msg.get("Cc", "")).strip()
    if cc_val:
        headers["Cc"] = cc_val

    plain_parts: list[str] = []
    attachments: list[dict[str, Any]] = []

    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue
            disposition = part.get_content_disposition()
            content_type = part.get_content_type()
            filename = part.get_filename()
            if disposition == "attachment" or filename:
                payload = part.get_payload(decode=True)
                raw_part = payload if isinstance(payload, bytes) else b""
                attachments.append(
                    {
                        "filename": filename or "unnamed-attachment",
                        "content_type": content_type,
                        "size_bytes": len(raw_part),
                        "sha256": sha256_bytes(raw_part),
                    }
                )
            elif content_type == "text/plain":
                content = part.get_content()
                if isinstance(content, str) and content.strip():
                    plain_parts.append(content.replace("\r\n", "\n").replace("\r", "\n").strip())
    else:
        if msg.get_content_type() == "text/plain":
            content = msg.get_content()
            if isinstance(content, str) and content.strip():
                plain_parts.append(content.replace("\r\n", "\n").replace("\r", "\n").strip())
        else:
            warnings.append(f"{eml_path.name}: email contains no text/plain body part ({msg.get_content_type()})")

    if not plain_parts and not warnings:
        warnings.append(f"{eml_path.name}: no non-empty text/plain body parts found")

    md_lines = [
        f"- **From**: {headers['From'] or '(none)'}",
        f"- **To**: {headers['To'] or '(none)'}",
    ]
    if "Cc" in headers:
        md_lines.append(f"- **Cc**: {headers['Cc']}")
    md_lines.extend(
        [
            f"- **Date**: {headers['Date'] or '(none)'}",
            f"- **Subject**: {headers['Subject'] or '(none)'}",
            "",
        ]
    )
    if plain_parts:
        md_lines.append("\n\n---\n\n".join(plain_parts))
    else:
        md_lines.append("_[No plain-text email body part]_")

    if attachments:
        md_lines.extend(["", "### Email Attachments (Not Extracted)", ""])
        for att in attachments:
            md_lines.append(
                f"- `{att['filename']}` ({att['content_type']}, {att['size_bytes']} bytes, `sha256:{att['sha256']}`)"
            )

    details: dict[str, Any] = {
        "headers": headers,
        "attachments": attachments,
        "plain_part_count": len(plain_parts),
    }
    return "\n".join(md_lines), details, warnings


def extract_pdf_file(pdf_path: Path) -> tuple[str, dict[str, Any], str, list[str]]:
    """Extract `.pdf` text using `pypdf` or `pdftotext`, or emit `[PDF_EXTRACTOR_UNAVAILABLE]`."""
    raw_bytes = _read_bounded_bytes(pdf_path)
    file_digest = sha256_bytes(raw_bytes)
    warnings: list[str] = []

    pypdf_mod = None
    try:
        pypdf_mod = importlib.import_module("pypdf")
    except ImportError:
        pypdf_mod = None

    if pypdf_mod is not None:
        try:
            reader = pypdf_mod.PdfReader(io.BytesIO(raw_bytes))
            page_sections: list[str] = []
            for idx, page in enumerate(reader.pages, start=1):
                page_text = (page.extract_text() or "").replace("\r\n", "\n").replace("\r", "\n").strip()
                page_sections.append(f"### Page {idx}\n\n{page_text or '_[No extractable text on page]_'}")
            return (
                "\n\n".join(page_sections) if page_sections else "_[Empty PDF]_",
                {"extractor": "pypdf", "page_count": len(reader.pages)},
                "extracted",
                warnings,
            )
        except Exception as exc:
            raise ExtractionError(f"Failed to parse PDF {pdf_path.name} with pypdf: {exc}") from exc

    pdftotext_bin = shutil.which("pdftotext")
    if pdftotext_bin is not None:
        proc = subprocess.run(
            [pdftotext_bin, "-layout", str(pdf_path), "-"],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if proc.returncode != 0:
            stderr_msg = proc.stderr.strip() or f"exit code {proc.returncode}"
            raise ExtractionError(f"pdftotext failed on {pdf_path.name}: {stderr_msg}")
        extracted_text = proc.stdout.replace("\r\n", "\n").replace("\r", "\n").strip()
        return (
            extracted_text or "_[No extractable text in PDF]_",
            {"extractor": "pdftotext"},
            "extracted",
            warnings,
        )

    warning_msg = (
        f"{pdf_path.name}: PDF text extraction unavailable because neither 'pypdf' nor 'pdftotext' is installed."
    )
    warnings.append(warning_msg)
    unavailable_md = "\n".join(
        [
            "[PDF_EXTRACTOR_UNAVAILABLE]",
            "",
            f"- **File**: `{pdf_path.name}`",
            f"- **Bytes**: {len(raw_bytes)}",
            f"- **SHA-256**: `{file_digest}`",
            "- **Status**: Neither `pypdf` Python package nor `pdftotext` binary was found at runtime.",
        ]
    )
    return (
        unavailable_md,
        {"extractor": None, "reason": "neither pypdf nor pdftotext available"},
        "pdf_extractor_unavailable",
        warnings,
    )


def _render_bundle_markdown(manifest: Mapping[str, Any], records: Sequence[ExtractedFileRecord]) -> str:
    """Assemble deterministic full Markdown transcription across all extracted pursuit files."""
    lines = [
        "# Pursuit Source Transcription",
        "",
        "## Provenance Summary",
        "",
        f"- **Source Directory**: `{manifest['source_dir']}`",
        f"- **File Count**: {manifest['file_count']}",
        f"- **Total Bytes**: {manifest['total_bytes']}",
        f"- **Classification**: `{manifest['classification']}`",
        f"- **Purview Labeled Inputs**: `{manifest['purview_labeled_inputs']}`",
        f"- **Derived Contains Customer Data**: `{manifest['derived_contains_customer_data']}`",
        f"- **External Sharing Authorized By**: `{manifest['external_sharing_authorized_by'] or 'NONE'}`",
        "",
    ]

    if not records:
        lines.append("_No source files discovered._")
        return "\n".join(lines) + "\n"

    inventory_rows: list[list[Any]] = [["Path", "Type", "Bytes", "SHA-256", "Status", "Purview"]]
    for rec in records:
        inventory_rows.append(
            [
                rec.path,
                rec.file_type,
                rec.size_bytes,
                rec.sha256,
                rec.extraction_status,
                "yes" if rec.purview_labeled else "no",
            ]
        )
    lines.append(_render_markdown_table(inventory_rows))
    lines.append("")

    for rec in records:
        lines.extend(
            [
                f"## File: `{rec.path}`",
                "",
                f"- **Type**: `{rec.file_type}`",
                f"- **Bytes**: {rec.size_bytes}",
                f"- **SHA-256**: `{rec.sha256}`",
                f"- **Status**: `{rec.extraction_status}`",
            ]
        )
        if rec.purview_labeled:
            marker_str = ", ".join(f"`{m}`" for m in rec.purview_markers) if rec.purview_markers else "CLI flag"
            lines.append(f"- **Sensitivity / Purview Markers**: {marker_str}")
        for warn in rec.warnings:
            lines.append(f"- **Warning**: {warn}")
        lines.extend(["", rec.markdown or "_[Empty file]_", ""])

    return "\n".join(lines).rstrip() + "\n"


def extract_pursuit_sources(
    source_dir: Path,
    *,
    root: Path | None = None,
    manifest_out: Path | None = None,
    markdown_out: Path | None = None,
    extract_media_dir: Path | None = None,
    classification: str = "Confidential",
    purview_labeled: bool = False,
    derived_contains_customer_data: bool = True,
    external_sharing_authorized_by: str | None = None,
) -> dict[str, Any]:
    """Inventory, hash-lock, and extract all read-only pursuit files in `source_dir`."""
    effective_root = root if root is not None else source_dir.absolute().parent
    raw_root = Path(os.path.abspath(os.fspath(effective_root)))
    if effective_root.is_symlink() or raw_root.is_symlink():
        raise ContainmentError(f"Containment root cannot be a symlink: {effective_root}")
    resolved_root = effective_root.resolve()
    resolved_source_dir = ensure_within_root(
        _rebase_to_resolved_root(source_dir, raw_root, resolved_root),
        resolved_root,
    )

    if not resolved_source_dir.exists():
        raise ExtractionError(f"Source directory does not exist: {source_dir}")
    if not resolved_source_dir.is_dir():
        raise ExtractionError(f"Source path is not a directory: {source_dir}")

    resolved_manifest_out: Path | None = None
    if manifest_out is not None:
        resolved_manifest_out = _ensure_output_outside_source(
            manifest_out, resolved_source_dir, resolved_root, raw_root=raw_root
        )

    resolved_markdown_out: Path | None = None
    if markdown_out is not None:
        resolved_markdown_out = _ensure_output_outside_source(
            markdown_out, resolved_source_dir, resolved_root, raw_root=raw_root
        )

    resolved_media_dir: Path | None = None
    if extract_media_dir is not None:
        resolved_media_dir = _ensure_output_outside_source(
            extract_media_dir, resolved_source_dir, resolved_root, raw_root=raw_root
        )

    file_paths = _discover_source_files(resolved_source_dir, resolved_root)
    records: list[ExtractedFileRecord] = []
    any_detected_purview = False

    for file_path in file_paths:
        rel_posix = file_path.relative_to(resolved_source_dir).as_posix()
        suffix = file_path.suffix.lower()
        file_type = SUPPORTED_EXTENSIONS.get(suffix)
        if file_type is None:
            raise ExtractionError(f"Unsupported source file type '{suffix or '<no-ext>'}' for {rel_posix}")

        size_bytes = file_path.stat(follow_symlinks=False).st_size
        digest = sha256_file(file_path)

        purview_markers: list[str] = []
        warnings: list[str] = []
        status = "extracted"
        details: dict[str, Any] = {}

        if file_type == "xlsx":
            md_text, details, purview_markers, warnings = extract_xlsx_file(file_path)
        elif file_type == "docx":
            stem_posix = PurePosixPath(rel_posix).with_suffix("").as_posix()
            md_text, details, purview_markers, warnings = extract_docx_file(
                file_path,
                extract_media_dir=resolved_media_dir,
                root=resolved_root,
                rel_stem=stem_posix,
            )
        elif file_type == "csv":
            md_text, details, warnings = extract_csv_file(file_path)
        elif file_type in ("txt", "md"):
            md_text, details, warnings = extract_text_file(file_path)
        elif file_type == "eml":
            md_text, details, warnings = extract_eml_file(file_path)
        elif file_type == "pdf":
            md_text, details, status, warnings = extract_pdf_file(file_path)
        else:
            raise ExtractionError(f"Unhandled file type '{file_type}' for {rel_posix}")

        file_purview = bool(purview_markers)
        if file_purview:
            any_detected_purview = True

        records.append(
            ExtractedFileRecord(
                path=rel_posix,
                size_bytes=size_bytes,
                sha256=digest,
                file_type=file_type,
                extraction_status=status,
                purview_labeled=file_purview,
                purview_markers=purview_markers,
                warnings=warnings,
                markdown=md_text,
                details=details,
            )
        )

    rel_source_dir = (
        "." if resolved_source_dir == resolved_root else resolved_source_dir.relative_to(resolved_root).as_posix()
    )

    manifest: dict[str, Any] = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "source_dir": rel_source_dir,
        "file_count": len(records),
        "total_bytes": sum(rec.size_bytes for rec in records),
        "classification": classification,
        "purview_labeled_inputs": bool(purview_labeled or any_detected_purview),
        "derived_contains_customer_data": bool(derived_contains_customer_data),
        "external_sharing_authorized_by": external_sharing_authorized_by,
        "files": [rec.to_manifest_entry() for rec in records],
    }

    markdown_bundle = _render_bundle_markdown(manifest, records)

    if resolved_manifest_out is not None:
        resolved_manifest_out.parent.mkdir(parents=True, exist_ok=True)
        resolved_manifest_out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    if resolved_markdown_out is not None:
        resolved_markdown_out.parent.mkdir(parents=True, exist_ok=True)
        resolved_markdown_out.write_text(markdown_bundle, encoding="utf-8")

    return {
        "manifest": manifest,
        "markdown": markdown_bundle,
        "records": records,
    }


def _check_git_source_unchanged(resolved_source_dir: Path) -> tuple[bool, list[str]]:
    """Verify `git status --porcelain -- <source-dir>` reports zero staged or modified tracked files."""
    git_bin = shutil.which("git")
    if git_bin is None:
        return False, ["git executable not found on PATH"]

    proc = subprocess.run(
        [git_bin, "--no-pager", "status", "--porcelain", "--", str(resolved_source_dir)],
        cwd=str(resolved_source_dir),
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if proc.returncode != 0:
        err = proc.stderr.strip() or f"git status exited with code {proc.returncode}"
        return False, [f"git status check failed: {err}"]

    dirty_lines: list[str] = []
    for raw_line in proc.stdout.splitlines():
        if not raw_line.strip():
            continue
        status_xy = raw_line[:2]
        if status_xy not in ("??", "!!"):
            dirty_lines.append(raw_line)

    if dirty_lines:
        return False, [f"Tracked git mutations detected in source directory: {'; '.join(dirty_lines)}"]
    return True, []


def verify_source_manifest(
    source_dir: Path,
    manifest_path: Path,
    *,
    root: Path | None = None,
    check_git_unchanged: bool = False,
) -> dict[str, Any]:
    """Verify `source_dir` matches recorded file count, byte sizes, and SHA-256 digests in `manifest_path`."""
    effective_root = root if root is not None else source_dir.absolute().parent
    raw_root = Path(os.path.abspath(os.fspath(effective_root)))
    if effective_root.is_symlink() or raw_root.is_symlink():
        raise ContainmentError(f"Containment root cannot be a symlink: {effective_root}")
    resolved_root = effective_root.resolve()
    resolved_source_dir = ensure_within_root(
        _rebase_to_resolved_root(source_dir, raw_root, resolved_root),
        resolved_root,
    )
    resolved_manifest = ensure_within_root(
        _rebase_to_resolved_root(manifest_path, raw_root, resolved_root),
        resolved_root,
    )

    if not resolved_source_dir.is_dir():
        raise ExtractionError(f"Source directory does not exist: {source_dir}")
    if not resolved_manifest.is_file():
        raise ExtractionError(f"Manifest file does not exist: {manifest_path}")

    try:
        manifest_data = json.loads(resolved_manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ExtractionError(f"Invalid manifest JSON {manifest_path}: {exc}") from exc

    if not isinstance(manifest_data, dict) or not isinstance(manifest_data.get("files"), list):
        raise ExtractionError(f"Manifest {manifest_path} is missing a valid 'files' array")

    expected_by_path: dict[str, dict[str, Any]] = {}
    errors: list[str] = []
    for idx, entry in enumerate(manifest_data["files"]):
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise ExtractionError(f"Manifest entry #{idx} is malformed")
        rel_path = entry["path"]
        if rel_path in expected_by_path:
            errors.append(f"Duplicate path in manifest: {rel_path}")
        expected_by_path[rel_path] = entry

    recorded_count = manifest_data.get("file_count")
    if isinstance(recorded_count, int) and recorded_count != len(expected_by_path):
        errors.append(f"Manifest file_count ({recorded_count}) does not match entries length ({len(expected_by_path)})")

    actual_files = _discover_source_files(resolved_source_dir, resolved_root)
    actual_by_path: dict[str, Path] = {p.relative_to(resolved_source_dir).as_posix(): p for p in actual_files}

    missing_files = sorted(set(expected_by_path) - set(actual_by_path))
    extra_files = sorted(set(actual_by_path) - set(expected_by_path))
    mutated_files: list[dict[str, Any]] = []

    for missing in missing_files:
        errors.append(f"Missing expected file: {missing}")
    for extra in extra_files:
        errors.append(f"Unexpected extra file: {extra}")

    for rel_path in sorted(set(expected_by_path) & set(actual_by_path)):
        expected = expected_by_path[rel_path]
        actual_path = actual_by_path[rel_path]
        actual_size = actual_path.stat(follow_symlinks=False).st_size
        actual_sha = sha256_file(actual_path)

        expected_size = expected.get("size_bytes", expected.get("bytes"))
        expected_sha = str(expected.get("sha256", "")).lower()

        size_mismatch = expected_size != actual_size
        sha_mismatch = expected_sha != actual_sha
        if size_mismatch or sha_mismatch:
            mutated_files.append(
                {
                    "path": rel_path,
                    "expected_size_bytes": expected_size,
                    "actual_size_bytes": actual_size,
                    "expected_sha256": expected_sha,
                    "actual_sha256": actual_sha,
                }
            )
            errors.append(
                f"File mutated: {rel_path} "
                f"(size expected={expected_size} actual={actual_size}, "
                f"sha256 expected={expected_sha} actual={actual_sha})"
            )

    if isinstance(recorded_count, int) and len(actual_by_path) != recorded_count:
        errors.append(f"Actual file count ({len(actual_by_path)}) differs from recorded file_count ({recorded_count})")

    git_unchanged: bool | None = None
    if check_git_unchanged:
        git_ok, git_errors = _check_git_source_unchanged(resolved_source_dir)
        git_unchanged = git_ok
        errors.extend(git_errors)

    ok = not errors and not missing_files and not extra_files and not mutated_files
    return {
        "ok": ok,
        "checked_files": len(actual_by_path),
        "expected_files": len(expected_by_path),
        "missing_files": missing_files,
        "extra_files": extra_files,
        "mutated_files": mutated_files,
        "git_unchanged": git_unchanged,
        "errors": errors,
    }


def build_arg_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser for `extract_pursuit_sources.py`."""
    parser = argparse.ArgumentParser(
        prog="extract_pursuit_sources.py",
        description=(
            "Safely inventory, hash-lock, verify, and extract read-only customer or partner pursuit "
            "sources (.xlsx, .docx, .csv, .txt, .md, .eml, .pdf) within a strict containment root "
            "(for example, workloads targeting swedencentral or germanywestcentral)."
        ),
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        required=True,
        help="Read-only pursuit input directory (for example, rfi-docs/ or emails/).",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Containment root directory (defaults to parent directory of --source-dir).",
    )
    parser.add_argument(
        "--manifest-out",
        type=Path,
        default=None,
        help="Output path for deterministic SHA-256 source-manifest.json.",
    )
    parser.add_argument(
        "--verify-manifest",
        type=Path,
        default=None,
        help="Existing source-manifest.json path to verify against --source-dir.",
    )
    parser.add_argument(
        "--check-git-unchanged",
        action="store_true",
        help="Verify `git status --porcelain -- <source-dir>` shows zero staged or modified tracked mutations.",
    )
    parser.add_argument(
        "--markdown-out",
        type=Path,
        default=None,
        help="Output path for extracted Markdown transcription.",
    )
    parser.add_argument(
        "--extract-media-dir",
        type=Path,
        default=None,
        help="Optional directory within --root to write embedded .docx media files.",
    )
    parser.add_argument(
        "--classification",
        type=str,
        default="Confidential",
        help="Sensitivity classification recorded in source-manifest.json (default: Confidential).",
    )
    parser.add_argument(
        "--purview-labeled",
        action="store_true",
        help="Explicitly mark purview_labeled_inputs=true in source-manifest.json.",
    )
    parser.add_argument(
        "--derived-contains-customer-data",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Record whether derived outputs contain customer data (default: true).",
    )
    parser.add_argument(
        "--external-sharing-authorized-by",
        type=str,
        default=None,
        help="Optional approver identity authorizing external sharing of derived artifacts.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point returning 0 on success, 1 on verification/extraction failure, 2 on ContainmentError."""
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    try:
        if args.verify_manifest is not None:
            verification = verify_source_manifest(
                args.source_dir,
                args.verify_manifest,
                root=args.root,
                check_git_unchanged=args.check_git_unchanged,
            )
            if not verification["ok"]:
                print(json.dumps(verification, indent=2), file=sys.stderr)
                return 1
            if args.manifest_out is None and args.markdown_out is None:
                print(json.dumps(verification, indent=2))
                return 0

        result = extract_pursuit_sources(
            args.source_dir,
            root=args.root,
            manifest_out=args.manifest_out,
            markdown_out=args.markdown_out,
            extract_media_dir=args.extract_media_dir,
            classification=args.classification,
            purview_labeled=args.purview_labeled,
            derived_contains_customer_data=args.derived_contains_customer_data,
            external_sharing_authorized_by=args.external_sharing_authorized_by,
        )

        if args.check_git_unchanged and args.verify_manifest is None:
            effective_root = args.root if args.root is not None else args.source_dir.absolute().parent
            raw_root = Path(os.path.abspath(os.fspath(effective_root)))
            if effective_root.is_symlink() or raw_root.is_symlink():
                raise ContainmentError(f"Containment root cannot be a symlink: {effective_root}")
            resolved_root = effective_root.resolve()
            resolved_source_dir = ensure_within_root(
                _rebase_to_resolved_root(args.source_dir, raw_root, resolved_root),
                resolved_root,
            )
            git_ok, git_errors = _check_git_source_unchanged(resolved_source_dir)
            if not git_ok:
                print(json.dumps({"ok": False, "errors": git_errors}, indent=2), file=sys.stderr)
                return 1

        if args.manifest_out is None and args.markdown_out is None:
            print(json.dumps(result["manifest"], indent=2))
        return 0
    except ContainmentError as exc:
        print(f"CONTAINMENT_ERROR: {exc}", file=sys.stderr)
        return 2
    except (ExtractionError, FileNotFoundError, OSError) as exc:
        print(f"EXTRACTION_ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
