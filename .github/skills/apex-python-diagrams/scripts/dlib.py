"""dlib — Programmable 1920x1080 SVG + 3840x2160 4K PNG Azure architecture diagram library.

Authors brand-consistent Azure architecture diagrams as editable SVG masters
(with official Microsoft Azure Public Service Icons v23 embedded as vector
`<symbol>` definitions) and renders 3840x2160 4K PNG siblings.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterable
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
ICONS_ROOT = SKILL_ROOT / "assets"
BASE = ICONS_ROOT / "az"

# Curated short keys mapping to official Azure Public Service Icons v23 relative paths.
P: dict[str, str] = {
    # Management & Governance / Hierarchy
    "ten": "identity/02679-icon-service-Tenant-Properties.svg",
    "mg": "general/10011-icon-service-Management-Groups.svg",
    "sub": "general/10002-icon-service-Subscriptions.svg",
    "rg": "general/10007-icon-service-Resource-Groups.svg",
    "pol": "management + governance/10316-icon-service-Policy.svg",
    "bud": "general/10793-icon-service-Cost-Budgets.svg",
    "arc": "management + governance/00756-icon-service-Azure-Arc.svg",
    "rsv": "management + governance/00017-icon-service-Recovery-Services-Vaults.svg",
    "bvault": "other/02361-icon-service-Backup-Vault.svg",
    # Networking & Edge
    "vnet": "networking/10061-icon-service-Virtual-Networks.svg",
    "subnet": "networking/02742-icon-service-Subnet.svg",
    "fw": "networking/10084-icon-service-Firewalls.svg",
    "fwp": "networking/00272-icon-service-Azure-Firewall-Policy.svg",
    "waf": "networking/10362-icon-service-Web-Application-Firewall-Policies(WAF).svg",
    "dns": "networking/10064-icon-service-DNS-Zones.svg",
    "bas": "networking/02422-icon-service-Bastions.svg",
    "nat": "networking/10310-icon-service-NAT.svg",
    "peer": "other/01285-icon-service-Peerings.svg",
    "rt": "networking/10082-icon-service-Route-Tables.svg",
    "pe": "other/02579-icon-service-Private-Endpoints.svg",
    "pip": "networking/10069-icon-service-Public-IP-Addresses.svg",
    "nsg": "networking/10067-icon-service-Network-Security-Groups.svg",
    "afd": "networking/10073-icon-service-Front-Door-and-CDN-Profiles.svg",
    "agw": "networking/10076-icon-service-Application-Gateways.svg",
    "lb": "networking/10062-icon-service-Load-Balancers.svg",
    "vpngw": "networking/10063-icon-service-Virtual-Network-Gateways.svg",
    "er": "networking/10079-icon-service-ExpressRoute-Circuits.svg",
    # Compute, Containers & Web
    "vm": "compute/10021-icon-service-Virtual-Machine.svg",
    "disk": "compute/10032-icon-service-Disks.svg",
    "app": "web/10035-icon-service-App-Services.svg",
    "asp": "app services/00046-icon-service-App-Service-Plans.svg",
    "func": "compute/10029-icon-service-Function-Apps.svg",
    "swa": "web/01007-icon-service-Static-Apps.svg",
    "aks": "containers/10023-icon-service-Kubernetes-Services.svg",
    "acr": "containers/10105-icon-service-Container-Registries.svg",
    "aci": "containers/10104-icon-service-Container-Instances.svg",
    "aca": "other/02989-icon-service-Container-Apps-Environments.svg",
    "signalr": "web/10052-icon-service-SignalR.svg",
    # Databases & Caching
    "sqlmi": "databases/10136-icon-service-SQL-Managed-Instance.svg",
    "sqls": "databases/10132-icon-service-SQL-Server.svg",
    "sqldb": "databases/10130-icon-service-SQL-Database.svg",
    "arcsql": "other/01850-icon-service-Arc-SQL-Server.svg",
    "cosmos": "databases/10121-icon-service-Azure-Cosmos-DB.svg",
    "postgres": "databases/10131-icon-service-Azure-Database-PostgreSQL-Server.svg",
    "mysql": "databases/10122-icon-service-Azure-Database-MySQL-Server.svg",
    "redis": "databases/10137-icon-service-Cache-Redis.svg",
    # Storage
    "blob": "storage/10086-icon-service-Storage-Accounts.svg",
    "st": "storage/10086-icon-service-Storage-Accounts.svg",
    "cont": "general/10839-icon-service-Storage-Container.svg",
    "queue": "general/10840-icon-service-Storage-Queue.svg",
    # Integration & Messaging
    "apim": "integration/10042-icon-service-API-Management-Services.svg",
    "sb": "integration/10836-icon-service-Azure-Service-Bus.svg",
    "evg": "integration/10206-icon-service-Event-Grid-Topics.svg",
    "evh": "analytics/00039-icon-service-Event-Hubs.svg",
    "logic": "integration/02631-icon-service-Logic-Apps.svg",
    "adf": "analytics/10126-icon-service-Data-Factories.svg",
    "databricks": "analytics/10787-icon-service-Azure-Databricks.svg",
    # Security & Identity
    "kv": "security/10245-icon-service-Key-Vaults.svg",
    "mi": "identity/10227-icon-service-Managed-Identities.svg",
    "user": "identity/10230-icon-service-Users.svg",
    "entra": "identity/10340-icon-service-Entra-Identity-Roles-and-Administrators.svg",
    "appreg": "identity/10232-icon-service-App-Registrations.svg",
    "entapp": "identity/10225-icon-service-Enterprise-Applications.svg",
    # Monitoring & Observability
    "mon": "monitor/00001-icon-service-Monitor.svg",
    "law": "monitor/00009-icon-service-Log-Analytics-Workspaces.svg",
    "ai": "monitor/00012-icon-service-Application-Insights.svg",
    # AI & Machine Learning
    "openai": "ai + machine learning/03438-icon-service-Azure-OpenAI.svg",
    "foundry": "ai + machine learning/03513-icon-service-AI-Studio.svg",
    "search": "ai + machine learning/10044-icon-service-Cognitive-Search.svg",
    "cog": "ai + machine learning/10162-icon-service-Cognitive-Services.svg",
    "ml": "ai + machine learning/10166-icon-service-Machine-Learning.svg",
    # Developer & Tooling
    "code": "general/10787-icon-service-Code.svg",
    "cli": "other/00559-icon-service-Azure-Cloud-Shell.svg",
    "dev": "other/03250-icon-service-Microsoft-Dev-Box.svg",
}

# Semantic colour palette
NAVY = "#0B1F3A"
GR = "#3A4A5A"
BL = "#0078D4"
TL = "#008272"
AM = "#D18B00"
AMB = "#F2A900"
PU = "#7B3FA0"
SL = "#5B6B7B"

BLF = "#E6F1FB"
TLF = "#E3F4F1"
AMF = "#FFF6DD"
GRF = "#EEF2F6"
PUF = "#F3ECF8"

KIND: dict[str, str] = {
    "net": BL,
    "id": PU,
    "dns": TL,
    "tel": SL,
    "mig": AM,
    "off": "#8A98A8",
}

DEFAULT_FOOTER = "APEX"

o: list[str] = []
_v23_index: dict[str, Path] | None = None


def _safe_key(k: str) -> str:
    """Return an XML-safe symbol key for `<symbol id="ic-...">`."""
    return re.sub(r"[^A-Za-z0-9_-]+", "_", k).strip("_") or "icon"


def _build_v23_index() -> dict[str, Path]:
    """Build a case-insensitive lookup index across all 705 v23 SVG icons."""
    global _v23_index
    if _v23_index is not None:
        return _v23_index
    index: dict[str, Path] = {}
    if BASE.exists():
        for svg_path in sorted(BASE.rglob("*.svg")):
            rel = svg_path.relative_to(BASE).as_posix().lower()
            index[rel] = svg_path
            stem = svg_path.stem.lower()
            index.setdefault(stem, svg_path)
            # Strip leading `<id>-icon-service-` prefix for friendly service-name lookup
            cleaned = re.sub(r"^\d+-icon-service-", "", stem).strip()
            index.setdefault(cleaned, svg_path)
            index.setdefault(cleaned.replace("-", "_"), svg_path)
    _v23_index = index
    return index


def resolve_icon_path(k: str) -> Path:
    """Resolve an icon key `k` to its SVG file path on disk."""
    if k == "gh":
        gh_path = ICONS_ROOT / "github.svg"
        if gh_path.exists():
            return gh_path
        raise KeyError(f"GitHub icon not found at {gh_path}")
    if k in P:
        rel_parts = P[k].replace("\\", "/").split("/")
        candidate = BASE.joinpath(*rel_parts)
        if candidate.exists():
            return candidate
    idx = _build_v23_index()
    norm = k.replace("\\", "/").lower().removesuffix(".svg")
    for candidate_key in (norm, f"{norm}.svg", norm.replace("_", "-")):
        if candidate_key in idx:
            return idx[candidate_key]
    # Substring fallback on cleaned service name
    for idx_key, svg_path in idx.items():
        if norm in idx_key:
            return svg_path
    raise KeyError(f"Unknown Azure icon key: {k!r}")


def reset() -> None:
    """Clear the accumulated SVG element buffer."""
    o.clear()


def add(s: str) -> None:
    """Append an SVG fragment to the canvas buffer."""
    o.append(s)


def est(s: str, size: float, bold: bool = False) -> float:
    """Estimate rendered pixel width of text `s` at `size` px."""
    clean = re.sub(r"<[^>]+>", "", s).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return len(clean) * size * (0.56 if bold else 0.52)


def ic(k: str, x: float, y: float, s: float = 36) -> str:
    """Place icon `k` at `(x, y)` with width/height `s`."""
    sk = _safe_key(k)
    if sk != k and sk not in P:
        # Register alias so `symbols()` can resolve the original key
        P[sk] = P.get(k, k)
    return f'<use href="#ic-{sk}" x="{x}" y="{y}" width="{s}" height="{s}"/>'


def box(
    x: float,
    y: float,
    w: float,
    h: float,
    fill: str,
    stroke: str,
    ext: str = "",
    sw: float = 2,
    rx: float = 8,
) -> str:
    """Draw a rounded rectangle."""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {ext}/>'


def t(
    x: float,
    y: float,
    s: str,
    size: float = 20,
    w: str = "400",
    fill: str = NAVY,
    anchor: str = "start",
    mw: float | None = None,
) -> str:
    """Draw a `<text>` element and emit a `WARN overflow:` hint if estimated width exceeds `mw`."""
    if mw and est(s, size, w == "700") > mw:
        print("WARN overflow:", s[:50], round(est(s, size, w == "700")), ">", mw)
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}">{s}</text>'


def rg(
    x: float,
    y: float,
    w: float,
    h: float,
    name: str,
    col: str,
    lx: float = 0,
    k: str = "rg",
) -> str:
    """Draw a dashed Resource Group boundary box with header icon and label."""
    return (
        box(x, y, w, h, "#FFFFFF", col, 'stroke-dasharray="7 4"', 1.8)
        + ic(k, x + 14 + lx, y + 8, 32)
        + t(x + 56 + lx, y + 32, name, 20, "700", col)
    )


def chip(
    cx: float,
    cy: float,
    w: float,
    s: str,
    stroke: str,
    fill: str = "#FFFFFF",
    size: float = 15,
    col: str = NAVY,
    h: float = 26,
) -> str:
    """Draw a single-line pill/chip centered at `(cx, cy)`."""
    return box(cx - w / 2, cy - h / 2, w, h, fill, stroke, sw=1.5, rx=6) + t(
        cx, cy + size * 0.35, s, size, "700", col, "middle", mw=w - 8
    )


def chip2(
    cx: float,
    cy: float,
    w: float,
    l1: str,
    l2: str,
    stroke: str,
    fill: str = "#FFFFFF",
    size: float = 14,
) -> str:
    """Draw a two-line pill/chip centered at `(cx, cy)`."""
    return (
        box(cx - w / 2, cy - 20, w, 40, fill, stroke, sw=1.5, rx=6)
        + t(cx, cy - 3, l1, size, "700", NAVY, "middle", mw=w - 8)
        + t(cx, cy + 15, l2, size, "700", NAVY, "middle", mw=w - 8)
    )


def card(
    x: float,
    y: float,
    w: float,
    h: float,
    k: str | None,
    lines: list[tuple[str, int | bool]],
    fill: str,
    stroke: str,
    isz: float = 40,
    ls: float = 26,
    sz: tuple[float, float] = (18, 16),
) -> str:
    """Draw a service card with optional icon `k` and multi-line `(text, is_bold)` tuples."""
    r = box(x, y, w, h, fill, stroke, sw=1.5)
    tx = x + 10
    if k:
        r += ic(k, x + 10, y + (h - isz) / 2, isz)
        tx = x + isz + 20
    n = len(lines)
    y0 = y + h / 2 - (n - 1) * ls / 2 + 6
    for i, (s, b) in enumerate(lines):
        r += t(
            tx,
            y0 + i * ls,
            s,
            sz[0] if b else sz[1],
            "700" if b else "400",
            NAVY if b else GR,
            mw=x + w - tx - 8,
        )
    return r


def arr(
    d: str,
    kind: str = "net",
    start: bool = False,
    end: bool = True,
    sw: float = 3,
) -> str:
    """Draw an orthogonal connector path with semantic colour, dash pattern, and arrow markers."""
    c = KIND[kind]
    dash = {
        "id": 'stroke-dasharray="9 6"',
        "dns": 'stroke-dasharray="2 6" stroke-linecap="round"',
        "tel": 'stroke-dasharray="9 6"',
        "off": 'stroke-dasharray="6 6"',
    }.get(kind, "")
    ms = f' marker-start="url(#m-{kind})"' if start else ""
    me = f' marker-end="url(#m-{kind})"' if end else ""
    return f'<path d="{d}" stroke="{c}" stroke-width="{sw}" fill="none" {dash}{ms}{me}/>'


def circ(x: float, y: float, n: str, col: str = BL) -> str:
    """Draw a numbered/lettered circular callout badge centered at `(x, y)`."""
    return f'<circle cx="{x}" cy="{y}" r="13" fill="{col}"/>' + t(
        x, y + 6, n, 16, "700", "#FFFFFF", "middle"
    )


def badge(x: float, y: float, w: float, s: str, col: str) -> str:
    """Draw a solid scope badge."""
    return box(x, y, w, 28, col, col) + t(x + w / 2, y + 20, s, 15, "700", "#FFFFFF", "middle", mw=w - 8)


def sub(
    x: float,
    y: float,
    w: float,
    h: float,
    name: str,
    col: str,
    fill: str,
    badgetxt: str | None = None,
    bw: float = 230,
) -> str:
    """Draw an Azure Subscription boundary box with subscription icon and optional scope badge."""
    r = box(x, y, w, h, fill, col, sw=2.5) + ic("sub", x + 16, y + 6, 36) + t(x + 62, y + 34, name, 24, "700")
    if badgetxt:
        r += badge(x + w - bw - 14, y + 10, bw, badgetxt, col)
    return r


def folder(x: float, y: float, s: float = 30) -> str:
    """Draw a vector folder glyph."""
    return (
        f'<path d="M{x} {y+6}h{s*0.4}l{s*0.12} {s*0.14}h{s*0.48}v{s*0.7}h{-s}z" '
        f'fill="#F2C94C" stroke="#B8901C" stroke-width="1.2"/>'
    )


def gh(x: float, y: float, s: float = 40) -> str:
    """Place the GitHub Octicon mark at `(x, y)`."""
    return f'<use href="#ic-gh" x="{x}" y="{y}" width="{s}" height="{s}"/>'


def symbols(used: Iterable[str]) -> str:
    """Build `<symbol id="ic-...">` definitions with namespaced internal gradient/clip IDs."""
    out = ""
    for k in sorted(set(used)):
        if k == "gh":
            gh_svg = (ICONS_ROOT / "github.svg").read_text(encoding="utf-8")
            m = re.search(r' d="([^"]+)"', gh_svg)
            if not m:
                raise ValueError("Invalid github.svg: missing path d attribute")
            out += f'<symbol id="ic-gh" viewBox="0 0 24 24"><path fill="{NAVY}" d="{m.group(1)}"/></symbol>\n'
            continue
        svg_path = resolve_icon_path(k)
        s = svg_path.read_text(encoding="utf-8")
        s = re.sub(r"<\?xml.*?\?>", "", s)
        vb_match = re.search(r'viewBox="([^"]+)"', s)
        vb = vb_match.group(1) if vb_match else "0 0 18 18"
        inner_match = re.search(r"<svg[^>]*>(.*)</svg>", s, re.S)
        if not inner_match:
            raise ValueError(f"Invalid SVG icon file: {svg_path}")
        inner = inner_match.group(1)
        inner = re.sub(r'id="([^"]+)"', lambda m, key=k: f'id="{key}-{m.group(1)}"', inner)
        inner = re.sub(r"url\(#([^)]+)\)", lambda m, key=k: f"url(#{key}-{m.group(1)})", inner)
        inner = re.sub(
            r'(xlink:href|href)="#([^"]+)"',
            lambda m, key=k: f'{m.group(1)}="#{key}-{m.group(2)}"',
            inner,
        )
        out += f'<symbol id="ic-{k}" viewBox="{vb}">{inner}</symbol>\n'
    return out


def build_svg(title: str, *, footer: str | None = DEFAULT_FOOTER) -> str:
    """Assemble the complete 1920x1080 SVG document string from the current buffer."""
    body = "\n".join(o)
    used = set(re.findall(r'#ic-([A-Za-z0-9_-]+)"', body))
    mk = "".join(
        f'<marker id="m-{k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{c}"/></marker>'
        for k, c in KIND.items()
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 1920 1080" '
        f'font-family="Segoe UI, Arial, sans-serif">'
        f"<defs>{symbols(used)}{mk}</defs>"
        f'<rect width="1920" height="1080" fill="#FFFFFF"/>'
    )
    svg += t(960, 56, title, 40, "700", anchor="middle") + body
    if footer:
        svg += t(960, 1058, footer, 18, fill="#4A5A6A", anchor="middle")
    svg += "</svg>"
    return svg


def _render_png(svg_text: str, svg_path: Path, png_path: Path, width: int = 3840, height: int = 2160) -> None:
    """Render `svg_text` to a `width x height` PNG at `png_path` via CairoSVG or headless browser fallback."""
    try:
        import cairosvg  # type: ignore[import-untyped]

        cairosvg.svg2png(
            bytestring=svg_text.encode("utf-8"),
            write_to=str(png_path),
            output_width=width,
            output_height=height,
        )
        return
    except ImportError:
        pass

    # Fallback: headless Chromium / Edge (Linux, macOS, Windows)
    browser_candidates = [
        shutil.which("msedge"),
        shutil.which("microsoft-edge"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    browser = next((b for b in browser_candidates if b and Path(b).exists()), None)
    if not browser:
        raise RuntimeError(
            "Neither 'cairosvg' nor a headless Chromium/Edge browser is available to render PNG output."
        )

    tmp_dir = Path(tempfile.gettempdir())
    tmp_png = tmp_dir / f"r_{png_path.stem}_{os.getpid()}.png"
    if tmp_png.exists():
        tmp_png.unlink()

    svg_uri = svg_path.resolve().as_uri()
    for _ in range(4):
        user_data_dir = tmp_dir / f"ed_{png_path.stem}_{os.getpid()}"
        pr = subprocess.Popen(
            [
                browser,
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                f"--user-data-dir={user_data_dir}",
                f"--window-size={width},{height}",
                f"--screenshot={tmp_png}",
                svg_uri,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        for _ in range(25):
            if tmp_png.exists() and tmp_png.stat().st_size > 1000:
                break
            if pr.poll() is not None:
                break
            time.sleep(1)
        if pr.poll() is None:
            pr.terminate()
            try:
                pr.wait(timeout=3)
            except subprocess.TimeoutExpired:
                pr.kill()
        if tmp_png.exists() and tmp_png.stat().st_size > 1000:
            break

    if not tmp_png.exists() or tmp_png.stat().st_size == 0:
        raise RuntimeError(f"Failed to render PNG for {svg_path}")
    shutil.copyfile(tmp_png, png_path)
    tmp_png.unlink(missing_ok=True)


def _resolve_output_base(name: str | Path, out_dir: str | Path | None = None) -> Path:
    """Resolve `name` to an output base path (without `.svg`/`.png` suffix)."""
    p = Path(name)
    if p.suffix.lower() in (".svg", ".png"):
        p = p.with_suffix("")
    if out_dir is not None:
        return Path(out_dir) / p.name
    if p.is_absolute() or p.parent != Path():
        return p
    # Default to the directory of the calling script when invoked as a script, else cwd
    argv0 = Path(sys.argv[0]) if sys.argv and sys.argv[0] and sys.argv[0] != "-c" else None
    if argv0 and argv0.exists() and argv0.suffix == ".py":
        return argv0.resolve().parent / p
    return Path.cwd() / p


def finish(
    name: str | Path,
    title: str,
    *,
    footer: str | None = DEFAULT_FOOTER,
    out_dir: str | Path | None = None,
    formats: Iterable[str] = ("svg", "png"),
) -> list[Path]:
    """Write the `.svg` master and render the `3840x2160` `.png` sibling."""
    base = _resolve_output_base(name, out_dir=out_dir)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)

    fmt_list = [f.lower().lstrip(".") for f in formats]
    svg_text = build_svg(title, footer=footer)
    svg_path = base.with_suffix(".svg")
    png_path = base.with_suffix(".png")

    written: list[Path] = []
    # Always write SVG (temporarily if only PNG was requested and browser fallback is needed)
    svg_path.write_text(svg_text, encoding="utf-8")
    if "svg" in fmt_list:
        written.append(svg_path)

    if "png" in fmt_list:
        _render_png(svg_text, svg_path, png_path)
        written.append(png_path)

    if "svg" not in fmt_list and svg_path.exists():
        svg_path.unlink()

    print("rendered", base.name)
    return written


__all__ = [
    "SKILL_ROOT",
    "ICONS_ROOT",
    "BASE",
    "P",
    "NAVY",
    "GR",
    "BL",
    "TL",
    "AM",
    "AMB",
    "PU",
    "SL",
    "BLF",
    "TLF",
    "AMF",
    "GRF",
    "PUF",
    "KIND",
    "DEFAULT_FOOTER",
    "o",
    "resolve_icon_path",
    "reset",
    "add",
    "est",
    "ic",
    "box",
    "t",
    "rg",
    "chip",
    "chip2",
    "card",
    "arr",
    "circ",
    "badge",
    "sub",
    "folder",
    "gh",
    "symbols",
    "build_svg",
    "finish",
]
