#!/usr/bin/env python3
"""End-to-end deterministic verification gate for RFI/RFP/BAFO pursuit packages.

Validates directory containment (zero symlinks), read-only source manifest SHA-256
integrity, canonical PROJECT-README H2 headings, absence of reserved APEX delivery-step
artifact suffixes, Excel AST/<v>/header-footer compliance on all generated workbooks,
canonical ADR H2 headings, PNG IHDR dimensions, relative Markdown links, and optional
headline number parity across JSON, .xlsx, and README.md.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import os
import re
import struct
import sys
import urllib.parse
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import Any

import openpyxl

try:
    from ._safe_io import ContainmentError, ensure_within_root, sha256_file
    from .xlsx_ast_cache import (
        CacheParityError,
        CircularFormulaError,
        FormulaEvaluationError,
        HeaderFooterLimitError,
        UnsupportedFormulaError,
        verify_workbook_caches,
    )
except ImportError:
    _SCRIPT_DIR = str(Path(__file__).resolve().parent)
    if _SCRIPT_DIR not in sys.path:
        sys.path.insert(0, _SCRIPT_DIR)
    from _safe_io import (  # type: ignore[no-redef]
        ContainmentError,
        ensure_within_root,
        sha256_file,
    )
    from xlsx_ast_cache import (  # type: ignore[no-redef]
        CacheParityError,
        CircularFormulaError,
        FormulaEvaluationError,
        HeaderFooterLimitError,
        UnsupportedFormulaError,
        verify_workbook_caches,
    )

EXPECTED_PROJECT_README_H2S: list[str] = [
    "## 📋 Project Summary",
    "## ✅ Workflow Progress",
    "## 🏛️ Architecture",
    "## 📄 Generated Artifacts",
    "## 🔗 Related Resources",
]

EXPECTED_ADR_H2S: list[str] = [
    "## 🔍 Context",
    "## ✅ Decision",
    "## 🔄 Alternatives Considered",
    "## ⚖️ Consequences",
    "## 🏛️ WAF Pillar Analysis",
    "## 🔒 Compliance Considerations",
    "## 📝 Implementation Notes",
]

RESERVED_DELIVERY_MD_SUFFIXES: tuple[str, ...] = (
    "00-handoff.md",
    "01-assessment-brief.md",
    "01-requirements.md",
    "02-architecture-assessment.md",
    "03-cost-management-report.md",
    "03-des-cost-estimate.md",
    "04-assessment-action-register.md",
    "04-governance-constraints.md",
    "04-implementation-plan.md",
    "04-preflight-check.md",
    "05-implementation-reference.md",
    "06-deployment-summary.md",
    "09-lessons-learned.md",
)

RESERVED_GOVERNANCE_JSON_NAME = "04-governance-constraints.json"
READONLY_SOURCE_DIRS: frozenset[str] = frozenset({"rfi-docs", "emails", "_meta", "source", "source-archive"})
CUSTOMER_INPUT_SOURCE_DIRS: tuple[str, ...] = ("rfi-docs", "emails", "source", "source-archive")
EXCLUDED_NESTED_README_DIRS: frozenset[str] = READONLY_SOURCE_DIRS | frozenset({"scripts", "_baselines"})
DEFAULT_MIN_PNG_WIDTH = 3000

_HTML_COMMENT_RE = re.compile(r"\s*<!--[\s\S]*?-->\s*$")
_FENCE_OPEN_RE = re.compile(r"^\s*(`{3,}|~{3,})")
_INLINE_CODE_RE = re.compile(r"`[^`\n]+`")
_MD_LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
_EXTERNAL_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")


class PackageVerificationError(ValueError):
    """Raised when one or more pursuit package verification checks fail."""

    def __init__(self, errors: Sequence[str], report: dict[str, Any] | None = None) -> None:
        self.errors = list(errors)
        self.report = report or {}
        super().__init__("; ".join(self.errors))


def read_png_dimensions(png_path: Path) -> tuple[int, int]:
    """Read and validate ``(width, height)`` from a PNG file's 24-byte signature + IHDR header."""
    if png_path.is_symlink():
        raise ContainmentError(f"Refusing symlink PNG file: {png_path}")
    header = png_path.read_bytes()[:24]
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"Invalid PNG signature or missing IHDR chunk in {png_path}")
    width, height = struct.unpack(">II", header[16:24])
    if width <= 0 or height <= 0:
        raise ValueError(f"Invalid zero PNG dimensions ({width}x{height}) in {png_path}")
    return width, height


