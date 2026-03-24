#!/usr/bin/env python3
"""Build draw.io icon libraries from Microsoft's official Azure Architecture Icons.

Downloads the Azure Public Service Icons ZIP from Microsoft's CDN, extracts SVGs,
and converts them into draw.io mxlibrary XML format — the same format used by
https://github.com/dwarfered/azure-architecture-icons-for-drawio.

This script eliminates the dependency on third-party icon repositories by building
directly from Microsoft's official source.

Usage:
    python scripts/drawio/build-drawio-icons.py
    python scripts/drawio/build-drawio-icons.py --output assets/drawio-libraries
    python scripts/drawio/build-drawio-icons.py --icons-url https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V23.zip

Output:
    assets/drawio-libraries/azure-public-service-icons/
        001 ai + machine learning.xml
        002 analytics.xml
        ...
        000 all azure public service icons.xml
"""

import argparse
import base64
import io
import json
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

# Microsoft's official Azure Architecture Icons download URL
# Updated periodically — check https://learn.microsoft.com/en-us/azure/architecture/icons/
DEFAULT_ICONS_URL = "https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V22.zip"
DEFAULT_OUTPUT_DIR = "assets/drawio-libraries/azure-public-service-icons"

GEOMETRY_WIDTH = 48
GEOMETRY_HEIGHT = 48


def download_icons_zip(url: str, dest: Path) -> Path:
    """Download the Azure icons ZIP from Microsoft CDN."""
    zip_path = dest / "azure-icons.zip"
    print(f"📥 Downloading Azure icons from {url}")
    urllib.request.urlretrieve(url, zip_path)  # noqa: S310 — trusted Microsoft CDN URL
    print(f"   Downloaded to {zip_path}")
    return zip_path


def extract_zip(zip_path: Path, dest: Path) -> Path:
    """Extract ZIP and return the root icons directory."""
    print(f"📦 Extracting {zip_path.name}")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest)

    # Find the Icons subdirectory — Microsoft ZIPs have varying structures
    for candidate in dest.rglob("Icons"):
        if candidate.is_dir():
            return candidate

    # Fallback: look for any directory containing SVGs
    for candidate in dest.iterdir():
        if candidate.is_dir():
            svgs = list(candidate.rglob("*.svg"))
            if svgs:
                return candidate

    print("❌ Could not find Icons directory in ZIP", file=sys.stderr)
    sys.exit(1)


def svg_to_mxlibrary_entry(svg_path: Path) -> dict | None:
    """Convert a single SVG file to a draw.io mxlibrary JSON entry."""
    svg_content = svg_path.read_bytes()
    if not svg_content:
        return None

    b64 = base64.b64encode(svg_content).decode("ascii")
    image_data = f"data:image/svg+xml,{b64}"

    # Build the mxGraphModel XML for this icon
    xml = (
        "<mxGraphModel>"
        "<root>"
        '<mxCell id="0"/>'
        '<mxCell id="1" parent="0"/>'
        f'<mxCell id="2" value="" '
        f'style="shape=image;verticalLabelPosition=bottom;verticalAlign=top;'
        f'imageAspect=0;aspect=fixed;image={image_data}" '
        f'vertex="1" parent="1">'
        f'<mxGeometry width="{GEOMETRY_WIDTH}" height="{GEOMETRY_HEIGHT}" as="geometry"/>'
        "</mxCell>"
        "</root>"
        "</mxGraphModel>"
    )

    # Escape for embedding in mxlibrary JSON
    escaped_xml = xml.replace("<", "&lt;").replace(">", "&gt;")

    title = svg_path.stem
    return {
        "xml": escaped_xml,
        "w": GEOMETRY_WIDTH,
        "h": GEOMETRY_HEIGHT,
        "title": title,
    }


