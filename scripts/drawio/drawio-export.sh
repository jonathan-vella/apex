#!/usr/bin/env bash
# Export .drawio files to PNG/SVG/PDF with embedded diagram XML.
# Uses draw.io Desktop in headless mode via xvfb for devcontainer support.
#
# Usage:
#   scripts/drawio/drawio-export.sh input.drawio              # → input.drawio.png
#   scripts/drawio/drawio-export.sh input.drawio --format svg  # → input.drawio.svg
#   scripts/drawio/drawio-export.sh input.drawio --format pdf  # → input.drawio.pdf
#
# Requirements:
#   - draw.io Desktop (drawio CLI) or xdg-open fallback
#   - xvfb for headless rendering: apt-get install -y xvfb

set -euo pipefail

readonly SCRIPT_NAME="$(basename "$0")"

usage() {
  echo "Usage: ${SCRIPT_NAME} <input.drawio> [--format png|svg|pdf] [--output <path>]"
  echo ""
  echo "Options:"
  echo "  --format   Output format: png (default), svg, pdf"
  echo "  --output   Output file path (default: input.drawio.{format})"
  echo "  --help     Show this help message"
  exit 1
}

# Defaults
FORMAT="png"
INPUT=""
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "${INPUT}" ]]; then
        INPUT="$1"
      else
        echo "❌ Unexpected argument: $1" >&2
        usage
      fi
      shift
      ;;
  esac
done

if [[ -z "${INPUT}" ]]; then
  echo "❌ Input file required" >&2
  usage
fi

if [[ ! -f "${INPUT}" ]]; then
  echo "❌ File not found: ${INPUT}" >&2
  exit 1
fi

# Determine output path
if [[ -z "${OUTPUT}" ]]; then
  OUTPUT="${INPUT}.${FORMAT}"
fi

# Find drawio executable
DRAWIO_CMD=""
for cmd in drawio draw.io /opt/drawio/drawio /usr/bin/drawio; do
  if command -v "${cmd}" &>/dev/null || [[ -x "${cmd}" ]]; then
    DRAWIO_CMD="${cmd}"
    break
  fi
done

# Check for AppImage
if [[ -z "${DRAWIO_CMD}" ]]; then
  APPIMAGE_PATH="/opt/drawio/drawio.AppImage"
  if [[ -x "${APPIMAGE_PATH}" ]]; then
    DRAWIO_CMD="${APPIMAGE_PATH}"
  fi
fi

if [[ -z "${DRAWIO_CMD}" ]]; then
  echo "❌ draw.io Desktop not found (not installed by default)." >&2
  echo "   Use the hediet.vscode-drawio VS Code extension instead:" >&2
  echo "   Right-click a .drawio file → Export → SVG/PNG" >&2
  exit 1
fi

# Build export command
EXPORT_ARGS=(
  "--export"
  "--format" "${FORMAT}"
  "--embed-diagram"
  "--output" "${OUTPUT}"
  "${INPUT}"
)

# Use xvfb-run if available and no display is set (headless)
if [[ -z "${DISPLAY:-}" ]] && command -v xvfb-run &>/dev/null; then
  echo "🖥️  Headless mode (xvfb)"
  xvfb-run -a "${DRAWIO_CMD}" "${EXPORT_ARGS[@]}" --no-sandbox 2>/dev/null
elif [[ -n "${DISPLAY:-}" ]]; then
  "${DRAWIO_CMD}" "${EXPORT_ARGS[@]}" 2>/dev/null
else
  echo "⚠️  No display and xvfb not available. Install: apt-get install -y xvfb" >&2
  echo "   Attempting export anyway..." >&2
  "${DRAWIO_CMD}" "${EXPORT_ARGS[@]}" --no-sandbox 2>/dev/null || true
fi

if [[ -f "${OUTPUT}" ]]; then
  echo "✅ Exported: ${OUTPUT}"
else
  echo "❌ Export failed — output file not created: ${OUTPUT}" >&2
  exit 1
fi
