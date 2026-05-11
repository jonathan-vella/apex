#!/usr/bin/env bash
# Batch-format an entire Bicep project tree in a single bicep CLI call.
#
# Replaces N per-file `mcp_bicep_format_bicep_file` invocations (one per
# module) with one `bicep format --pattern` invocation. The May 2026
# nordic-foods retro counted 25 sequential format calls in a single
# Step 5 — this wrapper collapses them to one.
#
# Usage:
#   tools/scripts/format-bicep-tree.sh <project-dir>
#
# Examples:
#   tools/scripts/format-bicep-tree.sh infra/bicep/nordic-foods
#   tools/scripts/format-bicep-tree.sh infra/bicep/nordic-foods --check
#
# Flags:
#   --check     Exit non-zero if any file would be modified (CI-friendly).
#
# Notes:
#   - Globs are passed straight to `bicep format --pattern`, which uses
#     glob semantics, not shell semantics.
#   - The script formats `main.bicep`, all `modules/**/*.bicep`, and any
#     other `*.bicep` siblings in the project root.
#   - `.bicepparam` files are NOT formatted (bicep format does not support
#     them as of CLI 0.42).

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <project-dir> [--check]" >&2
  exit 2
fi

PROJECT_DIR="$1"
CHECK_MODE="${2:-}"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Error: project directory not found: $PROJECT_DIR" >&2
  exit 2
fi

if ! command -v bicep >/dev/null 2>&1; then
  echo "Error: 'bicep' CLI not found on PATH" >&2
  exit 127
fi

# Resolve absolute path so the pattern is unambiguous.
ABS_DIR="$(cd "$PROJECT_DIR" && pwd)"
PATTERN="${ABS_DIR}/**/*.bicep"

# Count files for reporting.
FILE_COUNT=$(find "$ABS_DIR" -type f -name '*.bicep' | wc -l)

if [[ "$FILE_COUNT" -eq 0 ]]; then
  echo "No .bicep files found under $ABS_DIR — nothing to format."
  exit 0
fi

if [[ "$CHECK_MODE" == "--check" ]]; then
  # Compute hashes before and after a dry-run format-to-stdout.
  # `bicep format --pattern` writes in place; for --check we copy to a
  # temp tree and diff.
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  cp -r "$ABS_DIR" "$TMP_DIR/snapshot"
  bicep format --pattern "$TMP_DIR/snapshot/**/*.bicep" >/dev/null
  if diff -r "$ABS_DIR" "$TMP_DIR/snapshot" >/dev/null 2>&1; then
    echo "format-bicep-tree: OK ($FILE_COUNT file(s) already formatted)"
    exit 0
  else
    echo "format-bicep-tree: DRIFT ($FILE_COUNT file(s) need formatting)" >&2
    diff -r "$ABS_DIR" "$TMP_DIR/snapshot" | head -40 >&2 || true
    exit 1
  fi
fi

bicep format --pattern "$PATTERN"
echo "format-bicep-tree: formatted $FILE_COUNT file(s) under $ABS_DIR"
