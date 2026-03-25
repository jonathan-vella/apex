#!/usr/bin/env python3
"""Generate a draw.io component mapping reference from the built icon libraries.

Scans the assets/drawio-libraries/azure-public-service-icons/ XML libraries and
produces a markdown reference mapping icon titles to their categories and style snippets.

Usage:
    python scripts/drawio/generate-component-mapping.py
"""

import glob
import json
import sys
from pathlib import Path

OUTPUT_FILE = ".github/skills/azure-diagrams/references/drawio-component-mapping.md"
LIBRARY_DIR = "assets/drawio-libraries/azure-public-service-icons"


def parse_library(xml_path: Path) -> list[dict]:
    """Extract icon entries from an mxlibrary XML file."""
    content = xml_path.read_text(encoding="utf-8")
    start = content.index("[")
    end = content.rindex("]") + 1
    return json.loads(content[start:end])


def clean_title(title: str) -> str:
    """Convert icon filename to a readable name."""
    # Remove numeric prefix: "00195-icon-service-Maintenance-Configuration" → "Maintenance Configuration"
    parts = title.split("-")
    # Find where the meaningful name starts (after "icon-service-" or similar)
    meaningful = []
    skip_prefixes = {"icon", "service", "Icon", "Service"}
    found_start = False
    for part in parts:
        if not found_start:
            if part.isdigit() or part in skip_prefixes:
                continue
            found_start = True
        if found_start:
            meaningful.append(part)

    if meaningful:
        return " ".join(meaningful)
    return title


def main() -> None:
    lib_dir = Path(LIBRARY_DIR)
    if not lib_dir.exists():
        print(f"❌ Library directory not found: {lib_dir}", file=sys.stderr)
        print("   Run: npm run build:drawio-icons", file=sys.stderr)
        sys.exit(1)

    lines = [
        "# Draw.io Component Mapping",
        "",
        "Maps Azure service names to their draw.io icon library entries.",
        "Built from Microsoft's official Azure Architecture Icons.",
        "",
        "## How to Use",
        "",
        "Each icon's `style` attribute in the mxlibrary XML contains the full",
        "base64-encoded SVG. To use an icon in a diagram:",
        "",
        "1. Find the service in the table below",
        "2. Note the **Library File** (e.g., `007 compute.xml`)",
        '3. The icon\'s style is: `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;aspect=fixed;image=data:image/svg+xml,{BASE64}`',
        "",
        "For the most common icons, see `quick-reference.md` which has ready-to-use XML snippets.",
        "",
    ]

    xml_files = sorted(lib_dir.glob("[0-9][0-9][0-9] *.xml"))
    # Skip 000 (combined)
    xml_files = [f for f in xml_files if not f.name.startswith("000")]

    for xml_path in xml_files:
        category = xml_path.stem  # e.g., "007 compute"
        entries = parse_library(xml_path)

        if not entries:
            continue

        lines.append(f"## {category.title()}")
        lines.append("")
        lines.append("| Icon Title | Clean Name | Library File |")
        lines.append("|------------|-----------|-------------|")

        for entry in entries:
            title = entry["title"]
            clean = clean_title(title)
            lines.append(f"| {title} | {clean} | {xml_path.name} |")

        lines.append("")

    output = Path(OUTPUT_FILE)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✅ Component mapping written to {output}")

    # Count total
    total = sum(
        1 for xml_path in xml_files for _ in parse_library(xml_path)
    )
    print(f"   {total} icons mapped across {len(xml_files)} categories")


if __name__ == "__main__":
    main()
