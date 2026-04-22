#!/usr/bin/env python3
"""Post-save cleanup for Draw.io files generated via the MCP server.

Fixes known MCP artifacts:
1. value="New Cell" → value="" (MCP default for vertices without explicit text)
2. Watermark cell height ≥ 70px (so all 4 lines of APEX attribution show)
3. Reports cross-cutting icons spaced < 120px apart

Usage:
    python3 .github/skills/drawio/scripts/cleanup-drawio.py <drawio-file>
"""

import sys
import xml.etree.ElementTree as ET


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python3 .github/skills/drawio/scripts/cleanup-drawio.py <drawio-file>", file=sys.stderr)
        return 1

    path = sys.argv[1]
    tree = ET.parse(path)
    root = tree.getroot()
    model = root.find(".//root")
    if model is None:
        print(f"Error: no <root> element found in {path}", file=sys.stderr)
        return 1

    fixes = 0

    # 1. Fix "New Cell" default values
    for cell in model.findall("mxCell"):
        if cell.get("value") == "New Cell":
            cell.set("value", "")
            fixes += 1
            print(f'  Fixed "New Cell" on {cell.get("id")}')

    # 2. Ensure watermark height ≥ 70px
    for cell in model.findall("mxCell"):
        if "watermark" in cell.get("id", ""):
            geo = cell.find("mxGeometry")
            if geo is not None:
                h = float(geo.get("height", "0"))
                if h < 70:
                    geo.set("height", "70")
                    fixes += 1
                    print(f"  Watermark height {h}px → 70px")

    # 3. Check cross-cutting icon spacing (report only, no auto-fix)
    crosscut_icons = []
    for cell in model.findall("mxCell"):
        style = cell.get("style", "")
        geo = cell.find("mxGeometry")
        if geo is None:
            continue
        y = float(geo.get("y", "0"))
        x = float(geo.get("x", "0"))
        # Heuristic: icons in the cross-cutting band are shaped vertices
        # between y=900 and y=1100 with width=48 (standard icon size)
        w = float(geo.get("width", "0"))
        if w == 48 and 900 <= y <= 1100 and "placeholder" not in style:
            val = cell.get("value", "")
            if val:
                crosscut_icons.append((x, val))

    crosscut_icons.sort()
    for i in range(1, len(crosscut_icons)):
        gap = crosscut_icons[i][0] - crosscut_icons[i - 1][0]
        if gap < 120:
            print(
                f"  Warning: {crosscut_icons[i-1][1]} → {crosscut_icons[i][1]} "
                f"spacing is {gap}px (minimum 120px)"
            )

    # Write back
    xml_str = ET.tostring(root, encoding="unicode")
    xml_str = xml_str.replace("\n", "")
    with open(path, "w") as f:
        f.write(xml_str)

    if fixes:
        print(f"  {fixes} fix(es) applied to {path}")
    else:
        print(f"  No fixes needed for {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
