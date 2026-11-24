#!/usr/bin/env python3
"""Safe pursuit archive packager with two-part Purview release gate and optional PPTX scaffold.

Builds single or split ``.zip`` deliverables with strict path/symlink containment,
enforces the two-part Purview & derived-data external release gate (exit code 2),
verifies every built archive via ``open_validated_zip`` + CRC + SHA-256 byte parity,
and optionally generates a 16:9 ``.pptx`` executive walkthrough scaffold (exit code 3
when ``python-pptx`` is absent).
"""

from __future__ import annotations

import argparse
import fnmatch
import importlib
import json
import os
import re
import sys
import zipfile
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import Any

try:
    from ._safe_io import (
        ContainmentError,
        ensure_within_root,
        open_validated_zip,
        read_safe_zip_bytes,
        sha256_bytes,
        sha256_file,
        validate_archive_member_name,
    )
except ImportError:
    _SCRIPT_DIR = str(Path(__file__).resolve().parent)
    if _SCRIPT_DIR not in sys.path:
        sys.path.insert(0, _SCRIPT_DIR)
    from _safe_io import (  # type: ignore[no-redef]
        ContainmentError,
        ensure_within_root,
        open_validated_zip,
        read_safe_zip_bytes,
        sha256_bytes,
        sha256_file,
        validate_archive_member_name,
    )

EXIT_OK = 0
EXIT_ERROR = 1
EXIT_PURVIEW_GATE = 2
EXIT_MISSING_OPTIONAL_PPTX = 3

ALWAYS_EXCLUDED_DIR_NAMES: frozenset[str] = frozenset({"__pycache__", ".pytest_cache"})
ALWAYS_EXCLUDED_FILE_NAMES: frozenset[str] = frozenset({".DS_Store", "Thumbs.db"})
ALWAYS_EXCLUDED_SUFFIXES: tuple[str, ...] = (".zip", ".pyc", ".bak", ".tmp")

DEFAULT_RESTRICTED_PATHS: tuple[str, ...] = (
    "rfi-docs/",
    "emails/",
    "_meta/",
    "source/",
    "source-archive/",
    "*.extracted.md",
)

_ISO_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")

COMMERCIAL_TOP_DIRS: frozenset[str] = frozenset({"pricing", "scripts", "tools"})
COMMERCIAL_SUFFIXES: frozenset[str] = frozenset({".xlsx", ".csv", ".tsv", ".py", ".sh", ".ps1"})

PURVIEW_BANNER_TEXT = (
    "SENSITIVITY & PURVIEW NOTICE: Derived commercial and architectural figures remain "
    "subject to organizational sensitivity classification, customer NDA terms, and explicit "
    "redaction/Purview clearance before external distribution."
)


class PurviewClearanceError(ValueError):
    """Raised when external or restricted-stripped packaging lacks two-part Purview clearance."""

    exit_code = EXIT_PURVIEW_GATE


class OptionalDependencyError(RuntimeError):
    """Raised when an optional runtime dependency such as python-pptx is not installed."""

    exit_code = EXIT_MISSING_OPTIONAL_PPTX


def _normalize_rel_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _matches_restricted_pattern(rel_posix: str, pattern: str) -> bool:
    """Check whether ``rel_posix`` matches a restricted directory prefix, exact path, or glob."""
    clean = pattern.strip().replace("\\", "/")
    if not clean:
        return False
    if clean.endswith("/"):
        dir_prefix = clean.rstrip("/")
        return rel_posix == dir_prefix or rel_posix.startswith(f"{dir_prefix}/")
    if "*" in clean or "?" in clean or "[" in clean:
        if "/" in clean:
            return fnmatch.fnmatchcase(rel_posix, clean)
        filename = PurePosixPath(rel_posix).name
        return fnmatch.fnmatchcase(filename, clean) or fnmatch.fnmatchcase(rel_posix, clean)
    return rel_posix == clean or rel_posix.startswith(f"{clean}/")


def _matches_excluded_dir(rel_dir_posix: str, dir_name: str, extra_excludes: Sequence[str]) -> bool:
    if dir_name in ALWAYS_EXCLUDED_DIR_NAMES:
        return True
    for raw in extra_excludes:
        norm = raw.strip().replace("\\", "/").strip("/")
        if not norm:
            continue
        if dir_name == norm or rel_dir_posix == norm or rel_dir_posix.startswith(f"{norm}/"):
            return True
    return False


def _is_always_excluded_file(rel_posix: str) -> bool:
    name = PurePosixPath(rel_posix).name
    if name in ALWAYS_EXCLUDED_FILE_NAMES:
        return True
    low = name.lower()
    if any(low.endswith(sfx) for sfx in ALWAYS_EXCLUDED_SUFFIXES):
        return True
    parts = PurePosixPath(rel_posix).parts
    return any(part in ALWAYS_EXCLUDED_DIR_NAMES for part in parts[:-1])


