"""Unit and integration tests for semantic topology layout (`elk-layout.mjs`) and `topology_render.py`."""

from __future__ import annotations

import importlib.util
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / ".github" / "skills" / "apex-python-diagrams" / "scripts"
VALIDATOR_PATH = REPO_ROOT / "tools" / "scripts" / "validate-diagrams.py"


def _load(name: str, path: Path) -> ModuleType:
    mod = sys.modules.get(name)
    if mod is not None:
        return mod
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def topology_render() -> ModuleType:
    return _load("topology_render", SCRIPTS_DIR / "topology_render.py")


@pytest.fixture(scope="module")
def diagram_io() -> ModuleType:
    return _load("diagram_io", SCRIPTS_DIR / "diagram_io.py")


@pytest.fixture(scope="module")
def validate_diagrams() -> ModuleType:
    return _load("validate_diagrams", VALIDATOR_PATH)


def _sample_spec() -> dict:
    return {
        "title": "Hub-Spoke Private Telemetry Topology",
        "description": "Nested hub/spoke VNets routing telemetry via AMPLS and DCR to Log Analytics.",
        "style": "aac",
        "direction": "RIGHT",
        "groups": [
            {"id": "reg-swc", "label": "Sweden Central", "kind": "region"},
            {"id": "vnet-hub", "label": "Hub VNet", "kind": "vnet", "parent": "reg-swc", "subtitle": "10.0.0.0/16"},
            {"id": "vnet-spoke", "label": "Spoke VNet", "kind": "vnet", "parent": "reg-swc", "subtitle": "10.1.0.0/16"},
            {"id": "sub-mgmt", "label": "Management Sub", "kind": "sub", "parent": "reg-swc"},
        ],
        "nodes": [
            {"id": "app", "icon": "app", "label": "App Service", "parent": "vnet-spoke"},
            {"id": "ampls", "icon": "privatelink", "label": "AMPLS Endpoint", "parent": "vnet-hub"},
            {"id": "dcr", "icon": "dcr", "label": "Data Collection Rules", "parent": "sub-mgmt"},
            {"id": "law", "icon": "law", "label": "Log Analytics", "parent": "sub-mgmt"},
        ],
        "edges": [
            {"id": "e1", "source": "app", "target": "ampls", "step": 1, "style": "private"},
            {"id": "e2", "source": "ampls", "target": "dcr", "step": 2, "style": "tel"},
            {"id": "e3", "source": "dcr", "target": "law", "step": 3, "style": "tel"},
        ],
        "dataflow": [
            {"step": 1, "text": "App Service emits OpenTelemetry privately to AMPLS."},
            {"step": 2, "text": "AMPLS forwards telemetry to Data Collection Rules."},
            {"step": 3, "text": "DCR routes operational logs into Log Analytics."},
        ],
    }


def test_validate_topology_spec_catches_semantic_errors(topology_render: ModuleType) -> None:
    bad = {
        "title": "Broken Spec",
        "groups": [
            {"id": "g1", "label": "G1", "kind": "vnet", "parent": "g2"},
            {"id": "g2", "label": "G2", "kind": "vnet", "parent": "g1"},
        ],
        "nodes": [
            {"id": "n1", "icon": "nonexistent-icon-xyz", "label": "Bad Icon", "parent": "g1"},
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "missing-node", "step": 99},
        ],
        "dataflow": [{"step": 1, "text": "Only step 1"}],
    }
    errors = topology_render.validate_topology_spec(bad)
    joined = "\n".join(errors)
    assert "Cycle detected" in joined
    assert "Unknown Azure icon key" in joined
    assert "does not exist" in joined
    assert "missing from dataflow[]" in joined


def test_elk_layout_produces_canonical_absolute_coordinates(topology_render: ModuleType) -> None:
    layout = topology_render.compute_layout(_sample_spec(), engine="builtin")
    assert layout["engine"] == "builtin-layered"
    groups = {g["id"]: g for g in layout["groups"]}
    nodes = {n["id"]: n for n in layout["nodes"]}

    # Child groups and nodes must sit inside their parent group's absolute bounds
    reg = groups["reg-swc"]
    hub = groups["vnet-hub"]
    assert hub["absX"] >= reg["absX"] and hub["absY"] >= reg["absY"]
    assert hub["absX"] + hub["width"] <= reg["absX"] + reg["width"] + 0.5

    ampls = nodes["ampls"]
    assert ampls["absX"] >= hub["absX"] and ampls["absY"] >= hub["absY"]
    assert ampls["absX"] + ampls["width"] <= hub["absX"] + hub["width"] + 0.5

    # Cross-container edges must have at least 2 absolute points and zero geometry violations
    assert len(layout["edges"]) == 3
    assert all(len(e["points"]) >= 2 for e in layout["edges"])
    assert topology_render.check_layout_geometry(layout) == []


def test_render_topology_via_diagram_io_passes_validator(
    diagram_io: ModuleType,
    validate_diagrams: ModuleType,
    tmp_path: Path,
) -> None:
    pytest.importorskip("cairosvg")
    out_base = tmp_path / "04-runtime-diagram"
    written = diagram_io.render_topology(_sample_spec(), out_base, strict_geometry=True)
    assert {p.suffix for p in written} == {".svg", ".png"}

    svg_path = out_base.with_suffix(".svg")
    root = ET.parse(svg_path).getroot()
    assert root.attrib["data-apex-diagram"] == "true"
    assert root.attrib["data-apex-style"] == "aac"
    assert root.attrib["role"] == "img"

    errors = validate_diagrams.validate_aac_svg(svg_path, require_png=True, strict_aac=True)
    assert errors == []
