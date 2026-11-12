#!/usr/bin/env python3
"""Reusable offline validator for standalone WAF assessment diagram deliverables."""

from __future__ import annotations

import argparse
import json
import re
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

FULL_GUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
SECRET_RE = re.compile(
    r"(?i)(?:bearer\s+[A-Za-z0-9._~+/-]+=*|sig=[A-Za-z0-9%/+=]+|password\s*=\s*\S+|accountkey\s*=\s*\S+)"
)


def parse_png_dimensions(raw: bytes) -> tuple[int, int]:
    if len(raw) < 24 or raw[:8] != b"\x89PNG\r\n\x1a\n" or raw[12:16] != b"IHDR":
        raise ValueError("Invalid PNG signature or IHDR chunk")
    width, height = struct.unpack(">II", raw[16:24])
    if width < 600 or height < 300:
        raise ValueError(f"PNG dimensions too small ({width}x{height}; minimum 600x300)")
    return width, height


def validate_svg_file(svg_path: Path) -> None:
    content = svg_path.read_text(encoding="utf-8")
    upper = content.upper()
    if "<!ENTITY" in upper or re.search(r"<!DOCTYPE[^>]*\[", upper):
        raise ValueError(f"XML ENTITY or internal DTD subset forbidden in {svg_path.name}")
    root = ET.fromstring(content)
    if root.tag.rsplit("}", 1)[-1] != "svg":
        raise ValueError(f"{svg_path.name} root element is not <svg>")
    for elem in root.iter():
        local = elem.tag.rsplit("}", 1)[-1]
        if local == "image":
            href = elem.attrib.get("href") or elem.attrib.get("{http://www.w3.org/1999/xlink}href") or ""
            if href and not href.startswith(("data:image/", "#")):
                raise ValueError(f"{svg_path.name} contains unembedded <image> reference: {href[:80]}")
        elif local == "use":
            href = elem.attrib.get("href") or elem.attrib.get("{http://www.w3.org/1999/xlink}href") or ""
            if href and not href.startswith("#"):
                raise ValueError(f"{svg_path.name} contains external <use> reference: {href[:80]}")
        text_chunks = [elem.text or "", elem.tail or ""]
        for chunk in text_chunks:
            if not chunk.strip():
                continue
            if SECRET_RE.search(chunk):
                raise ValueError(f"{svg_path.name} contains secret-like text in SVG")
            if FULL_GUID_RE.search(chunk):
                raise ValueError(f"{svg_path.name} exposes a full 36-char GUID in visible text; use short prefixes")


def validate_assessment_diagrams(project_dir: Path, *, max_diagrams: int = 2) -> dict[str, Any]:
    resolved = project_dir.resolve(strict=True)
    assets = resolved / "assets"
    if not assets.is_dir() or assets.is_symlink():
        raise ValueError("Missing or symlinked assets/ directory")

    required_primary = ("03-des-diagram.py", "03-des-diagram.png", "03-des-diagram.svg")
    for name in required_primary:
        target = assets / name
        if target.is_symlink() or not target.is_file() or target.stat().st_size == 0:
            raise ValueError(f"Missing, empty, or symlinked required diagram file: assets/{name}")

    png_files = sorted(p for p in assets.glob("03-des-*.png") if p.is_file() and not p.is_symlink())
    if len(png_files) > max_diagrams:
        names = ", ".join(p.name for p in png_files)
        raise ValueError(
            f"Found {len(png_files)} 03-des-*.png diagrams ({names}), exceeding bounded limit of {max_diagrams}"
        )

    checked_stems: list[dict[str, Any]] = []
    for png_path in png_files:
        svg_path = png_path.with_suffix(".svg")
        if svg_path.is_symlink() or not svg_path.is_file() or svg_path.stat().st_size == 0:
            raise ValueError(f"Missing paired SVG for {png_path.name}")
        width, height = parse_png_dimensions(png_path.read_bytes())
        validate_svg_file(svg_path)
        checked_stems.append({"stem": png_path.stem, "width": width, "height": height})

    inv_path = resolved / "_meta/live-inventory.json"
    cov_path = assets / "03-des-coverage.json"
    reconciled_resources: int | None = None
    if cov_path.is_file() and not cov_path.is_symlink() and inv_path.is_file() and not inv_path.is_symlink():
        cov_doc = json.loads(cov_path.read_text(encoding="utf-8"))
        inv_doc = json.loads(inv_path.read_text(encoding="utf-8"))
        expected_total = sum(int(inv.get("count", 0)) for inv in inv_doc.get("inventories", []))
        if "total_resources" in cov_doc:
            declared_total = cov_doc.get("total_resources")
            if type(declared_total) is not int:
                raise ValueError("03-des-coverage.json total_resources must be an integer")
            if declared_total != expected_total:
                raise ValueError(
                    f"03-des-coverage.json total_resources ({declared_total}) != live-inventory count ({expected_total})"
                )
            reconciled_resources = expected_total

    return {
        "valid": True,
        "diagram_count": len(checked_stems),
        "diagrams": checked_stems,
        "reconciled_resources": reconciled_resources,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True, help="Path to agent-output/<project>")
    parser.add_argument(
        "--max-diagrams",
        type=int,
        default=2,
        help="Maximum allowed 03-des-*.png diagram renders (default: 2)",
    )
    args = parser.parse_args(argv)
    try:
        result = validate_assessment_diagrams(args.project_dir, max_diagrams=args.max_diagrams)
        print(json.dumps(result))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"valid": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