def extract_markdown_h2_headings(markdown_text: str) -> list[str]:
    """Extract H2 headings outside fenced code blocks, stripping trailing HTML comments."""
    headings: list[str] = []
    in_fence = False
    fence_marker = ""

    for raw_line in markdown_text.splitlines():
        if not in_fence:
            m_open = _FENCE_OPEN_RE.match(raw_line)
            if m_open:
                in_fence = True
                fence_marker = m_open.group(1)
                continue
            stripped = raw_line.strip()
            if stripped.startswith("## ") and not stripped.startswith("###"):
                cleaned = _HTML_COMMENT_RE.sub("", stripped).strip()
                headings.append(cleaned)
        else:
            if raw_line.lstrip().startswith(fence_marker):
                in_fence = False
                fence_marker = ""
    return headings


def strip_fenced_and_inline_code(markdown_text: str) -> str:
    """Remove fenced code blocks and inline code spans before scanning Markdown links."""
    kept_lines: list[str] = []
    in_fence = False
    fence_marker = ""

    for raw_line in markdown_text.splitlines():
        if not in_fence:
            m_open = _FENCE_OPEN_RE.match(raw_line)
            if m_open:
                in_fence = True
                fence_marker = m_open.group(1)
                continue
            kept_lines.append(_INLINE_CODE_RE.sub("", raw_line))
        else:
            if raw_line.lstrip().startswith(fence_marker):
                in_fence = False
                fence_marker = ""
    return "\n".join(kept_lines)


def _is_under_readonly_dir(rel_posix: str, extra_readonly_dirs: frozenset[str]) -> bool:
    parts = PurePosixPath(rel_posix).parts
    if len(parts) <= 1:
        return False
    return parts[0] in (READONLY_SOURCE_DIRS | extra_readonly_dirs) or "_meta" in parts[:-1]


def _is_under_excluded_readme_dir(rel_posix: str, extra_readonly_dirs: frozenset[str]) -> bool:
    parts = PurePosixPath(rel_posix).parts
    if len(parts) <= 1:
        return False
    return parts[0] in (EXCLUDED_NESTED_README_DIRS | extra_readonly_dirs) or "_meta" in parts[:-1]


def verify_directory_containment(package_dir: Path) -> list[Path]:
    """Verify ``package_dir`` contains zero symlinks and all entries resolve inside root."""
    if package_dir.is_symlink():
        raise ContainmentError(f"Package directory cannot be a symlink: {package_dir}")
    if not package_dir.is_dir():
        raise FileNotFoundError(f"Package directory does not exist: {package_dir}")

    regular_files: list[Path] = []
    for dirpath_str, dirnames, filenames in os.walk(package_dir, topdown=True, followlinks=False):
        dirpath = Path(dirpath_str)
        ensure_within_root(dirpath, package_dir)
        dirnames.sort()
        filenames.sort()

        for dname in dirnames:
            dpath = dirpath / dname
            if dpath.is_symlink():
                raise ContainmentError(f"Symlink directory forbidden inside pursuit package: {dpath}")
            ensure_within_root(dpath, package_dir)

        for fname in filenames:
            fpath = dirpath / fname
            if fpath.is_symlink():
                raise ContainmentError(f"Symlink file forbidden inside pursuit package: {fpath}")
            ensure_within_root(fpath, package_dir)
            regular_files.append(fpath)

    return regular_files


