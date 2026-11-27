#!/usr/bin/env python3
"""Render a JSON semantic Azure topology spec via ELK layout into AAC SVG + PNG."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPTS_DIR.parents[3]
ELK_SCRIPT = REPO_ROOT / "tools" / "scripts" / "elk-layout.mjs"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import dlib  # noqa: E402


def validate_topology_spec(spec: dict[str, Any]) -> list[str]:
    """Validate semantic invariants of a topology spec; return a list of errors."""
    errors: list[str] = []
    if not isinstance(spec, dict):
        return ["Topology spec must be a JSON object"]
    if not isinstance(spec.get("title"), str) or not spec["title"].strip():
        errors.append("Missing or empty 'title'")
    nodes = spec.get("nodes")
    if not isinstance(nodes, list) or len(nodes) == 0:
        errors.append("'nodes' must be a non-empty list")
        return errors
    groups = spec.get("groups", [])
    edges = spec.get("edges", [])
    dataflow = spec.get("dataflow", [])

    group_ids: set[str] = set()
    node_ids: set[str] = set()
    edge_ids: set[str] = set()
    parent_map: dict[str, str | None] = {}

    for g in groups:
        gid = g.get("id")
        if not gid:
            errors.append("Group missing 'id'")
            continue
        if gid in group_ids:
            errors.append(f"Duplicate group id: {gid}")
        group_ids.add(gid)
        parent_map[gid] = g.get("parent")
        kind = g.get("kind")
        if kind not in dlib.AAC_ZONE_STYLES:
            errors.append(f"Group {gid!r} has invalid kind {kind!r}")
        if g.get("icon"):
            try:
                dlib.resolve_icon_with_provenance(g["icon"], strict=True)
            except KeyError as exc:
                errors.append(f"Group {gid!r}: {exc}")

    for n in nodes:
        nid = n.get("id")
        if not nid:
            errors.append("Node missing 'id'")
            continue
        if nid in node_ids or nid in group_ids:
            errors.append(f"Duplicate id across nodes/groups: {nid}")
        node_ids.add(nid)
        parent_map[nid] = n.get("parent")
        icon = n.get("icon", "")
        try:
            dlib.resolve_icon_with_provenance(icon, strict=True)
        except KeyError as exc:
            errors.append(f"Node {nid!r}: {exc}")

    # Verify parent references exist and form an acyclic tree
    for item_id, pid in parent_map.items():
        if pid is None:
            continue
        if pid not in group_ids:
            errors.append(f"Item {item_id!r} references unknown parent group {pid!r}")
            continue
        visited = {item_id}
        cur: str | None = pid
        while cur is not None:
            if cur in visited:
                errors.append(f"Cycle detected in parent chain involving {item_id!r}")
                break
            visited.add(cur)
            cur = parent_map.get(cur)

    all_endpoints = node_ids | group_ids
    df_steps = {str(entry.get("step")) for entry in dataflow if isinstance(entry, dict) and entry.get("step") is not None}

    for e in edges:
        eid = e.get("id")
        if not eid:
            errors.append("Edge missing 'id'")
            continue
        if eid in edge_ids:
            errors.append(f"Duplicate edge id: {eid}")
        edge_ids.add(eid)
        src = e.get("source")
        tgt = e.get("target")
        if src not in all_endpoints:
            errors.append(f"Edge {eid!r} source {src!r} does not exist")
        if tgt not in all_endpoints:
            errors.append(f"Edge {eid!r} target {tgt!r} does not exist")
        style = e.get("style", "sync")
        if style not in dlib.AAC_FLOW_STYLES:
            errors.append(f"Edge {eid!r} has invalid style {style!r}")
        step = e.get("step")
        if step is not None and df_steps and str(step) not in df_steps:
            errors.append(f"Edge {eid!r} step {step!r} missing from dataflow[]")

    return errors


def compute_layout(spec: dict[str, Any], *, engine: str = "auto") -> dict[str, Any]:
    """Run `tools/scripts/elk-layout.mjs` to produce canonical absolute layout JSON."""
    proc = subprocess.run(
        ["node", str(ELK_SCRIPT), "--engine", engine],
        input=json.dumps(spec),
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"elk-layout.mjs failed (exit {proc.returncode}): {proc.stderr.strip()}")
    return json.loads(proc.stdout)


def _boxes_overlap(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def _segment_intersects_box(
    p1: tuple[float, float],
    p2: tuple[float, float],
    rect: tuple[float, float, float, float],
) -> bool:
    x1, y1 = p1
    x2, y2 = p2
    rx1, ry1, rx2, ry2 = rect
    # Axis-aligned segment check (orthogonal routing)
    if abs(x1 - x2) < 1e-3:
        lo, hi = min(y1, y2), max(y1, y2)
        return rx1 < x1 < rx2 and hi > ry1 and lo < ry2
    if abs(y1 - y2) < 1e-3:
        lo, hi = min(x1, x2), max(x1, x2)
        return ry1 < y1 < ry2 and hi > rx1 and lo < rx2
    return _boxes_overlap((min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)), rect)


def check_layout_geometry(layout: dict[str, Any]) -> list[str]:
    """Check canonical layout JSON for tile overlaps and unrelated-tile edge crossings."""
    violations: list[str] = []
    node_rects: list[tuple[str, tuple[float, float, float, float]]] = []
    for n in layout.get("nodes", []):
        rect = (
            float(n["absX"]),
            float(n["absY"]),
            float(n["absX"]) + float(n["width"]),
            float(n["absY"]) + float(n["height"]),
        )
        node_rects.append((n["id"], rect))

    for i in range(len(node_rects)):
        id_a, rect_a = node_rects[i]
        for j in range(i + 1, len(node_rects)):
            id_b, rect_b = node_rects[j]
            if _boxes_overlap(rect_a, rect_b):
                violations.append(f"Overlapping tiles: {id_a} and {id_b}")

    for edge in layout.get("edges", []):
        pts = [(float(p[0]), float(p[1])) for p in edge.get("points", [])]
        ignore = {edge.get("source"), edge.get("target")}
        for p1, p2 in zip(pts, pts[1:]):
            for nid, rect in node_rects:
                if nid in ignore:
                    continue
                if _segment_intersects_box(p1, p2, rect):
                    violations.append(f"Edge {edge.get('id')} crosses unrelated tile {nid}")
                    break
    return violations


def render_topology(
    spec_or_path: dict[str, Any] | str | Path,
    out_base: str | Path,
    *,
    formats: Iterable[str] = ("svg", "png"),
    engine: str = "auto",
    strict_geometry: bool = False,
) -> list[Path]:
    """Validate, lay out, and render a semantic topology spec to AAC SVG + PNG."""
    if isinstance(spec_or_path, (str, Path)):
        spec = json.loads(Path(spec_or_path).read_text(encoding="utf-8"))
    else:
        spec = spec_or_path

    errors = validate_topology_spec(spec)
    if errors:
        raise ValueError("Invalid topology spec:\n- " + "\n- ".join(errors))

    layout = compute_layout(spec, engine=engine)
    if strict_geometry:
        geo_errors = check_layout_geometry(layout)
        if geo_errors:
            raise ValueError("Layout geometry violations:\n- " + "\n- ".join(geo_errors))

    dlib.reset()
    # Render parent zones before children so nested containers paint cleanly on top
    for grp in layout.get("groups", []):
        dlib.add(
            dlib.zone(
                grp["absX"],
                grp["absY"],
                grp["width"],
                grp["height"],
                grp["label"],
                kind=grp["kind"],
                zone_id=grp["id"],
                parent_id=grp.get("parentId"),
                subtitle=grp.get("subtitle"),
                icon_key=grp.get("icon"),
            )
        )

    for node in layout.get("nodes", []):
        dlib.add(
            dlib.tile(
                node["cx"],
                node["cy"],
                node["icon"],
                node["label"],
                node_id=node["id"],
                parent_id=node.get("parentId"),
                sublabel=node.get("sublabel"),
            )
        )

    for edge in layout.get("edges", []):
        pts = [(float(p[0]), float(p[1])) for p in edge.get("points", [])]
        if len(pts) >= 2:
            dlib.add(
                dlib.flow(
                    pts,
                    edge_id=edge["id"],
                    source_id=edge.get("source"),
                    target_id=edge.get("target"),
                    step=edge.get("step"),
                    style=edge.get("style", "sync"),
                    label=edge.get("label"),
                    bidirectional=bool(edge.get("bidirectional")),
                )
            )

    df_entries = [(item["step"], item["text"]) for item in layout.get("dataflow", [])]
    if df_entries and layout.get("dataflow_y") is not None:
        dlib.add(
            dlib.dataflow_key(
                40,
                layout["dataflow_y"],
                layout["canvas"]["width"] - 80,
                df_entries,
            )
        )

    return dlib.finish(
        out_base,
        layout["title"],
        footer=layout.get("footer", dlib.DEFAULT_FOOTER),
        formats=formats,
        width=int(layout["canvas"]["width"]),
        height=int(layout["canvas"]["height"]),
        show_title=bool(layout.get("show_title", True)),
        description=layout.get("description", ""),
        style=layout.get("style", "aac"),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path, help="Path to *.topology.json spec")
    parser.add_argument("-o", "--out", type=Path, required=True, help="Output base path (without extension)")
    parser.add_argument("--engine", default="auto", choices=("auto", "elk", "builtin"))
    parser.add_argument("--strict-geometry", action="store_true")
    args = parser.parse_args(argv)
    written = render_topology(args.spec, args.out, engine=args.engine, strict_geometry=args.strict_geometry)
    print(json.dumps({"rendered": [str(p) for p in written]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
