#!/usr/bin/env python3
"""Export agent-output projects to standalone HTML bundles and ZIP archives."""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Iterable

try:
    import markdown
except ImportError as exc:  # pragma: no cover - import guard for local execution
    raise SystemExit(
        "Missing Python dependency 'markdown'. Install docs dependencies with "
        "'pip install -r requirements-docs.txt'."
    ) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
AGENT_OUTPUT_DIR = REPO_ROOT / "agent-output"
DEFAULT_EXPORT_DIR = AGENT_OUTPUT_DIR / "_html-exports"
SPECIAL_RENDER_SUFFIXES = {".json", ".csv", ".py"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
EXCLUDED_NAMES = {".gitkeep"}
MARKDOWN_EXTENSIONS = [
    "admonition",
    "extra",
    "fenced_code",
    "md_in_html",
    "sane_lists",
    "tables",
    "toc",
]
STYLE_CSS = """
:root {
  --page-bg: #f5f1e8;
  --surface: rgba(255, 252, 246, 0.96);
  --surface-strong: #fffdf8;
  --sidebar: #17322c;
  --sidebar-accent: #f4d27c;
  --text: #1e2c29;
  --muted: #576864;
  --border: rgba(23, 50, 44, 0.12);
  --link: #0a6a66;
  --link-hover: #084f4c;
  --code-bg: #16211f;
  --code-text: #f6f2ea;
  --shadow: 0 24px 64px rgba(28, 39, 35, 0.12);
  --font-body: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-display: Georgia, "Times New Roman", serif;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top right, rgba(244, 210, 124, 0.35), transparent 28%),
    linear-gradient(180deg, #f8f4eb 0%, var(--page-bg) 100%);
  color: var(--text);
  font-family: var(--font-body);
  line-height: 1.65;
}

a {
  color: var(--link);
}

a:hover {
  color: var(--link-hover);
}

img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

code,
pre,
tt {
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.layout {
  display: grid;
  grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  background:
    linear-gradient(180deg, rgba(14, 34, 29, 0.96), rgba(23, 50, 44, 0.98)),
    repeating-linear-gradient(
      135deg,
      rgba(244, 210, 124, 0.04),
      rgba(244, 210, 124, 0.04) 14px,
      transparent 14px,
      transparent 28px
    );
  color: #f6f2ea;
  padding: 28px 24px 40px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar h1,
.sidebar h2,
.sidebar h3 {
  color: inherit;
}

.sidebar .eyebrow {
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: rgba(246, 242, 234, 0.76);
  margin: 0 0 10px;
}

.sidebar .project-title {
  font-family: var(--font-display);
  font-size: 2rem;
  line-height: 1.05;
  margin: 0 0 14px;
}

.sidebar .summary {
  color: rgba(246, 242, 234, 0.82);
  font-size: 0.96rem;
  margin: 0 0 20px;
}

.sidebar .nav-heading {
  color: var(--sidebar-accent);
  font-size: 0.8rem;
  margin: 28px 0 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar li {
  margin: 0;
}

.sidebar a {
  display: block;
  padding: 9px 12px;
  border-radius: 10px;
  color: rgba(246, 242, 234, 0.92);
  text-decoration: none;
  font-size: 0.95rem;
}

.sidebar a:hover,
.sidebar a.active {
  background: rgba(244, 210, 124, 0.14);
  color: #fffdf8;
}

.sidebar .small-link {
  font-size: 0.86rem;
  color: rgba(246, 242, 234, 0.74);
}

.content-shell {
  padding: 36px 34px 52px;
}

.content {
  max-width: 1120px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 32px 42px 44px;
  backdrop-filter: blur(12px);
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 22px;
}

.breadcrumbs {
  color: var(--muted);
  font-size: 0.92rem;
}

.breadcrumbs a {
  color: inherit;
}

.page-title {
  margin: 8px 0 4px;
  font-size: clamp(1.8rem, 2.4vw, 2.6rem);
  line-height: 1.12;
  font-family: var(--font-display);
}

.page-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(10, 106, 102, 0.16);
  background: rgba(10, 106, 102, 0.06);
  color: var(--link-hover);
  font-size: 0.84rem;
}

.notice {
  margin: 20px 0 28px;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(244, 210, 124, 0.16);
  border: 1px solid rgba(244, 210, 124, 0.26);
  color: #5f4811;
}

.content h1,
.content h2,
.content h3,
.content h4,
.content h5,
.content h6 {
  font-family: var(--font-display);
  color: #162926;
  scroll-margin-top: 28px;
}

.content h1 {
  font-size: 2.4rem;
}

.content h2 {
  margin-top: 2.4rem;
  padding-top: 0.4rem;
  border-top: 1px solid rgba(23, 50, 44, 0.1);
  font-size: 1.7rem;
}

.content h3 {
  font-size: 1.28rem;
}

.content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.4rem 0 1.6rem;
  background: var(--surface-strong);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: block;
  overflow-x: auto;
}

.content thead {
  background: rgba(23, 50, 44, 0.06);
}

.content th,
.content td {
  border-bottom: 1px solid var(--border);
  padding: 11px 12px;
  text-align: left;
  vertical-align: top;
}

.content tr:last-child td {
  border-bottom: none;
}

.content blockquote {
  margin: 1.4rem 0;
  padding: 0.3rem 1rem;
  border-left: 4px solid rgba(10, 106, 102, 0.4);
  color: #34504c;
  background: rgba(10, 106, 102, 0.04);
  border-radius: 0 12px 12px 0;
}

.content pre {
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--code-bg);
  color: var(--code-text);
  overflow-x: auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.content code {
  background: rgba(23, 50, 44, 0.08);
  border-radius: 6px;
  padding: 0.12rem 0.35rem;
  color: #103331;
}

.content pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.content hr {
  border: none;
  border-top: 1px solid rgba(23, 50, 44, 0.12);
  margin: 2rem 0;
}

.content details {
  margin: 1.2rem 0;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
}

.content summary {
  cursor: pointer;
  font-weight: 600;
}

.raw-link {
  text-decoration: none;
}

.render-info {
  color: var(--muted);
  font-size: 0.92rem;
}

.file-list {
  display: grid;
  gap: 8px;
}

.directory-group {
  margin-bottom: 12px;
}

.directory-label {
  margin: 0 0 6px;
  color: rgba(246, 242, 234, 0.68);
  font-size: 0.8rem;
}

.data-table-meta {
  color: var(--muted);
  margin-bottom: 12px;
}

.mermaid-diagram {
  margin: 1.5rem 0;
  padding: 18px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid var(--border);
}

.mermaid-diagram .mermaid-fallback-note {
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 0.9rem;
}

.mermaid-diagram.mermaid-ready .mermaid-fallback-note,
.mermaid-diagram.mermaid-ready details {
  display: none;
}

@media (max-width: 1080px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    height: auto;
  }

  .content-shell {
    padding-top: 18px;
  }
}

@media (max-width: 720px) {
  .content-shell {
    padding: 14px;
  }

  .content {
    padding: 22px 18px 28px;
    border-radius: 18px;
  }

  .topbar {
    flex-direction: column;
  }
}
""".strip()
MERMAID_LOADER_JS = """
(function () {
  const blocks = Array.from(document.querySelectorAll('[data-mermaid-source]'));
  if (!blocks.length) {
    return;
  }

  const enableFallback = () => {
    blocks.forEach((block) => block.classList.remove('mermaid-ready'));
  };

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
  script.async = true;
  script.onload = async () => {
    if (!window.mermaid) {
      enableFallback();
      return;
    }

    window.mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });

    for (const [index, block] of blocks.entries()) {
      try {
        const result = await window.mermaid.render(`mermaid-export-${index}`, block.dataset.mermaidSource);
        block.innerHTML = result.svg;
        block.classList.add('mermaid-ready');
      } catch (error) {
        enableFallback();
      }
    }
  };
  script.onerror = enableFallback;
  document.head.appendChild(script);
})();
""".strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "projects",
        nargs="*",
        help="Specific project folders under agent-output/ to export. Defaults to all project folders.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_EXPORT_DIR),
        help="Directory where HTML bundles and ZIP archives are written.",
    )
    return parser.parse_args()