def _find_source_manifest(package_dir: Path, explicit_manifest: Path | None) -> Path | None:
    if explicit_manifest is not None:
        if explicit_manifest.is_symlink():
            raise ContainmentError(f"Refusing symlink source manifest: {explicit_manifest}")
        if not explicit_manifest.is_file():
            raise FileNotFoundError(f"Source manifest not found: {explicit_manifest}")
        if explicit_manifest.resolve().is_relative_to(package_dir.resolve()):
            ensure_within_root(explicit_manifest, package_dir)
        return explicit_manifest

    for rel in ("source-manifest.json", "pricing/source-manifest.json", "_meta/source-manifest.json"):
        cand = package_dir / rel
        if cand.is_symlink():
            raise ContainmentError(f"Refusing symlink source manifest: {cand}")
        if cand.is_file():
            return cand
    return None


def _discover_regular_files_strict(scan_dir: Path, containment_root: Path) -> list[Path]:
    """Walk ``scan_dir`` recursively, rejecting symlinks and returning sorted regular files."""
    found: list[Path] = []
    for dirpath_str, dirnames, filenames in os.walk(scan_dir, topdown=True, followlinks=False):
        dirpath = Path(dirpath_str)
        ensure_within_root(dirpath, containment_root)
        dirnames.sort()
        filenames.sort()
        for dname in dirnames:
            dpath = dirpath / dname
            if dpath.is_symlink():
                raise ContainmentError(f"Symlink directory forbidden inside source directory: {dpath}")
            ensure_within_root(dpath, containment_root)
        for fname in filenames:
            fpath = dirpath / fname
            if fpath.is_symlink():
                raise ContainmentError(f"Symlink file forbidden inside source directory: {fpath}")
            resolved = ensure_within_root(fpath, containment_root)
            if resolved.is_file():
                found.append(fpath)
    found.sort(key=lambda p: p.relative_to(scan_dir).as_posix())
    return found


