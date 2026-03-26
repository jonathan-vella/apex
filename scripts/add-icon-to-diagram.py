#!/usr/bin/env python3
"""Add an Azure or Fabric icon to an Excalidraw diagram."""

from __future__ import annotations

import argparse
import json
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

AZURE_ICON_DIR = Path("assets/excalidraw-libraries/azure-icons/icons")
FABRIC_ICON_DIR = Path("assets/excalidraw-libraries/fabric-icons/icons")
DEFAULT_FONT_FAMILY = 5
DEFAULT_FONT_SIZE = 16
DEFAULT_LABEL_COLOR = "#0f172a"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add an Azure or Fabric icon to an Excalidraw diagram.",
    )
    parser.add_argument("diagram", help="Path to the target .excalidraw file")
    parser.add_argument("icon_name", help="Icon filename, stem, or display name")
    parser.add_argument("x", type=float, help="Icon x-coordinate in pixels")
    parser.add_argument("y", type=float, help="Icon y-coordinate in pixels")
    parser.add_argument("--width", type=float, default=48, help="Icon width in pixels")
    parser.add_argument("--height", type=float, default=48, help="Icon height in pixels")
    parser.add_argument("--label", help="Optional text label to place under the icon")
    parser.add_argument(
        "--label-offset",
        type=float,
        default=10,
        help="Vertical spacing between the icon and the optional label",
    )
    parser.add_argument(
        "--icon-set",
        choices=["auto", "azure", "fabric"],
        default="auto",
        help="Icon library to search",
    )
    return parser.parse_args()


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def build_icon_index(icon_dir: Path) -> dict[str, Path]:
    index: dict[str, Path] = {}
    for icon_path in icon_dir.glob("*.json"):
        stem = icon_path.stem
        index[normalize_name(stem)] = icon_path
        trimmed = stem.removeprefix("icon-service-")
        index.setdefault(normalize_name(trimmed), icon_path)
    return index


def resolve_icon_path(icon_name: str, icon_set: str) -> Path:
    candidate = Path(icon_name)
    if candidate.exists():
        return candidate

    search_dirs = []
    if icon_set in {"auto", "azure"}:
        search_dirs.append(AZURE_ICON_DIR)
    if icon_set in {"auto", "fabric"}:
        search_dirs.append(FABRIC_ICON_DIR)

    for search_dir in search_dirs:
        direct_candidates = [
            search_dir / icon_name,
            search_dir / f"{icon_name}.json",
            search_dir / f"icon-service-{icon_name}.json",
        ]
        for direct_candidate in direct_candidates:
            if direct_candidate.exists():
                return direct_candidate

    normalized_target = normalize_name(icon_name)
    matches = []
    for search_dir in search_dirs:
        index = build_icon_index(search_dir)
        matched = index.get(normalized_target)
        if matched:
            matches.append(matched)

    if len(matches) == 1:
        return matches[0]

    if len(matches) > 1:
        joined = ", ".join(str(match) for match in matches)
        raise ValueError(f"Ambiguous icon name '{icon_name}'. Matches: {joined}")

    raise FileNotFoundError(f"Unable to resolve icon '{icon_name}'")


def copy_icon_element(icon_data: dict, x: float, y: float, width: float, height: float) -> tuple[dict, dict]:
    image_element = next(
        (element for element in icon_data.get("elements", []) if element.get("type") == "image"),
        None,
    )
    if image_element is None:
        raise ValueError("Icon file does not contain an image element")

    file_entries = icon_data.get("files", {})
    if len(file_entries) != 1:
        raise ValueError("Icon file must contain exactly one file entry")

    file_id, file_entry = next(iter(file_entries.items()))
    element_copy = dict(image_element)
    element_copy.update(
        {
            "id": str(uuid.uuid4()),
            "x": x,
            "y": y,
            "width": width,
            "height": height,
            "updated": now_ms(),
            "fileId": file_id,
            "status": "saved",
        }
    )
    return element_copy, {file_id: file_entry}


def create_label_element(args: argparse.Namespace) -> dict | None:
    if not args.label:
        return None

    label_width = max(120, int(len(args.label) * DEFAULT_FONT_SIZE * 0.58))
    label_x = args.x + (args.width / 2) - (label_width / 2)
    label_y = args.y + args.height + args.label_offset
    return {
        "id": str(uuid.uuid4()),
        "type": "text",
        "x": label_x,
        "y": label_y,
        "width": label_width,
        "height": 20,
        "angle": 0,
        "strokeColor": DEFAULT_LABEL_COLOR,
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

    try:
        icon_path = resolve_icon_path(args.icon_name, args.icon_set)
    except (FileNotFoundError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    diagram_data = load_json(diagram_path)
    icon_data = load_json(icon_path)

    icon_element, file_entry = copy_icon_element(icon_data, args.x, args.y, args.width, args.height)
    diagram_data.setdefault("elements", []).append(icon_element)
    diagram_data.setdefault("files", {}).update(file_entry)

    label_element = create_label_element(args)
    if label_element:
        diagram_data["elements"].append(label_element)

    diagram_path.write_text(json.dumps(diagram_data, indent=2) + "\n", encoding="utf-8")
    print(f"Added {icon_path.stem} to {diagram_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
