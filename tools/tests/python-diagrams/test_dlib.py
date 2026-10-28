"""Unit tests for `dlib` — the 1920x1080 SVG + 3840x2160 4K PNG Azure architecture diagram library."""

from __future__ import annotations

import importlib.util
import socket
import sys
from pathlib import Path
from types import ModuleType
from xml.etree import ElementTree

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_DIR = REPO_ROOT / ".github" / "skills" / "apex-python-diagrams" / "scripts"


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*args: object, **kwargs: object) -> None:
        raise AssertionError("dlib tests must not access the network")

    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)


@pytest.fixture(scope="module")
def dlib() -> ModuleType:
    spec = importlib.util.spec_from_file_location("dlib", SCRIPTS_DIR / "dlib.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["dlib"] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def diagram_io() -> ModuleType:
    spec = importlib.util.spec_from_file_location("diagram_io", SCRIPTS_DIR / "diagram_io.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["diagram_io"] = module
    spec.loader.exec_module(module)
    return module


def test_all_curated_icon_keys_resolve_offline(dlib: ModuleType) -> None:
    assert len(dlib.P) >= 70
    for key in list(dlib.P.keys()) + ["gh"]:
        path = dlib.resolve_icon_path(key)
        assert path.exists() and path.stat().st_size > 0, f"Missing SVG for key {key}: {path}"


def test_v23_catalog_dynamic_lookup_and_unknown_key(dlib: ModuleType) -> None:
    svg_count = len(list(dlib.BASE.rglob("*.svg")))
    assert svg_count >= 700, f"Expected full v23 icon pack (>=700 SVGs), found {svg_count}"

    # Lookup by v23 service slug not explicitly in P
    iot_hub = dlib.resolve_icon_path("iot-hub")
    assert iot_hub.exists() and "IoT-Hub" in iot_hub.name

    with pytest.raises(KeyError):
        dlib.resolve_icon_path("nonexistent-icon-xyz-999")


def test_symbols_namespaces_internal_gradient_ids(dlib: ModuleType) -> None:
    sym_xml = dlib.symbols(["app", "fw", "kv", "gh"])
    wrapped = f'<svg xmlns="http://www.w3.org/2000/svg"><defs>{sym_xml}</defs></svg>'
    root = ElementTree.fromstring(wrapped)
    symbol_ids = {el.get("id") for el in root.iter("{http://www.w3.org/2000/svg}symbol")}
    assert symbol_ids == {"ic-app", "ic-fw", "ic-kv", "ic-gh"}

    # Every internal id inside ic-app must be prefixed with "app-"
    app_sym = next(el for el in root.iter("{http://www.w3.org/2000/svg}symbol") if el.get("id") == "ic-app")
    for child in app_sym.iter():
        if child is app_sym:
            continue
        cid = child.get("id")
        if cid is not None:
            assert cid.startswith("app-"), f"Unprefixed internal SVG id in ic-app: {cid}"


def test_text_overflow_warning_emitted(dlib: ModuleType, capsys: pytest.CaptureFixture[str]) -> None:
    dlib.t(10, 20, "Short", 16, mw=200)
    assert capsys.readouterr().out == ""

    dlib.t(10, 20, "This label is deliberately much wider than forty pixels", 20, "700", mw=40)
    out = capsys.readouterr().out
    assert "WARN overflow:" in out


def test_default_footer_is_apex_and_renders_4k_png_and_svg(dlib: ModuleType, tmp_path: Path) -> None:
    pytest.importorskip("cairosvg")
    from PIL import Image

    dlib.reset()
    dlib.add(dlib.sub(30, 95, 880, 400, "Shared platform subscription", dlib.BL, "#F5FAFF", "SHARED", 150))
    dlib.add(dlib.rg(55, 150, 830, 320, "rg-hub", dlib.BL))
    dlib.add(
        dlib.card(
            85,
            210,
            360,
            80,
            "fw",
            [("afw-hub", 1), ("Azure Firewall Standard", 0)],
            dlib.BLF,
            dlib.BL,
        )
    )
    dlib.add(dlib.arr("M445 250H600", "net") + dlib.circ(520, 250, "A", dlib.BL))
    dlib.add(dlib.chip(520, 215, 160, "Inspected traffic", dlib.BL))
    dlib.add(dlib.chip2(520, 300, 180, "Line one", "Line two", dlib.BL))
    dlib.add(dlib.folder(620, 235) + dlib.gh(680, 230))

    base = tmp_path / "04-runtime-diagram"
    written = dlib.finish(base, "Hub Firewall Routing")

    svg_path = base.with_suffix(".svg")
    png_path = base.with_suffix(".png")
    assert svg_path in written and png_path in written
    assert svg_path.exists() and png_path.exists()

    svg_text = svg_path.read_text(encoding="utf-8")
    assert 'viewBox="0 0 1920 1080"' in svg_text
    assert 'width="3840" height="2160"' in svg_text
    assert ">APEX</text>" in svg_text
    assert "Partner Modernization Factory" not in svg_text

    with Image.open(png_path) as img:
        assert img.size == (3840, 2160)


def test_render_dlib_via_diagram_io(dlib: ModuleType, diagram_io: ModuleType, tmp_path: Path) -> None:
    pytest.importorskip("cairosvg")
    dlib.reset()
    dlib.add(dlib.card(100, 150, 300, 70, "aks", [("aks-prod-01", 1)], dlib.TLF, dlib.TL))

    base = tmp_path / "03-des-diagram.png"
    written = diagram_io.render_dlib(base, "AKS Topology", footer="APEX Custom Footer")
    assert {p.suffix for p in written} == {".svg", ".png"}
    assert "APEX Custom Footer" in (tmp_path / "03-des-diagram.svg").read_text(encoding="utf-8")