def verify_source_manifest(
    package_dir: Path,
    manifest_path: Path,
) -> tuple[dict[str, Any], list[str], str | None]:
    """Verify read-only source inventory, exact byte sizes, and SHA-256 digests against ``manifest_path``."""
    errors: list[str] = []
    raw_doc = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw_doc, dict):
        return {"checked": 0}, [f"Source manifest {manifest_path} must be a JSON object"], None

    source_dir_rel = str(raw_doc.get("source_dir") or "").strip().strip("/")
    if source_dir_rel in ("", "."):
        source_dir_rel = None

    raw_entries = raw_doc.get("files") if "files" in raw_doc else raw_doc.get("sources", [])
    normalized_entries: list[tuple[str, int, str]] = []

    if isinstance(raw_entries, list):
        for idx, item in enumerate(raw_entries):
            if not isinstance(item, dict):
                errors.append(f"Manifest entry #{idx} is not an object")
                continue
            rel_p = str(item.get("path") or item.get("relative_path") or item.get("file") or "").strip()
            size_v = item.get("size_bytes", item.get("size", item.get("bytes")))
            sha_v = str(item.get("sha256") or item.get("hash") or "").strip().lower()
            if not rel_p or size_v is None or not sha_v:
                errors.append(f"Manifest entry #{idx} missing path, size_bytes, or sha256")
                continue
            normalized_entries.append((rel_p, int(size_v), sha_v))
    elif isinstance(raw_entries, dict):
        for rel_p, meta in raw_entries.items():
            if isinstance(meta, dict):
                size_v = meta.get(
                    "size_bytes",
                    meta.get("size", item_bytes if (item_bytes := meta.get("bytes")) is not None else None),
                )
                sha_v = str(meta.get("sha256") or meta.get("hash") or "").strip().lower()
            elif isinstance(meta, list) and len(meta) == 2:
                size_v, sha_v = meta[0], str(meta[1]).strip().lower()
            else:
                errors.append(f"Unsupported manifest mapping entry for {rel_p!r}")
                continue
            if size_v is None or not sha_v:
                errors.append(f"Manifest entry for {rel_p!r} missing size_bytes or sha256")
                continue
            normalized_entries.append((str(rel_p), int(size_v), sha_v))
    else:
        errors.append(f"Manifest {manifest_path.name} 'files' must be a list or object")

    seen_manifest_paths: set[str] = set()
    for rel_p, _, _ in normalized_entries:
        if rel_p in seen_manifest_paths:
            errors.append(f"Duplicate path in source manifest: {rel_p!r}")
        seen_manifest_paths.add(rel_p)

    if "file_count" in raw_doc and int(raw_doc["file_count"]) != len(normalized_entries):
        errors.append(
            f"Manifest file_count={raw_doc['file_count']} mismatches {len(normalized_entries)} listed entries"
        )

    manifest_resolved = manifest_path.resolve()
    verified_resolved_files: set[Path] = set()
    verified = 0
    for rel_p, exp_size, exp_sha in normalized_entries:
        candidates: list[Path] = []
        if source_dir_rel:
            candidates.append(package_dir / source_dir_rel / rel_p)
        candidates.append(package_dir / rel_p)
        if manifest_path.parent != package_dir:
            candidates.append(manifest_path.parent / rel_p)

        resolved_target: Path | None = None
        for cand in candidates:
            if cand.resolve().is_relative_to(package_dir.resolve()):
                ensure_within_root(cand, package_dir)
            if cand.exists() or cand.is_symlink():
                resolved_target = cand
                break

        if resolved_target is None:
            errors.append(f"Missing read-only source file from manifest: {rel_p!r}")
            continue
        if resolved_target.is_symlink():
            raise ContainmentError(f"Read-only source file is a symlink: {resolved_target}")
        verified_resolved_files.add(resolved_target.resolve())
        actual_size = resolved_target.stat().st_size
        actual_sha = sha256_file(resolved_target)
        if actual_size != exp_size:
            errors.append(f"Source file {rel_p!r} byte size mismatch: expected {exp_size}, got {actual_size}")
            continue
        if actual_sha != exp_sha:
            errors.append(f"Source file {rel_p!r} SHA-256 mismatch: expected {exp_sha}, got {actual_sha}")
            continue
        verified += 1

    # Strict current-directory inventory comparison so unrecorded post-intake files fail closed
    if source_dir_rel is not None:
        src_dir_path = package_dir / source_dir_rel
        if src_dir_path.is_symlink():
            raise ContainmentError(f"Manifest source_dir cannot be a symlink: {src_dir_path}")
        if src_dir_path.resolve().is_relative_to(package_dir.resolve()):
            ensure_within_root(src_dir_path, package_dir)
        if not src_dir_path.is_dir():
            errors.append(f"Manifest source_dir {source_dir_rel!r} does not exist in {package_dir}")
        else:
            actual_src_files = [
                f for f in _discover_regular_files_strict(src_dir_path, package_dir) if f.resolve() != manifest_resolved
            ]
            expected_src_rels: set[str] = set()
            prefix_slash = f"{source_dir_rel}/"
            for rel_p, _, _ in normalized_entries:
                norm_rel = rel_p[len(prefix_slash) :] if rel_p.startswith(prefix_slash) else rel_p
                expected_src_rels.add(norm_rel)

            actual_src_rels = {f.relative_to(src_dir_path).as_posix() for f in actual_src_files}
            for extra_rel in sorted(actual_src_rels - expected_src_rels):
                errors.append(f"Unexpected unrecorded file in source directory {source_dir_rel!r}: {extra_rel!r}")
            if "file_count" in raw_doc and int(raw_doc["file_count"]) != len(actual_src_rels):
                errors.append(
                    f"Actual source directory file count ({len(actual_src_rels)}) "
                    f"differs from manifest file_count ({raw_doc['file_count']})"
                )
    else:
        monitored_dirs: set[Path] = set()
        for std_name in CUSTOMER_INPUT_SOURCE_DIRS:
            cand_dir = package_dir / std_name
            if cand_dir.is_symlink():
                raise ContainmentError(f"Source directory cannot be a symlink: {cand_dir}")
            if cand_dir.is_dir():
                monitored_dirs.add(cand_dir)
        for rel_p, _, _ in normalized_entries:
            parts = PurePosixPath(rel_p).parts
            if len(parts) > 1 and parts[0] != "_meta":
                cand_sub = package_dir / parts[0]
                if cand_sub.is_dir():
                    monitored_dirs.add(cand_sub)

        for mon_dir in sorted(monitored_dirs):
            for disk_file in _discover_regular_files_strict(mon_dir, package_dir):
                if disk_file.resolve() == manifest_resolved:
                    continue
                if disk_file.resolve() not in verified_resolved_files:
                    rel_unrecorded = disk_file.relative_to(package_dir).as_posix()
                    errors.append(f"Unexpected unrecorded file in read-only source directory: {rel_unrecorded!r}")

    top_readonly = source_dir_rel.split("/", 1)[0] if source_dir_rel else None
    return (
        {"manifest_path": str(manifest_path), "entries_total": len(normalized_entries), "entries_verified": verified},
        errors,
        top_readonly,
    )