def is_markdown_file(file_path: Path) -> bool:
    return file_path.name.lower().endswith(".md")


def is_renderable_text_file(file_path: Path) -> bool:
    return is_markdown_file(file_path) or file_path.suffix.lower() in SPECIAL_RENDER_SUFFIXES


def is_image_file(file_path: Path) -> bool:
    return file_path.suffix.lower() in IMAGE_SUFFIXES


def discover_project_dirs(requested: Iterable[str]) -> list[Path]:
    available = {
        path.name: path
        for path in AGENT_OUTPUT_DIR.iterdir()
        if path.is_dir() and not path.name.startswith(".") and path.name != "_html-exports"
    }
    if requested:
        missing = sorted(set(requested) - set(available))
        if missing:
            missing_display = ", ".join(missing)
            raise SystemExit(f"Unknown project folder(s): {missing_display}")
        return [available[name] for name in requested]
    return sorted(available.values(), key=lambda path: path.name.lower())


def iter_project_files(project_dir: Path) -> list[Path]:
    files = [
        path
        for path in project_dir.rglob("*")
        if path.is_file() and path.name not in EXCLUDED_NAMES and path.suffix.lower() != ".html"
    ]
    return sorted(files, key=lambda path: (path.relative_to(project_dir).parts, path.name.lower()))