def build_library(icon_dir: Path, output_file: Path) -> list[dict]:
    """Convert all SVGs in a directory to a single mxlibrary XML file."""
    entries = []
    svg_files = sorted(icon_dir.glob("*.svg"))

    for svg_path in svg_files:
        entry = svg_to_mxlibrary_entry(svg_path)
        if entry:
            entries.append(entry)

    if not entries:
        return []

    # Build mxlibrary format: <mxlibrary>[{json}, {json}, ...]</mxlibrary>
    json_entries = [json.dumps(e, separators=(",", ":")) for e in entries]
    content = "<mxlibrary>[\n  " + ",\n  ".join(json_entries) + "\n]</mxlibrary>"

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(content, encoding="utf-8")

    return entries


def build_all_libraries(icons_root: Path, output_dir: Path) -> None:
    """Build per-category and combined mxlibrary files."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get all category subdirectories
    subdirs = sorted(
        [d for d in icons_root.iterdir() if d.is_dir()],
        key=lambda d: d.name.lower(),
    )

    if not subdirs:
        print("❌ No icon category directories found", file=sys.stderr)
        sys.exit(1)

    combined_entries: list[dict] = []
    folder_number = 1
    category_count = 0

    for subdir in subdirs:
        svg_count = len(list(subdir.glob("*.svg")))
        if svg_count == 0:
            continue

        prefix = f"{folder_number:03d}"
        category_name = subdir.name.lower().replace("_", " ").replace("-", " ")

        # Clean up common prefix patterns from Microsoft's naming
        for remove_prefix in ["azure ", "microsoft "]:
            if category_name.startswith(remove_prefix):
                category_name = category_name[len(remove_prefix) :]

        output_file = output_dir / f"{prefix} {category_name}.xml"
        entries = build_library(subdir, output_file)

        if entries:
            print(f"   ✅ {prefix} {category_name}: {len(entries)} icons")
            combined_entries.extend(entries)
            category_count += 1
            folder_number += 1

    # Build combined library
    if combined_entries:
        json_entries = [json.dumps(e, separators=(",", ":")) for e in combined_entries]
        combined_content = "<mxlibrary>[\n  " + ",\n  ".join(json_entries) + "\n]</mxlibrary>"
        combined_file = output_dir / "000 all azure public service icons.xml"
        combined_file.write_text(combined_content, encoding="utf-8")
        print(f"\n   📚 Combined library: {len(combined_entries)} icons across {category_count} categories")

    # Write manifest for tooling
    manifest = {
        "source": "Microsoft Azure Architecture Icons",
        "source_url": "https://learn.microsoft.com/en-us/azure/architecture/icons/",
        "categories": category_count,
        "total_icons": len(combined_entries),
        "format": "draw.io mxlibrary XML",
        "geometry": {"width": GEOMETRY_WIDTH, "height": GEOMETRY_HEIGHT},
    }
    manifest_file = output_dir / "manifest.json"
    manifest_file.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"   📋 Manifest written to {manifest_file}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build draw.io icon libraries from Microsoft's Azure Architecture Icons"
    )
    parser.add_argument(
        "--icons-url",
        default=DEFAULT_ICONS_URL,
        help=f"URL to Microsoft's Azure icons ZIP (default: {DEFAULT_ICONS_URL})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for mxlibrary XML files (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep temporary download/extract files for debugging",
    )
    args = parser.parse_args()

    output_dir = Path(args.output)

    print("🏗️  Building draw.io Azure icon libraries")
    print(f"   Source: {args.icons_url}")
    print(f"   Output: {output_dir}\n")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        zip_path = download_icons_zip(args.icons_url, tmp_path)
        icons_root = extract_zip(zip_path, tmp_path)

        print(f"\n🔧 Converting SVGs to draw.io mxlibrary format")
        build_all_libraries(icons_root, output_dir)

        if args.keep_temp:
            kept = Path("tmp-drawio-icons")
            shutil.copytree(tmp_path, kept, dirs_exist_ok=True)
            print(f"\n   🗂️  Temp files kept at {kept}")

    print("\n✅ Build complete!")
    print(f"   Libraries at: {output_dir}/")
    print("   Open in draw.io: File → Open Library → select any .xml file")


if __name__ == "__main__":
    main()
