"""Offline regressions for the diagram generators and their public models."""

from __future__ import annotations

import ast
import importlib.util
import socket
import sys
from pathlib import Path
from types import ModuleType
from xml.etree import ElementTree

import pytest

SCRIPTS = Path(__file__).resolve().parents[3] / ".github/skills/apex-python-diagrams/scripts"


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def blocked(*args: object, **kwargs: object) -> None:
        raise AssertionError("Diagram tests must not access the network")

    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)


@pytest.fixture
def generator(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.syspath_prepend(str(SCRIPTS))
    spec = importlib.util.spec_from_file_location("generate_diagram", SCRIPTS / "generate_diagram.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("path_object", [False, True])
@pytest.mark.parametrize(
    "pattern",
    [
        "api-led",
        "hybrid",
        "event-driven",
        "microservices",
        "b2b-edi",
        "data-pipeline",
        "secure-private",
        "multi-region",
        "iot-streaming",
    ],
)
@pytest.mark.parametrize(
    "text",
    [
        "Ordinary title",
        "Customer \"Integration\" and 'Data'",
        "First line\nSecond line",
        r"backslash\nremains literal",
        '", marker=UNTRUSTED_SENTINEL, ignored="',
    ],
)
def test_generated_inputs_are_only_literals(
    generator: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    pattern: str,
    text: str,
    path_object: bool,
) -> None:
    output = str(tmp_path / text)
    captured = []

    def inspect_source(source: str) -> None:
        tree = ast.parse(source)
        compile(tree, "<diagram regression>", "exec")
        calls = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "Diagram"
        ]
        assert len(calls) == 1
        call = calls[0]
        assert ast.literal_eval(call.args[0]) == text
        keywords = {keyword.arg: keyword.value for keyword in call.keywords}
        assert ast.literal_eval(keywords["filename"]) == output
        assert ast.literal_eval(keywords["show"]) is False
        assert ast.literal_eval(keywords["outformat"]) == ["png", "svg"]
        captured.append(source)

    monkeypatch.setattr(generator, "exec", inspect_source, raising=False)
    generator.generate_diagram(text, pattern, Path(output) if path_object else output)
    assert len(captured) == 1
    assert not list(tmp_path.iterdir())


@pytest.fixture
def multi(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
    monkeypatch.syspath_prepend(str(SCRIPTS))
    spec = importlib.util.spec_from_file_location("multi_diagram_generator", SCRIPTS / "multi_diagram_generator.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def graphs(multi: ModuleType, monkeypatch: pytest.MonkeyPatch) -> list:
    captured = []
    monkeypatch.setattr(multi, "render_graphviz", lambda dot, filename: captured.append(dot))
    return captured


@pytest.mark.parametrize(
    "custom",
    [
        [],
        [
            {"name": "Invoices", "columns": [("Id", "INT", "PK")]},
            {"name": "Clients", "columns": [("Id", "INT", "PK")]},
            {"name": "Items", "columns": [("Id", "INT", "PK")]},
        ],
    ],
)
def test_custom_erd_has_no_sample_edges(multi: ModuleType, graphs: list, custom: list) -> None:
    assert multi.create_erd("Custom", "unused", custom) == "unused.png"
    assert "->" not in graphs[0].source
    assert "Documents" not in graphs[0].source


@pytest.mark.parametrize(
    "custom",
    [
        [],
        [
            {"name": "Caller", "color": "white", "steps": [{"id": "request", "label": "Request"}]},
        ],
    ],
)
def test_custom_swimlane_has_no_sample_edges(multi: ModuleType, graphs: list, custom: list) -> None:
    assert multi.create_swimlane_flow("Custom", "unused", custom) == "unused.png"
    assert "->" not in graphs[0].source
    assert "u1" not in graphs[0].source


def test_default_models_keep_sample_edges(multi: ModuleType, graphs: list) -> None:
    multi.create_erd("Default", "unused")
    multi.create_swimlane_flow("Default", "unused")
    assert "Documents -> Accounts" in graphs[0].source
    assert "Documents -> Users" in graphs[0].source
    assert graphs[0].source.count("->") == 2
    assert graphs[1].source.count("->") == 4
    assert "u1 -> s1" in graphs[1].source
    assert "s3 -> u2" in graphs[1].source


@pytest.mark.parametrize("layout", ["dashboard", "list", "detail"])
def test_wireframe_svg_fallback(
    multi: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    layout: str,
) -> None:
    monkeypatch.setitem(sys.modules, "cairosvg", None)
    title = 'Review "A&B" <draft>\nNext line'
    base = tmp_path / layout
    assert multi.create_wireframe_svg(title, str(base), layout) == f"{base}.svg"
    root = ElementTree.parse(f"{base}.svg").getroot()
    header = root.find("{http://www.w3.org/2000/svg}text")
    assert header is not None and header.text == title
    style = root.find("{http://www.w3.org/2000/svg}style")
    assert style is not None
    assert style.text == (
        "\n        .title { font: bold 14px sans-serif; fill: white; }"
        "\n        .label { font: 11px sans-serif; fill: #333; }"
        "\n        .small { font: 9px sans-serif; fill: #666; }\n    "
    )
    assert not base.with_suffix(".png").exists()


def test_custom_relationships(multi: ModuleType, graphs: list) -> None:
    tables = [{"name": name, "columns": [("Id", "INT", "PK")]} for name in ("Invoices", "Clients")]
    multi.create_erd("Custom", "unused", tables, relationships=[("Invoices", "Clients")])
    assert "Invoices -> Clients" in graphs[0].source
    assert graphs[0].source.count("->") == 1
    multi.create_swimlane_flow(
        "Custom",
        "unused",
        [
            {
                "name": "Caller",
                "color": "white",
                "steps": [
                    {"id": "request", "label": "Request", "next": [("store", "Accepted")]},
                ],
            },
            {"name": "System", "color": "white", "steps": [{"id": "store", "label": "Store"}]},
        ],
    )
    assert "request -> store [label=Accepted]" in graphs[1].source
    assert graphs[1].source.count("->") == 1


def test_unknown_relationships_fail_before_rendering(multi: ModuleType, graphs: list) -> None:
    with pytest.raises(ValueError):
        multi.create_erd("Custom", "unused", [], relationships=[("Missing", "Other")])
    with pytest.raises(ValueError):
        multi.create_swimlane_flow(
            "Custom",
            "unused",
            [
                {
                    "name": "Caller",
                    "color": "white",
                    "steps": [
                        {"id": "request", "label": "Request", "next": [("missing", None)]},
                    ],
                },
            ],
        )
    assert not graphs


def test_default_erd_allows_explicit_no_relationships(multi: ModuleType, graphs: list) -> None:
    multi.create_erd("Default", "unused", relationships=[])
    assert "Documents" in graphs[0].source
    assert "->" not in graphs[0].source


@pytest.mark.parametrize("layout", ["dashboard", "list", "detail"])
def test_wireframe_png_and_svg(multi: ModuleType, tmp_path: Path, layout: str) -> None:
    pytest.importorskip("cairosvg", reason="Optional CairoSVG renderer is not installed")
    from PIL import Image

    base = tmp_path / "nested" / layout
    assert multi.create_wireframe_svg('Review "A&B" <draft>', str(base), layout) == f"{base}.png"
    ElementTree.parse(f"{base}.svg")
    with Image.open(f"{base}.png") as image:
        assert image.format == "PNG"
        assert image.size == (1600, 1200)
        assert image.convert("RGB").getextrema() != ((255, 255),) * 3


@pytest.mark.parametrize("layout", ["dashboard", "list", "detail"])
def test_wireframe_png_conversion_contract(
    multi: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    layout: str,
) -> None:
    calls = []
    converter = ModuleType("cairosvg")
    monkeypatch.setattr(converter, "svg2png", lambda **kwargs: calls.append(kwargs), raising=False)
    monkeypatch.setitem(sys.modules, "cairosvg", converter)
    base = tmp_path / layout
    assert multi.create_wireframe_svg("A&B", str(base), layout) == f"{base}.png"
    assert calls == [{"bytestring": base.with_suffix(".svg").read_bytes(), "write_to": f"{base}.png", "scale": 2}]
    ElementTree.fromstring(calls[0]["bytestring"])


@pytest.mark.parametrize("error", [RuntimeError("conversion failed"), ImportError("converter dependency failed")])
def test_wireframe_conversion_errors_propagate(
    multi: ModuleType,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    error: Exception,
) -> None:
    converter = ModuleType("cairosvg")

    def fail(**kwargs: object) -> None:
        raise error

    monkeypatch.setattr(converter, "svg2png", fail, raising=False)
    monkeypatch.setitem(sys.modules, "cairosvg", converter)
    base = tmp_path / "wireframe"
    with pytest.raises(type(error)):
        multi.create_wireframe_svg("Title", str(base))
    ElementTree.parse(f"{base}.svg")
    assert not base.with_suffix(".png").exists()


@pytest.mark.parametrize(
    "pattern",
    [
        "api-led",
        "hybrid",
        "event-driven",
        "microservices",
        "b2b-edi",
        "data-pipeline",
        "secure-private",
        "multi-region",
        "iot-streaming",
    ],
)
def test_architecture_patterns_render(generator: ModuleType, tmp_path: Path, pattern: str) -> None:
    output = tmp_path / 'quoted "diagram"\nname'
    assert generator.generate_diagram('Customer "Integration"\nArchitecture', pattern, str(output)) is None
    assert Path(f"{output}.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    ElementTree.parse(f"{output}.svg")


@pytest.mark.parametrize(
    "function",
    [
        "create_process_flow",
        "create_swimlane_flow",
        "create_erd",
        "create_access_matrix",
        "create_gantt_chart",
        "create_phase_timeline",
    ],
)
def test_multi_defaults_render(multi: ModuleType, tmp_path: Path, function: str) -> None:
    import matplotlib

    matplotlib.use("Agg")
    base = str(tmp_path / function)
    assert getattr(multi, function)("Default model", base) == f"{base}.png"
    assert Path(f"{base}.png").read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    ElementTree.parse(f"{base}.svg")


def test_custom_erd_labels_render(multi: ModuleType, tmp_path: Path) -> None:
    base = str(tmp_path / "custom")
    multi.create_erd(
        "Custom",
        base,
        [
            {"name": "A&B", "columns": [('Id "Key"', "List<int>", "PK")]},
            {"name": "Clients", "columns": [("Id", "INT", "FK")]},
        ],
        relationships=[("A&B", "Clients")],
    )
    root = ElementTree.parse(f"{base}.svg").getroot()
    texts = [element.text for element in root.iter("{http://www.w3.org/2000/svg}text")]
    assert "A&B" in texts
    assert "List<int>" in texts