def html_path_for_source(relative_path: Path) -> Path:
    if is_markdown_file(relative_path):
        return relative_path.with_suffix(".html")
    return relative_path.with_name(relative_path.name + ".html")


def title_from_markdown(markdown_text: str, fallback: str) -> str:
    for line in markdown_text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
        if line.startswith("## "):
            return line[3:].strip()
    return fallback


def escape_code_block(content: str) -> str:
    return html.escape(content, quote=False)


def render_csv_table(csv_text: str) -> str:
    rows = list(csv.reader(csv_text.splitlines()))
    if not rows:
        return "<p class=\"render-info\">This CSV file is empty.</p>"

    header = rows[0]
    body_rows = rows[1:]
    thead = "".join(f"<th>{html.escape(cell)}</th>" for cell in header)
    tbody = []
    for row in body_rows:
        padded = row + [""] * max(0, len(header) - len(row))
        cells = "".join(f"<td>{html.escape(cell)}</td>" for cell in padded[: len(header)])
        tbody.append(f"<tr>{cells}</tr>")

    return (
        f"<p class=\"data-table-meta\">{len(body_rows)} row(s), {len(header)} column(s).</p>"
        f"<table><thead><tr>{thead}</tr></thead><tbody>{''.join(tbody)}</tbody></table>"
    )


def render_json_block(json_text: str) -> str:
    try:
        parsed = json.loads(json_text)
        formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        formatted = json_text
    escaped = escape_code_block(formatted)
    return f"<pre><code>{escaped}</code></pre>"


def render_plain_code(text: str) -> str:
    escaped = escape_code_block(text)
    return f"<pre><code>{escaped}</code></pre>"


def read_text_content(file_path: Path) -> str:
  for encoding in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
    try:
      return file_path.read_text(encoding=encoding)
    except UnicodeDecodeError:
      continue
  return file_path.read_text(encoding="utf-8", errors="replace")


def prepare_markdown_text(markdown_text: str) -> str:
  block_tag_pattern = re.compile(r"<(div|details|section|article|aside|main)(\s[^>]*)?>", flags=re.IGNORECASE)

  def replacer(match: re.Match[str]) -> str:
    tag_name = match.group(1)
    attributes = match.group(2) or ""
    if "markdown=" in attributes.lower():
      return match.group(0)
    return f"<{tag_name}{attributes} markdown=\"1\">"

  return block_tag_pattern.sub(replacer, markdown_text)


def contains_markdown_syntax(content: str) -> bool:
  return bool(
    re.search(
      r"(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|```|\|.+\||!\[|\[[^\]]+\]\()",
      content,
      flags=re.MULTILINE,
    )
  )


def render_markdown_fragment(fragment: str) -> str:
    return markdown.markdown(fragment.strip(), extensions=MARKDOWN_EXTENSIONS, output_format="html5")