def _is_reserved_delivery_markdown(filename: str) -> bool:
    low = filename.lower()
    if any(low == sfx or low.endswith(f"-{sfx}") or low.endswith(sfx) for sfx in RESERVED_DELIVERY_MD_SUFFIXES):
        return True
    return fnmatch.fnmatchcase(low, "07-*.md")


def _parse_headline_float(headline: str) -> float | None:
    # Remove currency symbols/letters and spaces while keeping digits, commas, dots, and leading minus
    cleaned = re.sub(r"[^0-9.,\-]", "", headline.strip())
    if not cleaned:
        return None
    # Handle standard US/UK comma thousands (e.g. 12,450.00)
    if "," in cleaned and "." in cleaned and cleaned.rfind(",") < cleaned.rfind("."):
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." not in cleaned:
        parts = cleaned.split(",")
        if len(parts) > 1 and all(len(p) == 3 for p in parts[1:]):
            cleaned = "".join(parts)
    try:
        return float(cleaned)
    except ValueError:
        return None


def _json_contains_headline(node: Any, raw_headline: str, num_target: float | None) -> bool:
    if isinstance(node, dict):
        return any(_json_contains_headline(v, raw_headline, num_target) for v in node.values())
    if isinstance(node, list):
        return any(_json_contains_headline(item, raw_headline, num_target) for item in node)
    if isinstance(node, bool) or node is None:
        return False
    if isinstance(node, (int, float)):
        return num_target is not None and abs(float(node) - num_target) < 0.01
    if isinstance(node, str):
        if raw_headline in node:
            return True
        if num_target is not None:
            parsed = _parse_headline_float(node)
            if parsed is not None and abs(parsed - num_target) < 0.01:
                return True
    return False


def _xlsx_contains_headline(xlsx_path: Path, raw_headline: str, num_target: float | None) -> bool:
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    try:
        for sh in wb.sheetnames:
            ws = wb[sh]
            cells_map = getattr(ws, "_cells", {})
            for cell in cells_map.values():
                val = cell.value
                if val is None or isinstance(val, bool):
                    continue
                if isinstance(val, (int, float)):
                    if num_target is not None and abs(float(val) - num_target) < 0.01:
                        return True
                elif isinstance(val, str):
                    if raw_headline in val:
                        return True
                    if num_target is not None:
                        parsed = _parse_headline_float(val)
                        if parsed is not None and abs(parsed - num_target) < 0.01:
                            return True
        return False
    finally:
        wb.close()