def discover_provenance_manifest(
    package_dir: Path,
    explicit_manifest: Path | None = None,
) -> tuple[Path | None, dict[str, Any]]:
    """Load explicit or auto-detected ``source-manifest.json`` if present."""
    if explicit_manifest is not None:
        if explicit_manifest.is_symlink():
            raise ContainmentError(f"Refusing symlink provenance manifest: {explicit_manifest}")
        if not explicit_manifest.is_file():
            raise FileNotFoundError(f"Provenance manifest not found: {explicit_manifest}")
        if explicit_manifest.resolve().is_relative_to(package_dir.resolve()):
            ensure_within_root(explicit_manifest, package_dir)
        data = json.loads(explicit_manifest.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError(f"Provenance manifest must be a JSON object: {explicit_manifest}")
        return explicit_manifest, data

    candidates = (
        package_dir / "pricing" / "source-manifest.json",
        package_dir / "source-manifest.json",
        package_dir / "_meta" / "source-manifest.json",
    )
    for cand in candidates:
        if cand.is_symlink():
            raise ContainmentError(f"Refusing symlink provenance manifest: {cand}")
        if cand.is_file():
            ensure_within_root(cand, package_dir)
            data = json.loads(cand.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                raise ValueError(f"Provenance manifest must be a JSON object: {cand}")
            return cand, data
    return None, {}


def evaluate_purview_release_gate(
    manifest_data: dict[str, Any],
    *,
    external_release: bool = False,
    internal_only: bool = False,
    exclude_restricted_originals: bool = False,
    acknowledge_purview_clearance: str | None = None,
    public_synthetic_only: bool = False,
) -> dict[str, Any]:
    """Enforce the two-part Purview & derived-data external release gate (RD-05).

    Fails closed by default with ``PurviewClearanceError`` (exit code 2) unless
    ``internal_only=True`` (for workspace-local internal builds) or zero Purview/customer
    data applies (``public_synthetic_only=True`` with ``purview_labeled_inputs=False``).
    Whenever the gate is required, BOTH ``exclude_restricted_originals=True`` and a
    non-empty ``acknowledge_purview_clearance`` reference must be supplied.
    """
    if internal_only and external_release:
        raise ValueError("Cannot combine --internal-only with --external-release.")

    nested_cls = manifest_data.get("classification")
    cls_dict = nested_cls if isinstance(nested_cls, dict) else {}

    if "purview_labeled_inputs" in manifest_data and manifest_data["purview_labeled_inputs"] is not None:
        purview_labeled = bool(manifest_data["purview_labeled_inputs"])
    elif "purview_labeled_inputs" in cls_dict and cls_dict["purview_labeled_inputs"] is not None:
        purview_labeled = bool(cls_dict["purview_labeled_inputs"])
    else:
        files_entry = manifest_data.get("files")
        if isinstance(files_entry, list):
            purview_labeled = any(
                isinstance(f, dict) and (bool(f.get("purview_labeled")) or bool(f.get("sensitivity_label")))
                for f in files_entry
            )
        else:
            purview_labeled = False

    if (
        "derived_contains_customer_data" in manifest_data
        and manifest_data["derived_contains_customer_data"] is not None
    ):
        derived_customer_data = bool(manifest_data["derived_contains_customer_data"])
    elif "derived_contains_customer_data" in cls_dict and cls_dict["derived_contains_customer_data"] is not None:
        derived_customer_data = bool(cls_dict["derived_contains_customer_data"])
    else:
        derived_customer_data = not public_synthetic_only

    clearance_ref = (acknowledge_purview_clearance or "").strip()
    gate_required = (not internal_only) and (purview_labeled or derived_customer_data)

    if gate_required:
        missing_parts: list[str] = []
        if not exclude_restricted_originals:
            missing_parts.append("--exclude-restricted-originals")
        if not clearance_ref:
            missing_parts.append('--acknowledge-purview-clearance "<approver-or-redaction-ref>"')
        if missing_parts:
            raise PurviewClearanceError(
                "Purview & derived-data release gate blocked archive build "
                f"(purview_labeled_inputs={purview_labeled}, "
                f"derived_contains_customer_data={derived_customer_data}). "
                "Stripping raw source folders alone does not clear sensitivity labels or customer data "
                "embedded in derived workbooks and narratives. Provide BOTH required controls: "
                + " AND ".join(missing_parts)
                + " (or pass --internal-only for an internal workspace-only archive)."
            )

    return {
        "gate_required": gate_required,
        "external_release": external_release,
        "internal_only": internal_only,
        "public_synthetic_only": public_synthetic_only,
        "purview_labeled_inputs": purview_labeled,
        "derived_contains_customer_data": derived_customer_data,
        "exclude_restricted_originals": exclude_restricted_originals,
        "clearance_reference": clearance_ref or None,
    }


def collect_package_files(
    package_dir: Path,
    *,
    exclude_dirs: Sequence[str] = (),
    exclude_restricted_originals: bool = False,
    restricted_paths: Sequence[str] = (),
) -> tuple[list[tuple[str, Path]], list[str]]:
    """Walk ``package_dir`` safely without following symlinks and collect eligible ``(arcname, path)`` pairs."""
    if package_dir.is_symlink():
        raise ContainmentError(f"Refusing symlink package directory: {package_dir}")
    if not package_dir.is_dir():
        raise FileNotFoundError(f"Package directory not found: {package_dir}")

    effective_restricted = list(DEFAULT_RESTRICTED_PATHS) + list(restricted_paths)
    collected: list[tuple[str, Path]] = []
    excluded_restricted: list[str] = []

    for dirpath_str, dirnames, filenames in os.walk(package_dir, topdown=True, followlinks=False):
        dirpath = Path(dirpath_str)
        ensure_within_root(dirpath, package_dir)

        # First inspect every child directory and file for forbidden symlinks before pruning
        for dname in dirnames:
            dpath = dirpath / dname
            if dpath.is_symlink():
                raise ContainmentError(f"Refusing symlink directory inside package root: {dpath}")
            ensure_within_root(dpath, package_dir)

        for fname in filenames:
            fpath = dirpath / fname
            if fpath.is_symlink():
                raise ContainmentError(f"Refusing symlink file inside package root: {fpath}")
            ensure_within_root(fpath, package_dir)

        # Prune excluded and restricted directories deterministically
        kept_dirs: list[str] = []
        for dname in sorted(dirnames):
            dpath = dirpath / dname
            rel_dir = _normalize_rel_posix(dpath, package_dir)
            if _matches_excluded_dir(rel_dir, dname, exclude_dirs):
                continue
            if exclude_restricted_originals and any(
                _matches_restricted_pattern(rel_dir, pat) for pat in effective_restricted
            ):
                excluded_restricted.append(f"{rel_dir}/")
                continue
            kept_dirs.append(dname)
        dirnames[:] = kept_dirs

        for fname in sorted(filenames):
            fpath = dirpath / fname
            rel_posix = _normalize_rel_posix(fpath, package_dir)
            validate_archive_member_name(rel_posix)
            if _is_always_excluded_file(rel_posix):
                continue
            if any(
                _matches_excluded_dir(
                    "/".join(PurePosixPath(rel_posix).parts[: idx + 1]),
                    part,
                    exclude_dirs,
                )
                for idx, part in enumerate(PurePosixPath(rel_posix).parts[:-1])
            ):
                continue
            if exclude_restricted_originals and any(
                _matches_restricted_pattern(rel_posix, pat) for pat in effective_restricted
            ):
                excluded_restricted.append(rel_posix)
                continue
            collected.append((rel_posix, fpath))

    collected.sort(key=lambda item: item[0])
    return collected, sorted(excluded_restricted)


def _is_commercial_or_tooling_member(rel_posix: str) -> bool:
    parts = PurePosixPath(rel_posix).parts
    if parts and parts[0] in COMMERCIAL_TOP_DIRS:
        return True
    suffix = PurePosixPath(rel_posix).suffix.lower()
    if suffix in COMMERCIAL_SUFFIXES:
        return True
    low_name = PurePosixPath(rel_posix).name.lower()
    return suffix == ".json" and any(
        tok in low_name for tok in ("price", "pricing", "cost", "bom", "sku", "rate", "manifest")
    )


def _write_and_verify_zip(
    zip_path: Path,
    members: Sequence[tuple[str, Path]],
    *,
    exclude_restricted_originals: bool,
    restricted_patterns: Sequence[str],
) -> dict[str, Any]:
    """Write ``zip_path`` atomically and verify containment, CRC, exclusions, and SHA-256 byte parity."""
    if zip_path.exists() and zip_path.is_symlink():
        raise ContainmentError(f"Refusing to overwrite symlink archive: {zip_path}")
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    if zip_path.parent.is_symlink():
        raise ContainmentError(f"Refusing symlink output directory: {zip_path.parent}")

    expected_hashes: dict[str, str] = {}
    tmp_zip = zip_path.parent / f".{zip_path.name}.pkg.tmp"
    try:
        with zipfile.ZipFile(tmp_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for arcname, disk_path in members:
                validate_archive_member_name(arcname)
                if disk_path.is_symlink():
                    raise ContainmentError(f"Refusing symlink member during archive write: {disk_path}")
                expected_hashes[arcname] = sha256_file(disk_path)
                zf.write(disk_path, arcname=arcname)
        os.replace(tmp_zip, zip_path)
    finally:
        if tmp_zip.exists():
            tmp_zip.unlink(missing_ok=True)

    # Full post-build verification on the finalized archive
    with open_validated_zip(zip_path) as zverify:
        bad_crc = zverify.testzip()
        if bad_crc is not None:
            raise ContainmentError(f"Archive CRC verification failed on member {bad_crc!r} in {zip_path.name}")

        archived_names = [info.filename for info in zverify.infolist()]
        if set(archived_names) != set(expected_hashes):
            raise ContainmentError(
                f"Archive member inventory mismatch in {zip_path.name}: "
                f"expected {len(expected_hashes)}, got {len(archived_names)}"
            )

        for name in archived_names:
            if name.lower().endswith(".zip"):
                raise ContainmentError(f"Forbidden nested .zip entry {name!r} inside {zip_path.name}")
            if exclude_restricted_originals:
                if name == "_meta" or name.startswith("_meta/"):
                    raise ContainmentError(f"Restricted _meta/ entry {name!r} leaked into {zip_path.name}")
                if any(_matches_restricted_pattern(name, pat) for pat in restricted_patterns):
                    raise ContainmentError(f"Restricted entry {name!r} leaked into {zip_path.name}")

            payload = read_safe_zip_bytes(zverify, name)
            actual_sha = sha256_bytes(payload)
            if actual_sha != expected_hashes[name]:
                raise ContainmentError(
                    f"SHA-256 byte parity mismatch for {name!r} in {zip_path.name}: "
                    f"disk={expected_hashes[name]}, archive={actual_sha}"
                )

    return {
        "archive_path": str(zip_path),
        "archive_sha256": sha256_file(zip_path),
        "size_bytes": zip_path.stat().st_size,
        "member_count": len(expected_hashes),
        "members": sorted(expected_hashes.keys()),
    }


def derive_manifest_restricted_paths(
    package_dir: Path,
    manifest_path: Path | None,
    manifest_data: dict[str, Any],
) -> list[str]:
    """Derive and validate restricted original paths from ``source-manifest.json``.

    Blocks external/restricted-stripped packaging fail-closed if manifest-declared
    source locations are malformed, traverse outside ``package_dir``, or cannot be
    resolved safely to concrete package-relative paths.
    """
    if manifest_path is None and not manifest_data:
        return []

    derived: list[str] = []
    norm_src_rel: str | None = None

    raw_source_dir = manifest_data.get("source_dir")
    if raw_source_dir is not None:
        if not isinstance(raw_source_dir, str):
            raise PurviewClearanceError(
                "Cannot safely resolve restricted original paths: provenance manifest 'source_dir' must be a string."
            )
        stripped_src = raw_source_dir.strip()
        if "\\" in stripped_src:
            raise ContainmentError(f"Backslash path separator forbidden in manifest source_dir: {raw_source_dir!r}")
        clean_src = stripped_src.strip("/")
        if clean_src and clean_src != ".":
            validate_archive_member_name(clean_src)
            resolved_src_dir = ensure_within_root(package_dir / clean_src, package_dir)
            norm_src_rel = _normalize_rel_posix(resolved_src_dir, package_dir)
            derived.append(f"{norm_src_rel}/")

    has_entries_key = "files" in manifest_data or "sources" in manifest_data
    raw_entries = manifest_data.get("files") if "files" in manifest_data else manifest_data.get("sources")

    if not has_entries_key or raw_entries is None:
        if norm_src_rel is None:
            raise PurviewClearanceError(
                "Cannot safely resolve restricted original paths from provenance manifest: "
                "missing resolvable 'source_dir' and 'files' entries."
            )
        return sorted(set(derived))

    entry_rel_paths: list[str] = []
    if isinstance(raw_entries, list):
        for idx, item in enumerate(raw_entries):
            if not isinstance(item, dict):
                raise PurviewClearanceError(
                    f"Cannot safely resolve restricted original paths: manifest entry #{idx} is not an object."
                )
            rel_val = item.get("path") or item.get("relative_path") or item.get("file")
            if not isinstance(rel_val, str) or not rel_val.strip():
                raise PurviewClearanceError(
                    f"Cannot safely resolve restricted original paths: manifest entry #{idx} lacks a valid path."
                )
            entry_rel_paths.append(rel_val.strip())
    elif isinstance(raw_entries, dict):
        for rel_val in raw_entries:
            if not isinstance(rel_val, str) or not rel_val.strip():
                raise PurviewClearanceError(
                    "Cannot safely resolve restricted original paths: manifest mapping contains an empty key."
                )
            entry_rel_paths.append(rel_val.strip())
    else:
        raise PurviewClearanceError(
            "Cannot safely resolve restricted original paths: manifest 'files' must be a list or object."
        )

    if "file_count" in manifest_data and manifest_data["file_count"] is not None:
        try:
            declared_count = int(manifest_data["file_count"])
        except (TypeError, ValueError) as exc:
            raise PurviewClearanceError("Provenance manifest 'file_count' must be an integer.") from exc
        if declared_count != len(entry_rel_paths):
            raise PurviewClearanceError(
                f"Provenance manifest file_count ({declared_count}) mismatches {len(entry_rel_paths)} listed entries; "
                "refusing release because restricted original inventory is inconsistent."
            )

    manifest_in_subdir = (
        manifest_path is not None
        and manifest_path.resolve().is_relative_to(package_dir.resolve())
        and manifest_path.resolve().parent != package_dir.resolve()
    )

    for rel_entry in entry_rel_paths:
        validate_archive_member_name(rel_entry)
        if norm_src_rel is not None:
            cand = ensure_within_root(package_dir / norm_src_rel / rel_entry, package_dir)
            derived.append(_normalize_rel_posix(cand, package_dir))
        else:
            cand_pkg = ensure_within_root(package_dir / rel_entry, package_dir)
            cand_m: Path | None = None
            if manifest_in_subdir and manifest_path is not None:
                cand_m = ensure_within_root(manifest_path.parent / rel_entry, package_dir)

            if cand_pkg.is_file():
                derived.append(_normalize_rel_posix(cand_pkg, package_dir))
            elif cand_m is not None and cand_m.is_file():
                derived.append(_normalize_rel_posix(cand_m, package_dir))
            else:
                raise PurviewClearanceError(
                    f"Cannot safely resolve restricted original path {rel_entry!r} inside package directory "
                    "without a valid manifest 'source_dir'; refusing to build archive."
                )

    return sorted(set(derived))


def build_pursuit_archives(
    package_dir: Path,
    *,
    output_dir: Path | None = None,
    prefix: str | None = None,
    mode: str = "single",
    exclude_dirs: Sequence[str] = (),
    provenance_manifest: Path | None = None,
    external_release: bool = False,
    internal_only: bool = False,
    public_synthetic_only: bool = False,
    exclude_restricted_originals: bool = False,
    restricted_paths: Sequence[str] = (),
    acknowledge_purview_clearance: str | None = None,
) -> dict[str, Any]:
    """Build and verify single or split pursuit ``.zip`` deliverables."""
    if mode not in ("single", "split"):
        raise ValueError(f"Unsupported packaging mode {mode!r}; expected 'single' or 'split'")
    if internal_only and external_release:
        raise ValueError("Cannot combine --internal-only with --external-release.")

    if package_dir.is_symlink():
        raise ContainmentError(f"Refusing symlink package directory: {package_dir}")
    if not package_dir.is_dir():
        raise FileNotFoundError(f"Package directory does not exist: {package_dir}")

    manifest_path, manifest_data = discover_provenance_manifest(package_dir, provenance_manifest)
    gate_status = evaluate_purview_release_gate(
        manifest_data,
        external_release=external_release,
        internal_only=internal_only,
        exclude_restricted_originals=exclude_restricted_originals,
        acknowledge_purview_clearance=acknowledge_purview_clearance,
        public_synthetic_only=public_synthetic_only,
    )

    manifest_restricted = (
        derive_manifest_restricted_paths(package_dir, manifest_path, manifest_data)
        if exclude_restricted_originals
        else []
    )
    combined_restricted = list(restricted_paths) + manifest_restricted
    effective_restricted = list(DEFAULT_RESTRICTED_PATHS) + combined_restricted
    members, stripped_paths = collect_package_files(
        package_dir,
        exclude_dirs=exclude_dirs,
        exclude_restricted_originals=exclude_restricted_originals,
        restricted_paths=combined_restricted,
    )

    dest_dir = output_dir if output_dir is not None else package_dir
    if dest_dir.exists() and dest_dir.is_symlink():
        raise ContainmentError(f"Refusing symlink output directory: {dest_dir}")
    pkg_prefix = (prefix or package_dir.resolve().name).strip()
    if not pkg_prefix or "/" in pkg_prefix or "\\" in pkg_prefix or ".." in pkg_prefix:
        raise ContainmentError(f"Invalid archive prefix: {pkg_prefix!r}")

    built_archives: list[dict[str, Any]] = []
    if mode == "single":
        single_zip = dest_dir / f"{pkg_prefix}.package.zip"
        built_archives.append(
            _write_and_verify_zip(
                single_zip,
                members,
                exclude_restricted_originals=exclude_restricted_originals,
                restricted_patterns=effective_restricted,
            )
        )
    else:
        docs_members = [(arc, p) for arc, p in members if not _is_commercial_or_tooling_member(arc)]
        comm_members = [(arc, p) for arc, p in members if _is_commercial_or_tooling_member(arc)]

        docs_zip = dest_dir / f"{pkg_prefix}.docs-and-assets.zip"
        comm_zip = dest_dir / f"{pkg_prefix}.commercials-and-tooling.zip"
        built_archives.append(
            _write_and_verify_zip(
                docs_zip,
                docs_members,
                exclude_restricted_originals=exclude_restricted_originals,
                restricted_patterns=effective_restricted,
            )
        )
        built_archives.append(
            _write_and_verify_zip(
                comm_zip,
                comm_members,
                exclude_restricted_originals=exclude_restricted_originals,
                restricted_patterns=effective_restricted,
            )
        )

    return {
        "mode": mode,
        "prefix": pkg_prefix,
        "package_dir": str(package_dir),
        "provenance_manifest": str(manifest_path) if manifest_path else None,
        "purview_gate": gate_status,
        "restricted_paths_excluded": stripped_paths,
        "archives": built_archives,
    }


# ============================================================================
# Optional 16:9 .pptx Executive Walkthrough Scaffold
# ============================================================================


def _load_optional_pptx() -> tuple[Any, Any, Any]:
    """Dynamically import ``python-pptx`` or raise ``OptionalDependencyError`` (exit code 3)."""
    try:
        pptx_mod = importlib.import_module("pptx")
        pptx_util = importlib.import_module("pptx.util")
        pptx_dml = importlib.import_module("pptx.dml.color")
        return pptx_mod, pptx_util, pptx_dml
    except ImportError as exc:
        raise OptionalDependencyError("python-pptx is optional and not installed in this environment") from exc


def _resolve_currency_code(pricing_data: dict[str, Any]) -> str:
    """Resolve an uppercase ISO-4217 3-letter currency code from summary metadata."""
    for key in ("currencyCode", "currency", "currency_code"):
        raw = pricing_data.get(key)
        if isinstance(raw, str):
            candidate = raw.strip().upper()
            if _ISO_CURRENCY_RE.match(candidate):
                return str(candidate)
    return "USD"


def _extract_pricing_headlines(pricing_data: dict[str, Any]) -> list[tuple[str, str]]:
    """Extract clean human-readable headline rows from flexible pricing summary JSON schemas."""
    currency = _resolve_currency_code(pricing_data)
    region = str(
        pricing_data.get("primaryRegion")
        or pricing_data.get("region")
        or pricing_data.get("armRegionName")
        or "swedencentral"
    )

    rows: list[tuple[str, str]] = [
        ("Primary Target Region", region),
        ("Pricing Currency", currency),
    ]

    raw_summary = pricing_data.get("summary")
    summary_block: dict[str, Any] = raw_summary if isinstance(raw_summary, dict) else {}
    candidates: list[tuple[str, Any]] = [
        (
            "Estimated Monthly Run-Rate",
            pricing_data.get("totalMonthly")
            or pricing_data.get("monthlyTotal")
            or pricing_data.get("monthly_total")
            or pricing_data.get("monthly_usd")
            or summary_block.get("totalMonthly")
            or summary_block.get("monthly_total"),
        ),
        (
            "Estimated Annual Total (12-Month)",
            pricing_data.get("totalAnnual")
            or pricing_data.get("annualTotal")
            or pricing_data.get("annual_total")
            or pricing_data.get("annual_usd")
            or summary_block.get("totalAnnual")
            or summary_block.get("annual_total"),
        ),
        (
            "Multi-Year / Term Total",
            pricing_data.get("termTotal")
            or pricing_data.get("fiveYearTotal")
            or pricing_data.get("multi_year_total")
            or summary_block.get("termTotal"),
        ),
    ]

    for label, val in candidates:
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            rows.append((label, f"{currency} {float(val):,.2f}"))
        elif isinstance(val, str) and val.strip():
            rows.append((label, val.strip()))

    meters = pricing_data.get("meters") or pricing_data.get("items") or pricing_data.get("services")
    if isinstance(meters, (list, dict)):
        rows.append(("Verified Line Items / Meters", str(len(meters))))

    # Surface any additional top-level numeric KPIs if standard keys were absent
    if len(rows) <= 2:
        for k, v in pricing_data.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                rows.append((k, f"{currency} {float(v):,.2f}"))
            if len(rows) >= 7:
                break

    return rows


def scaffold_walkthrough_pptx(
    output_pptx: Path,
    pricing_json: Path | None = None,
) -> dict[str, Any]:
    """Generate a starter 16:9 ``.pptx`` walkthrough bound to ``pricing_json`` totals + Purview banner."""
    pptx_mod, pptx_util, pptx_dml = _load_optional_pptx()
    if output_pptx.exists() and output_pptx.is_symlink():
        raise ContainmentError(f"Refusing to overwrite symlink PPTX path: {output_pptx}")
    if pricing_json is not None:
        if pricing_json.is_symlink():
            raise ContainmentError(f"Refusing symlink pricing JSON: {pricing_json}")
        if not pricing_json.is_file():
            raise FileNotFoundError(f"Pricing JSON not found: {pricing_json}")
        pricing_data = json.loads(pricing_json.read_text(encoding="utf-8"))
        if not isinstance(pricing_data, dict):
            raise ValueError(f"Pricing summary JSON must be an object: {pricing_json}")
    else:
        pricing_data = {}

    headlines = _extract_pricing_headlines(pricing_data)
    prs = pptx_mod.Presentation()
    inches = pptx_util.Inches
    pt = pptx_util.Pt
    rgb = pptx_dml.RGBColor

    # Configure widescreen 16:9 slide geometry (13.333 in x 7.5 in)
    prs.slide_width = inches(13.333)
    prs.slide_height = inches(7.5)
    blank_layout = prs.slide_layouts[6]

    def add_banner_and_header(slide: Any, title_text: str, subtitle_text: str) -> None:
        title_box = slide.shapes.add_textbox(inches(0.6), inches(0.4), inches(12.1), inches(1.0))
        tf = title_box.text_frame
        tf.word_wrap = True
        p0 = tf.paragraphs[0]
        p0.text = title_text
        p0.font.size = pt(28)
        p0.font.bold = True
        p0.font.color.rgb = rgb(0x0F, 0x3D, 0x6E)

        p1 = tf.add_paragraph()
        p1.text = subtitle_text
        p1.font.size = pt(14)
        p1.font.color.rgb = rgb(0x4A, 0x55, 0x68)

        banner_box = slide.shapes.add_textbox(inches(0.6), inches(6.65), inches(12.1), inches(0.6))
        btf = banner_box.text_frame
        btf.word_wrap = True
        bp = btf.paragraphs[0]
        bp.text = PURVIEW_BANNER_TEXT
        bp.font.size = pt(10)
        bp.font.bold = True
        bp.font.color.rgb = rgb(0x9B, 0x2C, 0x2C)

    # Slide 1: Cover & Governance Scope
    s1 = prs.slides.add_slide(blank_layout)
    deck_title = str(pricing_data.get("title") or "Azure Pursuit Commercial & Architecture Walkthrough")
    add_banner_and_header(
        s1,
        deck_title,
        "Starter 16:9 executive walkthrough bound to verified Azure Retail Prices JSON evidence",
    )
    scope_box = s1.shapes.add_textbox(inches(0.6), inches(1.9), inches(12.1), inches(4.2))
    stf = scope_box.text_frame
    stf.word_wrap = True
    for idx, (k, v) in enumerate(headlines[:5]):
        para = stf.paragraphs[0] if idx == 0 else stf.add_paragraph()
        para.text = f"• {k}: {v}"
        para.font.size = pt(18)

    # Slide 2: Headline Commercial Summary Table
    s2 = prs.slides.add_slide(blank_layout)
    add_banner_and_header(
        s2,
        "Commercial Headline Summary",
        f"Source: {pricing_json.name if pricing_json else 'In-memory defaults'}",
    )
    nrows = len(headlines) + 1
    table_shape = s2.shapes.add_table(nrows, 2, inches(0.6), inches(1.7), inches(12.1), inches(0.5 * nrows))
    tbl = table_shape.table
    tbl.cell(0, 0).text = "Metric / Dimension"
    tbl.cell(0, 1).text = "Verified Value"
    for r_idx, (metric, val_str) in enumerate(headlines, start=1):
        tbl.cell(r_idx, 0).text = metric
        tbl.cell(r_idx, 1).text = val_str

    # Slide 3: Architecture Decisions & Delivery Assumptions
    s3 = prs.slides.add_slide(blank_layout)
    add_banner_and_header(
        s3,
        "Architecture Baseline, Exclusions & Sign-Off Gates",
        "Populate pursuit-specific diagrams from assets/03-des-*.png before stakeholder review",
    )
    notes_box = s3.shapes.add_textbox(inches(0.6), inches(1.9), inches(12.1), inches(4.2))
    ntf = notes_box.text_frame
    ntf.word_wrap = True
    bullets = (
        "• Single-region primary footprint unless multi-region DR is explicitly mandated by customer requirements.",
        "• PaaS private endpoints, Managed Identity, TLS 1.2+, and zone-redundant services where regionally supported.",
        "• Verify partner-quoted labor, FX hedging, and Microsoft Purview sensitivity clearance prior to submission.",
    )
    for idx, line in enumerate(bullets):
        para = ntf.paragraphs[0] if idx == 0 else ntf.add_paragraph()
        para.text = line
        para.font.size = pt(16)

    output_pptx.parent.mkdir(parents=True, exist_ok=True)
    tmp_pptx = output_pptx.parent / f".{output_pptx.name}.tmp"
    try:
        prs.save(str(tmp_pptx))
        os.replace(tmp_pptx, output_pptx)
    finally:
        if tmp_pptx.exists():
            tmp_pptx.unlink(missing_ok=True)

    with open_validated_zip(output_pptx) as zf:
        bad = zf.testzip()
        if bad is not None:
            raise ContainmentError(f"Corrupt PPTX archive entry: {bad}")

    return {
        "pptx_path": str(output_pptx),
        "slide_count": len(prs.slides),
        "aspect_ratio": "16:9",
        "headlines_bound": dict(headlines),
        "sha256": sha256_file(output_pptx),
    }


# ============================================================================
# CLI Interface
# ============================================================================


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="package_pursuit.py",
        description=(
            "Build single or split pursuit .zip deliverables with containment checks, "
            "two-part Purview/derived-data external release gating (exit code 2), and optional "
            "16:9 python-pptx executive walkthrough scaffolding (exit code 3 if absent)."
        ),
    )
    parser.add_argument(
        "--package-dir",
        "--project-dir",
        dest="package_dir",
        type=Path,
        default=None,
        help="Pursuit package root directory to archive (e.g., agent-output/contoso-rfp).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Destination directory for generated .zip archives (defaults to --package-dir).",
    )
    parser.add_argument(
        "--prefix",
        type=str,
        default=None,
        help="Filename prefix for built archives (defaults to --package-dir directory name).",
    )
    parser.add_argument(
        "--mode",
        choices=("single", "split"),
        default="single",
        help="Archive layout: 'single' ({prefix}.package.zip) or 'split' (docs-and-assets + commercials-and-tooling).",
    )
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=[],
        metavar="REL_DIR",
        help="Additional directory name or relative path to exclude (repeatable).",
    )
    parser.add_argument(
        "--provenance-manifest",
        type=Path,
        default=None,
        metavar="MANIFEST_JSON",
        help="Explicit source-manifest.json path (auto-detects pricing/source-manifest.json or source-manifest.json).",
    )
    parser.add_argument(
        "--external-release",
        action="store_true",
        help="Mark archive build for external customer/partner release (activates two-part Purview gate).",
    )
    parser.add_argument(
        "--internal-only",
        action="store_true",
        help="Build an internal workspace-only archive without external Purview release clearance.",
    )
    parser.add_argument(
        "--public-synthetic-only",
        action="store_true",
        help="Declare that inputs and derived artifacts use 100%% synthetic/public data with zero customer inputs.",
    )
    parser.add_argument(
        "--exclude-restricted-originals",
        action="store_true",
        help="Exclude raw restricted folders/files (rfi-docs/, emails/, _meta/, source/, *.extracted.md, etc.).",
    )
    parser.add_argument(
        "--restricted-path",
        action="append",
        default=[],
        metavar="REL_PATH",
        help="Additional relative path or glob pattern treated as restricted original content (repeatable).",
    )
    parser.add_argument(
        "--acknowledge-purview-clearance",
        type=str,
        default=None,
        metavar="APPROVER_OR_REF",
        help="Required clearance/redaction reference confirming derived outputs are cleared for release.",
    )
    parser.add_argument(
        "--scaffold-pptx",
        type=Path,
        default=None,
        metavar="OUT_PPTX",
        help="Generate an optional 16:9 starter walkthrough .pptx bound to --pricing-json totals.",
    )
    parser.add_argument(
        "--pricing-json",
        type=Path,
        default=None,
        metavar="SUMMARY_JSON",
        help="Pricing summary JSON used to populate --scaffold-pptx headline totals.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON output to stdout.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.package_dir is None and args.scaffold_pptx is None:
        parser.error("At least one of --package-dir or --scaffold-pptx is required.")

    result: dict[str, Any] = {}
    try:
        if args.internal_only and args.external_release:
            raise ValueError("Cannot combine --internal-only with --external-release.")

        if args.package_dir is not None and args.scaffold_pptx is not None:
            if args.package_dir.is_symlink():
                raise ContainmentError(f"Refusing symlink package directory: {args.package_dir}")
            if not args.package_dir.is_dir():
                raise FileNotFoundError(f"Package directory does not exist: {args.package_dir}")
            pre_manifest_path, pre_manifest_data = discover_provenance_manifest(
                args.package_dir,
                args.provenance_manifest,
            )
            evaluate_purview_release_gate(
                pre_manifest_data,
                external_release=args.external_release,
                internal_only=args.internal_only,
                exclude_restricted_originals=args.exclude_restricted_originals,
                acknowledge_purview_clearance=args.acknowledge_purview_clearance,
                public_synthetic_only=args.public_synthetic_only,
            )
            if args.exclude_restricted_originals:
                derive_manifest_restricted_paths(args.package_dir, pre_manifest_path, pre_manifest_data)
            if args.scaffold_pptx.resolve().is_relative_to(args.package_dir.resolve()):
                ensure_within_root(args.scaffold_pptx, args.package_dir)

        if args.scaffold_pptx is not None:
            pptx_report = scaffold_walkthrough_pptx(args.scaffold_pptx, args.pricing_json)
            result["pptx_scaffold"] = pptx_report

        if args.package_dir is not None:
            pkg_report = build_pursuit_archives(
                args.package_dir,
                output_dir=args.output_dir,
                prefix=args.prefix,
                mode=args.mode,
                exclude_dirs=args.exclude_dir,
                provenance_manifest=args.provenance_manifest,
                external_release=args.external_release,
                internal_only=args.internal_only,
                public_synthetic_only=args.public_synthetic_only,
                exclude_restricted_originals=args.exclude_restricted_originals,
                restricted_paths=args.restricted_path,
                acknowledge_purview_clearance=args.acknowledge_purview_clearance,
            )
            result.update(pkg_report)

        if args.json:
            print(json.dumps(result, indent=2, sort_keys=True))
        else:
            for arch in result.get("archives", []):
                print(f"[OK] Built verified archive: {arch['archive_path']} ({arch['member_count']} files)")
            if "pptx_scaffold" in result:
                p_info = result["pptx_scaffold"]
                print(f"[OK] Generated 16:9 walkthrough PPTX: {p_info['pptx_path']} ({p_info['slide_count']} slides)")
        return EXIT_OK

    except PurviewClearanceError as exc:
        if args.json:
            print(json.dumps({"status": "blocked", "exit_code": EXIT_PURVIEW_GATE, "message": str(exc)}, indent=2))
        else:
            print(f"[PURVIEW GATE BLOCKED] {exc}", file=sys.stderr)
        return EXIT_PURVIEW_GATE

    except OptionalDependencyError as exc:
        if args.json:
            print(
                json.dumps(
                    {
                        "status": "missing_optional_dependency",
                        "exit_code": EXIT_MISSING_OPTIONAL_PPTX,
                        "message": str(exc),
                    },
                    indent=2,
                )
            )
        else:
            print(f"[OPTIONAL DEPENDENCY] {exc}", file=sys.stderr)
        return EXIT_MISSING_OPTIONAL_PPTX

    except (ContainmentError, FileNotFoundError, ValueError) as exc:
        if args.json:
            print(json.dumps({"status": "error", "error_type": type(exc).__name__, "message": str(exc)}, indent=2))
        else:
            print(f"[ERROR] {type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