def transform_mermaid_blocks(rendered_html: str) -> tuple[str, bool]:
    mermaid_pattern = re.compile(
        r"<pre><code class=\"language-mermaid\">(?P<content>[\s\S]*?)</code></pre>",
        flags=re.IGNORECASE,
    )
    has_mermaid = False

    def replacer(match: re.Match[str]) -> str:
        nonlocal has_mermaid
        has_mermaid = True
        raw_content = html.unescape(match.group("content")).strip()
        escaped_source = html.escape(raw_content)
        escaped_attr = html.escape(raw_content, quote=True)
        return (
            "<section class=\"mermaid-diagram\" data-mermaid-source=\""
            f"{escaped_attr}\">"
            "<p class=\"mermaid-fallback-note\">"
            "Diagram source is preserved below. When opened with internet access, Mermaid renders it automatically."
            "</p>"
            "<details open><summary>Mermaid source</summary>"
            f"<pre><code>{escaped_source}</code></pre>"
            "</details></section>"
        )

    return mermaid_pattern.sub(replacer, rendered_html), has_mermaid


def render_markdown_inside_html_blocks(rendered_html: str) -> str:
    div_pattern = re.compile(r"<div(?P<attrs>[^>]*)>(?P<content>[\s\S]*?)</div>", flags=re.IGNORECASE)
    details_pattern = re.compile(r"<details(?P<attrs>[^>]*)>(?P<content>[\s\S]*?)</details>", flags=re.IGNORECASE)

    def replace_div(match: re.Match[str]) -> str:
        content = match.group("content")
        if not contains_markdown_syntax(content):
            return match.group(0)
        rendered_inner = render_markdown_fragment(content)
        return f"<div{match.group('attrs')}>{rendered_inner}</div>"

    def replace_details(match: re.Match[str]) -> str:
        content = match.group("content")
        summary_match = re.match(
            r"\s*(?P<summary><summary>[\s\S]*?</summary>)(?P<body>[\s\S]*)",
            content,
            flags=re.IGNORECASE,
        )
        if not summary_match:
            if not contains_markdown_syntax(content):
                return match.group(0)
            rendered_inner = render_markdown_fragment(content)
            return f"<details{match.group('attrs')}>{rendered_inner}</details>"

        body = summary_match.group("body")
        if not contains_markdown_syntax(body):
            return match.group(0)
        rendered_body = render_markdown_fragment(body)
        return f"<details{match.group('attrs')}>{summary_match.group('summary')}{rendered_body}</details>"

    updated = div_pattern.sub(replace_div, rendered_html)
    return details_pattern.sub(replace_details, updated)


def relative_href(from_dir: Path, to_path: Path) -> str:
    return os.path.relpath(str(to_path), start=str(from_dir)).replace("\\", "/")


def rewrite_link_target(url: str, current_source: Path, project_root: Path) -> str:
    if not url or url.startswith(("#", "http://", "https://", "mailto:", "tel:", "data:")):
        return url

    if url.startswith("/"):
        return url

    base, fragment = url.split("#", maxsplit=1) if "#" in url else (url, "")
    base = base.strip()
    current_source_abs = project_root / current_source
    target_candidate = (current_source_abs.parent / base).resolve()

    try:
        target_relative = target_candidate.relative_to(project_root)
    except ValueError:
        return url

    if target_candidate.is_dir():
        readme = target_candidate / "README.md"
        if readme.exists():
            target_relative = html_path_for_source(readme.relative_to(project_root))
        else:
            return url
    elif is_renderable_text_file(target_candidate):
        target_relative = html_path_for_source(target_relative)

    rewritten = str(target_relative).replace("\\", "/")
    if fragment:
        return f"{rewritten}#{fragment}"
    return rewritten


def rewrite_rendered_html_links(rendered_html: str, current_source: Path, project_root: Path) -> str:
    def replacer(match: re.Match[str]) -> str:
        attribute = match.group("attribute")
        quote_char = match.group("quote")
        url = html.unescape(match.group("url"))
        if attribute == "src":
            rewritten = url
        else:
            rewritten = rewrite_link_target(url, current_source, project_root)
        escaped = html.escape(rewritten, quote=True)
        return f"{attribute}={quote_char}{escaped}{quote_char}"

    pattern = re.compile(r'(?P<attribute>href|src)=(?P<quote>["\'])(?P<url>.*?)(?P=quote)')
    return pattern.sub(replacer, rendered_html)


