"""diagram_io — single source of truth for diagram output formats.

All Python diagram generators in this repo (matplotlib charts, `diagrams`
library architectures, graphviz process flows) save outputs in BOTH PNG
and SVG via the helpers below. PNG remains the default raster preview;
SVG is the scalable, accessible, diff-reviewable sibling.

Why centralize? Every agent-generated `.py` (`02-waf-scores.py`,
`03-des-cost-distribution.py`, `04-*-diagram.py`, `07-ab-*.py`) used to
re-author its own `plt.savefig(...)` / `Diagram(..., outformat=...)`
boilerplate. Drift was inevitable. With `diagram_io`, the output-format
contract toggles in one place and every call site inherits SVG for free.

This module has zero hard dependencies beyond `pathlib`. matplotlib,
`diagrams`, and graphviz are only touched by call sites that already
import them — `diagram_io` itself stays import-light.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Any

FORMATS: tuple[str, ...] = ("png", "svg")
"""Default output formats every diagram emits.

PNG → backward-compatible raster preview (GitHub markdown, docs site fallback).
SVG → scalable vector, text-selectable, screen-reader friendly, diff-friendly.
"""

DEFAULT_DPI = 150  # matches design tokens in references/python-charts.md


def _strip_known_suffix(base_path: str | Path) -> Path:
    """Return `base_path` with any known FORMATS suffix removed.

    `diagram_io` accepts call sites that pass either `"foo"` or `"foo.png"`
    so the contract is forgiving when refactoring legacy scripts.
    """
    p = Path(base_path)
    if p.suffix.lower().lstrip(".") in FORMATS:
        return p.with_suffix("")
    return p


def save_figure(
    fig: Any,
    base_path: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    dpi: int = DEFAULT_DPI,
    **savefig_kwargs: Any,
) -> list[Path]:
    """Save a matplotlib `Figure` as `<base>.png` + `<base>.svg` siblings.

    `base_path` may include or omit a known extension — it is normalised.
    Extra `savefig_kwargs` (e.g. `bbox_inches="tight"`,
    `facecolor=fig.get_facecolor()`) are forwarded to every format.

    Returns the list of written file paths, in `formats` order.
    """
    base = _strip_known_suffix(base_path)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    for ext in formats:
        out = base.with_suffix(f".{ext}")
        # `dpi` is meaningful for raster output; matplotlib accepts it for
        # SVG too without effect, so pass it uniformly for simplicity.
        fig.savefig(out, dpi=dpi, **savefig_kwargs)
        saved.append(out)
    return saved


def diagram_kwargs(
    filename: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    show: bool = False,
    **overrides: Any,
) -> dict[str, Any]:
    """Return standard kwargs for the `diagrams` library `Diagram(...)` ctor.

    Usage::

        from diagrams import Diagram
        from diagram_io import diagram_kwargs

        with Diagram(**diagram_kwargs("04-architecture-diagram", direction="LR")):
            ...

    The `diagrams` library accepts `outformat` as a list to emit multiple
    formats from a single render. Explicit `overrides` (e.g. `direction`,
    `graph_attr`, `node_attr`) win over the defaults.
    """
    base = str(_strip_known_suffix(filename))
    defaults: dict[str, Any] = {
        "filename": base,
        "outformat": list(formats),
        "show": show,
    }
    defaults.update(overrides)
    return defaults


def render_graphviz(
    dot: Any,
    base_path: str | Path,
    *,
    formats: Iterable[str] = FORMATS,
    cleanup: bool = True,
) -> list[Path]:
    """Render a graphviz `Digraph`/`Graph` once per format in `formats`.

    Graphviz only renders one format per `render()` call, so we set
    `.format` and call `.render()` per format. Returns the written paths.
    """
    base = _strip_known_suffix(base_path)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []
    # graphviz uses `.filename` as the output basename — normalise it so
    # the caller does not need to strip extensions themselves.
    dot.filename = str(base)
    for ext in formats:
        dot.format = ext
        dot.render(cleanup=cleanup)
        saved.append(base.with_suffix(f".{ext}"))
    return saved


__all__ = [
    "FORMATS",
    "DEFAULT_DPI",
    "save_figure",
    "diagram_kwargs",
    "render_graphviz",
]
