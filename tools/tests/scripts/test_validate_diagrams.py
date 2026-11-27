"""Unit tests for `tools/scripts/validate-diagrams.py`."""

from __future__ import annotations

import importlib.util
import sys
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
def dlib() -> ModuleType:
    return _load("dlib", SCRIPTS_DIR / "dlib.py")


@pytest.fixture(scope="module")
def validator() -> ModuleType:
    return _load("validate_diagrams", VALIDATOR_PATH)


def test_clean_aac_svg_passes_without_errors(dlib: ModuleType, validator: ModuleType, tmp_path: Path) -> None:
    dlib.reset()
    dlib.add(dlib.zone(40, 80, 700, 320, "Hub VNet", kind="vnet", zone_id="hub"))
    dlib.add(dlib.tile(180, 220, "fw", "Firewall", node_id="fw", parent_id="hub"))
    dlib.add(dlib.tile(520, 220, "law", "Log Analytics", node_id="law", parent_id="hub"))
    dlib.add(dlib.flow([(240, 220), (460, 220)], edge_id="e1", source_id="fw", target_id="law", step=1))

    svg_path = tmp_path / "clean.svg"
    svg_path.write_text(dlib.build_svg("Clean AAC", style="aac"), encoding="utf-8")
    assert validator.validate_aac_svg(svg_path, require_png=False, strict_aac=True) == []


def test_detects_overlapping_tiles(dlib: ModuleType, validator: ModuleType, tmp_path: Path) -> None:
    dlib.reset()
    dlib.add(dlib.tile(200, 200, "fw", "Firewall", node_id="fw"))
    dlib.add(dlib.tile(220, 200, "law", "Log Analytics", node_id="law"))

    svg_path = tmp_path / "overlap.svg"
    svg_path.write_text(dlib.build_svg("Overlap", style="aac"), encoding="utf-8")
    errors = validator.validate_aac_svg(svg_path, require_png=False, strict_aac=True)
    assert any("overlapping tiles" in e for e in errors)


def test_detects_unrelated_tile_crossing_but_exempts_endpoints_and_zones(
    dlib: ModuleType, validator: ModuleType, tmp_path: Path
) -> None:
    dlib.reset()
    dlib.add(dlib.zone(40, 80, 900, 340, "Region", kind="region", zone_id="reg"))
    dlib.add(dlib.tile(160, 220, "app", "App Service", node_id="app", parent_id="reg"))
    dlib.add(dlib.tile(440, 220, "fw", "Middle Firewall", node_id="mid", parent_id="reg"))
    dlib.add(dlib.tile(740, 220, "law", "Log Analytics", node_id="law", parent_id="reg"))
    # Straight line from app -> law crosses unrelated tile 'mid'
    dlib.add(dlib.flow([(210, 220), (690, 220)], edge_id="bad-edge", source_id="app", target_id="law", step=1))

    svg_path = tmp_path / "cross.svg"
    svg_path.write_text(dlib.build_svg("Cross", style="aac"), encoding="utf-8")
    errors = validator.validate_aac_svg(svg_path, require_png=False, strict_aac=True)
    assert any("crosses unrelated tile 'mid'" in e for e in errors)


def test_rejects_fallback_icon_and_missing_a11y(validator: ModuleType, tmp_path: Path) -> None:
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" data-apex-diagram="true" data-apex-style="aac">'
        '<g data-apex-role="tile" data-node-id="t1" data-bbox="10,10,80,80" data-icon-match="fallback"/>'
        "</svg>"
    )
    svg_path = tmp_path / "bad_meta.svg"
    svg_path.write_text(svg, encoding="utf-8")
    errors = validator.validate_aac_svg(svg_path, require_png=False, strict_aac=True)
    joined = "\n".join(errors)
    assert 'role="img"' in joined
    assert "<title>" in joined
    assert "<desc>" in joined
    assert "expected 'exact'" in joined


def test_vendored_icon_assets_are_excluded(validator: ModuleType, tmp_path: Path) -> None:
    icon_dir = tmp_path / "assets" / "az" / "compute"
    icon_dir.mkdir(parents=True)
    icon_svg = icon_dir / "10021-icon-service-Virtual-Machine.svg"
    icon_svg.write_text('<svg xmlns="http://www.w3.org/2000/svg"/>', encoding="utf-8")
    # Must be skipped cleanly even with require_png=True and strict_aac=True
    assert validator.validate_aac_svg(icon_svg, require_png=True, strict_aac=True) == []