def render_markdown(markdown_text: str, current_source: Path, project_root: Path) -> tuple[str, bool]:
    prepared_text = prepare_markdown_text(markdown_text)
    rendered = markdown.markdown(prepared_text, extensions=MARKDOWN_EXTENSIONS, output_format="html5")
    rendered = render_markdown_inside_html_blocks(rendered)
    rendered, has_mermaid = transform_mermaid_blocks(rendered)
    rendered = rewrite_rendered_html_links(rendered, current_source, project_root)
    return rendered, has_mermaid


def build_navigation(
    project_name: str,
    renderable_files: list[Path],
    current_source: Path,
    current_html: Path,
) -> str:
    grouped: dict[str, list[Path]] = {}
    for file_path in renderable_files:
        key = file_path.parent.as_posix() if file_path.parent != Path(".") else "root"
        grouped.setdefault(key, []).append(file_path)

    sections = []
    for directory in sorted(grouped, key=lambda value: (value != "root", value.lower())):
        label = "Project root" if directory == "root" else directory
        links = []
        for relative in sorted(
            grouped[directory],
            key=lambda path: (path.name != "README.md", path.as_posix().lower()),
        ):
            html_target = html_path_for_source(relative)
            css_class = "active" if relative == current_source else ""
            href = html.escape(relative_href(current_html.parent, html_target), quote=True)
            display_name = relative.name
            links.append(f'<li><a class="{css_class}" href="{href}">{html.escape(display_name)}</a></li>')
        sections.append(
            f'<section class="directory-group"><p class="directory-label">{html.escape(label)}</p>'
            f'<ul class="file-list">{"".join(links)}</ul></section>'
        )

    return (
        '<p class="eyebrow">Project export</p>'
        f'<div class="project-title">{html.escape(project_name)}</div>'
        '<p class="summary">Standalone HTML bundle generated from agent-output artifacts for stakeholder review.</p>'
        '<div class="nav-heading">Documents</div>'
        f'{"".join(sections)}'
        '<div class="nav-heading">Original files</div>'
        '<ul><li><a class="small-link" href="./">Browse bundle folder</a></li></ul>'
    )


