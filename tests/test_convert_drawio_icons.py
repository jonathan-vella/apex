"""Unit tests for convert-azure-icons-to-drawio.py."""

import base64
import json
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

# Add scripts/ to path so we can import the module
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from importlib import import_module

# Import with hyphenated filename
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "convert_drawio",
    Path(__file__).resolve().parent.parent / "scripts" / "convert-azure-icons-to-drawio.py",
)
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

sanitize_name = mod.sanitize_name
make_safe_filename = mod.make_safe_filename
make_mxlibrary_entry = mod.make_mxlibrary_entry
make_standalone_drawio = mod.make_standalone_drawio
extract_category = mod.extract_category
write_mxlibrary = mod.write_mxlibrary


# ---------------------------------------------------------------------------
# sanitize_name
# ---------------------------------------------------------------------------

def test_sanitize_strips_numeric_prefix():
    assert sanitize_name("00001-icon-service-VM.svg") == "icon-service-VM"


def test_sanitize_replaces_underscores():
    assert sanitize_name("icon_service_App_Services.svg") == "icon-service-App-Services"


def test_sanitize_collapses_hyphens():
    assert sanitize_name("icon---service--VM.svg") == "icon-service-VM"


def test_sanitize_strips_leading_trailing_hyphens():
    assert sanitize_name("-icon-service-.svg") == "icon-service"


def test_sanitize_handles_spaces():
    assert sanitize_name("icon service VM.svg") == "icon-service-VM"


def test_sanitize_empty_after_strip():
    """A name that becomes empty after sanitization."""
    assert sanitize_name("00001-.svg") == ""


def test_sanitize_no_prefix():
    assert sanitize_name("icon-service-VM.svg") == "icon-service-VM"


# ---------------------------------------------------------------------------
# make_safe_filename
# ---------------------------------------------------------------------------

def test_safe_filename_basic():
    assert make_safe_filename("icon-service-VM") == "icon-service-VM"


def test_safe_filename_parentheses():
    """Parentheses should become hyphens, then collapse."""
    result = make_safe_filename("icon-name-(preview)")
    assert "()" not in result
    assert result == "icon-name-preview"


def test_safe_filename_special_chars():
    result = make_safe_filename("icon+name@v2!")
    assert result == "icon-name-v2"


def test_safe_filename_matches_sanitize():
    """After sanitize_name, make_safe_filename should be idempotent for normal names."""
    name = sanitize_name("00001-icon-service-App-Services.svg")
    assert make_safe_filename(name) == name


def test_safe_filename_divergence_fixed():
    """The old bug: sanitize keeps parens, safe_filename replaces them.
    After fix, safe_filename collapses the resulting hyphens."""
    sanitized = sanitize_name("icon-name (preview).svg")
    # sanitize: "icon-name-(preview)" (parens kept, spaces→hyphens)
    safe = make_safe_filename(sanitized)
    # safe: "icon-name-preview" (parens→hyphens, collapsed, stripped)
    assert "--" not in safe
    assert safe.endswith("preview")


# ---------------------------------------------------------------------------
# make_mxlibrary_entry
# ---------------------------------------------------------------------------

def test_mxlibrary_entry_structure():
    entry = make_mxlibrary_entry("Test Icon", "data:image/svg+xml;base64,dGVzdA==")
    assert entry["title"] == "Test Icon"
    assert entry["w"] == 48
    assert entry["h"] == 48
    assert "&lt;" in entry["xml"]
    assert "&gt;" in entry["xml"]
    assert "Test Icon" in entry["xml"]


def test_mxlibrary_entry_escapes_html_in_title():
    entry = make_mxlibrary_entry("Icon <b>Bold</b>", "data:image/svg+xml;base64,dGVzdA==")
    # html.escape converts < > in title to &lt; &gt;
    # Then the full XML is entity-escaped again for mxlibrary format
    # So <b> → &lt;b&gt; (html.escape) → &amp;lt;b&amp;gt; (xml entity escape)
    assert "Icon " in entry["xml"]
    assert entry["title"] == "Icon <b>Bold</b>"


def test_mxlibrary_entry_custom_dimensions():
    entry = make_mxlibrary_entry("Test", "data:x", width=64, height=64)
    assert entry["w"] == 64
    assert entry["h"] == 64


# ---------------------------------------------------------------------------
# make_standalone_drawio
# ---------------------------------------------------------------------------

def test_standalone_drawio_valid_xml():
    xml = make_standalone_drawio("Test", "data:image/svg+xml;base64,dGVzdA==")
    assert xml.startswith("<mxfile>")
    assert xml.strip().endswith("</mxfile>")
    assert 'id="0"' in xml
    assert 'id="1" parent="0"' in xml
    assert 'vertex="1"' in xml
    assert "data:image/svg+xml;base64,dGVzdA==" in xml


def test_standalone_drawio_escapes_title():
    xml = make_standalone_drawio("A & B <test>", "data:x")
    assert "&amp;" in xml
    assert "&lt;" in xml


# ---------------------------------------------------------------------------
# extract_category
# ---------------------------------------------------------------------------

def test_extract_category_standard():
    assert extract_category("Azure_Icons/Icons/Compute/SVG/vm.svg") == "Compute"


def test_extract_category_nested():
    assert extract_category("Icons/Networking/SVG/vnet.svg") == "Networking"


def test_extract_category_case_insensitive():
    assert extract_category("root/icons/Storage/file.svg") == "Storage"


