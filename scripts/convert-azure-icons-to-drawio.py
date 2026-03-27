#!/usr/bin/env python3
"""Convert Microsoft Azure Public Service Icons ZIP to draw.io library format.

Reads an Azure icon ZIP file (e.g., Azure_Public_Service_Icons_V23.zip),
extracts SVG icons, and produces:
  1. Per-category .xml library files for draw.io
  2. Individual icon .xml snippets for AI agent token-efficient lookup
  3. A reference.md lookup table (icon name → filename)
  4. A manifest.json with metadata

Usage:
    python scripts/convert-azure-icons-to-drawio.py <path-to-zip>

The ZIP is expected to contain a top-level folder with category subfolders,
each containing SVG files (Microsoft's standard icon pack structure).

Output is written to assets/drawio-libraries/.

Icon format: Base64 data URIs embedded in mxlibrary XML entries for fully
offline operation (no remote URL dependencies).
"""

import base64
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

# Output root relative to repo
OUTPUT_DIR = Path("assets/drawio-libraries")
SPLIT_DIR = OUTPUT_DIR / "azure-icons"
ICONS_DIR = SPLIT_DIR / "icons"
MANIFEST_FILE = SPLIT_DIR / "manifest.json"
REFERENCE_FILE = SPLIT_DIR / "reference.md"

# draw.io icon element defaults
ICON_WIDTH = 48
ICON_HEIGHT = 48


def sanitize_name(name: str) -> str:
    """Convert an icon filename to a clean display/file-safe name."""
    name = Path(name).stem
    # Remove leading numeric prefixes like "00001-icon-"
    name = re.sub(r"^\d+-", "", name)
    name = re.sub(r"[_\s]+", "-", name)
    name = re.sub(r"-+", "-", name)
    name = name.strip("-")
    return name


def make_safe_filename(name: str) -> str:
    """Create a filesystem-safe filename from a sanitized icon name.

    Uses the same normalization as sanitize_name() to ensure the
    reference.md display name maps directly to the filename.
    """
    # Replace any non-alphanumeric/hyphen/underscore chars with hyphens
    result = re.sub(r"[^a-zA-Z0-9_-]", "-", name)
    # Collapse multiple hyphens and strip leading/trailing
    result = re.sub(r"-+", "-", result)
    return result.strip("-")


def make_mxlibrary_entry(
    title: str, data_uri: str, width: int = ICON_WIDTH, height: int = ICON_HEIGHT
) -> dict:
    """Create a single mxlibrary JSON entry for a draw.io icon.

    The entry contains escaped XML representing an mxGraphModel with
    a single image cell using the icon's data URI.
    """
    xml = (
        f'<mxGraphModel><root>'
        f'<mxCell id="0"/>'
        f'<mxCell id="1" parent="0"/>'
        f'<mxCell id="2" value="{html.escape(title)}" '
        f'style="shape=image;verticalLabelPosition=bottom;'
        f'verticalAlign=top;imageAspect=0;aspect=fixed;'
        f'image={data_uri}" '
        f'vertex="1" parent="1">'
        f'<mxGeometry width="{width}" height="{height}" as="geometry"/>'
        f'</mxCell></root></mxGraphModel>'
    )
    escaped_xml = xml.replace("<", "&lt;").replace(">", "&gt;")
    return {
        "xml": escaped_xml,
        "w": width,
        "h": height,
        "title": title,
    }


def make_standalone_drawio(
    title: str, data_uri: str, width: int = ICON_WIDTH, height: int = ICON_HEIGHT
) -> str:
    """Create a standalone .drawio XML snippet for a single icon.

    Used for individual icon files that agents can load token-efficiently.
    """
    return (
        f'<mxfile>\n'
        f'  <diagram id="icon" name="{html.escape(title)}">\n'
        f'    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" '
        f'tooltips="1" connect="1" arrows="1" fold="1" '
        f'page="1" pageScale="1" pageWidth="850" pageHeight="1100">\n'
        f'      <root>\n'
        f'        <mxCell id="0"/>\n'
        f'        <mxCell id="1" parent="0"/>\n'
        f'        <mxCell id="2" value="{html.escape(title)}" '
        f'style="shape=image;verticalLabelPosition=bottom;'
        f'verticalAlign=top;imageAspect=0;aspect=fixed;'
        f'image={data_uri}" '
        f'vertex="1" parent="1">\n'
        f'          <mxGeometry width="{width}" height="{height}" as="geometry"/>\n'
        f'        </mxCell>\n'
        f'      </root>\n'
        f'    </mxGraphModel>\n'
        f'  </diagram>\n'
        f'</mxfile>\n'
    )


def extract_category(path_str: str) -> str:
    """Extract category name from ZIP entry path."""
    parts = Path(path_str).parts
    for i, part in enumerate(parts):
        if part.lower() == "icons" and i + 1 < len(parts):
            return parts[i + 1]
    return Path(path_str).parent.name


