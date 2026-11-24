"""Shared filesystem and archive containment guards for apex-rfi-rfp scripts.

Enforces path-boundary resolution, symlink refusal, zip-slip/zip-bomb bounds,
and DTD/entity-free XML parsing without extracting untrusted archives to disk.
"""

from __future__ import annotations

import hashlib
import os
import re
import stat
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree import ElementTree as ET
from xml.parsers import expat

MAX_ARCHIVE_ENTRIES = 2000
MAX_MEMBER_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200.0
RATIO_CHECK_MIN_BYTES = 65536

_DTD_OR_ENTITY_RE = re.compile(rb"<!\s*(?:DOCTYPE|ENTITY)\b", re.IGNORECASE)
_DRIVE_PREFIX_RE = re.compile(r"^[A-Za-z]:")


class ContainmentError(ValueError):
    """Raised when a file path, symlink, archive entry, or XML payload violates safety bounds."""


def sha256_bytes(data: bytes) -> str:
    """Return lowercase hex SHA-256 digest of in-memory bytes."""
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    """Return lowercase hex SHA-256 digest of a regular non-symlink file."""
    if path.is_symlink():
        raise ContainmentError(f"Refusing to hash symlink: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while chunk := fh.read(65536):
            digest.update(chunk)
    return digest.hexdigest()


def _check_no_symlinks_between(target: Path, root: Path) -> None:
    """Ensure `root` is not a symlink and no component inside `root` is a symlink.

    Parent directories *above* `root` (such as `/var` -> `/private/var` on macOS or
    symlinked workspace mounts) may legitimately be symlinks as long as `root` itself
    and every path segment inside `root` are real directories/files.
    """
    raw_root = Path(os.path.abspath(os.fspath(root)))
    if raw_root.is_symlink():
        raise ContainmentError(f"Containment root cannot be a symlink: {root}")
    resolved_root = raw_root.resolve()

    raw_target = Path(os.path.abspath(os.fspath(target)))
    # Map target into resolved_root coordinate space if target used the un-resolved root prefix
    try:
        rel_parts = raw_target.relative_to(raw_root).parts
    except ValueError:
        try:
            rel_parts = raw_target.relative_to(resolved_root).parts
        except ValueError as exc:
            raise ContainmentError(f"Path {target} escapes containment root {root}") from exc

    cursor = resolved_root
    for part in rel_parts:
        cursor = cursor / part
        if cursor.is_symlink():
            raise ContainmentError(f"Refusing symlink component inside containment root: {cursor}")


def ensure_within_root(path: Path, root: Path, *, allow_symlinks: bool = False) -> Path:
    """Resolve `path` and verify it stays strictly within `root`."""
    if not allow_symlinks:
        _check_no_symlinks_between(path, root)
    resolved_root = root.resolve()
    resolved_path = path.resolve()
    if not resolved_path.is_relative_to(resolved_root):
        raise ContainmentError(f"Resolved path {resolved_path} escapes containment root {resolved_root}")
    return resolved_path


def validate_archive_member_name(name: str) -> str:
    """Validate an archive entry path against traversal, absolute, drive, and control hazards."""
    if not name or "\x00" in name:
        raise ContainmentError(f"Invalid empty or NUL-containing archive entry: {name!r}")
    if "\\" in name:
        raise ContainmentError(f"Backslash path separator forbidden in archive entry: {name!r}")
    if name.startswith("/") or _DRIVE_PREFIX_RE.match(name):
        raise ContainmentError(f"Absolute or drive-prefixed archive entry forbidden: {name!r}")

    pure = PurePosixPath(name)
    if any(part in ("..", "") for part in pure.parts if part == ".."):
        raise ContainmentError(f"Parent traversal segment '..' forbidden in archive entry: {name!r}")
    return name


def _is_zipinfo_symlink(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    return stat.S_ISLNK(mode)


def open_validated_zip(
    zip_path: Path,
    *,
    max_entries: int = MAX_ARCHIVE_ENTRIES,
    max_member_bytes: int = MAX_MEMBER_UNCOMPRESSED_BYTES,
    max_total_bytes: int = MAX_TOTAL_UNCOMPRESSED_BYTES,
    max_ratio: float = MAX_COMPRESSION_RATIO,
) -> zipfile.ZipFile:
    """Open a ZIP/OOXML archive after validating entry names, symlinks, counts, and sizes."""
    if zip_path.is_symlink():
        raise ContainmentError(f"Refusing to open symlink archive: {zip_path}")
    if not zip_path.is_file():
        raise FileNotFoundError(f"Archive not found: {zip_path}")

    zf = zipfile.ZipFile(zip_path, mode="r")
    try:
        infos = zf.infolist()
        if len(infos) > max_entries:
            raise ContainmentError(f"Archive {zip_path.name} has {len(infos)} entries (limit {max_entries})")

        total_uncompressed = 0
        for info in infos:
            validate_archive_member_name(info.filename)
            if _is_zipinfo_symlink(info):
                raise ContainmentError(f"Symlink entry forbidden in archive {zip_path.name}: {info.filename}")
            if info.file_size < 0 or info.file_size > max_member_bytes:
                raise ContainmentError(
                    f"Archive member {info.filename} size {info.file_size} exceeds limit {max_member_bytes}"
                )
            total_uncompressed += info.file_size
            if total_uncompressed > max_total_bytes:
                raise ContainmentError(
                    f"Archive {zip_path.name} uncompressed total {total_uncompressed} exceeds limit {max_total_bytes}"
                )
            if info.file_size >= RATIO_CHECK_MIN_BYTES:
                ratio = info.file_size / max(info.compress_size, 1)
                if ratio > max_ratio:
                    raise ContainmentError(
                        f"Archive member {info.filename} compression ratio {ratio:.1f}x exceeds limit {max_ratio}x"
                    )
        return zf
    except Exception:
        zf.close()
        raise


def read_safe_zip_bytes(
    zf: zipfile.ZipFile,
    member: str,
    *,
    max_bytes: int = MAX_MEMBER_UNCOMPRESSED_BYTES,
) -> bytes:
    """Read an archive member in-memory while enforcing actual decompressed byte bounds."""
    validate_archive_member_name(member)
    info = zf.getinfo(member)
    if _is_zipinfo_symlink(info):
        raise ContainmentError(f"Symlink entry forbidden: {member}")
    with zf.open(info, mode="r") as stream:
        data = stream.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ContainmentError(f"Decompressed stream for {member} exceeded limit {max_bytes} bytes")
    return data


def parse_safe_xml_bytes(raw_xml: bytes) -> ET.Element:
    """Parse XML bytes while blocking DOCTYPE and ENTITY declarations across all encodings and offsets."""
    if _DTD_OR_ENTITY_RE.search(raw_xml):
        raise ContainmentError("XML payload rejected: DOCTYPE and ENTITY declarations are forbidden")

    def _forbid_doctype(*_args: Any) -> None:
        raise ContainmentError("XML payload rejected: DOCTYPE declaration is forbidden")

    def _forbid_entity(*_args: Any) -> None:
        raise ContainmentError("XML payload rejected: ENTITY declaration is forbidden")

    scanner = expat.ParserCreate()
    scanner.StartDoctypeDeclHandler = _forbid_doctype
    scanner.EntityDeclHandler = _forbid_entity
    try:
        scanner.Parse(raw_xml, True)
        return ET.fromstring(raw_xml)
    except ContainmentError:
        raise
    except (expat.ExpatError, ET.ParseError) as exc:
        raise ContainmentError(f"Malformed XML payload: {exc}") from exc