def verify_pursuit_package(
    package_dir: Path,
    *,
    source_manifest: Path | None = None,
    min_png_width: int = DEFAULT_MIN_PNG_WIDTH,
    explicit_min_png_width: bool = False,
    self_contained: bool = False,
    headline_numbers: Sequence[str] = (),
    pricing_json: Path | None = None,
) -> dict[str, Any]:
    """Run all deterministic pursuit package verification gates and return a structured report."""
    errors: list[str] = []

    # 1. Directory containment & zero symlinks
    all_files = verify_directory_containment(package_dir)

    # 2. Source manifest SHA-256 & byte-size check (if provided or present)
    extra_readonly: set[str] = set()
    manifest_file = _find_source_manifest(package_dir, source_manifest)
    manifest_summary: dict[str, Any] | None = None
    if manifest_file is not None:
        manifest_summary, manifest_errs, custom_src_top = verify_source_manifest(package_dir, manifest_file)
        errors.extend(manifest_errs)
        if custom_src_top:
            extra_readonly.add(custom_src_top)
    readonly_dirs = frozenset(extra_readonly)

    # 3. Root and nested *README.md existence & exact 5 PROJECT-README H2 headings in order
    readme_path = package_dir / "README.md"
    readme_text = ""
    if not readme_path.is_file():
        errors.append(f"Missing required README.md in {package_dir}")
    else:
        readme_text = readme_path.read_text(encoding="utf-8")
        readme_h2s = extract_markdown_h2_headings(readme_text)
        if readme_h2s != EXPECTED_PROJECT_README_H2S:
            errors.append(f"README.md H2 headings mismatch: expected {EXPECTED_PROJECT_README_H2S}, got {readme_h2s}")

    md_files = [p for p in all_files if p.suffix.lower() == ".md"]
    for md_path in md_files:
        if md_path == readme_path:
            continue
        rel_md = md_path.relative_to(package_dir).as_posix()
        low_name = md_path.name.lower()
        if low_name.endswith(".extracted.md") or _is_under_excluded_readme_dir(rel_md, readonly_dirs):
            continue
        if low_name.endswith("readme.md"):
            nested_h2s = extract_markdown_h2_headings(md_path.read_text(encoding="utf-8"))
            if nested_h2s != EXPECTED_PROJECT_README_H2S:
                errors.append(
                    f"{rel_md} H2 headings mismatch: expected {EXPECTED_PROJECT_README_H2S}, got {nested_h2s}"
                )

    # 4. Zero reserved APEX delivery-step Markdown/JSON filenames/suffixes
    reserved_violations: list[str] = []
    for md_path in md_files:
        rel_md = md_path.relative_to(package_dir).as_posix()
        if _is_reserved_delivery_markdown(md_path.name):
            reserved_violations.append(rel_md)
            errors.append(
                f"Forbidden reserved APEX delivery-step Markdown suffix: {rel_md!r} "
                "(conflicts with validate-artifacts.mjs / validate-challenger-presence.mjs)"
            )

    for file_path in all_files:
        rel_file = file_path.relative_to(package_dir).as_posix()
        if file_path.name.lower() == RESERVED_GOVERNANCE_JSON_NAME and not _is_under_readonly_dir(
            rel_file, readonly_dirs
        ):
            reserved_violations.append(rel_file)
            errors.append(
                f"Forbidden reserved APEX governance JSON filename: {rel_file!r} "
                "(conflicts with validate-artifacts.mjs)"
            )

    # 5. Generated .xlsx AST evaluation, <v> cache parity, and <=255-char header/footer check
    xlsx_files = [
        p
        for p in all_files
        if p.suffix.lower() == ".xlsx"
        and not _is_under_readonly_dir(p.relative_to(package_dir).as_posix(), readonly_dirs)
    ]
    xlsx_reports: list[dict[str, Any]] = []
    for x_path in xlsx_files:
        rel_x = x_path.relative_to(package_dir).as_posix()
        try:
            x_rep = verify_workbook_caches(x_path)
            xlsx_reports.append(x_rep)
        except (
            ContainmentError,
            UnsupportedFormulaError,
            CircularFormulaError,
            FormulaEvaluationError,
            HeaderFooterLimitError,
            CacheParityError,
            ValueError,
        ) as exc:
            errors.append(f"Workbook verification failed for {rel_x}: {type(exc).__name__}: {exc}")

    # 6. ADR H2 headings check on any 03-des-adr-*.md files
    adr_files = [
        p
        for p in md_files
        if fnmatch.fnmatchcase(p.name.lower(), "03-des-adr-*.md")
        and not _is_under_readonly_dir(p.relative_to(package_dir).as_posix(), readonly_dirs)
    ]
    for adr_path in adr_files:
        rel_adr = adr_path.relative_to(package_dir).as_posix()
        adr_txt = adr_path.read_text(encoding="utf-8")
        adr_h2s = [h for h in extract_markdown_h2_headings(adr_txt) if h != "## References"]
        if adr_h2s != EXPECTED_ADR_H2S:
            errors.append(f"ADR H2 heading mismatch in {rel_adr}: expected {EXPECTED_ADR_H2S}, got {adr_h2s}")

    # 7. assets/*.png valid PNG header + IHDR dimensions check
    assets_dir = package_dir / "assets"
    png_checked = 0
    if assets_dir.is_dir():
        png_files = sorted(p for p in assets_dir.rglob("*.png") if p.is_file())
        has_des_pngs = any(p.name.lower().startswith("03-des-") for p in png_files)
        for png_path in png_files:
            rel_png = png_path.relative_to(package_dir).as_posix()
            try:
                width, height = read_png_dimensions(png_path)
                png_checked += 1
            except (ContainmentError, ValueError) as exc:
                errors.append(f"PNG validation failed for {rel_png}: {exc}")
                continue
            check_width = png_path.name.lower().startswith("03-des-") or (explicit_min_png_width and not has_des_pngs)
            if check_width and width < min_png_width:
                errors.append(f"PNG {rel_png} width {width}px ({width}x{height}) is below minimum {min_png_width}px")

    # 8a. Zero broken relative Markdown links across generated .md files
    generated_md_files = [
        p
        for p in md_files
        if not _is_under_readonly_dir(p.relative_to(package_dir).as_posix(), readonly_dirs)
        and not p.name.lower().endswith(".extracted.md")
    ]
    links_checked = 0
    for md_path in generated_md_files:
        rel_md = md_path.relative_to(package_dir).as_posix()
        raw_md = md_path.read_text(encoding="utf-8")
        sanitized_md = strip_fenced_and_inline_code(raw_md)
        for m in _MD_LINK_RE.finditer(sanitized_md):
            raw_target = m.group(1).strip()
            if raw_target.startswith("<") and ">" in raw_target:
                raw_target = raw_target[1 : raw_target.index(">")].strip()
            elif " " in raw_target and ('"' in raw_target or "'" in raw_target):
                raw_target = raw_target.split(None, 1)[0]

            if not raw_target or raw_target.startswith("#") or _EXTERNAL_SCHEME_RE.match(raw_target):
                continue

            path_part = raw_target.split("#", 1)[0].split("?", 1)[0]
            decoded_rel = urllib.parse.unquote(path_part)
            if not decoded_rel:
                continue

            links_checked += 1
            if decoded_rel.startswith("/"):
                errors.append(f"Forbidden root-relative link {raw_target!r} in {rel_md}")
                continue

            candidate_target = md_path.parent / decoded_rel
            resolved_target = candidate_target.resolve()

            if self_contained:
                if not resolved_target.is_relative_to(package_dir.resolve()):
                    errors.append(f"Link {raw_target!r} in {rel_md} escapes package root under --self-contained")
                    continue
                try:
                    ensure_within_root(candidate_target, package_dir)
                except ContainmentError as exc:
                    errors.append(f"Link {raw_target!r} in {rel_md} escapes package root: {exc}")
                    continue

            if not resolved_target.exists():
                errors.append(f"Broken relative link in {rel_md}: {raw_target!r} -> {resolved_target}")

    # 8b. Optional --headline-number parity across README.md, JSON, and .xlsx
    if headline_numbers:
        if pricing_json is not None:
            if pricing_json.is_symlink():
                raise ContainmentError(f"Refusing symlink pricing JSON: {pricing_json}")
            if not pricing_json.is_file():
                errors.append(f"Pricing JSON not found: {pricing_json}")
                json_candidates: list[Path] = []
            else:
                json_candidates = [pricing_json]
        else:
            json_candidates = [
                p
                for p in all_files
                if p.suffix.lower() == ".json"
                and p.name != "source-manifest.json"
                and not _is_under_readonly_dir(p.relative_to(package_dir).as_posix(), readonly_dirs)
            ]

        loaded_jsons: list[tuple[Path, Any]] = []
        for jp in json_candidates:
            try:
                loaded_jsons.append((jp, json.loads(jp.read_text(encoding="utf-8"))))
            except json.JSONDecodeError as exc:
                errors.append(f"Invalid JSON in {jp.relative_to(package_dir).as_posix()}: {exc}")

        for headline in headline_numbers:
            num_val = _parse_headline_float(headline)
            if headline not in readme_text:
                errors.append(f"Headline number {headline!r} missing from README.md")
            if not loaded_jsons:
                errors.append(f"Cannot verify headline {headline!r} parity: no pricing JSON files found")
            elif not any(_json_contains_headline(doc, headline, num_val) for _, doc in loaded_jsons):
                errors.append(f"Headline number {headline!r} missing from pricing JSON files")
            if not xlsx_files:
                errors.append(f"Cannot verify headline {headline!r} parity: no generated .xlsx files found")
            elif not any(_xlsx_contains_headline(xp, headline, num_val) for xp in xlsx_files):
                errors.append(f"Headline number {headline!r} missing from generated .xlsx workbooks")

    report: dict[str, Any] = {
        "valid": len(errors) == 0,
        "package_dir": str(package_dir),
        "files_scanned": len(all_files),
        "source_manifest": manifest_summary,
        "markdown_files_checked": len(generated_md_files),
        "reserved_suffix_violations": reserved_violations,
        "workbooks_verified": len(xlsx_reports),
        "adrs_verified": len(adr_files),
        "pngs_verified": png_checked,
        "links_verified": links_checked,
        "headlines_checked": list(headline_numbers),
        "errors": errors,
    }
    if errors:
        raise PackageVerificationError(errors, report=report)
    return report


