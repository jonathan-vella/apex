"""dlib — Programmable 1920x1080 SVG + 3840x2160 4K PNG Azure architecture diagram library.

Authors brand-consistent Azure architecture diagrams as editable SVG masters
(with official Microsoft Azure Public Service Icons v23 embedded as vector
`<symbol>` definitions) and renders 3840x2160 4K PNG siblings.
"""

from __future__ import annotations

import difflib
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterable, Sequence
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
    "arc-machines": "management + governance/01710-icon-service-Arc-Machines.svg",
    "rsv": "management + governance/00017-icon-service-Recovery-Services-Vaults.svg",
    "bvault": "other/02361-icon-service-Backup-Vault.svg",
    "update-manager": "other/02846-icon-service-Update-Management-Center.svg",
    # Networking & Edge
    "vnet": "networking/10061-icon-service-Virtual-Networks.svg",
    "subnet": "networking/02742-icon-service-Subnet.svg",
    "fw": "networking/10084-icon-service-Firewalls.svg",
    "fwp": "networking/00272-icon-service-Azure-Firewall-Policy.svg",
    "waf": "networking/10362-icon-service-Web-Application-Firewall-Policies(WAF).svg",
    "ddos": "networking/10072-icon-service-DDoS-Protection-Plans.svg",
    "dns": "networking/10064-icon-service-DNS-Zones.svg",
    "dnsresolver": "networking/02882-icon-service-DNS-Private-Resolver.svg",
    "bas": "networking/02422-icon-service-Bastions.svg",
    "nat": "networking/10310-icon-service-NAT.svg",
    "peer": "other/01285-icon-service-Peerings.svg",
    "rt": "networking/10082-icon-service-Route-Tables.svg",
    "pe": "other/02579-icon-service-Private-Endpoints.svg",
    "privatelink": "networking/00427-icon-service-Private-Link.svg",
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
    "azfiles": "general/10838-icon-service-Storage-Azure-Files.svg",
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
    "sentinel": "security/10248-icon-service-Azure-Sentinel.svg",
    "defender": "security/10241-icon-service-Microsoft-Defender-for-Cloud.svg",
    "mi": "identity/10227-icon-service-Managed-Identities.svg",
    "user": "identity/10230-icon-service-Users.svg",
    "entra": "identity/10340-icon-service-Entra-Identity-Roles-and-Administrators.svg",
    "appreg": "identity/10232-icon-service-App-Registrations.svg",
    "entapp": "identity/10225-icon-service-Enterprise-Applications.svg",
    # Monitoring & Observability
    "mon": "monitor/00001-icon-service-Monitor.svg",
    "law": "monitor/00009-icon-service-Log-Analytics-Workspaces.svg",
    "ai": "monitor/00012-icon-service-Application-Insights.svg",
    "dcr": "other/01857-icon-service-Data-Collection-Rules.svg",
    "alerts": "management + governance/00002-icon-service-Alerts.svg",
    "service-health": "general/10004-icon-service-Service-Health.svg",
    "cost-alerts": "general/10791-icon-service-Cost-Alerts.svg",
    "network-watcher": "monitor/10066-icon-service-Network-Watcher.svg",
    "workbooks": "monitor/02189-icon-service-Azure-Workbooks.svg",
    "grafana": "other/02905-icon-service-Azure-Managed-Grafana.svg",
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

# Neutral Azure Architecture Center (AAC) palette
AAC_INK = "#323130"
AAC_MUTED = "#605E5C"
AAC_BORDER = "#8A8886"
AAC_FILL = "#FAFAFA"
AAC_BLUE_FILL = "#F3F9FD"
AAC_SUB_FILL = "#F7FAFD"

AAC_FLOW_STYLES: dict[str, tuple[str, str, str]] = {
    # style -> (stroke_color, stroke_dasharray, marker_id)
    "sync": (AAC_INK, "", "m-aac"),
    "async": (AAC_INK, 'stroke-dasharray="6 4"', "m-aac"),
    "private": (BL, "", "m-aac-private"),
    "dns": (TL, 'stroke-dasharray="2 4" stroke-linecap="round"', "m-aac-dns"),
    "tel": (AAC_MUTED, 'stroke-dasharray="6 4"', "m-aac-muted"),
}

