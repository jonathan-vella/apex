#!/usr/bin/env python3
"""Save a Draw.io MCP server response to a validated .drawio file.

Handles the full pipeline in one call:
  1. Extract XML from the MCP JSON response (finish-diagram or export-diagram)
  2. Decompress if the server returned compressed content (deflate-raw + base64)
  3. Rebuild the file with <mxGraphModel> as a child element (repo validator format)
  4. Strip server-injected edge anchor points and waypoints (entryX/Y, exitX/Y, Array)
  5. Write the final .drawio file

Usage:
    python3 scripts/save-drawio.py <mcp-response.json> <output.drawio>

Exit codes:
    0 = success
    1 = invalid arguments or processing error
"""

import base64
import json
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

ANCHOR_KEYS = re.compile(
    r"(exitX|exitY|exitDx|exitDy|entryX|entryY|entryDx|entryDy)=[^;]*;?"
)


def decompress_diagram(text: str) -> str:
    raw = base64.b64decode(text.strip())
    inflated = zlib.decompress(raw, -15).decode("utf-8")
    return urllib.parse.unquote(inflated)


def strip_edge_anchors(graph_root: ET.Element) -> int:
    fixed = 0
    for cell in graph_root:
        if cell.get("edge") != "1":
            continue
        style = cell.get("style", "")
        cleaned = ANCHOR_KEYS.sub("", style)
        cleaned = cleaned.rstrip(";") + ";" if cleaned.strip() else cleaned
        if cleaned != style:
            cell.set("style", cleaned)
            fixed += 1
        geom = cell.find("mxGeometry")
        if geom is not None:
            for arr in geom.findall("Array"):
                geom.remove(arr)
                fixed += 1
    return fixed


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <mcp-response.json> <output.drawio>", file=sys.stderr)
        return 1

    src_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    data = json.loads(src_path.read_text(encoding="utf-8"))
    xml_str = data.get("data", data).get("xml", "")
    if not xml_str:
        print("ERROR: No 'xml' field found in JSON response", file=sys.stderr)
        return 1

    mxfile = ET.fromstring(xml_str)
    diagram = mxfile.find("diagram")
    if diagram is None:
        print("ERROR: No <diagram> element found", file=sys.stderr)
        return 1

    diagram_text = (diagram.text or "").strip()
    if diagram_text:
        decoded = decompress_diagram(diagram_text)
        graph_model = ET.fromstring(decoded)
        diagram.text = None
        diagram[:] = [graph_model]
        print(f"  Decompressed diagram content ({len(decoded)} chars)")

    graph_root = mxfile.find(".//mxGraphModel/root")
    if graph_root is not None:
        n = strip_edge_anchors(graph_root)
        if n:
            print(f"  Stripped {n} edge anchor/waypoint entries")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(ET.tostring(mxfile, encoding="unicode"), encoding="utf-8")
    print(f"  Saved to {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