# ============================================================================
# CLI Interface
# ============================================================================


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="verify_pursuit_package.py",
        description=(
            "Run deterministic end-to-end verification checks on a pursuit package directory "
            "(containment, source-manifest SHA-256, PROJECT-README H2s, reserved APEX suffix guard, "
            "Excel AST/<v> parity, ADR H2s, PNG IHDR resolution, relative links, and headline parity)."
        ),
    )
    parser.add_argument(
        "--package-dir",
        "--project-dir",
        dest="package_dir",
        type=Path,
        required=True,
        help="Path to the pursuit package directory to verify (e.g., agent-output/contoso-rfp).",
    )
    parser.add_argument(
        "--source-manifest",
        type=Path,
        default=None,
        metavar="MANIFEST_JSON",
        help="Optional explicit path to source-manifest.json (auto-detected if present in package).",
    )
    parser.add_argument(
        "--min-png-width",
        type=int,
        default=None,
        metavar="PIXELS",
        help=f"Minimum width in pixels for 03-des-*.png architecture diagrams (default: {DEFAULT_MIN_PNG_WIDTH}).",
    )
    parser.add_argument(
        "--self-contained",
        action="store_true",
        help="Fail on any '../' parent-traversal relative Markdown links.",
    )
    parser.add_argument(
        "--headline-number",
        action="append",
        default=[],
        metavar="HEADLINE_STR",
        help="Verify headline figure parity across README.md, pricing JSON, and .xlsx workbooks (repeatable).",
    )
    parser.add_argument(
        "--pricing-json",
        type=Path,
        default=None,
        metavar="PRICING_JSON",
        help="Optional explicit pricing JSON path for --headline-number parity checks.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON verification report to stdout.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    explicit_min_w = args.min_png_width is not None
    effective_min_w = args.min_png_width if explicit_min_w else DEFAULT_MIN_PNG_WIDTH

    try:
        report = verify_pursuit_package(
            args.package_dir,
            source_manifest=args.source_manifest,
            min_png_width=effective_min_w,
            explicit_min_png_width=explicit_min_w,
            self_contained=args.self_contained,
            headline_numbers=args.headline_number,
            pricing_json=args.pricing_json,
        )
        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True))
        else:
            print(
                f"[OK] Pursuit package verified: {report['files_scanned']} files, "
                f"{report['workbooks_verified']} workbook(s), {report['adrs_verified']} ADR(s), "
                f"{report['pngs_verified']} PNG(s), {report['links_verified']} link(s)."
            )
        return 0
    except PackageVerificationError as exc:
        if args.json:
            print(json.dumps(exc.report, indent=2, sort_keys=True))
        else:
            for err in exc.errors:
                print(f"[FAIL] {err}", file=sys.stderr)
        return 1
    except (ContainmentError, FileNotFoundError, ValueError) as exc:
        if args.json:
            print(
                json.dumps(
                    {"valid": False, "error_type": type(exc).__name__, "errors": [str(exc)]},
                    indent=2,
                    sort_keys=True,
                )
            )
        else:
            print(f"[ERROR] {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
