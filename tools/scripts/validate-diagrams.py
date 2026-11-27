#!/usr/bin/env python3
"""Scoped automated quality validator for APEX AAC architecture diagrams and topology specs."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parents[1]
DIAGRAM_SCRIPTS_DIR = REPO_ROOT / ".github" / "skills" / "apex-python-diagrams" / "scripts"


def _load_module(name: str, path: Path):
    mod = sys.modules.get(name)
    if mod is not None:
        return mod
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {name} from {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_assess = _load_module("validate_assessment_diagram", SCRIPTS_DIR / "validate-assessment-diagram.py")
_topo = _load_module("topology_render", DIAGRAM_SCRIPTS_DIR / "topology_render.py")


def _parse_bbox(raw: str) -> tuple[float, float, float, float]:
    parts = [float(p.strip()) for p in raw.split(",")]
    if len(parts) != 4:
        raise ValueError(f"Invalid data-bbox attribute: {raw!r}")
    x, y, w, h = parts
    return (x, y, x + w, y + h)


def _parse_points(raw: str) -> list[tuple[float, float]]:
    pts: list[tuple[float, float]] = []
    for pair in raw.split(";"):
        pair = pair.strip()
        if not pair:
            continue
        x_s, y_s = pair.split(",", 1)
        pts.append((float(x_s), float(y_s)))
    return pts


def _is_vendored_icon(path: Path) -> bool:
    parts = [p.lower() for p in path.parts]
    for i in range(len(parts) - 1):
        if parts[i] == "assets" and parts[i + 1] == "az":
            return True
    return False


def validate_aac_svg(
    svg_path: Path,
    *,
    require_png: bool = True,
    strict_aac: bool = False,
) -> list[str]:
    """Validate a single generated diagram SVG (+ paired PNG). Returns list of errors."""
    errors: list[str] = []
    if _is_vendored_icon(svg_path):
        return errors

    try:
        _assess.validate_svg_file(svg_path)
    except ValueError as exc:
        errors.append(str(exc))
        return errors

    root = ET.fromstring(svg_path.read_text(encoding="utf-8"))
    is_aac = strict_aac or root.attrib.get("data-apex-style") == "aac"

    if require_png:
        png_path = svg_path.with_suffix(".png")
        if png_path.is_symlink() or not png_path.is_file() or png_path.stat().st_size == 0:
            errors.append(f"Missing or empty paired PNG for {svg_path.name}")
        else:
            try:
                _assess.parse_png_dimensions(png_path.read_bytes())
            except ValueError as exc:
                errors.append(f"{png_path.name}: {exc}")

    if not is_aac:
        return errors

    # Accessibility metadata required on AAC diagrams
    if root.attrib.get("role") != "img":
        errors.append(f"{svg_path.name}: missing role=\"img\" on <svg>")
    title_el = next((el for el in root if el.tag.rsplit("}", 1)[-1] == "title"), None)
    desc_el = next((el for el in root if el.tag.rsplit("}", 1)[-1] == "desc"), None)
    if title_el is None or not (title_el.text or "").strip():
        errors.append(f"{svg_path.name}: missing non-empty <title> element")
    if desc_el is None or not (desc_el.text or "").strip():
        errors.append(f"{svg_path.name}: missing non-empty <desc> element")

    # Semantic tile icon provenance + bounding-box collision checks
    tiles: list[tuple[str, tuple[float, float, float, float]]] = []
    edges: list[tuple[str, str | None, str | None, list[tuple[float, float]]]] = []

    for elem in root.iter():
        role = elem.attrib.get("data-apex-role")
        if role == "tile":
            nid = elem.attrib.get("data-node-id", "<unnamed>")
            match = elem.attrib.get("data-icon-match")
            if match != "exact":
                errors.append(
                    f"{svg_path.name}: tile {nid!r} icon match is {match!r} (expected 'exact')"
                )
            bbox_raw = elem.attrib.get("data-bbox")
            if bbox_raw:
                try:
                    tiles.append((nid, _parse_bbox(bbox_raw)))
                except ValueError as exc:
                    errors.append(f"{svg_path.name}: {exc}")
        elif role == "edge":
            eid = elem.attrib.get("data-edge-id") or elem.attrib.get("data-step") or "<edge>"
            pts_raw = elem.attrib.get("data-points", "")
            if pts_raw:
                try:
                    edges.append(
                        (
                            eid,
                            elem.attrib.get("data-source"),
                            elem.attrib.get("data-target"),
                            _parse_points(pts_raw),
                        )
                    )
                except ValueError as exc:
                    errors.append(f"{svg_path.name}: {exc}")

    # Tile-vs-tile overlap detection
    for i in range(len(tiles)):
        id_a, rect_a = tiles[i]
        for j in range(i + 1, len(tiles)):
            id_b, rect_b = tiles[j]
            if _topo._boxes_overlap(rect_a, rect_b):
                errors.append(f"{svg_path.name}: overlapping tiles {id_a!r} and {id_b!r}")

    # Edge-vs-unrelated-tile crossing detection (exempting endpoint tiles and zone borders)
    for eid, src, tgt, pts in edges:
        ignore = {src, tgt}
        for p1, p2 in zip(pts, pts[1:]):
            for tid, rect in tiles:
                if tid in ignore:
                    continue
                if _topo._segment_intersects_box(p1, p2, rect):
                    errors.append(f"{svg_path.name}: edge {eid!r} crosses unrelated tile {tid!r}")
                    break

    return errors


def discover_repo_aac_targets(root_dir: Path) -> tuple[list[Path], list[Path]]:
    """Find generated AAC diagram SVGs (excluding vendored icon packs) and `*.topology.json` specs."""
    svgs: list[Path] = []
    specs: list[Path] = []
    agent_output = root_dir / "agent-output"
    if agent_output.is_dir():
        for svg in sorted(agent_output.rglob("*.svg")):
            if svg.is_symlink() or _is_vendored_icon(svg):
                continue
            head = svg.read_text(encoding="utf-8", errors="ignore")[:512]
            if 'data-apex-diagram="true"' in head and 'data-apex-style="aac"' in head:
                svgs.append(svg)
        for spec in sorted(agent_output.rglob("*.topology.json")):
            if not spec.is_symlink():
                specs.append(spec)
    return svgs, specs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, help="Validate generated diagrams under a project directory")
    parser.add_argument("--files", nargs="*", type=Path, default=[], help="Explicit SVG or *.topology.json paths")
    parser.add_argument("--repo-aac", action="store_true", help="Scan repo agent-output/ for AAC diagrams and specs")
    parser.add_argument("--strict-aac", action="store_true", help="Enforce AAC checks even without data-apex-style=aac")
    parser.add_argument("--no-png", action="store_true", help="Skip paired PNG checks")
    args = parser.parse_args(argv)

    svg_targets: list[Path] = []
    spec_targets: list[Path] = []

    if args.repo_aac:
        svgs, specs = discover_repo_aac_targets(REPO_ROOT)
        svg_targets.extend(svgs)
        spec_targets.extend(specs)
    if args.project_dir:
        assets = args.project_dir / "assets"
        search_root = assets if assets.is_dir() else args.project_dir
        for svg in sorted(search_root.rglob("*.svg")):
            if not svg.is_symlink() and not _is_vendored_icon(svg):
                svg_targets.append(svg)
        for spec in sorted(search_root.rglob("*.topology.json")):
            if not spec.is_symlink():
                spec_targets.append(spec)
    for f in args.files:
        if f.name.endswith(".topology.json"):
            spec_targets.append(f)
        elif f.suffix.lower() == ".svg":
            svg_targets.append(f)

    all_errors: list[str] = []
    for svg in sorted(set(svg_targets)):
        all_errors.extend(validate_aac_svg(svg, require_png=not args.no_png, strict_aac=args.strict_aac))
    for spec_path in sorted(set(spec_targets)):
        try:
            spec_doc = json.loads(spec_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            all_errors.append(f"{spec_path}: invalid JSON ({exc})")
            continue
        for err in _topo.validate_topology_spec(spec_doc):
            all_errors.append(f"{spec_path}: {err}")

    result: dict[str, Any] = {
        "valid": len(all_errors) == 0,
        "checked_svgs": len(set(svg_targets)),
        "checked_specs": len(set(spec_targets)),
        "errors": all_errors,
    }
    print(json.dumps(result))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
