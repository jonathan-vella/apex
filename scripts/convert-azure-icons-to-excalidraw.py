#!/usr/bin/env python3
"""Convert Microsoft Azure Public Service Icons ZIP to Excalidraw library format.

Reads an Azure icon ZIP file (e.g., Azure_Public_Service_Icons_V23.zip),
extracts SVG icons, and produces:
  1. A combined .excalidrawlib file for the VS Code Excalidraw extension
  2. Individual icon JSON files for AI agent token-efficient lookup
  3. A reference.md lookup table (icon name → filename)
  4. A manifest.json with metadata

Usage:
    python scripts/convert-azure-icons-to-excalidraw.py <path-to-zip>

The ZIP is expected to contain a top-level folder with category subfolders,
each containing SVG files (Microsoft's standard icon pack structure).

Output is written to assets/excalidraw-libraries/.
"""

import base64
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

# Output root relative to repo
OUTPUT_DIR = Path("assets/excalidraw-libraries")
LIBRARY_FILE = OUTPUT_DIR / "azure-icons.excalidrawlib"
SPLIT_DIR = OUTPUT_DIR / "azure-icons"
ICONS_DIR = SPLIT_DIR / "icons"
MANIFEST_FILE = SPLIT_DIR / "manifest.json"
REFERENCE_FILE = SPLIT_DIR / "reference.md"

# Excalidraw element defaults
ICON_WIDTH = 48
ICON_HEIGHT = 48


def sanitize_name(name: str) -> str:
    """Convert an icon filename to a clean display/file-safe name."""
    name = Path(name).stem  # strip extension
    # Remove leading numeric prefixes like "00001-icon-"
    name = re.sub(r"^\d+-", "", name)
    # Replace underscores and multiple hyphens with single hyphen
    name = re.sub(r"[_\s]+", "-", name)
    name = re.sub(r"-+", "-", name)
    name = name.strip("-")
    return name


def make_excalidraw_element(svg_data_uri: str, icon_id: str) -> dict:
    """Create an Excalidraw image element for a single icon."""
    return {
        "id": icon_id,
        "type": "image",
        "x": 0,
        "y": 0,
        "width": ICON_WIDTH,
        "height": ICON_HEIGHT,
        "angle": 0,
        "strokeColor": "transparent",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 0,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "index": "a0",
        "roundness": None,
        "seed": 0,
        "version": 1,
        "versionNonce": 0,
        "isDeleted": False,
        "boundElements": None,
        "updated": int(datetime.now(timezone.utc).timestamp() * 1000),
        "link": None,
        "locked": False,
        "status": "saved",
        "fileId": icon_id,
    }


def make_library_item(name: str, elements: list) -> dict:
    """Create a single libraryItems entry for the .excalidrawlib file."""
    return {
        "status": "published",
        "id": str(uuid.uuid4()),
        "created": int(datetime.now(timezone.utc).timestamp() * 1000),
        "name": name,
        "elements": elements,
    }


def extract_category(path_str: str) -> str:
    """Extract category name from ZIP entry path.

    Handles structures like:
      Azure_Public_Service_Icons/Icons/Compute/SVG/icon.svg
      Icons/Compute/SVG/icon.svg
    """
    parts = Path(path_str).parts
    # Find the "Icons" folder and take the next part as category
    for i, part in enumerate(parts):
        if part.lower() == "icons" and i + 1 < len(parts):
            return parts[i + 1]
    # Fallback: use parent directory name
    return Path(path_str).parent.name