AAC_ZONE_STYLES: dict[str, tuple[str, str, str, float, float, str | None]] = {
    # kind -> (fill, stroke, dash_attr, stroke_width, rx, default_icon)
    "region": (AAC_FILL, AAC_BORDER, 'stroke-dasharray="6 4"', 1.4, 6.0, None),
    "sub": (AAC_SUB_FILL, BL, "", 1.5, 6.0, "sub"),
    "rg": ("#FFFFFF", AAC_MUTED, 'stroke-dasharray="6 4"', 1.3, 6.0, "rg"),
    "vnet": (AAC_BLUE_FILL, BL, "", 1.4, 6.0, "vnet"),
    "subnet": ("#FFFFFF", BL, 'stroke-dasharray="5 3"', 1.2, 5.0, "subnet"),
    "onprem": ("#F5F5F5", AAC_MUTED, 'stroke-dasharray="4 4"', 1.4, 6.0, None),
    "group": (AAC_FILL, "#C8C6C4", "", 1.2, 6.0, None),
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


def resolve_icon_with_provenance(k: str, *, strict: bool = False) -> tuple[Path, str]:
    """Resolve icon key `k` to `(svg_path, match_kind)` where `match_kind` is `'exact'` or `'fallback'`."""
    if k == "gh":
        gh_path = ICONS_ROOT / "github.svg"
        if gh_path.exists():
            return gh_path, "exact"
        raise KeyError(f"GitHub icon not found at {gh_path}")
    if k in P:
        rel_parts = P[k].replace("\\", "/").split("/")
        candidate = BASE.joinpath(*rel_parts)
        if candidate.exists():
            return candidate, "exact"
    idx = _build_v23_index()
    norm = k.replace("\\", "/").lower().removesuffix(".svg")
    for candidate_key in (norm, f"{norm}.svg", norm.replace("_", "-")):
        if candidate_key in idx:
            return idx[candidate_key], "exact"
    if not strict:
        # Legacy substring fallback on cleaned service name (opt-out via strict=True)
        for idx_key, svg_path in idx.items():
            if norm in idx_key:
                return svg_path, "fallback"
    candidates = sorted(set(P.keys()) | {key for key in idx if "/" not in key and not key.endswith(".svg")})
    suggestions = difflib.get_close_matches(norm, candidates, n=3, cutoff=0.45)
    hint = f" (closest: {', '.join(suggestions)})" if suggestions else ""
    raise KeyError(f"Unknown Azure icon key: {k!r}{hint}")


def resolve_icon_path(k: str, *, strict: bool = False) -> Path:
    """Resolve an icon key `k` to its SVG file path on disk."""
    path, _ = resolve_icon_with_provenance(k, strict=strict)
    return path


def reset() -> None:
    """Clear the accumulated SVG element buffer."""
    o.clear()


def add(s: str) -> None:
    """Append an SVG fragment to the canvas buffer."""
    o.append(s)


def est(s: str, size: float, bold: bool = False) -> float:
    """Estimate rendered pixel width of text `s` at `size` px."""
    clean = re.sub(r"<[^>]+>", "", s).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    return len(clean) * size * (0.60 if bold else 0.55)


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


def _xml_escape_text(s: str) -> str:
    """Escape bare `&` and `<` while preserving intentional inline `<tspan>` tags and XML entities."""
    escaped = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", str(s))
    escaped = re.sub(r"<(?!(?:/?tspan\b))", "&lt;", escaped)
    return escaped


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
    return f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{w}" fill="{fill}" text-anchor="{anchor}">{_xml_escape_text(s)}</text>'


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
    return f'<circle cx="{x}" cy="{y}" r="13" fill="{col}"/>' + t(x, y + 6, n, 16, "700", "#FFFFFF", "middle")


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


def tenant(
    x: float = 30,
    y: float = 80,
    w: float = 1860,
    h: float = 940,
    name: str = "Microsoft Entra tenant",
) -> str:
    """Draw an outer Microsoft Entra tenant frame (`gen02` style)."""
    return (
        box(x, y, w, h, "none", NAVY, sw=3, rx=14)
        + ic("ten", x + 20, y + 12, 40)
        + t(x + 70, y + 41, name, 26, "700", NAVY)
    )


def legend(
    x: float,
    y: float,
    items: list[tuple[str, str]],
    *,
    title: str = "Legend",
    row_h: float = 34,
    line_w: float = 68,
) -> str:
    """Draw a vertical connector legend (`gen02` top-left style)."""
    out = t(x, y, title, 18, "700", NAVY) if title else ""
    y0 = y + (26 if title else 0)
    for i, (kind, label) in enumerate(items):
        cy = y0 + i * row_h
        if kind == "peer":
            out += arr(f"M{x + 4} {cy}H{x + 4 + line_w}", "net", start=True, end=True)
        elif kind == "attach":
            out += f'<path d="M{x + 4} {cy}H{x + 4 + line_w}" stroke="{BL}" stroke-width="2.5" fill="none"/>'
        else:
            out += arr(f"M{x + 4} {cy}H{x + 4 + line_w}", kind, start=False, end=(kind != "dns"))
        out += t(x + 16 + line_w, cy + 6, label, 16, "400", NAVY)
    return out


def vbracket(
    x: float,
    y1: float,
    y2: float,
    tick: float = 8,
    stroke: str = BL,
    sw: float = 2.5,
) -> str:
    """Draw a vertical grouping bracket from `(x, y1)` to `(x, y2)` with horizontal ticks."""
    return (
        f'<path d="M{x} {y1}V{y2}M{x} {y1}H{x + tick}M{x} {y2}H{x + tick}" '
        f'stroke="{stroke}" stroke-width="{sw}" fill="none"/>'
    )


def chevron(
    x: float,
    y: float,
    w: float,
    h: float,
    code: str,
    label: str,
    stroke: str = BL,
    fill: str = BLF,
    tip: float = 22,
    size: float = 17,
) -> str:
    """Draw a process chevron step (`gen02` bottom bar style)."""
    ym = y + h / 2
    pts = f"{x},{y} {x + w - tip},{y} {x + w},{ym} {x + w - tip},{y + h} {x},{y + h}"
    combined = f"{code}  {label}"
    est_w = est(code, size, True) + est(f"  {label}", size, False)
    max_w = w - tip - 20
    if est_w > max_w:
        print("WARN overflow:", combined[:50], round(est_w), ">", round(max_w))
    txt = f'<tspan font-weight="700" fill="{stroke}">{_xml_escape_text(code)}</tspan>  {_xml_escape_text(label)}'
    return (
        f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="1.8"/>'
        f'<text x="{x + 16}" y="{ym + 6}" font-size="{size}" font-weight="400" fill="{NAVY}">{txt}</text>'
    )


def folder(x: float, y: float, s: float = 30) -> str:
    """Draw a vector folder glyph."""
    return (
        f'<path d="M{x} {y + 6}h{s * 0.4}l{s * 0.12} {s * 0.14}h{s * 0.48}v{s * 0.7}h{-s}z" '
        f'fill="#F2C94C" stroke="#B8901C" stroke-width="1.2"/>'
    )


def gh(x: float, y: float, s: float = 40) -> str:
    """Place the GitHub Octicon mark at `(x, y)`."""
    return f'<use href="#ic-gh" x="{x}" y="{y}" width="{s}" height="{s}"/>'


def _xml_attr(value: str) -> str:
    """Escape a string for safe inclusion inside a double-quoted XML attribute."""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace('"', "&quot;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _wrap_label(text: str, max_w: float, size: float, bold: bool = False, max_lines: int = 2) -> list[str]:
    """Word-wrap `text` into at most `max_lines` lines fitting `max_w`."""
    explicit = [part.strip() for part in str(text).split("\n") if part.strip()]
    if len(explicit) > 1:
        return explicit[:max_lines]
    words = str(text).split()
    if not words:
        return []
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if est(candidate, size, bold) <= max_w:
            current = candidate
        else:
            lines.append(current)
            current = word
            if len(lines) == max_lines - 1:
                break
    remaining_idx = sum(len(line.split()) for line in lines)
    tail = " ".join(words[remaining_idx:]) if remaining_idx < len(words) else current
    if not lines:
        lines.append(current)
    elif tail and len(lines) < max_lines:
        lines.append(tail)
    return lines[:max_lines]


def tile(
    cx: float,
    cy: float,
    icon_key: str,
    label: str,
    *,
    node_id: str | None = None,
    parent_id: str | None = None,
    sublabel: str | None = None,
    isz: float = 52,
    max_w: float = 136,
) -> str:
    """Draw an AAC-style bare Azure icon centered at `(cx, cy)` with caption underneath."""
    _, match_kind = resolve_icon_with_provenance(icon_key, strict=True)
    nid = _safe_key(node_id or f"{icon_key}_{round(cx)}_{round(cy)}")
    label_size = 13.5
    sub_size = 12.0
    line_h = 16.5
    lines = _wrap_label(label, max_w, label_size, bold=True, max_lines=2)
    sub_lines = _wrap_label(sublabel, max_w, sub_size, bold=False, max_lines=1) if sublabel else []

    ix = cx - isz / 2
    iy = cy - isz / 2
    parts = [ic(icon_key, ix, iy, isz)]
    text_y = cy + isz / 2 + 16
    max_text_w = isz
    for idx_line, line in enumerate(lines):
        ly = text_y + idx_line * line_h
        max_text_w = max(max_text_w, est(line, label_size, True))
        parts.append(t(cx, ly, line, label_size, "700", AAC_INK, "middle", mw=max_w + 14))
    sub_base_y = text_y + len(lines) * line_h
    for idx_sub, sline in enumerate(sub_lines):
        sy = sub_base_y + idx_sub * 14.5
        max_text_w = max(max_text_w, est(sline, sub_size, False))
        parts.append(t(cx, sy, sline, sub_size, "400", AAC_MUTED, "middle", mw=max_w + 18))

    bw = min(max(max_text_w + 8, isz + 8), max_w + 20)
    bottom_y = (sub_base_y + (len(sub_lines) - 1) * 14.5 + 4) if sub_lines else (text_y + max(len(lines) - 1, 0) * line_h + 4)
    bx = cx - bw / 2
    by = iy - 2
    bh = bottom_y - by

    attrs = [
        'data-apex-role="tile"',
        f'data-node-id="{_xml_attr(nid)}"',
        f'data-bbox="{bx:.1f},{by:.1f},{bw:.1f},{bh:.1f}"',
        f'data-icon-key="{_xml_attr(icon_key)}"',
        f'data-icon-match="{_xml_attr(match_kind)}"',
    ]
    if parent_id:
        attrs.append(f'data-parent-id="{_xml_attr(parent_id)}"')
    return f"<g {' '.join(attrs)}>{''.join(parts)}</g>"


def zone(
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    *,
    kind: str = "vnet",
    zone_id: str | None = None,
    parent_id: str | None = None,
    subtitle: str | None = None,
    icon_key: str | None = None,
) -> str:
    """Draw a neutral AAC boundary container (`region`, `sub`, `rg`, `vnet`, `subnet`, `onprem`, `group`)."""
    if kind not in AAC_ZONE_STYLES:
        raise ValueError(f"Unknown AAC zone kind: {kind!r} (expected one of {sorted(AAC_ZONE_STYLES)})")
    fill, stroke, dash, sw, rx, default_icon = AAC_ZONE_STYLES[kind]
    eff_icon = icon_key if icon_key is not None else default_icon
    zid = _safe_key(zone_id or f"{kind}_{round(x)}_{round(y)}")
    parts = [box(x, y, w, h, fill, stroke, dash, sw=sw, rx=rx)]
    tx = x + 12
    if eff_icon:
        resolve_icon_with_provenance(eff_icon, strict=True)
        parts.append(ic(eff_icon, x + 10, y + 8, 22))
        tx = x + 38
    parts.append(t(tx, y + 24, title, 14.5, "700", AAC_INK, mw=max(w - (tx - x) - 12, 40)))
    if subtitle:
        parts.append(t(tx, y + 40, subtitle, 12.0, "400", AAC_MUTED, mw=max(w - (tx - x) - 12, 40)))

    attrs = [
        'data-apex-role="zone"',
        f'data-node-id="{_xml_attr(zid)}"',
        f'data-zone-kind="{_xml_attr(kind)}"',
        f'data-bbox="{x:.1f},{y:.1f},{w:.1f},{h:.1f}"',
    ]
    if parent_id:
        attrs.append(f'data-parent-id="{_xml_attr(parent_id)}"')
    return f"<g {' '.join(attrs)}>{''.join(parts)}</g>"


def _rounded_ortho_path(points: Sequence[tuple[float, float]], radius: float = 6.0) -> str:
    """Build an SVG path string through `points` with rounded corners."""
    if len(points) < 2:
        raise ValueError("flow() requires at least 2 points")
    if len(points) == 2 or radius <= 0:
        head = f"M{points[0][0]:.1f} {points[0][1]:.1f}"
        segs = "".join(f"L{px:.1f} {py:.1f}" for px, py in points[1:])
        return head + segs

    cmds = [f"M{points[0][0]:.1f} {points[0][1]:.1f}"]
    for i in range(1, len(points) - 1):
        p0, p1, p2 = points[i - 1], points[i], points[i + 1]
        v1x, v1y = p1[0] - p0[0], p1[1] - p0[1]
        v2x, v2y = p2[0] - p1[0], p2[1] - p1[1]
        d1 = math.hypot(v1x, v1y)
        d2 = math.hypot(v2x, v2y)
        if d1 < 1e-6 or d2 < 1e-6:
            cmds.append(f"L{p1[0]:.1f} {p1[1]:.1f}")
            continue
        r = min(radius, d1 / 2.0, d2 / 2.0)
        sx, sy = p1[0] - (v1x / d1) * r, p1[1] - (v1y / d1) * r
        ex, ey = p1[0] + (v2x / d2) * r, p1[1] + (v2y / d2) * r
        cmds.append(f"L{sx:.1f} {sy:.1f}Q{p1[0]:.1f} {p1[1]:.1f} {ex:.1f} {ey:.1f}")
    cmds.append(f"L{points[-1][0]:.1f} {points[-1][1]:.1f}")
    return "".join(cmds)


def _longest_segment_midpoint(points: Sequence[tuple[float, float]]) -> tuple[float, float, bool]:
    """Return `(mx, my, is_horizontal)` for the longest segment in `points`."""
    best_len = -1.0
    best = (points[0][0], points[0][1], True)
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        seg_len = math.hypot(x2 - x1, y2 - y1)
        if seg_len > best_len:
            best_len = seg_len
            best = ((x1 + x2) / 2.0, (y1 + y2) / 2.0, abs(x2 - x1) >= abs(y2 - y1))
    return best


def flow(
    points: Sequence[tuple[float, float]],
    *,
    edge_id: str | None = None,
    source_id: str | None = None,
    target_id: str | None = None,
    step: str | int | None = None,
    style: str = "sync",
    label: str | None = None,
    bidirectional: bool = False,
    sw: float = 1.8,
) -> str:
    """Draw a thin AAC orthogonal connector with optional numbered step badge and label."""
    if style not in AAC_FLOW_STYLES:
        raise ValueError(f"Unknown AAC flow style: {style!r} (expected one of {sorted(AAC_FLOW_STYLES)})")
    stroke, dash, marker = AAC_FLOW_STYLES[style]
    d = _rounded_ortho_path(points)
    ms = f' marker-start="url(#{marker})"' if bidirectional else ""
    me = f' marker-end="url(#{marker})"'
    parts = [f'<path d="{d}" stroke="{stroke}" stroke-width="{sw}" fill="none" {dash}{ms}{me}/>']

    mx, my, is_horiz = _longest_segment_midpoint(points)
    if step is not None:
        step_text = str(step)
        r_badge = 11 if len(step_text) <= 2 else 13
        parts.append(
            f'<circle cx="{mx:.1f}" cy="{my:.1f}" r="{r_badge}" fill="{BL}" stroke="#FFFFFF" stroke-width="1.5"/>'
            + t(mx, my + 4.3, step_text, 12.0, "700", "#FFFFFF", "middle")
        )
    if label:
        lx = mx
        ly = (my - 18) if (step is not None and is_horiz) else (my - 10 if is_horiz else my)
        if step is not None and not is_horiz:
            lx = mx + 18 + est(label, 12.0, False) / 2.0
        lw = est(label, 12.0, False) + 12
        parts.append(
            f'<rect x="{lx - lw / 2:.1f}" y="{ly - 10:.1f}" width="{lw:.1f}" height="18" rx="4" fill="#FFFFFF" fill-opacity="0.92"/>'
            + t(lx, ly + 3.5, label, 12.0, "400", AAC_MUTED, "middle")
        )

    pts_attr = ";".join(f"{px:.1f},{py:.1f}" for px, py in points)
    attrs = [
        'data-apex-role="edge"',
        f'data-points="{pts_attr}"',
    ]
    if edge_id:
        attrs.append(f'data-edge-id="{_xml_attr(edge_id)}"')
    if source_id:
        attrs.append(f'data-source="{_xml_attr(source_id)}"')
    if target_id:
        attrs.append(f'data-target="{_xml_attr(target_id)}"')
    if step is not None:
        attrs.append(f'data-step="{_xml_attr(str(step))}"')
    return f"<g {' '.join(attrs)}>{''.join(parts)}</g>"


def dataflow_key(
    x: float,
    y: float,
    w: float,
    steps: Sequence[tuple[str | int, str]],
    *,
    title: str = "Dataflow",
    cols: int = 2,
) -> str:
    """Draw a compact AAC numbered Dataflow key panel at `(x, y)` with width `w`."""
    if not steps:
        return ""
    col_count = max(1, min(cols, len(steps)))
    rows = math.ceil(len(steps) / col_count)
    row_h = 26.0
    header_h = 28.0 if title else 8.0
    h = header_h + rows * row_h + 10.0
    parts = [box(x, y, w, h, AAC_FILL, "#D2D0CE", sw=1.2, rx=6)]
    if title:
        parts.append(t(x + 14, y + 20, title, 13.5, "700", AAC_INK))
    col_w = (w - 28.0) / col_count
    for idx, (num, desc) in enumerate(steps):
        c = idx // rows
        r = idx % rows
        sx = x + 14 + c * col_w
        sy = y + header_h + r * row_h + 13
        num_s = str(num)
        parts.append(
            f'<circle cx="{sx + 10:.1f}" cy="{sy - 4:.1f}" r="9.5" fill="{BL}"/>'
            + t(sx + 10, sy, num_s, 11.5, "700", "#FFFFFF", "middle")
            + t(sx + 26, sy, desc, 12.5, "400", AAC_INK, mw=max(col_w - 34, 60))
        )
    return (
        f'<g data-apex-role="dataflow-key" data-bbox="{x:.1f},{y:.1f},{w:.1f},{h:.1f}">'
        f"{''.join(parts)}</g>"
    )


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


def build_svg(
    title: str,
    *,
    footer: str | None = DEFAULT_FOOTER,
    width: int = 1920,
    height: int = 1080,
    out_width: int | None = None,
    out_height: int | None = None,
    show_title: bool = True,
    description: str = "",
    style: str = "legacy",
) -> str:
    """Assemble the complete SVG document string from the current buffer."""
    body = "\n".join(o)
    used = set(re.findall(r'#ic-([A-Za-z0-9_-]+)"', body))
    resolved_style = (
        "aac"
        if style == "aac" or 'data-apex-role="tile"' in body or 'data-apex-role="zone"' in body
        else style
    )
    render_w = out_width if out_width is not None else int(width * 2)
    render_h = out_height if out_height is not None else int(height * 2)
    mk = "".join(
        f'<marker id="m-{k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{c}"/></marker>'
        for k, c in KIND.items()
    )
    aac_markers = (
        f'<marker id="m-aac" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{AAC_INK}"/></marker>'
        f'<marker id="m-aac-private" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{BL}"/></marker>'
        f'<marker id="m-aac-dns" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{TL}"/></marker>'
        f'<marker id="m-aac-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{AAC_MUTED}"/></marker>'
    )
    desc_text = description.strip() or f"Azure architecture diagram: {title}"
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{render_w}" height="{render_h}" '
        f'viewBox="0 0 {width} {height}" font-family="Segoe UI, Arial, sans-serif" '
        f'role="img" aria-label="{_xml_attr(title)}" '
        f'data-apex-diagram="true" data-apex-style="{_xml_attr(resolved_style)}">'
        f"<title>{_xml_escape_text(title)}</title>"
        f"<desc>{_xml_escape_text(desc_text)}</desc>"
        f"<defs>{symbols(used)}{mk}{aac_markers}</defs>"
        f'<rect width="{width}" height="{height}" fill="#FFFFFF"/>'
    )
    if show_title and title:
        title_size = 28 if resolved_style == "aac" else 40
        title_y = 42 if resolved_style == "aac" else 56
        title_fill = AAC_INK if resolved_style == "aac" else NAVY
        svg += t(width / 2, title_y, title, title_size, "700", title_fill, anchor="middle")
    svg += body
    if footer:
        svg += t(width / 2, height - 22, footer, 18 if resolved_style != "aac" else 13, fill="#4A5A6A", anchor="middle")
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
    except (ImportError, OSError):
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
        raise RuntimeError("Neither 'cairosvg' nor a headless Chromium/Edge browser is available to render PNG output.")

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
    width: int = 1920,
    height: int = 1080,
    out_width: int | None = None,
    out_height: int | None = None,
    show_title: bool = True,
    description: str = "",
    style: str = "legacy",
) -> list[Path]:
    """Write the `.svg` master and render the `.png` sibling."""
    base = _resolve_output_base(name, out_dir=out_dir)
    if base.parent != Path():
        base.parent.mkdir(parents=True, exist_ok=True)

    fmt_list = [f.lower().lstrip(".") for f in formats]
    render_w = out_width if out_width is not None else int(width * 2)
    render_h = out_height if out_height is not None else int(height * 2)
    svg_text = build_svg(
        title,
        footer=footer,
        width=width,
        height=height,
        out_width=render_w,
        out_height=render_h,
        show_title=show_title,
        description=description,
        style=style,
    )
    svg_path = base.with_suffix(".svg")
    png_path = base.with_suffix(".png")

    written: list[Path] = []
    # Always write SVG (temporarily if only PNG was requested and browser fallback is needed)
    svg_path.write_text(svg_text, encoding="utf-8")
    if "svg" in fmt_list:
        written.append(svg_path)

    if "png" in fmt_list:
        _render_png(svg_text, svg_path, png_path, width=render_w, height=render_h)
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
    "AAC_INK",
    "AAC_MUTED",
    "AAC_BORDER",
    "AAC_FILL",
    "AAC_BLUE_FILL",
    "AAC_SUB_FILL",
    "AAC_FLOW_STYLES",
    "AAC_ZONE_STYLES",
    "DEFAULT_FOOTER",
    "o",
    "resolve_icon_with_provenance",
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
    "tenant",
    "legend",
    "vbracket",
    "chevron",
    "folder",
    "gh",
    "tile",
    "zone",
    "flow",
    "dataflow_key",
    "symbols",
    "build_svg",
    "finish",
]