def build_page_html(
    *,
    project_name: str,
    relative_source: Path,
    relative_html: Path,
    page_title: str,
    body_html: str,
    renderable_files: list[Path],
    has_mermaid: bool,
) -> str:
    page_dir = relative_html.parent
    style_href = html.escape(relative_href(page_dir, Path("_export/style.css")), quote=True)
    script_src = html.escape(relative_href(page_dir, Path("_export/mermaid-loader.js")), quote=True)
    raw_href = html.escape(relative_href(page_dir, relative_source), quote=True)
    index_href = html.escape(relative_href(page_dir, Path("index.html")), quote=True)
    breadcrumbs = html.escape(str(relative_source).replace("\\", "/"))
    nav_html = build_navigation(project_name, renderable_files, relative_source, relative_html)
    mermaid_notice = (
        '<div class="notice">Mermaid diagrams are included with source fallbacks. '
        'If the archive is opened with internet access, they render automatically.</div>'
        if has_mermaid
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{html.escape(page_title)} | {html.escape(project_name)}</title>
    <link rel=\"stylesheet\" href=\"{style_href}\" />
  </head>
  <body>
    <div class=\"layout\">
      <aside class=\"sidebar\">{nav_html}</aside>
      <main class=\"content-shell\">
        <article class=\"content\">
          <div class=\"topbar\">
            <div>
              <div class=\"breadcrumbs\"><a href=\"{index_href}\">Project home</a> / {breadcrumbs}</div>
              <h1 class=\"page-title\">{html.escape(page_title)}</h1>
              <div class=\"page-meta\">
                <span class=\"badge\">Standalone HTML export</span>
                <a class=\"badge raw-link\" href=\"{raw_href}\">Open original file</a>
              </div>
            </div>
          </div>
          {mermaid_notice}
          {body_html}
        </article>
      </main>
    </div>
    <script src=\"{script_src}\"></script>
  </body>
</html>
"""


def export_project(project_dir: Path, output_dir: Path) -> tuple[Path, Path, int]:
    project_name = project_dir.name
    export_project_dir = output_dir / project_name
    archive_path = output_dir / f"{project_name}-html-export.zip"

    if export_project_dir.exists():
        shutil.rmtree(export_project_dir)
    if archive_path.exists():
        archive_path.unlink()

    shutil.copytree(project_dir, export_project_dir)
    export_support_dir = export_project_dir / "_export"
    export_support_dir.mkdir(parents=True, exist_ok=True)
    (export_support_dir / "style.css").write_text(STYLE_CSS + "\n", encoding="utf-8")
    (export_support_dir / "mermaid-loader.js").write_text(MERMAID_LOADER_JS + "\n", encoding="utf-8")

    source_files = iter_project_files(project_dir)
    renderable_sources = [path for path in source_files if is_renderable_text_file(path)]

    for source_path in renderable_sources:
        relative_source = source_path.relative_to(project_dir)
        relative_html = html_path_for_source(relative_source)
        destination_html = export_project_dir / relative_html
        destination_html.parent.mkdir(parents=True, exist_ok=True)
        source_text = read_text_content(source_path)

        if is_markdown_file(source_path):
            page_title = title_from_markdown(source_text, source_path.name)
            body_html, has_mermaid = render_markdown(source_text, relative_source, project_dir)
        elif source_path.suffix.lower() == ".json":
            page_title = source_path.name
            body_html = render_json_block(source_text)
            has_mermaid = False
        elif source_path.suffix.lower() == ".csv":
            page_title = source_path.name
            body_html = render_csv_table(source_text)
            has_mermaid = False
        else:
            page_title = source_path.name
            body_html = render_plain_code(source_text)
            has_mermaid = False

        full_html = build_page_html(
            project_name=project_name,
            relative_source=relative_source,
            relative_html=relative_html,
            page_title=page_title,
            body_html=body_html,
            renderable_files=[path.relative_to(project_dir) for path in renderable_sources],
            has_mermaid=has_mermaid,
        )
        destination_html.write_text(full_html, encoding="utf-8")

    if (export_project_dir / "README.html").exists():
        index_content = (
            "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
            "<meta http-equiv=\"refresh\" content=\"0; url=README.html\" />"
            "<title>Project export</title></head><body>"
            '<p>Redirecting to <a href=\"README.html\">README.html</a>...</p>'
            "</body></html>"
        )
    else:
        first_page = html_path_for_source(renderable_sources[0].relative_to(project_dir)) if renderable_sources else None
        target = str(first_page).replace("\\", "/") if first_page else ""
        index_content = (
            "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
            f"<meta http-equiv=\"refresh\" content=\"0; url={html.escape(target, quote=True)}\" />"
            "<title>Project export</title></head><body>"
            f'<p>Redirecting to <a href=\"{html.escape(target, quote=True)}\">{html.escape(target)}</a>...</p>'
            "</body></html>"
        )
    (export_project_dir / "index.html").write_text(index_content, encoding="utf-8")

    with zipfile.ZipFile(archive_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(export_project_dir.rglob("*")):
            if file_path.is_file():
                archive.write(file_path, arcname=file_path.relative_to(output_dir))

    return export_project_dir, archive_path, len(renderable_sources)


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    projects = discover_project_dirs(args.projects)
    if not projects:
        print("No project folders found under agent-output/", file=sys.stderr)
        return 1

    exported = []
    for project_dir in projects:
        export_dir, archive_path, rendered_count = export_project(project_dir, output_dir)
        exported.append((project_dir.name, export_dir, archive_path, rendered_count))
        print(f"✅ Exported {project_dir.name}: {rendered_count} rendered file(s)")
        print(f"   HTML bundle: {export_dir}")
        print(f"   ZIP archive: {archive_path}")

    print(f"\nFinished exporting {len(exported)} project(s) to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