def process_zip(zip_path: str) -> None:
    """Main conversion pipeline."""
    zip_path = Path(zip_path)
    if not zip_path.exists():
        print(f"Error: ZIP file not found: {zip_path}", file=sys.stderr)
        sys.exit(1)

    # Create output directories
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    library_items = []
    icons_by_category: dict[str, list[str]] = {}
    icon_entries: list[tuple[str, str]] = []  # (display_name, filename)
    total_icons = 0
    files_data: dict[str, dict] = {}

    with ZipFile(zip_path, "r") as zf:
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

            # Base64-encode SVG for data URI
            b64 = base64.b64encode(svg_content).decode("ascii")
            data_uri = f"data:image/svg+xml;base64,{b64}"

            # Generate deterministic ID from name
            icon_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, raw_name))

            # Create Excalidraw element
            element = make_excalidraw_element(data_uri, icon_id)

            # Store file data for the element (Excalidraw files registry)
            files_data[icon_id] = {
                "mimeType": "image/svg+xml",
                "id": icon_id,
                "dataURL": data_uri,
                "created": int(datetime.now(timezone.utc).timestamp() * 1000),
                "lastRetrieved": int(
                    datetime.now(timezone.utc).timestamp() * 1000
                ),
            }

            # Add to library
            library_items.append(make_library_item(raw_name, [element]))

            # Track category
            icons_by_category.setdefault(category, []).append(raw_name)

            # Save individual icon JSON
            safe_filename = re.sub(r"[^a-zA-Z0-9_-]", "-", raw_name)
            icon_json_path = ICONS_DIR / f"{safe_filename}.json"
            icon_data = {
                "type": "excalidraw",
                "version": 2,
                "source": "https://excalidraw.com",
                "elements": [element],
                "appState": {
                    "viewBackgroundColor": "#ffffff",
                    "gridSize": 20,
                },
                "files": {icon_id: files_data[icon_id]},
            }
            icon_json_path.write_text(
                json.dumps(icon_data, indent=2), encoding="utf-8"
            )

            icon_entries.append((raw_name, safe_filename))
            total_icons += 1

    # Write combined .excalidrawlib
    excalidraw_lib = {
        "type": "excalidrawlib",
        "version": 2,
        "source": "https://excalidraw.com",
        "libraryItems": library_items,
    }
    LIBRARY_FILE.write_text(
        json.dumps(excalidraw_lib, indent=2), encoding="utf-8"
    )
    print(f"Wrote {LIBRARY_FILE} ({total_icons} icons)")

    # Write manifest.json
    manifest = {
        "source": "Microsoft Azure Architecture Icons",
        "sourceUrl": "https://learn.microsoft.com/en-us/azure/architecture/icons/",
        "totalIcons": total_icons,
        "categories": len(icons_by_category),
        "categoryList": sorted(icons_by_category.keys()),
        "format": "excalidrawlib",
        "iconDimensions": {"width": ICON_WIDTH, "height": ICON_HEIGHT},
        "convertedAt": datetime.now(timezone.utc).isoformat(),
        "lastChecked": datetime.now(timezone.utc).strftime("%Y-%m"),
        "sourceVersion": "V23-November-2025",
    }
    MANIFEST_FILE.write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    print(f"Wrote {MANIFEST_FILE}")

    # Write reference.md
    lines = [
        "# Azure Icon Reference",
        "",
        "Quick lookup table for AI agents. Use icon name to find the JSON file.",
        "",
        "| Icon Name | Filename | Category |",
        "|-----------|----------|----------|",
    ]
    # Sort entries by name
    for display_name, safe_filename in sorted(icon_entries, key=lambda x: x[0].lower()):
        # Find category
        cat = "Unknown"
        for c, names in icons_by_category.items():
            if display_name in names:
                cat = c
                break
        lines.append(f"| {display_name} | `{safe_filename}.json` | {cat} |")

    lines.append("")
    lines.append(f"**Total**: {total_icons} icons across {len(icons_by_category)} categories")
    lines.append("")

    REFERENCE_FILE.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {REFERENCE_FILE}")

    print(f"\nDone! {total_icons} icons converted across {len(icons_by_category)} categories.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-azure-icons-zip>", file=sys.stderr)
        sys.exit(1)

    process_zip(sys.argv[1])