def write_mxlibrary(entries: list[dict], output_path: Path) -> None:
    """Write an mxlibrary XML file from a list of icon entries."""
    json_content = json.dumps(entries, separators=(",", ":"))
    content = f"<mxlibrary>{json_content}</mxlibrary>\n"
    output_path.write_text(content, encoding="utf-8")


def process_zip(zip_path: str) -> None:
    """Main conversion pipeline."""
    zip_path_obj = Path(zip_path)
    if not zip_path_obj.exists():
        print(f"Error: ZIP file not found: {zip_path_obj}", file=sys.stderr)
        sys.exit(1)

    # Create output directories
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    icons_by_category: dict[str, list[dict]] = {}
    icon_entries: list[tuple[str, str, str]] = []  # (display_name, safe_filename, category)
    seen_names: set[str] = set()
    total_icons = 0

    with ZipFile(zip_path_obj, "r") as zf:
        svg_entries = [
            e
            for e in zf.namelist()
            if e.lower().endswith(".svg") and not e.startswith("__MACOSX")
        ]

        if not svg_entries:
            print("Error: No SVG files found in ZIP", file=sys.stderr)
            sys.exit(1)

        print(f"Found {len(svg_entries)} SVG files in ZIP")

        for entry in sorted(svg_entries):
            svg_content = zf.read(entry)
            category = extract_category(entry)
            raw_name = sanitize_name(Path(entry).name)

            if not raw_name:
                continue

            # Deduplicate icons by name
            if raw_name in seen_names:
                print(f"  Skipping duplicate: {raw_name} (from {entry})")
                continue
            seen_names.add(raw_name)

            # Base64-encode SVG for data URI
            b64 = base64.b64encode(svg_content).decode("ascii")
            data_uri = f"data:image/svg+xml;base64,{b64}"

            # Create mxlibrary entry for category library
            lib_entry = make_mxlibrary_entry(raw_name, data_uri)
            icons_by_category.setdefault(category, []).append(lib_entry)

            # Save individual icon .xml snippet
            safe_filename = make_safe_filename(raw_name)
            icon_xml_path = ICONS_DIR / f"{safe_filename}.xml"
            icon_xml = make_standalone_drawio(raw_name, data_uri)
            icon_xml_path.write_text(icon_xml, encoding="utf-8")

            icon_entries.append((raw_name, safe_filename, category))
            total_icons += 1

    # Write per-category library files
    cat_index = 1
    for category in sorted(icons_by_category.keys()):
        entries = icons_by_category[category]
        cat_slug = re.sub(r"[^a-zA-Z0-9]+", "-", category).strip("-").lower()
        cat_filename = f"{cat_index:03d}-{cat_slug}.xml"
        cat_path = SPLIT_DIR / cat_filename
        write_mxlibrary(entries, cat_path)
        print(f"  Wrote {cat_path} ({len(entries)} icons)")
        cat_index += 1

    # Write manifest.json
    manifest = {
        "source": "Microsoft Azure Architecture Icons",
        "sourceUrl": "https://learn.microsoft.com/en-us/azure/architecture/icons/",
        "totalIcons": total_icons,
        "categories": len(icons_by_category),
        "categoryList": sorted(icons_by_category.keys()),
        "format": "mxlibrary",
        "iconDimensions": {"width": ICON_WIDTH, "height": ICON_HEIGHT},
        "convertedAt": datetime.now(timezone.utc).isoformat(),
        "lastChecked": datetime.now(timezone.utc).strftime("%Y-%m"),
        "sourceVersion": "V23-November-2025",
        "style": (
            "shape=image;verticalLabelPosition=bottom;"
            "verticalAlign=top;imageAspect=0;aspect=fixed;"
            "image=data:image/svg+xml;base64,<BASE64>"
        ),
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {MANIFEST_FILE}")

    # Write reference.md (deduplicated, sorted)
    lines = [
        "# Azure Icon Reference — Draw.io",
        "",
        "Quick lookup table for AI agents. Use icon name to find the XML snippet file.",
        "",
        "| Icon Name | Filename | Category |",
        "|-----------|----------|----------|",
    ]
    for display_name, safe_filename, category in sorted(
        icon_entries, key=lambda x: x[0].lower()
    ):
        lines.append(f"| {display_name} | `{safe_filename}.xml` | {category} |")

    lines.append("")
    lines.append(
        f"**Total**: {total_icons} icons across {len(icons_by_category)} categories"
    )
    lines.append("")

    REFERENCE_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REFERENCE_FILE}")

    print(f"\nDone! {total_icons} icons converted across {len(icons_by_category)} categories.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-azure-icons-zip>", file=sys.stderr)
        sys.exit(1)

    process_zip(sys.argv[1])