def test_extract_category_fallback():
    """When 'Icons' folder not found, falls back to parent dir name."""
    assert extract_category("some/random/path/file.svg") == "path"


# ---------------------------------------------------------------------------
# write_mxlibrary
# ---------------------------------------------------------------------------

def test_write_mxlibrary_format():
    entries = [{"xml": "test", "w": 48, "h": 48, "title": "A"}]
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False, mode="w") as f:
        tmp = Path(f.name)
    try:
        write_mxlibrary(entries, tmp)
        content = tmp.read_text()
        assert content.startswith("<mxlibrary>")
        assert content.strip().endswith("</mxlibrary>")
        # Parse the JSON inside
        inner = content.replace("<mxlibrary>", "").replace("</mxlibrary>", "").strip()
        parsed = json.loads(inner)
        assert len(parsed) == 1
        assert parsed[0]["title"] == "A"
    finally:
        tmp.unlink()


def test_write_mxlibrary_empty():
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False, mode="w") as f:
        tmp = Path(f.name)
    try:
        write_mxlibrary([], tmp)
        content = tmp.read_text()
        assert content.strip() == "<mxlibrary>[]</mxlibrary>"
    finally:
        tmp.unlink()


def test_write_mxlibrary_multiple():
    entries = [
        {"xml": "a", "w": 48, "h": 48, "title": "A"},
        {"xml": "b", "w": 48, "h": 48, "title": "B"},
    ]
    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False, mode="w") as f:
        tmp = Path(f.name)
    try:
        write_mxlibrary(entries, tmp)
        content = tmp.read_text()
        inner = content.replace("<mxlibrary>", "").replace("</mxlibrary>", "").strip()
        parsed = json.loads(inner)
        assert len(parsed) == 2
    finally:
        tmp.unlink()


# ---------------------------------------------------------------------------
# Integration: process_zip with a synthetic ZIP
# ---------------------------------------------------------------------------

def _make_test_zip(tmp_dir: Path, icons: dict[str, bytes]) -> Path:
    """Create a synthetic Azure icon ZIP for testing."""
    zip_path = tmp_dir / "test-icons.zip"
    with ZipFile(zip_path, "w") as zf:
        for path_str, svg_content in icons.items():
            zf.writestr(path_str, svg_content)
    return zip_path


def test_process_zip_basic(tmp_path, monkeypatch):
    """Full pipeline test with a small synthetic ZIP."""
    # Redirect output paths to tmp
    monkeypatch.setattr(mod, "OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(mod, "SPLIT_DIR", tmp_path / "azure-icons")
    monkeypatch.setattr(mod, "ICONS_DIR", tmp_path / "azure-icons" / "icons")
    monkeypatch.setattr(mod, "MANIFEST_FILE", tmp_path / "azure-icons" / "manifest.json")
    monkeypatch.setattr(mod, "REFERENCE_FILE", tmp_path / "azure-icons" / "reference.md")

    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect/></svg>'
    zip_path = _make_test_zip(tmp_path, {
        "Azure_Icons/Icons/Compute/SVG/00001-icon-service-VM.svg": svg,
        "Azure_Icons/Icons/Compute/SVG/00002-icon-service-App-Services.svg": svg,
        "Azure_Icons/Icons/Networking/SVG/00003-icon-service-VNet.svg": svg,
    })

    mod.process_zip(str(zip_path))

    # Verify outputs
    manifest = json.loads((tmp_path / "azure-icons" / "manifest.json").read_text())
    assert manifest["totalIcons"] == 3
    assert manifest["categories"] == 2
    assert "Compute" in manifest["categoryList"]
    assert "Networking" in manifest["categoryList"]

    ref = (tmp_path / "azure-icons" / "reference.md").read_text()
    assert "icon-service-VM" in ref
    assert "icon-service-App-Services" in ref
    assert "icon-service-VNet" in ref

    # Individual icons exist
    assert (tmp_path / "azure-icons" / "icons" / "icon-service-VM.xml").exists()
    assert (tmp_path / "azure-icons" / "icons" / "icon-service-VNet.xml").exists()

    # Category libraries exist
    cat_files = list((tmp_path / "azure-icons").glob("*.xml"))
    assert len(cat_files) == 2  # Compute + Networking


def test_process_zip_deduplication(tmp_path, monkeypatch, capsys):
    """Duplicate icon names should be deduplicated with a warning."""
    monkeypatch.setattr(mod, "OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(mod, "SPLIT_DIR", tmp_path / "azure-icons")
    monkeypatch.setattr(mod, "ICONS_DIR", tmp_path / "azure-icons" / "icons")
    monkeypatch.setattr(mod, "MANIFEST_FILE", tmp_path / "azure-icons" / "manifest.json")
    monkeypatch.setattr(mod, "REFERENCE_FILE", tmp_path / "azure-icons" / "reference.md")

    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
    zip_path = _make_test_zip(tmp_path, {
        "Icons/Compute/SVG/00001-icon-service-VM.svg": svg,
        "Icons/Compute/SVG/icon-service-VM.svg": svg,  # duplicate after sanitize
    })

    mod.process_zip(str(zip_path))

    manifest = json.loads((tmp_path / "azure-icons" / "manifest.json").read_text())
    assert manifest["totalIcons"] == 1

    captured = capsys.readouterr()
    assert "Skipping duplicate" in captured.out


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
