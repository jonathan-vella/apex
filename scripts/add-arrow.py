#!/usr/bin/env python3
"""Add an arrow to an Excalidraw diagram."""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

DEFAULT_FONT_FAMILY = 5
DEFAULT_FONT_SIZE = 16
DEFAULT_STROKE = "#0078D4"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Add an arrow to an Excalidraw diagram.")
    parser.add_argument("diagram", help="Path to the target .excalidraw file")
    parser.add_argument("from_x", type=float, help="Arrow start x-coordinate")
    parser.add_argument("from_y", type=float, help="Arrow start y-coordinate")
    parser.add_argument("to_x", type=float, help="Arrow end x-coordinate")
    parser.add_argument("to_y", type=float, help="Arrow end y-coordinate")
    parser.add_argument("--label", help="Optional label placed near the arrow midpoint")
    parser.add_argument(
        "--style",
        choices=["solid", "dashed"],
        default="solid",
        help="Arrow stroke style",
    )
    parser.add_argument(
        "--stroke-color",
        default=DEFAULT_STROKE,
        help="Arrow stroke color",
    )
    return parser.parse_args()


def create_arrow(args: argparse.Namespace) -> dict:
    dx = args.to_x - args.from_x
    dy = args.to_y - args.from_y
    return {
        "id": str(uuid.uuid4()),
        "type": "arrow",
        "x": args.from_x,
        "y": args.from_y,
        "width": dx,
        "height": dy,
        "angle": 0,
        "strokeColor": args.stroke_color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 3,
        "strokeStyle": args.style,
        "roughness": 0,
        "opacity": 100,
        "points": [[0, 0], [dx, dy]],
        "startArrowhead": None,
        "endArrowhead": "arrow",
    }


def create_label(args: argparse.Namespace) -> dict | None:
    if not args.label:
        return None

    label_width = max(120, int(len(args.label) * DEFAULT_FONT_SIZE * 0.58))
    midpoint_x = (args.from_x + args.to_x) / 2
    midpoint_y = (args.from_y + args.to_y) / 2
    return {
        "id": str(uuid.uuid4()),
        "type": "text",
        "x": midpoint_x - (label_width / 2),
        "y": midpoint_y - 10,
        "width": label_width,
        "height": 20,
        "angle": 0,
        "strokeColor": args.stroke_color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "fontSize": DEFAULT_FONT_SIZE,
        "fontFamily": DEFAULT_FONT_FAMILY,
        "text": args.label,
        "textAlign": "center",
        "verticalAlign": "top",
        "originalText": args.label,
        "lineHeight": 1.25,
    }


def main() -> int:
    args = parse_args()
    diagram_path = Path(args.diagram)
    if not diagram_path.exists():
        print(f"Diagram not found: {diagram_path}", file=sys.stderr)
        return 1

    diagram_data = json.loads(diagram_path.read_text(encoding="utf-8"))
    diagram_data.setdefault("elements", []).append(create_arrow(args))

    label = create_label(args)
    if label:
        diagram_data["elements"].append(label)

    diagram_path.write_text(json.dumps(diagram_data, indent=2) + "\n", encoding="utf-8")
    print(f"Added arrow to {diagram_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
